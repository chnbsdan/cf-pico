// functions/api/list.js - GET /api/list
import { getFolderImages, getTelegramImages } from './utils/github.js'

export async function onRequest(context) {
  const { env } = context
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  const results = {}
  let total = 0

  let telegramImages = []
  if (token) {
    telegramImages = await getTelegramImages(token)
  }
  
  let chunkFiles = []
  if (bucket) {
    try {
      const objects = await bucket.list({ prefix: 'completed_files/' })
      for (const obj of objects.objects) {
        try {
          const object = await bucket.get(obj.key)
          if (object) {
            const content = await object.text()
            const meta = JSON.parse(content)
            chunkFiles.push({
              ...meta,
              fromR2: true,
              name: meta.filename || 'unknown'
            })
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  
  const allTelegramImages = [...telegramImages, ...chunkFiles]
  
  results['telegram'] = allTelegramImages.map(img => ({
    name: img.filename || img.originalName || 'unknown',
    url: img.url || (img.fileId ? `/api/large/${img.fileId}.${img.extension || ''}` : ''),
    path: `telegram/${img.fileId || ''}`,
    sha: img.fileId || '',
    size: img.totalSize || img.size || 0,
    folder: 'telegram',
    source: img.storageType === 'telegram_chunks' ? 'telegram_chunks' : 'telegram',
    fileId: img.fileId,
    messageId: img.messageId,
    filePath: img.filePath,
    time: img.uploadedAt || img.time,
    fromR2: !!img.fromR2,
    chunkCount: img.chunkCount,
    extension: img.extension || ''
  }))
  total += results['telegram'].length

  let externalImages = {}
  if (token) {
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

  for (const folder of folders) {
    const images = []
    const seen = new Set()

    if (token) {
      try {
        const githubImages = await getFolderImages(folder, token)
        for (const img of githubImages) {
          const key = `${folder}/${img.name}`
          if (!seen.has(key)) {
            seen.add(key)
            images.push({
              name: img.name,
              url: `https://cf-pico.pages.dev/api/image?path=${key}`,
              path: key,
              sha: img.sha,
              size: img.size,
              folder: folder,
              source: 'github'
            })
          }
        }
      } catch (e) {
        console.error(`GitHub list error for ${folder}:`, e)
      }
    }

    if (bucket) {
      try {
        const objects = await bucket.list({ prefix: `${folder}/` })
        for (const obj of objects.objects) {
          const key = obj.key
          const name = key.split('/').pop()
          const ext = name.split('.').pop().toLowerCase()
          if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) continue
          if (name === '.keep') continue
          if (!seen.has(key)) {
            seen.add(key)
            images.push({
              name: name,
              url: `https://cf-pico.pages.dev/api/image?path=${key}`,
              path: key,
              sha: obj.etag || '',
              size: obj.size || 0,
              folder: folder,
              source: 'r2'
            })
          }
        }
      } catch (e) {
        console.error(`R2 list error for ${folder}:`, e)
      }
    }

    const extList = externalImages[folder] || []
    for (const url of extList) {
      const name = url.split('/').pop()
      const key = `${folder}/${name}`
      if (!seen.has(key)) {
        seen.add(key)
        images.push({
          name: name,
          url: url,
          path: key,
          sha: '',
          size: 0,
          folder: folder,
          source: 'external'
        })
      }
    }

    results[folder] = images
    total += images.length
  }

  return new Response(JSON.stringify({
    total: total,
    folders: results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}