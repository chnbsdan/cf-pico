// functions/api/upload.js - POST /api/upload 普通上传
import { GITHUB_USER, GITHUB_REPO, generateFilename } from './utils/helpers.js'
import { getTelegramImages, saveTelegramImages } from './utils/github.js'
import { uploadToTelegram } from './utils/telegram.js'
import { uploadToHuggingFace } from './utils/huggingface.js' // ⬅️ 新增

export async function onRequest(context) {
  const { request, env } = context
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const folder = formData.get('folder') || 'wallpaper'
    const storageType = formData.get('storage') || 'github'
    const convertToWebp = formData.get('convertToWebp') === 'true'

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 文件大小检查
    if (storageType === 'telegram' && file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: '文件超过 50MB，请使用分片上传',
        needChunkUpload: true,
        maxDirectSize: 50 * 1024 * 1024
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // HuggingFace 文件大小检查（建议 100MB 以内）
    if (storageType === 'huggingface' && file.size > 100 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: 'HuggingFace 建议上传 100MB 以内的文件，大文件请使用 Telegram 分片上传',
        maxSize: 100 * 1024 * 1024
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (storageType !== 'telegram' && storageType !== 'huggingface' && file.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: `${storageType === 'github' ? 'GitHub' : 'R2'} 不支持超过 25MB 的文件，请切换到 Telegram 或 HuggingFace`,
        maxSize: 25 * 1024 * 1024
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // WebP 转换
    let processedFile = file
    let processedName = file.name

    if (convertToWebp && file.type && file.type.startsWith('image/')) {
      try {
        const imageData = await file.arrayBuffer()
        const blob = new Blob([imageData], { type: file.type })
        const imageBitmap = await createImageBitmap(blob)
        
        const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(imageBitmap, 0, 0)
        
        const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 })
        const webpArrayBuffer = await webpBlob.arrayBuffer()
        const webpFile = new File([webpArrayBuffer], file.name.replace(/\.[^/.]+$/, '') + '.webp', { type: 'image/webp' })
        
        processedFile = webpFile
        processedName = file.name.replace(/\.[^/.]+$/, '') + '.webp'
        console.log(`✅ 已转换 WebP: ${file.name}`)
      } catch (e) {
        console.log('⚠️ WebP 转换失败，使用原图:', e.message)
        processedFile = file
        processedName = file.name
      }
    }

    const filename = generateFilename(processedName)
    const arrayBuffer = await processedFile.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    let uploadedUrl = ''
    let usedStorage = storageType
    let tgMessageId = null
    let tgFileId = null
    let tgFilePath = null

    // 1. Telegram 存储
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
        const result = await uploadToTelegram(processedFile, botToken, chatId);
        tgFileId = result.fileId;
        tgMessageId = result.messageId;
        tgFilePath = result.filePath;
        usedStorage = 'telegram';
        
        const baseUrl = new URL(request.url).origin;
        uploadedUrl = `${baseUrl}/api/short/${filename}`;
        
        if (bucket) {
          try {
            const metaKey = `telegram_files/${filename}`
            await bucket.put(metaKey, JSON.stringify({
              fileId: tgFileId,
              messageId: tgMessageId,
              filePath: tgFilePath,
              filename: filename,
              originalName: processedFile.name,
              size: processedFile.size,
              mimeType: processedFile.type || 'application/octet-stream',
              uploadedAt: new Date().toISOString()
            }, null, 2), {
              httpMetadata: { contentType: 'application/json' }
            })
          } catch (e) {
            console.error('保存短链接记录失败:', e)
          }
        }
        
        if (token) {
          const existingImages = await getTelegramImages(token);
          const exists = existingImages.some(img => img.fileId === tgFileId);
          if (!exists) {
            existingImages.push({
              id: Date.now(),
              filename: filename,
              originalName: processedFile.name,
              fileId: tgFileId,
              messageId: tgMessageId,
              filePath: tgFilePath,
              url: uploadedUrl,
              time: new Date().toISOString(),
              size: processedFile.size,
              mimeType: processedFile.type || 'image/jpeg'
            });
            await saveTelegramImages(token, existingImages);
            console.log(`✅ Telegram 文件已记录到 GitHub: ${filename}`);
          }
        }
        
        console.log('Telegram 上传成功:', {
          fileId: tgFileId,
          messageId: tgMessageId,
          filePath: tgFilePath,
          url: uploadedUrl,
          size: processedFile.size
        });
        
      } catch (error) {
        console.error('Telegram upload error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    // 2. HuggingFace 存储 ⬅️ 新增
    } else if (storageType === 'huggingface') {
      const hfToken = env.HF_TOKEN
      const hfRepo = env.HF_REPO
      
      if (!hfToken || !hfRepo) {
        return new Response(JSON.stringify({ error: 'HuggingFace 存储未配置，请设置 HF_TOKEN 和 HF_REPO' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      try {
        const hfPath = `${folder}/${filename}`
        const result = await uploadToHuggingFace(processedFile, hfPath, env)
        
        if (!result.success) {
          throw new Error(result.error || 'HuggingFace 上传失败')
        }
        
        uploadedUrl = result.url
        usedStorage = 'huggingface'
        console.log(`✅ HuggingFace 上传成功: ${hfPath}`)
      } catch (error) {
        console.error('HuggingFace upload error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }

    // 3. R2 存储
    } else if (storageType === 'r2') {
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      const key = `${folder}/${filename}`
      await bucket.put(key, arrayBuffer, {
        httpMetadata: { contentType: processedFile.type || 'image/webp' }
      })
      const baseUrl = new URL(request.url).origin;
      uploadedUrl = `${baseUrl}/api/image?path=${key}`
      usedStorage = 'r2'

    // 4. GitHub 存储
    } else {
      if (!token) {
        return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const ext = processedName.split('.').pop().toLowerCase()
      const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'ico', 'svg']
      if (!imageExts.includes(ext)) {
        return new Response(JSON.stringify({ 
          error: `GitHub 存储仅支持图片格式，${ext.toUpperCase()} 文件请使用 Telegram 存储` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i])
      }
      const base64Content = btoa(binary)
      
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
      tgFilePath: tgFilePath,
      fileSize: processedFile.size,
      converted: convertToWebp && processedFile.type === 'image/webp'
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
