// functions/api/external/random.js - GET /api/external/random
// 从外部图源中随机返回一张图片

export async function onRequest(context) {
  const { env } = context
  const token = env.GITHUB_TOKEN

  if (!token) {
    return new Response('GITHUB_TOKEN 未配置', { status: 500 })
  }

  try {
    // 1. 读取 external.json
    const GITHUB_USER = 'chnbsdan'
    const GITHUB_REPO = 'cf-pico'
    const extUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
    
    const response = await fetch(extUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    
    if (!response.ok) {
      return new Response('Failed to fetch external images', { status: 500 })
    }
    
    const data = await response.json()
    const content = atob(data.content)
    const external = JSON.parse(content)
    
    // 2. 收集所有外链 URL
    const folders = ['wallpaper', 'cover', 'sh', 'sd']
    let allUrls = []
    for (const folder of folders) {
      if (external[folder]) {
        allUrls = allUrls.concat(external[folder])
      }
    }
    
    if (allUrls.length === 0) {
      return new Response('No external images found', { status: 404 })
    }
    
    // 3. 随机选一个 URL
    const randomUrl = allUrls[Math.floor(Math.random() * allUrls.length)]
    
    // 4. 获取图片并返回
    const imageResponse = await fetch(randomUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!imageResponse.ok) {
      return new Response('Failed to fetch image', { status: imageResponse.status })
    }
    
    // 5. 获取 Content-Type
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg'
    const body = await imageResponse.arrayBuffer()
    
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
    
  } catch (error) {
    console.error('External random error:', error)
    return new Response('Internal error', { status: 500 })
  }
}
