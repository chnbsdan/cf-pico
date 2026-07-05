// src/components/UploadResult.jsx
import React from 'react'

export default function UploadResult({ results }) {
  console.log('=== UploadResult 组件渲染 ===')
  console.log('接收到的 results 长度:', results?.length || 0)
  console.log('results 数据:', results)

  if (!results || results.length === 0) {
    return (
      <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400 p-4 bg-white/50 dark:bg-black/30 rounded-lg border border-gray-200 dark:border-gray-700">
        <i className="fas fa-info-circle mr-1"></i>
        暂无上传结果
      </div>
    )
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  return (
    <div className="mt-4 p-4 bg-white/80 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* 统计信息 */}
      <div className="flex items-center gap-4 px-2 py-1 text-sm mb-2">
        <span className="text-green-600 dark:text-green-400 font-medium">
          <i className="fas fa-check-circle mr-1"></i>成功: {successCount}
        </span>
        {failCount > 0 && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            <i className="fas fa-exclamation-circle mr-1"></i>失败: {failCount}
          </span>
        )}
        <span className="text-gray-500 text-xs">共 {results.length} 个</span>
      </div>

      {/* 结果列表 */}
      {results.map((result, index) => (
        <div
          key={index}
          className={`p-3 rounded-lg border mb-2 ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {result.success ? (
                  <i className="fas fa-check-circle text-green-600 dark:text-green-400 text-sm"></i>
                ) : (
                  <i className="fas fa-times-circle text-red-600 dark:text-red-400 text-sm"></i>
                )}
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {result.filename || '未知文件'}
                </span>
                {result.folder && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {result.folder}
                  </span>
                )}
                {result.storage && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {result.storage}
                  </span>
                )}
              </div>
              {result.success && result.url && (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <code className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[200px] sm:max-w-[300px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {result.url}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.url)
                      const toast = document.createElement('div')
                      toast.innerHTML = '<i class="fas fa-check-circle mr-1"></i> 已复制'
                      toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg animate-fade-in-up'
                      document.body.appendChild(toast)
                      setTimeout(() => toast.remove(), 2000)
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition"
                    title="复制链接"
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition"
                    title="打开链接"
                  >
                    <i className="fas fa-external-link-alt"></i>
                  </a>
                </div>
              )}
              {!result.success && result.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{result.error}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
