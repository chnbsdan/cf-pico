// src/pages/Manage.jsx - 图片管理页面（完整版）
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
  
  const [previewImage, setPreviewImage] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // 生成完整的代理 URL（动态获取域名）
  const getProxyUrl = (img) => {
    if (img.source === 'external') {
      return img.url
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pcbed.vercel.app'
    return `${baseUrl}/api/image?path=${img.folder}/${img.name}`
  }

  // 验证密码
  const handleLogin = (e) => {
    e.preventDefault()
    // ⚠️ 请修改下面的密码为你自己的密码
    if (password === 'your-password') {
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
    if (event) {
      event.stopPropagation()
    }
    copyToClipboard(url)
    setCopiedId(name)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (img, folder, event) => {
    if (event) {
      event.stopPropagation()
    }
    
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

  const currentImages = images[activeTab] || []
  const totalCount = currentImages.length

  // 未登录时显示密码输入界面
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

  // 已登录，显示图片管理界面
  return (
    <div className="min-h-screen py-6 px-4 relative" style={{ 
      backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* 顶部栏 */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
        <a 
          href="/" 
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-white text-sm flex items-center gap-2"
        >
          <i className="fas fa-arrow-left"></i>
          返回首页
        </a>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-white text-sm flex items-center gap-2"
        >
          <i className="fas fa-sign-out-alt"></i>
          退出
        </button>
      </div>

      <div className="max-w-6xl mx-auto mt-16">
        {/* 头部 */}
        <div className="text-center mb-8">
          <i className="fas fa-images text-5xl text-white/70 mb-3"></i>
          <h1 className="text-3xl font-bold text-white mb-2">图片管理</h1>
          <p className="text-white/60">共 {totalCount} 张图片</p>
        </div>

        {/* 分类标签 */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setActiveTab('wallpaper')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'wallpaper'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <i className="fas fa-arrows-alt"></i>
            横屏 ({images.wallpaper.length})
          </button>
          <button
            onClick={() => setActiveTab('cover')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'cover'
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <i className="fas fa-mobile-alt"></i>
            竖屏 ({images.cover.length})
          </button>
        </div>

        {/* 图片网格 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <i className="fas fa-spinner fa-pulse text-3xl text-white/50"></i>
          </div>
        ) : currentImages.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-xl backdrop-blur-sm">
            <i className="fas fa-folder-open text-5xl text-white/30 mb-3"></i>
            <p className="text-white/50">暂无图片</p>
            <a href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <i className="fas fa-upload"></i>
              去上传图片 →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentImages.map((img, idx) => {
              const proxyUrl = getProxyUrl(img)
              return (
                <div
                  key={img.sha || idx}
                  className="group bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition-all hover:scale-105 hover:shadow-xl"
                >
                  <div 
                    className="aspect-square bg-black/30 overflow-hidden cursor-pointer relative"
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
                      <i className="fas fa-search-plus text-white text-xl"></i>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    <p className="text-white/80 text-xs truncate" title={img.name}>
                      {img.name}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        {img.source === 'external' ? <i className="fas fa-globe"></i> : <i className="fas fa-database"></i>}
                        {img.source === 'external' ? '外部' : '本地'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => handleCopy(proxyUrl, img.name, e)}
                          className="text-white/60 hover:text-green-400 transition text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10"
                          title="复制链接"
                        >
                          {copiedId === img.name ? <i className="fas fa-check"></i> : <i className="fas fa-copy"></i>}
                        </button>
                        <button
                          onClick={(e) => handleDelete(img, activeTab, e)}
                          disabled={deletingId === img.name}
                          className="text-white/60 hover:text-red-400 transition text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 disabled:opacity-50"
                          title="删除图片"
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
