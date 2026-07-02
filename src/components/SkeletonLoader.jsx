import React from 'react'

export default function SkeletonLoader({ count = 12, type = 'card' }) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white/70 dark:bg-gray-800/70 rounded-xl overflow-hidden border border-white/30 dark:border-gray-700 animate-pulse">
            <div className="aspect-square bg-gray-200 dark:bg-gray-700"></div>
            <div className="p-2 space-y-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}
