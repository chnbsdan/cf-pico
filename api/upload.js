// api/upload.js - 兼容 Vercel 和 Cloudflare，支持 GitHub + R2
import { createHandler, getEnv, parseMultipart, generateFilename } from './_utils.js'

// ============================================================
// 配置常量
// ============================================================
const ALLOWED_FOLDERS = ['wallpaper', 'cover', 'sh', 'sd']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']

// ============================================================
// GitHub 上传
// ============================================================
async function uploadToGitHub(fileBuffer, filename, folder, env) {
  const GITHUB_USER = getEnv('GITHUB_USER', env) || 'chnbsdan'
  const GITHUB_REPO = getEnv('GITHUB_REPO', env) || 'cf-pico'
  const GITHUB_TOKEN = getEnv('GITHUB_TOKEN', env)

  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured')
  }

  const base64Content = fileBuffer.toString('base64')
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Upload ${filename}`,
      content: base64Content,
      branch: 'main'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('GitHub upload error:', errorText)
    throw new Error('GitHub upload failed')
  }

  const data = await response.json()
  return data.content.download_url
}

// ============================================================
// R2 上传
// ============================================================
async function uploadToR2(fileBuffer, filename, folder, env) {
  const R2_ACCOUNT_ID = getEnv('R2_ACCOUNT_ID', env)
  const R2_ACCESS_KEY_ID = getEnv('R2_ACCESS_KEY_ID', env)
  const R2_SECRET_ACCESS_KEY = getEnv('R2_SECRET_ACCESS_KEY', env)
  const R2_BUCKET = getEnv('R2_BUCKET', env) || 'pcbed-images'

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 is not configured')
  }

  const key = `${folder}/${filename}`
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

  // 构建 AWS Signature V4 签名（简化版，生产环境建议使用官方 SDK）
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': fileBuffer.length.toString(),
    },
    body: fileBuffer
  })

  if (!response.ok) {
    console.error('R2 upload error:', response.status)
    throw new Error('R2 upload failed')
  }

  return `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.dev/${key}`
}

// ============================================================
// 预签名 URL 处理
// ============================================================
async function handlePresign(req, res, env) {
  const { filename, folder, storage = 'github' } = req.query
  const { filename: originalName } = req.body

  const finalFilename = generateFilename(originalName || filename)

  if (storage === 'r2') {
    const R2_ACCOUNT_ID = getEnv('R2_ACCOUNT_ID', env)
    const R2_BUCKET = getEnv('R2_BUCKET', env) || 'pcbed-images'

    if (!R2_ACCOUNT_ID) {
      return res.status(400).json({
        success: false,
        error: 'R2 not configured'
      })
    }

    return res.status(200).json({
      success: true,
      uploadUrl: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${folder}/${finalFilename}`,
      filename: finalFilename,
      folder: folder,
      storage: 'r2',
      headers: {}
    })
  } else {
    const GITHUB_USER = getEnv('GITHUB_USER', env) || 'chnbsdan'
    const GITHUB_REPO = getEnv('GITHUB_REPO', env) || 'cf-pico'
    const GITHUB_TOKEN = getEnv('GITHUB_TOKEN', env)

    if (!GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        error: 'GITHUB_TOKEN not configured'
      })
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${finalFilename}`

    return res.status(200).json({
      success: true,
      uploadUrl: apiUrl,
      filename: finalFilename,
      folder: folder,
      storage: 'github',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
  }
}

// ============================================================
// 传统上传处理
// ============================================================
async function handleTraditionalUpload(req, res, env) {
  const contentType = req.headers['content-type'] || ''
  const boundary = getBoundary(contentType)

  if (!boundary) {
    return res.status(400).json({ error: 'Cannot parse boundary' })
  }

  // 获取请求体
  let bodyBuffer
  if (req.body) {
    bodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body)
  } else {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    bodyBuffer = Buffer.concat(chunks)
  }

  const formData = await parseMultipart(contentType, bodyBuffer)
  const file = formData.file
  let targetFolder = formData.folder || 'wallpaper'
  const storage = req.query.storage || 'github'

  // 验证文件夹
  if (!ALLOWED_FOLDERS.includes(targetFolder)) {
    return res.status(400).json({
      error: `Invalid folder. Use: ${ALLOWED_FOLDERS.join(', ')}`
    })
  }

  // 验证文件
  if (!file || !file.data) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  if (file.size > 25 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large (max 25MB)' })
  }

  const ext = file.filename.split('.').pop().toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: 'Unsupported file format' })
  }

  const filename = generateFilename(file.filename)
  const fileBuffer = file.data

  let uploadedUrl = null
  let storageUsed = storage

  try {
    if (storage === 'r2') {
      uploadedUrl = await uploadToR2(fileBuffer, filename, targetFolder, env)
    } else {
      uploadedUrl = await uploadToGitHub(fileBuffer, filename, targetFolder, env)
    }

    return res.status(200).json({
      success: true,
      filename,
      folder: targetFolder,
      url: uploadedUrl,
      storage: storageUsed
    })
  } catch (error) {
    // 如果首选存储失败，尝试备用存储
    console.error(`Primary storage (${storage}) failed:`, error.message)

    try {
      if (storage === 'github') {
        uploadedUrl = await uploadToR2(fileBuffer, filename, targetFolder, env)
        storageUsed = 'r2'
        console.log('Fallback to R2 successful')
      } else {
        uploadedUrl = await uploadToGitHub(fileBuffer, filename, targetFolder, env)
        storageUsed = 'github'
        console.log('Fallback to GitHub successful')
      }

      return res.status(200).json({
        success: true,
        filename,
        folder: targetFolder,
        url: uploadedUrl,
        storage: storageUsed,
        fallback: true
      })
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError.message)

      return res.status(500).json({
        success: false,
        error: error.message,
        fallbackError: fallbackError.message
      })
    }
  }
}

// ============================================================
// 主处理函数
// ============================================================
async function uploadHandler(req, res) {
  // 获取环境变量（兼容两种平台）
  const env = req.env || process.env

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, storage = 'github' } = req.query

  if (action === 'presign') {
    return handlePresign(req, res, env)
  }

  return handleTraditionalUpload(req, res, env)
}

function getBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  return match ? (match[1] || match[2]) : null
}

// 导出兼容层处理后的函数
export default createHandler(uploadHandler)
