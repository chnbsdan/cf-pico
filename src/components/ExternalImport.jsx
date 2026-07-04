// src/components/ExternalImport.jsx - 外链转存组件（自定义下拉 + Font Awesome）
import React, { useState } from 'react'

export default function ExternalImport({ onImportComplete }) {
  const [urls, setUrls] = useState('')
  const [storage, setStorage] = useState('github')
  const [storageOpen, setStorageOpen] = useState(false)
  const [folder, setFolder] = useState('wallpaper')
  const [folderOpen, setFolderOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ total: 0, done: 0 })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [results, setResults] = useState([])

  const folderOptions = [
    { value: 'wallpaper', label: '横屏 (wallpaper)', icon: 'fa-folder-open', color: 'text-blue-400' },
    { value: 'cover', label: '竖屏 (cover)', icon: 'fa-folder', color: 'text-purple-400' },
    { value: 'sh', label: '横屏 (sh)', icon: 'fa-folder-open', color: 'text-blue-400' },
    { value: 'sd', label: '竖屏 (sd)', icon: 'fa-folder', color: 'text-purple-400' }
  ]

  const storageOptions = [
    { value: 'github', label: 'GitHub', icon: 'fa-brands fa-github', needFolder: true },
    { value: 'r2', label: 'R2', icon: 'fas fa-cloud', needFolder: true },
    { value: 'telegram', label: 'Telegram', icon: 'fas fa-paper-plane', needFolder: false },
    { value: 'huggingface', label: 'HuggingFace', icon: 'fas fa-brain', needFolder: false }
  ]

  const showMessage = (text, type = 'success') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const getStorageNeedsFolder = (value) => {
    const opt = storageOptions.find(o => o.value === value)
    return opt?.needFolder || false
  }

  const handleImport = async () => {
    if (!urls.trim()) {
      showMessage('请输入要转存的链接', 'error')
      return
    }

    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u)
    if (urlList.length === 0) {
      showMessage('没有有效的链接', 'error')
      return
    }

    const validUrls = urlList.filter(u => u.startsWith('http'))
    if (validUrls.length === 0) {
      showMessage('链接需要以 http 开头', 'error')
      return
    }

    if (validUrls.length < urlList.length) {
      showMessage(`⚠️ 过滤掉 ${urlList.length - validUrls.length} 个无效链接`, 'error')
    }

    setImporting(true)
    setProgress({ total: validUrls.length, done: 0 })
    setResults([])

    try {
      const response = await fetch('/api/external/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: validUrls,
          storage: storage,
          folder: folder
        })
      })
      const data = await response.json()

      if (data.success) {
        setResults(data.results || [])
        setProgress({ total: data.total, done: data.successCount })
        showMessage(`✅ 转存完成: 成功 ${data.successCount} 个，失败 ${data.failCount} 个`, data.failCount > 0 ? 'error' : 'success')
        if (onImportComplete) onImportComplete()
      } else {
        showMessage(`❌ 转存失败: ${data.error || '未知错误'}`, 'error')
      }
    } catch (err) {
      console.error('转存失败:', err)
      showMessage('❌ 请求失败: ' + err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const needsFolder = getStorageNeedsFolder(storage)

  return (
    <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/30 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <i className="fas fa-cloud-upload-alt text-purple-500"></i>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">外链转存</h3>
        <span className="text-xs text-gray-400 ml-2">下载外链图片并转存到你的存储</span>
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

      <div className="space-y-3">
        {/* 链接输入 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            输入外链（每行一个）
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.png"
            className="w-full px-3 py-2 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none min-h-[80px] text-sm"
            rows={3}
            disabled={importing}
          />
        </div>

        {/* 存储渠道 + 文件夹 - 自定义下拉 */}
        <div className="flex flex-wrap gap-3">
          {/* 存储渠道 */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              转存到
            </label>
            <div className="relative">
              <button
                onClick={() => setStorageOpen(!storageOpen)}
                className="w-full px-3 py-2 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition flex items-center justify-between"
                disabled={importing}
              >
                <span className="flex items-center gap-2">
                  <i className={`${storageOptions.find(o => o.value === storage)?.icon} w-4 text-center`}></i>
                  <span>{storageOptions.find(o => o.value === storage)?.label}</span>
                </span>
                <i className="fas fa-chevron-down text-xs text-gray-400"></i>
              </button>
              {storageOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-lg border border-white/30 overflow-hidden z-50">
                  {storageOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setStorage(opt.value); setStorageOpen(false); }}
                      className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-purple-500/10 transition text-gray-700 dark:text-gray-300 ${
                        storage === opt.value ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' : ''
                      }`}
                    >
                      <i className={`${opt.icon} w-4 text-center`}></i>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 文件夹 */}
          {needsFolder && (
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                文件夹
              </label>
              <div className="relative">
                <button
                  onClick={() => setFolderOpen(!folderOpen)}
                  className="w-full px-3 py-2 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-white/30 dark:border-gray-700 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition flex items-center justify-between"
                  disabled={importing}
                >
                  <span className="flex items-center gap-2">
                    <i className={`fas fa-folder ${folderOptions.find(o => o.value === folder)?.color || ''} w-4 text-center`}></i>
                    <span>{folderOptions.find(o => o.value === folder)?.label}</span>
                  </span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>
                {folderOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-lg border border-white/30 overflow-hidden z-50">
                    {folderOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setFolder(opt.value); setFolderOpen(false); }}
                        className={`w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-purple-500/10 transition text-gray-700 dark:text-gray-300 ${
                          folder === opt.value ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' : ''
                        }`}
                      >
                        <i className={`fas fa-folder ${opt.color || ''} w-4 text-center`}></i>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 进度 */}
        {importing && progress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {progress.done}/{progress.total}
            </span>
          </div>
        )}

        {/* 按钮 */}
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm transition disabled:opacity-50"
        >
          {importing ? (
            <><i className="fas fa-spinner fa-pulse mr-2"></i>转存中...</>
          ) : (
            <><i className="fas fa-cloud-upload-alt mr-2"></i>开始转存 ({urls.split('\n').filter(u => u.trim()).length || 0} 个链接)</>
          )}
        </button>

        {/* 结果显示 */}
        {results.length > 0 && (
          <div className="mt-3 max-h-[240px] overflow-y-auto text-xs">
            {results.map((r, i) => (
              <div key={i} className={`py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 ${
                r.success ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'
              }`}>
                <span className="flex-shrink-0">{r.success ? '✅' : '❌'}</span>
                <span className="truncate flex-1 text-gray-500 dark:text-gray-400 min-w-0" title={r.originalUrl}>
                  {r.originalUrl}
                </span>
                <span className="text-gray-400 flex-shrink-0">→</span>
                {r.success ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={r.newUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline truncate max-w-[120px] sm:max-w-[200px]"
                      title={r.newUrl}
                    >
                      {r.newUrl}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(r.newUrl)
                        const btn = document.getElementById(`copy-btn-${i}`)
                        if (btn) {
                          btn.innerHTML = '<i class="fas fa-check text-green-500"></i>'
                          setTimeout(() => {
                            btn.innerHTML = '<i class="fas fa-copy text-gray-400"></i>'
                          }, 1500)
                        }
                      }}
                      id={`copy-btn-${i}`}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0"
                      title="复制链接"
                    >
                      <i className="fas fa-copy text-gray-400 hover:text-blue-500"></i>
                    </button>
                    <a
                      href={r.newUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0"
                      title="打开链接"
                    >
                      <i className="fas fa-external-link-alt text-gray-400 hover:text-blue-500"></i>
                    </a>
                  </div>
                ) : (
                  <span className="text-red-500 dark:text-red-400 truncate max-w-[120px] sm:max-w-[200px]" title={r.error}>
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
