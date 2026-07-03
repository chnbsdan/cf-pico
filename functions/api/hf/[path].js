// functions/api/hf/[path].js - GET /api/hf/{path} HuggingFace 图片代理

export async function onRequest(context) {
  const { request, env, params } = context
  const path = params.path
  
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const hfToken = env.HF_TOKEN
  const hfRepo = env.HF_REPO
  
  if (!hfToken || !hfRepo) {
    return new Response('HuggingFace 未配置', { status: 500 })
  }
  
  try {
    const hfUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
    const response = await fetch(hfUrl, {
      headers: {
        'Authorization': `Bearer ${hfToken}`
      }
    })
    
    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }
    
    const filename = path.split('/').pop() || ''
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
