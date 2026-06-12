// api/admin/delete.js - 删除图片 API（完善版）
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'pcbed'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN missing' })
  }
  
  try {
    const { filename, folder, sha, source } = req.body
    
    // 外部图片不能删除
    if (source === 'external') {
      return res.status(400).json({ error: '外部图片无法删除，请手动管理' })
    }
    
    if (!filename || !folder) {
      return res.status(400).json({ error: 'Missing filename or folder' })
    }
    
    // 先获取文件的当前 SHA（如果前端没有传递）
    let fileSha = sha
    if (!fileSha) {
      const getUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'Vercel-Serverless'
        }
      })
      
      if (!getResponse.ok) {
        return res.status(404).json({ error: '文件不存在' })
      }
      
      const fileData = await getResponse.json()
      fileSha = fileData.sha
    }
    
    // 调用 GitHub API 删除文件
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Delete ${filename}`,
        sha: fileSha,
        branch: 'main'
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('GitHub delete error:', error)
      return res.status(response.status).json({ error: 'GitHub 删除失败' })
    }
    
    res.status(200).json({ success: true, message: `已删除 ${filename}` })
  } catch (error) {
    console.error('Delete error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
