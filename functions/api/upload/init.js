// functions/api/upload/init.js - POST /api/upload/init 初始化分片
import { CHUNK_SIZE, MAX_FILE_SIZE } from '../utils/helpers.js'
import { saveChunkSession } from '../utils/r2.js'

export async function onRequest(context) {
  const { request, env } = context
  try {
    const { filename, totalSize } = await request.json()
    
    if (totalSize > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: `文件太大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const uploadId = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)
    const chunkCount = Math.ceil(totalSize / CHUNK_SIZE)

    const session = {
      uploadId,
      filename,
      totalSize,
      chunkSize: CHUNK_SIZE,
      chunkCount,
      uploadedChunks: [],
      status: 'uploading',
      createdAt: Date.now()
    }

    const bucket = env.IMAGES_BUCKET
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 未配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await saveChunkSession(bucket, uploadId, session)

    return new Response(JSON.stringify({
      uploadId,
      chunkCount,
      chunkSize: CHUNK_SIZE,
      totalSize
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}