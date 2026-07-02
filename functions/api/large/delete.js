// functions/api/large/delete.js - DELETE /api/large/* 删除大文件
import { getCompletedFile, deleteCompletedFile } from '../utils/r2.js'
import { deleteChunkSession } from '../utils/r2.js'

export async function onRequest(context) {
  const { request, env } = context
  try {
    const url = new URL(request.url)
    let fileId = url.pathname.split('/').pop()
    if (fileId.includes('.')) {
      fileId = fileId.split('.')[0]
    }
    
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Missing file ID' }), { status: 400 })
    }

    const bucket = env.IMAGES_BUCKET
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 未配置' }), { status: 500 })
    }

    const fileMeta = await getCompletedFile(bucket, fileId)
    if (!fileMeta) {
      return new Response(JSON.stringify({ error: '文件不存在' }), { status: 404 })
    }

    await deleteCompletedFile(bucket, fileId)
    await deleteChunkSession(bucket, fileId.replace('file_', ''))

    return new Response(JSON.stringify({
      success: true,
      message: '文件已删除'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Delete large file error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}