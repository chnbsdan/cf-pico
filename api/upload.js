// api/upload.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
  const GITHUB_REPO = process.env.GITHUB_REPO || 'pcbed'
  
  if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN missing' })
  
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    const contentType = req.headers['content-type'] || ''
    const boundary = getBoundary(contentType)
    if (!boundary) return res.status(400).json({ error: 'Cannot parse boundary' })
    
    const formData = parseMultipart(buffer, boundary)
    const file = formData.file
    const targetFolder = formData.folder || 'wallpaper'
    
    if (!file || !file.data) return res.status(400).json({ error: 'No file uploaded' })
    if (file.size > 10 * 1024 * 1024) return res.status(400).json({ error: 'File too large' })
    
    const ext = file.filename.split('.').pop().toLowerCase()
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file format' })
    }
    
    const now = new Date()
    const datePrefix = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
    const originalName = file.filename.replace(/\.[^/.]+$/, '')
    const safeName = originalName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    const filename = `${datePrefix}_${safeName}.${ext}`
    const base64Content = file.data.toString('base64')
    
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${targetFolder}/${filename}`
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: `Upload ${filename}`, content: base64Content, branch: 'main' })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('GitHub API error:', errorText)
      return res.status(response.status).json({ error: 'GitHub upload failed' })
    }
    
    const host = req.headers.host
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    // 🔧 修改：使用代理 API 格式
    const fullUrl = `${protocol}://${host}/api/image?path=${targetFolder}/${filename}`
    
    res.status(200).json({ success: true, filename, folder: targetFolder, url: fullUrl })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function getBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  return match ? (match[1] || match[2]) : null
}

function parseMultipart(buffer, boundary) {
  const result = {}
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  
  let start = 0
  let end = buffer.indexOf(boundaryBuffer, start)
  
  while (end !== -1) {
    start = end + boundaryBuffer.length
    let nextBoundary = buffer.indexOf(boundaryBuffer, start)
    let partEnd = nextBoundary !== -1 ? nextBoundary : buffer.length
    
    if (buffer[start] === 13 && buffer[start+1] === 10) {
      start += 2
    }
    
    const part = buffer.slice(start, partEnd)
    if (part.length === 0) {
      end = nextBoundary
      continue
    }
    
    let headerEnd = -1
    for (let i = 0; i < part.length - 3; i++) {
      if (part[i] === 13 && part[i+1] === 10 && part[i+2] === 13 && part[i+3] === 10) {
        headerEnd = i
        break
      }
    }
    
    if (headerEnd === -1) {
      end = nextBoundary
      continue
    }
    
    const headers = part.slice(0, headerEnd).toString()
    const content = part.slice(headerEnd + 4)
    
    const nameMatch = headers.match(/name="([^"]+)"/)
    if (!nameMatch) {
      end = nextBoundary
      continue
    }
    
    const name = nameMatch[1]
    
    if (headers.includes('filename')) {
      const filenameMatch = headers.match(/filename="([^"]+)"/)
      const contentEnd = content.length >= 2 && content[content.length-2] === 13 && content[content.length-1] === 10 
        ? content.length - 2 
        : content.length
      const fileData = content.slice(0, contentEnd)
      
      result[name] = {
        filename: filenameMatch ? filenameMatch[1] : 'unknown',
        data: Buffer.from(fileData),
        size: fileData.length
      }
    } else {
      const textEnd = content.length >= 2 && content[content.length-2] === 13 && content[content.length-1] === 10
        ? content.length - 2
        : content.length
      result[name] = content.slice(0, textEnd).toString()
    }
    
    end = nextBoundary
  }
  
  return result
}
