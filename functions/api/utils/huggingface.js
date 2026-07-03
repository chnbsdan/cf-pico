// functions/api/utils/huggingface.js
// ✅ Dataset 专用版本 - 适用于 https://huggingface.co/datasets/kekelove1688/imgbed

function getHFConfig(env) {
  const token = env.HF_TOKEN
  const repo = env.HF_REPO // 格式: "username/dataset-name"
  
  if (!token || !repo) {
    throw new Error('HuggingFace 配置缺失: 请设置 HF_TOKEN 和 HF_REPO')
  }
  
  return { token, repo }
}

/**
 * 上传文件到 HuggingFace Dataset
 * 使用 HuggingFace Hub API
 */
export async function uploadToHuggingFace(file, path, env) {
  try {
    const { token, repo } = getHFConfig(env)
    const fileBuffer = await file.arrayBuffer()
    
    // ✅ Dataset API: POST /api/datasets/{repo}/upload/{path}
    const uploadUrl = `https://huggingface.co/api/datasets/${repo}/upload/${path}`
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`上传失败 (${response.status}): ${errorText}`)
    }
    
    const data = await response.json()
    // ✅ Dataset 的 raw 文件访问链接
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
 */
export async function deleteFromHuggingFace(path, env) {
  try {
    const { token, repo } = getHFConfig(env)
    
    // ✅ Dataset API: DELETE /api/datasets/{repo}/delete/{path}
    const deleteUrl = `https://huggingface.co/api/datasets/${repo}/delete/${path}`
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`删除失败 (${response.status}): ${errorText}`)
    }
    
    return {
      success: true,
      message: '文件已删除',
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
    
    // ✅ Dataset API: GET /api/datasets/{repo}
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
