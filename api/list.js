// api/admin/list.js - 最终完美版本
// 功能：获取所有文件夹（wallpaper、cover、sh、sd）的图片列表
// 特点：并行请求、错误容忍、过滤 .keep 文件、支持外部图片
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'Pico'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// 需要读取的文件夹列表（按需添加）
const FOLDERS = ['wallpaper', 'cover', 'sh', 'sd']

// 获取单个文件夹的图片（REST API，最稳定）
async function getFolderImages(folder) {
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}`
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Serverless'
      }
    })
    
    // 文件夹不存在或为空，返回空数组（不报错）
    if (!response.ok) {
      console.log(`[${folder}] 文件夹不存在或为空: ${response.status}`)
      return []
    }
    
    const files = await response.json()
    if (!Array.isArray(files)) return []
    
    // 过滤出图片文件，排除 .keep 等非图片文件
    return files
      .filter(f => {
        const ext = f.name.split('.').pop().toLowerCase()
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)
        const isKeepFile = f.name === '.keep'
        return isImage && !isKeepFile
      })
      .map(f => ({
        name: f.name,
        url: f.download_url,
        path: f.path,
        sha: f.sha,
        size: f.size,
        folder: folder,
        source: 'github'
      }))
  } catch (error) {
    console.error(`[${folder}] 获取失败:`, error.message)
    return []
  }
}

// 获取外部图片（从 external.json 读取）
async function getExternalImages() {
  const emptyResult = { wallpaper: [], cover: [], sh: [], sd: [] }
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Vercel-Serverless'
      }
    })
    
    if (!response.ok) {
      console.log('external.json 不存在，跳过外部图片')
      return emptyResult
    }
    
    const data = await response.json()
    const result = {}
    
    for (const folder of FOLDERS) {
      const urls = data[folder] || []
      result[folder] = urls.map(url => ({
        name: url.split('/').pop(),
        url: url,
        folder: folder,
        source: 'external'
      }))
    }
    return result
  } catch (error) {
    console.error('获取外部图片失败:', error.message)
    return emptyResult
  }
}

export default async function handler(req, res) {
  // 设置 CORS 和缓存头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // 检查 Token
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN 未配置')
    return res.status(500).json({ error: 'GitHub Token 未配置' })
  }
  
  try {
    // 并行获取所有文件夹的图片（提高性能）
    const folderPromises = FOLDERS.map(folder => getFolderImages(folder))
    const folderResults = await Promise.all(folderPromises)
    
    // 构建结果对象
    const results = {}
    let totalCount = 0
    
    for (let i = 0; i < FOLDERS.length; i++) {
      const folder = FOLDERS[i]
      results[folder] = folderResults[i]
      totalCount += results[folder].length
    }
    
    // 获取外部图片并合并
    const externalImages = await getExternalImages()
    for (const folder of FOLDERS) {
      const external = externalImages[folder] || []
      results[folder] = [...results[folder], ...external]
      totalCount += external.length
    }
    
    // 返回成功响应
    res.status(200).json({
      success: true,
      total: totalCount,
      folders: results
    })
  } catch (error) {
    console.error('API 错误:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    })
  }
}
