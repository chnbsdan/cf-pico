// functions/[[path]].js - 只处理 API，其他让 _redirects 处理
export async function onRequest(context) {
  const { request, params } = context

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  // ✅ 只处理 API 请求
  if (path.startsWith('api/')) {
    return new Response(JSON.stringify({ error: 'API not found', path }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ✅ 非 API 请求返回 404，让 _redirects 处理
  return new Response(null, { status: 404 })
}
