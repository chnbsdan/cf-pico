// ============================================================
// API 接口文档页面
// 功能：展示图床所有 API 接口的说明、示例和返回格式
// 路由：/docs
// 支持暗色/亮色模式自动切换
// ============================================================

import React, { useState } from 'react'
import { copyToClipboard } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'

export default function ApiDocs() {
  // ========== 状态管理 ==========
  const [copiedApi, setCopiedApi] = useState(null)

  // ========== 复制功能 ==========
  const handleCopy = (text, id) => {
    copyToClipboard(text)
    setCopiedApi(id)
    setTimeout(() => setCopiedApi(null), 2000)
  }

  // ========== 获取当前域名 ==========
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pico.hangdn.com'

  // ========== API 接口列表配置 ==========
  const apis = [
    // ----------------------------------------
    // 1. 随机图片接口
    // ----------------------------------------
    {
      id: 'random',
      name: '随机图片',
      path: '/api/random',
      method: 'GET',
      description: '随机返回一张图片（从所有文件夹中随机选取）',
      example: `curl ${baseUrl}/api/random`,
      response: '直接返回图片文件（JPEG/PNG/WebP等格式）'
    },
    
    // ----------------------------------------
    // 2. 横屏图片接口
    // ----------------------------------------
    {
      id: 'wallpaper',
      name: '横屏图片',
      path: '/api/wallpaper',
      method: 'GET',
      description: '随机返回一张横屏图片（默认从 wallpaper 文件夹，可通过 ?folder=sh 切换到 sh 文件夹）',
      example: `curl ${baseUrl}/api/wallpaper\n# 从 sh 文件夹获取\ncurl ${baseUrl}/api/wallpaper?folder=sh`,
      response: '直接返回图片文件'
    },
    
    // ----------------------------------------
    // 3. 竖屏图片接口
    // ----------------------------------------
    {
      id: 'cover',
      name: '竖屏图片',
      path: '/api/cover',
      method: 'GET',
      description: '随机返回一张竖屏图片（默认从 cover 文件夹，可通过 ?folder=sd 切换到 sd 文件夹）',
      example: `curl ${baseUrl}/api/cover\n# 从 sd 文件夹获取\ncurl ${baseUrl}/api/cover?folder=sd`,
      response: '直接返回图片文件'
    },

    // ----------------------------------------
    // 4. Telegram 随机图片接口
    // ----------------------------------------
    {
      id: 'tg',
      name: 'Telegram 随机图片',
      path: '/api/tg',
      method: 'GET',
      description: '从 Telegram 存储中随机返回一张图片。支持 ?format=html 参数返回全屏壁纸页面（60秒自动刷新）',
      example: `# 返回图片\ncurl ${baseUrl}/api/tg\n\n# 全屏壁纸模式（浏览器访问）\n${baseUrl}/api/tg?format=html`,
      response: '直接返回图片文件 或 全屏 HTML 页面'
    },

    // ----------------------------------------
    // 5. HuggingFace 图片访问接口
    // ----------------------------------------
    {
      id: 'hf',
      name: 'HuggingFace 图片',
      path: '/api/hf/{path}',
      method: 'GET',
      description: '访问 HuggingFace 存储的图片，支持代理访问，避免跨域问题',
      example: `# 访问 HuggingFace 图片\n${baseUrl}/api/hf/20260705_xxx.jpg\n\n# 访问 HuggingFace 图片（带文件夹）\n${baseUrl}/api/hf/pic/20260705_xxx.jpg`,
      response: '直接返回图片文件'
    },

    // ----------------------------------------
    // 6. HuggingFace 随机图片
    // ----------------------------------------
    {
      id: 'hf-random',
      name: 'HuggingFace 随机图片',
      path: '/api/hf/random',
      method: 'GET',
      description: '从 HuggingFace 存储中随机返回一张图片',
      example: `curl ${baseUrl}/api/hf/random`,
      response: '直接返回图片文件'
    },
    
    // ----------------------------------------
    // 7. JSON 格式接口
    // ----------------------------------------
    {
      id: 'json',
      name: 'JSON 格式',
      path: '/api/random?format=json',
      method: 'GET',
      description: '返回随机图片的 JSON 信息（包含图片 URL、来源、总数）',
      example: `curl "${baseUrl}/api/random?format=json"`,
      response: `{
  "code": "200",
  "imgurl": "${baseUrl}/api/random",
  "source": "https://raw.githubusercontent.com/chnbsdan/Pico/main/wallpaper/xxx.jpg",
  "total": 128
}`
    },
    
    // ----------------------------------------
    // 8. 统计信息接口
    // ----------------------------------------
    {
      id: 'stats',
      name: '统计信息',
      path: '/api/stats',
      method: 'GET',
      description: '返回图片统计信息（各文件夹数量、Telegram 图片数量、HuggingFace 图片数量、外部图片数量、总数）',
      example: `curl ${baseUrl}/api/stats`,
      response: `{
  "github_folders": {
    "wallpaper": 33,
    "cover": 8,
    "sh": 10,
    "sd": 5
  },
  "github_total": 56,
  "telegram_total": 12,
  "huggingface_total": 8,
  "external_total": 15,
  "grand_total": 91
}`
    },
    
    // ----------------------------------------
    // 9. 图片列表接口
    // ----------------------------------------
    {
      id: 'list',
      name: '图片列表',
      path: '/api/list',
      method: 'GET',
      description: '返回所有图片列表（按文件夹分组，包含 Telegram 分类和 HuggingFace 分类）',
      example: `curl ${baseUrl}/api/list`,
      response: '返回 JSON 格式的图片列表，包含文件名、URL、大小、来源等信息'
    },
    
    // ----------------------------------------
    // 10. 上传图片接口
    // ----------------------------------------
    {
      id: 'upload',
      name: '上传图片',
      path: '/api/upload',
      method: 'POST',
      description: '上传图片到指定分类，支持选择存储方式（github/r2/telegram/huggingface）',
      example: `# 上传到 GitHub（默认）\ncurl -X POST -F "file=@image.jpg" -F "folder=wallpaper" ${baseUrl}/api/upload\n\n# 上传到 HuggingFace\ncurl -X POST -F "file=@image.jpg" -F "storage=huggingface" ${baseUrl}/api/upload`,
      response: `{
  "success": true,
  "filename": "20260705_image.jpg",
  "folder": "wallpaper",
  "url": "${baseUrl}/api/image?path=wallpaper/20260705_image.jpg",
  "storage": "github"
}`
    },
    
    // ----------------------------------------
    // 11. 图片代理接口
    // ----------------------------------------
    {
      id: 'image',
      name: '代理访问',
      path: '/api/image',
      method: 'GET',
      description: '代理访问图片（支持 GitHub/R2/Telegram 三种存储），解决私有仓库和 Telegram 文件无法直接访问的问题',
      example: `# GitHub/R2 图片\n${baseUrl}/api/image?path=wallpaper/20260705_image.jpg\n\n# Telegram 图片\n${baseUrl}/api/image?path=telegram/photos%2Ffile_10.jpg`,
      response: '直接返回图片文件'
    },

    // ----------------------------------------
    // 12. 外链转存接口
    // ----------------------------------------
    {
      id: 'import',
      name: '外链转存',
      path: '/api/external/import',
      method: 'POST',
      description: '下载外链图片并转存到指定存储渠道（github/r2/telegram/huggingface），支持批量转存',
      example: `curl -X POST ${baseUrl}/api/external/import \\\n  -H "Content-Type: application/json" \\\n  -d '{"urls":["https://example.com/image.jpg"],"storage":"huggingface"}'`,
      response: `{
  "success": true,
  "total": 1,
  "successCount": 1,
  "failCount": 0,
  "results": [
    {
      "success": true,
      "originalUrl": "https://example.com/image.jpg",
      "newUrl": "${baseUrl}/api/hf/20260705_xxx.jpg",
      "storage": "huggingface"
    }
  ]
}`
    }
  ]

  // ========== 页面渲染 ==========
  return (
    <div className="min-h-screen py-6 px-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      
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
        
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <i className="fas fa-book text-3xl text-gray-600 dark:text-gray-400"></i>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">API 接口文档</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">所有接口均支持 GET 请求（上传除外）</p>
        </div>

        <div className="space-y-4">
          
          {apis.map((api) => {
            const fullUrl = `${baseUrl}${api.path}${api.id === 'image' ? '?path=wallpaper/example.jpg' : ''}`
            
            return (
              <div key={api.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                
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
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="打开链接"
                    >
                      <i className="fas fa-external-link-alt"></i>
                    </a>
                    <button
                      onClick={() => handleCopy(fullUrl, api.id)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <code className="text-gray-700 dark:text-gray-300 text-xs font-mono break-all">
                        {api.example.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < api.example.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </code>
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
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-gray-700 dark:text-gray-300 text-xs font-mono whitespace-pre-wrap break-all">{api.response}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-8 text-gray-400 dark:text-gray-500 text-xs">
          <p>所有图片均代理访问，保障私有仓库安全</p>
          <p className="mt-1">
            更多信息请访问{' '}
            <a 
              href="https://github.com/chnbsdan/cf-pico" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              GitHub 仓库
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
