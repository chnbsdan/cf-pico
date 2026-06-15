const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HISTORY_FILE = 'upload_history.json';
const WATCH_FOLDERS = ['sh', 'sd', 'wallpaper', 'cover'];
const EXCLUDE_FILES = ['.keep', '.gitkeep', '.DS_Store', 'Thumbs.db'];

function getFileCommitTime(filePath) {
    try {
        const cmd = `git log -1 --format=%aI -- "${filePath}"`;
        const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        return output || new Date().toISOString();
    } catch (error) {
        console.warn(`  ⚠️ 无法获取文件 ${filePath} 的提交时间，使用当前时间。`);
        return new Date().toISOString();
    }
}

function scanImages() {
    console.log('  🔍 开始扫描图片文件夹...');
    const images = [];
    for (const folder of WATCH_FOLDERS) {
        const folderPath = path.join(process.cwd(), folder);
        if (!fs.existsSync(folderPath)) {
            console.log(`  📁 文件夹 ${folder} 不存在，跳过。`);
            continue;
        }

        console.log(`  📁 正在扫描文件夹: ${folder}`);
        const files = fs.readdirSync(folderPath);
        let fileCount = 0;
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext);
            const isExcluded = EXCLUDE_FILES.includes(file);

            if (isImage && !isExcluded) {
                fileCount++;
                const filePath = `${folder}/${file}`;
                const commitTime = getFileCommitTime(filePath);
                const fullUrl = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/${filePath}`;
                images.push({
                    id: `${new Date(commitTime).getTime()}-${file}`,
                    filename: file,
                    url: fullUrl,
                    folder: folder,
                    time: commitTime
                });
            }
        }
        console.log(`    ✅ 在 ${folder} 文件夹中发现 ${fileCount} 张图片。`);
    }
    images.sort((a, b) => new Date(b.time) - new Date(a.time));
    console.log(`  🖼️  总计扫描到 ${images.length} 张图片。`);
    return images;
}

function loadHistory() {
    const historyPath = path.join(process.cwd(), HISTORY_FILE);
    if (!fs.existsSync(historyPath)) {
        console.log(`  📄 文件 ${HISTORY_FILE} 不存在，将创建新文件。`);
        return [];
    }
    try {
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        console.log(`  📜 成功加载历史记录，共 ${history.length} 条。`);
        return history;
    } catch (error) {
        console.error(`  ❌ 读取历史记录文件失败: ${error.message}`);
        return [];
    }
}

function saveHistory(history) {
    const historyPath = path.join(process.cwd(), HISTORY_FILE);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`  ✅ 已保存 ${history.length} 条记录到 ${HISTORY_FILE}`);
}

function mergeHistory(existingHistory, newImages) {
    console.log('  🔄 开始合并新旧记录...');
    const historyMap = new Map();
    for (const record of existingHistory) {
        const key = `${record.folder}/${record.filename}`;
        historyMap.set(key, record);
    }

    let newCount = 0;
    for (const image of newImages) {
        const key = `${image.folder}/${image.filename}`;
        if (!historyMap.has(key)) {
            historyMap.set(key, image);
            console.log(`    ✨ 新增记录: ${key} (上传时间: ${image.time})`);
            newCount++;
        }
    }

    if (newCount === 0) {
        console.log('  📭 未发现新图片，历史记录无需更新。');
        return null;
    }

    console.log(`  📝 共发现 ${newCount} 张新图片。`);
    const mergedHistory = Array.from(historyMap.values());
    mergedHistory.sort((a, b) => new Date(b.time) - new Date(a.time));
    return mergedHistory.slice(0, 2000);
}

function commitAndPush() {
    try {
        console.log('  📤 准备将更新提交并推送到仓库...');
        execSync(`git config user.name "github-actions[bot]"`, { stdio: 'ignore' });
        execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: 'ignore' });
        execSync(`git add ${HISTORY_FILE}`, { stdio: 'ignore' });
        execSync(`git commit -m "chore: 自动同步上传历史记录 [skip ci]"`, { stdio: 'ignore' });
        execSync(`git push`, { stdio: 'ignore' });
        console.log('  ✅ 更改已成功推送到远程仓库！');
    } catch (error) {
        console.log('  ℹ️ 没有新文件需要提交，或推送时出现问题。');
    }
}

async function main() {
    console.log('🚀 开始同步上传历史记录任务...');
    try {
        const currentImages = scanImages();
        const existingHistory = loadHistory();
        const newHistory = mergeHistory(existingHistory, currentImages);
        if (newHistory !== null) {
            saveHistory(newHistory);
            commitAndPush();
        }
        console.log('🎉 同步任务结束！');
    } catch (error) {
        console.error('💥 脚本运行过程中发生未捕获的错误:', error);
        process.exit(1);
    }
}

main();
