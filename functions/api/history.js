// functions/api/history.js - GET/POST/DELETE /api/history
import { GITHUB_USER, GITHUB_REPO } from './utils/helpers.js'

async function getHistory(token) {
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })
    if (response.status === 404) {
      return new Response(JSON.stringify({ history: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const data = await response.json()
    const content = atob(data.content)
    const history = JSON.parse(content)
    return new Response(JSON.stringify({ history: history || [] }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('History error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function addHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { filename, url, folder } = body

    if (!filename) {
      return new Response(JSON.stringify({ error: 'Missing filename' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const historyUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
    let existingHistory = []
    let sha = null

    const getResponse = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (getResponse.ok) {
      const data = await getResponse.json()
      sha = data.sha
      const content = atob(data.content)
      existingHistory = JSON.parse(content) || []
    }

    const newRecord = {
      id: Date.now(),
      filename,
      url,
      folder,
      time: new Date().toISOString()
    }
    existingHistory.unshift(newRecord)
    const trimmedHistory = existingHistory.slice(0, 1000)

    const putResponse = await fetch(historyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({
        message: 'Update upload history',
        content: btoa(JSON.stringify(trimmedHistory, null, 2)),
        sha: sha,
        branch: 'main'
      })
    })

    if (!putResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to save history' }), {
        status: putResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, history: trimmedHistory }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Add history error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function deleteHistory(request, env) {
  const token = env.GITHUB_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const historyUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/upload_history.json`
    let sha = null
    let existingHistory = []

    const getResponse = await fetch(historyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cloudflare-Pages'
      }
    })

    if (!getResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
        status: getResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await getResponse.json()
    sha = data.sha
    const content = atob(data.content)
    existingHistory = JSON.parse(content) || []

    const newHistory = existingHistory.filter(record => record.id !== parseInt(id))

    const putResponse = await fetch(historyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Pages'
      },
      body: JSON.stringify({
        message: 'Delete history record',
        content: btoa(JSON.stringify(newHistory, null, 2)),
        sha: sha,
        branch: 'main'
      })
    })

    if (!putResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to delete' }), {
        status: putResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Delete history error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function onRequest(context) {
  const { request, env } = context
  const method = request.method

  if (method === 'GET') {
    return getHistory(env.GITHUB_TOKEN)
  }
  if (method === 'POST') {
    return addHistory(request, env)
  }
  if (method === 'DELETE') {
    return deleteHistory(request, env)
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  })
}