import React, { useState, useEffect } from 'react'
import { copyToClipboard } from '../lib/api'

export default function UploadResult({ results }) {
  const [copied, setCopied] = useState(null)

  // 添加调试日志
  useEffect(() => {
    console.log('=== UploadResult 组件渲染 ===')
    console.log('接收到的 results 长度:', results.length)
    if (results.length > 0) {
      console.log('结果详情:', results.map(r => ({ filename: r.filename, success: r.success })))
    }
  }, [results])

  const handleCopy = (url, id) => {
    copyToClipboard(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handlePreview = (url, id) => {
    const container = document.getElementById(`preview-${id}`)
    if (!container) return
    
    container.innerHTML = '<div class="text-xs text-gray-400 flex items-center gap-1"><div class="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div> 加载中...</div>'
    
    const img = new Image()
    img.onload = () => {
      container.innerHTML = ''
      container.appendChild(img)
      img.className = 'max-w-full max-h-24 rounded-lg mt-2'
    }
    img.onerror = () => {
      container.innerHTML = '<span class="text-xs text-red-500">加载失败</span>'
    }
    img.src = url + '?t=' + Date.now()
  }

  if (results.length === 0) return null

  return (
    <div className="space-y-3 mt-4 animate-slide-up">
      <h4 className="text-sm font-medium text-green-500">上传结果 ({results.length})</h4>
      {results.map((result, idx) => (
        <div 
          key={`${idx}-${result.filename}`}
          className={`rounded-xl p-3 ${result.success ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {result.success ? '✓' : '✗'} {result.filename}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{result.folder === 'wallpaper' ? '横屏' : '竖屏'}</span>
              </div>
              {result.success && result.url && (
                <>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded flex-1 truncate text-gray-700 dark:text-gray-300">{result.url}</code>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopy(result.url, `url-${idx}`)
                      }}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                      {copied === `url-${idx}` ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-copy text-gray-400"></i>}
                    </button>
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-external-link-alt text-gray-400"></i>
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePreview(result.url, idx)
                      }}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                    >
                      <i className="fas fa-eye text-gray-400"></i>
                    </button>
                  </div>
                  <div id={`preview-${idx}`} className="mt-2"></div>
                </>
              )}
              {!result.success && <p className="text-xs text-red-500 mt-1">{result.error}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
