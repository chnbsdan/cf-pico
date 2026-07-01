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

  const CHUNK_SIZE = 16 * 1024 * 1024  // 16MB
  const CONCURRENT = 3

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
        setUploadStatus(`重试分片 ${chunkIndex + 1} (${attempt}/${maxRetries})...`)
      }
    }
    throw new Error(`分片 ${chunkIndex + 1} 上传失败: ${lastError}`)
  }

  const uploadLargeFile = async (file, folder) => {
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
      setUploadStatus(`准备上传 ${chunkCount} 个分片 (16MB/片)...`)

      const startTime = Date.now()
      let uploadedBytes = 0

      for (let i = 0; i < chunkCount; i += CONCURRENT) {
        const batch = []
        const batchSize = Math.min(CONCURRENT, chunkCount - i)

        for (let j = i; j < i + batchSize; j++) {
          const start = j * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, file.size)
          if (start >= end) continue
          const chunk = file.slice(start, end)
          batch.push(uploadChunkWithRetry(uploadId, j, chunk, 3))
        }

        if (batch.length === 0) continue
        await Promise.all(batch)

        const completed = Math.min(i + CONCURRENT, chunkCount)
        const progress = Math.round((completed / chunkCount) * 100)
        setUploadProgress(progress)
        setUploadStatus(`上传分片 ${completed}/${chunkCount}`)

        uploadedBytes = Math.min((i + CONCURRENT) * CHUNK_SIZE, file.size)
        const elapsed = (Date.now() - startTime) / 1000
        if (elapsed > 0.5) {
          const speed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1)
          setUploadSpeed(`${speed} MB/s`)
        }
      }

      setUploadStatus('正在合并...')
      const completeResult = await completeChunkUpload(uploadId, folder)
      
      if (!completeResult.success) {
        throw new Error(completeResult.error || '提交失败')
      }

      setUploadStatus(`✅ 上传完成! ${(file.size / 1024 / 1024).toFixed(1)}MB`)
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

  const uploadNormalFile = async (file, folder, storage) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)
    formData.append('storage', storage)
    formData.append('convertToWebp', convertToWebp ? 'true' : 'false')

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload')

      const startTime = Date.now()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(progress)
          const elapsed = (Date.now() - startTime) / 1000
          if (elapsed > 0.5) {
            const speed = (e.loaded / elapsed / 1024 / 1024).toFixed(1)
            setUploadSpeed(`${speed} MB/s`)
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch (e) {
            reject(new Error('解析响应失败'))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || `上传失败 (${xhr.status})`))
          } catch {
            reject(new Error(`上传失败 (${xhr.status})`))
          }
        }
      }

      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.ontimeout = () => reject(new Error('上传超时'))
      xhr.timeout = 120000

      xhr.send(formData)
    })
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    const results = []

    for (const file of fileArray) {
      if (!file) continue

      try {
        setUploadStatus(`处理: ${file.name}`)

        // 判断是否需要分片（Telegram 且 > 50MB）
        const needChunk = storageType === 'telegram' && file.size > 50 * 1024 * 1024

        let url
        if (needChunk) {
          if (file.size > 500 * 1024 * 1024) {
            throw new Error('文件超过 500MB，暂不支持')
          }
          console.log(`📦 大文件 (${(file.size / 1024 / 1024).toFixed(1)}MB)，使用分片上传 (16MB/片)`)
          url = await uploadLargeFile(file, folder)
        } else {
          // 普通上传
          if (storageType === 'telegram' && file.size > 50 * 1024 * 1024) {
            throw new Error('Telegram 直接上传限制 50MB，将自动使用分片上传')
          }
          if (storageType !== 'telegram' && file.size > 10 * 1024 * 1024) {
            throw new Error(`${storageType === 'github' ? 'GitHub' : 'R2'} 限制 10MB，请切换到 Telegram`)
          }
          
          const result = await uploadNormalFile(file, folder, storageType)
          if (!result.success) {
            throw new Error(result.error || '上传失败')
          }
          url = result.url
        }

        results.push({
          success: true,
          filename: file.name,
          url: url,
          folder: folder,
          storage: storageType
        })

        if (fileArray.length === 1 && url) {
          try {
            await navigator.clipboard.writeText(url)
            console.log('📋 链接已复制')
          } catch (e) {}
        }

      } catch (error) {
        console.error('上传失败:', error)
        results.push({
          success: false,
          filename: file.name,
          error: error.message,
          folder: folder
        })
        setUploadStatus(`❌ ${file.name}: ${error.message}`)
      }
    }

    setIsChunkUploading(false)
    setUploadProgress(0)
    setUploadSpeed('')
    
    setTimeout(() => setUploadStatus(''), 3000)

    if (onUpload) {
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
            <span className="text-white/30 text-[10px]">(&lt;10MB)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="r2" checked={storageType === 'r2'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-orange-500" />
            <span className="text-white/80 text-sm"><i className="fas fa-cloud-upload-alt mr-1"></i>R2</span>
            <span className="text-white/30 text-[10px]">(&lt;10MB)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="telegram" checked={storageType === 'telegram'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-green-500" />
            <span className="text-white/80 text-sm"><i className="fab fa-telegram-plane mr-1"></i>Telegram</span>
            <span className="text-white/30 text-[10px]">(&lt;50MB 直传，&gt;50MB 分片 16MB)</span>
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
            <span className="text-blue-400"><i className="fab fa-github mr-1"></i>将存储到 GitHub 私有仓库 (&lt;10MB)</span>
          ) : storageType === 'r2' ? (
            <span className="text-orange-400"><i className="fas fa-cloud-upload-alt mr-1"></i>将存储到 Cloudflare R2 (&lt;10MB)</span>
          ) : (
            <span className="text-green-400"><i className="fab fa-telegram-plane mr-1"></i>将存储到 Telegram 频道 (&lt;50MB 直传 / &gt;50MB 分片 16MB)</span>
          )}
        </p>

        {isUploading && (
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

        <p className="text-xs text-blue-500 mt-3"><i className="fas fa-folder-open mr-1"></i>当前上传到: {currentFolder.label}</p>
      </div>

      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,audio/mpeg,audio/wav,audio/ogg,video/mp4" 
        multiple 
        className="hidden" 
        onChange={handleFileSelect} 
      />

      {(isLoading || isUploading) && !uploadStatus && (
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
