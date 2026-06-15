// api/admin/list.js - 合并请求版本
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'Pico'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const FOLDERS = ['wallpaper', 'cover', 'sh', 'sd']

// 使用 GraphQL 一次查询所有文件夹
async function getAllFolderImages() {
  // 构建 GraphQL 查询
  const query = `
    query {
      repository(owner: "${GITHUB_USER}", name: "${GITHUB_REPO}") {
        ${FOLDERS.map(folder => `
          ${folder}: object(expression: "main:${folder}") {
            ... on Tree {
              entries {
                name
                oid
                object {
                  ... on Blob {
                    byteSize
                  }
                }
              }
            }
          }
        `).join('\n')}
      }
    }
  `

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      console.error('GraphQL error:', response.status)
      return {}
    }

    const result = await response.json()
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors)
      return {}
    }

    const data = result.data?.repository || {}
    const results = {}

    for (const folder of FOLDERS) {
      const folderData = data[folder]
      if (folderData?.entries) {
        results[folder] = folderData.entries
          .filter(entry => entry.name && entry.name.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i))
          .map(entry => ({
            name: entry.name,
            url: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${folder}/${entry.name}`,
            path: `${folder}/${entry.name}`,
            sha: entry.oid,
            size: entry.object?.byteSize || 0,
            folder: folder,
            source: 'github'
          }))
      } else {
        results[folder] = []
      }
    }

    return results
  } catch (error) {
    console.error('Failed to fetch from GraphQL:', error)
    return {}
  }
}

// 获取外部图片（保持不变）
async function getExternalImages() {
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/external.json`
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Vercel-Serverless'
      }
    })
    if (response.ok) {
      const data = await response.json()
      const result = {}
      for (const folder of FOLDERS) {
        result[folder] = (data[folder] || []).map(url => ({
          name: url.split('/').pop(),
          url: url,
          folder: folder,
          source: 'external'
        }))
      }
      return result
    }
  } catch (error) {
    console.error('Failed to fetch external images:', error)
  }
  return { wallpaper: [], cover: [], sh: [], sd: [] }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    // 一次请求获取所有文件夹的图片
    const [githubImages, externalImages] = await Promise.all([
      getAllFolderImages(),
      getExternalImages()
    ])
    
    const results = {}
    let totalCount = 0
    
    for (const folder of FOLDERS) {
      const github = githubImages[folder] || []
      const external = externalImages[folder] || []
      results[folder] = [...github, ...external]
      totalCount += results[folder].length
    }
    
    res.status(200).json({
      total: totalCount,
      folders: results
    })
  } catch (error) {
    console.error('Error in admin/list.js:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
