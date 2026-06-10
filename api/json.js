// api/json.js - 返回随机图片的 JSON 格式信息
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'imgbed-storage'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const FOLDERS = ['wallpaper', 'cover']

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    let allImages = []
    
    for (const folder of FOLDERS) {
      const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}`
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'Vercel-Serverless'
        }
      })
      
      if (response.ok) {
        const files = await response.json()
        if (Array.isArray(files)) {
          const images = files.filter(f => f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
          allImages.push(...images)
        }
      }
    }
    
    if (allImages.length === 0) {
      return res.status(404).json({ error: 'No images found' })
    }
    
    const random = allImages[Math.floor(Math.random() * allImages.length)]
    const host = req.headers.host || ''
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    
    res.status(200).json({
      code: '200',
      imgurl: `${protocol}://${host}/api/random`,
      source: random.download_url,
      filename: random.name,
      id: random.name.replace(/\.[^/.]+$/, ''),
      total: allImages.length
    })
  } catch (error) {
    console.error('Error in json.js:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
