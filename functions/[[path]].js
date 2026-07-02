// functions/[[path]].js - 路由分发（精简版）
// 所有路由已拆分到 api/ 目录下，此文件只做兜底

export async function onRequest(context) {
  const { request, params } = context
  const method = request.method

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  console.log(`API 请求: ${method} ${path}`)

  // 所有路由都在 api/ 目录下处理
  // 如果走到这里，说明没有匹配的路由
  return new Response(JSON.stringify({ error: 'API not found', path }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}