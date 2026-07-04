// functions/api/list.js - GET /api/list
import { getFolderImages, getTelegramImages } from './utils/github.js'
import { listFilesFromHuggingFace } from './utils/huggingface.js'

export async function onRequest(context) {
  const { env } = context
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  const results = {}
  let total = 0

  // ============================================================
  // 1. Telegram 图片
  // ============================================================
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

  // ============================================================
  // 2. HuggingFace 图片
  // ============================================================
  let huggingfaceImages = []
  if (env.HF_TOKEN && env.HF_REPO) {
    try {
      const result = await listFilesFromHuggingFace(env)
      if (result.success) {
        huggingfaceImages = result.files.map(img => ({
          name: img.name,
          url: `/api/hf/${img.path}`,
          path: img.path,
          sha: '',
          size: img.size || 0,
          folder: 'huggingface',
          source: 'huggingface',
          originalFolder: img.folder || ''
        }))
        console.log(`✅ HuggingFace 文件列表获取成功: ${huggingfaceImages.length} 个文件`)
      }
    } catch (e) {
      console.error('HuggingFace list error:', e)
    }
  }

  results['huggingface'] = huggingfaceImages
  total += huggingfaceImages.length

  // ============================================================
  // 3. ✅ 外部图源 - 硬编码 GITHUB_USER 和 GITHUB_REPO
  // ============================================================
  const GITHUB_USER = 'chnbsdan'
  const GITHUB_REPO = 'cf-pico'
  
  let externalImages = []
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
          if (external[folder]) {
            for (const url of external[folder]) {
              const name = url.split('/').pop() || 'unknown'
              externalImages.push({
                name: name,
                url: url,
                path: `external/${name}`,
                sha: '',
                size: 0,
                folder: 'external',
                source: 'external',
                originalFolder: folder
              })
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch external.json:', e)
    }
  }
  
  results['external'] = externalImages
  total += externalImages.length

  // ============================================================
  // 4. GitHub + R2 图片
  // ============================================================
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
              url: `/api/image?path=${key}`, // ✅ 使用相对路径，自定义域名
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
              url: `/api/image?path=${key}`, // ✅ 使用相对路径，自定义域名
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
