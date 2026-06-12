// api/img/[filename].js
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'pcbed'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// 根据文件扩展名获取正确的 Content-Type
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const types = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'avif': 'image/avif',
    'svg': 'image/svg+xml'
  }
  return types[ext] || 'image/jpeg'
}

export default async function handler(req, res) {
  const { filename } = req.query
  
  if (!filename) {
    return res.status(400).send('Filename required')
  }
  
  // 设置响应头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  // 关键：强制浏览器显示而不是下载
  res.setHeader('Content-Disposition', 'inline')
  // 关键：手动设置 Content-Type
  res.setHeader('Content-Type', getContentType(filename))
  
  const folders = ['wallpaper', 'cover']
  
  try {
    for (const folder of folders) {
      const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'Vercel-Serverless'
        }
      })
      
      if (response.ok) {
        const body = await response.arrayBuffer()
        return res.send(Buffer.from(body))
      }
    }
    
    return res.status(404).send('Image not found')
  } catch (error) {
    console.error('Image proxy error:', error)
    res.status(500).send('Internal error')
  }
}
