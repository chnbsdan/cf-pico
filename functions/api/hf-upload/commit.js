// functions/api/hf-upload/commit.js - POST /api/hf-upload/commit
// 提交 HuggingFace LFS 文件引用（前端上传完成后调用）

import { commitLfsFile } from '../utils/huggingface.js'

export async function onRequest(context) {
  const { request, env } = context
  
  try {
    const body = await request.json()
    const { filePath, oid, fileSize } = body

    if (!filePath || !oid || !fileSize) {
      return new Response(JSON.stringify({ error: 'Missing parameters: filePath, oid, fileSize required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await commitLfsFile(filePath, oid, fileSize, env)

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
