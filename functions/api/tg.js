// functions/api/tg.js - GET /api/tg Telegram 随机图片
import { getTelegramImages } from './utils/github.js'

export async function onRequest(context) {
  const { request, env } = context
  const token = env.GITHUB_TOKEN;
  const bucket = env.IMAGES_BUCKET;
  
  let allTelegramItems = []
  
  // 1. 从 R2 获取
  if (bucket) {
    try {
      const objects = await bucket.list({ prefix: 'completed_files/' })
      for (const obj of objects.objects) {
        try {
          const object = await bucket.get(obj.key)
          if (object) {
            const content = await object.text()
            const meta = JSON.parse(content)
            if (meta.fileId) {
              allTelegramItems.push(meta)
            }
          }
        } catch (e) {
          console.error('读取 R2 元数据失败:', e)
        }
      }
    } catch (e) {
      console.error('列出 R2 文件失败:', e)
    }
  }
  
  // 2. 从 GitHub 获取
  if (token) {
    try {
      const githubItems = await getTelegramImages(token)
      const validItems = githubItems.filter(item => item.fileId)
      allTelegramItems = allTelegramItems.concat(validItems)
    } catch (e) {
      console.error('读取 GitHub 记录失败:', e)
    }
  }
  
  // 去重
  const seen = new Set()
  allTelegramItems = allTelegramItems.filter(item => {
    if (seen.has(item.fileId)) return false
    seen.add(item.fileId)
    return true
  })
  
  if (!allTelegramItems || allTelegramItems.length === 0) {
    return new Response('No Telegram images found', { status: 404 });
  }

  const randomItem = allTelegramItems[Math.floor(Math.random() * allTelegramItems.length)];
  const baseUrl = request?.url ? new URL(request.url).origin : 'https://pico.1356666.xyz';
  
  const fileId = randomItem.fileId || randomItem.filePath || randomItem.id
  if (!fileId) {
    return new Response('Invalid file data', { status: 500 })
  }
  
  const ext = randomItem.extension || 
              (randomItem.filename ? randomItem.filename.split('.').pop() : '') ||
              'jpg'
  
  const imageUrl = `${baseUrl}/api/large/${fileId}.${ext}`;

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
    body { width: 100vw; height: 100vh; overflow: hidden; background: #000; }
    img, video { width: 100vw; height: 100vh; object-fit: cover; display: block; }
  </style>
</head>
<body>
  <img id="tgImage" src="${imageUrl}" alt="TG壁纸" onerror="this.style.display='none';document.getElementById('fallback').style.display='block'">
  <video id="fallback" style="display:none;width:100vw;height:100vh;object-fit:cover;" autoplay muted loop>
    <source src="${imageUrl}" type="video/mp4">
    无法播放
  </video>
  <script>
    function refreshImage() {
      fetch('/api/tg?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
          if (data.url) {
            document.getElementById('tgImage').src = data.url + '?t=' + Date.now()
          }
        })
        .catch(() => {
          document.getElementById('tgImage').src = '/api/tg?raw=true&t=' + Date.now()
        })
      setTimeout(refreshImage, 3600000);
    }
    setTimeout(refreshImage, 3600000);
  </script>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' }
    });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('❌ 获取图片失败:', response.status, imageUrl)
      const fallbackUrl = `${baseUrl}/api/image?path=telegram/${encodeURIComponent(fileId)}`
      const fallbackResponse = await fetch(fallbackUrl)
      if (fallbackResponse.ok) {
        return new Response(fallbackResponse.body, {
          headers: {
            'Content-Type': fallbackResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=60',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      return new Response('Image not found', { status: 404 })
    }
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('❌ 获取 Telegram 随机图片失败:', error)
    return new Response('Failed to fetch image', { status: 500 })
  }
}