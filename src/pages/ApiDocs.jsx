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
  // copiedApi: 记录当前被复制的接口 ID，用于显示"复制成功"的绿色勾图标
  // 2秒后自动清空，恢复为复制图标
  const [copiedApi, setCopiedApi] = useState(null)

  // ========== 复制功能 ==========
  // 参数：
  //   text: 要复制的文本内容（接口地址或示例命令）
  //   id:   唯一标识，用于标记哪个按钮被点击
  // 功能：
  //   1. 调用 copyToClipboard 将文本复制到剪贴板
  //   2. 设置 copiedApi 为当前 id，按钮图标变为绿色勾
  //   3. 2秒后自动恢复为复制图标
  const handleCopy = (text, id) => {
    copyToClipboard(text)
    setCopiedApi(id)
    setTimeout(() => setCopiedApi(null), 2000)
  }

  // ========== 获取当前域名 ==========
  // 优先使用 window.location.origin（当前访问的域名）
  // 服务端渲染时使用默认域名作为 fallback
  // 这样在不同环境（本地开发、Vercel预览、自定义域名）都能正常工作
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pico.hangdn.com'

  // ========== API 接口列表配置 ==========
  // 每个接口包含以下字段：
  //   id:          唯一标识，用于复制功能区分
  //   name:        接口显示名称
  //   path:        API 路径（会自动拼接 baseUrl）
  //   method:      请求方法（GET / POST）
  //   description: 接口功能描述
  //   example:     调用示例（curl 命令或直接 URL）
  //   response:    返回结果示例（JSON 或文字说明）
  const apis = [
    // ============================================================
    // 1. 随机图片接口
    // 从所有文件夹（wallpaper/cover/sh/sd）中随机返回一张图片
    // 支持 ?format=json 参数返回 JSON 格式
    // ============================================================
    {
      id: 'random',
      name: '随机图片',
      path: '/api/random',
      method: 'GET',
      description: '从所有文件夹（wallpaper/cover/sh/sd）中随机返回一张图片',
      example: `curl ${baseUrl}/api/random`,
      response: '直接返回图片文件（JPEG/PNG/WebP等格式）'
    },
    
    // ============================================================
    // 2. 横屏图片接口
    // 默认从 wallpaper 文件夹读取
    // 可通过 ?folder=sh 参数切换到 sh 文件夹
    // ============================================================
    {
      id: 'wallpaper',
      name: '横屏图片',
      path: '/api/wallpaper',
      method: 'GET',
      description: '随机返回一张横屏图片（默认从 wallpaper 文件夹，可通过 ?folder=sh 切换到 sh 文件夹）',
      example: `curl ${baseUrl}/api/wallpaper\n# 从 sh 文件夹获取\ncurl ${baseUrl}/api/wallpaper?folder=sh`,
      response: '直接返回图片文件'
    },
    
    // ============================================================
    // 3. 竖屏图片接口
    // 默认从 cover 文件夹读取
    // 可通过 ?folder=sd 参数切换到 sd 文件夹
    // ============================================================
    {
      id: 'cover',
      name: '竖屏图片',
      path: '/api/cover',
      method: 'GET',
      description: '随机返回一张竖屏图片（默认从 cover 文件夹，可通过 ?folder=sd 切换到 sd 文件夹）',
      example: `curl ${baseUrl}/api/cover\n# 从 sd 文件夹获取\ncurl ${baseUrl}/api/cover?folder=sd`,
      response: '直接返回图片文件'
    },

    // ============================================================
    // 4. Telegram 随机图片接口（新增）
    // ============================================================
    {
      id: 'tg',
      name: 'Telegram 随机图片',
      path: '/api/tg',
      method: 'GET',
      description: '从 Telegram 存储中随机返回一张图片。支持 ?format=html 参数返回全屏壁纸页面（60秒自动刷新）',
      example: `# 返回图片\ncurl ${baseUrl}/api/tg\n\n# 全屏壁纸模式（浏览器访问）\n${baseUrl}/api/tg?format=html`,
      response: '直接返回图片文件 或 全屏 HTML 页面'
    },
    
    // ============================================================
    // 5. JSON 格式接口
    // 复用 /api/random，通过 format=json 参数返回 JSON 格式
    // 包含图片 URL、来源和总数等信息
    // ============================================================
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
    
    // ============================================================
    // 6. 统计信息接口
    // 返回各文件夹的图片数量统计
    // 包含 GitHub 仓库图片、Telegram 图片和外部图片
    // ============================================================
    {
      id: 'stats',
      name: '统计信息',
      path: '/api/stats',
      method: 'GET',
      description: '返回图片统计信息（各文件夹数量、Telegram 图片数量、外部图片数量、总数）',
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
  "external_total": 15,
  "grand_total": 83
}`
    },
    
    // ============================================================
    // 7. 图片列表接口
    // 返回所有图片的详细列表（按文件夹分组）
    // 包含 Telegram 分类，用于管理后台
    // ============================================================
    {
      id: 'list',
      name: '图片列表',
      path: '/api/list',
      method: 'GET',
      description: '返回所有图片列表（按文件夹分组，包含 Telegram 分类）',
      example: `curl ${baseUrl}/api/list`,
      response: '返回 JSON 格式的图片列表，包含文件名、URL、大小、来源等信息'
    },
    
    // ============================================================
    // 8. 上传图片接口
    // POST 请求，需要 multipart/form-data 格式
    // 参数：file（图片文件）、folder（目标文件夹）、storage（存储方式）
    // 支持的文件夹：wallpaper、cover、sh、sd
    // 支持的存储方式：github（默认）、r2、telegram
    // ============================================================
    {
      id: 'upload',
      name: '上传图片',
      path: '/api/upload',
      method: 'POST',
      description: '上传图片到指定分类，支持选择存储方式（github/r2/telegram）',
      example: `# 上传到 GitHub（默认）\ncurl -X POST -F "file=@image.jpg" -F "folder=wallpaper" ${baseUrl}/api/upload\n\n# 上传到 Telegram\ncurl -X POST -F "file=@image.jpg" -F "folder=wallpaper" -F "storage=telegram" ${baseUrl}/api/upload`,
      response: `{
  "success": true,
  "filename": "20260616_image.jpg",
  "folder": "wallpaper",
  "url": "${baseUrl}/api/image?path=wallpaper/20260616_image.jpg",
  "storage": "github"
}`
    },
    
    // ============================================================
    // 9. 图片代理接口
    // 通过代理访问私有仓库或 Telegram 中的图片
    // 参数：path（格式：文件夹名/图片文件名）
    // 解决了 GitHub 私有仓库和 Telegram 文件无法直接访问的问题
    // ============================================================
    {
      id: 'image',
      name: '代理访问',
      path: '/api/image',
      method: 'GET',
      description: '代理访问图片（支持 GitHub/R2/Telegram 三种存储），解决私有仓库和 Telegram 文件无法直接访问的问题',
      example: `# GitHub/R2 图片\n${baseUrl}/api/image?path=wallpaper/20260616_image.jpg\n\n# Telegram 图片\n${baseUrl}/api/image?path=telegram/photos%2Ffile_10.jpg`,
      response: '直接返回图片文件'
    }
  ]

  // ========== 页面渲染 ==========
  return (
    // 外层容器：最小高度全屏，内边距，背景色跟随主题
    // bg-gray-100: 亮色模式浅灰背景
    // dark:bg-gray-900: 暗色模式深灰背景
    <div className="min-h-screen py-6 px-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      
      // ========== 右上角固定导航栏 ==========
      // fixed top-4 right-4: 固定在右上角，距离顶部和右侧各16px
      // z-50: 确保在最上层，不被其他元素遮挡
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        // 返回首页按钮
        <a 
          href="/" 
          className="bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition px-3 py-2 rounded-lg text-gray-700 dark:text-white text-sm"
        >
          返回
        </a>
        // 主题切换按钮容器
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
          <ThemeToggle />
        </div>
      </div>

      // ========== 主要内容区 ==========
      // max-w-4xl: 最大宽度，在大屏幕上内容居中不拉得太宽
      // mx-auto: 水平居中
      <div className="max-w-4xl mx-auto">
        
        // ========== 页面头部 ==========
        <div className="text-center mb-8">
          // 图标 + 标题在同一行
          <div className="flex items-center justify-center gap-3 mb-2">
            <i className="fas fa-book text-3xl text-gray-600 dark:text-gray-400"></i>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">API 接口文档</h1>
          </div>
          // 副标题说明
          <p className="text-gray-500 dark:text-gray-400 text-sm">所有接口均支持 GET 请求（上传除外）</p>
        </div>

        // ========== API 列表 ==========
        // space-y-4: 每个 API 卡片之间间距16px
        <div className="space-y-4">
          
          // 遍历 apis 数组，渲染每个接口卡片
          {apis.map((api) => {
            // 生成完整的接口 URL
            // 对于 image 接口，添加示例参数 ?path=wallpaper/example.jpg
            const fullUrl = `${baseUrl}${api.path}${api.id === 'image' ? '?path=wallpaper/example.jpg' : ''}`
            
            return (
              // ========== 单个 API 卡片 ==========
              <div key={api.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                
                // ----- 卡片头部（接口路径和操作按钮）-----
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  
                  // 左侧：请求方法标签 + 接口路径
                  <div className="flex items-center gap-3 flex-wrap">
                    // 请求方法标签：GET 绿色，POST 橙色
                    <span className={`px-2 py-1 rounded text-xs font-mono text-white ${
                      api.method === 'GET' ? 'bg-green-500' : 'bg-orange-500'
                    }`}>
                      {api.method}
                    </span>
                    // 接口路径
                    <code className="text-gray-700 dark:text-gray-300 text-sm font-mono">{api.path}</code>
                  </div>
                  
                  // 右侧：打开链接 + 复制链接按钮
                  <div className="flex items-center gap-2">
                    // 打开链接按钮：在新标签页打开接口地址
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="打开链接"
                    >
                      <i className="fas fa-external-link-alt"></i>
                    </a>
                    // 复制链接按钮：点击复制接口地址
                    <button
                      onClick={() => handleCopy(fullUrl, api.id)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="复制接口地址"
                    >
                      // 根据是否复制成功显示不同图标：成功显示绿色勾，否则显示复制图标
                      {copiedApi === api.id ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-copy"></i>}
                    </button>
                  </div>
                </div>
                
                // ----- 卡片内容（描述、示例、返回示例）-----
                <div className="p-4 space-y-3">
                  
                  // 接口描述
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{api.description}</p>
                  
                  // 示例代码区域
                  <div>
                    // 示例标题：代码图标 + "示例"文字
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1 flex items-center gap-1">
                      <i className="fas fa-code text-xs"></i> 示例
                    </p>
                    // 示例代码块：深色背景，等宽字体，支持横向滚动
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      // 示例内容（支持多行，用 <br/> 换行）
                      <code className="text-gray-700 dark:text-gray-300 text-xs font-mono break-all">
                        {api.example.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < api.example.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </code>
                      // 复制示例按钮
                      <button
                        onClick={() => handleCopy(api.example, `example-${api.id}`)}
                        className="ml-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition text-xs"
                        title="复制示例"
                      >
                        {copiedApi === `example-${api.id}` ? <i className="fas fa-check text-green-500"></i> : <i className="fas fa-copy"></i>}
                      </button>
                    </div>
                  </div>
                  
                  // 返回示例区域
                  <div>
                    // 返回示例标题：右箭头图标 + "返回示例"文字
                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1 flex items-center gap-1">
                      <i className="fas fa-arrow-right text-xs"></i> 返回示例
                    </p>
                    // 返回示例代码块
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-gray-700 dark:text-gray-300 text-xs font-mono whitespace-pre-wrap break-all">{api.response}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        // ========== 页尾说明 ==========
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
