// src/components/StatsCard.jsx
import React from 'react'

const statsConfig = [
  { 
    id: 'total', 
    label: '总图片数', 
    icon: 'fa-images', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-blue-900/30' 
  },
  { 
    id: 'wallpaper', 
    label: '横屏图片', 
    icon: 'fa-arrows-alt', 
    color: 'text-green-600 dark:text-green-400', 
    bg: 'bg-green-50 dark:bg-green-900/30' 
  },
  { 
    id: 'cover', 
    label: '竖屏图片', 
    icon: 'fa-mobile-alt', 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-purple-50 dark:bg-purple-900/30' 
  },
  { 
    id: 'telegram', 
    label: 'Telegram 图片', 
    icon: 'fa-telegram-plane', 
    color: 'text-blue-400 dark:text-blue-300', 
    bg: 'bg-blue-50/60 dark:bg-blue-900/20' 
  },
  { 
    id: 'external', 
    label: '外部图源', 
    icon: 'fa-globe', 
    color: 'text-orange-600 dark:text-orange-400', 
    bg: 'bg-orange-50 dark:bg-orange-900/30' 
  },
]

export default function StatsCard({ stats }) {
  // 横屏图片 = wallpaper + sh
  const landscapeCount = (stats.github_folders?.wallpaper || 0) + (stats.github_folders?.sh || 0)
  // 竖屏图片 = cover + sd
  const portraitCount = (stats.github_folders?.cover || 0) + (stats.github_folders?.sd || 0)
  
  // ✅ 新增：Telegram 图片数量
  const telegramCount = stats.telegram_total || 0
  
  // 总图片数 = GitHub总 + 外部 + Telegram
  const totalCount = (stats.grand_total || stats.total_count || 0) + telegramCount
  
  const data = [
    { value: totalCount, ...statsConfig[0] },
    { value: landscapeCount, ...statsConfig[1] },
    { value: portraitCount, ...statsConfig[2] },
    { value: telegramCount, ...statsConfig[3] },
    { value: stats.external_total || 0, ...statsConfig[4] },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in">
      {data.map((item) => (
        <div key={item.id} className="card py-3 px-3 hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${item.bg}`}>
              <i className={`fas ${item.icon} text-lg ${item.color}`}></i>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{item.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
