// api/image.js - 统一的图片代理 API
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'pcbed'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const types = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'avif': 'image/avif'
  }
  return types[ext] || 'image/jpeg'
}

export default async function handler(req, res) {
  const { path } = req.query
  
  if (!path) {
    return res.status(400).send('Missing path parameter')
  }
  
  const parts = path.split('/')
  const folder = parts[0]
  const filename = parts.slice(1).join('/')
  
  if (!['wallpaper', 'cover'].includes(folder)) {
    return res.status(403).send('Invalid folder')
  }
  
  if (!filename || filename.includes('..')) {
    return res.status(403).send('Invalid filename')
  }
  
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${folder}/${filename}`
  
  try {
    const response = await fetch(rawUrl, {
      headers: GITHUB_TOKEN ? {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Serverless'
      } : {}
    })
    
    if (!response.ok) {
      return res.status(404).send('Image not found')
    }
    
    const body = await response.arrayBuffer()
    res.setHeader('Content-Type', getContentType(filename))
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Content-Disposition', 'inline')
    res.send(Buffer.from(body))
  } catch (error) {
    console.error('Proxy error:', error)
    res.status(500).send('Internal server error')
  }
}
