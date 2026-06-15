
## 📄 创建 `FOLDER_CONFIG.md`


# 文件夹配置指南

## 当前文件夹结构

| 文件夹 | 用途 | 前端显示名称 |
| :--- | :--- | :--- |
| `wallpaper` | 横屏图片（旧） | 横屏图片 (wallpaper) |
| `cover` | 竖屏图片（旧） | 竖屏图片 (cover) |
| `sh` | 横屏图片（新） | 横屏图片 (sh) |
| `sd` | 竖屏图片（新） | 竖屏图片 (sd) |

## 需要修改的文件清单

### 1. 后端 API 文件

| 文件 | 修改位置 | 说明 |
| :--- | :--- | :--- |
| `api/upload.js` | `const FOLDERS = [...]` | 允许上传到这些文件夹 |
| `api/admin/list.js` | `const FOLDERS = [...]` | 管理后台读取这些文件夹 |
| `api/image.js` | `const ALLOWED_FOLDERS = [...]` | 允许代理访问这些文件夹 |
| `api/wallpaper.js` | `const FOLDER = '...'` | 横屏接口读取的文件夹 |
| `api/cover.js` | `const FOLDER = '...'` | 竖屏接口读取的文件夹 |

### 2. 前端文件

| 文件 | 修改位置 | 说明 |
| :--- | :--- | :--- |
| `src/components/UploadArea.jsx` | `folderOptions` 数组 | 上传界面的文件夹选项 |
| `src/pages/Manage.jsx` | 动态渲染，无需修改 | 自动显示所有文件夹 |

## 如何添加新文件夹

假设要添加 `new_folder`：

### 步骤 1：修改后端 API

**`api/upload.js`**（约第 10 行）
```javascript
const FOLDERS = ['wallpaper', 'cover', 'sh', 'sd', 'new_folder']
```

**`api/admin/list.js`**（约第 8 行）
```javascript
const FOLDERS = ['wallpaper', 'cover', 'sh', 'sd', 'new_folder']
```

**`api/image.js`**（约第 6 行）
```javascript
const ALLOWED_FOLDERS = ['wallpaper', 'cover', 'sh', 'sd', 'new_folder']
```

### 步骤 2：修改前端上传界面

**`src/components/UploadArea.jsx`**（约第 10 行）
```javascript
const folderOptions = [
  { key: 'wallpaper', label: '横屏图片 (wallpaper)', icon: 'fa-arrows-alt', color: 'blue' },
  { key: 'cover', label: '竖屏图片 (cover)', icon: 'fa-mobile-alt', color: 'purple' },
  { key: 'sh', label: '横屏图片 (sh)', icon: 'fa-arrows-alt', color: 'blue' },
  { key: 'sd', label: '竖屏图片 (sd)', icon: 'fa-mobile-alt', color: 'purple' },
  { key: 'new_folder', label: '新文件夹', icon: 'fa-folder', color: 'green' }
]
```

### 步骤 3：在 GitHub 仓库创建文件夹

在 `https://github.com/chnbsdan/Pico` 仓库中创建同名文件夹 `new_folder`。

## 注意事项

1. **硬编码方式**：目前使用硬编码，不依赖环境变量
2. **GitHub 同步**：添加新文件夹后，需要在 GitHub 仓库中手动创建同名文件夹
3. **重新部署**：修改代码后需要 `git push` 触发 Vercel 重新部署
4. **前端显示**：`Manage.jsx` 会自动显示所有后端返回的文件夹，无需手动修改

## 快速修改示例

| 原文件夹 | 新文件夹 | 需要修改的文件 |
| :--- | :--- | :--- |
| `wallpaper` | `my_landscape` | upload.js, admin/list.js, image.js, UploadArea.jsx |
| `cover` | `my_portrait` | upload.js, admin/list.js, image.js, UploadArea.jsx |
| `sh` | `new_sh` | upload.js, admin/list.js, image.js, wallpaper.js, UploadArea.jsx |
| `sd` | `new_sd` | upload.js, admin/list.js, image.js, cover.js, UploadArea.jsx |
```

