// functions/[[path]].js - 路由分发（完整版）
export async function onRequest(context) {
  const { request, params, env } = context

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  console.log(`请求路径: ${path}`)

  // ============================================================
  // 1. 静态资源直接放行（让 Pages 处理）
  // ============================================================
  const staticExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'css', 'js', 'woff', 'woff2', 'ttf', 'eot', 'json', 'xml', 'txt']
  const ext = path.split('.').pop()
  if (staticExts.includes(ext)) {
    // 不处理，让 Cloudflare Pages 直接返回静态文件
    return new Response(null, { status: 404 })
  }

  // ============================================================
  // 2. API 请求交给 api/ 目录
  // ============================================================
  if (path.startsWith('api/')) {
    // 如果 api/ 目录没有匹配，返回 404
    return new Response(JSON.stringify({ error: 'API not found', path }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ============================================================
  // 3. 非 API 请求返回 index.html（SPA 路由）
  // ============================================================
  try {
    const url = new URL(request.url)
    const origin = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`
    const indexResponse = await fetch(`${origin}/index.html`)
    if (indexResponse.ok) {
      return new Response(indexResponse.body, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
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
