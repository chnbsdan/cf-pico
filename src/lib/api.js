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

// 历史记录
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
