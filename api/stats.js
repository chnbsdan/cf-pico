// api/stats.js
const GITHUB_USER = process.env.GITHUB_USER || 'chnbsdan'
const GITHUB_REPO = process.env.GITHUB_REPO || 'imgbed'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  const folders = ['wallpaper', 'cover']
  const stats = { github_folders: {}, github_total: 0, external_total: 0, grand_total: 0 }
  
  try {
    for (const folder of folders) {
      const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folder}`
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
      })
      if (response.ok) {
        const files = await response.json()
        const count = files.filter(f => f.name && f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)).length
        stats.github_folders[folder] = count
        stats.github_total += count
      }
    }
    stats.grand_total = stats.github_total + stats.external_total
    res.status(200).json(stats)
  } catch (error) {
    res.status(500).json({ error: 'Internal error' })
  }
}
