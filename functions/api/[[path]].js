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
    method = 'sendDocument';
    fieldName = 'document';
  }

  // ============================================================
  // 2. 构建请求
  // ============================================================
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(fieldName, file, file.name);
  
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
  // 4. 提取 file_id
  // ============================================================
  let fileId = null;
  
  const fields = [
    'document', 'photo', 'video', 'audio', 
    'animation', 'sticker', 'voice', 'video_note'
  ];
  
  for (const field of fields) {
    if (result?.[field]) {
      if (field === 'photo' && Array.isArray(result.photo)) {
        fileId = result.photo[result.photo.length - 1]?.file_id;
      } else if (result[field]?.file_id) {
        fileId = result[field].file_id;
      }
      if (fileId) break;
    }
  }
  
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
  // 5. 获取文件路径
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
 * ✅ 核心修改：通过 file_id 实时获取文件内容（兼容 file_path 过期）
 * 先调用 getFile 获取最新的 file_path，再下载文件
 */
async function getTelegramFileContentByFileId(botToken, fileId) {
  if (!fileId) {
    throw new Error('缺少 fileId');
  }

  // 1. 用 file_id 获取最新的 file_path
  const getFilePathUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const filePathRes = await fetch(getFilePathUrl);
  
  if (!filePathRes.ok) {
    const errorText = await filePathRes.text();
    throw new Error(`获取文件路径失败: ${filePathRes.status} ${errorText}`);
  }
  
  const filePathData = await filePathRes.json();
  const currentFilePath = filePathData.result?.file_path;
  
  if (!currentFilePath) {
    throw new Error('Telegram 未返回 file_path');
  }

  // 2. 用最新的 file_path 下载文件
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${currentFilePath}`;
  const response = await fetch(downloadUrl);
  
  if (!response.ok) {
    throw new Error(`从 Telegram 下载文件失败: ${response.status}`);
  }
  
  const fileData = await response.arrayBuffer();
  
  // 3. 根据文件扩展名设置正确的 MIME 类型
  const ext = currentFilePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'pdf': 'application/pdf'
  };
  
  const contentType = mimeTypes[ext] || response.headers.get('Content-Type') || 'application/octet-stream';
  
  return new Response(fileData, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    }
  });
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
// Telegram 图片列表管理
// ============================================================

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
// ✅ 新增：处理 /api/tg 随机 Telegram 图片请求
// ============================================================
async function handleTelegramRandom(env, request) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return new Response('GITHUB_TOKEN not configured', { status: 500 });
  }

  // 从 GitHub 读取 Telegram 图片列表
  const telegramImages = await getTelegramImages(token);
  if (!telegramImages || telegramImages.length === 0) {
    return new Response('No Telegram images found', { status: 404 });
  }

  // 随机选择一张图片
  const randomImage = telegramImages[Math.floor(Math.random() * telegramImages.length)];
  const baseUrl = 'https://pico.1356666.xyz';
  const imageUrl = `${baseUrl}/api/image?path=telegram/${encodeURIComponent(randomImage.filePath)}`;

  // ============================================================
  // ✅ 判断是否返回 HTML 页面
  // ============================================================
  const url = new URL(request.url);
  const format = url.searchParams.get('format');

  if (format === 'html') {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TG 壁纸</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #000;
    }
    img {
      width: 100vw;
      height: 100vh;
      object-fit: cover;
      display: block;
    }
  </style>
</head>
<body>
  <img id="tgImage" src="${imageUrl}" alt="TG壁纸">
  <script>
    // ✅ 使用 setTimeout 递归，确保每次都刷新
    function refreshImage() {
      const img = document.getElementById('tgImage');
      img.src = '/api/tg?t=' + Date.now();
      // 60秒后再次刷新
      setTimeout(refreshImage, 3600000);
    }
    // 60秒后开始第一次刷新
    setTimeout(refreshImage, 3600000);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-cache'
    }
  });
}

  // ============================================================
  // 默认：返回图片
  // ============================================================
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image from proxy');
    }
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error fetching Telegram random image:', error);
    return new Response('Failed to fetch image', { status: 500 });
  }
}

// ============================================================
// 工具函数
// ============================================================

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

async function getAllImages(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  let allImages = []
  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    allImages = allImages.concat(images.map(f => ({ ...f, folder })))
  }
  return allImages
}

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

  // Telegram 图片列表
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

  // GitHub/R2/External
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

// ============================================================
// GET /api/image - 核心代理（✅ 核心修改：改用 file_id 实时获取）
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
  // ✅ 核心修改：Telegram 改用 file_id 实时获取
  // ============================================================
  if (folder === 'telegram') {
    const botToken = env.TG_BOT_TOKEN;
    if (!botToken) {
      return new Response('Telegram 未配置', { status: 500 });
    }
    if (!token) {
      return new Response('GITHUB_TOKEN not configured', { status: 500 });
    }

    try {
      // 1. 从 telegram_images.json 查找记录
      const images = await getTelegramImages(token);
      const record = images.find(img => img.filePath === filename);
      
      if (!record || !record.fileId) {
        console.error(`未找到记录: ${filename}`);
        return new Response('未找到对应的 fileId', { status: 404 });
      }

      // 2. 用 file_id 实时获取文件（自动处理 file_path 过期）
      return await getTelegramFileContentByFileId(botToken, record.fileId);
      
    } catch (error) {
      console.error('Telegram fetch error:', error);
      return new Response(`Telegram 文件获取失败: ${error.message}`, { status: 404 });
    }
  }

  // ============================================================
  // R2
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
  // GitHub
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
// POST /api/upload
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

    // === Telegram 存储 ===
    if (storageType === 'telegram') {
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
        
        const baseUrl = new URL(request.url).origin;
        const tgProxyPath = `telegram/${encodeURIComponent(tgFilePath)}`;
        uploadedUrl = `${baseUrl}/api/image?path=${tgProxyPath}`;
        
        if (token) {
          const existingImages = await getTelegramImages(token);
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

    // === R2 存储 ===
    } else if (storageType === 'r2') {
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

    // === GitHub 存储 ===
    } else {
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
// 历史记录
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

// ============================================================
// POST /api/admin/delete - ✅ 优化：Telegram 删除失败时仍清理记录
// ============================================================
async function handleDelete(request, env) {
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const body = await request.json()
    const { filename, folder, sha, source, tgMessageId, fileId } = body

    if (!filename || !folder) {
      return new Response(JSON.stringify({ error: 'Missing filename or folder' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let deleted = false
    let deleteErrors = []

    // ============================================================
    // ✅ Telegram 删除：即使文件已过期也清理记录
    // ============================================================
    if (source === 'telegram' && tgMessageId) {
      const botToken = env.TG_BOT_TOKEN;
      const chatId = env.TG_CHAT_ID;
      let tgDeleted = false;
      
      if (botToken && chatId) {
        try {
          const result = await deleteTelegramFile(botToken, chatId, tgMessageId);
          if (result) {
            tgDeleted = true;
            console.log(`✅ Telegram 消息已删除: ${tgMessageId}`);
          } else {
            console.warn(`⚠️ Telegram 消息删除失败（可能已不存在）: ${tgMessageId}`);
            // 不报错，继续清理记录
          }
        } catch (e) {
          console.warn(`⚠️ Telegram 删除异常（可能已过期）: ${e.message}`);
          // 不中断，继续清理记录
        }
      } else {
        deleteErrors.push('Telegram 未配置');
      }
      
      // ✅ 关键：无论 Telegram 删除是否成功，都清理记录
      if (token) {
        try {
          const images = await getTelegramImages(token);
          const newImages = images.filter(img => img.messageId !== tgMessageId);
          if (newImages.length !== images.length) {
            await saveTelegramImages(token, newImages);
            deleted = true;
            console.log(`✅ Telegram 图片记录已移除: ${tgMessageId}`);
          } else {
            // 记录中找不到该 messageId，说明已经被清理了
            deleted = true;
            console.log(`ℹ️ 记录中已无该 messageId: ${tgMessageId}`);
          }
        } catch (e) {
          console.error('清理 Telegram 记录失败:', e);
          deleteErrors.push('记录清理失败');
        }
      }
    }

    // R2 删除（非 Telegram 图片）
    if (source === 'r2' || (!source && !tgMessageId)) {
      if (bucket) {
        try {
          const key = `${folder}/${filename}`
          await bucket.delete(key)
          deleted = true
          console.log(`✅ R2 已删除: ${key}`)
        } catch (e) {
          console.error('R2 delete error:', e)
          deleteErrors.push('R2 删除失败')
        }
      }
    }

    // GitHub 删除（非 Telegram 图片）
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
            console.log(`✅ GitHub 已删除: ${folder}/${filename}`)
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
  if (path === 'tg') {
    return handleTelegramRandom(env, request);
  }
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
