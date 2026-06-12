import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import StatsCard from './components/StatsCard'
import ApiSection from './components/ApiSection'
import UploadArea from './components/UploadArea'
import UploadResult from './components/UploadResult'
import Footer from './components/Footer'
import { fetchStats, uploadImage } from './lib/api'

function App() {
  const [stats, setStats] = useState({ grand_total: 0, github_folders: { wallpaper: 0, cover: 0 }, external_total: 0 })
  const [uploadResults, setUploadResults] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [convertToWebp, setConvertToWebp] = useState(false)  // 🆕 是否转换为 WebP

  // 设置随机背景
  const setRandomBackground = useCallback(() => {
    const img = new Image()
    const url = `/api/random?t=${Date.now()}`
    img.onload = () => {
      document.body.style.backgroundImage = `url(${url})`
    }
    img.src = url
  }, [])

  useEffect(() => {
    loadStats()
    setRandomBackground()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [setRandomBackground])

  const loadStats = async () => {
    try {
      const data = await fetchStats()
      setStats(data)
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  const compressImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          let quality = 0.85
          let dataUrl = canvas.toDataURL('image/jpeg', quality)
          let size = dataURLToBlob(dataUrl).size
          while (size > 3 * 1024 * 1024 && quality > 0.6) {
            quality -= 0.05
            dataUrl = canvas.toDataURL('image/jpeg', quality)
            size = dataURLToBlob(dataUrl).size
          }
          const name = file.name.replace(/\.[^/.]+$/, '')
          const compressed = new File([dataURLToBlob(dataUrl)], `${name}.jpg`, { type: 'image/jpeg' })
          resolve(compressed)
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }, [])

  // 🆕 将图片转换为 WebP 格式
  const convertToWebP = useCallback((file, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('转换失败'))
                return
              }
              const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
              })
              resolve(webpFile)
            },
            'image/webp',
            quality
          )
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }, [])

  const dataURLToBlob = (dataURL) => {
    const arr = dataURL.split(',')
    const bstr = atob(arr[1])
    const u8arr = new Uint8Array(bstr.length)
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
    return new Blob([u8arr], { type: 'image/jpeg' })
  }

  const handleUpload = async (files, folder) => {
    setIsUploading(true)
    setUploadResults([])
    
    const results = []
    const fileArray = Array.from(files)
    
    for (let i = 0; i < fileArray.length; i++) {
      let file = fileArray[i]
      const ext = file.name.split('.').pop().toLowerCase()
      
      if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
        results.push({ success: false, filename: file.name, error: '格式不支持', folder })
        continue
      }
      
      // 🆕 如果用户选择了转换为 WebP，且不是 gif/avif（这些格式不建议转）
      if (convertToWebp && !['gif', 'avif'].includes(ext)) {
        try {
          file = await convertToWebP(file)
          console.log(`✅ 已转换 ${file.name} 为 WebP`)
        } catch (err) {
          console.error('WebP 转换失败:', err)
          // 转换失败就继续用原文件
        }
      }
      
      // 大图压缩（WebP 不再重复压缩）
      if (file.size > 3 * 1024 * 1024 && file.type !== 'image/webp') {
        try {
          file = await compressImage(file)
        } catch (e) {
          // 压缩失败，继续使用原图
        }
      }
      
      let retry = 3
      let uploaded = false
      
      while (retry > 0 && !uploaded) {
        try {
          const data = await uploadImage(file, folder)
          if (data.success) {
            results.push({ success: true, filename: data.filename, url: data.url, folder })
            uploaded = true
          } else {
            throw new Error(data.error || '上传失败')
          }
        } catch (err) {
          retry--
          if (retry === 0) {
            results.push({ success: false, filename: file.name, error: err.message, folder })
          } else {
            await new Promise(r => setTimeout(r, 1000))
          }
        }
      }
      
      setUploadResults([...results])
      if (i < fileArray.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    
    setIsUploading(false)
    loadStats()
  }

  return (
    <div className="min-h-screen py-6 px-4 relative">
      {/* 左上角 LOGO */}
      <a 
        href="https://github.com/chnbsdan/imgbed" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed top-1 left-1 z-50"
        title="GitHub 仓库"
      >
        <img src="/favicon.ico" alt="Logo" className="w-12 h-12 hover:opacity-80 transition-opacity" />
      </a>

      <div className="max-w-4xl mx-auto">
        <Header />
        
        {/* 卡片区域 - 毛玻璃效果 */}
        <div className="space-y-4 backdrop-blur-md bg-white/5 rounded-xl p-4 shadow-xl border border-white/30">
          <StatsCard stats={stats} />
          <ApiSection />
          <UploadArea 
            onUpload={handleUpload} 
            isLoading={isUploading} 
            onRefreshBg={setRandomBackground}
            convertToWebp={convertToWebp}           // 🆕 传递状态
            onConvertChange={setConvertToWebp}      // 🆕 传递修改函数
          />
          <UploadResult results={uploadResults} />
        </div>
        
        <Footer />
      </div>
    </div>
  )
}

export default App
