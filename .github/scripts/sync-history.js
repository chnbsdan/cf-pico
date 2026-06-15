// .github/scripts/sync-history.js
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const { execSync } = require('child_process')

// 配置
const HISTORY_FILE = 'upload_history.json'
const WATCH_FOLDERS = ['sh', 'sd', 'wallpaper', 'cover']
// 排除的文件（不记录）
const EXCLUDE_FILES = ['.keep', '.gitkeep', '.DS_Store', 'Thumbs.db']

// 获取图片的最后提交时间
function getFileCommitTime(filePath) {
  try {
    const cmd = `git log -1 --format=%aI -- "${filePath}"`
    const output = execSync(cmd, { encoding: 'utf-8' }).trim()
    return output || new Date().toISOString()
  } catch (error) {
    return new Date().toISOString()
  }
}

// 获取当前仓库中所有图片
function scanImages() {
  const images = []
  
  for (const folder of WATCH_FOLDERS) {
    if (!fs.existsSync(folder)) continue
    
    const files = fs.readdirSync(folder)
    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)
      const isExcluded = EXCLUDE_FILES.includes(file)
      
      if (isImage && !isExcluded) {
        const filePath = `${folder}/${file}`
        const commitTime = getFileCommitTime(filePath)
        const fullUrl = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/${filePath}`
        
        images.push({
          id: `${commitTime}-${file}`,
          filename: file,
          url: fullUrl,
          folder: folder,
          time: commitTime
        })
      }
    }
  }
  
  // 按时间倒序排列（最新的在前）
  images.sort((a, b) => new Date(b.time) - new Date(a.time))
  return images
}

// 读取现有历史记录
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return []
  }
  try {
    const content = fs.readFileSync(HISTORY_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('读取历史记录失败:', error)
    return []
  }
}

// 保存历史记录
function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8')
  console.log(`已保存 ${history.length} 条记录到 ${HISTORY_FILE}`)
}

// 合并记录（保留旧记录，添加新记录）
function mergeHistory(existingHistory, newImages) {
  const existingMap = new Map()
  
  // 用 filename + folder 作为唯一标识
  for (const record of existingHistory) {
    const key = `${record.folder}/${record.filename}`
    existingMap.set(key, record)
  }
  
  // 添加新图片（如果不存在）
  for (const image of newImages) {
    const key = `${image.folder}/${image.filename}`
    if (!existingMap.has(key)) {
      existingMap.set(key, image)
      console.log(`新增记录: ${key}`)
    }
  }
  
  // 转换回数组并按时间倒序
  const merged = Array.from(existingMap.values())
  merged.sort((a, b) => new Date(b.time) - new Date(a.time))
  
  // 只保留最近 1000 条
  return merged.slice(0, 1000)
}

// 主函数
async function main() {
  console.log('开始同步上传历史记录...')
  console.log(`监听文件夹: ${WATCH_FOLDERS.join(', ')}`)
  
  // 扫描当前所有图片
  const currentImages = scanImages()
  console.log(`扫描到 ${currentImages.length} 张图片`)
  
  // 读取现有历史记录
  const existingHistory = loadHistory()
  console.log(`现有记录: ${existingHistory.length} 条`)
  
  // 合并记录
  const newHistory = mergeHistory(existingHistory, currentImages)
  console.log(`合并后记录: ${newHistory.length} 条`)
  
  // 检查是否有变化
  if (newHistory.length !== existingHistory.length) {
    saveHistory(newHistory)
    console.log('历史记录已更新')
    
    // 提交更改
    execSync(`git config user.name "github-actions[bot]"`)
    execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`)
    execSync(`git add ${HISTORY_FILE}`)
    execSync(`git commit -m "chore: 自动同步上传历史记录 [skip ci]" || echo "没有变化"`)
    execSync(`git push`, { stdio: 'inherit' })
  } else {
    console.log('没有新图片，历史记录无需更新')
  }
}

main().catch(console.error)
