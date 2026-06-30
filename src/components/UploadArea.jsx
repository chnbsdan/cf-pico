import React, { useRef, useState, useEffect } from 'react'
import { initChunkUpload, uploadChunk, completeChunkUpload } from '../lib/api'

export default function UploadArea({ onUpload, isLoading, convertToWebp, onConvertChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const [bgRefresh, setBgRefresh] = useState(false)
  const [storageType, setStorageType] = useState('github')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadSpeed, setUploadSpeed] = useState('')
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

  const uploadChunkWithRetry = async (uploadId, chunkIndex, chunk, maxRetries = 3) => {
    let lastError
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await uploadChunk(uploadId, chunkIndex, chunk)
        if (result.success) return result
        lastError = result.error || '未知错误'
      } catch (e) {
        lastError = e.message
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
    throw new Error(`分片 ${chunkIndex} 上传失败: ${lastError}`)
  }

  const CHUNK_SIZE = 20 * 1024 * 1024
  const CONCURRENT = 3

  const uploadLargeFile = async (file, folder, storage) => {
    setIsChunkUploading(true)
    setUploadProgress(0)
    setUploadStatus('正在初始化...')
    setUploadSpeed('')

    try {
      const initResult = await initChunkUpload(file.name, file.size)
      if (!initResult.uploadId) {
        throw new Error(initResult.error || '初始化上传失败')
      }

      const { uploadId, chunkCount } = initResult
      setUploadStatus(`准备上传 ${chunkCount} 个分片 (20MB/片)...`)

      const startTime = Date.now()
      let uploadedBytes = 0
      let uploadedCount = 0

      // ✅ 修复：使用 while 循环，确保索引连续
      while (uploadedCount < chunkCount) {
        const batch = []
        const batchSize = Math.min(CONCURRENT, chunkCount - uploadedCount)
        
        for (let j = 0; j < batchSize; j++) {
          const chunkIndex = uploadedCount + j
          const start = chunkIndex * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, file.size)
          if (start >= end) continue
          const chunk = file.slice(start, end)
          batch.push(uploadChunkWithRetry(uploadId, chunkIndex, chunk, 3))
        }
        
        await Promise.all(batch)
        uploadedCount += batchSize
        
        const progress = Math.round((uploadedCount / chunkCount) * 100)
        setUploadProgress(progress)
        setUploadStatus(`上传分片 ${uploadedCount}/${chunkCount}`)

        uploadedBytes = Math.min(uploadedCount * CHUNK_SIZE, file.size)
        const elapsed = (Date.now() - startTime) / 1000
        if (elapsed > 0.5) {
          const speed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1)
          setUploadSpeed(`${speed} MB/s`)
        }
      }

      setUploadStatus('正在提交...')
      const completeResult = await completeChunkUpload(uploadId, folder)
      console.log('📤 completeChunkUpload 结果:', completeResult)
      if (!completeResult.success) {
        throw new Error(completeResult.error || '提交失败')
      }

      setUploadStatus('上传完成 ✅')
      setIsChunkUploading(false)
      setUploadProgress(0)
      setUploadSpeed('')
      return completeResult.url

    } catch (error) {
      console.error('大文件上传失败:', error)
      setUploadStatus(`❌ ${error.message}`)
      setIsChunkUploading(false)
      setUploadProgress(0)
      setUploadSpeed('')
      throw error
    }
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    console.log('UploadArea 收到文件数量:', files.length)

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    const results = []

    for (const file of fileArray) {
      if (!file) continue

      try {
        let url

        if (file.size > 20 * 1024 * 1024) {
          if (storageType !== 'telegram') {
            throw new Error('大文件仅支持 Telegram 存储，请切换到 Telegram')
          }
          console.log(`📦 大文件 (${(file.size / 1024 / 1024).toFixed(1)}MB)，使用分片上传`)
          url = await uploadLargeFile(file, folder, storageType)
          
          results.push({
            success: true,
            filename: file.name,
            url: url,
            folder: folder,
            storage: storageType
          })
          
        } else {
          const result = await onUpload([file], folder, storageType)
          if (result && result.length > 0 && result[0].success) {
            url = result[0].url
            results.push({
              success: true,
              filename: file.name,
              url: url,
              folder: folder,
              storage: storageType
            })
          } else {
            throw new Error(result?.[0]?.error || '上传失败')
          }
        }

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

    if (results.length > 0 && onUpload) {
      console.log('📤 调用 onUpload，结果数量:', results.length)
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
            className={`text-xs transition flex items-center gap-1 px-2 py-1 rounded-lg ${bgRefresh ? 'bg-green-700 text-white shadow-md' : 'bg-green-500 text-white hover:bg-green-400'}`}
            title="换一张背景"
          >
            <i className="fas fa-sync-alt text-xs"></i> 换背景
          </button>
          {folderOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFolder(opt.key)}
              className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all ${folder === opt.key ? `bg-${opt.color}-600 text-white shadow-md` : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            >
              <i className={`fas ${opt.icon} text-xs`}></i> {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center items-center mb-4">
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex-wrap justify-center">
          <span className="text-white/70 text-sm"><i className="fas fa-database mr-1"></i>存储方式：</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="github" checked={storageType === 'github'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-blue-500" />
            <span className="text-white/80 text-sm"><i className="fab fa-github mr-1"></i>GitHub</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="r2" checked={storageType === 'r2'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-orange-500" />
            <span className="text-white/80 text-sm"><i className="fas fa-cloud-upload-alt mr-1"></i>R2</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="telegram" checked={storageType === 'telegram'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-green-500" />
            <span className="text-white/80 text-sm"><i className="fab fa-telegram-plane mr-1"></i>Telegram</span>
          </label>
        </div>
      </div>

      <div className="flex justify-center items-center mb-4">
        <label className="flex items-center gap-2 cursor-pointer group" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={convertToWebp || false} onChange={(e) => onConvertChange?.(e.target.checked)} className="w-4 h-4 rounded border-gray-300 bg-white/80 checked:bg-blue-500 checked:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer" />
          <span className="text-white/80 text-sm group-hover:text-white/100 transition"><i className="fas fa-file-image mr-1"></i>自动转换为 WebP 格式</span>
          <span className="text-white/40 text-xs hidden sm:inline">(更小体积，相同画质)</span>
        </label>
      </div>

      <div
        className={`upload-area rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer ${dragOver ? 'border-blue-500 bg-sky-100 dark:bg-sky-900/30' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:border-sky-400'}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3 block"></i>
        <p className="text-gray-600 dark:text-gray-300 text-base mb-2">点击或拖拽图片到此处上传</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">支持 JPG、PNG、WebP、GIF、AVIF | 大图自动压缩</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1"><i className="fas fa-paste mr-1"></i>也可直接 Ctrl+V 粘贴截图上传</p>

        <p className="text-xs mt-2 flex items-center justify-center gap-1 flex-wrap">
          {storageType === 'github' ? (
            <span className="text-blue-400"><i className="fab fa-github mr-1"></i>将存储到 GitHub 私有仓库</span>
          ) : storageType === 'r2' ? (
            <span className="text-orange-400"><i className="fas fa-cloud-upload-alt mr-1"></i>将存储到 Cloudflare R2（CDN 加速）</span>
          ) : (
            <span className="text-green-400"><i className="fab fa-telegram-plane mr-1"></i>将存储到 Telegram 频道（>20MB 自动分片）</span>
          )}
        </p>

        {isChunkUploading && (
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
            <div className="flex justify-between items-center text-sm text-gray-800 dark:text-white/80 mb-2">
              <span>{uploadStatus}</span>
              <div className="flex items-center gap-3">
                {uploadSpeed && <span className="text-xs text-green-600 dark:text-green-400">{uploadSpeed}</span>}
                <span className="font-mono text-gray-800 dark:text-white">{uploadProgress}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-300 dark:bg-gray-700/50 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}

        {convertToWebp && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2"><i className="fas fa-exchange-alt mr-1"></i>已开启 WebP 转换</p>
        )}

        <div className="flex justify-center items-center mt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
            <span className="text-gray-700 dark:text-white/70 text-sm"><i className="fas fa-compress-alt mr-1"></i>压缩质量：</span>
            <select id="compressQuality" defaultValue="85" onChange={(e) => { const quality = parseInt(e.target.value); localStorage.setItem('compressQuality', quality) }} className="bg-white text-gray-800 dark:bg-white/20 dark:text-white text-sm rounded-lg px-3 py-1.5 border border-gray-300 dark:border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/30 transition">
              <option value="70" className="text-gray-800 dark:text-gray-800">高压缩 (70%) — 体积更小</option>
              <option value="85" className="text-gray-800 dark:text-gray-800">推荐 (85%) — 平衡</option>
              <option value="100" className="text-gray-800 dark:text-gray-800">最佳质量 (100%) — 文件较大</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-blue-500 mt-3"><i className="fas fa-folder-open mr-1"></i>当前上传到: {currentFolder.label}</p>
      </div>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="hidden" onChange={handleFileSelect} />

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
