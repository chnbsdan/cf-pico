// functions/api/upload/complete.js - POST /api/upload/complete 完成分片
import { getMimeTypeByExt, generateFilename } from '../utils/helpers.js'
import { getChunkSession, deleteChunkSession, saveCompletedFile } from '../utils/r2.js'

export async function onRequest(context) {
  const { request, env } = context
  try {
    const { uploadId, folder } = await request.json()

    if (!uploadId) {
      return new Response(JSON.stringify({ error: '缺少 uploadId' }), {
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
      return new Response(JSON.stringify({ error: '上传会话不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const expectedChunks = new Set()
    for (let i = 0; i < session.chunkCount; i++) {
      expectedChunks.add(i)
    }
    const uploadedChunks = new Set(session.uploadedChunks.map(c => c.index))
    const missingChunks = [...expectedChunks].filter(i => !uploadedChunks.has(i))

    if (missingChunks.length > 0) {
      return new Response(JSON.stringify({
        error: `缺少分片: ${missingChunks.join(', ')}`,
        missing: missingChunks
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fileId = `file_${uploadId}`
    const now = new Date()
    const datePrefix = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    
    const originalName = session.filename
    const ext = originalName.includes('.') ? originalName.split('.').pop() : ''
    const baseName = originalName.replace(/\.[^/.]+$/, '')
    const finalFilename = `${datePrefix}_${baseName}.${ext}`

    const fileMetadata = {
      fileId,
      filename: finalFilename,
      originalName: session.filename,
      totalSize: session.totalSize,
      chunkSize: session.chunkSize,
      chunkCount: session.chunkCount,
      chunks: session.uploadedChunks.sort((a, b) => a.index - b.index),
      folder: folder || 'telegram',
      storageType: 'telegram_chunks',
      uploadedAt: new Date().toISOString(),
      createdAt: session.createdAt,
      extension: ext,
      mimeType: getMimeTypeByExt(ext)
    }

    await saveCompletedFile(bucket, fileId, fileMetadata)
    await deleteChunkSession(bucket, uploadId)

    const baseUrl = new URL(request.url).origin
    const fileUrl = `${baseUrl}/api/large/${fileId}.${ext}`

    return new Response(JSON.stringify({
      success: true,
      url: fileUrl,
      filename: finalFilename,
      originalName: session.filename,
      size: session.totalSize,
      chunkCount: session.chunkCount,
      message: '上传成功'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Complete upload error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}