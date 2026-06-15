// api/cover.js - 仅返回 cover 文件夹的随机图片 + cover 分类的外部图片
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'imgbed-storage'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const FOLDER = 'sd'

// 从 GitHub 存储仓库读取 cover 分类的外部图片
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
      // 只返回 cover 分类的外部图片
      return data.cover || []
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
    
    // 1. 获取 cover 文件夹的图片
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
    
    // 2. 获取 cover 分类的外部图片
    const externalImages = await getExternalImages()
    for (const url of externalImages) {
      if (await isImageValid(url)) {
        allImages.push(url)
      }
    }
    
    if (allImages.length === 0) {
      return res.status(404).send('No images found')
    }
    
    const randomUrl = allImages[Math.floor(Math.random() * allImages.length)]
    const imgRes = await fetch(randomUrl)
    
    if (!imgRes.ok) {
      return res.status(500).send('Failed to fetch image')
    }
    
    const contentType = imgRes.headers.get('Content-Type') || 'image/jpeg'
    const body = await imgRes.arrayBuffer()
    
    res.setHeader('Content-Type', contentType)
    res.send(Buffer.from(body))
  } catch (error) {
    console.error('Error in cover.js:', error)
    res.status(500).send('Internal error')
  }
}
