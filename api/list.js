// api/list.js - 图片列表
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'imgbed-storage'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const FOLDERS = ['wallpaper', 'cover']

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
      return data.images || []
    }
  } catch (error) {
    console.error('Failed to fetch external images:', error)
  }
  return []
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    const result = {}
    let totalCount = 0
    
    // 获取 GitHub 图片
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
          const images = files
            .filter(f => f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i))
            .map(f => ({
              name: f.name,
              url: f.download_url,
              source: 'github'
            }))
          result[folder] = images
          totalCount += images.length
        } else {
          result[folder] = []
        }
      } else {
        result[folder] = []
      }
    }
    
    // 获取外部图片
    const externalImages = await getExternalImages()
    result.external = externalImages.map(url => ({
      name: url.split('/').pop(),
      url: url,
      source: 'external'
    }))
    totalCount += externalImages.length
    
    res.status(200).json({
      total: totalCount,
      folders: result
    })
  } catch (error) {
    console.error('Error in list.js:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
