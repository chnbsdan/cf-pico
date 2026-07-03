// functions/api/hf/[path].js - HuggingFace 图片代理

export async function onRequest(context) {
  const { request, env } = context
  
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/hf/', '')
  
  if (!path) {
    return new Response('Missing path', { status: 400 })
  }

  const hfRepo = env.HF_REPO
  
  if (!hfRepo) {
    return new Response('HF_REPO not configured', { status: 500 })
  }
  
  const hfUrl = `https://huggingface.co/datasets/${hfRepo}/resolve/main/${path}`
  
  try {
    const response = await fetch(hfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://huggingface.co/'
      }
    })
    
    if (!response.ok) {
      const rawUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
      const retryResponse = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': 'https://huggingface.co/'
        }
      })
      
      if (!retryResponse.ok) {
        return new Response('Image not found', { status: 404 })
      }
      
      const buffer = await retryResponse.arrayBuffer()
      const ext = path.split('.').pop() || ''
      const contentTypeMap = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
        'mp4': 'video/mp4', 'webm': 'video/webm'
      }
      const contentType = contentTypeMap[ext] || 'image/jpeg'
      
      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    const buffer = await response.arrayBuffer()
    const ext = path.split('.').pop() || ''
    const contentTypeMap = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'mp4': 'video/mp4', 'webm': 'video/webm'
    }
    const contentType = contentTypeMap[ext] || 'image/jpeg'
    
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('HF proxy error:', error)
    return new Response('Proxy error', { status: 500 })
  }
}
