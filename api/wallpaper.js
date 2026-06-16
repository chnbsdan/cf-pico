// api/wallpaper.js - 支持 folder 参数，保留去重和外部图片功能
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'Pico'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// 默认文件夹
const DEFAULT_FOLDER = 'wallpaper'

// 记录上一次返回的图片 URL
let lastReturnedUrl = null

// 获取外部图片（根据文件夹分类）
async function getExternalImages(folder) {
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
      // 根据请求的文件夹返回对应的外部图片
      if (folder === 'wallpaper') return data.wallpaper || []
      if (folder === 'cover') return data.cover || []
      if (folder === 'sh') return data.sh || []
      if (folder === 'sd') return data.sd || []
      return []
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
  
  // 通过 folder 参数选择文件夹
  // 用法：
  //   /api/wallpaper           → 从 wallpaper 读取
  //   /api/wallpaper?folder=sh → 从 sh 读取
  //   /api/wallpaper?folder=sd → 从 sd 读取
  const { folder } = req.query
  let targetFolder = DEFAULT_FOLDER
  
  if (folder === 'sh') targetFolder = 'sh'
  if (folder === 'sd') targetFolder = 'sd'
  if (folder === 'cover') targetFolder = 'cover'
  
  try {
    let allImages = []
    
    // 1. 获取目标文件夹的图片
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${targetFolder}`
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
          .filter(f => f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i) && f.name !== '.keep')
          .map(f => f.download_url)
        allImages.push(...images)
      }
    }
    
    // 2. 获取对应分类的外部图片
    const externalImages = await getExternalImages(targetFolder)
    for (const url of externalImages) {
      if (await isImageValid(url)) {
        allImages.push(url)
      }
    }
    
    if (allImages.length === 0) {
      return res.status(404).send(`No images found in ${targetFolder} folder`)
    }
    
    // 去重逻辑：如果只有一张图片，直接返回
    if (allImages.length === 1) {
      lastReturnedUrl = allImages[0]
      const imgRes = await fetch(allImages[0])
      if (!imgRes.ok) return res.status(500).send('Failed to fetch image')
      const contentType = imgRes.headers.get('Content-Type') || 'image/jpeg'
      const body = await imgRes.arrayBuffer()
      res.setHeader('Content-Type', contentType)
      return res.send(Buffer.from(body))
    }
    
    // 去重逻辑：过滤掉上一次返回的图片
    let availableImages = allImages
    if (lastReturnedUrl) {
      availableImages = allImages.filter(url => url !== lastReturnedUrl)
    }
    
    if (availableImages.length === 0) {
      availableImages = allImages
    }
    
    const randomUrl = availableImages[Math.floor(Math.random() * availableImages.length)]
    lastReturnedUrl = randomUrl
    
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
