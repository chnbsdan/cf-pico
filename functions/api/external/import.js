// functions/api/external/import.js - 外链转存接口（修复版）
// 功能：下载外链图片，转存到 GitHub / R2 / Telegram / HuggingFace

import { GITHUB_USER, GITHUB_REPO, generateFilename } from '../utils/helpers.js'
import { getTelegramImages, saveTelegramImages } from '../utils/github.js'
import { uploadToTelegram } from '../utils/telegram.js'
import { uploadToHuggingFace } from '../utils/huggingface.js'

// ============================================================
// 工具函数
// ============================================================

function getFilenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop() || 'image.jpg'
    if (!filename.includes('.')) {
      return filename + '.jpg'
    }
    return filename
  } catch {
    return 'image.jpg'
  }
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': new URL(url).origin
    }
  })
  if (!response.ok) {
    throw new Error(`下载失败 (${response.status})`)
  }
  const blob = await response.blob()
  const originalFilename = getFilenameFromUrl(url)
  const ext = originalFilename.split('.').pop() || 'jpg'
  const contentType = blob.type || `image/${ext}`
  const file = new File([blob], originalFilename, { type: contentType })
  return { file, filename: originalFilename, contentType }
}

// ============================================================
// 各渠道上传函数
// ============================================================

// 上传到 GitHub
async function uploadToGitHubChannel(file, folder, env, request) {
  const token = env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN 未配置')
  
  // ✅ 复用 generateFilename
  const filename = generateFilename(file.name)
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  const base64Content = btoa(binary)
  
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Pages'
    },
    body: JSON.stringify({
      message: `Import ${filename}`,
      content: base64Content,
      branch: 'main'
    })
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub 上传失败: ${error}`)
  }
  const baseUrl = new URL(request.url).origin
  return { url: `${baseUrl}/api/image?path=${folder}/${filename}`, filename }
}

// 上传到 R2
async function uploadToR2Channel(file, folder, env, request) {
  const bucket = env.IMAGES_BUCKET
  if (!bucket) throw new Error('R2 未配置')
  
  // ✅ 复用 generateFilename
  const filename = generateFilename(file.name)
  const arrayBuffer = await file.arrayBuffer()
  const key = `${folder}/${filename}`
  await bucket.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type || 'image/jpeg' }
  })
  const baseUrl = new URL(request.url).origin
  return { url: `${baseUrl}/api/image?path=${key}`, filename }
}

// ✅ 上传到 Telegram - 严格按照正常上传的逻辑
async function uploadToTelegramChannel(file, env, request) {
  const botToken = env.TG_BOT_TOKEN
  const chatId = env.TG_CHAT_ID
  if (!botToken || !chatId) throw new Error('Telegram 未配置')
  
  // ✅ 复用 generateFilename
  const filename = generateFilename(file.name)
  
  // 调用 uploadToTelegram（只传三个参数）
  const result = await uploadToTelegram(file, botToken, chatId)
  
  const baseUrl = new URL(request.url).origin
  const fileUrl = `${baseUrl}/api/short/${filename}`
  
  // ✅ 记录到 GitHub（和正常上传完全一样）
  const token = env.GITHUB_TOKEN
  if (token) {
    try {
      const existingImages = await getTelegramImages(token)
      const exists = existingImages.some(img => img.fileId === result.fileId)
      if (!exists) {
        existingImages.push({
          id: Date.now(),
          filename: filename,
          originalName: file.name,
          fileId: result.fileId,
          messageId: result.messageId,
          filePath: result.filePath,
          url: fileUrl,
          time: new Date().toISOString(),
          size: file.size,
          mimeType: file.type || 'image/jpeg'
        })
        await saveTelegramImages(token, existingImages)
        console.log(`✅ Telegram 文件已记录到 GitHub: ${filename}`)
      }
    } catch (e) {
      console.error('记录 Telegram 文件失败:', e)
      // ⚠️ 不抛出错误，因为文件已经上传成功了，只是记录失败
    }
  }
  
  return {
    url: fileUrl,
    filename,
    fileId: result.fileId,
    messageId: result.messageId
  }
}

// ✅ 上传到 HuggingFace - 严格按照正常上传的逻辑
async function uploadToHuggingFaceChannel(file, env, request) {
  // ✅ 复用 generateFilename
  const filename = generateFilename(file.name)
  const path = filename // 直接放在根目录
  
  // ✅ 调用 uploadToHuggingFace，只传三个参数 (file, path, env)
  const result = await uploadToHuggingFace(file, path, env)
  
  if (!result.success) {
    throw new Error(result.error || 'HuggingFace 上传失败')
  }
  
  const baseUrl = new URL(request.url).origin
  return {
    url: `${baseUrl}/api/hf/${path}`,
    filename
  }
}

// ============================================================
// 主接口
// ============================================================

export async function onRequest(context) {
  const { request, env } = context
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { urls, storage, folder } = body
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: '请提供要转存的 URL 列表' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!storage) {
      return new Response(JSON.stringify({ error: '请选择存储渠道' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if ((storage === 'github' || storage === 'r2') && !folder) {
      return new Response(JSON.stringify({ error: 'GitHub/R2 需要选择文件夹' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const validUrls = urls.filter(u => u && typeof u === 'string' && u.startsWith('http'))
    if (validUrls.length === 0) {
      return new Response(JSON.stringify({ error: '没有有效的 URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const results = []
    const errors = []

    for (const url of validUrls) {
      try {
        const { file } = await downloadImage(url)
        
        let result
        switch (storage) {
          case 'github':
            result = await uploadToGitHubChannel(file, folder, env, request)
            break
          case 'r2':
            result = await uploadToR2Channel(file, folder, env, request)
            break
          case 'telegram':
            result = await uploadToTelegramChannel(file, env, request)
            break
          case 'huggingface':
            result = await uploadToHuggingFaceChannel(file, env, request)
            break
          default:
            throw new Error(`不支持的存储渠道: ${storage}`)
        }
        
        results.push({
          success: true,
          originalUrl: url,
          newUrl: result.url,
          filename: result.filename,
          storage: storage,
          folder: folder || '无'
        })
      } catch (error) {
        errors.push({
          success: false,
          originalUrl: url,
          error: error.message
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: validUrls.length,
      successCount: results.length,
      failCount: errors.length,
      results: results,
      errors: errors
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('外链转存失败:', error)
    return new Response(JSON.stringify({
      error: '转存失败',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
