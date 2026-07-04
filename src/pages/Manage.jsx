// src/pages/Manage.jsx - 图片管理页面
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { fetchImageList, copyToClipboard, batchCopyLinks } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'
import FileCard from '../components/FileCard'
import BatchActionBar from '../components/BatchActionBar'
import FileDetailDialog from '../components/FileDetailDialog'
import FilterDropdown from '../components/FilterDropdown'
import SkeletonLoader from '../components/SkeletonLoader'
import ExternalLinksManager from '../components/ExternalLinksManager'

const PLACEHOLDER_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23ccc" font-size="20"%3E🖼%3C/text%3E%3C/svg%3E'

const isAudioFile = (filename) => {
  if (!filename) return false
  const ext = filename.split('.').pop().toLowerCase()
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff']
  return audioExts.includes(ext)
}

const isVideoFile = (filename) => {
  if (!filename) return false
  const ext = filename.split('.').pop().toLowerCase()
  const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'm4v', 'flv']
  return videoExts.includes(ext)
}

const isMediaFile = (filename) => {
  return isAudioFile(filename) || isVideoFile(filename)
}

export default function Manage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  
  const [images, setImages] = useState({ wallpaper: [], cover: [], sh: [], sd: [], telegram: [], huggingface: [], external: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('wallpaper')
  const [copiedId, setCopiedId] = useState(null)
  
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 48
  
  const [previewImage, setPreviewImage] = useState(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [previewTranslateX, setPreviewTranslateX] = useState(0)
  const [previewTranslateY, setPreviewTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartTranslateX, setDragStartTranslateX] = useState(0)
  const [dragStartTranslateY, setDragStartTranslateY] = useState(0)

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

  const [detailFile, setDetailFile] = useState(null)
  const [filters, setFilters] = useState({ type: '', source: '', folder: '' })

  const updatePreviewTransform = useCallback(() => {
    const img = document.getElementById('previewImage');
    if (img) {
      img.style.transform = `scale(${previewScale}) translate(${previewTranslateX}px, ${previewTranslateY}px)`;
    }
  }, [previewScale, previewTranslateX, previewTranslateY]);

  const openPreview = (img) => {
    setPreviewImage(img);
    setPreviewScale(1);
    setPreviewTranslateX(0);
    setPreviewTranslateY(0);
  };

  const handleWheel = (e) => {
    if (!previewImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(previewScale + delta, 0.2), 5);
    setPreviewScale(newScale);
  };

  const handleMouseDown = (e) => {
    if (previewScale <= 1) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
    setDragStartTranslateX(previewTranslateX);
    setDragStartTranslateY(previewTranslateY);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    setPreviewTranslateX(dragStartTranslateX + dx);
    setPreviewTranslateY(dragStartTranslateY + dy);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (previewScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStartX(e.touches[0].clientX);
    setDragStartY(e.touches[0].clientY);
    setDragStartTranslateX(previewTranslateX);
    setDragStartTranslateY(previewTranslateY);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartX;
    const dy = e.touches[0].clientY - dragStartY;
    setPreviewTranslateX(dragStartTranslateX + dx);
    setPreviewTranslateY(dragStartTranslateY + dy);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
        setPreviewScale(1);
        setPreviewTranslateX(0);
        setPreviewTranslateY(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============================================================
  // ✅ 核心修改：getProxyUrl 增加 HuggingFace 处理
  // ============================================================
  const getProxyUrl = (img) => {
    // 优先处理 HuggingFace
    if (img.source === 'huggingface') {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      if (img.url && img.url.startsWith('/api/hf/')) {
        return img.url
      }
      if (img.path) {
        return `${baseUrl}/api/hf/${img.path}`
      }
      return img.url || ''
    }

    if (img.source === 'telegram_chunks' || (img.fileId && img.chunkCount)) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      return `${baseUrl}/api/large/${img.fileId}`
    }
    
    if (img.url && img.url.startsWith('http')) {
      return img.url
    }
    
    if (img.source === 'external') return img.url
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    
    if (img.source === 'telegram' && img.filePath) {
      const encodedPath = encodeURIComponent(`telegram/${img.filePath}`)
      return `${baseUrl}/api/image?path=${encodedPath}`
    }
    
    if (img.fileId && !img.chunkCount) {
      const encodedPath = encodeURIComponent(`telegram/${img.fileId}`)
      return `${baseUrl}/api/image?path=${encodedPath}`
    }
    
    const encodedPath = encodeURIComponent(img.folder + '/' + img.name)
    return `${baseUrl}/api/image?path=${encodedPath}`
  }

  const getImageAspect = (img) => {
    if (isMediaFile(img.name)) return 'aspect-square'
    if (img.folder === 'wallpaper' || img.folder === 'sh') return 'aspect-video'
    if (img.folder === 'cover' || img.folder === 'sd') return 'aspect-9/16'
    if (img.folder === 'telegram') return 'aspect-square'
    return 'aspect-square'
  }

  useEffect(() => {
    const img = new Image()
    const url = `/api/wallpaper?t=${Date.now()}`
    img.onload = () => {
      setBgImage(`url(${url})`)
    }
    img.src = url
  }, [])

  useEffect(() => {
    const savedAuth = localStorage.getItem('manage_auth')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
      loadImages()
    }
  }, [])

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

  const loadImages = async () => {
    setLoading(true)
    setLoadedImages(new Set())
    try {
      const data = await fetchImageList()
      setImages(data.folders || { wallpaper: [], cover: [], sh: [], sd: [], telegram: [], huggingface: [], external: [] })
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

  // ============================================================
  // 普通删除（GitHub / R2 / Telegram / HuggingFace）
  // ============================================================
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
          path: img.path || '',
          folder: folder,
          sha: img.sha,
          source: img.source,
          tgMessageId: img.messageId,
          fileId: img.fileId
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

 // ============================================================
// 外链删除（走 /api/external）
// ============================================================
const handleDeleteExternal = async (img) => {
  if (!img || !img.url) {
    alert('❌ 无效的外链')
    return
  }
  if (!confirm(`确定要删除外链 "${img.name}" 吗？`)) return

  try {
    // ✅ 获取正确的文件夹
    const folder = img.originalFolder || img.folder || 'wallpaper'
    
    const response = await fetch('/api/external', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: img.url,
        folder: folder
      })
    })
    const result = await response.json()
    if (result.success) {
      // ✅ 重新加载所有分类的外链数据
      const extRes = await fetch('/api/external')
      const extData = await extRes.json()
      
      const allExternalImages = []
      const folders = ['wallpaper', 'cover', 'sh', 'sd']
      for (const f of folders) {
        if (extData[f]) {
          for (const url of extData[f]) {
            allExternalImages.push({
              name: url.split('/').pop() || 'unknown',
              url: url,
              path: `external/${url.split('/').pop() || 'unknown'}`,
              sha: '',
              size: 0,
              folder: 'external',
              source: 'external',
              originalFolder: f
            })
          }
        }
      }
      
      setImages(prev => ({
        ...prev,
        external: allExternalImages
      }))
      
      setSelectedImages(new Set())
      alert(`✅ 已删除外链 "${img.name}"`)
    } else {
      alert(`❌ 删除失败: ${result.error || '未知错误'}`)
    }
  } catch (err) {
    console.error('删除外链失败:', err)
    alert('❌ 删除失败，请稍后重试')
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
            path: img.path || '',
            folder: activeTab,
            sha: img.sha,
            source: img.source,
            tgMessageId: img.messageId,
            fileId: img.fileId
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

  const handleBatchCopy = async () => {
    const urls = paginatedImages
      .filter(img => selectedImages.has(img.name))
      .map(img => getProxyUrl(img))
    if (urls.length === 0) return alert('请先选择图片')
    await batchCopyLinks(urls, 'url')
    alert(`✅ 已复制 ${urls.length} 个链接`)
  }

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

  const allImages = images[activeTab] || []
  
  const filteredImages = allImages.filter(img => {
    if (searchKeyword.trim() && !img.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
      return false
    }
    if (filters.type === 'image' && isMediaFile(img.name)) return false
    if (filters.type === 'audio' && !isAudioFile(img.name)) return false
    if (filters.type === 'video' && !isVideoFile(img.name)) return false
    if (filters.source && img.source !== filters.source) return false
    if (filters.folder && !img.folder?.includes(filters.folder)) return false
    return true
  })
  
  const totalCount = filteredImages.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedImages = filteredImages.slice(startIndex, startIndex + pageSize)

  const formatTime = (isoString) => new Date(isoString).toLocaleString('zh-CN')
  const filteredHistory = getFilteredHistory()

  useEffect(() => {
    if (activeTab !== 'history' && paginatedImages.length > 0) {
      const preloadCount = Math.min(4, paginatedImages.length)
      const imagesToPreload = paginatedImages.slice(0, preloadCount)
      imagesToPreload.forEach(img => {
        setLoadedImages(prev => new Set(prev).add(img.name))
      })
    }
  }, [activeTab, currentPage, searchKeyword, paginatedImages])

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
          <a href="/" className="flex items-center gap-2 w-full p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition">
            <i className="fas fa-home w-4 text-blue-500"></i>
            <span className="text-sm">返回首页</span>
          </a>
          <button
            onClick={() => {
              setIsAuthenticated(false)
              localStorage.removeItem('manage_auth')
            }}
            className="flex items-center gap-2 w-full p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition mt-1"
          >
            <i className="fas fa-sign-out-alt w-4 text-red-500"></i>
            <span className="text-sm">退出登录</span>
          </button>
        </div>

        <div className="p-2">
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
                    : 'text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'
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

          <div
            onClick={() => handleTabChange('telegram')}
            className={`
              flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 mt-2
              ${activeTab === 'telegram'
                ? 'bg-green-500/20 text-green-600 dark:text-green-400 bg-white/20 backdrop-blur-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'
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

          <div
            onClick={() => handleTabChange('huggingface')}
            className={`
              flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 mt-2
              ${activeTab === 'huggingface'
                ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 bg-white/20 backdrop-blur-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-brain text-sm"></i>
              <span className="text-sm font-medium">HuggingFace</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
              {images['huggingface']?.length || 0}
            </span>
          </div>

          <div
            onClick={() => handleTabChange('external')}
            className={`
              flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 mt-2
              ${activeTab === 'external'
                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 bg-white/20 backdrop-blur-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-link text-sm"></i>
              <span className="text-sm font-medium">外链图片</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/30 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
              {images['external']?.length || 0}
            </span>
          </div>

          <div
            onClick={() => handleTabChange('history')}
            className={`
              flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 mt-2
              ${activeTab === 'history'
                ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400 bg-white/20 backdrop-blur-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600'
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
                    : activeTab === 'huggingface'
                    ? 'fa-hugging-face text-yellow-500'
                    : activeTab === 'external'
                    ? 'fa-link text-purple-500'
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
                  : activeTab === 'huggingface'
                  ? 'HuggingFace 图片'
                  : activeTab === 'external'
                  ? '外链图片'
                  : '上传历史'}
              </h2>
              {activeTab !== 'history' && activeTab !== 'external' && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  共 {totalCount} 张图片 · 第 {currentPage}/{totalPages || 1} 页
                </p>
              )}
              {activeTab === 'history' && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  共 {filteredHistory.length} 条记录
                </p>
              )}
              {activeTab === 'external' && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  共 {images['external']?.length || 0} 条外链
                </p>
              )}
            </div>
            {activeTab !== 'history' && activeTab !== 'external' && totalPages > 1 && (
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

        {activeTab !== 'history' && activeTab !== 'external' && (
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400 text-sm"></i>
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
            <FilterDropdown
              filters={filters}
              onFilterChange={setFilters}
              label="筛选"
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="mb-4">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400 text-sm"></i>
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
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                找到 {filteredHistory.length} 条匹配记录
              </p>
            )}
          </div>
        )}

        {activeTab !== 'history' && activeTab !== 'external' && selectedImages.size > 0 && (
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
              <button
                onClick={handleBatchCopy}
                className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm flex items-center gap-2 transition"
              >
                <i className="fas fa-copy"></i>
                批量复制 ({selectedImages.size})
              </button>
            </div>
          </div>
        )}

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

        {activeTab === 'external' ? (
          <>
            <div className="mb-4">
              <ExternalLinksManager onLinkAdded={loadImages} />
            </div>
            {loading ? (
              <SkeletonLoader count={12} type="card" />
            ) : paginatedImages.length === 0 ? (
              <div className="text-center py-20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl">
                <i className="fas fa-link text-5xl text-gray-400 mb-3"></i>
                <p className="text-gray-500">暂无外链图片</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
                  {paginatedImages.map((img, idx) => {
                    const proxyUrl = getProxyUrl(img)
                    return (
                      <FileCard
                        key={img.sha || idx}
                        file={img}
                        selected={selectedImages.has(img.name)}
                        onSelect={(e) => {
                          e.stopPropagation()
                          toggleSelect(img.name, e)
                        }}
                        onPreview={() => openPreview(img)}
                        onDetail={() => setDetailFile(img)}
                        onCopy={() => handleCopy(proxyUrl, img.name)}
                        onDelete={() => handleDeleteExternal(img)}
                        getFileUrl={getProxyUrl}
                      />
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
          </>
        ) : activeTab === 'history' ? (
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
                      <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
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
          <SkeletonLoader count={12} type="card" />
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
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
            {paginatedImages.map((img, idx) => {
              const proxyUrl = getProxyUrl(img)
              return (
                <FileCard
                  key={img.sha || idx}
                  file={img}
                  selected={selectedImages.has(img.name)}
                  onSelect={(e) => {
                    e.stopPropagation()
                    toggleSelect(img.name, e)
                  }}
                  onPreview={() => openPreview(img)}
                  onDetail={() => setDetailFile(img)}
                  onCopy={() => handleCopy(proxyUrl, img.name)}
                  onDelete={() => handleDelete(img, activeTab)}
                  getFileUrl={getProxyUrl}
                />
              )
            })}
          </div>
        )}
      </div>

      <FileDetailDialog
        file={detailFile}
        visible={!!detailFile}
        onClose={() => setDetailFile(null)}
        onDelete={(file) => {
          if (activeTab === 'external') {
            handleDeleteExternal(file)
          } else {
            handleDelete(file, activeTab)
          }
          setDetailFile(null)
        }}
        onCopy={(url) => handleCopy(url, detailFile?.name)}
        getFileUrl={getProxyUrl}
      />

      {activeTab !== 'history' && activeTab !== 'external' && (
        <BatchActionBar
          selectedCount={selectedImages.size}
          totalCount={paginatedImages.length}
          onSelectAll={selectAll}
          onClearSelection={() => setSelectedImages(new Set())}
          onBatchDelete={handleBatchDelete}
          onBatchCopy={handleBatchCopy}
        />
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setPreviewImage(null)
            setPreviewScale(1)
            setPreviewTranslateX(0)
            setPreviewTranslateY(0)
          }}
        >
          <div
            className="relative w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="previewContainer"
              className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none' }}
            >
              {isAudioFile(previewImage.name) ? (
                <div className="flex flex-col items-center justify-center bg-gray-900/90 rounded-2xl p-8 max-w-[400px] w-full">
                  <i className="fas fa-music text-6xl text-blue-400 mb-4"></i>
                  <p className="text-white text-sm truncate w-full text-center mb-4">{previewImage.name}</p>
                  <audio controls className="w-full" src={getProxyUrl(previewImage)} autoPlay>
                    您的浏览器不支持音频播放
                  </audio>
                </div>
              ) : isVideoFile(previewImage.name) ? (
                <video 
                  controls 
                  className="max-w-[95vw] max-h-[88vh] object-contain rounded-2xl"
                  src={getProxyUrl(previewImage)}
                  autoPlay
                />
              ) : (
                <img
                  id="previewImage"
                  src={getProxyUrl(previewImage)}
                  alt={previewImage.name}
                  className="max-w-[95vw] max-h-[88vh] object-contain select-none pointer-events-none rounded-2xl"
                  style={{
                    transform: `scale(${previewScale}) translate(${previewTranslateX}px, ${previewTranslateY}px)`,
                    transition: isDragging ? 'none' : 'transform 0.05s linear',
                    willChange: 'transform',
                  }}
                  draggable={false}
                />
              )}
            </div>

            <button
              onClick={() => {
                setPreviewImage(null)
                setPreviewScale(1)
                setPreviewTranslateX(0)
                setPreviewTranslateY(0)
              }}
              className="fixed top-4 right-4 z-[101] text-white/60 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition backdrop-blur-sm"
              title="关闭 (ESC)"
            >
              <i className="fas fa-times"></i>
            </button>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[101] bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 flex items-center gap-1 flex-wrap justify-center">
              <span className="text-white/70 text-xs px-2 truncate max-w-[120px] sm:max-w-[200px]">
                {previewImage.name}
              </span>

              <div className="w-px h-5 bg-white/20 mx-1"></div>

              {!isMediaFile(previewImage.name) && (
                <>
                  <button
                    onClick={() => setPreviewScale(Math.min(previewScale + 0.2, 5))}
                    className="text-white/60 hover:text-white text-xs p-1.5 rounded hover:bg-white/10 transition"
                  >
                    <i className="fas fa-search-plus"></i>
                  </button>
                  <button
                    onClick={() => setPreviewScale(Math.max(previewScale - 0.2, 0.2))}
                    className="text-white/60 hover:text-white text-xs p-1.5 rounded hover:bg-white/10 transition"
                  >
                    <i className="fas fa-search-minus"></i>
                  </button>
                  <button
                    onClick={() => {
                      setPreviewScale(1)
                      setPreviewTranslateX(0)
                      setPreviewTranslateY(0)
                    }}
                    className="text-white/60 hover:text-white text-xs p-1.5 rounded hover:bg-white/10 transition"
                  >
                    <i className="fas fa-expand"></i>
                  </button>
                  <span className="text-white/40 text-[10px] min-w-[36px] text-center">
                    {Math.round(previewScale * 100)}%
                  </span>
                  <div className="w-px h-5 bg-white/20 mx-1"></div>
                </>
              )}

              <a
                href={getProxyUrl(previewImage)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-white/60 hover:text-blue-400 text-xs p-1.5 rounded hover:bg-white/10 transition"
              >
                <i className="fas fa-external-link-alt"></i>
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copyToClipboard(getProxyUrl(previewImage))
                  setCopiedId(previewImage.name)
                  setTimeout(() => setCopiedId(null), 2000)
                }}
                className="text-white/60 hover:text-green-400 text-xs p-1.5 rounded hover:bg-white/10 transition"
              >
                <i className="fas fa-copy"></i>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const confirmDelete = confirm(`确定要删除 "${previewImage.name}" 吗？\n\n⚠️ 此操作不可恢复！`)
                  if (confirmDelete) {
                    if (activeTab === 'external') {
                      handleDeleteExternal(previewImage)
                    } else {
                      handleDelete(previewImage, activeTab, e)
                    }
                    setPreviewImage(null)
                    setPreviewScale(1)
                    setPreviewTranslateX(0)
                    setPreviewTranslateY(0)
                  }
                }}
                className="text-white/60 hover:text-red-400 text-xs p-1.5 rounded hover:bg-white/10 transition"
              >
                <i className="fas fa-trash-alt"></i>
              </button>

              <div className="w-px h-5 bg-white/20 mx-1"></div>

              {!isMediaFile(previewImage.name) && (
                <span className="text-white/30 text-[10px] hidden sm:inline">
                  🖱️ 滚轮缩放 · 拖拽移动
                </span>
              )}
              {isMediaFile(previewImage.name) && (
                <span className="text-white/30 text-[10px] hidden sm:inline">
                  ▶️ 点击播放
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
