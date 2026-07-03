import React, { useState } from 'react'

export default function FileCard({ file, selected, onSelect, onClick, onPreview, onDetail, onCopy, onDelete, getFileUrl }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() || ''
    const iconMap = {
      'mp3': 'fa-music', 'wav': 'fa-music', 'mp4': 'fa-video',
      'webm': 'fa-video', 'jpg': 'fa-image', 'jpeg': 'fa-image',
      'png': 'fa-image', 'webp': 'fa-image', 'gif': 'fa-image',
      'pdf': 'fa-file-pdf', 'zip': 'fa-file-archive',
      'doc': 'fa-file-word', 'docx': 'fa-file-word'
    }
    return iconMap[ext] || 'fa-file'
  }

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

  const url = getFileUrl ? getFileUrl(file) : file.url

  const handleCardClick = () => {
    if (onPreview) {
      onPreview(file)
    } else if (onClick) {
      onClick()
    }
  }

  const handleDetailClick = (e) => {
    e.stopPropagation()
    if (onDetail) {
      onDetail(file)
    }
  }

  // 获取存储渠道图标
  const getSourceIcon = (source) => {
    const map = {
      'github': '📦',
      'r2': '☁️',
      'telegram': '✈️',
      'telegram_chunks': '✈️',
      'huggingface': '🤗',
      'external': '🔗'
    }
    return map[source] || ''
  }

  return (
    <div 
      className={`group relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-xl hover:scale-[1.02] ${
        selected 
          ? 'border-blue-500 ring-2 ring-blue-500/50' 
          : 'border-white/30 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
      }`}
      onClick={handleCardClick}
    >
      <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="w-4 h-4 rounded border-gray-300 bg-white/80 checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
        />
      </div>

      <div className="aspect-square bg-gray-100/50 dark:bg-gray-900/50 overflow-hidden relative">
        {isImage(file.name) ? (
          <>
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={url}
              alt={file.name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              } group-hover:scale-110 transition-transform duration-300`}
              onLoad={() => setImageLoaded(true)}
              onError={() => { setImageError(true); setImageLoaded(true) }}
            />
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                <i className={`fas ${getIcon(file.name)} text-4xl text-gray-400`}></i>
              </div>
            )}
          </>
        ) : isAudio(file.name) ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900 p-4">
            <i className="fas fa-music text-5xl text-blue-400 mb-2"></i>
            <audio controls className="w-full max-w-[80%] scale-75 origin-center" src={url} />
          </div>
        ) : isVideo(file.name) ? (
          <video className="w-full h-full object-cover" src={url} muted preload="metadata" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
            <i className={`fas ${getIcon(file.name)} text-5xl text-gray-400`}></i>
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onCopy?.(url) }} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition text-white" title="复制链接">
            <i className="fas fa-copy text-sm"></i>
          </button>
          <button onClick={(e) => { e.stopPropagation(); window.open(url, '_blank') }} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition text-white" title="打开">
            <i className="fas fa-external-link-alt text-sm"></i>
          </button>
          <button onClick={handleDetailClick} className="p-2 rounded-full bg-blue-500/50 hover:bg-blue-500/80 transition text-white" title="详情">
            <i className="fas fa-info-circle text-sm"></i>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(file) }} className="p-2 rounded-full bg-red-500/50 hover:bg-red-500/80 transition text-white" title="删除">
            <i className="fas fa-trash-alt text-sm"></i>
          </button>
        </div>
      </div>

      <div className="p-2">
        <p className="text-gray-700 dark:text-gray-300 text-xs truncate" title={file.name}>{file.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400">{formatSize(file.size)}</span>
          <span className="text-[10px] text-gray-400">{getSourceIcon(file.source)}</span>
        </div>
      </div>
    </div>
  )
}
