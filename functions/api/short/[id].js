// functions/api/short/[id].js - GET /api/short/* 短链接
import { getTelegramFileContentByFileId } from '../utils/telegram.js'
import { getTelegramImages } from '../utils/github.js'

export async function onRequest(context) {
  const { request, env, params } = context
  try {
    const filename = params.id
    
    if (!filename) {
      return new Response('Missing filename', { status: 400 })
    }

    const bucket = env.IMAGES_BUCKET
    const botToken = env.TG_BOT_TOKEN
    const token = env.GITHUB_TOKEN

    let fileMeta = null
    let fileId = null

    // ✅ 1. 先从 R2 查找
    if (bucket) {
      const metaKey = `telegram_files/${filename}`
      try {
        const object = await bucket.get(metaKey)
        if (object) {
          const content = await object.text()
          fileMeta = JSON.parse(content)
          fileId = fileMeta.fileId
          console.log(`📤 R2 找到记录: ${filename}`)
        }
      } catch (e) {
        console.error('R2 查找失败:', e)
      }
    }

    // ✅ 2. 如果 R2 没有，从 GitHub 查找
    if (!fileId && token) {
      try {
        const images = await getTelegramImages(token)
        const record = images.find(img => img.filename === filename)
        if (record && record.fileId) {
          fileId = record.fileId
          fileMeta = record
          console.log(`📤 GitHub 找到记录: ${filename}`)
        }
      } catch (e) {
        console.error('GitHub 查找失败:', e)
      }
    }

    if (!fileId) {
      console.log(`❌ 文件不存在: ${filename}`)
      return new Response('文件不存在', { status: 404 })
    }

    if (!botToken) {
      return new Response('Telegram 未配置', { status: 500 })
    }

    return await getTelegramFileContentByFileId(botToken, fileId)

  } catch (error) {
    console.error('Short link error:', error)
    return new Response('Internal error: ' + error.message, { status: 500 })
  }
}
