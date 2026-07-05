// functions/api/hf/random.js - GET /api/hf/random
// 从 HuggingFace 存储中随机返回一张图片

import { listFilesFromHuggingFace } from '../utils/huggingface.js'

export async function onRequest(context) {
  const { env } = context

  // 1. 检查 HuggingFace 是否已配置
  if (!env.HF_TOKEN || !env.HF_REPO) {
    return new Response('HuggingFace 未配置', { status: 500 })
  }

  try {
    // 2. 获取 HuggingFace 中的所有文件列表
    const result = await listFilesFromHuggingFace(env)
    if (!result.success || result.files.length === 0) {
      return new Response('No images found in HuggingFace storage', { status: 404 })
    }

    // 3. 随机选取一个文件
    const randomIndex = Math.floor(Math.random() * result.files.length)
    const randomFile = result.files[randomIndex]

    // 4. 获取该文件的原始内容（通过 HuggingFace 直链）
    const hfUrl = `https://huggingface.co/datasets/${env.HF_REPO}/resolve/main/${randomFile.path}`
    const response = await fetch(hfUrl, {
      headers: {
        'Authorization': `Bearer ${env.HF_TOKEN}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status })
    }

    // 5. 获取文件扩展名，设置正确的 Content-Type
    const filename = randomFile.path.split('/').pop() || ''
    const ext = filename.split('.').pop().toLowerCase()
    const contentTypeMap = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'mp4': 'video/mp4', 'webm': 'video/webm'
    }
    const contentType = contentTypeMap[ext] || 'image/jpeg'
    const body = await response.arrayBuffer()

    // 6. 返回图片
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('HF random error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
