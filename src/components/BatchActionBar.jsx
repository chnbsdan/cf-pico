import React, { useState } from 'react'

export default function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchCopy,
  onBatchMove,
  loading = false
}) {
  const [showMore, setShowMore] = useState(false)

  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-[90vw]">
      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
        <i className="fas fa-check-circle text-blue-500 mr-1"></i>
        已选 {selectedCount} 项
        <button onClick={onClearSelection} className="ml-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">取消</button>
      </span>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>

      <button onClick={onBatchCopy} className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs flex items-center gap-1.5 transition">
        <i className="fas fa-copy"></i> 复制
      </button>
      <button onClick={onBatchDelete} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs flex items-center gap-1.5 transition" disabled={loading}>
        <i className="fas fa-trash-alt"></i> 删除
      </button>

      <div className="relative">
        <button onClick={() => setShowMore(!showMore)} className="px-3 py-1.5 rounded-lg bg-gray-200/80 dark:bg-gray-700/80 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs flex items-center gap-1.5 transition">
          <i className="fas fa-ellipsis-h"></i> 更多
        </button>
        {showMore && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]">
            <button onClick={() => { onBatchMove?.(); setShowMore(false) }} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
              <i className="fas fa-folder-open text-yellow-500"></i> 移动到
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
      <button onClick={onSelectAll} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition">
        {selectedCount === totalCount ? '取消全选' : '全选'}
      </button>
    </div>
  )
}
