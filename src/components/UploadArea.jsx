import React, { useRef, useState, useEffect, useCallback } from 'react'
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
  const [isNormalUploading, setIsNormalUploading] = useState(false)
  const fileInputRef = useRef(null)

  // ✅ 新增：上传队列控制
  const [uploadQueue, setUploadQueue] = useState([])
  const [activeUploads, setActiveUploads] = useState(0)
  const maxConcurrentUploads = 3
  const abortControllers = useRef(new Map())

  // ✅ 新增：设置状态
  const [showSettings, setShowSettings] = useState(false)
  const [compressQuality, setCompressQuality] = useState(4)
  const [compressBar, setCompressBar] = useState(5)
  const [serverCompress, setServerCompress] = useState(true)
  const [autoRetry, setAutoRetry] = useState(true)
  const [uploadNameType, setUploadNameType] = useState('default')

  // ✅ 新增：WebP 转换独立函数
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

  const CHUNK_SIZE = 16 * 1024 * 1024

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

  // ✅ 新增：处理上传队列
  const processUploadQueue = useCallback(() => {
    if (uploadQueue.length === 0 || activeUploads >= maxConcurrentUploads) {
      return
    }
    const nextFile = uploadQueue.shift()
    if (nextFile) {
      setUploadQueue([...uploadQueue])
      // 实际上传由调用方触发
    }
  }, [uploadQueue, activeUploads])

  // ✅ 新增：分片上传带重试（指数退避）
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
        const delay = 2000 * attempt // 指数退避：2s, 4s, 6s
        await new Promise(r => setTimeout(r, delay))
        setUploadStatus(`重试分片 ${chunkIndex + 1} (${attempt}/${maxRetries})...`)
      }
    }
    throw new Error(`分片 ${chunkIndex + 1} 上传失败: ${lastError}`)
  }

  // ✅ 增强版大文件上传（带队列控制）
  const uploadLargeFile = async (file, folder) => {
    // 并发控制
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
        // 检查是否被取消
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
      
      // ✅ 自动重试
      if (autoRetry && error.message !== '上传已取消') {
        setUploadStatus(`⚠️ 上传失败，${autoRetry ? '自动重试中...' : '请手动重试'}`)
        await new Promise(r => setTimeout(r, 3000))
        // 重试逻辑：重新调用自身
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

  // ✅ 增强版普通上传（支持 WebP 转换 + 压缩）
  const uploadNormalFile = async (file, folder, storage) => {
    return new Promise((resolve, reject) => {
      const processFile = async () => {
        let fileToUpload = file
        
        // 1. WebP 转换
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
        
        // 2. 客户端压缩（如果启用且文件超过阈值）
        if (storage === 'telegram' && fileToUpload.size / 1024 / 1024 > compressBar) {
          try {
            const imageConversion = await import('image-conversion')
            const compressed = await imageConversion.compressAccurately(
              fileToUpload, 
              1024 * compressQuality
            )
            if (compressed && compressed.size < fileToUpload.size) {
              const newFile = new File([compressed], fileToUpload.name, { type: compressed.type })
              fileToUpload = newFile
              setUploadStatus(`✅ 压缩完成 (${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB)`)
            }
          } catch (e) {
            console.log('⚠️ 压缩失败，使用原图:', e.message)
          }
        }
        
        // 发送请求
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

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    const results = []

    for (const file of fileArray) {
      if (!file) continue

      try {
        // 检测文件类型
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
          if (actualStorage !== 'telegram' && file.size > 10 * 1024 * 1024) {
            throw new Error(`${actualStorage === 'github' ? 'GitHub' : 'R2'} 限制 10MB，请切换到 Telegram`)
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
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-green-500 text-sm flex items-center gap-1">
          <i className="fas fa-upload text-orange-600 text-sm"></i>
          上传文件
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
          {/* ✅ 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
          >
            <i className="fas fa-cog text-xs"></i>
          </button>
        </div>
      </div>

      <div className="flex justify-center items-center mb-4">
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex-wrap justify-center">
          <span className="text-white/70 text-sm"><i className="fas fa-database mr-1"></i>存储方式：</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="github" checked={storageType === 'github'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-blue-500" />
            <span className="text-white/80 text-sm"><i className="fab fa-github mr-1"></i>GitHub</span>
            <span className="text-white/30 text-[10px]">(仅图片)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="r2" checked={storageType === 'r2'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-orange-500" />
            <span className="text-white/80 text-sm"><i className="fas fa-cloud-upload-alt mr-1"></i>R2</span>
            <span className="text-white/30 text-[10px]">(仅图片)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="storageType" value="telegram" checked={storageType === 'telegram'} onChange={(e) => setStorageType(e.target.value)} className="w-3.5 h-3.5 accent-green-500" />
            <span className="text-white/80 text-sm"><i className="fab fa-telegram-plane mr-1"></i>Telegram</span>
            <span className="text-white/30 text-[10px]">(支持所有文件)</span>
          </label>
        </div>
      </div>

      <div className="flex justify-center items-center mb-4">
        <label className="flex items-center gap-2 cursor-pointer group" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={convertToWebp || false} onChange={(e) => onConvertChange?.(e.target.checked)} className="w-4 h-4 rounded border-gray-300 bg-white/80 checked:bg-blue-500 checked:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer" />
          <span className="text-white/80 text-sm group-hover:text-white/100 transition"><i className="fas fa-file-image mr-1"></i>自动转换为 WebP 格式</span>
          <span className="text-white/40 text-xs hidden sm:inline">(前端转换)</span>
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
        <p className="text-gray-600 dark:text-gray-300 text-base mb-2">点击或拖拽文件到此处上传</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">支持图片、音频、视频 | 媒体文件自动走 Telegram</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1"><i className="fas fa-paste mr-1"></i>也可直接 Ctrl+V 粘贴截图上传</p>

        <p className="text-xs mt-2 flex items-center justify-center gap-1 flex-wrap">
          {storageType === 'github' ? (
            <span className="text-blue-400"><i className="fab fa-github mr-1"></i>存储到 GitHub（仅图片）</span>
          ) : storageType === 'r2' ? (
            <span className="text-orange-400"><i className="fas fa-cloud-upload-alt mr-1"></i>存储到 R2（仅图片）</span>
          ) : (
            <span className="text-green-400"><i className="fab fa-telegram-plane mr-1"></i>存储到 Telegram（支持所有文件）</span>
          )}
        </p>

        {isUploading && (
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
            <div className="flex justify-between items-center text-sm text-gray-800 dark:text-white/80 mb-2">
              <span>{uploadStatus || '上传中...'}</span>
              <div className="flex items-center gap-3">
                {uploadSpeed && <span className="text-xs text-green-600 dark:text-green-400">{uploadSpeed}</span>}
                <span className="font-mono text-gray-800 dark:text-white">{uploadProgress}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-300 dark:bg-gray-700/50 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${Math.max(uploadProgress, 0)}%` }}
              ></div>
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

      {/* ✅ 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">上传设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* 文件命名 */}
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

            {/* 压缩设置 */}
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

            {/* 自动重试 */}
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
    </div>
  )
}
