// functions/api/upload/chunk.js - POST /api/upload/chunk 上传分片
import { getChunkSession, saveChunkSession } from '../utils/r2.js'
import { uploadChunkToTelegram } from '../utils/telegram.js'

export async function onRequest(context) {
  const { request, env } = context
  try {
    const formData = await request.formData()
    const uploadId = formData.get('uploadId')
    const chunkIndex = parseInt(formData.get('chunkIndex'))
    const chunk = formData.get('file')

    if (!uploadId || chunkIndex === undefined || !chunk) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const bucket = env.IMAGES_BUCKET
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = await getChunkSession(bucket, uploadId)
    if (!session) {
      return new Response(JSON.stringify({ error: '上传会话不存在或已过期' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (session.uploadedChunks.some(c => c.index === chunkIndex)) {
      return new Response(JSON.stringify({
        success: true,
        chunkIndex,
        message: '分片已上传'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const botToken = env.TG_BOT_TOKEN
    const chatId = env.TG_CHAT_ID
    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: 'Telegram 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const chunkData = await chunk.arrayBuffer()
    
    let fileId
    try {
      fileId = await uploadChunkToTelegram(
        chunkData, 
        botToken, 
        chatId, 
        chunkIndex, 
        session.filename
      )
    } catch (uploadError) {
      console.error(`分片 ${chunkIndex} 上传到 Telegram 失败:`, uploadError)
      return new Response(JSON.stringify({ 
        error: `Telegram 上传失败: ${uploadError.message}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    session.uploadedChunks.push({ index: chunkIndex, fileId })
    await saveChunkSession(bucket, uploadId, session)

    const progress = Math.round((session.uploadedChunks.length / session.chunkCount) * 100)

    return new Response(JSON.stringify({
      success: true,
      chunkIndex,
      progress,
      uploaded: session.uploadedChunks.length,
      total: session.chunkCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Upload chunk error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}