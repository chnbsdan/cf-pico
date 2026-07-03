# CF-Pico - Cloudflare Pages 现代化的个人图床服务

> 基于 Cloudflare Pages + GitHub 私有仓库 + R2 存储 + Telegram 频道 + **HuggingFace** 的现代化个人图床服务

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

---

## 📖 项目简介

`CF-Pico` 是一个基于 Cloudflare Pages 的现代化个人图床服务，支持 **GitHub 私有仓库**、**Cloudflare R2**、**Telegram 频道** 和 **HuggingFace Dataset** 四种存储方式。提供随机图片 API、分类管理、批量上传、管理后台等完整功能，界面采用毛玻璃效果，支持暗色/亮色主题。

---

## ✨ 功能特点

### 核心功能
- 🖼️ **随机图片 API** - `/api/random`、`/api/wallpaper`、`api/cover`、`/api/tg`
- 📂 **分类管理** - 支持横屏（wallpaper/sh）和竖屏（cover/sd）分类 + Telegram 独立分类 + HuggingFace 独立分类
- 📤 **批量上传** - 多文件选择、拖拽上传、粘贴上传（Ctrl+V）
- 🔒 **私有仓库** - 图片存储在 GitHub 私有仓库中，安全可控
- ☁️ **R2 存储支持** - 支持 Cloudflare R2 作为存储，CDN 加速
- ✈️ **Telegram 存储支持** - 支持 Telegram 频道作为存储后端
- 🤗 **HuggingFace 存储支持** - 支持 HuggingFace Dataset 作为存储后端，**100GB 免费空间**
- 🌐 **代理访问** - 通过 `/api/image?path=` 统一代理，不暴露后端域名
- 🚀 **大文件分片上传** - 支持最大 500MB 文件，分片上传到 Telegram

### 管理后台
- 🔐 **密码保护** - 管理页面需要密码登录（支持环境变量配置）
- 🖼️ **图片预览** - 网格视图展示，支持点击放大预览
- 📋 **一键复制** - 点击复制图片链接（自动补全域名）
- 🗑️ **删除图片** - 网页上直接删除，同步到 GitHub/R2/Telegram/HuggingFace
- 📊 **分页浏览** - 每页 48 张图片，支持翻页
- 📁 **目录树** - 左侧显示分类及图片数量
- 📜 **上传历史** - 记录所有上传图片，支持搜索和批量删除
- 🔍 **图片搜索** - 按文件名快速搜索图片
- 📦 **批量操作** - 批量复制链接（URL/Markdown/HTML）、批量删除
- 🎯 **筛选功能** - 按文件类型、存储渠道、文件夹筛选

### 图片处理
- 🔄 **WebP 转换** - 上传时可选择自动转换为 WebP 格式（前端转换）
- 📷 **原格式保留** - 不转换时保持原格式上传
- ⚡ **自动压缩** - 超过阈值自动压缩（可配置）

### 界面特性
- 🎲 **随机背景** - 每次刷新页面背景随机变化
- 🌫️ **毛玻璃效果** - 现代化毛玻璃界面设计
- 🌙 **暗色/亮色主题** - 支持一键切换明暗主题
- 🎨 **响应式布局** - 完美适配 PC、平板、手机
- 🖱️ **粘贴上传** - 支持 Ctrl+V 粘贴截图上传

---

## 🚀 部署到 Cloudflare Pages

### 第一步：准备 GitHub 图片存储仓库

创建一个新的私有仓库用于存储图片，例如 `cf-pico`：

```
cf-pico/
├── wallpaper/   # 横屏图片存放目录
├── cover/       # 竖屏图片存放目录
├── sh/          # 横屏图片（备用）
└── sd/          # 竖屏图片（备用）
```

### 第二步：Fork 或克隆本项目

```bash
git clone https://github.com/chnbsdan/cf-pico.git
cd cf-pico
```

### 第三步：安装依赖

```bash
npm install
```

### 第四步：配置环境变量

#### 方式一：在 Cloudflare Pages 后台配置（推荐）

在 Cloudflare Pages 项目设置 → **环境变量** 中添加：

| 变量名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `GITHUB_TOKEN` | 加密文本 | ✅ | 无 | GitHub Personal Access Token（需 `repo` 权限） |
| `GITHUB_USER` | 纯文本 | ❌ | `chnbsdan` | GitHub 用户名 |
| `GITHUB_REPO` | 纯文本 | ❌ | `cf-pico` | 存储图片的仓库名 |
| `VITE_ADMIN_PASSWORD` | 加密文本 | ❌ | `admin123` | 管理后台密码 |
| `VITE_LOGIN_PASSWORD` | 加密文本 | ❌ | `admin123` | 网站登录密码 |
| `TG_BOT_TOKEN` | 加密文本 | ❌ | 无 | Telegram Bot Token（使用 Telegram 存储时需要） |
| `TG_CHAT_ID` | 加密文本 | ❌ | 无 | Telegram 频道 ID（使用 Telegram 存储时需要） |
| `HF_TOKEN` | 加密文本 | ❌ | 无 | HuggingFace Access Token（使用 HuggingFace 存储时需要） |
| `HF_REPO` | 纯文本 | ❌ | 无 | HuggingFace Dataset 名称（如 `username/dataset-name`） |
| `FOLDER_WALLPAPER` | 纯文本 | ❌ | `wallpaper` | 横屏图片存储文件夹 |
| `FOLDER_COVER` | 纯文本 | ❌ | `cover` | 竖屏图片存储文件夹 |

#### 方式二：使用 `.env.production` 文件（本地构建）

在项目根目录创建 `.env.production` 文件：

```
GITHUB_TOKEN=你的GitHub_Token
GITHUB_USER=chnbsdan
GITHUB_REPO=cf-pico
VITE_ADMIN_PASSWORD=你的管理密码
VITE_LOGIN_PASSWORD=你的登录密码
TG_BOT_TOKEN=你的Telegram_Bot_Token
TG_CHAT_ID=你的Telegram频道ID
HF_TOKEN=你的HuggingFace_Token
HF_REPO=你的HuggingFace_Dataset名称
FOLDER_WALLPAPER=wallpaper
FOLDER_COVER=cover
```

**注意**：`.env.production` 文件不要提交到公开仓库（已在 `.gitignore` 中）。

### 第五步：绑定 R2 存储桶（可选）

1. 进入 Cloudflare Pages 项目 → **设置** → **绑定**
2. 点击 **添加绑定** → 选择 **R2 存储桶**
3. 填写：
   - **变量名称**：`IMAGES_BUCKET`
   - **R2 存储桶**：选择你的存储桶
4. 点击 **保存**

### 第六步：部署

1. 推送到 GitHub 仓库，Cloudflare Pages 会自动部署
2. 或在 Cloudflare Pages 中手动触发部署

---

## 📡 API 接口

### 图片接口
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/random` | GET | 随机返回一张图片（所有分类） |
| `/api/wallpaper` | GET | 随机返回横屏图片 |
| `/api/cover` | GET | 随机返回竖屏图片 |
| `/api/tg` | GET | 随机返回一张 Telegram 图片 |
| `/api/tg?format=html` | GET | 全屏展示 Telegram 随机图片（60秒自动刷新） |
| `/api/list` | GET | 返回所有图片列表（按分类分组） |
| `/api/stats` | GET | 返回统计信息 |
| `/api/image` | GET | 代理访问图片（参数：path=分类/文件名） |
| `/api/large/{fileId}.{ext}` | GET | 下载大文件（流式传输，支持断点续传） |
| `/api/short/{filename}` | GET | 短链接访问（用文件名访问 Telegram 文件） |

### 分片上传接口
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload/init` | POST | 初始化分片上传 |
| `/api/upload/chunk` | POST | 上传单个分片 |
| `/api/upload/complete` | POST | 完成分片上传（合并） |

### 管理接口
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 上传图片（multipart/form-data） |
| `/api/history` | GET | 获取上传历史记录 |
| `/api/history` | POST | 添加历史记录 |
| `/api/history` | DELETE | 删除历史记录 |
| `/api/admin/delete` | POST | 删除图片（需要密码） |

### 使用示例

```bash
# 随机获取图片
curl https://your-domain.com/api/random

# 随机获取 Telegram 图片
curl https://your-domain.com/api/tg

# 全屏展示 Telegram 随机壁纸（60秒自动刷新）
# 浏览器访问：https://your-domain.com/api/tg?format=html

# 获取统计信息
curl https://your-domain.com/api/stats

# 上传图片（选择存储方式）
curl -X POST \
  -F "file=@image.jpg" \
  -F "folder=wallpaper" \
  -F "storage=huggingface" \
  https://your-domain.com/api/upload

# 代理访问图片
https://your-domain.com/api/image?path=wallpaper/20260617_image.jpg

# 访问大文件（带扩展名）
https://your-domain.com/api/large/file_xxx.mp4

# 短链接访问
https://your-domain.com/api/short/20260701_photo.jpg
```

---

## 📁 项目结构

```
cf-pico/
├── functions/                    # Cloudflare Pages Functions
│   ├── api/
│   │   ├── utils/                # 公共工具函数
│   │   │   ├── helpers.js        # 通用辅助函数
│   │   │   ├── r2.js             # R2 存储操作
│   │   │   ├── telegram.js       # Telegram 存储操作
│   │   │   ├── github.js         # GitHub 存储操作
│   │   │   └── huggingface.js    # HuggingFace 存储操作
│   │   ├── hf/                   # HuggingFace 路由
│   │   │   └── [path].js         # HuggingFace 图片代理
│   │   ├── upload/               # 分片上传
│   │   │   ├── init.js           # 初始化分片
│   │   │   ├── chunk.js          # 上传分片
│   │   │   └── complete.js       # 完成分片
│   │   ├── large/                # 大文件操作
│   │   │   └── [id].js           # 下载/删除大文件
│   │   ├── short/                # 短链接
│   │   │   └── [id].js           # 短链接访问
│   │   ├── upload.js             # 普通上传
│   │   ├── list.js               # 文件列表
│   │   ├── stats.js              # 统计信息
│   │   ├── random.js             # 随机图片
│   │   ├── wallpaper.js          # 壁纸
│   │   ├── cover.js              # 封面
│   │   ├── image.js              # 图片代理
│   │   ├── tg.js                 # Telegram 随机
│   │   ├── history.js            # 历史记录
│   │   └── admin/
│   │       └── delete.js         # 删除文件
│   └── [[path]].js               # 路由兜底（SPA 支持）
├── src/
│   ├── components/               # UI 组件
│   │   ├── Header.jsx
│   │   ├── StatsCard.jsx
│   │   ├── UploadArea.jsx
│   │   ├── UploadResult.jsx
│   │   ├── ThemeToggle.jsx
│   │   ├── FileCard.jsx          # 文件卡片（管理后台）
│   │   ├── BatchActionBar.jsx    # 批量操作栏
│   │   ├── FileDetailDialog.jsx  # 文件详情弹窗
│   │   ├── FilterDropdown.jsx    # 筛选下拉
│   │   ├── SkeletonLoader.jsx    # 骨架屏加载
│   │   └── Footer.jsx
│   ├── pages/
│   │   ├── Manage.jsx            # 图片管理页面
│   │   └── ApiDocs.jsx           # API 文档页面
│   ├── lib/
│   │   └── api.js                # API 调用封装
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── favicon.ico
│   └── logo.png                  # 自定义 Logo（可选）
├── .env.production               # 生产环境变量（可选）
├── package.json
└── README.md
```

---

## 🔐 管理后台

访问 `/manage` 进入管理后台，密码通过环境变量 `VITE_ADMIN_PASSWORD` 配置。

### 功能列表
| 功能 | 说明 |
|------|------|
| 图片预览 | 网格视图展示，支持点击放大 |
| 复制链接 | 一键复制完整域名链接 |
| 删除图片 | 确认后删除，同步到 GitHub/R2/Telegram/HuggingFace |
| 分类筛选 | 横屏/竖屏/Telegram/HuggingFace 分类切换 |
| 分页浏览 | 每页 48 张，支持翻页 |
| 图片搜索 | 按文件名实时搜索 |
| 批量复制 | 支持复制 URL/Markdown/HTML |
| 批量删除 | 勾选多张图片一键删除 |
| 上传历史 | 查看所有上传记录，支持搜索和批量删除 |
| 文件详情 | 点击图片查看详细信息（大小、渠道、链接等） |
| 筛选功能 | 按文件类型、存储渠道、文件夹筛选 |
| 骨架屏加载 | 加载时显示占位骨架屏，提升体验 |

---

## ⚙️ 环境变量完整说明

### 基础变量
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `GITHUB_TOKEN` | ✅ | 无 | GitHub Personal Access Token（需 `repo` 权限） |
| `GITHUB_USER` | ❌ | `chnbsdan` | GitHub 用户名 |
| `GITHUB_REPO` | ❌ | `cf-pico` | 存储图片的仓库名 |

### 管理后台
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_ADMIN_PASSWORD` | ❌ | `admin123` | 管理后台密码（前端使用，需 `VITE_` 前缀） |

### 网站登录
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_LOGIN_PASSWORD` | ❌ | `admin123` | 网站登录密码（前端使用，需 `VITE_` 前缀） |

### 文件夹自定义
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `FOLDER_WALLPAPER` | ❌ | `wallpaper` | 横屏图片存储文件夹 |
| `FOLDER_COVER` | ❌ | `cover` | 竖屏图片存储文件夹 |

### R2 存储（可选）
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `IMAGES_BUCKET` | ❌ | 无 | R2 存储桶绑定（在 Pages 设置中绑定） |

### Telegram 存储（可选）
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `TG_BOT_TOKEN` | ❌ | 无 | Telegram Bot Token（需 `sendDocument` 权限） |
| `TG_CHAT_ID` | ❌ | 无 | Telegram 频道 ID（格式：`-100xxxxx`） |

### HuggingFace 存储（可选）
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HF_TOKEN` | ❌ | 无 | HuggingFace Access Token（需 `write` 权限） |
| `HF_REPO` | ❌ | 无 | HuggingFace Dataset 名称（如 `username/dataset-name`） |

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 创建本地环境变量（可选）
cp .env.example .env.local
# 编辑 .env.local 填入你的配置

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

---

## 📊 技术栈

| 技术 | 说明 |
|------|------|
| **前端** | React 18 + Vite + Tailwind CSS |
| **图标** | Font Awesome 6 |
| **后端** | Cloudflare Pages Functions（拆分路由） |
| **存储** | GitHub 私有仓库 + Cloudflare R2 + Telegram 频道 + HuggingFace Dataset |
| **部署** | Cloudflare Pages |

---

## 🔄 更新日志

### v2.5 (2026-07-03)
- 🤗 **新增 HuggingFace 存储支持** - 支持 HuggingFace Dataset 作为存储后端，**100GB 免费空间**
- 🚀 **独立 HuggingFace 路由** - `/api/hf/{path}` 独立代理，不与其他存储混淆
- 🎯 **后台完整集成** - 列表、筛选、单个删除、批量删除全支持
- 📋 **文件详情优化** - 自动补全完整域名链接
- 🐛 **修复批量删除路径问题** - HuggingFace 批量删除传 `path` 字段

### v2.4 (2026-07-02)
- 🚀 **代码拆分重构** - 将 `[[path]].js` 拆分为 20+ 个独立路由文件
- 🚀 **短链接支持** - 新增 `/api/short/{filename}` 短链接访问
- 🚀 **大文件流式下载** - 支持超大文件流式传输，不占用服务器内存
- 🚀 **管理后台增强** - 新增文件详情弹窗、批量操作栏、筛选下拉、骨架屏加载
- 🚀 **文件卡片组件** - 统一展示图片/音频/视频文件
- 🐛 **修复 btoa 错误** - `btoa()` 只在 GitHub 分支执行，MP3/视频走 Telegram 不触发
- 🐛 **修复链接扩展名** - 大文件链接带 `.mp4`/`.mp3` 等扩展名
- 🐛 **修复 _redirects 静态资源拦截** - 静态文件不被路由拦截
- ✨ **图片 WEBP 转换** - 前端 Canvas 转换，更可靠
- ✨ **前端压缩** - 图片压缩阈值可配置
- 🎨 **设置弹窗** - 压缩质量、命名方式等设置整合到弹窗

### v2.3 (2026-06-23)
- ✨ **新增 Telegram 存储支持** - 用户可选择将图片上传到 Telegram 频道
- ✨ **新增登录页面** - 参考 cf-tgbed 风格，支持密码登录
- ✨ **新增 `/api/tg` 接口** - 随机返回 Telegram 图片，支持 `?format=html` 全屏壁纸模式
- ✨ **管理后台新增 Telegram 分类** - 独立展示 Telegram 存储的图片
- ✨ **图片代理优化** - 强制设置正确的 MIME 类型，实现 Telegram 图片在线预览
- 🐛 **修复缓存问题** - 设置 `Cache-Control: no-cache` 确保最新图片正常预览
- 🐛 **修复链接生成** - 正确生成 Telegram 图片的代理链接（包含子路径）
- 🎨 **上传界面优化** - 增加存储方式选择（GitHub / R2 / Telegram）
- 🎨 **统一 UI 风格** - 首页和管理后台统一毛玻璃风格

### v2.2 (2026-06-17)
- ✨ 管理密码支持环境变量配置（`VITE_ADMIN_PASSWORD`）
- ✨ 上传历史记录支持搜索功能
- 🐛 修复 R2 存储链接 `undefined.r2.dev` 问题
- 🐛 修复私有仓库图片代理 302 重定向问题
- 🎨 优化图片加载速度（懒加载 + 预加载）

### v2.0 (2026-06-16)
- 🚀 从 Vercel 迁移到 Cloudflare Pages
- ✨ 新增 Cloudflare R2 存储支持
- ✨ 新增上传历史记录功能
- ✨ 新增暗色/亮色主题切换
- ✨ 新增批量操作（复制/删除）

---

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源协议。

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/chnbsdan/cf-pico)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Token 申请](https://github.com/settings/tokens)
- [HuggingFace](https://huggingface.co)

---

## 👤 作者

- GitHub: [chnbsdan](https://github.com/chnbsdan)
- 博客: [Aoso Blog](https://blog.xxx.com)

---

如果觉得这个项目对你有帮助，欢迎 ⭐ Star 支持！

---

## 更新内容总结

| 修改项 | 说明 |
|--------|------|
| HuggingFace 支持 | 新增第四种存储渠道，100GB 免费空间 |
| 项目结构 | 新增 `functions/api/hf/` 和 `utils/huggingface.js` |
| API 接口 | 新增 `/api/hf/{path}` HuggingFace 图片代理 |
| 管理后台 | HuggingFace 分类、筛选、删除全支持 |
| 环境变量 | 新增 `HF_TOKEN`、`HF_REPO` |
| 更新日志 | 新增 v2.5 版本记录 |
