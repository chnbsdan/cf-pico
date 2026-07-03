// functions/api/image.js - GET /api/image 图片代理
import { getTelegramImages } from './utils/github.js'
import { getCompletedFile, getTelegramFileContentByFileId } from './utils/telegram.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN
  const parts = path.split('/')
  const folder = parts[0]
  const filename = parts.slice(1).join('/')
  const allowedFolders = ['wallpaper', 'cover', 'sh', 'sd', 'telegram', 'huggingface']

  if (!allowedFolders.includes(folder)) {
    return new Response('Invalid folder', { status: 403 })
  }

  // ============================================================
  // HuggingFace 存储
  // ============================================================
  if (folder === 'huggingface') {
    const hfToken = env.HF_TOKEN
    const hfRepo = env.HF_REPO
    
    if (!hfToken || !hfRepo) {
      return new Response('HuggingFace 未配置', { status: 500 })
    }
    
    try {
      // 去掉开头的 huggingface/，得到真实路径
      const realPath = parts.slice(1).join('/')
      const hfUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${realPath}`
      const response = await fetch(hfUrl, {
        headers: {
          'Authorization': `Bearer ${hfToken}`
        }
      })
      
      if (!response.ok) {
        return new Response('Image not found', { status: 404 })
      }
      
      const ext = filename.split('.').pop().toLowerCase()
      const contentTypes = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
        'mp4': 'video/mp4', 'webm': 'video/webm'
      }
      const contentType = contentTypes[ext] || 'image/jpeg'
      const body = await response.arrayBuffer()
      
      return new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      console.error('HuggingFace fetch error:', error)
      return new Response('HuggingFace proxy error', { status: 500 })
    }
  }

  // ============================================================
  // Telegram 文件
  // ============================================================
  if (folder === 'telegram') {
    const botToken = env.TG_BOT_TOKEN;
    if (!botToken) {
      return new Response('Telegram 未配置', { status: 500 });
    }

    let fileId = null

    if (bucket) {
      const metaKey = `completed_files/${filename}.json`
      try {
        const object = await bucket.get(metaKey)
        if (object) {
          const content = await object.text()
          const meta = JSON.parse(content)
          if (meta.fileId) {
            fileId = meta.fileId
          }
        }
      } catch (e) {}
    }

    if (!fileId && token) {
      try {
        const images = await getTelegramImages(token)
        const record = images.find(img => img.filePath === filename || img.fileId === filename)
        if (record) {
          fileId = record.fileId
        }
      } catch (e) {}
    }

    if (!fileId) {
      fileId = filename
    }

    try {
      return await getTelegramFileContentByFileId(botToken, fileId)
    } catch (error) {
      console.error('Telegram fetch error:', error)
      return new Response(`Telegram 文件获取失败: ${error.message}`, { status: 404 })
    }
  }

  // ============================================================
  // R2 存储
  // ============================================================
  if (bucket) {
    try {
      const object = await bucket.get(path)
      if (object) {
        const contentType = object.httpMetadata?.contentType || 'image/jpeg'
        const body = await object.arrayBuffer()
        
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    } catch (e) {
      console.log('R2 miss, trying GitHub:', e.message)
    }
  }

  // ============================================================
  // GitHub 存储
  // ============================================================
  if (!token) {
    return new Response('GITHUB_TOKEN not configured', { status: 500 })
  }

  const rawUrl = `https://raw.githubusercontent.com/chnbsdan/cf-pico/main/${folder}/${filename}`

  try {
    const response = await fetch(rawUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }

    const ext = filename.split('.').pop().toLowerCase()
    const contentTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'mp4': 'video/mp4', 'webm': 'video/webm'
    }
    const contentType = contentTypes[ext] || 'image/jpeg'
    const body = await response.arrayBuffer()

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('GitHub fetch error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
