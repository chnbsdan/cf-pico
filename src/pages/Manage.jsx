// src/pages/Manage.jsx - 图片管理页面（动态比例：横屏16:9，竖屏9:16）
import React, { useState, useEffect } from 'react'
import { fetchImageList, copyToClipboard } from '../lib/api'

export default function Manage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  
  const [images, setImages] = useState({ wallpaper: [], cover: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('wallpaper')
  const [copiedId, setCopiedId] = useState(null)
  
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 64  // 每页 8行 x 8列 = 64 张
  
  const [previewImage, setPreviewImage] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const getProxyUrl = (img) => {
    if (img.source === 'external') {
      return img.url
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pcbed.vercel.app'
    return `${baseUrl}/api/image?path=${img.folder}/${img.name}`
  }

  // 根据文件名判断是横屏还是竖屏（或者根据分类）
  const getImageAspect = (img) => {
    // 横屏分类默认用 16:9，竖屏分类默认用 9:16
    if (img.folder === 'wallpaper') {
      return 'aspect-video'  // 16:9
    } else {
      return 'aspect-9/16'   // 9:16
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

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  const currentImages = images[activeTab] || []
  const totalCount = currentImages.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedImages = currentImages.slice(startIndex, startIndex + pageSize)

  // 未登录界面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ 
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundAttachment: 'fixed'
      }}>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 w-full max-w-md border border-white/30">
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
      {/* ========= 左侧悬浮目录 ========= */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 w-60">
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/20 bg-white/5">
            <div className="flex items-center gap-2 text-white font-medium">
              <i className="fas fa-folder-tree"></i>
              <span>图片库</span>
            </div>
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
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
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
      </div>

      {/* ========= 右侧内容区 ========= */}
      <div className="max-w-7xl mx-auto pl-72">
        {/* 标题栏 */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-medium flex items-center gap-2">
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
                  className="px-3 py-1.5 rounded bg-white/10 text-white/60 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className="px-4 py-1.5 rounded bg-white/20 text-white text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/60 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 图片网格 - 每行8个，横屏16:9，竖屏9:16 */}
        {loading ? (
          <div className="flex justify-center items-center py-20 bg-white/5 rounded-xl">
            <i className="fas fa-spinner fa-pulse text-3xl text-white/50"></i>
          </div>
        ) : paginatedImages.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-xl backdrop-blur-sm">
            <i className="fas fa-folder-open text-5xl text-white/30 mb-3"></i>
            <p className="text-white/50">暂无图片</p>
            <a href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <i className="fas fa-upload"></i>
              去上传图片 →
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-8 gap-3">
              {paginatedImages.map((img, idx) => {
                const proxyUrl = getProxyUrl(img)
                const aspectClass = getImageAspect(img)
                return (
                  <div
                    key={img.sha || idx}
                    className="group bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden border border-white/20 hover:border-white/40 transition-all hover:scale-105 hover:shadow-lg"
                  >
                    {/* 动态比例：横屏16:9，竖屏9:16 */}
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
                        <i className="fas fa-search-plus text-white text-sm"></i>
                      </div>
                    </div>
                    
                    <div className="p-1">
                      <p className="text-white/60 text-[9px] truncate" title={img.name}>
                        {img.name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[8px] text-white/30">
                          {img.source === 'external' ? '🌐' : '📦'}
                        </span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={(e) => handleCopy(proxyUrl, img.name, e)}
                            className="text-white/50 hover:text-green-400 transition text-[9px] px-1 py-0.5 rounded"
                            title="复制链接"
                          >
                            {copiedId === img.name ? <i className="fas fa-check"></i> : <i className="fas fa-copy"></i>}
                          </button>
                          <button
                            onClick={(e) => handleDelete(img, activeTab, e)}
                            disabled={deletingId === img.name}
                            className="text-white/50 hover:text-red-400 transition text-[9px] px-1 py-0.5 rounded disabled:opacity-30"
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
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
                >
                  首页
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
                >
                  上一页
                </button>
                <span className="px-3 py-1.5 rounded bg-white/20 text-white text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
                >
                  下一页
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
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
              className="absolute -top-12 right-0 text-white/70 hover:text-white text-2xl flex items-center gap-1"
            >
              <i className="fas fa-times-circle"></i>
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-3 rounded-b-lg">
              <p className="text-white text-sm truncate">
                <i className="fas fa-image mr-2"></i>
                {previewImage.name}
              </p>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const proxyUrl = getProxyUrl(previewImage)
                    copyToClipboard(proxyUrl)
                    setCopiedId(previewImage.name)
                    setTimeout(() => setCopiedId(null), 2000)
                  }}
                  className="text-white/70 hover:text-green-400 text-sm flex items-center gap-1 transition"
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
                  className="text-white/70 hover:text-red-400 text-sm flex items-center gap-1 transition"
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
