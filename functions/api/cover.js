// functions/api/cover.js - GET /api/cover
import { getFolderImages } from './utils/github.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'cover'
  const token = env.GITHUB_TOKEN
  
  const images = await getFolderImages(folder, token)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}