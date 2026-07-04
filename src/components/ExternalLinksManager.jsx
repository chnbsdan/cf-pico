// src/components/ExternalLinksManager.jsx - 精简版（只保留添加外链功能）
import React, { useState } from 'react'

export default function ExternalLinksManager({ onLinkAdded }) {
  const [newUrls, setNewUrls] = useState('')
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const showMessage = (text, type) => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

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

    // 获取已存在的链接
    let existingUrls = []
    try {
      const res = await fetch('/api/external')
      const data = await res.json()
      const folders = ['wallpaper', 'cover', 'sh', 'sd']
      for (const folder of folders) {
        if (data[folder]) {
          existingUrls = existingUrls.concat(data[folder])
        }
      }
    } catch (err) {
      console.error('获取已有链接失败:', err)
    }

    const existingSet = new Set(existingUrls)
    const newValidUrls = validUrls.filter(url => !existingSet.has(url))
    
    if (newValidUrls.length === 0) {
      showMessage('⚠️ 所有链接已存在，无需重复添加', 'error')
      return
    }

    if (newValidUrls.length < validUrls.length) {
      showMessage(`⚠️ 过滤掉 ${validUrls.length - newValidUrls.length} 个重复链接，新增 ${newValidUrls.length} 个`, 'success')
    }

    setAdding(true)
    try {
      const res = await fetch('/api/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: newValidUrls,
          folder: 'wallpaper'
        })
      })
      const data = await res.json()
      if (data.success) {
        showMessage(`✅ 成功添加 ${data.added} 条外链`, 'success')
        setNewUrls('')
        if (onLinkAdded) onLinkAdded()
      } else {
        showMessage('❌ 添加失败: ' + (data.error || '未知错误'), 'error')
      }
    } catch (err) {
      console.error('添加失败:', err)
      showMessage('❌ 请求失败: ' + err.message, 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/30 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <i className="fas fa-link text-purple-500"></i>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">添加外链图片</h3>
        <span className="text-xs text-gray-400 ml-2">每行一个链接</span>
      </div>

      {message && (
        <div className={`mb-3 p-2 rounded-xl text-sm ${
          messageType === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={newUrls}
          onChange={(e) => setNewUrls(e.target.value)}
          placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.png"
          className="flex-1 px-3 py-2 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none min-h-[60px] text-sm"
          rows={2}
        />
        <button
          onClick={handleAddLinks}
          disabled={adding}
          className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm transition disabled:opacity-50 whitespace-nowrap"
        >
          {adding ? <i className="fas fa-spinner fa-pulse mr-1"></i> : <i className="fas fa-plus mr-1"></i>}
          {adding ? '添加中...' : '添加外链'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        <i className="fas fa-info-circle mr-1"></i>
        支持 jpg, png, webp, gif 等图片格式
      </p>
    </div>
  )
}
