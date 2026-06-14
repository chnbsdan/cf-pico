# PCBed v2.0 - 现代化个人图床

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://vercel.com)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com)

> 基于 Vercel + GitHub 私有仓库的现代化个人图床服务，支持横屏/竖屏分类上传、批量上传、自动压缩、随机图片 API、图片管理后台、上传历史记录等功能。

**[在线演示](https://pcbed.vercel.app)** | **[GitHub 仓库](https://github.com/chnbsdan/pcbed)**

---

## ✨ 功能特点

### 核心功能
- 🖼️ **随机图片 API** - `/api/random` 接口，每次返回随机图片（支持 `?format=json` 参数）
- 📂 **分类管理** - 支持横屏（wallpaper）和竖屏（cover）两种分类
- 📤 **批量上传** - 多文件选择、拖拽上传、粘贴上传（Ctrl+V），自动压缩大图
- 🔒 **私有仓库** - 图片存储在 GitHub 私有仓库中，安全可控
- 🌐 **代理访问** - 通过 `/api/image?path=` 统一代理访问图片

### 管理后台功能
- 🔐 **密码保护** - 管理页面需要密码登录，安全可控
- 🖼️ **图片预览** - 网格视图展示所有图片，支持点击放大预览
- 📋 **一键复制** - 点击复制图片链接（自动补全域名）
- 🗑️ **删除图片** - 网页上直接删除，同步到 GitHub 仓库
- 📊 **分页浏览** - 每页 64 张图片，支持翻页
- 📁 **目录树** - 左侧显示横屏/竖屏分类及图片数量
- 📜 **上传历史** - 记录所有上传图片，支持重新复制链接
- 🔍 **图片搜索** - 按文件名快速搜索图片
- 📦 **批量操作** - 批量复制链接（URL/Markdown/HTML）、批量删除图片
- 📱 **移动端适配** - 电脑端左侧固定目录，手机端汉堡菜单

### 图片格式转换
- 🔄 **WebP 转换** - 上传时可选择自动转换为 WebP 格式
- 📷 **原格式保留** - 不转换时保持原格式上传
- ⚡ **自动压缩** - 超过 3MB 的图片自动压缩（压缩质量可选 70%/85%/100%）

### 界面特性
- 🎲 **随机背景** - 每次刷新页面背景随机变化（仅横屏图片）
- 🌫️ **毛玻璃效果** - 现代化毛玻璃界面设计
- 🌙 **暗色/亮色主题** - 支持一键切换明暗主题
- 🖱️ **一键复制** - 点击复制图片链接，带成功提示
- 👁️ **图片预览** - 上传后可直接预览，管理页面点击放大
- 🔄 **换背景按钮** - 点击换背景，只从横屏图片中随机获取
- 🎨 **响应式布局** - 完美适配 PC、平板、手机

---

## 📁 项目结构

```
pcbed/
├── api/                        # Vercel Serverless Functions
│   ├── admin/
│   │   ├── list.js            # 图片列表 API
│   │   └── delete.js          # 图片删除 API
│   ├── history.js             # 上传历史记录 API
│   ├── image.js               # 统一图片代理 API
│   ├── random.js              # 随机图片接口（支持 JSON 格式）
│   ├── wallpaper.js           # 横屏图片接口
│   ├── cover.js               # 竖屏图片接口
│   ├── list.js                # 图片列表接口
│   ├── stats.js               # 统计信息接口
│   └── upload.js              # 图片上传接口
├── src/
│   ├── components/            # UI 组件
│   │   ├── Header.jsx
│   │   ├── StatsCard.jsx
│   │   ├── ApiSection.jsx
│   │   ├── UploadArea.jsx
│   │   ├── UploadResult.jsx
│   │   ├── Footer.jsx
│   │   └── ThemeToggle.jsx    # 主题切换组件
│   ├── pages/
│   │   ├── Manage.jsx         # 图片管理页面（含移动端适配、历史记录）
│   │   └── ApiDocs.jsx        # API 文档页面
│   ├── lib/
│   │   └── api.js             # API 调用封装
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── vercel.json
└── README.md
```

---

## 📡 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/random` | GET | 随机返回一张图片（支持 `?format=json` 返回 JSON） |
| `/api/wallpaper` | GET | 随机返回横屏图片 |
| `/api/cover` | GET | 随机返回竖屏图片 |
| `/api/list` | GET | 返回所有图片列表（按分类分组） |
| `/api/stats` | GET | 返回统计信息（各分类图片数量） |
| `/api/upload` | POST | 上传图片（multipart/form-data） |
| `/api/image` | GET | 代理访问图片（参数：path=分类/文件名） |
| `/api/history` | GET/POST/DELETE | 上传历史记录管理 |
| `/api/admin/list` | GET | 管理后台图片列表（需要密码） |
| `/api/admin/delete` | POST | 删除图片（需要密码） |

### 使用示例

```bash
# 随机获取图片
curl https://pcbed.vercel.app/api/random

# 随机获取图片（JSON 格式）
curl https://pcbed.vercel.app/api/random?format=json

# 随机获取横屏图片
curl https://pcbed.vercel.app/api/wallpaper

# 随机获取竖屏图片
curl https://pcbed.vercel.app/api/cover

# 获取统计信息
curl https://pcbed.vercel.app/api/stats

# 上传图片
curl -X POST -F "file=@image.jpg" -F "folder=wallpaper" https://pcbed.vercel.app/api/upload

# 代理访问图片
https://pcbed.vercel.app/api/image?path=wallpaper/20260612_image.jpg
```

### JSON 返回示例

```json
{
  "code": "200",
  "imgurl": "https://pcbed.vercel.app/api/random?format=json",
  "source": "https://raw.githubusercontent.com/chnbsdan/pcbed/main/wallpaper/20260612_image.jpg",
  "total": 128
}
```

### 统计返回示例

```json
{
  "github_folders": {
    "wallpaper": 33,
    "cover": 8
  },
  "github_total": 41,
  "external_folders": {
    "wallpaper": 10,
    "cover": 5
  },
  "external_total": 15,
  "grand_total": 56
}
```

---

## 🔧 环境变量配置

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token（需 `repo` 权限） | ✅ 是 |
| `GITHUB_USER` | GitHub 用户名 | 可选（默认 chnbsdan） |
| `GITHUB_REPO` | 存储图片的仓库名 | 可选（默认 pcbed） |

### 获取 GitHub Token

1. 访问 GitHub → Settings → Developer settings → Personal access tokens
2. 点击 **Generate new token (classic)**
3. 勾选 `repo` 权限（完整控制私有仓库）
4. 生成并复制 Token（以 `ghp_` 开头）

---

## 📦 部署步骤

### 1. 创建 GitHub 图片存储仓库

创建一个新的私有仓库用于存储图片，例如 `pcbed`：

```
pcbed/
├── wallpaper/   # 横屏图片存放目录
├── cover/       # 竖屏图片存放目录
└── upload_history.json  # 上传历史记录（自动生成）
```

### 2. Fork 或克隆本项目

```bash
git clone https://github.com/chnbsdan/pcbed.git
cd pcbed
```

### 3. 安装依赖

```bash
npm install
```

### 4. 本地开发测试

```bash
npm run dev
```

### 5. 部署到 Vercel

**方法一：使用 Vercel CLI**

```bash
npm install -g vercel
vercel --prod
```

**方法二：通过 Vercel 网页**

1. 访问 [Vercel](https://vercel.com)
2. 点击 **Add New** → **Project**
3. 导入你的 GitHub 仓库 `chnbsdan/pcbed`
4. 在 **Environment Variables** 中添加 `GITHUB_TOKEN`
5. 点击 **Deploy**

### 6. 绑定自定义域名（可选）

1. 在 Vercel 项目设置中进入 **Domains**
2. 添加你的域名（如 `pcbed.xxx.com`）
3. 在你的 DNS 服务商添加 CNAME 记录：
   - 类型：`CNAME`
   - 名称：你的子域名
   - 目标：`cname.vercel-dns.com`

---

## 🔐 管理后台

访问 `/manage` 进入管理后台，需要输入密码。

**默认密码**：`your-password`（请在 `src/pages/Manage.jsx` 中修改）

### 管理后台功能

| 功能 | 说明 |
|------|------|
| 图片预览 | 网格视图展示，支持点击放大预览 |
| 复制链接 | 一键复制完整域名链接 |
| 删除图片 | 确认后删除，同步到 GitHub |
| 分类筛选 | 横屏/竖屏分类切换 |
| 分页浏览 | 每页 64 张，支持翻页 |
| 图片搜索 | 按文件名实时搜索 |
| 批量复制 | 支持复制 URL/Markdown/HTML 格式 |
| 批量删除 | 勾选多张图片一键删除 |
| 上传历史 | 查看所有上传记录，支持重新复制 |
| 移动端适配 | 汉堡菜单，响应式布局 |

---

## 🎨 界面效果

### 主要界面特性
- 🌫️ **毛玻璃外框** - 所有卡片统一毛玻璃效果
- 📊 **统计卡片** - 紧凑横排设计，节省空间
- 🔘 **换背景按钮** - 绿色背景，悬停变亮，只从横屏获取
- 📤 **上传区域** - 高度增加，悬停变天蓝色
- 🖱️ **一键复制** - 点击复制图片链接
- 👁️ **图片预览** - 上传后直接预览，管理页面点击放大
- 🌙 **暗色/亮色主题** - 一键切换，支持系统跟随
- 📱 **移动端适配** - 完美适配 PC、平板、手机

### 按钮颜色
| 按钮 | 默认颜色 | 悬停效果 |
|------|----------|----------|
| 换背景 | 绿色 (`bg-green-500`) | 变亮 (`hover:bg-green-400`) |
| 横屏 | 蓝色 (`bg-blue-600`) | 变亮 (`hover:bg-gray-300`) |
| 竖屏 | 紫色 (`bg-purple-600`) | 变亮 (`hover:bg-gray-300`) |
| 上传区域 | 浅灰 (`bg-gray-50`) | 天蓝色 (`hover:bg-sky-100`) |

---

## 📝 图片命名规则

上传后的图片会按以下格式命名：

```
日期_原文件名.扩展名
```

示例：`20260612_风景照片.jpg`

- 日期格式：`YYYYMMDD`
- 原文件名中的特殊字符会被替换为 `_`
- PNG 大图会自动转换为 JPG 格式
- 支持格式：JPG、JPEG、PNG、WebP、GIF、AVIF

---

## ⚠️ 注意事项

1. **私有仓库** - 图片存储在私有仓库中，需要通过代理接口访问
2. **Token 安全** - 不要将 `GITHUB_TOKEN` 暴露在客户端代码中
3. **文件大小** - 单张图片限制 10MB，超过 3MB 会自动压缩
4. **支持格式** - JPG、JPEG、PNG、WebP、GIF、AVIF
5. **API 限制** - GitHub API 限制 5000 次/小时（已认证）

---

## 📊 技术栈

| 技术 | 说明 |
|------|------|
| **前端** | React 18 + Vite + Tailwind CSS |
| **图标** | Font Awesome 6 |
| **后端** | Vercel Serverless Functions |
| **存储** | GitHub 私有仓库 |
| **API** | GitHub REST API |
| **部署** | Vercel |

---

## 🔄 更新日志

### v2.1 (2026-06-14)
- ✨ 新增上传历史记录功能（跨设备同步）
- ✨ 新增暗色/亮色主题切换
- ✨ 新增图片搜索功能
- ✨ 新增批量复制链接（URL/Markdown/HTML）
- ✨ 新增批量删除图片
- ✨ 新增粘贴上传（Ctrl+V）
- ✨ 新增压缩质量选择（70%/85%/100%）
- 🔧 合并 JSON 接口到 `/api/random?format=json`
- 🎨 优化管理后台布局（左侧目录树）
- 🎨 优化移动端体验（汉堡菜单）
- 🎨 优化按钮样式和交互反馈

### v2.0 (2026-06-12)
- ✨ 新增图片管理后台（预览、复制、删除）
- 📱 移动端适配，汉堡菜单导航
- 🖼️ 响应式网格，每页 64 张
- 🔄 统一图片代理 API `/api/image`
- 🎨 优化界面：左侧目录树、毛玻璃效果
- 🔐 管理页面密码保护
- 📋 复制链接自动补全域名
- 🔄 上传时可选 WebP 转换

### v1.0 (2026-06-10)
- 🎉 初始版本发布
- 📤 支持横屏/竖屏分类上传
- 🔗 随机图片 API
- 📊 统计信息 API
- 🌐 图片代理访问

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/chnbsdan/pcbed)
- [在线演示](https://pcbed.vercel.app)
- [API 文档](https://pcbed.vercel.app/docs)
- [Vercel 部署](https://vercel.com)
- [GitHub Token 申请](https://github.com/settings/tokens)

---

## 👤 作者

- GitHub: [chnbsdan](https://github.com/chnbsdan)
- 博客: [Aoso Blog](https://aoso.hangdn.com)

---

## Star History

<a href="https://www.star-history.com/?repos=chnbsdan/pcbed&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=chnbsdan/pcbed&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=chnbsdan/pcbed&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=chnbsdan/pcbed&type=date&legend=top-left" />
 </picture>
</a>


---
