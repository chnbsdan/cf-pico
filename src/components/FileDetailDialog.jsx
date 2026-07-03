import React, { useState } from 'react'

export default function FileDetailDialog({ file, visible, onClose, onDelete, onCopy, getFileUrl }) {
  const [copied, setCopied] = useState(false)

  if (!visible || !file) return null

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const url = getFileUrl ? getFileUrl(file) : file.url

  const isImage = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || ''
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg', 'ico'].includes(ext)
  }

  const isAudio = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || ''
    return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)
  }

  const isVideo = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || ''
    return ['mp4', 'webm', 'avi', 'mov', 'mkv', 'm4v'].includes(ext)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{file.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <div className="mb-4 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
            {isImage(file.name) ? (
              <img src={url} alt={file.name} className="max-w-full max-h-[400px] object-contain" />
            ) : isAudio(file.name) ? (
              <div className="w-full p-8 flex flex-col items-center">
                <i className="fas fa-music text-6xl text-blue-400 mb-4"></i>
                <audio controls className="w-full" src={url} />
              </div>
            ) : isVideo(file.name) ? (
              <video controls className="max-w-full max-h-[400px]" src={url} />
            ) : (
              <div className="p-8 flex flex-col items-center">
                <i className="fas fa-file text-6xl text-gray-400 mb-2"></i>
                <span className="text-gray-500 text-sm">无法预览此文件</span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">文件名</span>
              <span className="text-gray-800 dark:text-white font-mono text-xs truncate max-w-[200px]">{file.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">大小</span>
              <span className="text-gray-800 dark:text-white">{formatSize(file.size)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">存储渠道</span>
              <span className="text-gray-800 dark:text-white">
                {file.source === 'github' ? 'GitHub' : file.source === 'r2' ? 'R2' : file.source === 'telegram' ? 'Telegram' : file.source === 'telegram_chunks' ? 'Telegram (分片)' : file.folder}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500 dark:text-gray-400">链接</span>
              <button onClick={handleCopy} className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1">
                {copied ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-copy"></i>}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <code className="text-xs text-gray-500 dark:text-gray-400 break-all">{url}</code>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <a href={url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm transition">
            <i className="fas fa-external-link-alt mr-1"></i> 打开
          </a>
          <button onClick={() => { onDelete?.(file); onClose() }} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm transition">
            <i className="fas fa-trash-alt mr-1"></i> 删除
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm transition">关闭</button>
        </div>
      </div>
    </div>
  )
}
