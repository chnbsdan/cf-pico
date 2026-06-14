// api/history.js - 上传历史记录 API
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'pcbed'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const HISTORY_FILE = 'upload_history.json'  // 存储历史记录的文件名

// 获取历史记录
async function getHistory() {
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${HISTORY_FILE}`
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Serverless'
      }
    })
    
    if (response.status === 404) {
      // 文件不存在，返回空数组
      return { history: [], sha: null }
    }
    
    if (response.ok) {
      const data = await response.json()
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return { history: JSON.parse(content), sha: data.sha }
    }
    
    return { history: [], sha: null }
  } catch (error) {
    console.error('Failed to get history:', error)
    return { history: [], sha: null }
  }
}

// 保存历史记录
async function saveHistory(history, sha) {
  const content = Buffer.from(JSON.stringify(history, null, 2)).toString('base64')
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${HISTORY_FILE}`
  
  const body = {
    message: `Update upload history`,
    content: content,
    branch: 'main'
  }
  
  if (sha) {
    body.sha = sha
  }
  
  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  })
  
  return response.ok
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // 获取历史记录
  if (req.method === 'GET') {
    const { history } = await getHistory()
    return res.status(200).json({ success: true, history })
  }
  
  // 添加历史记录
  if (req.method === 'POST') {
    const { filename, url, folder } = req.body
    
    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' })
    }
    
    const { history, sha } = await getHistory()
    
    const newRecord = {
      id: Date.now(),
      filename,
      url,
      folder,
      time: new Date().toISOString()
    }
    
    history.unshift(newRecord)  // 最新记录放在最前面
    
    // 只保留最近 100 条
    const trimmedHistory = history.slice(0, 100)
    
    const success = await saveHistory(trimmedHistory, sha)
    
    if (success) {
      return res.status(200).json({ success: true, history: trimmedHistory })
    } else {
      return res.status(500).json({ error: 'Failed to save history' })
    }
  }
  
  // 删除历史记录
  if (req.method === 'DELETE') {
    const { id } = req.query
    
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }
    
    const { history, sha } = await getHistory()
    const newHistory = history.filter(record => record.id !== parseInt(id))
    const success = await saveHistory(newHistory, sha)
    
    if (success) {
      return res.status(200).json({ success: true })
    } else {
      return res.status(500).json({ error: 'Failed to delete history' })
    }
  }
  
  res.status(405).json({ error: 'Method not allowed' })
}
