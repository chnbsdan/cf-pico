// functions/api/[[path]].js - Cloudflare Pages API 入口
// 这个文件处理所有 /api/* 请求

// 从环境变量读取配置
const GITHUB_USER = 'chnbsdan'
const GITHUB_REPO = 'cf-pico'
// 注意：GITHUB_TOKEN 在 Dashboard 环境变量中设置，通过 context.env 读取

// ============================================================
// 工具函数
// ============================================================

// 获取文件夹图片列表
async function getFolderImages(folder, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN 未设置')
    return []
  }
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`)
      return []
    }
    const files = await response.json()
    if (!Array.isArray(files)) return []
    return files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) && f.name !== '.keep'
    })
  } catch (error) {
    console.error(`Failed to fetch ${folder}:`, error)
    return []
  }
}

// 获取所有文件夹的图片
async function getAllImages(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  let allImages = []
  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    allImages = allImages.concat(images.map(f => ({ ...f, folder })))
  }
  return allImages
}

// ============================================================
// API 处理函数
// ============================================================

// GET /api/stats
async function handleStats(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const githubFolders = {}
  let githubTotal = 0
  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    githubFolders[folder] = images.length
    githubTotal += images.length
  }
  return new Response(JSON.stringify({
    github_folders: githubFolders,
    github_total: githubTotal,
    external_total: 0,
    grand_total: githubTotal
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

// GET /api/random
async function handleRandom(env) {
  const allImages = await getAllImages(env)
  if (allImages.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = allImages[Math.floor(Math.random() * allImages.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

// GET /api/wallpaper
async function handleWallpaper(request, env) {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'wallpaper'
  const images = await getFolderImages(folder, env)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

// GET /api/cover
async function handleCover(request, env) {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'cover'
  const images = await getFolderImages(folder, env)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

// GET /api/list
async function handleList(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const results = {}
  let total = 0
  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    results[folder] = images.map(f => ({
      name: f.name,
      url: f.download_url,
      path: f.path,
      sha: f.sha,
      size: f.size,
      folder: folder,
      source: 'github'
    }))
    total += images.length
  }
  return new Response(JSON.stringify({
    total: total,
    folders: results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

// GET /api/image
async function handleImage(request, env) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }
  const parts = path.split('/')
  const folder = parts[0]
  const filename = parts.slice(1).join('/')
  const allowedFolders = ['wallpaper', 'cover', 'sh', 'sd']
  if (!allowedFolders.includes(folder)) {
    return new Response('Invalid folder', { status: 403 })
  }
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response('GITHUB_TOKEN not configured', { status: 500 })
  }
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${folder}/${filename}`
  try {
    const response = await fetch(rawUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }
    const ext = filename.split('.').pop().toLowerCase()
    const contentTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif'
    }
    return new Response(response.body, {
      headers: { 'Content-Type': contentTypes[ext] || 'image/jpeg' }
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response('Internal error', { status: 500 })
  }
}

// ============================================================
// 主入口
// ============================================================

export async function onRequest(context) {
  const { request, env, params } = context
  const url = new URL(request.url)
  const path = params.path || ''

  console.log(`API 请求: ${path}`)

  // 路由分发
  if (path === 'stats') {
    return handleStats(env)
  }
  if (path === 'random') {
    return handleRandom(env)
  }
  if (path === 'wallpaper') {
    return handleWallpaper(request, env)
  }
  if (path === 'cover') {
    return handleCover(request, env)
  }
  if (path === 'list') {
    return handleList(env)
  }
  if (path === 'image') {
    return handleImage(request, env)
  }

  // 未匹配的 API 路径
  return new Response(JSON.stringify({ error: 'API not found', path }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}
