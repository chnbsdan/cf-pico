// src/lib/api.js

// ============================================================
// 基础 API
// ============================================================

export async function fetchStats() {
  const res = await fetch(`/api/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function uploadImage(file, folder, storage = 'github') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  formData.append('storage', storage)
  const res = await fetch(`/api/upload`, {
    method: 'POST',
    body: formData,
  })
  return res.json()
}

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

export async function fetchImageList() {
  const res = await fetch(`/api/list`)
  if (!res.ok) throw new Error('Failed to fetch image list')
  return res.json()
}

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

export async function fetchHistory() {
  const res = await fetch(`/api/history`)
  if (!res.ok) throw new Error('Failed to fetch history')
  const data = await res.json()
  return data.history || []
}

export async function addHistoryRecord(filename, url, folder) {
  const res = await fetch(`/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, url, folder })
  })
  return res.json()
}

export async function deleteHistoryRecord(id) {
  const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' })
  return res.json()
}

// ============================================================
// 大文件分片上传 API
// ============================================================

/**
 * 初始化分片上传
 */
export async function initChunkUpload(filename, totalSize) {
  const res = await fetch('/api/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, totalSize })
  });
  return res.json();
}

/**
 * 上传单个分片
 */
export async function uploadChunk(uploadId, chunkIndex, chunk) {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', chunkIndex);
  formData.append('file', chunk);
  
  const res = await fetch('/api/upload/chunk', {
    method: 'POST',
    body: formData
  });
  return res.json();
}

/**
 * 完成分片上传
 */
export async function completeChunkUpload(uploadId, folder) {
  const res = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, folder })
  });
  return res.json();
}

/**
 * 获取大文件（合并后的文件）
 */
export async function getLargeFile(fileId) {
  const res = await fetch(`/api/large/${fileId}`);
  if (!res.ok) {
    throw new Error('下载失败');
  }
  return res;
}

/**
 * 删除大文件（删除元数据和分片记录）
 */
export async function deleteLargeFile(fileId) {
  const res = await fetch(`/api/large/${fileId}`, {
    method: 'DELETE'
  });
  return res.json();
}

/**
 * 下载大文件并保存到本地
 */
export async function downloadLargeFile(fileId, filename) {
  const res = await fetch(`/api/large/${fileId}`);
  if (!res.ok) {
    throw new Error('下载失败');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
