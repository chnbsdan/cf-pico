// src/lib/api.js - 简化版，移除 clsx 和 tailwind-merge
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

export function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
}
