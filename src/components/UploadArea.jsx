import React, { useRef, useState, useEffect, useCallback } from 'react'
import { initChunkUpload, uploadChunk, completeChunkUpload } from '../lib/api'

export default function UploadArea({ onUpload, isLoading, convertToWebp, onConvertChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const [bgRefresh, setBgRefresh] = useState(false)
  const [storageType, setStorageType] = useState('github')
  const [storageOpen, setStorageOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadSpeed, setUploadSpeed] = useState('')
  const [isChunkUploading, setIsChunkUploading] = useState(false)
  const [isNormalUploading, setIsNormalUploading] = useState(false)
  const fileInputRef = useRef(null)
  const glowRef = useRef(null)

  // 上传队列控制
  const [uploadQueue, setUploadQueue] = useState([])
  const [activeUploads, setActiveUploads] = useState(0)
  const maxConcurrentUploads = 3
  const abortControllers = useRef(new Map())

  // 设置状态
  const [showSettings, setShowSettings] = useState(false)
  const [compressQuality, setCompressQuality] = useState(4)
  const [compressBar, setCompressBar] = useState(5)
  const [serverCompress, setServerCompress] = useState(true)
  const [autoRetry, setAutoRetry] = useState(true)
  const [uploadNameType, setUploadNameType] = useState('default')

  const CHUNK_SIZE = 16 * 1024 * 1024

  // ============================================================
  // 光效函数
  // ============================================================
  const handleCardMouseMove = (e) => {
    const glow = glowRef.current
    if (!glow) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    glow.style.opacity = '1'
    glow.style.left = x + 'px'
    glow.style.top = y + 'px'
  }

  const handleCardMouseLeave = () => {
    const glow = glowRef.current
    if (!glow) return
    glow.style.opacity = '0'
  }

  // ============================================================
  // WebP 转换
  // ============================================================
  const convertImageToWebp = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (file.type.includes('gif') || file.type.includes('svg') || file.type.includes('webp')) {
        resolve(null)
        return
      }
      
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const objectUrl = URL.createObjectURL(file)
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const lastDotIndex = file.name.lastIndexOf('.')
            const newName = lastDotIndex > 0 
              ? file.name.substring(0, lastDotIndex) + '.webp'
              : file.name + '.webp'
            
            const webpFile = new File([blob], newName, { type: 'image/webp' })
            webpFile.uid = file.uid
            URL.revokeObjectURL(objectUrl)
            resolve(webpFile)
          } else {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('WebP 转换失败'))
          }
        }, 'image/webp', 0.92)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('图片加载失败'))
      }
      
      img.src = objectUrl
    })
  }, [])

  // ============================================================
  // 配置选项
  // ============================================================
  const folderOptions = [
    { key: 'wallpaper', label: '横屏图片', icon: 'fa-arrows-alt-h', color: 'text-blue-400' },
    { key: 'cover', label: '竖屏图片', icon: 'fa-mobile-alt', color: 'text-purple-400' },
    { key: 'sh', label: '横屏 (sh)', icon: 'fa-arrows-alt-h', color: 'text-blue-400' },
    { key: 'sd', label: '竖屏 (sd)', icon: 'fa-mobile-alt', color: 'text-purple-400' }
  ]

  const storageOptions = [
    { value: 'github', label: 'GitHub', icon: 'fa-brands fa-github' },
    { value: 'r2', label: 'R2', icon: 'fa-cloud' },
    { value: 'telegram', label: 'Telegram', icon: 'fa-paper-plane' },
    { value: 'huggingface', label: 'HuggingFace', icon: 'fa-brain' },
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
  // 分片上传带重试
  // ============================================================
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
        const delay = 2000 * attempt
        await new Promise(r => setTimeout(r, delay))
        setUploadStatus(`重试分片 ${chunkIndex + 1} (${attempt}/${maxRetries})...`)
      }
    }
    throw new Error(`分片 ${chunkIndex + 1} 上传失败: ${lastError}`)
  }

  const processUploadQueue = useCallback(() => {
    if (uploadQueue.length === 0 || activeUploads >= maxConcurrentUploads) {
      return
    }
    const nextFile = uploadQueue.shift()
    if (nextFile) {
      setUploadQueue([...uploadQueue])
    }
  }, [uploadQueue, activeUploads])

  // ============================================================
  // 大文件上传
  // ============================================================
  const uploadLargeFile = async (file, folder) => {
    if (activeUploads >= maxConcurrentUploads) {
      return new Promise((resolve) => {
        setUploadQueue(prev => [...prev, { file, folder, resolve }])
      })
    }

    setIsChunkUploading(true)
    setActiveUploads(prev => prev + 1)
    setUploadProgress(0)
    setUploadStatus('正在初始化...')
    setUploadSpeed('')

    const abortController = new AbortController()
    abortControllers.current.set(file.uid || file.name, abortController)

    try {
      const initResult = await initChunkUpload(file.name, file.size)
      if (!initResult.uploadId) {
        throw new Error(initResult.error || '初始化上传失败')
      }

      const { uploadId, chunkCount } = initResult
      setUploadStatus(`准备上传 ${chunkCount} 个分片 (16MB/片)...`)

      const startTime = Date.now()
      let uploadedBytes = 0

      for (let i = 0; i < chunkCount; i++) {
        if (abortController.signal.aborted) {
          throw new Error('上传已取消')
        }

        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        if (start >= end) continue
        
        const chunk = file.slice(start, end)
        await uploadChunkWithRetry(uploadId, i, chunk, 3)

        const progress = Math.round(((i + 1) / chunkCount) * 100)
        setUploadProgress(progress)
        setUploadStatus(`上传分片 ${i + 1}/${chunkCount}`)

        uploadedBytes = Math.min((i + 1) * CHUNK_SIZE, file.size)
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
      setUploadProgress(100)
      setUploadSpeed('')
      
      abortControllers.current.delete(file.uid || file.name)
      setActiveUploads(prev => Math.max(0, prev - 1))
      processUploadQueue()
      
      return completeResult.url

    } catch (error) {
      console.error('大文件上传失败:', error)
      
      if (autoRetry && error.message !== '上传已取消') {
        setUploadStatus(`⚠️ 上传失败，自动重试中...`)
        await new Promise(r => setTimeout(r, 3000))
        return uploadLargeFile(file, folder)
      }
      
      setUploadStatus(`❌ ${error.message}`)
      setIsChunkUploading(false)
      setUploadProgress(0)
      setUploadSpeed('')
      abortControllers.current.delete(file.uid || file.name)
      setActiveUploads(prev => Math.max(0, prev - 1))
      processUploadQueue()
      throw error
    }
  }

  // ============================================================
  // 普通上传
  // ============================================================
  const uploadNormalFile = async (file, folder, storage) => {
    return new Promise((resolve, reject) => {
      const processFile = async () => {
        let fileToUpload = file
        
        if (convertToWebp && file.type && file.type.startsWith('image/')) {
          try {
            const converted = await convertImageToWebp(file)
            if (converted) {
              fileToUpload = converted
              setUploadStatus('✅ WebP 转换完成，开始上传...')
            }
          } catch (e) {
            console.log('⚠️ WebP 转换失败，使用原图:', e.message)
          }
        }
        
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/upload')

        const startTime = Date.now()

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(progress)
            setUploadStatus(`上传中 ${progress}%`)
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
              const result = JSON.parse(xhr.responseText)
              setUploadStatus('✅ 上传完成')
              setUploadProgress(100)
              resolve(result)
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

        xhr.onerror = () => {
          setUploadStatus('❌ 网络错误')
          reject(new Error('网络错误'))
        }
        xhr.ontimeout = () => {
          setUploadStatus('❌ 上传超时')
          reject(new Error('上传超时'))
        }
        xhr.timeout = 300000

        const fd = new FormData()
        fd.append('file', fileToUpload)
        fd.append('folder', folder)
        fd.append('storage', storage)
        fd.append('compressQuality', compressQuality)
        fd.append('serverCompress', serverCompress ? 'true' : 'false')
        
        xhr.send(fd)
      }
      
      processFile()
    })
  }

  // ============================================================
  // 处理文件
  // ============================================================
  const handleFiles = async (files) => {
    if (!files || files.length === 0) return

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    const results = []

    for (const file of fileArray) {
      if (!file) continue

      try {
        const ext = file.name.split('.').pop().toLowerCase()
        const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
        const videoExts = ['mp4', 'webm', 'avi', 'mov', 'mkv']
        const isAudio = audioExts.includes(ext)
        const isVideo = videoExts.includes(ext)
        
        let actualStorage = storageType
        if (isAudio || isVideo) {
          actualStorage = 'telegram'
        }

        const needChunk = actualStorage === 'telegram' && (file.size > 16 * 1024 * 1024 || isAudio || isVideo)

        let url
        if (needChunk) {
          if (file.size > 500 * 1024 * 1024) {
            throw new Error('文件超过 500MB，暂不支持')
          }
          console.log(`📦 ${isAudio ? '音频' : isVideo ? '视频' : '大文件'} (${(file.size / 1024 / 1024).toFixed(1)}MB)，使用分片上传`)
          url = await uploadLargeFile(file, folder)
        } else {
          if (actualStorage === 'telegram' && file.size > 50 * 1024 * 1024) {
            throw new Error('Telegram 直接上传限制 50MB')
          }
          if (actualStorage !== 'telegram' && file.size > 25 * 1024 * 1024) {
            throw new Error(`${actualStorage === 'github' ? 'GitHub' : 'R2'} 限制 25MB，请切换到 Telegram`)
          }
          
          setIsNormalUploading(true)
          setUploadStatus('准备上传...')
          setUploadProgress(0)
          
          const result = await uploadNormalFile(file, folder, actualStorage)
          if (!result.success) {
            throw new Error(result.error || '上传失败')
          }
          url = result.url
          setIsNormalUploading(false)
        }

        results.push({
          success: true,
          filename: file.name,
          url: url,
          folder: folder,
          storage: actualStorage
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
    setIsNormalUploading(false)
    
    setTimeout(() => {
      if (!uploadStatus.includes('❌')) {
        setUploadStatus('')
        setUploadProgress(0)
        setUploadSpeed('')
      }
    }, 3000)

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
  const isUploading = isLoading || isChunkUploading || isNormalUploading

  return (
    <div className="mb-4">
      {/* ============================================================
      顶部工具栏
      ============================================================ */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-green-500 text-sm flex items-center gap-1">
          <i className="fas fa-upload text-orange-600 text-sm"></i>
          上传文件
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={refreshBackground}
            className={`text-xs transition flex items-center gap-1 px-2 py-1 rounded-lg ${bgRefresh ? 'bg-green-700 text-white shadow-md' : 'bg-green-500 text-white hover:bg-green-400'}`}
            title="换一张背景"
          >
            <i className="fas fa-sync-alt text-xs"></i>
          </button>

          {/* ==================== 存储渠道下拉 ==================== */}
          <div className="relative">
            <button
              onClick={() => setStorageOpen(!storageOpen)}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 hover:bg-white/30 transition flex items-center gap-2 text-sm min-w-[120px] justify-between"
            >
              <span className="flex items-center gap-2">
                <i className={`${storageOptions.find(o => o.value === storageType)?.icon} w-4 text-center`}></i>
                <span>{storageOptions.find(o => o.value === storageType)?.label}</span>
              </span>
              <i className="fas fa-chevron-down text-xs text-white/50"></i>
            </button>
            {storageOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-lg border border-white/30 overflow-hidden z-50 min-w-[160px]">
                {storageOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStorageType(opt.value); setStorageOpen(false); }}
                    className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-500/10 transition text-gray-700 dark:text-gray-300 ${
                      storageType === opt.value ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    <i className={`${opt.icon} w-5 text-center`}></i>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ==================== 文件夹下拉 ==================== */}
          <div className="relative">
            <button
              onClick={() => setFolderOpen(!folderOpen)}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 hover:bg-white/30 transition flex items-center gap-2 text-sm min-w-[110px] justify-between"
            >
              <span className="flex items-center gap-2">
                <i className={`fas fa-folder ${folderOptions.find(o => o.key === folder)?.color || ''} w-4 text-center`}></i>
                <span>{folderOptions.find(o => o.key === folder)?.label}</span>
              </span>
              <i className="fas fa-chevron-down text-xs text-white/50"></i>
            </button>
            {folderOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-lg shadow-lg border border-white/30 overflow-hidden z-50 min-w-[160px]">
                {folderOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setFolder(opt.key); setFolderOpen(false); }}
                    className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-500/10 transition text-gray-700 dark:text-gray-300 ${
                      folder === opt.key ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    <i className={`fas fa-folder ${opt.color || ''} w-5 text-center`}></i>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onConvertChange?.(!convertToWebp)}
            className={`text-xs px-2 py-1 rounded-lg transition flex items-center gap-1 ${
              convertToWebp 
                ? 'bg-green-500/80 text-white' 
                : 'bg-white/20 text-white/60 hover:bg-white/30'
            }`}
            title={convertToWebp ? 'WebP已开启' : '转换为WebP'}
          >
            <i className="fas fa-file-image text-xs"></i>
            {convertToWebp && <span className="text-[10px]">WebP</span>}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="text-xs px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white/70 hover:text-white transition"
            title="上传设置"
          >
            <i className="fas fa-cog text-xs"></i>
          </button>
        </div>
      </div>

      {/* ============================================================
      上传卡片
      ============================================================ */}
      <div
        className="relative upload-card-wrapper group"
        onMouseMove={handleCardMouseMove}
        onMouseLeave={handleCardMouseLeave}
      >
        <div
          ref={glowRef}
          className="upload-card-glow"
          style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
            zIndex: 10
          }}
        />

        <div
          className={`upload-card relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
            ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-white/30 hover:border-blue-400/50'}
            ${isUploading ? 'is-uploading' : ''}
          `}
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 20px'
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {isUploading && (
            <div className="uploading-border" style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: '16px',
              padding: '2px',
              background: 'conic-gradient(from var(--border-angle), transparent 0deg, transparent 30deg, #409eff 60deg, rgba(64, 158, 255, 0.7) 90deg, transparent 120deg, transparent 180deg, rgba(64, 158, 255, 0.7) 210deg, #409eff 240deg, transparent 270deg, transparent 360deg)',
              animation: 'borderRotate 2s linear infinite',
              pointerEvents: 'none',
              zIndex: 1,
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude'
            }} />
          )}

          <div className="mb-4 relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mx-auto">
              <i className="fas fa-cloud-upload-alt text-5xl text-blue-400/70"></i>
            </div>
          </div>

          <p className="text-white/80 text-lg font-medium mb-1 relative z-10">
            {isUploading ? '上传中...' : '点击或拖拽文件到此处上传'}
          </p>
          <p className="text-white/40 text-sm relative z-10">
            {isUploading ? uploadStatus : '支持图片、音频、视频'}
          </p>
          {!isUploading && (
            <p className="text-white/25 text-xs mt-2 relative z-10">
              也可直接 Ctrl+V 粘贴截图上传
            </p>
          )}

          {isUploading && (
            <div className="mt-4 w-full max-w-xs relative z-10">
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>{uploadStatus || '上传中...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 星空背景 */}
          <div className="stars-layer absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-0">
            <div className="stars-1 absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(2px 2px at 10% 10%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 30% 10%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 40% 30%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 50% 10%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 60% 30%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 70% 10%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 80% 30%, rgba(255,255,255,0.3) 50%, transparent 0),
                radial-gradient(2px 2px at 90% 10%, rgba(255,255,255,0.3) 50%, transparent 0)
              `,
              backgroundSize: '200px 200px',
              opacity: 0.3,
              animation: 'starScroll 60s linear infinite'
            }} />
            <div className="stars-2 absolute inset-0" style={{
              backgroundImage: `
                radial-gradient(3px 3px at 15% 15%, rgba(255,255,255,0.5) 50%, transparent 0),
                radial-gradient(3px 3px at 50% 50%, rgba(255,255,255,0.5) 50%, transparent 0),
                radial-gradient(3px 3px at 85% 85%, rgba(255,255,255,0.5) 50%, transparent 0),
                radial-gradient(2.5px 2.5px at 35% 65%, rgba(255,255,255,0.5) 50%, transparent 0),
                radial-gradient(2.5px 2.5px at 65% 35%, rgba(255,255,255,0.5) 50%, transparent 0)
              `,
              backgroundSize: '150px 150px',
              opacity: 0.5,
              animation: 'starScroll 40s linear infinite, starPulse 4s ease-in-out infinite'
            }} />
          </div>
        </div>
      </div>

      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,audio/mpeg,audio/wav,audio/ogg,video/mp4" 
        multiple 
        className="hidden" 
        onChange={handleFileSelect} 
      />

      {/* ============================================================
      设置弹窗
      ============================================================ */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">上传设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">文件命名方式</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'default', label: '默认', icon: 'fa-cog' },
                  { value: 'origin', label: '原始名称', icon: 'fa-file-signature' },
                  { value: 'short', label: '短名称', icon: 'fa-compress-alt' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setUploadNameType(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 justify-center transition ${
                      uploadNameType === opt.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <i className={`fas ${opt.icon}`}></i> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">客户端压缩</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={serverCompress} onChange={() => setServerCompress(!serverCompress)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-blue-500 transition"></div>
                </label>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">压缩阈值: {compressBar}MB</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={compressBar}
                    onChange={(e) => setCompressBar(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">目标大小: {compressQuality}MB</label>
                  <input
                    type="range"
                    min="0.5"
                    max={compressBar}
                    step="0.5"
                    value={compressQuality}
                    onChange={(e) => setCompressQuality(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">失败自动重试</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={autoRetry} onChange={() => setAutoRetry(!autoRetry)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-blue-500 transition"></div>
              </label>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
      全局动画样式
      ============================================================ */}
      <style>{`
        @property --border-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes borderRotate {
          0% { --border-angle: 0deg; }
          100% { --border-angle: 360deg; }
        }
        @keyframes starScroll {
          from { background-position: 0 0; }
          to { background-position: 100px 100px; }
        }
        @keyframes starPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
