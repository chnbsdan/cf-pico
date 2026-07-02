// functions/api/large/[id].js - GET /api/large/* 下载大文件
import { getCompletedFile } from '../utils/r2.js'
import { getTelegramImages } from '../utils/github.js'
import { downloadChunkFromTelegram, getTelegramFileContentByFileId } from '../utils/telegram.js'

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context
  try {
    let fileId = params.id
    if (fileId.includes('.')) {
      fileId = fileId.split('.')[0]
    }
    
    if (!fileId) {
      return new Response('Missing file ID', { status: 400 })
    }

    const bucket = env.IMAGES_BUCKET
    const token = env.GITHUB_TOKEN
    const botToken = env.TG_BOT_TOKEN

    // 1. 先从 R2 查找
    let fileMeta = null
    if (bucket) {
      fileMeta = await getCompletedFile(bucket, fileId)
    }

    // 2. 如果 R2 没有，从 GitHub 记录查找
    if (!fileMeta && token) {
      const images = await getTelegramImages(token)
      const record = images.find(img => img.fileId === fileId || img.fileId === fileId.replace('file_', ''))
      if (record) {
        fileMeta = record
        if (fileMeta && !fileMeta.chunks && botToken && fileMeta.fileId) {
          return await getTelegramFileContentByFileId(botToken, fileMeta.fileId)
        }
      }
    }

    if (!fileMeta) {
      return new Response('文件不存在', { status: 404 })
    }

    // 3. 如果是分片文件
    if (fileMeta.chunks && fileMeta.chunks.length > 0) {
      if (!botToken) {
        return new Response('Telegram 未配置', { status: 500 })
      }

      const ext = fileMeta.extension || fileMeta.filename.split('.').pop().toLowerCase()
      const mimeTypes = {
        'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'jpg': 'image/jpeg',
        'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif'
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'

      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()

      const downloadAllChunks = async () => {
        try {
          for (const chunkInfo of fileMeta.chunks) {
            const chunkData = await downloadChunkFromTelegram(botToken, chunkInfo.fileId)
            await writer.write(new Uint8Array(chunkData))
          }
          await writer.close()
        } catch (e) {
          console.error('流式下载失败:', e)
          await writer.abort(e)
        }
      }

      if (waitUntil) {
        waitUntil(downloadAllChunks())
      } else {
        downloadAllChunks().catch(e => console.error('下载失败:', e))
      }

      return new Response(readable, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(fileMeta.filename)}"`,
          'Content-Length': String(fileMeta.totalSize || 0),
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // 4. 如果是单个文件
    if (botToken && fileMeta.fileId) {
      return await getTelegramFileContentByFileId(botToken, fileMeta.fileId)
    }

    return new Response('文件不存在', { status: 404 })

  } catch (error) {
    console.error('Download large file error:', error)
    return new Response('Download failed: ' + error.message, { status: 500 })
  }
}
