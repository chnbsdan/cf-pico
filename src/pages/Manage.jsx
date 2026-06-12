// src/pages/Manage.jsx - 图片管理页面
import React, { useState, useEffect } from 'react'
import { fetchImageList, copyToClipboard } from '../lib/api'

export default function Manage() {
  const [images, setImages] = useState({ wallpaper: [], cover: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('wallpaper')
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    loadImages()
  }, [])

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

  const handleCopy = (url, name) => {
    copyToClipboard(url)
    setCopiedId(name)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const currentImages = images[activeTab] || []
  const totalCount = currentImages.length

  return (
    <div className="min-h-screen py-6 px-4 relative" style={{ 
      backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* 返回首页链接 */}
      <a 
        href="/" 
        className="fixed top-4 left-4 z-50 bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-white text-sm flex items-center gap-2"
      >
        <i className="fas fa-arrow-left"></i>
        返回首页
      </a>

      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📷 图片管理</h1>
          <p className="text-white/60">共 {totalCount} 张图片</p>
        </div>

        {/* 分类标签 */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setActiveTab('wallpaper')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'wallpaper'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            🖼️ 横屏 ({images.wallpaper.length})
          </button>
          <button
            onClick={() => setActiveTab('cover')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'cover'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            📱 竖屏 ({images.cover.length})
          </button>
        </div>

        {/* 图片网格 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        ) : currentImages.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-xl backdrop-blur-sm">
            <i className="fas fa-folder-open text-5xl text-white/30 mb-3"></i>
            <p className="text-white/50">暂无图片</p>
            <a href="/" className="inline-block mt-4 text-blue-400 hover:text-blue-300">
              去上传图片 →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {currentImages.map((img, idx) => (
              <div
                key={img.sha || idx}
                className="group bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition-all hover:scale-105"
              >
                {/* 图片预览 */}
                <div className="aspect-square bg-black/30 overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%23ccc">加载失败</text></svg>'
                    }}
                  />
                </div>
                
                {/* 图片信息 */}
                <div className="p-2">
                  <p className="text-white/80 text-xs truncate" title={img.name}>
                    {img.name}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-white/40">
                      {img.source === 'external' ? '🌐 外部' : '📦 仓库'}
                    </span>
                    <button
                      onClick={() => handleCopy(img.url, img.name)}
                      className="text-white/60 hover:text-white transition text-xs flex items-center gap-1"
                    >
                      <i className="fas fa-copy"></i>
                      {copiedId === img.name ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
