// functions/api/hf/[[path]].js

export async function onRequest(context) {
  const { request, env } = context
  
  // 直接从 URL 解析路径，不用 params
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/hf/', '')
  
  if (!path) {
    return new Response('Missing path', { status: 400 })
  }

  const hfToken = env.HF_TOKEN
  const hfRepo = env.HF_REPO
  
  if (!hfToken || !hfRepo) {
    return new Response('HF not configured', { status: 500 })
  }
  
  const hfUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
  
  try {
    const response = await fetch(hfUrl, {
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    
    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }
    
    const buffer = await response.arrayBuffer()
    const ext = path.split('.').pop() || ''
    const contentTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'mp4': 'video/mp4', 'webm': 'video/webm'
    }
    const contentType = contentTypes[ext] || 'image/jpeg'
    
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
