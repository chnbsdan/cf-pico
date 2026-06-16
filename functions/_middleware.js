// functions/_middleware.js - Cloudflare Pages 中间件
// 用于处理全局请求，如设置响应头等

/**
 * Cloudflare Pages 中间件
 * 在每个请求之前执行
 */
export async function onRequest(context) {
  const { request, next } = context

  // 获取响应
  const response = await next()

  // 添加安全头
  const newHeaders = new Headers(response.headers)

  // 添加 CORS 头
  newHeaders.set('Access-Control-Allow-Origin', '*')
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 添加安全头
  newHeaders.set('X-Content-Type-Options', 'nosniff')
  newHeaders.set('X-Frame-Options', 'DENY')

  // 返回修改后的响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}

// 配置中间件匹配的路由
export const config = {
  // 匹配所有 API 路由
  matcher: '/api/*'
}
