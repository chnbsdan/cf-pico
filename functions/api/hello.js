export async function onRequest(context) {
  return new Response('Hello from Cloudflare Pages Functions!', {
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
