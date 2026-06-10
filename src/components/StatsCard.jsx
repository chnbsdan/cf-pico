import React from 'react'

const statsConfig = [
  { id: 'total', label: '总图片数', emoji: '🖼️', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'wallpaper', label: '横屏图片', emoji: '📐', color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'cover', label: '竖屏图片', emoji: '📱', color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'external', label: '外部图源', emoji: '🌐', color: 'text-orange-600', bg: 'bg-orange-50' },
]

export default function StatsCard({ stats }) {
  const data = [
    { value: stats.grand_total || stats.total_count || 0, ...statsConfig[0] },
    { value: stats.github_folders?.wallpaper || stats.wallpaper || 0, ...statsConfig[1] },
    { value: stats.github_folders?.cover || stats.cover || 0, ...statsConfig[2] },
    { value: stats.external_total || 0, ...statsConfig[3] },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
      {data.map((item) => (
        <div key={item.id} className="card p-4 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-xl ${item.bg}`}>
              <span className="text-xl">{item.emoji}</span>
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-800">{item.value}</div>
          <div className="text-xs text-gray-500 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
