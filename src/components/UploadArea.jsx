import React, { useRef, useState } from 'react'

export default function UploadArea({ onUpload, isLoading }) {
  const [dragOver, setDragOver] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const [bgRefresh, setBgRefresh] = useState(false)  // 换背景按钮状态
  const fileInputRef = useRef(null)

  // 换背景：只从横屏图片中获取
  const refreshBackground = () => {
    // 添加点击动画效果
    setBgRefresh(true)
    setTimeout(() => setBgRefresh(false), 200)
    
    const img = new Image()
    const url = '/api/wallpaper?t=' + Date.now()
    img.onload = () => {
      document.body.style.backgroundImage = `url(${url})`
    }
    img.src = url
  }

  const handleFileSelect = (files) => {
    if (files.length > 0) {
      onUpload(files, folder)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      onUpload(files, folder)
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-1">
          <i className="fas fa-upload text-blue-400 text-sm"></i>
          上传图片
        </h3>
        <div className="flex items-center gap-2">
          {/* 换背景按钮 - 有点击状态变化 */}
          <button
            onClick={refreshBackground}
            className={`text-xs transition flex items-center gap-1 px-2 py-1 rounded-lg ${
              bgRefresh
                ? 'bg-green-700 text-white shadow-md'
                : 'bg-green-500 text-white hover:bg-green-400'
            }`}
            title="换一张背景"
          >
            <i className="fas fa-sync-alt text-xs"></i>
            换背景
          </button>
          {/* 横屏按钮 */}
          <button
            onClick={() => setFolder('wallpaper')}
            className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
              folder === 'wallpaper'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-300'
            }`}
          >
            <i className="fas fa-arrows-alt text-xs"></i>
            横屏
          </button>
          {/* 竖屏按钮 */}
          <button
            onClick={() => setFolder('cover')}
            className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
              folder === 'cover'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-300'
            }`}
          >
            <i className="fas fa-mobile-alt text-xs"></i>
            竖屏
          </button>
        </div>
      </div>

      {/* 上传区域 */}
      <div
        className={`upload-area rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          dragOver
            ? 'border-blue-500 bg-sky-100'
            : 'border-gray-300 bg-gray-50 hover:bg-sky-100 hover:border-sky-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3 block"></i>
        <p className="text-gray-600 text-base mb-2">点击或拖拽图片到此处上传</p>
        <p className="text-xs text-gray-400">支持 JPG、PNG、WebP、GIF、AVIF | 大图自动压缩</p>
        <p className="text-xs text-blue-500 mt-3">
          当前上传到: {folder === 'wallpaper' ? '📁 横屏 (wallpaper)' : '📁 竖屏 (cover)'}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {isLoading && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-blue-600">
            <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            上传中，请稍候...
          </div>
        </div>
      )}
    </div>
  )
}
