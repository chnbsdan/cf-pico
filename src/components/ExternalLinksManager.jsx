// src/components/ExternalLinksManager.jsx - 外部图源管理
import React, { useState, useEffect } from 'react'

export default function ExternalLinksManager() {
  const [links, setLinks] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeFolder, setActiveFolder] = useState('wallpaper')
  const [newUrls, setNewUrls] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const folders = [
    { key: 'wallpaper', label: '横屏图片 (wallpaper)' },
    { key: 'cover', label: '竖屏图片 (cover)' },
    { key: 'sh', label: '横屏图片 (sh)' },
    { key: 'sd', label: '竖屏图片 (sd)' }
  ]

  const loadExternalLinks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/external')
      const data = await res.json()
      if (data.error) {
        console.error('加载失败:', data.error)
        setLinks({ wallpaper: [], cover: [], sh: [], sd: [] })
      } else {
        setLinks(data)
      }
    } catch (err) {
      console.error('加载失败:', err)
      setLinks({ wallpaper: [], cover: [], sh: [], sd: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExternalLinks()
  }, [])

  const handleAddLinks = async () => {
    if (!newUrls.trim()) {
      showMessage('请输入图片链接', 'error')
      return
    }

    const urls = newUrls.split('\n').map(u => u.trim()).filter(u => u)
    const validUrls = urls.filter(u => u.startsWith('http'))
    
    if (validUrls.length === 0) {
      showMessage('没有有效的链接（需以 http 开头）', 'error')
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: validUrls,
          folder: activeFolder
        })
      })
      const data = await res.json()
      if (data.success) {
        showMessage(`✅ 成功添加 ${data.added} 条外链`, 'success')
        setNewUrls('')
        loadExternalLinks()
      } else {
        showMessage('❌ 添加失败: ' + (data.error || '未知错误'), 'error')
      }
    } catch (err) {
      showMessage('❌ 请求失败: ' + err.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteLink = async (url) => {
    if (!confirm(`确定要删除这条外链吗？\n\n${url}`)) return
    
    setDeleting(url)
    try {
      const res = await fetch('/api/external', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          folder: activeFolder
        })
      })
      const data = await res.json()
      if (data.success) {
        showMessage('✅ 删除成功', 'success')
        loadExternalLinks()
      } else {
        showMessage('❌ 删除失败: ' + (data.error || '未知错误'), 'error')
      }
    } catch (err) {
      showMessage('❌ 请求失败: ' + err.message, 'error')
    } finally {
      setDeleting(null)
    }
  }

  const showMessage = (text, type) => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const currentLinks = links[activeFolder] || []

  return (
    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/30 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          <i className="fas fa-link text-blue-500 mr-2"></i>
          自定义外链图片
        </h3>
        <button
          onClick={loadExternalLinks}
          className="text-sm text-blue-500 hover:text-blue-600 transition"
        >
          <i className="fas fa-sync-alt mr-1"></i>刷新
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${
          messageType === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* 分类切换 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {folders.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFolder(f.key)}
            className={`px-4 py-2 rounded-xl text-sm transition ${
              activeFolder === f.key
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/70'
            }`}
          >
            {f.label} <span className="ml-1 text-xs opacity-70">({currentLinks.length})</span>
          </button>
        ))}
      </div>

      {/* 添加外链 */}
      <div className="mb-4 p-4 bg-white/50 dark:bg-gray-700/50 rounded-xl border border-white/30 dark:border-gray-600">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          添加外链（每行一个）
        </label>
        <textarea
          value={newUrls}
          onChange={(e) => setNewUrls(e.target.value)}
          placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.png"
          className="w-full px-4 py-3 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-y min-h-[80px]"
        />
        <button
          onClick={handleAddLinks}
          disabled={adding}
          className="mt-3 px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm transition disabled:opacity-50"
        >
          {adding ? '添加中...' : '添加外链'}
        </button>
      </div>

      {/* 外链列表 */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : currentLinks.length === 0 ? (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <i className="fas fa-inbox text-4xl mb-2 block"></i>
          <p>暂无外链图片</p>
          <p className="text-xs mt-1">在上方添加外部图片链接</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {currentLinks.map((url, idx) => {
            const name = url.split('/').pop() || `image_${idx}`
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-700/50 rounded-xl border border-white/30 dark:border-gray-600 hover:border-blue-400 transition group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    src={url}
                    alt={name}
                    className="w-12 h-12 rounded-lg object-cover bg-gray-200 dark:bg-gray-800 flex-shrink-0"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23eee" width="100" height="100"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="%23aaa" font-size="30"%3E🖼%3C/text%3E%3C/svg%3E'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={url}>
                      {name}
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 truncate block"
                      title={url}
                    >
                      {url}
                    </a>
                  </div>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => window.open(url, '_blank')}
                    className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600/50 transition text-gray-400 hover:text-blue-500"
                    title="打开"
                  >
                    <i className="fas fa-external-link-alt text-xs"></i>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url)
                      showMessage('📋 已复制链接', 'success')
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600/50 transition text-gray-400 hover:text-green-500"
                    title="复制链接"
                  >
                    <i className="fas fa-copy text-xs"></i>
                  </button>
                  <button
                    onClick={() => handleDeleteLink(url)}
                    disabled={deleting === url}
                    className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-600/50 transition text-gray-400 hover:text-red-500 disabled:opacity-30"
                    title="删除"
                  >
                    {deleting === url ? (
                      <i className="fas fa-spinner fa-pulse text-xs"></i>
                    ) : (
                      <i className="fas fa-trash-alt text-xs"></i>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
