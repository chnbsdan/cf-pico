// functions/api/large/get.js - GET /api/large/* 下载大文件（流式）
import { getCompletedFile } from '../utils/r2.js'
import { downloadChunkFromTelegram } from '../utils/telegram.js'

export async function onRequest(context) {
  const { request, env, waitUntil } = context
  try {
    const url = new URL(request.url)
    let fileId = url.pathname.split('/').pop()
    if (fileId.includes('.')) {
      fileId = fileId.split('.')[0]
    }
    
    if (!fileId) {
      return new Response('Missing file ID', { status: 400 })
    }

    const bucket = env.IMAGES_BUCKET
    if (!bucket) {
      return new Response('R2 未配置', { status: 500 })
    }

    const fileMeta = await getCompletedFile(bucket, fileId)
    if (!fileMeta) {
      return new Response('文件不存在', { status: 404 })
    }

    const botToken = env.TG_BOT_TOKEN
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
        'Content-Length': String(fileMeta.totalSize),
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Download large file error:', error)
    return new Response('Download failed: ' + error.message, { status: 500 })
  }
}