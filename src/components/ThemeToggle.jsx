// src/components/ThemeToggle.jsx - 主题切换按钮组件（优化版）
import React, { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-4 right-4 z-50 bg-white/30 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-700/50 transition p-2 rounded-full shadow-md"
      title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {isDark ? (
        <i className="fas fa-sun text-yellow-500 text-base"></i>
      ) : (
        <i className="fas fa-moon text-gray-800 text-base"></i>
      )}
    </button>
  )
}
