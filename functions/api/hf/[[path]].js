// functions/api/hf/[[path]].js - GET /api/hf/* HuggingFace 图片代理

export async function onRequest(context) {
  const { request, env, params } = context
  
  // 获取路径参数
  const path = params.path || ''
  
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const hfToken = env.HF_TOKEN
  const hfRepo = env.HF_REPO
  
  if (!hfToken || !hfRepo) {
    return new Response('HuggingFace 未配置', { status: 500 })
  }
  
  try {
    // 构建 HuggingFace 原始文件 URL
    const hfUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
    console.log('HF Request:', hfUrl) // 日志调试
    
    const response = await fetch(hfUrl, {
      headers: {
        'Authorization': `Bearer ${hfToken}`
      }
    })
    
    if (!response.ok) {
      console.error('HF Response Error:', response.status)
      return new Response('Image not found', { status: 404 })
    }
    
    // 获取文件扩展名，设置正确的 Content-Type
    const filename = path.split('/').pop() || ''
    const ext = filename.split('.').pop().toLowerCase()
    const contentTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'mp4': 'video/mp4', 'webm': 'video/webm'
    }
    const contentType = contentTypes[ext] || 'image/jpeg'
    
    // 直接返回响应流
    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('HuggingFace fetch error:', error)
    return new Response('HuggingFace proxy error: ' + error.message, { status: 500 })
  }
}
