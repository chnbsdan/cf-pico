import React, { useRef, useState } from 'react'
import { CloudArrowUp, Image as ImageIcon, LayoutGrid } from 'lucide-react'

export default function UploadArea({ onUpload, isLoading }) {
  const [dragOver, setDragOver] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const fileInputRef = useRef(null)

  const handleFileSelect = (files) => {
    if (files.length > 0) {
      onUpload(files, folder)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      onUpload(files, folder)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <CloudArrowUp className="w-4 h-4 text-blue-500" />
          上传图片
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFolder('wallpaper')}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all ${
              folder === 'wallpaper'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            横屏
          </button>
          <button
            onClick={() => setFolder('cover')}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all ${
              folder === 'cover'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            竖屏
          </button>
        </div>
      </div>

      <div
        className={`upload-area rounded-2xl border-2 border-dashed p-8 text-center ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <CloudArrowUp className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 mb-1">点击或拖拽图片到此处上传</p>
        <p className="text-xs text-gray-400">支持 JPG、PNG、WebP、GIF | 大图自动压缩</p>
        <p className="text-xs text-blue-500 mt-2">
          当前上传到: {folder === 'wallpaper' ? '📁 横屏 (wallpaper)' : '📁 竖屏 (cover)'}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {isLoading && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            上传中，请稍候...
          </div>
        </div>
      )}
    </div>
  )
}
