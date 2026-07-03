import React, { useState, useRef, useEffect } from 'react'

export default function FilterDropdown({ filters, onFilterChange, label = '筛选', icon = 'fa-filter' }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFilterChange = (key, value) => {
    onFilterChange?.({ ...filters, [key]: value })
  }

  const activeCount = Object.values(filters).filter(v => v && v !== '' && v !== 'all').length

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="px-3 py-1.5 rounded-lg bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-600/70 text-gray-700 dark:text-gray-300 text-sm flex items-center gap-1.5 transition backdrop-blur-sm">
        <i className={`fas ${icon} text-xs`}></i>
        {activeCount > 0 ? `${label} (${activeCount})` : label}
        <i className={`fas fa-chevron-down text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-xl border border-white/30 dark:border-gray-700 p-4 z-50">
          {Object.entries(filters).map(([key, value]) => (
            <div key={key} className="mb-3 last:mb-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                {key === 'type' ? '文件类型' : key === 'source' ? '存储渠道' : key === 'folder' ? '文件夹' : key}
              </label>
              {key === 'type' && (
                <select value={value || ''} onChange={(e) => handleFilterChange(key, e.target.value)} className="w-full px-2 py-1 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">全部</option>
                  <option value="image">图片</option><option value="audio">音频</option><option value="video">视频</option>
                </select>
              )}
              {key === 'source' && (
                <select value={value || ''} onChange={(e) => handleFilterChange(key, e.target.value)} className="w-full px-2 py-1 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">全部</option>
                  <option value="github">GitHub</option>
                  <option value="r2">R2</option>
                  <option value="telegram">Telegram</option>
                  <option value="huggingface">HuggingFace</option>
                </select>
              )}
              {key === 'folder' && (
                <input type="text" value={value || ''} onChange={(e) => handleFilterChange(key, e.target.value)} placeholder="输入文件夹名..." className="w-full px-2 py-1 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
          ))}
          <button onClick={() => { const reset = {}; Object.keys(filters).forEach(k => reset[k] = ''); onFilterChange?.(reset) }} className="w-full mt-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">
            重置所有筛选
          </button>
        </div>
      )}
    </div>
  )
}
