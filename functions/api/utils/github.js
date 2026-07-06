// functions/api/utils/github.js - GitHub 操作

import { GITHUB_USER, GITHUB_REPO, TELEGRAM_IMAGES_FILE } from './helpers.js'

export async function getTelegramImages(token) {
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

export async function saveTelegramImages(token, images, sha = null) {
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

export async function getFolderImages(folder, token) {
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

// ============================================================
// 新增：GitHub Releases 大文件存储（支持 2GB）
// ============================================================

// 创建 Release
async function createRelease(token, repo, tag) {
  const apiBase = 'https://api.github.com'
  const [owner, repoName] = repo.split('/')
  
  const createRes = await fetch(`${apiBase}/repos/${owner}/${repoName}/releases`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'cf-pico'
    },
    body: JSON.stringify({
      tag_name: tag,
      name: `CF-Pico Storage ${tag}`,
      body: 'Auto-generated release for file storage',
      draft: false,
      prerelease: false
    })
  })
  
  if (!createRes.ok) {
    const error = await createRes.text()
    throw new Error(`创建 Release 失败: ${createRes.status} - ${error}`)
  }
  
  return await createRes.json()
}

// 获取或创建 Release
async function getOrCreateRelease(token, repo, tag) {
  const apiBase = 'https://api.github.com'
  const [owner, repoName] = repo.split('/')
  
  // 1. 获取已存在的 Release
  const listRes = await fetch(`${apiBase}/repos/${owner}/${repoName}/releases`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'cf-pico'
    }
  })
  
  // ✅ 404 表示没有 Release，直接创建
  if (listRes.status === 404) {
    return await createRelease(token, repo, tag)
  }
  
  if (!listRes.ok) {
    throw new Error(`获取 Release 列表失败: ${listRes.status}`)
  }
  
  const releases = await listRes.json()
  let release = releases.find(r => r.tag_name === tag)
  
  // 2. 如果不存在，创建新的 Release
  if (!release) {
    release = await createRelease(token, repo, tag)
  }
  
  return release
}

// 上传文件到 GitHub Releases
export async function uploadToGitHubRelease(file, filename, folder, env) {
  const token = env.GITHUB_TOKEN
  const repo = env.GITHUB_REPO || `${env.GITHUB_USER}/cf-pico`
  const tag = env.GITHUB_RELEASE_TAG || 'cf-pico-storage'
  
  if (!token) {
    throw new Error('GITHUB_TOKEN 未配置')
  }
  
  try {
    // 1. 获取或创建 Release
    const release = await getOrCreateRelease(token, repo, tag)
    
    // 2. 获取上传 URL
    const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(filename)}`)
    
    // 3. 上传文件到 Release 附件
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'cf-pico'
      },
      body: file
    })
    
    if (!uploadRes.ok) {
      const error = await uploadRes.text()
      throw new Error(`上传到 Release 失败: ${uploadRes.status} - ${error}`)
    }
    
    const data = await uploadRes.json()
    
    return {
      success: true,
      url: data.browser_download_url,
      storage: 'github-release',
      filename: filename,
      id: data.id
    }
    
  } catch (error) {
    console.error('GitHub Release 上传失败:', error)
    throw error
  }
}

// 从 GitHub Releases 删除文件
export async function deleteFromGitHubRelease(filename, env) {
  const token = env.GITHUB_TOKEN
  const repo = env.GITHUB_REPO || `${env.GITHUB_USER}/cf-pico`
  const tag = env.GITHUB_RELEASE_TAG || 'cf-pico-storage'
  
  if (!token) {
    throw new Error('GITHUB_TOKEN 未配置')
  }
  
  try {
    const release = await getOrCreateRelease(token, repo, tag)
    
    const assetsRes = await fetch(release.assets_url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cf-pico'
      }
    })
    
    if (!assetsRes.ok) {
      throw new Error(`获取附件列表失败: ${assetsRes.status}`)
    }
    
    const assets = await assetsRes.json()
    const target = assets.find(a => a.name === filename)
    
    if (!target) {
      return { success: true, message: '文件不存在，无需删除' }
    }
    
    const deleteRes = await fetch(target.url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cf-pico'
      }
    })
    
    if (!deleteRes.ok) {
      throw new Error(`删除附件失败: ${deleteRes.status}`)
    }
    
    return { success: true, message: '文件已删除' }
    
  } catch (error) {
    console.error('GitHub Release 删除失败:', error)
    throw error
  }
}
