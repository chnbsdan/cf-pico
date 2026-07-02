// functions/api/utils/helpers.js - 公共工具函数

export const GITHUB_USER = 'chnbsdan'
export const GITHUB_REPO = 'cf-pico'
export const TELEGRAM_IMAGES_FILE = 'telegram_images.json'
export const CHUNK_SIZE = 16 * 1024 * 1024
export const MAX_FILE_SIZE = 500 * 1024 * 1024

export function getMimeTypeByExt(ext) {
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

export function generateFilename(originalName) {
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