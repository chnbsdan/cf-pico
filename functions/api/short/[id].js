// functions/api/short/[id].js - GET /api/short/* 短链接
import { getTelegramFileContentByFileId } from '../utils/telegram.js'

export async function onRequest(context) {
  const { request, env, params } = context
  try {
    // ✅ 从 params 中获取动态路径
    const filename = params.id
    
    if (!filename) {
      return new Response('Missing filename', { status: 400 })
    }

    const bucket = env.IMAGES_BUCKET
    const botToken = env.TG_BOT_TOKEN

    let fileMeta = null
    
    if (bucket) {
      const metaKey = `telegram_files/${filename}`
      try {
        const object = await bucket.get(metaKey)
        if (object) {
          const content = await object.text()
          fileMeta = JSON.parse(content)
        }
      } catch (e) {
        console.error('R2 查找失败:', e)
      }
    }

    if (!fileMeta || !fileMeta.fileId) {
      return new Response('文件不存在', { status: 404 })
    }

    if (!botToken) {
      return new Response('Telegram 未配置', { status: 500 })
    }

    return await getTelegramFileContentByFileId(botToken, fileMeta.fileId)

  } catch (error) {
    console.error('Short link error:', error)
    return new Response('Internal error: ' + error.message, { status: 500 })
  }
}
