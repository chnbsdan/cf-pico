// functions/api/hf-upload/info.js - GET /api/hf-upload/info
// 获取 HuggingFace LFS 上传信息（前端直传用）

import { getLfsUploadInfo } from '../utils/huggingface.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  
  try {
    const fileSize = parseInt(url.searchParams.get('size') || '0')
    const filePath = url.searchParams.get('path') || ''
    const sha256 = url.searchParams.get('sha256') || ''
    const fileSample = url.searchParams.get('sample') || ''

    if (!fileSize || !filePath || !sha256) {
      return new Response(JSON.stringify({ error: 'Missing parameters: size, path, sha256 required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await getLfsUploadInfo(fileSize, filePath, sha256, fileSample, env)

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
