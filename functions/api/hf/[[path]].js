// functions/api/hf/[path].js - HuggingFace 文件代理
// 支持图片、音频、视频、文档、压缩包等主流文件类型

export async function onRequest(context) {
  const { request, env } = context
  
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/hf/', '')
  
  if (!path) {
    return new Response('Missing path', { status: 400 })
  }

  const hfRepo = env.HF_REPO
  
  if (!hfRepo) {
    return new Response('HF_REPO not configured', { status: 500 })
  }
  
  const hfUrl = `https://huggingface.co/datasets/${hfRepo}/resolve/main/${path}`
  
  try {
    const response = await fetch(hfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://huggingface.co/'
      }
    })
    
    if (!response.ok) {
      const rawUrl = `https://huggingface.co/datasets/${hfRepo}/raw/main/${path}`
      const retryResponse = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': 'https://huggingface.co/'
        }
      })
      
      if (!retryResponse.ok) {
        return new Response('File not found', { status: 404 })
      }
      
      const buffer = await retryResponse.arrayBuffer()
      const ext = path.split('.').pop()?.toLowerCase() || ''
      const contentType = getContentType(ext)
      
      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    const buffer = await response.arrayBuffer()
    const ext = path.split('.').pop()?.toLowerCase() || ''
    const contentType = getContentType(ext)
    
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('HF proxy error:', error)
    return new Response('Proxy error', { status: 500 })
  }
}

// ============================================================
// 完整的 Content-Type 映射表
// ============================================================
function getContentType(ext) {
  const map = {
    // ==================== 图片 ====================
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'heic': 'image/heic',
    'heif': 'image/heif',
    
    // ==================== 文档 ====================
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'rtf': 'application/rtf',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'csv': 'text/csv',
    
    // ==================== 音频 ====================
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'wma': 'audio/x-ms-wma',
    'opus': 'audio/opus',
    'amr': 'audio/amr',
    
    // ==================== 视频 ====================
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    'ts': 'video/mp2t',
    
    // ==================== 压缩包 ====================
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'bz2': 'application/x-bzip2',
    'xz': 'application/x-xz',
    'tgz': 'application/gzip',
    
    // ==================== 代码 ====================
    'json': 'application/json',
    'xml': 'application/xml',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    'js': 'application/javascript',
    'ts': 'application/typescript',
    'jsx': 'text/jsx',
    'tsx': 'text/tsx',
    'html': 'text/html',
    'css': 'text/css',
    'scss': 'text/scss',
    'sass': 'text/sass',
    'less': 'text/less',
    'py': 'text/x-python',
    'java': 'text/x-java',
    'c': 'text/x-c',
    'cpp': 'text/x-c++',
    'h': 'text/x-c',
    'hpp': 'text/x-c++',
    'go': 'text/x-go',
    'rs': 'text/x-rust',
    'sh': 'application/x-sh',
    'bash': 'application/x-sh',
    'bat': 'text/x-batch',
    'ps1': 'text/x-powershell',
    
    // ==================== 字体 ====================
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'eot': 'application/vnd.ms-fontobject',
    
    // ==================== 其他 ====================
    'apk': 'application/vnd.android.package-archive',
    'ipa': 'application/iphone',
    'deb': 'application/x-deb',
    'rpm': 'application/x-rpm',
    'iso': 'application/x-iso9660-image',
    'dmg': 'application/x-apple-diskimage',
    'exe': 'application/x-msdownload',
    'msi': 'application/x-msi',
    'bin': 'application/octet-stream',
    'dat': 'application/octet-stream'
  }
  
  return map[ext] || 'application/octet-stream'
}
