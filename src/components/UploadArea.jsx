import React, { useRef, useState, useEffect } from 'react'

export default function UploadArea({ onUpload, isLoading, convertToWebp, onConvertChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const [bgRefresh, setBgRefresh] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const fileInputRef = useRef(null)

  const refreshBackground = () => {
    setBgRefresh(true)
    setTimeout(() => setBgRefresh(false), 200)
    
    const img = new Image()
    const url = '/api/wallpaper?t=' + Date.now() + '&r=' + Math.random()
    img.onload = () => {
      document.body.style.backgroundImage = `url(${url})`
    }
    img.src = url
  }

  // 直接传递所有文件给父组件
  const handleFiles = (files) => {
    if (!files || files.length === 0) return
    console.log('UploadArea 收到文件数量:', files.length)
    onUpload(files, folder)
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    console.log('选择文件数量:', files.length)
    handleFiles(files)
    // 清空 input 的值，以便再次选择相同文件时能触发 onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    console.log('拖拽文件数量:', files.length)
    handleFiles(files)
  }

  // 粘贴上传
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      
      const imageFiles = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            imageFiles.push(file)
          }
        }
      }
      
      if (imageFiles.length > 0) {
        e.preventDefault()
        handleFiles(imageFiles)
        
        const toast = document.createElement('div')
        toast.innerHTML = '<i class="fas fa-paste mr-1"></i> 检测到粘贴的图片，开始上传'
        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg animate-fade-in-up'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)
      }
    }
    
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [folder])

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-green-500 text-sm flex items-center gap-1">
          <i className="fas fa-upload text-orange-600 text-sm"></i>
          上传图片
        </h3>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setFolder('wallpaper')}
            className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
              folder === 'wallpaper'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <i className="fas fa-arrows-alt text-xs"></i>
            横屏
          </button>
          <button
            onClick={() => setFolder('cover')}
            className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
              folder === 'cover'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <i className="fas fa-mobile-alt text-xs"></i>
            竖屏
          </button>
        </div>
      </div>

      {/* WebP 转换复选框 */}
      <div className="flex justify-center items-center mb-4">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={convertToWebp || false}
            onChange={(e) => onConvertChange?.(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 bg-white/80 
                       checked:bg-blue-500 checked:border-blue-500 
                       focus:ring-2 focus:ring-blue-400 focus:ring-offset-0
                       cursor-pointer"
          />
          <span className="text-white/80 text-sm group-hover:text-white/100 transition">
            <i className="fas fa-file-image mr-1"></i>
            自动转换为 WebP 格式
          </span>
          <span className="text-white/40 text-xs hidden sm:inline">
            (更小体积，相同画质)
          </span>
        </label>
      </div>

      {/* 上传区域 */}
      <div
        className={`upload-area rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer ${
          dragOver
            ? 'border-blue-500 bg-sky-100 dark:bg-sky-900/30'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:border-sky-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3 block"></i>
        <p className="text-gray-600 dark:text-gray-300 text-base mb-2">点击或拖拽图片到此处上传</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">支持 JPG、PNG、WebP、GIF、AVIF | 大图自动压缩</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          <i className="fas fa-paste mr-1"></i>也可直接 Ctrl+V 粘贴截图上传
        </p>
        
        {convertToWebp && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            <i className="fas fa-exchange-alt mr-1"></i>
            已开启 WebP 转换，上传后将自动转换格式
          </p>
        )}
        
        {/* 压缩质量选择 */}
<div 
  className="flex justify-center items-center mt-3"
  onClick={(e) => e.stopPropagation()}
>
  <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
    <span className="text-gray-700 dark:text-white/70 text-sm">
      <i className="fas fa-compress-alt mr-1"></i>
      压缩质量：
    </span>
    <select
      id="compressQuality"
      defaultValue="85"
      onChange={(e) => {
        const quality = parseInt(e.target.value)
        localStorage.setItem('compressQuality', quality)
      }}
      className="bg-white text-gray-800 dark:bg-white/20 dark:text-white text-sm rounded-lg px-3 py-1.5 border border-gray-300 dark:border-white/30 
                 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer
                 hover:bg-gray-100 dark:hover:bg-white/30 transition"
    >
      <option value="70" className="text-gray-800 dark:text-gray-800">📦 高压缩 (70%) - 体积更小</option>
      <option value="85" className="text-gray-800 dark:text-gray-800">⚖️ 推荐 (85%) - 平衡</option>
      <option value="100" className="text-gray-800 dark:text-gray-800">✨ 最佳质量 (100%) - 文件较大</option>
    </select>
  </div>
</div>
        
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
        onChange={handleFileSelect}
      />

      {uploadProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm text-white/70 mb-1">
            <span><i className="fas fa-spinner fa-pulse mr-1"></i>上传中...</span>
            <span>{uploadProgress.current} / {uploadProgress.total}</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {isLoading && !uploadProgress && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-orange-600">
            <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            上传中，请稍候...
          </div>
        </div>
      )}
    </div>
  )
}
