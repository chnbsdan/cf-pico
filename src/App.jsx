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
  // 第一步：所有 Hooks 必须在组件最顶层调用
  // 不能在 if、循环、嵌套函数中使用 Hook
  // ============================================================

  // ---------- 登录状态 Hooks ----------
  const [isLoggedIn, setIsLoggedIn] = useState(false)           // 是否已登录
  const [loginPassword, setLoginPassword] = useState('')        // 登录密码输入
  const [loginError, setLoginError] = useState(false)           // 登录错误状态
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)   // 登录加载状态

  // 从环境变量读取登录密码，默认 admin123
  const LOGIN_PASSWORD = import.meta.env.VITE_LOGIN_PASSWORD || 'admin123'

  // ---------- 主界面状态 Hooks ----------
  const [stats, setStats] = useState({                          // 统计信息
    grand_total: 0,
    github_folders: { wallpaper: 0, cover: 0 },
    external_total: 0
  })
  const [uploadResults, setUploadResults] = useState([])        // 上传结果列表
  const [isUploading, setIsUploading] = useState(false)         // 是否正在上传
  const [convertToWebp, setConvertToWebp] = useState(false)     // 是否转换 WebP

  // ---------- useEffect Hooks ----------
  /**
   * 检查 localStorage 中是否保存了登录状态
   * 如果已登录，直接进入主界面
   */
  useEffect(() => {
    const savedAuth = localStorage.getItem('pico_auth')
    if (savedAuth === 'true') {
      setIsLoggedIn(true)
    }
  }, [])

  /**
   * 加载统计信息 & 设置随机背景
   * 每 30 秒自动刷新统计
   */
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
    const interval = setInterval(loadStats, 30000) // 30秒刷新统计
    return () => clearInterval(interval)
  }, [setRandomBackground])

  // ---------- 函数定义 ----------
  /**
   * 加载统计信息
   */
  const loadStats = async () => {
    try {
      const data = await fetchStats()
      setStats(data)
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  /**
   * 图片压缩函数 - 超过 5MB 自动压缩
   */
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

          // 如果图片仍然大于 3MB，逐步降低质量
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

  /**
   * WebP 格式转换
   */
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

  /**
   * DataURL 转 Blob
   */
  const dataURLToBlob = (dataURL) => {
    const arr = dataURL.split(',')
    const bstr = atob(arr[1])
    const u8arr = new Uint8Array(bstr.length)
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
    return new Blob([u8arr], { type: 'image/jpeg' })
  }

  /**
   * 登录处理函数
   */
  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError(false)
    setIsLoadingLogin(true)

    // 模拟异步验证（实际是同步验证，加延时让用户看到加载状态）
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

  /**
   * 退出登录
   */
  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      localStorage.removeItem('pico_auth')
      setIsLoggedIn(false)
    }
  }

  /**
   * 处理上传
   */
  const handleUpload = async (files, folder, storage = 'github') => {
    console.log('===== App.jsx handleUpload =====')
    console.log('收到文件数量:', files.length)
    console.log('存储方式:', storage)

    setIsUploading(true)
    setUploadResults([])

    const fileArray = Array.from(files)
    const allResults = []

    for (let i = 0; i < fileArray.length; i++) {
      let file = fileArray[i]
      const ext = file.name.split('.').pop().toLowerCase()

      // 检查文件格式
      if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
        allResults.push({ success: false, filename: file.name, error: '格式不支持', folder })
        setUploadResults([...allResults])
        continue
      }

      // WebP 转换
      if (convertToWebp && !['gif', 'avif'].includes(ext)) {
        try {
          file = await convertToWebP(file)
          console.log(`✅ 已转换 ${file.name} 为 WebP`)
        } catch (err) {
          console.error('WebP 转换失败:', err)
        }
      }

      // 图片压缩（超过 5MB）
      if (file.size > 5 * 1024 * 1024 && file.type !== 'image/webp') {
        try {
          file = await compressImage(file)
        } catch (e) {}
      }

      // 上传重试（最多 3 次）
      let retry = 3
      let uploaded = false

      while (retry > 0 && !uploaded) {
        try {
          const data = await uploadImage(file, folder, storage)

          if (data.success) {
            // ✅ 直接使用后端返回的完整 URL
            const proxyUrl = data.url

            allResults.push({
              success: true,
              filename: data.filename,
              url: proxyUrl,
              folder: data.folder,
              storage: data.storage
            })
            setUploadResults([...allResults])

            // 保存到历史记录
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
  }

  // ============================================================
  // 第二步：路由判断和界面渲染
  // 所有 Hooks 已在上方调用完毕，现在可以安全地使用 if/return
  // ============================================================

  // ---------- 特殊路由判断 ----------
  // 管理后台页面
  const isManagePage = typeof window !== 'undefined' && window.location.pathname === '/manage'
  if (isManagePage) {
    return <Manage />
  }

  // API 文档页面
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
          backgroundImage: 'url(/api/wallpaper?t=' + Date.now() + ')',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 w-full max-w-md border border-white/30 shadow-2xl">
          <div className="text-center mb-8">
            {/* Logo 图标 */}
            <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-4">
              <i className="fas fa-cloud-upload-alt text-4xl text-white"></i>
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">CF-Pico</h1>
            <p className="text-white/60 text-sm mt-1">请输入密码进入</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* 密码输入框 */}
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

            {/* 错误提示 */}
            {loginError && (
              <p className="text-red-400 text-sm text-center animate-pulse">
                <i className="fas fa-exclamation-circle mr-1"></i>密码错误，请重试
              </p>
            )}

            {/* 登录按钮 */}
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

          {/* 底部提示 */}
          <p className="text-white/30 text-xs text-center mt-6">
            <i className="fas fa-shield-alt mr-1"></i>
            默认密码: {LOGIN_PASSWORD}
          </p>
        </div>
      </div>
    )
  }

  // ---------- 已登录：显示主界面 ----------
  return (
    <div className="min-h-screen py-6 px-4 relative">
      {/* ===== 顶部导航栏 ===== */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {/* 退出登录按钮 */}
        <button
          onClick={handleLogout}
          className="bg-red-500/80 backdrop-blur-sm hover:bg-red-500 transition px-3 py-2 rounded-lg text-white text-sm flex items-center gap-2"
          title="退出登录"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span className="hidden sm:inline">退出</span>
        </button>

        {/* 管理后台链接 */}
        <a
          href="/manage"
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-gray-1200 dark:text-white text-sm flex items-center gap-2"
          title="管理后台"
        >
          <i className="fas fa-cog"></i>
          <span className="hidden sm:inline">管理</span>
        </a>

        {/* API 文档链接 */}
        <a
          href="/docs"
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition px-3 py-2 rounded-lg text-gray-1200 dark:text-white text-sm flex items-center gap-2"
          title="API 文档"
        >
          <i className="fas fa-book"></i>
          <span className="hidden sm:inline">文档</span>
        </a>

        {/* 主题切换 */}
        <ThemeToggle />
      </div>

      {/* GitHub 仓库链接 */}
      <a
        href="https://github.com/chnbsdan/cf-pico"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-1 left-1 z-50"
        title="GitHub 仓库"
      >
        <img src="/favicon.ico" alt="Logo" className="w-12 h-12 hover:opacity-80 transition-opacity" />
      </a>

      {/* ===== 主内容 ===== */}
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <Header />

        {/* 内容区（毛玻璃效果） */}
        <div className="space-y-4 backdrop-blur-md bg-white/5 rounded-xl p-4 shadow-xl border border-white/30">
          {/* 统计卡片 */}
          <StatsCard stats={stats} />

          {/* API 说明 */}
          <ApiSection />

          {/* 上传区域 */}
          <UploadArea
            onUpload={handleUpload}
            isLoading={isUploading}
            onRefreshBg={setRandomBackground}
            convertToWebp={convertToWebp}
            onConvertChange={setConvertToWebp}
          />

          {/* 上传结果列表 */}
          <UploadResult results={uploadResults} />
        </div>

        {/* 页脚 */}
        <Footer />
      </div>
    </div>
  )
}

export default App
