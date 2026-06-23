// src/pages/Manage.jsx - 图片管理页面（密码从环境变量读取 + 历史记录搜索 + Telegram 分类）
import React, { useState, useEffect, useRef } from 'react'
import { fetchImageList, copyToClipboard, batchCopyLinks } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'

// 占位图
const PLACEHOLDER_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23ccc" font-size="20"%3E🖼%3C/text%3E%3C/svg%3E'

export default function Manage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  
  const [images, setImages] = useState({ wallpaper: [], cover: [], sh: [], sd: [], telegram: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('wallpaper')
  const [copiedId, setCopiedId] = useState(null)
  
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 48
  
  const [previewImage, setPreviewImage] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [historyList, setHistoryList] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set())
  const [historySearchKeyword, setHistorySearchKeyword] = useState('')
  
  const [loadedImages, setLoadedImages] = useState(new Set())
  const [bgImage, setBgImage] = useState('')

  // ============================================================
  // 自动获取域名生成代理链接
  // ============================================================
  const getProxyUrl = (img) => {
    if (img.source === 'external') return img.url
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    
    if (img.source === 'telegram' && img.filePath) {
      const encodedPath = encodeURIComponent(`telegram/${img.filePath}`)
      return `${baseUrl}/api/image?path=${encodedPath}`
    }
    
    const encodedPath = encodeURIComponent(img.folder + '/' + img.name)
    return `${baseUrl}/api/image?path=${encodedPath}`
  }

  const getImageAspect = (img) => {
    if (img.folder === 'wallpaper' || img.folder === 'sh') return 'aspect-video'
    if (img.folder === 'cover' || img.folder === 'sd') return 'aspect-9/16'
    if (img.folder === 'telegram') return 'aspect-square'
    return 'aspect-square'
  }

  // ============================================================
  // 背景图：只加载一次
  // ============================================================
  useEffect(() => {
    const img = new Image()
    const url = `/api/wallpaper?t=${Date.now()}`
    img.onload = () => {
      setBgImage(`url(${url})`)
    }
    img.src = url
  }, [])

  // ============================================================
  // 检查登录状态
  // ============================================================
  useEffect(() => {
    const savedAuth = localStorage.getItem('manage_auth')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
      loadImages()
    }
  }, [])

  // ============================================================
  // 历史记录相关
  // ============================================================
  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/history`)
      const data = await res.json()
      setHistoryList(data.history || [])
    } catch (err) {
      console.error('加载历史记录失败:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDeleteHistory = async (id) => {
    if (!confirm('确定要删除这条记录吗？')) return
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        await loadHistory()
        setSelectedHistoryIds(new Set())
      }
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const toggleSelectHistory = (id, e) => {
    if (e) e.stopPropagation()
    const newSelected = new Set(selectedHistoryIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedHistoryIds(newSelected)
  }

  const selectAllHistory = () => {
    const filteredHistory = getFilteredHistory()
    if (selectedHistoryIds.size === filteredHistory.length && filteredHistory.length > 0) {
      setSelectedHistoryIds(new Set())
    } else {
      const allIds = new Set(filteredHistory.map(record => record.id))
      setSelectedHistoryIds(allIds)
    }
  }

  const handleBatchDeleteHistory = async () => {
    const selectedCount = selectedHistoryIds.size
    if (selectedCount === 0) {
      alert('请先选择要删除的记录')
      return
    }
    if (!confirm(`确定要删除选中的 ${selectedCount} 条记录吗？\n\n⚠️ 此操作不可恢复！`)) return
    
    let successCount = 0
    let failCount = 0
    
    for (const id of selectedHistoryIds) {
      try {
        const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }
    
    alert(`✅ 删除完成\n成功: ${successCount} 条\n失败: ${failCount} 条`)
    setSelectedHistoryIds(new Set())
    await loadHistory()
  }

  const getFilteredHistory = () => {
    if (historySearchKeyword.trim() === '') {
      return historyList
    }
    return historyList.filter(record => 
      record.filename.toLowerCase().includes(historySearchKeyword.toLowerCase())
    )
  }

  // ============================================================
  // 登录相关
  // ============================================================
  const handleLogin = (e) => {
    e.preventDefault()
    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'
    
    if (password === correctPassword) {
      setIsAuthenticated(true)
      localStorage.setItem('manage_auth', 'true')
      setPasswordError(false)
      loadImages()
    } else {
      setPasswordError(true)
      setPassword('')
    }
  }

  // ============================================================
  // 图片相关
  // ============================================================
  const loadImages = async () => {
    setLoading(true)
    setLoadedImages(new Set())
    try {
      const data = await fetchImageList()
      setImages(data.folders || { wallpaper: [], cover: [], sh: [], sd: [], telegram: [] })
    } catch (err) {
      console.error('加载图片列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshCurrent = () => {
    loadImages()
    if (activeTab === 'history') loadHistory()
  }

  const handleCopy = (url, name, event) => {
    if (event) event.stopPropagation()
    copyToClipboard(url)
    setCopiedId(name)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (img, folder, event) => {
    if (event) event.stopPropagation()
    if (!confirm(`确定要删除 "${img.name}" 吗？\n\n⚠️ 此操作不可恢复！`)) return
    
    setDeletingId(img.name)
    try {
      const response = await fetch(`/api/admin/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: img.name,
          folder: folder,
          sha: img.sha,
          source: img.source,
          tgMessageId: img.messageId
        })
      })
      const result = await response.json()
      if (result.success) {
        await loadImages()
        setSelectedImages(new Set())
        alert(`✅ 已删除 "${img.name}"`)
      } else {
        alert(`❌ 删除失败: ${result.error || '未知错误'}`)
      }
    } catch (err) {
      console.error('删除失败:', err)
      alert('❌ 删除失败，请稍后重试')
    } finally {
      setDeletingId(null)
    }
  }

  const handleBatchDelete = async () => {
    const selectedCount = selectedImages.size
    if (selectedCount === 0) return alert('请先选择图片')
    if (!confirm(`确定要删除选中的 ${selectedCount} 张图片吗？\n\n⚠️ 此操作不可恢复！`)) return
    
    const selectedImgList = paginatedImages.filter(img => selectedImages.has(img.name))
    let successCount = 0
    let failCount = 0
    
    for (const img of selectedImgList) {
      try {
        const response = await fetch(`/api/admin/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: img.name,
            folder: activeTab,
            sha: img.sha,
            source: img.source,
            tgMessageId: img.messageId
          })
        })
        const result = await response.json()
        result.success ? successCount++ : failCount++
      } catch {
        failCount++
      }
    }
    
    alert(`✅ 删除完成\n成功: ${successCount} 张\n失败: ${failCount} 张`)
    setSelectedImages(new Set())
    await loadImages()
  }

  // ============================================================
  // 标签页切换
  // ============================================================
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setSearchKeyword('')
    setHistorySearchKeyword('')
    setSelectedImages(new Set())
    setSelectedHistoryIds(new Set())
    setLoadedImages(new Set())
    setMobileMenuOpen(false)
    if (tab === 'history') loadHistory()
  }

  const toggleSelect = (imgName, e) => {
    if (e) e.stopPropagation()
    const newSelected = new Set(selectedImages)
    if (newSelected.has(imgName)) {
      newSelected.delete(imgName)
    } else {
      newSelected.add(imgName)
    }
    setSelectedImages(newSelected)
  }

  const selectAll = () => {
    if (selectedImages.size === paginatedImages.length) {
      setSelectedImages(new Set())
    } else {
      setSelectedImages(new Set(paginatedImages.map(img => img.name)))
    }
  }

  const handleBatchCopy = async (format) => {
    const selectedUrls = paginatedImages
      .filter(img => selectedImages.has(img.name))
      .map(img => getProxyUrl(img))
    if (selectedUrls.length === 0) return alert('请先选择图片')
    await batchCopyLinks(selectedUrls, format)
    setShowBatchMenu(false)
  }

  // ============================================================
  // 分页和搜索
  // ============================================================
  const allImages = images[activeTab] || []
  const filteredImages = searchKeyword.trim() === ''
    ? allImages
    : allImages.filter(img => img.name.toLowerCase().includes(searchKeyword.toLowerCase()))
  const totalCount = filteredImages.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedImages = filteredImages.slice(startIndex, startIndex + pageSize)

  const formatTime = (isoString) => new Date(isoString).toLocaleString('zh-CN')

  const filteredHistory = getFilteredHistory()

  // ============================================================
  // 预加载首屏图片
  // ============================================================
  useEffect(() => {
    if (activeTab !== 'history' && paginatedImages.length > 0) {
      const preloadCount = Math.min(4, paginatedImages.length)
      const imagesToPreload = paginatedImages.slice(0, preloadCount)
      imagesToPreload.forEach(img => {
        setLoadedImages(prev => new Set(prev).add(img.name))
      })
    }
  }, [activeTab, currentPage, searchKeyword, paginatedImages])

  // ============================================================
  // 未登录界面（统一风格）
  // ============================================================
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundImage: bgImage || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 w-full max-w-md border border-white/30">
          <div className="text-center mb-6">
            <i className="fas fa-lock text-5xl text-white/70 mb-3"></i>
            <h2 className="text-2xl font-bold text-white">管理后台</h2>
            <p className="text-white/50 text-sm mt-1">请输入密码进入</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理密码"
              className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {passwordError && (
              <p className="text-red-400 text-sm text-center">
                <i className="fas fa-exclamation-circle mr-1"></i>密码错误，请重试
              </p>
            )}
            <div className="flex justify-center">
              <button
                type="submit"
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium transition"
              >
                验证
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ============================================================
  // 已登录界面（统一毛玻璃风格）
  // ============================================================
  return (
    <div
      className="min-h-screen py-6 px-4"
      style={{
        backgroundImage: bgImage || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <ThemeToggle />

      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/20 backdrop-blur-sm hover:bg-white/30 transition p-2.5 rounded-lg text-white shadow-md"
      >
        <i className="fas fa-bars text-lg"></i>
      </button>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 左侧菜单 - 毛玻璃效果 */}
      <div
        className={`
          fixed top-0 left-0 h-full z-50 w-64 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-2xl transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:left-4 lg:top-1/2 lg:-translate-y-1/2 lg:w-56 lg:h-auto lg:rounded-2xl
          lg:bg-white/70 dark:lg:bg-gray-900/70 lg:backdrop-blur-md lg:border lg:border-white/30
        `}
      >
        <div className="p-4 border-b border-gray-200/30 dark:border-gray-800/30 flex justify-between items-center lg:block">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
              <i className="fas fa-folder-tree text-blue-500"></i>
              <span>图片库</span>
            </div>
            <button
              onClick={refreshCurrent}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
              title="刷新"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl mt-2"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-3 border-b border-gray-200/30 dark:border-gray-800/30">
          <a
            href="/"
            className="flex items-center gap-2 w-full p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-800/30 transition"
          >
            <i className="fas fa-home w-4 text-blue-500"></i>
            <span className="text-sm">返回首页</span>
          </a>
          <button
            onClick={() => {
              setIsAuthenticated(false)
              localStorage.removeItem('manage_auth')
            }}
            className="flex items-center gap-2 w-full p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-800/30 transition mt-1"
          >
            <i className="fas fa-sign-out-alt w-4 text-red-500"></i>
            <span className="text-sm">退出登录</span>
          </button>
        </div>

        <div className="p-2">
          {/* 分类列表 */}
          {['wallpaper', 'cover', 'sh', 'sd'].map((folderName) => {
            const displayName = {
              wallpaper: '横屏图片',
              cover: '竖屏图片',
              sh: '横屏图片 (sh)',
              sd: '竖屏图片 (sd)'
            }[folderName]

            const activeColor = {
              wallpaper: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
              cover: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
              sh: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
              sd: 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
            }[folderName]

            return (
              <div
                key={folderName}
                onClick={() => handleTabChange(folderName)}
                className={`
                  flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200
                  ${folderName !== 'wallpaper' ? 'mt-1' : ''}
                  ${activeTab === folderName
                    ? `${activeColor} bg-white/20 backdrop-blur-sm`
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-800/30'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <i className={`fas ${activeTab === folderName ? 'fa-folder-open' : 'fa-folder'} text-sm`}></i>
                  <span className="text-sm font-medium">{displayName}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  {images[folderName]?.length || 0}
                </span>
              </div>
            )
          })}

          {/* Telegram 分类 */}
          <div
            onClick={() => handleTabChange('telegram')}
            className={`
              flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 mt-2
              ${activeTab === 'telegram'
                ? 'bg-green-500/20 text-green-600 dark:text-green-400 bg-white/20 backdrop-blur-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-paper-plane text-sm"></i>
              <span className="text-sm font-medium">Telegram 图片</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
              {images['telegram']?.length || 0}
            </span>
          </div>

          {/* 历史记录 */}
          <div
            onClick={() => handleTabChange('history')}
            className={`
              flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 mt-2
              ${activeTab === 'history'
                ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400 bg-white/20 backdrop-blur-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-history text-sm"></i>
              <span className="text-sm font-medium">上传历史</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
              {historyList.length}
            </span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="lg:pl-[250px]">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/30 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-gray-800 dark:text-white font-semibold flex items-center gap-2 text-base sm:text-lg">
                <i className={`
                  fas
                  ${activeTab === 'wallpaper' || activeTab === 'sh'
                    ? 'fa-arrows-alt text-blue-500'
                    : activeTab === 'cover' || activeTab === 'sd'
                    ? 'fa-mobile-alt text-purple-500'
                    : activeTab === 'telegram'
                    ? 'fa-paper-plane text-green-500'
                    : 'fa-history text-teal-500'
                  }
                `}></i>
                {activeTab === 'wallpaper'
                  ? '横屏图片 (wallpaper)'
                  : activeTab === 'cover'
                  ? '竖屏图片 (cover)'
                  : activeTab === 'sh'
                  ? '横屏图片 (sh)'
                  : activeTab === 'sd'
                  ? '竖屏图片 (sd)'
                  : activeTab === 'telegram'
                  ? 'Telegram 图片'
                  : '上传历史'}
              </h2>
              {activeTab !== 'history' && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  共 {totalCount} 张图片 · 第 {currentPage}/{totalPages || 1} 页
                </p>
              )}
              {activeTab === 'history' && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  共 {filteredHistory.length} 条记录
                </p>
              )}
            </div>
            {activeTab !== 'history' && totalPages > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70 disabled:opacity-30 transition text-sm backdrop-blur-sm"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className="px-4 py-1.5 rounded-lg bg-white/70 dark:bg-gray-700/70 text-gray-700 dark:text-white text-sm font-medium backdrop-blur-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70 disabled:opacity-30 transition text-sm backdrop-blur-sm"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 搜索框 */}
        {activeTab !== 'history' && (
          <div className="mb-4">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm"></i>
              <input
                type="text"
                placeholder="按文件名搜索图片..."
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 历史记录搜索框 */}
        {activeTab === 'history' && (
          <div className="mb-4">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm"></i>
              <input
                type="text"
                placeholder="搜索历史记录中的文件名..."
                value={historySearchKeyword}
                onChange={(e) => {
                  setHistorySearchKeyword(e.target.value)
                  setSelectedHistoryIds(new Set())
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              />
              {historySearchKeyword && (
                <button
                  onClick={() => setHistorySearchKeyword('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>
            {historySearchKeyword && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                找到 {filteredHistory.length} 条匹配记录
              </p>
            )}
          </div>
        )}

        {/* 批量操作栏 */}
        {activeTab !== 'history' && selectedImages.size > 0 && (
          <div className="bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-2 border border-blue-200/50 dark:border-blue-800/50">
            <span className="text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
              <i className="fas fa-check-circle"></i>
              已选择 {selectedImages.size} 张图片
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2"
              >
                {selectedImages.size === paginatedImages.length ? '取消全选' : '全选'}
              </button>
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm flex items-center gap-2 transition"
              >
                <i className="fas fa-trash-alt"></i>
                批量删除 ({selectedImages.size})
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-600/70 text-gray-700 dark:text-white text-sm flex items-center gap-2 transition backdrop-blur-sm"
                >
                  <i className="fas fa-copy"></i>
                  批量复制
                  <i className="fas fa-chevron-down text-xs"></i>
                </button>
                {showBatchMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-44 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg overflow-hidden z-[200] border border-white/30 dark:border-gray-700">
                    <button
                      onClick={() => handleBatchCopy('url')}
                      className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 text-sm flex items-center gap-2"
                    >
                      <i className="fas fa-link"></i> 复制链接 (URL)
                    </button>
                    <button
                      onClick={() => handleBatchCopy('markdown')}
                      className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 text-sm flex items-center gap-2"
                    >
                      <i className="fab fa-markdown"></i> 复制 Markdown
                    </button>
                    <button
                      onClick={() => handleBatchCopy('html')}
                      className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 text-sm flex items-center gap-2"
                    >
                      <i className="fab fa-html5"></i> 复制 HTML
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 批量操作栏（历史记录） */}
        {activeTab === 'history' && selectedHistoryIds.size > 0 && (
          <div className="bg-teal-50/80 dark:bg-teal-900/30 backdrop-blur-sm rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-2 border border-teal-200/50 dark:border-teal-800/50">
            <span className="text-teal-700 dark:text-teal-300 text-sm flex items-center gap-2">
              <i className="fas fa-check-circle"></i>
              已选择 {selectedHistoryIds.size} 条记录
              <button
                onClick={selectAllHistory}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline ml-2"
              >
                {selectedHistoryIds.size === filteredHistory.length ? '取消全选' : '全选'}
              </button>
            </span>
            <button
              onClick={handleBatchDeleteHistory}
              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm flex items-center gap-2 transition"
            >
              <i className="fas fa-trash-alt"></i>
              批量删除 ({selectedHistoryIds.size})
            </button>
          </div>
        )}

        {/* ============================================================
            内容区域
            ============================================================ */}
        {activeTab === 'history' ? (
          historyLoading ? (
            <div className="flex justify-center items-center py-20">
              <i className="fas fa-spinner fa-pulse text-3xl text-gray-400"></i>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl">
              <i className="fas fa-inbox text-5xl text-gray-400 mb-3"></i>
              <p className="text-gray-500">
                {historySearchKeyword ? `没有找到 "${historySearchKeyword}" 相关的记录` : '暂无上传记录'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredHistory.map((record) => (
                <div
                  key={record.id}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-white/30 dark:border-gray-700 shadow-sm relative group"
                >
                  <input
                    type="checkbox"
                    checked={selectedHistoryIds.has(record.id)}
                    onChange={(e) => toggleSelectHistory(record.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 left-3 z-10 w-4 h-4 rounded border-gray-300 bg-white/80 checked:bg-teal-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between flex-wrap gap-2 ml-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                          {record.filename}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                          {record.folder === 'wallpaper' || record.folder === 'sh' ? '横屏' : record.folder === 'telegram' ? '✈️ TG' : '竖屏'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatTime(record.time)}
                      </div>
                      <code className="text-xs text-gray-500 dark:text-gray-400 mt-1 block truncate">
                        {record.url}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(record.url, record.id)}
                        className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition"
                        title="复制链接"
                      >
                        {copiedId === record.id ? (
                          <i className="fas fa-check text-green-500"></i>
                        ) : (
                          <i className="fas fa-copy text-gray-500"></i>
                        )}
                      </button>
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition"
                        title="打开图片"
                      >
                        <i className="fas fa-external-link-alt text-gray-500"></i>
                      </a>
                      <button
                        onClick={() => handleDeleteHistory(record.id)}
                        className="p-2 rounded-lg hover:bg-red-100/50 dark:hover:bg-red-900/30 transition"
                        title="删除记录"
                      >
                        <i className="fas fa-trash-alt text-red-400"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex justify-center items-center py-20">
            <i className="fas fa-spinner fa-pulse text-3xl text-gray-400"></i>
          </div>
        ) : paginatedImages.length === 0 ? (
          <div className="text-center py-20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl">
            <i className="fas fa-folder-open text-5xl text-gray-400 mb-3"></i>
            <p className="text-gray-500">
              {searchKeyword ? `没有找到 "${searchKeyword}" 相关的图片` : '暂无图片'}
            </p>
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="inline-block mt-4 text-blue-500 hover:text-blue-600"
              >
                <i className="fas fa-undo mr-1"></i>清除搜索
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {paginatedImages.map((img, idx) => {
                const proxyUrl = getProxyUrl(img)
                const aspectClass = getImageAspect(img)
                const isLoaded = loadedImages.has(img.name)

                return (
                  <div
                    key={img.sha || idx}
                    className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl overflow-hidden border border-white/30 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:scale-105 hover:shadow-xl relative"
                  >
                    <input
                      type="checkbox"
                      checked={selectedImages.has(img.name)}
                      onChange={(e) => toggleSelect(img.name, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 left-2 z-10 w-3.5 h-3.5 rounded border-gray-300 bg-white/80 checked:bg-blue-500 cursor-pointer"
                    />
                    <div
                      className={`${aspectClass} bg-gray-100/50 dark:bg-gray-900/50 overflow-hidden cursor-pointer relative`}
                      onClick={() => setPreviewImage(img)}
                    >
                      <img
                        src={isLoaded ? proxyUrl : PLACEHOLDER_SVG}
                        alt={img.name}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                          isLoaded ? 'opacity-100' : 'opacity-50'
                        } group-hover:scale-110 transition-transform duration-300`}
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_SVG
                        }}
                        onLoad={() => {
                          setLoadedImages(prev => new Set(prev).add(img.name))
                        }}
                      />
                      {!isLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <i className="fas fa-search-plus text-white text-sm"></i>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <p className="text-gray-600 dark:text-gray-300 text-[9px] lg:text-[10px] truncate" title={img.name}>
                        {img.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[8px] text-gray-400">
                          {img.source === 'external' ? '🌐' : 
                           img.source === 'r2' ? '☁️' : 
                           img.source === 'telegram' ? '✈️' : '📦'}
                        </span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopy(proxyUrl, img.name, e)
                            }}
                            className="text-gray-400 hover:text-green-500 transition text-[9px] px-1 py-0.5 rounded"
                          >
                            {copiedId === img.name ? (
                              <i className="fas fa-check"></i>
                            ) : (
                              <i className="fas fa-copy"></i>
                            )}
                          </button>
                          <button
                            onClick={(e) => handleDelete(img, activeTab, e)}
                            disabled={deletingId === img.name}
                            className="text-gray-400 hover:text-red-500 transition text-[9px] px-1 py-0.5 rounded disabled:opacity-30"
                          >
                            {deletingId === img.name ? (
                              <i className="fas fa-spinner fa-pulse"></i>
                            ) : (
                              <i className="fas fa-trash-alt"></i>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-1 sm:gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70 disabled:opacity-30 transition text-sm backdrop-blur-sm"
                >
                  首页
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70 disabled:opacity-30 transition text-sm backdrop-blur-sm"
                >
                  上一页
                </button>
                <span className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-gray-700/70 text-gray-700 dark:text-white text-sm backdrop-blur-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70 disabled:opacity-30 transition text-sm backdrop-blur-sm"
                >
                  下一页
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70 disabled:opacity-30 transition text-sm backdrop-blur-sm"
                >
                  末页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================
          预览弹窗
           ============================================================ */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getProxyUrl(previewImage)}
              alt={previewImage.name}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(null)
              }}
              className="absolute -top-12 right-0 text-white/70 hover:text-white text-2xl"
            >
              <i className="fas fa-times-circle"></i>
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3 rounded-b-2xl">
              <p className="text-white text-sm truncate">
                <i className="fas fa-image mr-2"></i>
                {previewImage.name}
              </p>
              <div className="flex justify-end gap-3 mt-2">
                <a
                  href={getProxyUrl(previewImage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-white/70 hover:text-blue-400 text-sm flex items-center gap-1"
                >
                  <i className="fas fa-external-link-alt"></i>
                  打开
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard(getProxyUrl(previewImage))
                    setCopiedId(previewImage.name)
                    setTimeout(() => setCopiedId(null), 2000)
                  }}
                  className="text-white/70 hover:text-green-400 text-sm flex items-center gap-1"
                >
                  <i className="fas fa-copy"></i>
                  复制链接
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(previewImage, activeTab, e)
                    setPreviewImage(null)
                  }}
                  className="text-white/70 hover:text-red-400 text-sm flex items-center gap-1"
                >
                  <i className="fas fa-trash-alt"></i>
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
