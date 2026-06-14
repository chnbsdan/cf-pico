// src/pages/ApiDocs.jsx - 完整版
import React, { useState } from 'react'
import { copyToClipboard } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'

export default function ApiDocs() {
  const [copiedApi, setCopiedApi] = useState(null)

  const handleCopy = (text, id) => {
    copyToClipboard(text)
    setCopiedApi(id)
    setTimeout(() => setCopiedApi(null), 2000)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pcbed.vercel.app'

  const apis = [
    {
      id: 'random',
      name: '随机图片',
      path: '/api/random',
      method: 'GET',
      description: '随机返回一张图片（全部分类）',
      example: `curl ${baseUrl}/api/random`,
      response: '直接返回图片文件'
    },
    {
      id: 'wallpaper',
      name: '横屏图片',
      path: '/api/wallpaper',
      method: 'GET',
      description: '随机返回一张横屏图片',
      example: `curl ${baseUrl}/api/wallpaper`,
      response: '直接返回图片文件'
    },
    {
      id: 'cover',
      name: '竖屏图片',
      path: '/api/cover',
      method: 'GET',
      description: '随机返回一张竖屏图片',
      example: `curl ${baseUrl}/api/cover`,
      response: '直接返回图片文件'
    },
    {
      id: 'json',
      name: 'JSON 格式',
      path: '/api/json',
      method: 'GET',
      description: '返回随机图片的 JSON 信息',
      example: `curl ${baseUrl}/api/json`,
      response: `{
  "code": "200",
  "imgurl": "${baseUrl}/api/random",
  "source": "https://raw.githubusercontent.com/chnbsdan/pcbed/main/wallpaper/xxx.jpg",
  "total": 128
}`
    },
    {
      id: 'stats',
      name: '统计信息',
      path: '/api/stats',
      method: 'GET',
      description: '返回图片统计信息',
      example: `curl ${baseUrl}/api/stats`,
      response: `{
  "github_folders": {
    "wallpaper": 33,
    "cover": 8
  },
  "github_total": 41,
  "external_total": 15,
  "grand_total": 56
}`
    },
    {
      id: 'list',
      name: '图片列表',
      path: '/api/list',
      method: 'GET',
      description: '返回所有图片列表（按分类分组）',
      example: `curl ${baseUrl}/api/list`,
      response: '返回 JSON 格式的图片列表'
    },
    {
      id: 'upload',
      name: '上传图片',
      path: '/api/upload',
      method: 'POST',
      description: '上传图片到指定分类',
      example: `curl -X POST -F "file=@image.jpg" -F "folder=wallpaper" ${baseUrl}/api/upload`,
      response: `{
  "success": true,
  "filename": "20260613_image.jpg",
  "folder": "wallpaper",
  "url": "${baseUrl}/wallpaper/20260613_image.jpg"
}`
    },
    {
      id: 'image',
      name: '代理访问',
      path: '/api/image',
      method: 'GET',
      description: '代理访问私有仓库中的图片',
      example: `${baseUrl}/api/image?path=wallpaper/20260613_image.jpg`,
      response: '直接返回图片文件'
    }
  ]

  return (
    <div className="min-h-screen py-6 px-4 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* 右上角导航栏 */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <a 
          href="/" 
          className="bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition px-3 py-2 rounded-lg text-gray-700 dark:text-white text-sm"
        >
          返回
        </a>
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <i className="fas fa-book text-3xl text-gray-600 dark:text-white/80"></i>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">API 接口文档</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">所有接口均支持 GET 请求（上传除外）</p>
        </div>

        {/* API 列表 */}
        <div className="space-y-4">
          {apis.map((api) => {
            const fullUrl = `${baseUrl}${api.path}${api.id === 'image' ? '?path=wallpaper/example.jpg' : ''}`
            return (
              <div key={api.id} className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs font-mono text-white ${
                      api.method === 'GET' ? 'bg-green-500' : 'bg-orange-500'
                    }`}>
                      {api.method}
                    </span>
                    <code className="text-gray-700 dark:text-gray-300 text-sm font-mono">{api.path}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                      title="打开链接"
                    >
                      <i className="fas fa-external-link-alt"></i>
                    </a>
                    <button
                      onClick={() => handleCopy(fullUrl, api.id)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                      title="复制接口地址"
                    >
                      {copiedApi === api.id ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-copy"></i>}
                    </button>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{api.description}</p>
                  
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1 flex items-center gap-1">
                    <i className="fas fa-code text-xs"></i> 示例
                    </p>
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <code className="text-gray-700 dark:text-gray-300 text-xs font-mono break-all">{api.example}</code>
                      <button
                        onClick={() => handleCopy(api.example, `example-${api.id}`)}
                        className="ml-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition text-xs"
                        title="复制示例"
                      >
                        {copiedApi === `example-${api.id}` ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-copy"></i>}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                     <p className="text-gray-500 dark:text-gray-400 text-xs mb-1 flex items-center gap-1">
                     <i className="fas fa-arrow-right text-xs"></i> 返回示例
                     </p>
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-gray-700 dark:text-gray-300 text-xs font-mono whitespace-pre-wrap break-all">{api.response}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 页尾说明 */}
        <div className="text-center mt-8 text-gray-400 dark:text-gray-500 text-xs">
          <p>所有图片均代理访问，保障私有仓库安全</p>
          <p className="mt-1">更多信息请访问 <a href="https://github.com/chnbsdan/pcbed" target="_blank" rel="noopener noreferrer" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">GitHub 仓库</a></p>
        </div>
      </div>
    </div>
  )
}
