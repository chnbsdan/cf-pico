// functions/api/external.js - 外部图源管理 API
import { GITHUB_USER, GITHUB_REPO } from './utils/helpers.js'

async function getExternalJson(token) {
  if (!token) return null
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (response.status === 404) {
      return { data: { wallpaper: [], cover: [], sh: [], sd: [] }, sha: null }
    }
    if (!response.ok) return null
    const data = await response.json()
    const content = atob(data.content)
    return { data: JSON.parse(content), sha: data.sha }
  } catch (error) {
    console.error('读取外部图源失败:', error)
    return null
  }
}

async function saveExternalJson(token, data, sha) {
  if (!token) return false
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Pages'
    },
    body: JSON.stringify({
      message: 'Update external images list',
      content: btoa(JSON.stringify(data, null, 2)),
      sha: sha || undefined,
      branch: 'main'
    })
  })
  return response.ok
}

export async function onRequest(context) {
  const { request, env } = context
  const token = env.GITHUB_TOKEN
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // GET - 获取所有外部图源
  if (request.method === 'GET') {
    const result = await getExternalJson(token)
    if (!result) {
      return new Response(JSON.stringify({ error: 'Failed to fetch external images' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new Response(JSON.stringify(result.data), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // POST - 添加外部图源
  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { urls, folder } = body
      
      if (!urls || !folder) {
        return new Response(JSON.stringify({ error: 'Missing urls or folder' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const urlArray = Array.isArray(urls) ? urls : [urls]
      const validUrls = urlArray.filter(u => u && u.startsWith('http'))
      
      if (validUrls.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid URLs provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const result = await getExternalJson(token)
      if (!result) {
        return new Response(JSON.stringify({ error: 'Failed to read external.json' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const { data, sha } = result
      if (!data[folder]) {
        data[folder] = []
      }
      
      // 去重
      const existing = new Set(data[folder])
      for (const url of validUrls) {
        if (!existing.has(url)) {
          data[folder].push(url)
          existing.add(url)
        }
      }
      
      const saved = await saveExternalJson(token, data, sha)
      if (!saved) {
        return new Response(JSON.stringify({ error: 'Failed to save external.json' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        added: validUrls.length,
        folder: folder,
        total: data[folder].length
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

  // DELETE - 删除外部图源
  if (request.method === 'DELETE') {
    try {
      const body = await request.json()
      const { url, folder } = body
      
      if (!url || !folder) {
        return new Response(JSON.stringify({ error: 'Missing url or folder' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const result = await getExternalJson(token)
      if (!result) {
        return new Response(JSON.stringify({ error: 'Failed to read external.json' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const { data, sha } = result
      if (!data[folder]) {
        return new Response(JSON.stringify({ error: 'Folder not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      data[folder] = data[folder].filter(u => u !== url)
      
      const saved = await saveExternalJson(token, data, sha)
      if (!saved) {
        return new Response(JSON.stringify({ error: 'Failed to save external.json' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        deleted: true,
        folder: folder,
        total: data[folder].length
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

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  })
}
