// src/pages/Manage.jsx - 图片管理页面（完整版：搜索 + 批量删除 + 批量复制）
import React, { useState, useEffect } from 'react'
import { fetchImageList, copyToClipboard, batchCopyLinks } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'

export default function Manage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  
  const [images, setImages] = useState({ wallpaper: [], cover: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('wallpaper')
  const [copiedId, setCopiedId] = useState(null)
  
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 64
  
  const [previewImage, setPreviewImage] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // 批量选择状态
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  
  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState('')

  const getProxyUrl = (img) => {
    if (img.source === 'external') {
      return img.url
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pcbed.vercel.app'
    return `${baseUrl}/api/image?path=${img.folder}/${img.name}`
  }

  const getImageAspect = (img) => {
    if (img.folder === 'wallpaper') {
      return 'aspect-video'
    } else {
      return 'aspect-9/16'
    }
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === 'admin123') {
      setIsAuthenticated(true)
      setPasswordError(false)
      loadImages()
    } else {
      setPasswordError(true)
      setPassword('')
    }
  }

  const loadImages = async () => {
    setLoading(true)
    try {
      const data = await fetchImageList()
      setImages(data.folders)
    } catch (err) {
      console.error('加载图片列表失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (url, name, event) => {
    if (event) event.stopPropagation()
    copyToClipboard(url)
    setCopiedId(name)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (img, folder, event) => {
    if (event) event.stopPropagation()
    
    if (!confirm(`确定要删除 "${img.name}" 吗？\n\n⚠️ 此操作不可恢复！`)) {
      return
    }
    
    setDeletingId(img.name)
    
    try {
      const response = await fetch(`/api/admin/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: img.name,
          folder: folder,
          sha: img.sha,
          source: img.source
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

  // 批量删除
  const handleBatchDelete = async () => {
    const selectedCount = selectedImages.size
    if (selectedCount === 0) {
      alert('请先选择图片')
      return
    }
    
    if (!confirm(`确定要删除选中的 ${selectedCount} 张图片吗？\n\n⚠️ 此操作不可恢复！`)) {
      return
    }
    
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
            source: img.source
          })
        })
        
        const result = await response.json()
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch (err) {
        failCount++
      }
    }
    
    alert(`✅ 删除完成\n成功: ${successCount} 张\n失败: ${failCount} 张`)
    setSelectedImages(new Set())
    await loadImages()
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setSearchKeyword('')
    setSelectedImages(new Set())
    setMobileMenuOpen(false)
  }

  // 批量选择函数
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
      const allNames = new Set(paginatedImages.map(img => img.name))
      setSelectedImages(allNames)
    }
  }

  const handleBatchCopy = async (format) => {
    const selectedUrls = paginatedImages
      .filter(img => selectedImages.has(img.name))
      .map(img => getProxyUrl(img))
    
    if (selectedUrls.length === 0) {
      alert('请先选择图片')
      return
    }
    
    await batchCopyLinks(selectedUrls, format)
    setShowBatchMenu(false)
  }

  // 过滤图片（搜索）
  const allImages = images[activeTab] || []
  const filteredImages = searchKeyword.trim() === '' 
    ? allImages 
    : allImages.filter(img => img.name.toLowerCase().includes(searchKeyword.toLowerCase()))
  
  const totalCount = filteredImages.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedImages = filteredImages.slice(startIndex, startIndex + pageSize)

  // 未登录界面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ 
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundAttachment: 'fixed'
      }}>
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
                <i className="fas fa-exclamation-circle mr-1"></i>
                密码错误，请重试
              </p>
            )}
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-sign-in-alt"></i>
              进入管理
            </button>
          </form>
          
          <div className="text-center mt-6">
            <a href="/" className="text-white/50 hover:text-white text-sm transition flex items-center justify-center gap-1">
              <i className="fas fa-arrow-left"></i>
              返回首页
            </a>
          </div>
        </div>
      </div>
    )
  }

  // 已登录界面
  return (
    <div className="min-h-screen py-6 px-4" style={{ 
      backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <ThemeToggle />
      
      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/20 backdrop-blur-sm p-2.5 rounded-lg text-white shadow-lg"
      >
        <i className="fas fa-bars text-lg"></i>
      </button>

      {/* 左侧悬浮目录 */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <div className={`
        fixed top-0 left-0 h-full z-50 w-56 bg-black/90 backdrop-blur-md shadow-xl transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:left-4 lg:top-1/2 lg:-translate-y-1/2 lg:w-52 lg:h-auto lg:rounded-xl lg:bg-white/10 lg:backdrop-blur-md lg:border lg:border-white/20
      `}>
        <div className="p-4 border-b border-white/20 flex justify-between items-center lg:block">
          <div className="flex items-center gap-2 text-white font-medium">
            <i className="fas fa-folder-tree"></i>
            <span>图片库</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-white/70 hover:text-white text-xl"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-3 border-b border-white/20">
          <a
            href="/"
            className="flex items-center gap-2 w-full p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <i className="fas fa-home w-4"></i>
            <span className="text-sm">返回首页</span>
          </a>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-2 w-full p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition mt-1"
          >
            <i className="fas fa-sign-out-alt w-4"></i>
            <span className="text-sm">退出登录</span>
          </button>
        </div>
        
        <div className="p-2">
          <div
            onClick={() => handleTabChange('wallpaper')}
            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
              activeTab === 'wallpaper'
                ? 'bg-blue-600/50 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <i className={`fas ${activeTab === 'wallpaper' ? 'fa-folder-open' : 'fa-folder'}`}></i>
              <span className="text-sm">横屏图片</span>
            </div>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {images.wallpaper.length}
            </span>
          </div>
          
          <div
            onClick={() => handleTabChange('cover')}
            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition mt-1 ${
              activeTab === 'cover'
                ? 'bg-purple-600/50 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <i className={`fas ${activeTab === 'cover' ? 'fa-folder-open' : 'fa-folder'}`}></i>
              <span className="text-sm">竖屏图片</span>
            </div>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {images.cover.length}
            </span>
          </div>
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="lg:pl-72">
        {/* 标题栏 */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-white font-medium flex items-center gap-2 text-sm sm:text-base">
                <i className={`fas ${activeTab === 'wallpaper' ? 'fa-arrows-alt' : 'fa-mobile-alt'}`}></i>
                {activeTab === 'wallpaper' ? '横屏图片' : '竖屏图片'}
              </h2>
              <p className="text-white/40 text-xs mt-1">
                共 {totalCount} 张图片 · 第 {currentPage}/{totalPages || 1} 页
              </p>
            </div>
            {totalPages > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-3 py-1.5 rounded bg-white/10 text-white/60 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-xs sm:text-sm"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className="px-2 sm:px-4 py-1.5 rounded bg-white/20 text-white text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-3 py-1.5 rounded bg-white/10 text-white/60 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-xs sm:text-sm"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 搜索框 */}
        <div className="mb-4">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm"></i>
            <input
              type="text"
              placeholder="按文件名搜索图片..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedImages.size > 0 && (
          <div className="bg-blue-600/30 backdrop-blur-sm rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
            <span className="text-white text-sm flex items-center gap-2">
              <i className="fas fa-check-circle"></i>
              已选择 {selectedImages.size} 张图片
              <button
                onClick={selectAll}
                className="text-xs text-white/70 hover:text-white underline ml-2"
              >
                {selectedImages.size === paginatedImages.length ? '取消全选' : '全选'}
              </button>
            </span>
            <div className="flex gap-2">
              {/* 批量删除按钮 */}
              <button
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-white text-sm flex items-center gap-2 transition"
              >
                <i className="fas fa-trash-alt"></i>
                批量删除 ({selectedImages.size})
              </button>

              {/* 批量复制按钮 */}
<div className="relative">
  <button
    onClick={() => setShowBatchMenu(!showBatchMenu)}
    className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm flex items-center gap-2 transition"
  >
    <i className="fas fa-copy"></i>
    批量复制
    <i className="fas fa-chevron-down text-xs"></i>
  </button>
  {showBatchMenu && (
    <div className="absolute right-0 bottom-full mb-2 w-44 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-[200] border border-gray-700">
      <button onClick={() => handleBatchCopy('url')} className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm flex items-center gap-2">
        <i className="fas fa-link"></i> 复制链接 (URL)
      </button>
      <button onClick={() => handleBatchCopy('markdown')} className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm flex items-center gap-2">
        <i className="fab fa-markdown"></i> 复制 Markdown
      </button>
      <button onClick={() => handleBatchCopy('html')} className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm flex items-center gap-2">
        <i className="fab fa-html5"></i> 复制 HTML
      </button>
    </div>
  )}
</div>
              
            </div>
          </div>
        )}

        {/* 图片网格 */}
        {loading ? (
          <div className="flex justify-center items-center py-20 bg-white/5 rounded-xl">
            <i className="fas fa-spinner fa-pulse text-3xl text-white/50"></i>
          </div>
        ) : paginatedImages.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-xl backdrop-blur-sm">
            <i className="fas fa-folder-open text-5xl text-white/30 mb-3"></i>
            <p className="text-white/50">
              {searchKeyword ? `没有找到 "${searchKeyword}" 相关的图片` : '暂无图片'}
            </p>
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="inline-block mt-4 text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto"
              >
                <i className="fas fa-undo"></i>
                清除搜索
              </button>
            )}
            {!searchKeyword && (
              <a href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <i className="fas fa-upload"></i>
                去上传图片 →
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {paginatedImages.map((img, idx) => {
                const proxyUrl = getProxyUrl(img)
                const aspectClass = getImageAspect(img)
                return (
                  <div
                    key={img.sha || idx}
                    className="group bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden border border-white/20 hover:border-white/40 transition-all hover:scale-105 hover:shadow-lg relative"
                  >
                    <input
                      type="checkbox"
                      checked={selectedImages.has(img.name)}
                      onChange={(e) => toggleSelect(img.name, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1 left-1 z-10 w-3.5 h-3.5 rounded border-white/30 bg-black/50 checked:bg-blue-500 cursor-pointer"
                    />
                    
                    <div 
                      className={`${aspectClass} bg-black/30 overflow-hidden cursor-pointer relative`}
                      onClick={() => setPreviewImage(img)}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%23ccc">?</text></svg>'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <i className="fas fa-search-plus text-white text-xs sm:text-sm"></i>
                      </div>
                    </div>
                    
                    <div className="p-1 sm:p-1.5">
                      <p className="text-white/60 text-[8px] sm:text-[9px] lg:text-[10px] truncate" title={img.name}>
                        {img.name}
                      </p>
                      <div className="flex items-center justify-between mt-0.5 sm:mt-1">
                        <span className="text-[7px] sm:text-[8px] text-white/30">
                          {img.source === 'external' ? '🌐' : '📦'}
                        </span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={(e) => handleCopy(proxyUrl, img.name, e)}
                            className="text-white/50 hover:text-green-400 transition text-[8px] sm:text-[9px] px-1 py-0.5 rounded"
                            title="复制链接"
                          >
                            {copiedId === img.name ? <i className="fas fa-check"></i> : <i className="fas fa-copy"></i>}
                          </button>
                          <button
                            onClick={(e) => handleDelete(img, activeTab, e)}
                            disabled={deletingId === img.name}
                            className="text-white/50 hover:text-red-400 transition text-[8px] sm:text-[9px] px-1 py-0.5 rounded disabled:opacity-30"
                            title="删除"
                          >
                            {deletingId === img.name ? <i className="fas fa-spinner fa-pulse"></i> : <i className="fas fa-trash-alt"></i>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* 底部分页 */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-1 sm:gap-2 mt-6 sm:mt-8">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-4 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-xs sm:text-sm"
                >
                  首页
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-4 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-xs sm:text-sm"
                >
                  上一页
                </button>
                <span className="px-2 sm:px-4 py-1.5 rounded bg-white/20 text-white text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-4 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-xs sm:text-sm"
                >
                  下一页
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-4 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-xs sm:text-sm"
                >
                  末页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 图片预览弹窗 */}
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
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(null)
              }}
              className="absolute -top-10 sm:-top-12 right-0 text-white/70 hover:text-white text-xl sm:text-2xl flex items-center gap-1"
            >
              <i className="fas fa-times-circle"></i>
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 sm:p-3 rounded-b-lg">
              <p className="text-white text-xs sm:text-sm truncate">
                <i className="fas fa-image mr-2"></i>
                {previewImage.name}
              </p>
              <div className="flex justify-end gap-2 sm:gap-3 mt-1 sm:mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const proxyUrl = getProxyUrl(previewImage)
                    copyToClipboard(proxyUrl)
                    setCopiedId(previewImage.name)
                    setTimeout(() => setCopiedId(null), 2000)
                  }}
                  className="text-white/70 hover:text-green-400 text-xs sm:text-sm flex items-center gap-1 transition"
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
                  className="text-white/70 hover:text-red-400 text-xs sm:text-sm flex items-center gap-1 transition"
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
