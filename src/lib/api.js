// src/lib/api.js - 完整版
export async function fetchStats() {
  const res = await fetch(`/api/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function uploadImage(file, folder) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  
  const res = await fetch(`/api/upload`, {
    method: 'POST',
    body: formData,
  })
  
  return res.json()
}

// 复制到剪贴板 + 成功提示
export function copyToClipboard(text, showToast = true) {
  navigator.clipboard.writeText(text)
  if (showToast) {
    const toast = document.createElement('div')
    toast.innerHTML = '<i class="fas fa-check-circle mr-1"></i> 链接已复制'
    toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg animate-fade-in-up'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }
}

// 获取图片列表
export async function fetchImageList() {
  const res = await fetch(`/api/admin/list`)
  if (!res.ok) throw new Error('Failed to fetch image list')
  return res.json()
}

// 批量复制多个链接
export async function batchCopyLinks(urls, format = 'url') {
  let text = ''
  if (format === 'url') {
    text = urls.join('\n')
  } else if (format === 'markdown') {
    text = urls.map(url => `![image](${url})`).join('\n')
  } else if (format === 'html') {
    text = urls.map(url => `<img src="${url}" alt="image">`).join('\n')
  }
  
  await navigator.clipboard.writeText(text)
  
  const toast = document.createElement('div')
  toast.innerHTML = `<i class="fas fa-check-circle mr-1"></i> 已复制 ${urls.length} 个链接`
  toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm z-50 shadow-lg animate-fade-in-up'
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2000)
}

// ========== 历史记录 API ==========

// 获取上传历史记录
export async function fetchHistory() {
  const res = await fetch(`/api/history`)
  if (!res.ok) throw new Error('Failed to fetch history')
  const data = await res.json()
  return data.history || []
}

// 添加上传历史记录
export async function addHistoryRecord(filename, url, folder) {
  const res = await fetch(`/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, url, folder })
  })
  return res.json()
}

// 删除历史记录
export async function deleteHistoryRecord(id) {
  const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
  return res.json()
}

// ========== 直传 GitHub（绕过 Vercel 4.5MB 限制）==========

// 获取预签名 URL
export async function getPresignedUrl(filename, folder, fileSize, fileType) {
  try {
    const res = await fetch(`/api/upload?action=presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, folder, fileSize, fileType })
    })
    
    if (!res.ok) {
      const error = await res.json()
      return { success: false, error: error.error || 'Failed to get upload URL' }
    }
    
    return await res.json()
  } catch (error) {
    console.error('getPresignedUrl error:', error)
    return { success: false, error: error.message }
  }
}

// 直传文件到 GitHub（适用于大文件，绕过 Vercel 限制）
export async function uploadDirect(file, folder) {
  try {
    // 1. 获取预签名 URL
    const presignResult = await getPresignedUrl(file.name, folder, file.size, file.type)
    
    if (!presignResult.success) {
      throw new Error(presignResult.error || 'Failed to get upload URL')
    }
    
    // 使用后端返回的映射后文件夹名
    const { uploadUrl, filename, folder: mappedFolder, headers } = presignResult
    
    // 2. 读取文件内容并转 Base64
    const fileContent = await file.arrayBuffer()
    const uint8Array = new Uint8Array(fileContent)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Content = btoa(binary)
    
    // 3. 直接 PUT 到 GitHub API
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': headers?.Authorization || `Bearer ${localStorage.getItem('github_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload ${filename}`,
        content: base64Content,
        branch: 'main'
      })
    })
    
    if (!response.ok) {
      let errorMessage = 'Upload failed'
      try {
        const error = await response.json()
        errorMessage = error.message || errorMessage
      } catch (e) {}
      throw new Error(errorMessage)
    }
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pcbed.vercel.app'
    
    // 使用后端映射后的文件夹名 mappedFolder
    return {
      success: true,
      filename: filename,
      folder: mappedFolder,
      url: `${baseUrl}/api/image?path=${mappedFolder}/${filename}`
    }
  } catch (error) {
    console.error('UploadDirect error:', error)
    return {
      success: false,
      filename: file.name,
      error: error.message || '上传失败'
    }
  }
}
