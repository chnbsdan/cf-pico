// functions/api/hf/[[path]].js

export async function onRequest(context) {
  const { request, env, params } = context
  
  // 获取完整路径
  const path = params.path || ''
  
  if (!path) {
    return new Response('Missing path', { status: 400 })
  }

  const hfToken = env.HF_TOKEN
  const hfRepo = env.HF_REPO
  
  if (!hfToken || !hfRepo) {
    return new Response('HF not configured', { status: 500 })
  }
  
  // 直接拼接 HF 原始地址
  const hfUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
  
  try {
    const response = await fetch(hfUrl, {
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    
    // 如果 HF 返回 404，尝试去掉 main 再试一次
    if (response.status === 404) {
      const hfUrl2 = `https://huggingface.co/datasets/${hfRepo}/resolve/main/${path}`
      const response2 = await fetch(hfUrl2, {
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'User-Agent': 'Cloudflare-Pages'
        }
      })
      if (response2.ok) {
        const buffer2 = await response2.arrayBuffer()
        const ext2 = path.split('.').pop() || ''
        const contentTypes = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
          'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
          'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
          'mp4': 'video/mp4', 'webm': 'video/webm'
        }
        const contentType = contentTypes[ext2] || 'image/jpeg'
        return new Response(buffer2, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    }
    
    if (!response.ok) {
      return new Response(`Image not found (${response.status})`, { status: 404 })
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
    return new Response('Proxy error: ' + error.message, { status: 500 })
  }
}
