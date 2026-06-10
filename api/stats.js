// api/stats.js - 返回统计信息（各文件夹图片数量）
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
    const stats = {
      github_folders: {},
      github_total: 0,
      external_total: 0,
      grand_total: 0
    }
    
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
          const count = files.filter(f => f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)).length
          stats.github_folders[folder] = count
          stats.github_total += count
        } else {
          stats.github_folders[folder] = 0
        }
      } else {
        stats.github_folders[folder] = 0
      }
    }
    
    stats.grand_total = stats.github_total + stats.external_total
    
    res.status(200).json(stats)
  } catch (error) {
    console.error('Error in stats.js:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
