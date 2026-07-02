// functions/[[path]].js - 只处理 API 和 SPA 路由
export async function onRequest(context) {
  const { request, params } = context

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  // 静态文件让 _redirects 处理，这里直接返回 404 跳过
  const staticExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'css', 'js', 'woff', 'woff2', 'ttf', 'eot']
  const ext = path.split('.').pop()
  if (staticExts.includes(ext)) {
    return new Response(null, { status: 404 })
  }

  // API 请求
  if (path.startsWith('api/')) {
    return new Response(JSON.stringify({ error: 'API not found', path }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // SPA 路由
  try {
    const url = new URL(request.url)
    const origin = `${url.protocol}//${url.hostname}`
    const indexResponse = await fetch(`${origin}/index.html`)
    if (indexResponse.ok) {
      return new Response(indexResponse.body, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      })
    }
  } catch (e) {}

  return new Response('Not found', { status: 404 })
}
