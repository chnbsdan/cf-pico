// functions/api/[[path]].js - Cloudflare Pages API 完整入口
// 支持：stats, random, wallpaper, cover, list, image, upload, history, admin/delete
// 支持 GitHub 和 R2 双存储（纯代理模式，不暴露 R2 域名）

const GITHUB_USER = 'chnbsdan'
const GITHUB_REPO = 'cf-pico'

// ============================================================
// 工具函数
// ============================================================

// 获取文件夹图片列表（从 GitHub）
async function getFolderImages(folder, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN 未设置')
    return []
  }
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`)
      return []
    }
    const files = await response.json()
    if (!Array.isArray(files)) return []
    return files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) && f.name !== '.keep'
    })
  } catch (error) {
    console.error(`Failed to fetch ${folder}:`, error)
    return []
  }
}

// 获取所有文件夹的图片（从 GitHub）
async function getAllImages(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  let allImages = []
  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    allImages = allImages.concat(images.map(f => ({ ...f, folder })))
  }
  return allImages
}

// 生成文件名
function generateFilename(originalName) {
  const now = new Date()
  const datePrefix = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const safeName = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
  const ext = originalName.split('.').pop().toLowerCase()
  return `${datePrefix}_${safeName}.${ext}`
}

// ============================================================
// API 处理函数
// ============================================================

// GET /api/stats
async function handleStats(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const githubFolders = {}
  let githubTotal = 0
  let externalTotal = 0

  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    githubFolders[folder] = images.length
    githubTotal += images.length
  }

  const token = env.GITHUB_TOKEN
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

  return new Response(JSON.stringify({
    github_folders: githubFolders,
    github_total: githubTotal,
    external_total: externalTotal,
    grand_total: githubTotal + externalTotal
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

// GET /api/random
async function handleRandom(env) {
  const allImages = await getAllImages(env)
  if (allImages.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = allImages[Math.floor(Math.random() * allImages.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

// GET /api/wallpaper
async function handleWallpaper(request, env) {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'wallpaper'
  const images = await getFolderImages(folder, env)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

// GET /api/cover
async function handleCover(request, env) {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'cover'
  const images = await getFolderImages(folder, env)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

// GET /api/list
async function handleList(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  const results = {}
  let total = 0

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
        externalImages = JSON.parse(content)
      }
    } catch (e) {
      console.error('Failed to fetch external.json:', e)
    }
  }

  for (const folder of folders) {
    const images = []
    const seen = new Set()

    // 1. 从 GitHub 获取
    if (token) {
      try {
        const githubImages = await getFolderImages(folder, env)
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

    // 2. 从 R2 获取
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

    // 3. 从外部图片获取
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

// ============================================================
// GET /api/image - 核心：纯代理模式（不暴露 R2 域名）
// ============================================================
async function handleImage(request, env) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN
  const parts = path.split('/')
  const folder = parts[0]
  const filename = parts.slice(1).join('/')
  const allowedFolders = ['wallpaper', 'cover', 'sh', 'sd']

  if (!allowedFolders.includes(folder)) {
    return new Response('Invalid folder', { status: 403 })
  }

  // ============================================================
  // 1. R2：纯代理模式（返回图片数据，不返回 302 重定向）
  // ============================================================
  if (bucket) {
    try {
      const object = await bucket.get(path)
      if (object) {
        const contentType = object.httpMetadata?.contentType || 'image/jpeg'
        const body = await object.arrayBuffer()
        
        // 直接返回图片数据，状态码 200，地址栏保持自定义域名
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
            // ✅ 没有 Location 头，没有 302 状态码
          }
        })
      }
    } catch (e) {
      // R2 没有该文件，继续尝试 GitHub
      console.log('R2 miss, trying GitHub:', e.message)
    }
  }

  // ============================================================
  // 2. GitHub：代理返回（支持私有仓库）
  // ============================================================
  if (!token) {
    return new Response('GITHUB_TOKEN not configured', { status: 500 })
  }

  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${folder}/${filename}`

  try {
    const response = await fetch(rawUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }

    const ext = filename.split('.').pop().toLowerCase()
    const contentTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif'
    }
    const contentType = contentTypes[ext] || 'image/jpeg'
    const body = await response.arrayBuffer()

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('GitHub fetch error:', error)
    return new Response('Internal error', { status: 500 })
  }
}

// ============================================================
// POST /api/upload - 上传到 GitHub 或 R2
// ============================================================
async function handleUpload(request, env) {
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const folder = formData.get('folder') || 'wallpaper'
    const storageType = formData.get('storage') || 'github'

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (file.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 25MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const filename = generateFilename(file.name)
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Content = btoa(binary)

    let uploadedUrl = ''
    let usedStorage = storageType
    const proxyUrl = `https://cf-pico.pages.dev/api/image?path=${folder}/${filename}`

    // === 根据用户选择上传 ===
    if (storageType === 'r2') {
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      const key = `${folder}/${filename}`
      await bucket.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type || 'image/jpeg' }
      })
      // ✅ 注意：这里返回的是代理 URL，不是 R2 直链
      uploadedUrl = proxyUrl
    } else {
      // 上传到 GitHub
      if (!token) {
        return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Pages'
        },
        body: JSON.stringify({
          message: `Upload ${filename}`,
          content: base64Content,
          branch: 'main'
        })
      })
      if (!response.ok) {
        const error = await response.text()
        console.error('GitHub upload error:', error)
        return new Response(JSON.stringify({ error: 'GitHub upload failed' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      const data = await response.json()
      uploadedUrl = proxyUrl
    }

    return new Response(JSON.stringify({
      success: true,
      filename: filename,
      folder: folder,
      url: proxyUrl,
      storage: usedStorage,
      rawUrl: uploadedUrl
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ============================================================
// 历史记录相关
// ============================================================

// GET /api/history
async function handleHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (response.status === 404) {
      return new Response(JSON.stringify({ history: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const data = await response.json()
    const content = atob(data.content)
    const history = JSON.parse(content)
    return new Response(JSON.stringify({ history: history || [] }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('History error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST /api/history
async function addHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { filename, url, folder } = body

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const historyUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
    let existingHistory = []
    let sha = null

    const getResponse = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (getResponse.ok) {
      const data = await getResponse.json()
      sha = data.sha
      const content = atob(data.content)
      existingHistory = JSON.parse(content) || []
    }

    const newRecord = {
      id: Date.now(),
      filename,
      url,
      folder,
      time: new Date().toISOString()
    }
    existingHistory.unshift(newRecord)
    const trimmedHistory = existingHistory.slice(0, 1000)

    const putResponse = await fetch(historyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({
        message: 'Update upload history',
        content: btoa(JSON.stringify(trimmedHistory, null, 2)),
        sha: sha,
        branch: 'main'
      })
    })

    if (!putResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to save history' }), {
        status: putResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, history: trimmedHistory }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Add history error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// DELETE /api/history
async function deleteHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const historyUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
    let sha = null
    let existingHistory = []

    const getResponse = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!getResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: getResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await getResponse.json()
    sha = data.sha
    const content = atob(data.content)
    existingHistory = JSON.parse(content) || []

    const newHistory = existingHistory.filter(record => record.id !== parseInt(id))

    const putResponse = await fetch(historyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({
        message: 'Delete history record',
        content: btoa(JSON.stringify(newHistory, null, 2)),
        sha: sha,
        branch: 'main'
      })
    })

    if (!putResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to delete' }), {
        status: putResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Delete history error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST /api/admin/delete
async function handleDelete(request, env) {
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const body = await request.json()
    const { filename, folder, sha, source } = body

    if (!filename || !folder) {
      return new Response(JSON.stringify({ error: 'Missing filename or folder' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let deleted = false

    if (source === 'r2' || !source) {
      if (bucket) {
        try {
          const key = `${folder}/${filename}`
          await bucket.delete(key)
          deleted = true
          console.log(`R2 deleted: ${key}`)
        } catch (e) {
          console.error('R2 delete error:', e)
        }
      }
    }

    if (source === 'github' || !source) {
      if (token && sha) {
        try {
          const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
          const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Cloudflare-Pages'
            },
            body: JSON.stringify({
              message: `Delete ${filename}`,
              sha: sha,
              branch: 'main'
            })
          })
          if (response.ok) {
            deleted = true
            console.log(`GitHub deleted: ${folder}/${filename}`)
          }
        } catch (e) {
          console.error('GitHub delete error:', e)
        }
      }
    }

    if (deleted) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ error: 'Delete failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Delete error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ============================================================
// 主入口
// ============================================================

export async function onRequest(context) {
  const { request, env, params } = context
  const method = request.method

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  console.log(`API 请求: ${method} ${path}`)

  // POST /api/upload
  if (path === 'upload' && method === 'POST') {
    return handleUpload(request, env)
  }

  // POST /api/history
  if (path === 'history' && method === 'POST') {
    return addHistory(request, env)
  }

  // DELETE /api/history
  if (path === 'history' && method === 'DELETE') {
    return deleteHistory(request, env)
  }

  // GET /api/history
  if (path === 'history' && method === 'GET') {
    return handleHistory(request, env)
  }

  // POST /api/admin/delete
  if (path === 'admin/delete' && method === 'POST') {
    return handleDelete(request, env)
  }

  // GET 其他接口
  if (path === 'stats') {
    return handleStats(env)
  }
  if (path === 'random') {
    return handleRandom(env)
  }
  if (path === 'wallpaper') {
    return handleWallpaper(request, env)
  }
  if (path === 'cover') {
    return handleCover(request, env)
  }
  if (path === 'list') {
    return handleList(env)
  }
  if (path === 'image') {
    return handleImage(request, env)
  }

  return new Response(JSON.stringify({ error: 'API not found', path }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}
