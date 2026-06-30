import React, { useRef, useState, useEffect } from 'react'
import { initChunkUpload, uploadChunk, completeChunkUpload } from '../lib/api'

export default function UploadArea({ onUpload, isLoading, convertToWebp, onConvertChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const [bgRefresh, setBgRefresh] = useState(false)
  const [storageType, setStorageType] = useState('github')
  const [uploadProgress, setUploadProgress] = useState(0)      // 上传进度 0-100
  const [isChunkUploading, setIsChunkUploading] = useState(false)
  const fileInputRef = useRef(null)

  const folderOptions = [
    { key: 'wallpaper', label: '横屏图片 (wallpaper)', icon: 'fa-arrows-alt', color: 'blue' },
    { key: 'cover', label: '竖屏图片 (cover)', icon: 'fa-mobile-alt', color: 'purple' },
    { key: 'sh', label: '横屏图片 (sh)', icon: 'fa-arrows-alt', color: 'blue' },
    { key: 'sd', label: '竖屏图片 (sd)', icon: 'fa-mobile-alt', color: 'purple' }
  ]

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

  // ============================================================
  // ✅ 大文件分片上传（10MB一片，最大1GB）
  // ============================================================
  const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB

  const uploadLargeFile = async (file, folder, storage) => {
    setIsChunkUploading(true)
    setUploadProgress(0)

    try {
      // 1. 初始化
      const initResult = await initChunkUpload(file.name, file.size)
      if (!initResult.uploadId) {
        throw new Error(initResult.error || '初始化上传失败')
      }

      const { uploadId, chunkCount } = initResult
      let uploadedCount = 0

      // 2. 逐片上传
      for (let i = 0; i < chunkCount; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)

        const result = await uploadChunk(uploadId, i, chunk)
        if (!result.success) {
          throw new Error(`分片 ${i} 上传失败: ${result.error || '未知错误'}`)
        }

        uploadedCount = i + 1
        const progress = Math.round((uploadedCount / chunkCount) * 100)
        setUploadProgress(progress)
        console.log(`📤 分片 ${i + 1}/${chunkCount} 完成，进度 ${progress}%`)
      }

      // 3. 完成上传
      const completeResult = await completeChunkUpload(uploadId, folder)
      if (!completeResult.success) {
        throw new Error(completeResult.error || '完成上传失败')
      }

      setIsChunkUploading(false)
      setUploadProgress(0)
      return completeResult.url

    } catch (error) {
      console.error('大文件上传失败:', error)
      setIsChunkUploading(false)
      setUploadProgress(0)
      throw error
    }
  }

  // ============================================================
  // ✅ 修改：上传完成后，使用后端返回的完整 URL
  // ============================================================
  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    console.log('UploadArea 收到文件数量:', files.length)

    const fileArray = Array.from(files)
    const results = []

    for (const file of fileArray) {
      try {
        let url

        // ✅ 判断：大于 10MB 使用分片上传
        if (file.size > 10 * 1024 * 1024) {
          if (storageType !== 'telegram') {
            throw new Error('大文件仅支持 Telegram 存储，请切换到 Telegram')
          }
          console.log(`📦 大文件 (${(file.size / 1024 / 1024).toFixed(1)}MB)，使用分片上传`)
          url = await uploadLargeFile(file, folder, storageType)
        } else {
          // 小文件走原有逻辑（通过 onUpload 回调）
          // 这里直接调用父组件的 onUpload 方法
          const result = await onUpload([file], folder, storageType)
          if (result && result.length > 0 && result[0].success) {
            url = result[0].url
          } else {
            throw new Error(result?.[0]?.error || '上传失败')
          }
        }

        results.push({
          success: true,
          filename: file.name,
          url: url,
          folder: folder,
          storage: storageType
        })

      } catch (error) {
        console.error('上传失败:', error)
        results.push({
          success: false,
          filename: file.name,
          error: error.message,
          folder: folder
        })
      }
    }

    // 更新父组件状态
    if (onUpload && results.length > 0) {
      await onUpload(results)
    }
  }

  const handleFileSelect = async (e) => {
    const files = e.target.files
    console.log('选择文件数量:', files.length)
    await handleFiles(files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    console.log('拖拽文件数量:', files.length)
    await handleFiles(files)
  }

  useEffect(() => {
    const handlePaste = async (e) => {
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
        await handleFiles(imageFiles)
        const toast = document.createElement('div')
        toast.innerHTML = '<i class="fas fa-paste mr-1"></i> 检测到粘贴的图片，开始上传'
        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg animate-fade-in-up'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [folder, storageType])

  const currentFolder = folderOptions.find(opt => opt.key === folder) || folderOptions[0]

  // 是否在上传中（父组件加载状态 或 分片上传状态）
  const isUploading = isLoading || isChunkUploading

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-green-500 text-sm flex items-center gap-1">
          <i className="fas fa-upload text-orange-600 text-sm"></i>
          上传图片
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
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
          {folderOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFolder(opt.key)}
              className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${
                folder === opt.key
                  ? `bg-${opt.color}-600 text-white shadow-md`
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <i className={`fas ${opt.icon} text-xs`}></i>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 存储方式选择 */}
      <div className="flex justify-center items-center mb-4">
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex-wrap justify-center">
          <span className="text-white/70 text-sm">
            <i className="fas fa-database mr-1"></i>
            存储方式：
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="storageType"
              value="github"
              checked={storageType === 'github'}
              onChange={(e) => setStorageType(e.target.value)}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-white/80 text-sm">
              <i className="fab fa-github mr-1"></i>
              GitHub
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="storageType"
              value="r2"
              checked={storageType === 'r2'}
              onChange={(e) => setStorageType(e.target.value)}
              className="w-3.5 h-3.5 accent-orange-500"
            />
            <span className="text-white/80 text-sm">
              <i className="fas fa-cloud-upload-alt mr-1"></i>
              R2
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="storageType"
              value="telegram"
              checked={storageType === 'telegram'}
              onChange={(e) => setStorageType(e.target.value)}
              className="w-3.5 h-3.5 accent-green-500"
            />
            <span className="text-white/80 text-sm">
              <i className="fab fa-telegram-plane mr-1"></i>
              Telegram
            </span>
          </label>
        </div>
      </div>

      {/* WebP 转换复选框 */}
      <div className="flex justify-center items-center mb-4">
        <label
          className="flex items-center gap-2 cursor-pointer group"
          onClick={(e) => e.stopPropagation()}
        >
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

        <p className="text-xs mt-2 flex items-center justify-center gap-1 flex-wrap">
          {storageType === 'github' ? (
            <span className="text-blue-400">
              <i className="fab fa-github mr-1"></i>将存储到 GitHub 私有仓库
            </span>
          ) : storageType === 'r2' ? (
            <span className="text-orange-400">
              <i className="fas fa-cloud-upload-alt mr-1"></i>将存储到 Cloudflare R2（CDN 加速）
            </span>
          ) : (
            <span className="text-green-400">
              <i className="fab fa-telegram-plane mr-1"></i>将存储到 Telegram 频道（最大 10MB，>10MB 自动分片）
            </span>
          )}
        </p>

        {/* ✅ 上传进度条（分片上传时显示） */}
        {isChunkUploading && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-white/60 mt-1">分片上传进度: {uploadProgress}%</p>
          </div>
        )}

        {convertToWebp && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            <i className="fas fa-exchange-alt mr-1"></i>
            已开启 WebP 转换，上传后将自动转换格式
          </p>
        )}

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
              <option value="70" className="text-gray-800 dark:text-gray-800">高压缩 (70%) — 体积更小</option>
              <option value="85" className="text-gray-800 dark:text-gray-800">推荐 (85%) — 平衡</option>
              <option value="100" className="text-gray-800 dark:text-gray-800">最佳质量 (100%) — 文件较大</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-blue-500 mt-3">
          <i className="fas fa-folder-open mr-1"></i>
          当前上传到: {currentFolder.label}
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

      {(isLoading || isChunkUploading) && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-orange-600">
            <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            {isChunkUploading ? `分片上传中 ${uploadProgress}%...` : '上传中，请稍候...'}
          </div>
        </div>
      )}
    </div>
  )
}
