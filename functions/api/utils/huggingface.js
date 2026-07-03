// functions/api/utils/huggingface.js
// ✅ 使用 HuggingFace Commit API（最新官方推荐方式）

function getHFConfig(env) {
  const token = env.HF_TOKEN
  const repo = env.HF_REPO // 格式: "username/dataset-name"
  
  if (!token || !repo) {
    throw new Error('HuggingFace 配置缺失: 请设置 HF_TOKEN 和 HF_REPO')
  }
  
  return { token, repo }
}

/**
 * 将文件转换为 Base64
 */
function fileToBase64(fileBuffer) {
  const uint8Array = new Uint8Array(fileBuffer)
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

/**
 * 上传文件到 HuggingFace Dataset
 * 使用 Commit API
 */
export async function uploadToHuggingFace(file, path, env) {
  try {
    const { token, repo } = getHFConfig(env)
    const fileBuffer = await file.arrayBuffer()
    const base64Content = fileToBase64(fileBuffer)
    
    // ✅ Commit API: POST /api/datasets/{repo}/commit
    const commitUrl = `https://huggingface.co/api/datasets/${repo}/commit`
    
    const commitBody = {
      description: `Upload ${path}`,
      summary: `Upload ${path}`,
      operations: [
        {
          operation: 'add_or_update',
          path: path,
          content: base64Content,
          encoding: 'base64'
        }
      ]
    }
    
    const response = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`上传失败 (${response.status}): ${errorText}`)
    }
    
    const data = await response.json()
    const fileUrl = `https://huggingface.co/datasets/${repo}/raw/main/${path}`
    
    return {
      success: true,
      url: fileUrl,
      data: data,
      source: 'huggingface',
      path: path,
    }
  } catch (error) {
    console.error('HuggingFace 上传错误:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 从 HuggingFace Dataset 删除文件
 * 使用 Commit API
 */
export async function deleteFromHuggingFace(path, env) {
  try {
    const { token, repo } = getHFConfig(env)
    
    // ✅ Commit API: POST /api/datasets/{repo}/commit
    const commitUrl = `https://huggingface.co/api/datasets/${repo}/commit`
    
    const commitBody = {
      description: `Delete ${path}`,
      summary: `Delete ${path}`,
      operations: [
        {
          operation: 'delete',
          path: path,
        }
      ]
    }
    
    const response = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitBody),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`删除失败 (${response.status}): ${errorText}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      message: '文件已删除',
      data: data,
    }
  } catch (error) {
    console.error('HuggingFace 删除错误:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 获取 HuggingFace Dataset 的文件列表
 */
export async function listFilesFromHuggingFace(env, folder = '') {
  try {
    const { token, repo } = getHFConfig(env)
    
    // GET /api/datasets/{repo}
    const listUrl = `https://huggingface.co/api/datasets/${repo}`
    
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      throw new Error(`获取文件列表失败 (${response.status})`)
    }
    
    const data = await response.json()
    
    // Dataset 的文件列表在 siblings 字段中
    let files = data.siblings || []
    
    // 过滤掉目录和常见配置文件
    files = files.filter(file => {
      const name = file.rfilename || ''
      if (name.endsWith('/')) return false
      if (['.gitattributes', 'README.md', '.gitignore'].includes(name)) return false
      return true
    })
    
    if (folder) {
      files = files.filter(file => (file.rfilename || '').startsWith(folder + '/'))
    }
    
    const formattedFiles = files.map(file => ({
      name: (file.rfilename || '').split('/').pop(),
      path: file.rfilename || '',
      size: file.size || 0,
      lastModified: file.lastModified || new Date().toISOString(),
      url: `https://huggingface.co/datasets/${repo}/raw/main/${file.rfilename}`,
      source: 'huggingface',
      folder: (file.rfilename || '').split('/')[0] || '',
    }))
    
    return {
      success: true,
      files: formattedFiles,
      total: formattedFiles.length,
    }
  } catch (error) {
    console.error('HuggingFace 文件列表错误:', error)
    return {
      success: false,
      error: error.message,
      files: [],
    }
  }
}
