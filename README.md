
# CF-Pico - Cloudflare Pages 现代化的个人图床服务

> 基于 Cloudflare Pages + GitHub 私有仓库 + R2 存储的现代化个人图床服务

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

---

## ✨ 功能特点

### 核心功能
- 🖼️ **随机图片 API** - `/api/random`、`/api/wallpaper`、`/api/cover`
- 📂 **分类管理** - 支持横屏（wallpaper/sh）和竖屏（cover/sd）分类
- 📤 **批量上传** - 多文件选择、拖拽上传、粘贴上传（Ctrl+V）
- 🔒 **私有仓库** - 图片存储在 GitHub 私有仓库中，安全可控
- ☁️ **R2 存储支持** - 支持 Cloudflare R2 作为存储，CDN 加速
- 🌐 **代理访问** - 通过 `/api/image?path=` 统一代理，不暴露后端域名
- 🚀 **大文件上传** - 最大支持 25MB

### 管理后台
- 🔐 **密码保护** - 管理页面需要密码登录（支持环境变量配置）
- 🖼️ **图片预览** - 网格视图展示，支持点击放大预览
- 📋 **一键复制** - 点击复制图片链接（自动补全域名）
- 🗑️ **删除图片** - 网页上直接删除，同步到 GitHub/R2
- 📊 **分页浏览** - 每页 48 张图片，支持翻页
- 📁 **目录树** - 左侧显示分类及图片数量
- 📜 **上传历史** - 记录所有上传图片，支持搜索和批量删除
- 🔍 **图片搜索** - 按文件名快速搜索图片
- 📦 **批量操作** - 批量复制链接（URL/Markdown/HTML）、批量删除

### 图片处理
- 🔄 **WebP 转换** - 上传时可选择自动转换为 WebP 格式
- 📷 **原格式保留** - 不转换时保持原格式上传
- ⚡ **自动压缩** - 超过 5MB 的图片自动压缩

### 界面特性
- 🎲 **随机背景** - 每次刷新页面背景随机变化
- 🌫️ **毛玻璃效果** - 现代化毛玻璃界面设计
- 🌙 **暗色/亮色主题** - 支持一键切换明暗主题
- 🎨 **响应式布局** - 完美适配 PC、平板、手机

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

### 第四步：配置 Cloudflare Pages 环境变量

在 Cloudflare Pages 项目设置中添加以下环境变量：

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `GITHUB_TOKEN` | ✅ | 无 | GitHub Personal Access Token（需 `repo` 权限） |
| `GITHUB_USER` | ❌ | `chnbsdan` | GitHub 用户名 |
| `GITHUB_REPO` | ❌ | `cf-pico` | 存储图片的仓库名 |
| `VITE_ADMIN_PASSWORD` | ❌ | `admin123` | 管理后台密码 |
| `FOLDER_WALLPAPER` | ❌ | `wallpaper` | 横屏图片存储文件夹 |
| `FOLDER_COVER` | ❌ | `cover` | 竖屏图片存储文件夹 |

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
| `/api/random` | GET | 随机返回一张图片 |
| `/api/wallpaper` | GET | 随机返回横屏图片 |
| `/api/cover` | GET | 随机返回竖屏图片 |
| `/api/list` | GET | 返回所有图片列表（按分类分组） |
| `/api/stats` | GET | 返回统计信息 |
| `/api/image` | GET | 代理访问图片（参数：path=分类/文件名） |

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

# 获取统计信息
curl https://your-domain.com/api/stats

# 上传图片（选择存储方式）
curl -X POST \
  -F "file=@image.jpg" \
  -F "folder=wallpaper" \
  -F "storage=r2" \
  https://your-domain.com/api/upload

# 代理访问图片
https://your-domain.com/api/image?path=wallpaper/20260617_image.jpg
```

---

## 📁 项目结构

```
cf-pico/
├── functions/
│   └── api/
│       └── [[path]].js    # Cloudflare Pages Functions（统一 API 入口）
├── src/
│   ├── components/        # UI 组件
│   │   ├── Header.jsx
│   │   ├── StatsCard.jsx
│   │   ├── UploadArea.jsx
│   │   ├── UploadResult.jsx
│   │   ├── ThemeToggle.jsx
│   │   └── Footer.jsx
│   ├── pages/
│   │   ├── Manage.jsx     # 图片管理页面
│   │   └── ApiDocs.jsx    # API 文档页面
│   ├── lib/
│   │   └── api.js         # API 调用封装
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── _redirects         # SPA 路由支持
│   └── favicon.ico
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
| 删除图片 | 确认后删除，同步到 GitHub/R2 |
| 分类筛选 | 横屏/竖屏分类切换 |
| 分页浏览 | 每页 48 张，支持翻页 |
| 图片搜索 | 按文件名实时搜索 |
| 批量复制 | 支持复制 URL/Markdown/HTML |
| 批量删除 | 勾选多张图片一键删除 |
| 上传历史 | 查看所有上传记录，支持搜索和批量删除 |

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

### 文件夹自定义
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `FOLDER_WALLPAPER` | ❌ | `wallpaper` | 横屏图片存储文件夹 |
| `FOLDER_COVER` | ❌ | `cover` | 竖屏图片存储文件夹 |

### R2 存储（可选）
| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `IMAGES_BUCKET` | ❌ | 无 | R2 存储桶绑定（在 Pages 设置中绑定） |
| `R2_PUBLIC_URL` | ❌ | 无 | R2 存储桶公共访问 URL（使用 R2 时需要） |

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

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
| **后端** | Cloudflare Pages Functions |
| **存储** | GitHub 私有仓库 + Cloudflare R2 |
| **部署** | Cloudflare Pages |

---

## 🔄 更新日志

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

本项目采用 [MIT License](LICENSE)

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/chnbsdan/cf-pico)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Token 申请](https://github.com/settings/tokens)

---

## 👤 作者

- GitHub: [chnbsdan](https://github.com/chnbsdan)
- 博客: [Aoso Blog](https://blog.xxx.com)

---

如果觉得这个项目对你有帮助，欢迎 ⭐ Star 支持！
