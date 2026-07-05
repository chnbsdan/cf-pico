// functions/api/stats.js - GET /api/stats
import { getFolderImages, getTelegramImages } from './utils/github.js'
import { listFilesFromHuggingFace } from './utils/huggingface.js'

export async function onRequest(context) {
  const { env } = context
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  const GITHUB_USER = 'chnbsdan'
  const GITHUB_REPO = 'cf-pico'
  
  const githubFolders = {}
  let githubTotal = 0
  let externalTotal = 0
  let telegramTotal = 0
  let huggingfaceTotal = 0

  for (const folder of folders) {
    const images = await getFolderImages(folder, token)
    githubFolders[folder] = images.length
    githubTotal += images.length
  }

  if (token) {
    const telegramImages = await getTelegramImages(token)
    telegramTotal = telegramImages.length
    
    if (bucket) {
      try {
        const objects = await bucket.list({ prefix: 'completed_files/' })
        telegramTotal += objects.objects.length
      } catch (e) {}
    }
    
    try {
      const extUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
      const response = await fetch(extUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Cloudflare-Pages'
        }
      })
      if (response.ok) {
        const data = await response.json()
        const content = atob(data.content)
        const external = JSON.parse(content)
        for (const folder of folders) {
          externalTotal += (external[folder] || []).length
        }
      }
    } catch (e) {
      console.error('Failed to fetch external.json:', e)
    }
  }

  // ✅ HuggingFace 统计
  if (env.HF_TOKEN && env.HF_REPO) {
    try {
      const result = await listFilesFromHuggingFace(env)
      if (result.success) {
        huggingfaceTotal = result.total || result.files?.length || 0
      }
    } catch (e) {
      console.error('Failed to get HuggingFace count:', e)
    }
  }

  return new Response(JSON.stringify({
    github_folders: githubFolders,
    github_total: githubTotal,
    external_total: externalTotal,
    telegram_total: telegramTotal,
    huggingface_total: huggingfaceTotal,
    grand_total: githubTotal + externalTotal + telegramTotal + huggingfaceTotal
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
