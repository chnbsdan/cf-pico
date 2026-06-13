// src/lib/api.js - 添加复制成功提示
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
    // 创建临时提示
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
