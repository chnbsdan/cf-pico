import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import StatsCard from './components/StatsCard'
import ApiSection from './components/ApiSection'
import UploadArea from './components/UploadArea'
import UploadResult from './components/UploadResult'
import Footer from './components/Footer'
import { fetchStats, uploadImage } from './lib/api'
import Manage from './pages/Manage'
import ApiDocs from './pages/ApiDocs'
import ThemeToggle from './components/ThemeToggle'

function App() {
  const [stats, setStats] = useState({ grand_total: 0, github_folders: { wallpaper: 0, cover: 0 }, external_total: 0 })
  const [uploadResults, setUploadResults] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [convertToWebp, setConvertToWebp] = useState(false)

  // 路由判断
  const isManagePage = typeof window !== 'undefined' && window.location.pathname === '/manage'
  if (isManagePage) {
    return <Manage />
  }
  
  const isApiDocsPage = typeof window !== 'undefined' && window.location.pathname === '/docs'
  if (isApiDocsPage) {
    return <ApiDocs />
  }

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
          
          let savedQuality = localStorage.getItem('compressQuality')
          let quality = savedQuality ? parseInt(savedQuality) / 100 : 0.85
          
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
                reject(new Error('WebP 转换失败'))
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

  // 批量上传 - 接收所有文件，循环处理，累积结果
  const handleUpload = async (files, folder) => {
    console.log('===== App.jsx handleUpload =====')
    console.log('收到文件数量:', files.length)
    
    setIsUploading(true)
    setUploadResults([])  // 只在开始时清空一次
    
    const fileArray = Array.from(files)
    const allResults = []
    
    for (let i = 0; i < fileArray.length; i++) {
      let file = fileArray[i]
      const ext = file.name.split('.').pop().toLowerCase()
      
      if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
        allResults.push({ success: false, filename: file.name, error: '格式不支持', folder })
        setUploadResults([...allResults])
        continue
      }
      
      if (convertToWebp && !['gif', 'avif'].includes(ext)) {
        try {
          file = await convertToWebP(file)
          console.log(`✅ 已转换 ${file.name} 为 WebP`)
        } catch (err) {
          console.error('WebP 转换失败:', err)
        }
      }
      
      if (file.size > 3 * 1024 * 1024 && file.type !== 'image/webp') {
        try {
          file = await compressImage(file)
        } catch (e) {}
      }
      
      let retry = 3
      let uploaded = false
      
      while (retry > 0 && !uploaded) {
        try {
          const data = await uploadImage(file, folder)
          if (data.success) {
            allResults.push({ success: true, filename: data.filename, url: data.url, folder })
            console.log(`✅ 上传成功: ${data.filename} (${i+1}/${fileArray.length})`)
            setUploadResults([...allResults])
            uploaded = true
          } else {
            throw new Error(data.error || '上传失败')
          }
        } catch (err) {
          retry--
          if (retry === 0) {
            allResults.push({ success: false, filename: file.name, error: err.message, folder })
            setUploadResults([...allResults])
          } else {
            await new Promise(r => setTimeout(r, 1000))
          }
        }
      }
      
      if (i < fileArray.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    
    console.log('===== 上传完成 =====')
    console.log('总共上传了', allResults.length, '张图片')
    console.log('===================')
    
    setIsUploading(false)
    loadStats()
  }

  return (
    <div className="min-h-screen py-6 px-4 relative">
      <ThemeToggle />
      
      <a 
        href="https://github.com/chnbsdan/pcbed" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed top-1 left-1 z-50"
        title="GitHub 仓库"
      >
        <img src="/favicon.ico" alt="Logo" className="w-12 h-12 hover:opacity-80 transition-opacity" />
      </a>

      <div className="max-w-4xl mx-auto">
        <Header />
        
        <div className="space-y-4 backdrop-blur-md bg-white/5 rounded-xl p-4 shadow-xl border border-white/30">
          <StatsCard stats={stats} />
          <ApiSection />
          <UploadArea 
            onUpload={handleUpload} 
            isLoading={isUploading} 
            onRefreshBg={setRandomBackground}
            convertToWebp={convertToWebp}
            onConvertChange={setConvertToWebp}
          />
          <UploadResult results={uploadResults} />
        </div>
        
        <Footer />
      </div>
    </div>
  )
}

export default App
