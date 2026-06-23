// functions/api/[[path]].js - Cloudflare Pages API 完整入口
// 支持：stats, random, wallpaper, cover, list, image, upload, history, admin/delete
// 支持 GitHub、R2、Telegram 三种存储（纯代理模式，不暴露后端域名）

const GITHUB_USER = 'chnbsdan'
const GITHUB_REPO = 'cf-pico'
const TELEGRAM_IMAGES_FILE = 'telegram_images.json'  // Telegram 图片列表存储文件

// ============================================================
// Telegram 存储相关函数（完整优化版）
// ============================================================

/**
 * 上传文件到 Telegram 频道
 * 自动选择最佳方法：sendPhoto / sendVideo / sendAudio / sendDocument
 * 兼容所有文件类型，包括 webp
 */
async function uploadToTelegram(file, botToken, chatId) {
  const ext = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type || '';
  
  // ============================================================
  // 1. 智能选择发送方法
  // ============================================================
  let method = 'sendDocument';
  let fieldName = 'document';
  
  // 图片（webp 用 document，因为 Telegram 的 sendPhoto 对 webp 支持不好）
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
  if (imageExts.includes(ext) && mimeType.startsWith('image/')) {
    method = 'sendPhoto';
    fieldName = 'photo';
  } else if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext) && mimeType.startsWith('video/')) {
    method = 'sendVideo';
    fieldName = 'video';
  } else if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext) && mimeType.startsWith('audio/')) {
    method = 'sendAudio';
    fieldName = 'audio';
  } else if (ext === 'webp') {
    // ✅ webp 用 sendDocument（最稳定）
    method = 'sendDocument';
    fieldName = 'document';
  }

  // ============================================================
  // 2. 构建请求
  // ============================================================
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(fieldName, file, file.name);
  
  // 为图片添加 caption（方便识别）
  if (method === 'sendPhoto') {
    formData.append('caption', `📷 ${file.name}`);
  }

  console.log(`📤 Telegram 上传: ${file.name} (${method})`);

  // ============================================================
  // 3. 发送请求
  // ============================================================
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Telegram API 错误:', error);
    throw new Error(error.description || 'Telegram 上传失败');
  }

  const data = await response.json();
  const result = data.result;

  // ============================================================
  // 4. 提取 file_id（兼容所有可能的结构）
  // ============================================================
  let fileId = null;
  
  // 按优先级查找
  const fields = [
    'document', 'photo', 'video', 'audio', 
    'animation', 'sticker', 'voice', 'video_note'
  ];
  
  for (const field of fields) {
    if (result?.[field]) {
      if (field === 'photo' && Array.isArray(result.photo)) {
        // photo 是数组，取最大尺寸
        fileId = result.photo[result.photo.length - 1]?.file_id;
      } else if (result[field]?.file_id) {
        fileId = result[field].file_id;
      }
      if (fileId) break;
    }
  }
  
  // 如果还没找到，尝试直接取 file_id
  if (!fileId && result?.file_id) {
    fileId = result.file_id;
  }

  const messageId = result?.message_id;

  if (!fileId) {
    console.error('❌ Telegram 响应:', JSON.stringify(data, null, 2));
    throw new Error(`Telegram 未返回 file_id (${method})`);
  }

  console.log(`✅ Telegram 上传成功: ${file.name} → file_id: ${fileId}`);

  // ============================================================
  // 5. 获取文件路径（用于代理访问）
  // ============================================================
  const filePathResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  
  if (!filePathResponse.ok) {
    throw new Error('获取 Telegram 文件路径失败');
  }
  
  const filePathData = await filePathResponse.json();
  const filePath = filePathData.result?.file_path;

  if (!filePath) {
    throw new Error('Telegram 未返回 file_path');
  }

  return {
    fileId,
    messageId,
    filePath,
    storageType: 'telegram',
    method: method
  };
}

/**
 * 从 Telegram 获取文件内容（代理访问）
 * ✅ 返回数据而不是原始 Response，彻底清除下载头
 */
async function getTelegramFileContent(botToken, filePath) {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`从 Telegram 获取文件失败: ${response.status}`);
  }
  
  // ✅ 直接提取数据和内容类型，丢弃原始 Response
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
  
  return {
    data: arrayBuffer,
    contentType: contentType
  };
}

/**
 * 从 Telegram 删除文件（通过消息ID）
 */
async function deleteTelegramFile(botToken, chatId, messageId) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`
  );
  return response.ok;
}

// ============================================================
// Telegram 图片列表管理（独立于历史记录）
// ============================================================

/**
 * 读取 Telegram 图片列表
 */
async function getTelegramImages(token) {
  if (!token) return []
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${TELEGRAM_IMAGES_FILE}`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (response.status === 404) return []
    if (!response.ok) return []
    const data = await response.json()
    const content = atob(data.content)
    return JSON.parse(content) || []
  } catch (error) {
    console.error('读取 Telegram 图片列表失败:', error)
    return []
  }
}

/**
 * 保存 Telegram 图片列表
 */
async function saveTelegramImages(token, images, sha = null) {
  if (!token) return false
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${TELEGRAM_IMAGES_FILE}`
  
  let existingSha = sha
  if (!existingSha) {
    try {
      const getRes = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Cloudflare-Pages'
        }
      })
      if (getRes.ok) {
        const data = await getRes.json()
        existingSha = data.sha
      }
    } catch (e) {}
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Pages'
    },
    body: JSON.stringify({
      message: 'Update Telegram images list',
      content: btoa(JSON.stringify(images, null, 2)),
      sha: existingSha || undefined,
      branch: 'main'
    })
  })
  return response.ok
}

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
  let telegramTotal = 0

  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    githubFolders[folder] = images.length
    githubTotal += images.length
  }

  const token = env.GITHUB_TOKEN
  if (token) {
    // 获取 Telegram 图片数量
    const telegramImages = await getTelegramImages(token)
    telegramTotal = telegramImages.length
    
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
    telegram_total: telegramTotal,
    grand_total: githubTotal + externalTotal + telegramTotal
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

  // ============================================================
  // ✅ 新增：获取 Telegram 图片列表
  // ============================================================
  let telegramImages = []
  if (token) {
    telegramImages = await getTelegramImages(token)
  }
  results['telegram'] = telegramImages.map(img => ({
    name: img.filename || img.originalName || 'unknown',
    url: img.url || '',
    path: `telegram/${img.filePath}`,
    sha: img.fileId || '',
    size: img.size || 0,
    folder: 'telegram',
    source: 'telegram',
    fileId: img.fileId,
    messageId: img.messageId,
    filePath: img.filePath,
    time: img.time
  }))
  total += results['telegram'].length

  // ============================================================
  // 原有的 GitHub/R2/External 获取逻辑
  // ============================================================
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
// GET /api/image - 核心：纯代理模式（不暴露后端域名）
// 支持 GitHub、R2、Telegram 三种存储
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
  const allowedFolders = ['wallpaper', 'cover', 'sh', 'sd', 'telegram']

  if (!allowedFolders.includes(folder)) {
    return new Response('Invalid folder', { status: 403 })
  }

  // ============================================================
  // 0. Telegram：代理返回
  // ============================================================
 if (folder === 'telegram') {
  const botToken = env.TG_BOT_TOKEN;
  if (!botToken) {
    return new Response('Telegram 未配置', { status: 500 });
  }
  try {
    // ✅ 直接返回 getTelegramFileContent 构建的响应
    return await getTelegramFileContent(botToken, filename);
  } catch (error) {
    console.error('Telegram fetch error:', error);
    return new Response('Telegram 文件获取失败', { status: 404 });
  }
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
        
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    } catch (e) {
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
// POST /api/upload - 上传到 GitHub、R2 或 Telegram
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

    // 最大 50MB（Telegram 限制）
    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 50MB)' }), {
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
    let tgMessageId = null
    let tgFileId = null
    let tgFilePath = null

    // === 根据用户选择上传 ===
    if (storageType === 'telegram') {
      // ========== Telegram 存储 ==========
      const botToken = env.TG_BOT_TOKEN;
      const chatId = env.TG_CHAT_ID;
      
      if (!botToken || !chatId) {
        return new Response(JSON.stringify({ error: 'Telegram 存储未配置' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const result = await uploadToTelegram(file, botToken, chatId);
        tgFileId = result.fileId;
        tgMessageId = result.messageId;
        tgFilePath = result.filePath;
        usedStorage = 'telegram';
        
        // ✅ 正确生成 Telegram 代理 URL
        const baseUrl = new URL(request.url).origin;
        const tgProxyPath = `telegram/${encodeURIComponent(tgFilePath)}`;
        uploadedUrl = `${baseUrl}/api/image?path=${tgProxyPath}`;
        
        // ✅ 保存到 Telegram 图片列表
        if (token) {
          const existingImages = await getTelegramImages(token);
          // 检查是否已存在（避免重复）
          const exists = existingImages.some(img => img.filePath === tgFilePath);
          if (!exists) {
            existingImages.push({
              id: Date.now(),
              filename: filename,
              originalName: file.name,
              fileId: tgFileId,
              messageId: tgMessageId,
              filePath: tgFilePath,
              url: uploadedUrl,
              time: new Date().toISOString(),
              size: file.size,
              mimeType: file.type || 'image/jpeg'
            });
            await saveTelegramImages(token, existingImages);
            console.log(`✅ Telegram 图片已记录: ${filename}`);
          }
        }
        
        console.log('Telegram 上传成功:', {
          fileId: tgFileId,
          messageId: tgMessageId,
          filePath: tgFilePath,
          url: uploadedUrl
        });
        
      } catch (error) {
        console.error('Telegram upload error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } else if (storageType === 'r2') {
      // ========== R2 存储 ==========
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
      const baseUrl = new URL(request.url).origin;
      uploadedUrl = `${baseUrl}/api/image?path=${key}`
      usedStorage = 'r2'

    } else {
      // ========== GitHub 存储（默认） ==========
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
      const baseUrl = new URL(request.url).origin;
      uploadedUrl = `${baseUrl}/api/image?path=${folder}/${filename}`
      usedStorage = 'github'
    }

    // 返回结果
    return new Response(JSON.stringify({
      success: true,
      filename: filename,
      folder: folder,
      url: uploadedUrl,
      storage: usedStorage,
      rawUrl: uploadedUrl,
      tgMessageId: tgMessageId,
      tgFileId: tgFileId,
      tgFilePath: tgFilePath
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
    const { filename, folder, sha, source, tgMessageId } = body

    if (!filename || !folder) {
      return new Response(JSON.stringify({ error: 'Missing filename or folder' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let deleted = false
    let deleteErrors = []

    // ========== Telegram 删除 ==========
    if (source === 'telegram' && tgMessageId) {
      const botToken = env.TG_BOT_TOKEN;
      const chatId = env.TG_CHAT_ID;
      if (botToken && chatId) {
        try {
          const result = await deleteTelegramFile(botToken, chatId, tgMessageId);
          if (result) {
            deleted = true;
            console.log(`Telegram deleted: message ${tgMessageId}`);
            
            // ✅ 从列表中移除记录
            if (token) {
              const images = await getTelegramImages(token);
              const newImages = images.filter(img => img.messageId !== tgMessageId);
              if (newImages.length !== images.length) {
                await saveTelegramImages(token, newImages);
                console.log(`Telegram 图片记录已移除: ${tgMessageId}`);
              }
            }
          } else {
            deleteErrors.push('Telegram 删除失败');
          }
        } catch (e) {
          console.error('Telegram delete error:', e);
          deleteErrors.push('Telegram 删除异常');
        }
      } else {
        deleteErrors.push('Telegram 未配置');
      }
    }

    // ========== R2 删除 ==========
    if (source === 'r2' || (!source && !tgMessageId)) {
      if (bucket) {
        try {
          const key = `${folder}/${filename}`
          await bucket.delete(key)
          deleted = true
          console.log(`R2 deleted: ${key}`)
        } catch (e) {
          console.error('R2 delete error:', e)
          deleteErrors.push('R2 删除失败')
        }
      }
    }

    // ========== GitHub 删除 ==========
    if (source === 'github' || (!source && !tgMessageId)) {
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
          } else {
            deleteErrors.push(`GitHub 删除失败: ${response.status}`)
          }
        } catch (e) {
          console.error('GitHub delete error:', e)
          deleteErrors.push('GitHub 删除异常')
        }
      } else if (!sha) {
        deleteErrors.push('缺少 GitHub SHA')
      }
    }

    if (deleted) {
      return new Response(JSON.stringify({ 
        success: true,
        warnings: deleteErrors.length > 0 ? deleteErrors : undefined
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ 
        error: 'Delete failed',
        details: deleteErrors
      }), {
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
