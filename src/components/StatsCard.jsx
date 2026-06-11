import React from 'react'

const statsConfig = [
  { id: 'total', label: '总图片数', icon: 'fa-images', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'wallpaper', label: '横屏图片', icon: 'fa-arrows-alt', color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'cover', label: '竖屏图片', icon: 'fa-mobile-alt', color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'external', label: '外部图源', icon: 'fa-globe', color: 'text-orange-600', bg: 'bg-orange-50' },
]

export default function StatsCard({ stats }) {
  const data = [
    { value: stats.grand_total || stats.total_count || 0, ...statsConfig[0] },
    { value: stats.github_folders?.wallpaper || stats.wallpaper || 0, ...statsConfig[1] },
    { value: stats.github_folders?.cover || stats.cover || 0, ...statsConfig[2] },
    { value: stats.external_total || 0, ...statsConfig[3] },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
      {data.map((item) => (
        <div key={item.id} className="card py-3 px-3 hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${item.bg}`}>
              <i className={`fas ${item.icon} text-lg ${item.color}`}></i>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
