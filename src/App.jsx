// ============================================================
// src/App.jsx - 主应用组件
// 功能：登录验证、路由控制、图片上传、统计信息展示
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import StatsCard from './components/StatsCard'
import ApiSection from './components/ApiSection'
import UploadArea from './components/UploadArea'
import UploadResult from './components/UploadResult'
import Footer from './components/Footer'
import { fetchStats, uploadImage, addHistoryRecord } from './lib/api'
import Manage from './pages/Manage'
import ApiDocs from './pages/ApiDocs'
import ThemeToggle from './components/ThemeToggle'

function App() {
  // ============================================================
  // 所有 Hooks 在组件最顶层
  // ============================================================

  // ---------- 登录状态 ----------
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)
  const [loginBgImage, setLoginBgImage] = useState('')
  const [bgLoaded, setBgLoaded] = useState(false)

  const LOGIN_PASSWORD = import.meta.env.VITE_LOGIN_PASSWORD || 'admin123'

  // ---------- 主界面状态 ----------
  const [stats, setStats] = useState({
    grand_total: 0,
    github_folders: { wallpaper: 0, cover: 0 },
    external_total: 0
  })
  const [uploadResults, setUploadResults] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [convertToWebp, setConvertToWebp] = useState(false)

  // ---------- useEffect ----------
  useEffect(() => {
    const savedAuth = localStorage.getItem('pico_auth')
    if (savedAuth === 'true') {
      setIsLoggedIn(true)
    }
  }, [])

  useEffect(() => {
    if (!bgLoaded) {
      const img = new Image()
      const url = `/api/wallpaper?t=${Date.now()}`
      img.onload = () => {
        setLoginBgImage(`url(${url})`)
        setBgLoaded(true)
      }
      img.onerror = () => {
        setLoginBgImage('linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)')
        setBgLoaded(true)
      }
      img.src = url
    }
  }, [bgLoaded])

  const setRandomBackground = useCallback(() => {
    const img = new Image()
    const url = `/api/wallpaper?t=${Date.now()}`
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

  // ---------- 函数定义 ----------
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

  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError(false)
    setIsLoadingLogin(true)

    setTimeout(() => {
      if (loginPassword === LOGIN_PASSWORD) {
        setIsLoggedIn(true)
        localStorage.setItem('pico_auth', 'true')
        setLoginPassword('')
        setIsLoadingLogin(false)
      } else {
        setLoginError(true)
        setIsLoadingLogin(false)
        setLoginPassword('')
      }
    }, 500)
  }

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      localStorage.removeItem('pico_auth')
      setIsLoggedIn(false)
    }
  }

  const handleUpload = async (files, folder, storage = 'github') => {
    console.log('===== App.jsx handleUpload =====')
    console.log('收到文件数量:', files?.length || 0)
    console.log('存储方式:', storage)

    if (!files || files.length === 0) {
      console.warn('没有文件，跳过上传')
      return []
    }

    setIsUploading(true)
    setUploadResults([])

    const fileArray = Array.isArray(files) ? files : Array.from(files)
    const allResults = []

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      
      if (!file || !file.name) {
        console.warn('file 或 file.name 为空，跳过')
        continue
      }

      const ext = file.name.split('.').pop().toLowerCase()

      if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
        allResults.push({ success: false, filename: file.name, error: '格式不支持', folder })
        setUploadResults([...allResults])
        continue
      }

      let processedFile = file

      if (convertToWebp && !['gif', 'avif'].includes(ext)) {
        try {
          processedFile = await convertToWebP(file)
          console.log(`✅ 已转换 ${file.name} 为 WebP`)
        } catch (err) {
          console.error('WebP 转换失败:', err)
        }
      }

      if (processedFile.size > 5 * 1024 * 1024 && processedFile.type !== 'image/webp') {
        try {
          processedFile = await compressImage(processedFile)
        } catch (e) {}
      }

      let retry = 3
      let uploaded = false

      while (retry > 0 && !uploaded) {
        try {
          const data = await uploadImage(processedFile, folder, storage)

          if (data.success) {
            const proxyUrl = data.url

            allResults.push({
              success: true,
              filename: data.filename,
              url: proxyUrl,
              folder: data.folder,
              storage: data.storage
            })
            setUploadResults([...allResults])

            try {
              await addHistoryRecord(data.filename, proxyUrl, data.folder)
              console.log(`📝 已保存历史记录: ${data.filename}`)
            } catch (err) {
              console.error('保存历史记录失败:', err)
            }

            uploaded = true
          } else {
            throw new Error(data.error || '上传失败')
          }
        } catch (err) {
          retry--
          if (retry === 0) {
            allResults.push({
              success: false,
              filename: file.name,
              error: err.message,
              folder
            })
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

    setIsUploading(false)
    loadStats()

    return allResults
  }

  // ============================================================
  // 路由判断和界面渲染
  // ============================================================

  const isManagePage = typeof window !== 'undefined' && window.location.pathname === '/manage'
  if (isManagePage) {
    return <Manage />
  }

  const isApiDocsPage = typeof window !== 'undefined' && window.location.pathname === '/docs'
  if (isApiDocsPage) {
    return <ApiDocs />
  }

  // ---------- 未登录：显示登录界面 ----------
  if (!isLoggedIn) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundImage: loginBgImage || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          transition: 'background-image 0.5s ease'
        }}
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 w-full max-w-md border border-white/30 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-4">
              <i className="fas fa-cloud-upload-alt text-4xl text-white"></i>
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">CF-Pico</h1>
            <p className="text-white/60 text-sm mt-1">请输入密码进入</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-white/40"></i>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="请输入管理密码"
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                autoFocus
                disabled={isLoadingLogin}
              />
            </div>

            {loginError && (
              <p className="text-red-400 text-sm text-center animate-pulse">
                <i className="fas fa-exclamation-circle mr-1"></i>密码错误，请重试
              </p>
            )}

            <button
              type="submit"
              disabled={isLoadingLogin}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-medium transition-all duration-300 shadow-lg hover:shadow-blue-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoadingLogin ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  验证中...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  进入图床
                </>
              )}
            </button>
          </form>

          <p className="text-white/30 text-xs text-center mt-6">
            Powered by{' '}
            <a
              href="https://github.com/chnbsdan/cf-pico"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white/70 transition"
            >
              chnbsdan
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ---------- 已登录：主界面 ----------
  return (
    <div className="min-h-screen py-6 px-4 relative">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="bg-red-500/80 backdrop-blur-sm hover:bg-red-500 transition px-3 py-2 rounded-lg text-white text-sm flex items-center gap-2"
          title="退出登录"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span className="hidden sm:inline">退出</span>
        </button>
        <a
          href="/manage"
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-gray-1200 dark:text-white text-sm flex items-center gap-2"
          title="管理后台"
        >
          <i className="fas fa-cog"></i>
          <span className="hidden sm:inline">管理</span>
        </a>
        <a
          href="/docs"
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-gray-1200 dark:text-white text-sm flex items-center gap-2"
          title="API 文档"
        >
          <i className="fas fa-book"></i>
          <span className="hidden sm:inline">文档</span>
        </a>
        <ThemeToggle />
      </div>

      <a
        href="https://github.com/chnbsdan/cf-pico"
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
