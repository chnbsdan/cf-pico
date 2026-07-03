// functions/api/admin/delete.js - POST /api/admin/delete 删除文件（调试版）
import { getTelegramImages, saveTelegramImages } from '../utils/github.js'
import { deleteCompletedFile } from '../utils/r2.js'
import { deleteTelegramFile } from '../utils/telegram.js'
import { deleteFromHuggingFace } from '../utils/huggingface.js'

export async function onRequest(context) {
  const { request, env } = context
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const body = await request.json()
    const { filename, folder, sha, source, tgMessageId, fileId } = body

    console.log('🔍 删除请求:', { filename, folder, source })

    if (!filename || !folder) {
      return new Response(JSON.stringify({ error: 'Missing filename or folder' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let deleted = false
    let deleteErrors = []

    // 删除 Telegram 文件（包括分片文件）
    if (source === 'telegram' || source === 'telegram_chunks') {
      const botToken = env.TG_BOT_TOKEN;
      const chatId = env.TG_CHAT_ID;
      
      if (source === 'telegram_chunks' && fileId) {
        if (bucket) {
          const deletedMeta = await deleteCompletedFile(bucket, fileId)
          if (deletedMeta) {
            deleted = true
            console.log(`✅ 分片文件元数据已删除: ${fileId}`)
          }
        }
      } else if (botToken && chatId && tgMessageId) {
        try {
          const result = await deleteTelegramFile(botToken, chatId, tgMessageId);
          if (result) {
            console.log(`✅ Telegram 消息已删除: ${tgMessageId}`);
            deleted = true;
          }
        } catch (e) {
          console.warn(`⚠️ Telegram 删除异常: ${e.message}`);
        }
      }
      
      if (bucket && filename) {
        try {
          const metaKey = `telegram_files/${filename}`
          await bucket.delete(metaKey)
        } catch (e) {}
      }
      
      if (token) {
        try {
          const images = await getTelegramImages(token);
          const newImages = images.filter(img => img.messageId !== tgMessageId && img.fileId !== fileId);
          if (newImages.length !== images.length) {
            await saveTelegramImages(token, newImages);
            deleted = true;
          }
        } catch (e) {
          console.error('清理 Telegram 记录失败:', e)
          deleteErrors.push('记录清理失败');
        }
      }
    }

    // ✅ 删除 HuggingFace 存储的文件（调试版）
    if (source === 'huggingface') {
      if (env.HF_TOKEN && env.HF_REPO) {
        try {
          let hfPath = filename
          if (!filename.includes('/')) {
            hfPath = `${folder}/${filename}`
          }
          console.log('🔍 HuggingFace 删除路径:', hfPath)
          
          const result = await deleteFromHuggingFace(hfPath, env)
          console.log('🔍 HuggingFace 删除结果:', JSON.stringify(result))
          
          if (result.success) {
            deleted = true
            console.log(`✅ HuggingFace 已删除: ${hfPath}`)
          } else {
            // ✅ 把具体错误信息传给前端
            deleteErrors.push(`HuggingFace 删除失败: ${result.error || '未知错误'}`)
          }
        } catch (e) {
          console.error('HuggingFace delete error:', e)
          deleteErrors.push(`HuggingFace 删除异常: ${e.message}`)
        }
      } else {
        deleteErrors.push('HuggingFace 未配置 (HF_TOKEN 或 HF_REPO 缺失)')
      }
    }

    // 删除 R2 存储的文件
    if (source === 'r2' || (!source && !tgMessageId && source !== 'telegram_chunks' && source !== 'huggingface')) {
      if (bucket) {
        try {
          const key = `${folder}/${filename}`
          await bucket.delete(key)
          deleted = true
          console.log(`✅ R2 已删除: ${key}`)
        } catch (e) {
          console.error('R2 delete error:', e)
          deleteErrors.push('R2 删除失败')
        }
      }
    }

    // 删除 GitHub 存储的文件
    if (source === 'github' || (!source && !tgMessageId && source !== 'telegram_chunks' && source !== 'huggingface')) {
      if (token && sha) {
        try {
          const apiUrl = `https://api.github.com/repos/chnbsdan/cf-pico/contents/${folder}/${filename}`
          const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Cloudflare-Pages'
            },
            body: JSON.stringify({
              message: `Delete ${filename}`,
              sha: sha,
              branch: 'main'
            })
          })
          if (response.ok) {
            deleted = true
            console.log(`✅ GitHub 已删除: ${folder}/${filename}`)
          } else {
            deleteErrors.push(`GitHub 删除失败: ${response.status}`)
          }
        } catch (e) {
          console.error('GitHub delete error:', e)
          deleteErrors.push('GitHub 删除异常')
        }
      } else if (!sha) {
        deleteErrors.push('缺少 GitHub SHA')
      }
    }

    if (deleted) {
      return new Response(JSON.stringify({ 
        success: true,
        warnings: deleteErrors.length > 0 ? deleteErrors : undefined
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ 
        error: 'Delete failed',
        details: deleteErrors
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Delete error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
