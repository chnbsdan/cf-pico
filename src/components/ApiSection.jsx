import React, { useState } from 'react'
import { copyToClipboard } from '../lib/api'

const apis = [
  { id: 'random', label: '随机图片接口', emoji: '🎲', path: '/api/random' },
  { id: 'wallpaper', label: '横屏图片接口', emoji: '📐', path: '/api/wallpaper' },
  { id: 'cover', label: '竖屏图片接口', emoji: '📱', path: '/api/cover' },
  { id: 'json', label: 'JSON 接口', emoji: '📋', path: '/api/json' },
]

export default function ApiSection() {
  const [copied, setCopied] = useState(null)

  const handleCopy = (text, id) => {
    copyToClipboard(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="card p-5 mb-6 animate-slide-up">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span className="text-lg">🔌</span>
        API 接口
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {apis.map((api) => {
          const url = `${baseUrl}${api.path}`
          return (
            <div key={api.id} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{api.emoji}</span>
                <span className="text-sm font-medium text-gray-700">{api.label}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs bg-white px-2 py-1 rounded flex-1 truncate">{url}</code>
                <button
                  onClick={() => handleCopy(url, api.id)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition"
                >
                  {copied === api.id ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-gray-400">📋</span>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
