// functions/api/[[path]].js - Cloudflare Pages API 完整入口
// 支持：stats, random, wallpaper, cover, list, image, upload, history, admin/delete
// 支持 GitHub、R2、Telegram 三种存储
// ✅ 流式传输大文件，不合并到内存
// ✅ btoa 只在 GitHub 分支执行
// ✅ 用 fileId 做唯一标识，彻底解决 404

const GITHUB_USER = 'chnbsdan'
const GITHUB_REPO = 'cf-pico'
const TELEGRAM_IMAGES_FILE = 'telegram_images.json'

// ============================================================
// 辅助函数
// ============================================================
function getMimeTypeByExt(ext) {
  const mimeTypes = {
    'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo',
    'mov': 'video/quicktime', 'mkv': 'video/x-matroska', 'm4v': 'video/mp4',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
    'flac': 'audio/flac', 'aac': 'audio/aac', 'm4a': 'audio/mp4',
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'webp': 'image/webp', 'gif': 'image/gif', 'pdf': 'application/pdf'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

const CHUNK_SIZE = 16 * 1024 * 1024
const MAX_FILE_SIZE = 500 * 1024 * 1024

// ============================================================
// R2 元数据操作
// ============================================================

async function saveChunkSession(bucket, uploadId, data) {
  if (!bucket) return false
  const key = `chunk_sessions/${uploadId}.json`
  try {
    await bucket.put(key, JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    })
    return true
  } catch (e) {
    console.error('保存分片会话失败:', e)
    return false
  }
}

async function getChunkSession(bucket, uploadId) {
  if (!bucket) return null
  const key = `chunk_sessions/${uploadId}.json`
  try {
    const object = await bucket.get(key)
    if (!object) return null
    const content = await object.text()
    return JSON.parse(content)
  } catch (e) {
    console.error('获取分片会话失败:', e)
    return null
  }
}

async function deleteChunkSession(bucket, uploadId) {
  if (!bucket) return false
  const key = `chunk_sessions/${uploadId}.json`
  try {
    await bucket.delete(key)
    return true
  } catch (e) {
    console.error('删除分片会话失败:', e)
    return false
  }
}

async function saveCompletedFile(bucket, fileId, metadata) {
  if (!bucket) return false
  const key = `completed_files/${fileId}.json`
  try {
    await bucket.put(key, JSON.stringify(metadata, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    })
    return true
  } catch (e) {
    console.error('保存文件元数据失败:', e)
    return false
  }
}

async function getCompletedFile(bucket, fileId) {
  if (!bucket) return null
  const key = `completed_files/${fileId}.json`
  try {
    const object = await bucket.get(key)
    if (!object) return null
    const content = await object.text()
    return JSON.parse(content)
  } catch (e) {
    console.error('获取文件元数据失败:', e)
    return null
  }
}

async function deleteCompletedFile(bucket, fileId) {
  if (!bucket) return false
  const key = `completed_files/${fileId}.json`
  try {
    await bucket.delete(key)
    return true
  } catch (e) {
    console.error('删除文件元数据失败:', e)
    return false
  }
}

// ============================================================
// Telegram 存储
// ============================================================

async function uploadToTelegram(file, botToken, chatId) {
  const ext = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type || '';
  
  const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext) && mimeType.startsWith('video/');
  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext) && mimeType.startsWith('audio/');

  let method = 'sendDocument';
  let fieldName = 'document';

  if (isVideo) {
    method = 'sendVideo';
    fieldName = 'video';
  } else if (isAudio) {
    method = 'sendAudio';
    fieldName = 'audio';
  }

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(fieldName, file, file.name);
  formData.append('caption', `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const error = await response.json();
    if (method !== 'sendDocument') {
      const docFormData = new FormData();
      docFormData.append('chat_id', chatId);
      docFormData.append('document', file, file.name);
      docFormData.append('caption', `📄 ${file.name}`);
      
      const docResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendDocument`,
        { method: 'POST', body: docFormData }
      );
      if (docResponse.ok) {
        const docData = await docResponse.json();
        const docResult = docData.result;
        const fileId = docResult?.document?.file_id;
        const messageId = docResult?.message_id;
        if (fileId) {
          const filePathResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
          );
          if (filePathResponse.ok) {
            const filePathData = await filePathResponse.json();
            const filePath = filePathData.result?.file_path;
            if (filePath) {
              return {
                fileId,
                messageId,
                filePath,
                storageType: 'telegram',
                method: 'sendDocument',
                fileSize: file.size,
                mimeType: mimeType || 'application/octet-stream'
              };
            }
          }
        }
      }
    }
    throw new Error(error.description || 'Telegram 上传失败');
  }

  const data = await response.json();
  const result = data.result;

  let fileId = null;
  const fields = ['document', 'photo', 'video', 'audio', 'animation', 'sticker', 'voice', 'video_note'];
  
  for (const field of fields) {
    if (result?.[field]) {
      if (field === 'photo' && Array.isArray(result.photo)) {
        fileId = result.photo[result.photo.length - 1]?.file_id;
      } else if (result[field]?.file_id) {
        fileId = result[field].file_id;
      }
      if (fileId) break;
    }
  }
  
  if (!fileId && result?.file_id) {
    fileId = result.file_id;
  }

  const messageId = result?.message_id;

  if (!fileId) {
    console.error('❌ Telegram 响应:', JSON.stringify(data, null, 2));
    throw new Error(`Telegram 未返回 file_id (${method})`);
  }

  const filePathResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  
  if (!filePathResponse.ok) {
    throw new Error('获取 Telegram 文件路径失败');
  }
  
  const filePathData = await filePathResponse.json();
  const filePath = filePathData.result?.file_path;

  if (!filePath) {
    throw new Error('Telegram 未返回 file_path');
  }

  return {
    fileId,
    messageId,
    filePath,
    storageType: 'telegram',
    method: method,
    fileSize: file.size,
    mimeType: mimeType || 'application/octet-stream'
  };
}

async function uploadChunkToTelegram(chunkData, botToken, chatId, chunkIndex, filename) {
  const formData = new FormData()
  formData.append('chat_id', chatId)
  formData.append('document', new Blob([chunkData]), `chunk_${String(chunkIndex).padStart(4, '0')}_${filename}`)
  formData.append('caption', `📦 分片 ${chunkIndex + 1}`)

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.description || 'Telegram 分片上传失败')
  }

  const data = await response.json()
  const result = data.result
  let fileId = null
  
  if (result?.document?.file_id) {
    fileId = result.document.file_id
  } else if (result?.photo && Array.isArray(result.photo)) {
    fileId = result.photo[result.photo.length - 1]?.file_id
  } else if (result?.video?.file_id) {
    fileId = result.video.file_id
  } else if (result?.audio?.file_id) {
    fileId = result.audio.file_id
  } else if (result?.file_id) {
    fileId = result.file_id
  }
  
  if (!fileId) {
    console.error('❌ 无法提取 file_id，完整响应:', JSON.stringify(data, null, 2))
    throw new Error('Telegram 未返回 file_id')
  }

  return fileId
}

async function downloadChunkFromTelegram(botToken, fileId) {
  const filePathRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  )
  if (!filePathRes.ok) {
    throw new Error('获取文件路径失败')
  }
  const filePathData = await filePathRes.json()
  const filePath = filePathData.result?.file_path
  if (!filePath) {
    throw new Error('未获取到文件路径')
  }

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`下载分片失败: ${response.status}`)
  }

  return await response.arrayBuffer()
}

async function deleteTelegramMessage(botToken, chatId, messageId) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`
    )
    return response.ok
  } catch (e) {
    return false
  }
}

async function getTelegramFileContentByFileId(botToken, fileId) {
  if (!fileId) {
    throw new Error('缺少 fileId');
  }

  const getFilePathUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const filePathRes = await fetch(getFilePathUrl);
  
  if (!filePathRes.ok) {
    const errorText = await filePathRes.text();
    throw new Error(`获取文件路径失败: ${filePathRes.status} ${errorText}`);
  }
  
  const filePathData = await filePathRes.json();
  const currentFilePath = filePathData.result?.file_path;
  
  if (!currentFilePath) {
    throw new Error('Telegram 未返回 file_path');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${currentFilePath}`;
  const response = await fetch(downloadUrl);
  
  if (!response.ok) {
    throw new Error(`从 Telegram 下载文件失败: ${response.status}`);
  }
  
  const fileData = await response.arrayBuffer();
  
  const ext = currentFilePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
    'svg': 'image/svg+xml', 'ico': 'image/x-icon',
    'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo',
    'mov': 'video/quicktime', 'mkv': 'video/x-matroska',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
    'flac': 'audio/flac', 'aac': 'audio/aac', 'm4a': 'audio/mp4',
    'pdf': 'application/pdf', 'zip': 'application/zip'
  };
  
  const contentType = mimeTypes[ext] || response.headers.get('Content-Type') || 'application/octet-stream';
  
  return new Response(fileData, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': `inline; filename="${encodeURIComponent(currentFilePath.split('/').pop())}"`
    }
  });
}

async function deleteTelegramFile(botToken, chatId, messageId) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`
  );
  return response.ok;
}

// ============================================================
// Telegram 图片列表管理
// ============================================================

async function getTelegramImages(token) {
  if (!token) return []
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${TELEGRAM_IMAGES_FILE}`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (response.status === 404) return []
    if (!response.ok) return []
    const data = await response.json()
    const content = atob(data.content)
    return JSON.parse(content) || []
  } catch (error) {
    console.error('读取 Telegram 图片列表失败:', error)
    return []
  }
}

async function saveTelegramImages(token, images, sha = null) {
  if (!token) return false
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${TELEGRAM_IMAGES_FILE}`
  
  let existingSha = sha
  if (!existingSha) {
    try {
      const getRes = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Cloudflare-Pages'
        }
      })
      if (getRes.ok) {
        const data = await getRes.json()
        existingSha = data.sha
      }
    } catch (e) {}
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Pages'
    },
    body: JSON.stringify({
      message: 'Update Telegram images list',
      content: btoa(JSON.stringify(images, null, 2)),
      sha: existingSha || undefined,
      branch: 'main'
    })
  })
  return response.ok
}

// ============================================================
// 工具函数
// ============================================================

async function getFolderImages(folder, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    console.error('GITHUB_TOKEN 未设置')
    return []
  }
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`)
      return []
    }
    const files = await response.json()
    if (!Array.isArray(files)) return []
    return files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) && f.name !== '.keep'
    })
  } catch (error) {
    console.error(`Failed to fetch ${folder}:`, error)
    return []
  }
}

function generateFilename(originalName) {
  const now = new Date()
  const datePrefix = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const safeName = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    .slice(0, 100)
  const ext = originalName.split('.').pop().toLowerCase()
  return `${datePrefix}_${safeName}.${ext}`
}

// ============================================================
// 分片上传 API
// ============================================================

async function handleInitChunkUpload(request, env) {
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

async function handleUploadChunk(request, env) {
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

// ============================================================
// ✅ 修复：完成分片上传 - 用 fileId 做唯一标识
// ============================================================
async function handleCompleteChunkUpload(request, env) {
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
    // ✅ 用 fileId 做链接
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

// ============================================================
// ✅ 修复：流式下载大文件 - 用 fileId 查询
// ============================================================
async function handleDownloadLarge(request, env, waitUntil) {
  try {
    const url = new URL(request.url)
    // 提取 fileId，去掉扩展名
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

    // ✅ 直接用 fileId 查询
    const fileMeta = await getCompletedFile(bucket, fileId)
    if (!fileMeta) {
      return new Response('文件不存在', { status: 404 })
    }

    const botToken = env.TG_BOT_TOKEN
    if (!botToken) {
      return new Response('Telegram 未配置', { status: 500 })
    }

    // 获取 Content-Type
    const ext = fileMeta.extension || fileMeta.filename.split('.').pop().toLowerCase()
    const mimeTypes = {
      'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'jpg': 'image/jpeg',
      'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif'
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // 流式传输
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

// ============================================================
// ✅ 修复：删除大文件 - 用 fileId
// ============================================================
async function handleDeleteLarge(request, env) {
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

// ============================================================
// 短链接处理
// ============================================================
async function handleShort(request, env) {
  try {
    const url = new URL(request.url)
    const filename = url.pathname.split('/').pop()
    
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
      } catch (e) {}
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

// ============================================================
// ✅ 修复：handleUpload - btoa 只在 GitHub 分支执行
// ============================================================
async function handleUpload(request, env) {
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const folder = formData.get('folder') || 'wallpaper'
    const storageType = formData.get('storage') || 'github'

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 文件大小检查
    if (storageType === 'telegram' && file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: '文件超过 50MB，请使用分片上传',
        needChunkUpload: true,
        maxDirectSize: 50 * 1024 * 1024
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (storageType !== 'telegram' && file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: `${storageType === 'github' ? 'GitHub' : 'R2'} 不支持超过 10MB 的文件，请切换到 Telegram`,
        maxSize: 10 * 1024 * 1024
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const filename = generateFilename(file.name)
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    let uploadedUrl = ''
    let usedStorage = storageType
    let tgMessageId = null
    let tgFileId = null
    let tgFilePath = null

    // ============================================================
    // 1. Telegram 存储
    // ============================================================
    if (storageType === 'telegram') {
      const botToken = env.TG_BOT_TOKEN;
      const chatId = env.TG_CHAT_ID;
      
      if (!botToken || !chatId) {
        return new Response(JSON.stringify({ error: 'Telegram 存储未配置' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const result = await uploadToTelegram(file, botToken, chatId);
        tgFileId = result.fileId;
        tgMessageId = result.messageId;
        tgFilePath = result.filePath;
        usedStorage = 'telegram';
        
        const baseUrl = new URL(request.url).origin;
        uploadedUrl = `${baseUrl}/api/short/${filename}`;
        
        if (bucket) {
          try {
            const metaKey = `telegram_files/${filename}`
            await bucket.put(metaKey, JSON.stringify({
              fileId: tgFileId,
              messageId: tgMessageId,
              filePath: tgFilePath,
              filename: filename,
              originalName: file.name,
              size: file.size,
              mimeType: file.type || 'application/octet-stream',
              uploadedAt: new Date().toISOString()
            }, null, 2), {
              httpMetadata: { contentType: 'application/json' }
            })
          } catch (e) {
            console.error('保存短链接记录失败:', e)
          }
        }
        
        if (token) {
          const existingImages = await getTelegramImages(token);
          const exists = existingImages.some(img => img.fileId === tgFileId);
          if (!exists) {
            existingImages.push({
              id: Date.now(),
              filename: filename,
              originalName: file.name,
              fileId: tgFileId,
              messageId: tgMessageId,
              filePath: tgFilePath,
              url: uploadedUrl,
              time: new Date().toISOString(),
              size: file.size,
              mimeType: file.type || 'application/octet-stream'
            });
            await saveTelegramImages(token, existingImages);
            console.log(`✅ Telegram 文件已记录到 GitHub: ${filename}`);
          }
        }
        
        console.log('Telegram 上传成功:', {
          fileId: tgFileId,
          messageId: tgMessageId,
          filePath: tgFilePath,
          url: uploadedUrl,
          size: file.size
        });
        
      } catch (error) {
        console.error('Telegram upload error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    // ============================================================
    // 2. R2 存储
    // ============================================================
    } else if (storageType === 'r2') {
      if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      const key = `${folder}/${filename}`
      await bucket.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type || 'image/jpeg' }
      })
      const baseUrl = new URL(request.url).origin;
      uploadedUrl = `${baseUrl}/api/image?path=${key}`
      usedStorage = 'r2'

    // ============================================================
    // 3. GitHub 存储 - 只有这里执行 btoa
    // ============================================================
    } else {
      if (!token) {
        return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const ext = file.name.split('.').pop().toLowerCase()
      const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'ico', 'svg']
      if (!imageExts.includes(ext)) {
        return new Response(JSON.stringify({ 
          error: `GitHub 存储仅支持图片格式，${ext.toUpperCase()} 文件请使用 Telegram 存储` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // ✅ 只有这里才执行 btoa
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i])
      }
      const base64Content = btoa(binary)
      
      const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Pages'
        },
        body: JSON.stringify({
          message: `Upload ${filename}`,
          content: base64Content,
          branch: 'main'
        })
      })
      if (!response.ok) {
        const error = await response.text()
        console.error('GitHub upload error:', error)
        return new Response(JSON.stringify({ error: 'GitHub upload failed' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      const data = await response.json()
      const baseUrl = new URL(request.url).origin;
      uploadedUrl = `${baseUrl}/api/image?path=${folder}/${filename}`
      usedStorage = 'github'
    }

    return new Response(JSON.stringify({
      success: true,
      filename: filename,
      folder: folder,
      url: uploadedUrl,
      storage: usedStorage,
      rawUrl: uploadedUrl,
      tgMessageId: tgMessageId,
      tgFileId: tgFileId,
      tgFilePath: tgFilePath,
      fileSize: file.size
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ============================================================
// API 处理函数
// ============================================================

async function handleStats(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const githubFolders = {}
  let githubTotal = 0
  let externalTotal = 0
  let telegramTotal = 0

  for (const folder of folders) {
    const images = await getFolderImages(folder, env)
    githubFolders[folder] = images.length
    githubTotal += images.length
  }

  const token = env.GITHUB_TOKEN
  if (token) {
    const telegramImages = await getTelegramImages(token)
    telegramTotal = telegramImages.length
    
    const bucket = env.IMAGES_BUCKET
    if (bucket) {
      try {
        const objects = await bucket.list({ prefix: 'completed_files/' })
        telegramTotal += objects.objects.length
      } catch (e) {}
    }
    
    try {
      const extUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
      const response = await fetch(extUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Cloudflare-Pages'
        }
      })
      if (response.ok) {
        const data = await response.json()
        const content = atob(data.content)
        const external = JSON.parse(content)
        for (const folder of folders) {
          externalTotal += (external[folder] || []).length
        }
      }
    } catch (e) {
      console.error('Failed to fetch external.json:', e)
    }
  }

  return new Response(JSON.stringify({
    github_folders: githubFolders,
    github_total: githubTotal,
    external_total: externalTotal,
    telegram_total: telegramTotal,
    grand_total: githubTotal + externalTotal + telegramTotal
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleRandom(request, env) {
  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  
  const folders = ['wallpaper', 'cover', 'sh', 'sd'];
  let allImages = [];
  
  for (const folder of folders) {
    const images = await getFolderImages(folder, env);
    allImages = allImages.concat(images.map(f => ({ ...f, folder })));
  }
  
  if (allImages.length === 0) {
    return new Response('No images found', { status: 404 });
  }
  
  const random = allImages[Math.floor(Math.random() * allImages.length)];
  const baseUrl = new URL(request.url).origin;
  const imageUrl = `${baseUrl}/api/image?path=${random.folder}/${random.name}`;
  
  if (format === 'json') {
    const result = {
      code: 200,
      imgurl: imageUrl,
      total: allImages.length
    };
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  const response = await fetch(random.download_url);
  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleWallpaper(request, env) {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'wallpaper'
  const images = await getFolderImages(folder, env)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

async function handleCover(request, env) {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder') || 'cover'
  const images = await getFolderImages(folder, env)
  if (images.length === 0) {
    return new Response('No images found', { status: 404 })
  }
  const random = images[Math.floor(Math.random() * images.length)]
  const response = await fetch(random.download_url)
  return new Response(response.body, {
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'image/jpeg' }
  })
}

async function handleList(env) {
  const folders = ['wallpaper', 'cover', 'sh', 'sd']
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  const results = {}
  let total = 0

  let telegramImages = []
  if (token) {
    telegramImages = await getTelegramImages(token)
  }
  
  let chunkFiles = []
  if (bucket) {
    try {
      const objects = await bucket.list({ prefix: 'completed_files/' })
      for (const obj of objects.objects) {
        try {
          const object = await bucket.get(obj.key)
          if (object) {
            const content = await object.text()
            const meta = JSON.parse(content)
            chunkFiles.push({
              ...meta,
              fromR2: true,
              name: meta.filename || 'unknown'
            })
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  
  const allTelegramImages = [...telegramImages, ...chunkFiles]
  
  results['telegram'] = allTelegramImages.map(img => ({
    name: img.filename || img.originalName || 'unknown',
    url: img.url || (img.fileId ? `/api/large/${img.fileId}.${img.extension || ''}` : ''),
    path: `telegram/${img.fileId || ''}`,
    sha: img.fileId || '',
    size: img.totalSize || img.size || 0,
    folder: 'telegram',
    source: img.storageType === 'telegram_chunks' ? 'telegram_chunks' : 'telegram',
    fileId: img.fileId,
    messageId: img.messageId,
    filePath: img.filePath,
    time: img.uploadedAt || img.time,
    fromR2: !!img.fromR2,
    chunkCount: img.chunkCount,
    extension: img.extension || ''
  }))
  total += results['telegram'].length

  let externalImages = {}
  if (token) {
    try {
      const extUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
      const response = await fetch(extUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Cloudflare-Pages'
        }
      })
      if (response.ok) {
        const data = await response.json()
        const content = atob(data.content)
        const external = JSON.parse(content)
        for (const folder of folders) {
          externalTotal += (external[folder] || []).length
        }
      }
    } catch (e) {
      console.error('Failed to fetch external.json:', e)
    }
  }

  for (const folder of folders) {
    const images = []
    const seen = new Set()

    if (token) {
      try {
        const githubImages = await getFolderImages(folder, env)
        for (const img of githubImages) {
          const key = `${folder}/${img.name}`
          if (!seen.has(key)) {
            seen.add(key)
            images.push({
              name: img.name,
              url: `https://cf-pico.pages.dev/api/image?path=${key}`,
              path: key,
              sha: img.sha,
              size: img.size,
              folder: folder,
              source: 'github'
            })
          }
        }
      } catch (e) {
        console.error(`GitHub list error for ${folder}:`, e)
      }
    }

    if (bucket) {
      try {
        const objects = await bucket.list({ prefix: `${folder}/` })
        for (const obj of objects.objects) {
          const key = obj.key
          const name = key.split('/').pop()
          const ext = name.split('.').pop().toLowerCase()
          if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) continue
          if (name === '.keep') continue
          if (!seen.has(key)) {
            seen.add(key)
            images.push({
              name: name,
              url: `https://cf-pico.pages.dev/api/image?path=${key}`,
              path: key,
              sha: obj.etag || '',
              size: obj.size || 0,
              folder: folder,
              source: 'r2'
            })
          }
        }
      } catch (e) {
        console.error(`R2 list error for ${folder}:`, e)
      }
    }

    const extList = externalImages[folder] || []
    for (const url of extList) {
      const name = url.split('/').pop()
      const key = `${folder}/${name}`
      if (!seen.has(key)) {
        seen.add(key)
        images.push({
          name: name,
          url: url,
          path: key,
          sha: '',
          size: 0,
          folder: folder,
          source: 'external'
        })
      }
    }

    results[folder] = images
    total += images.length
  }

  return new Response(JSON.stringify({
    total: total,
    folders: results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleImage(request, env) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  if (!path) {
    return new Response('Missing path parameter', { status: 400 })
  }

  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN
  const parts = path.split('/')
  const folder = parts[0]
  const filename = parts.slice(1).join('/')
  const allowedFolders = ['wallpaper', 'cover', 'sh', 'sd', 'telegram']

  if (!allowedFolders.includes(folder)) {
    return new Response('Invalid folder', { status: 403 })
  }

  if (folder === 'telegram') {
    const botToken = env.TG_BOT_TOKEN;
    if (!botToken) {
      return new Response('Telegram 未配置', { status: 500 });
    }

    let fileId = null

    if (bucket) {
      const metaKey = `completed_files/${filename}.json`
      try {
        const object = await bucket.get(metaKey)
        if (object) {
          const content = await object.text()
          const meta = JSON.parse(content)
          if (meta.fileId) {
            fileId = meta.fileId
          }
        }
      } catch (e) {}
    }

    if (!fileId && token) {
      try {
        const images = await getTelegramImages(token)
        const record = images.find(img => img.filePath === filename || img.fileId === filename)
        if (record) {
          fileId = record.fileId
        }
      } catch (e) {}
    }

    if (!fileId) {
      fileId = filename
    }

    try {
      return await getTelegramFileContentByFileId(botToken, fileId)
    } catch (error) {
      console.error('Telegram fetch error:', error)
      return new Response(`Telegram 文件获取失败: ${error.message}`, { status: 404 })
    }
  }

  if (bucket) {
    try {
      const object = await bucket.get(path)
      if (object) {
        const contentType = object.httpMetadata?.contentType || 'image/jpeg'
        const body = await object.arrayBuffer()
        
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    } catch (e) {
      console.log('R2 miss, trying GitHub:', e.message)
    }
  }

  if (!token) {
    return new Response('GITHUB_TOKEN not configured', { status: 500 })
  }

  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${folder}/${filename}`

  try {
    const response = await fetch(rawUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!response.ok) {
      return new Response('Image not found', { status: 404 })
    }

    const ext = filename.split('.').pop().toLowerCase()
    const contentTypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'webp': 'image/webp', 'gif': 'image/gif', 'avif': 'image/avif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'mp4': 'video/mp4', 'webm': 'video/webm'
    }
    const contentType = contentTypes[ext] || 'image/jpeg'
    const body = await response.arrayBuffer()

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('GitHub fetch error:', error)
    return new Response('Internal error', { status: 500 })
  }
}

// ============================================================
// 历史记录
// ============================================================

async function handleHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (response.status === 404) {
      return new Response(JSON.stringify({ history: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const data = await response.json()
    const content = atob(data.content)
    const history = JSON.parse(content)
    return new Response(JSON.stringify({ history: history || [] }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('History error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function addHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { filename, url, folder } = body

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const historyUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
    let existingHistory = []
    let sha = null

    const getResponse = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (getResponse.ok) {
      const data = await getResponse.json()
      sha = data.sha
      const content = atob(data.content)
      existingHistory = JSON.parse(content) || []
    }

    const newRecord = {
      id: Date.now(),
      filename,
      url,
      folder,
      time: new Date().toISOString()
    }
    existingHistory.unshift(newRecord)
    const trimmedHistory = existingHistory.slice(0, 1000)

    const putResponse = await fetch(historyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({
        message: 'Update upload history',
        content: btoa(JSON.stringify(trimmedHistory, null, 2)),
        sha: sha,
        branch: 'main'
      })
    })

    if (!putResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to save history' }), {
        status: putResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, history: trimmedHistory }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Add history error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function deleteHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const historyUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
    let sha = null
    let existingHistory = []

    const getResponse = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!getResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: getResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await getResponse.json()
    sha = data.sha
    const content = atob(data.content)
    existingHistory = JSON.parse(content) || []

    const newHistory = existingHistory.filter(record => record.id !== parseInt(id))

    const putResponse = await fetch(historyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({
        message: 'Delete history record',
        content: btoa(JSON.stringify(newHistory, null, 2)),
        sha: sha,
        branch: 'main'
      })
    })

    if (!putResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to delete' }), {
        status: putResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Delete history error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ============================================================
// 删除 API
// ============================================================

async function handleDelete(request, env) {
  const bucket = env.IMAGES_BUCKET
  const token = env.GITHUB_TOKEN

  try {
    const body = await request.json()
    const { filename, folder, sha, source, tgMessageId, fileId } = body

    if (!filename || !folder) {
      return new Response(JSON.stringify({ error: 'Missing filename or folder' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let deleted = false
    let deleteErrors = []

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
      
      // 删除 R2 短链接记录
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

    if (source === 'r2' || (!source && !tgMessageId && source !== 'telegram_chunks')) {
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

    if (source === 'github' || (!source && !tgMessageId && source !== 'telegram_chunks')) {
      if (token && sha) {
        try {
          const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}/${filename}`
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ============================================================
// Telegram 随机
// ============================================================

async function handleTelegramRandom(env, request) {
  const token = env.GITHUB_TOKEN;
  const bucket = env.IMAGES_BUCKET;
  
  let allTelegramItems = []
  
  if (bucket) {
    try {
      const objects = await bucket.list({ prefix: 'completed_files/' })
      for (const obj of objects.objects) {
        try {
          const object = await bucket.get(obj.key)
          if (object) {
            const content = await object.text()
            const meta = JSON.parse(content)
            allTelegramItems.push(meta)
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  
  if (token) {
    const githubItems = await getTelegramImages(token)
    allTelegramItems = allTelegramItems.concat(githubItems)
  }
  
  if (!allTelegramItems || allTelegramItems.length === 0) {
    return new Response('No Telegram images found', { status: 404 });
  }

  const randomItem = allTelegramItems[Math.floor(Math.random() * allTelegramItems.length)];
  const baseUrl = 'https://pico.1356666.xyz';
  const fileId = randomItem.fileId;
  const ext = randomItem.extension || ''
  const imageUrl = `${baseUrl}/api/large/${fileId}.${ext}`;

  const url = new URL(request.url);
  const format = url.searchParams.get('format');

  if (format === 'html') {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TG 壁纸</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 100vw; height: 100vh; overflow: hidden; background: #000; }
    img { width: 100vw; height: 100vh; object-fit: cover; display: block; }
  </style>
</head>
<body>
  <img id="tgImage" src="${imageUrl}" alt="TG壁纸">
  <script>
    function refreshImage() {
      document.getElementById('tgImage').src = '/api/large/${fileId}.${ext}?t=' + Date.now();
      setTimeout(refreshImage, 3600000);
    }
    setTimeout(refreshImage, 3600000);
  </script>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-cache' }
    });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image from proxy');
    }
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error fetching Telegram random image:', error)
    return new Response('Failed to fetch image', { status: 500 });
  }
}

// ============================================================
// 主入口
// ============================================================

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context
  const method = request.method

  let path = ''
  if (Array.isArray(params.path)) {
    path = params.path.join('/')
  } else {
    path = params.path || ''
  }

  console.log(`API 请求: ${method} ${path}`)

  // 大文件分片路由
  if (path === 'upload/init' && method === 'POST') {
    return handleInitChunkUpload(request, env)
  }
  if (path === 'upload/chunk' && method === 'POST') {
    return handleUploadChunk(request, env)
  }
  if (path === 'upload/complete' && method === 'POST') {
    return handleCompleteChunkUpload(request, env)
  }
  if (path.startsWith('large/')) {
    if (method === 'GET') {
      return handleDownloadLarge(request, env, waitUntil)
    }
    if (method === 'DELETE') {
      return handleDeleteLarge(request, env)
    }
  }

  // 短链接路由
  if (path.startsWith('short/')) {
    if (method === 'GET') {
      return handleShort(request, env)
    }
  }

  // 普通路由
  if (path === 'upload' && method === 'POST') {
    return handleUpload(request, env)
  }
  if (path === 'history' && method === 'POST') {
    return addHistory(request, env)
  }
  if (path === 'history' && method === 'DELETE') {
    return deleteHistory(request, env)
  }
  if (path === 'history' && method === 'GET') {
    return handleHistory(request, env)
  }
  if (path === 'admin/delete' && method === 'POST') {
    return handleDelete(request, env)
  }
  if (path === 'tg') {
    return handleTelegramRandom(env, request)
  }
  if (path === 'stats') {
    return handleStats(env)
  }
  if (path === 'random') {
    return handleRandom(request, env)
  }
  if (path === 'wallpaper') {
    return handleWallpaper(request, env)
  }
  if (path === 'cover') {
    return handleCover(request, env)
  }
  if (path === 'list') {
    return handleList(env)
  }
  if (path === 'image') {
    return handleImage(request, env)
  }

  return new Response(JSON.stringify({ error: 'API not found', path }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}
