// api/wallpaper.js - 仅返回 wallpaper 文件夹的随机图片 + wallpaper 分类的外部图片
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'imgbed-storage'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const FOLDER = 'wallpaper'

// 🆕 记录上一次返回的图片 URL（使用内存缓存，注意 Vercel 无状态特性）
let lastReturnedUrl = null

// 从 GitHub 存储仓库读取 wallpaper 分类的外部图片
async function getExternalImages() {
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Vercel-Serverless'
      }
    })
    if (response.ok) {
      const data = await response.json()
      return data.wallpaper || []
    }
  } catch (error) {
    console.error('Failed to fetch external images:', error)
  }
  return []
}

async function isImageValid(url) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeoutId)
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Disposition', 'inline')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    let allImages = []
    
    // 1. 获取 wallpaper 文件夹的图片
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FOLDER}`
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Serverless'
      }
    })
    
    if (response.ok) {
      const files = await response.json()
      if (Array.isArray(files)) {
        const images = files
          .filter(f => f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i))
          .map(f => f.download_url)
        allImages.push(...images)
      }
    }
    
    // 2. 获取 wallpaper 分类的外部图片
    const externalImages = await getExternalImages()
    for (const url of externalImages) {
      if (await isImageValid(url)) {
        allImages.push(url)
      }
    }
    
    if (allImages.length === 0) {
      return res.status(404).send('No images found')
    }
    
    // 🆕 去重逻辑：如果只有一张图片，直接返回
    if (allImages.length === 1) {
      lastReturnedUrl = allImages[0]
      const imgRes = await fetch(allImages[0])
      if (!imgRes.ok) return res.status(500).send('Failed to fetch image')
      const contentType = imgRes.headers.get('Content-Type') || 'image/jpeg'
      const body = await imgRes.arrayBuffer()
      res.setHeader('Content-Type', contentType)
      return res.send(Buffer.from(body))
    }
    
    // 🆕 去重逻辑：过滤掉上一次返回的图片
    let availableImages = allImages
    if (lastReturnedUrl) {
      availableImages = allImages.filter(url => url !== lastReturnedUrl)
    }
    
    // 如果过滤后为空（理论上不会，但兜底），使用全部图片
    if (availableImages.length === 0) {
      availableImages = allImages
    }
    
    // 从剩余图片中随机选择
    const randomUrl = availableImages[Math.floor(Math.random() * availableImages.length)]
    lastReturnedUrl = randomUrl  // 记录本次返回的图片
    
    const imgRes = await fetch(randomUrl)
    
    if (!imgRes.ok) {
      return res.status(500).send('Failed to fetch image')
    }
    
    const contentType = imgRes.headers.get('Content-Type') || 'image/jpeg'
    const body = await imgRes.arrayBuffer()
    
    res.setHeader('Content-Type', contentType)
    res.send(Buffer.from(body))
  } catch (error) {
    console.error('Error in wallpaper.js:', error)
    res.status(500).send('Internal error')
  }
}
