// functions/api/hf/[path].js - fetch测试版
export async function onRequest(context) {
  const { request, env } = context
  
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/hf/', '')
  
  const hfToken = env.HF_TOKEN
  const hfRepo = env.HF_REPO
  
  const hfUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
  
  try {
    const response = await fetch(hfUrl, {
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    
    return new Response(JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      bodyLength: (await response.arrayBuffer()).byteLength
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
}
