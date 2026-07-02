// functions/api/utils/telegram.js - Telegram 存储操作

export async function uploadToTelegram(file, botToken, chatId) {
  const ext = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type || '';
  
  const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext);

  let method = 'sendDocument';
  let fieldName = 'document';

  if (isVideo) {
    method = 'sendVideo';
    fieldName = 'video';
  } else if (isAudio) {
    method = 'sendAudio';
    fieldName = 'audio';
  } else if (isImage) {
    method = 'sendDocument';
    fieldName = 'document';
  }

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(fieldName, file, file.name);
  formData.append('caption', `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

  try {
    let response = await fetch(
      `https://api.telegram.org/bot${botToken}/${method}`,
      { method: 'POST', body: formData }
    );

    if (!response.ok && method !== 'sendDocument') {
      const docFormData = new FormData();
      docFormData.append('chat_id', chatId);
      docFormData.append('document', file, file.name);
      docFormData.append('caption', `📄 ${file.name}`);
      
      response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendDocument`,
        { method: 'POST', body: docFormData }
      );
      method = 'sendDocument';
    }

    if (!response.ok) {
      const error = await response.json();
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
      throw new Error('Telegram 未返回 file_id');
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

  } catch (error) {
    console.error('uploadToTelegram 异常:', error);
    throw error;
  }
}

export async function uploadChunkToTelegram(chunkData, botToken, chatId, chunkIndex, filename) {
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

export async function downloadChunkFromTelegram(botToken, fileId) {
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

export async function getTelegramFileContentByFileId(botToken, fileId) {
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

export async function deleteTelegramFile(botToken, chatId, messageId) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`
  );
  return response.ok;
}

// ✅ 新增：从 R2 获取已完成文件元数据
// 这个函数原本在 r2.js 中，但为了减少 image.js 的导入依赖，直接在这里也导出一份
export async function getCompletedFile(bucket, fileId) {
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
