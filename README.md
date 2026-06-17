# CF-Pico - 现代化个人图床

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-F38020)](https://pages.cloudflare.com)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com)

> 基于 Cloudflare Pages + GitHub 私有仓库的现代化个人图床服务，支持横屏/竖屏分类上传、批量上传、自动压缩、随机图片 API、图片管理后台、上传历史记录等功能。同时支持 Cloudflare R2 作为备用存储。

**[在线演示](https://cf-pico.pages.dev)** | **[GitHub 仓库](https://github.com/chnbsdan/cf-pico)**

---

## ✨ 功能特点

### 核心功能
- 🖼️ **随机图片 API** - `/api/random` 接口，每次返回随机图片
- 📂 **分类管理** - 支持横屏（wallpaper）和竖屏（cover）两种分类，文件夹名可自定义
- 📤 **批量上传** - 多文件选择、拖拽上传、粘贴上传（Ctrl+V），自动压缩大图
- 🔒 **私有仓库** - 图片存储在 GitHub 私有仓库中，安全可控
- ☁️ **R2 存储支持** - 可选 Cloudflare R2 作为备用存储，CDN 加速
- 🌐 **代理访问** - 通过 `/api/image?path=` 统一代理访问图片
- 🚀 **大文件直传** - 突破 4.5MB 限制，最大支持 25MB

### 管理后台功能
- 🔐 **密码保护** - 管理页面需要密码登录，安全可控
- 🖼️ **图片预览** - 网格视图展示所有图片，支持点击放大预览
- 📋 **一键复制** - 点击复制图片链接（自动补全域名）
- 🗑️ **删除图片** - 网页上直接删除，同步到 GitHub 或 R2
- 📊 **分页浏览** - 每页 64 张图片，支持翻页
- 📁 **目录树** - 左侧显示横屏/竖屏分类及图片数量
- 📜 **上传历史** - 记录所有上传图片，支持重新复制链接
- 🔍 **图片搜索** - 按文件名快速搜索图片
- 📦 **批量操作** - 批量复制链接（URL/Markdown/HTML）、批量删除图片
- 📱 **移动端适配** - 电脑端左侧固定目录，手机端汉堡菜单

### 图片格式转换
- 🔄 **WebP 转换** - 上传时可选择自动转换为 WebP 格式
- 📷 **原格式保留** - 不转换时保持原格式上传
- ⚡ **自动压缩** - 超过 5MB 的图片自动压缩（压缩质量可选 70%/85%/100%）

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
cf-pico/
├── functions/                    # Cloudflare Pages Functions（核心 API）
│   └── api/
│       └── [[path]].js          # 统一 API 入口（所有 /api/* 请求）
├── src/                          # React 前端源码
│   ├── components/               # UI 组件
│   │   ├── Header.jsx
│   │   ├── StatsCard.jsx
│   │   ├── ApiSection.jsx
│   │   ├── UploadArea.jsx
│   │   ├── UploadResult.jsx
│   │   ├── Footer.jsx
│   │   └── ThemeToggle.jsx
│   ├── pages/
│   │   ├── Manage.jsx            # 图片管理页面（含移动端适配、历史记录）
│   │   └── ApiDocs.jsx           # API 文档页面
│   ├── lib/
│   │   └── api.js                # API 调用封装
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── _redirects                # SPA 路由支持
│   └── favicon.ico
├── upload_history.json            # 上传图片后系统自动生成
├── package.json
├── vercel.json                    # Vercel 配置（保留兼容）
└── README.md
```

---

## 📡 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/random` | GET | 随机返回一张图片（全部分类） |
| `/api/wallpaper` | GET | 随机返回横屏图片 |
| `/api/cover` | GET | 随机返回竖屏图片 |
| `/api/stats` | GET | 返回统计信息（各分类图片数量） |
| `/api/list` | GET | 返回所有图片列表（按分类分组） |
| `/api/upload` | POST | 上传图片（multipart/form-data） |
| `/api/image` | GET | 代理访问图片（参数：path=分类/文件名） |
| `/api/history` | GET/POST/DELETE | 上传历史记录管理 |
| `/api/admin/delete` | POST | 删除图片（需要密码） |

### 使用示例

```bash
# 随机获取图片
curl https://cf-pico.pages.dev/api/random

# 随机获取横屏图片
curl https://cf-pico.pages.dev/api/wallpaper

# 随机获取竖屏图片
curl https://cf-pico.pages.dev/api/cover

# 获取统计信息
curl https://cf-pico.pages.dev/api/stats

# 上传图片
curl -X POST -F "file=@image.jpg" -F "folder=wallpaper" https://cf-pico.pages.dev/api/upload

# 代理访问图片
https://cf-pico.pages.dev/api/image?path=wallpaper/20260617_image.jpg
```

### JSON 返回示例

**统计信息：**
```json
{
  "github_folders": {
    "wallpaper": 33,
    "cover": 8,
    "sh": 10,
    "sd": 5
  },
  "github_total": 56,
  "external_total": 0,
  "grand_total": 56
}
```

**图片列表：**
```json
{
  "total": 56,
  "folders": {
    "wallpaper": [
      {
        "name": "20260617_image.jpg",
        "url": "https://cf-pico.pages.dev/api/image?path=wallpaper/20260617_image.jpg",
        "path": "wallpaper/20260617_image.jpg",
        "size": 3654227,
        "folder": "wallpaper",
        "source": "github"
      }
    ]
  }
}
```

---

## 🔧 环境变量配置

在 Cloudflare Pages 项目设置中添加以下环境变量：

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `GITHUB_TOKEN` | ✅ 是 | 无 | GitHub Personal Access Token（需 `repo` 权限） |
| `GITHUB_USER` | ❌ 否 | `chnbsdan` | GitHub 用户名 |
| `GITHUB_REPO` | ❌ 否 | `cf-pico` | 存储图片的仓库名 |
| `IMAGES_BUCKET` | ❌ 否 | 无 | Cloudflare R2 存储桶绑定（使用 R2 时需要） |

### 获取 GitHub Token

1. 访问 GitHub → Settings → Developer settings → Personal access tokens
2. 点击 **Generate new token (classic)**
3. 勾选 `repo` 权限（完整控制私有仓库）
4. 生成并复制 Token（以 `ghp_` 开头）

---

## 📦 部署步骤

### 1. 创建 GitHub 图片存储仓库

创建一个新的私有仓库用于存储图片，例如 `cf-pico`：

```
cf-pico/
├── wallpaper/   # 横屏图片存放目录
├── cover/       # 竖屏图片存放目录
├── sh/          # 横屏图片（备用）
└── sd/          # 竖屏图片（备用）
```

### 2. Fork 或克隆本项目

```bash
git clone https://github.com/chnbsdan/cf-pico.git
cd cf-pico
```

### 3. 安装依赖

```bash
npm install
```

### 4. 本地开发测试

```bash
npm run dev
```

### 5. 部署到 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Pages** → **创建项目** → **连接到 Git**
3. 选择你的 GitHub 仓库 `chnbsdan/cf-pico`
4. 构建设置：
   - 框架预设：`Vite`
   - 构建命令：`npm run build`
   - 输出目录：`dist`
5. 在 **环境变量** 中添加 `GITHUB_TOKEN` 等
6. 点击 **保存并部署**

### 6. 绑定 R2 存储桶（可选）

1. 在 Cloudflare Pages 项目设置中进入 **绑定**
2. 点击 **添加绑定** → **R2 存储桶**
3. 选择你的 R2 存储桶
4. 变量名输入：`IMAGES_BUCKET`
5. 点击 **保存**

### 7. 绑定自定义域名（可选）

1. 在 Cloudflare Pages 项目设置中进入 **域 (Domains)**
2. 点击 **设置自定义域**，输入你的域名（如 `pico.your-domain.com`）
3. Cloudflare 会自动检测 DNS 配置：
   - 如果域名在 Cloudflare DNS 托管：自动配置，无需手动操作
   - 如果域名在外部 DNS 托管：按照提示添加 CNAME 记录
4. 等待 DNS 生效（通常 1-5 分钟）

---

## 🔐 管理后台

访问 `/manage` 进入管理后台，需要输入密码。

**默认密码**：`自已设定`（请在 `src/pages/Manage.jsx` 中修改）

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

示例：`20260617_风景照片.jpg`

- 日期格式：`YYYYMMDD`
- 原文件名中的特殊字符会被替换为 `_`
- PNG 大图会自动转换为 JPG 格式
- 支持格式：JPG、JPEG、PNG、WebP、GIF、AVIF

---

## ⚠️ 注意事项

1. **私有仓库** - 图片存储在私有仓库中，需要通过代理接口访问
2. **Token 安全** - 不要将 `GITHUB_TOKEN` 暴露在客户端代码中
3. **文件大小** - 单张图片限制 25MB（GitHub 限制），超过 5MB 会自动压缩
4. **支持格式** - JPG、JPEG、PNG、WebP、GIF、AVIF
5. **API 限制** - GitHub API 限制 5000 次/小时（已认证）
6. **R2 配置** - 使用 R2 存储时，需在 Cloudflare Pages 中绑定 R2 存储桶

---

## 📊 技术栈

| 技术 | 说明 |
|------|------|
| **前端** | React 18 + Vite + Tailwind CSS |
| **图标** | Font Awesome 6 |
| **后端** | Cloudflare Pages Functions |
| **存储** | GitHub 私有仓库 + Cloudflare R2 |
| **API** | GitHub REST API + Cloudflare R2 API |
| **部署** | Cloudflare Pages |

---

## 🔄 更新日志

### v2.1 (2026-06-17)
- ✨ 新增 Cloudflare R2 存储支持
- ✨ 新增上传存储方式选择（GitHub / R2）
- ✨ 管理后台支持显示和删除 R2 图片
- ✨ `/api/image` 支持 R2 302 重定向加速
- ✨ 支持外部图片配置（`external.json`）
- 🎨 优化暗色模式显示
- 🔧 修复多平台部署兼容性

### v2.0 (2026-06-16)
- 🚀 从 Vercel 迁移到 Cloudflare Pages
- ✨ 使用 Cloudflare Pages Functions 重构 API
- ✨ 新增上传历史记录功能（跨设备同步）
- ✨ 新增暗色/亮色主题切换
- ✨ 新增图片搜索功能
- ✨ 新增批量复制链接（URL/Markdown/HTML）
- ✨ 新增批量删除图片
- ✨ 新增粘贴上传（Ctrl+V）
- ✨ 新增压缩质量选择（70%/85%/100%）
- 🎨 优化管理后台布局（左侧目录树）
- 🎨 优化移动端体验（汉堡菜单）

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

- [GitHub 仓库](https://github.com/chnbsdan/cf-pico)
- [在线演示](https://cf-pico.pages.dev)
- [API 文档](https://cf-pico.pages.dev/docs)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Token 申请](https://github.com/settings/tokens)

---

## 👤 作者

- GitHub: [chnbsdan](https://github.com/chnbsdan)
- 博客: [Aoso Blog](https://aoso.hangdn.com)

---

## Star History

<a href="https://www.star-history.com/?repos=chnbsdan/cf-pico&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=chnbsdan/cf-pico&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=chnbsdan/cf-pico&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=chnbsdan/cf-pico&type=date&legend=top-left" />
 </picture>
</a>
