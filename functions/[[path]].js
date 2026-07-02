// functions/[[path]].js - 处理 SPA 路由 + API 兜底

export async function onRequest(context) {
  const { request, params, env } = context

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  // ✅ 如果是 API 请求，交给 api/ 目录处理
  // 如果走到这里，说明 api/ 目录没有匹配的路由
  if (path.startsWith('api/')) {
    return new Response(JSON.stringify({ error: 'API not found', path }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ✅ 非 API 请求：返回 index.html（SPA 路由）
  // 直接返回 index.html 内容
  try {
    // 从环境变量获取静态文件
    // 在 Cloudflare Pages 中，静态文件通过 env.ASSETS 访问
    const assets = env.ASSETS
    if (assets) {
      const response = await assets.fetch(request)
      if (response.ok) {
        return response
      }
    }
  } catch (e) {
    console.error('从 ASSETS 获取失败:', e)
  }

  // 备用方案：从当前站点获取 index.html
  try {
    const url = new URL(request.url)
    const origin = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`
    const indexResponse = await fetch(`${origin}/index.html`)
    if (indexResponse.ok) {
      return new Response(indexResponse.body, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      })
    }
  } catch (e) {
    console.error('获取 index.html 失败:', e)
  }

  return new Response(JSON.stringify({ error: 'Not found', path }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}
