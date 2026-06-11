

# ImgBed - 现代化个人图床

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://vercel.com)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com)

> 基于 Vercel + GitHub 私有仓库的现代化个人图床服务，支持横屏/竖屏分类上传、批量上传、自动压缩、随机图片 API 等功能。

**[在线演示](https://tt.2098.nyc.mn)** | **[GitHub 仓库](https://github.com/chnbsdan/imgbed)**

---

## ✨ 功能特点

### 核心功能
- 🖼️ **随机图片 API** - `/api/random` 接口，每次返回随机图片
- 📂 **分类管理** - 支持横屏（wallpaper）和竖屏（cover）两种分类
- 📤 **批量上传** - 多文件选择、拖拽上传，自动压缩大图
- 🔒 **私有仓库** - 图片存储在 GitHub 私有仓库中，安全可控
- 🌐 **代理访问** - 通过 `/wallpaper/` 和 `/cover/` 代理访问图片

### 高级功能
- 📊 **统计信息** - 实时显示各类图片数量
- 📋 **图片列表** - 查看所有图片及分类
- 📦 **JSON 格式** - 返回随机图片的 JSON 信息
- 🎨 **自动压缩** - 超过 3MB 的图片自动压缩
- 🔗 **外部图片支持** - 通过 JSON 文件管理外部图片链接
- 🖼️ **毛玻璃界面** - 现代化毛玻璃效果设计
- 📱 **响应式布局** - 完美适配 PC、平板、手机

### 界面特性
- 🎲 **随机背景** - 每次刷新页面背景随机变化
- 🖱️ **一键复制** - 点击复制图片链接
- 👁️ **图片预览** - 上传后可直接预览
- 🔄 **换背景按钮** - 点击换背景，只从横屏图片中随机获取
- 🎨 **天蓝色悬停** - 上传区域鼠标悬停变天蓝色

---

## 📁 项目结构

```
imgbed/
├── api/                        # Vercel Serverless Functions
│   ├── img/
│   │   └── [filename].js      # 图片代理服务
│   ├── random.js              # 随机图片接口（全部分类）
│   ├── wallpaper.js           # 横屏图片接口
│   ├── cover.js               # 竖屏图片接口
│   ├── json.js                # JSON 格式接口
│   ├── list.js                # 图片列表接口
│   ├── stats.js               # 统计信息接口
│   ├── upload.js              # 图片上传接口
│   └── external.js            # 外部图片读取接口
├── src/                       # React 前端源码
│   ├── components/            # UI 组件
│   │   ├── Header.jsx         # 头部组件
│   │   ├── StatsCard.jsx      # 统计卡片
│   │   ├── ApiSection.jsx     # API 接口展示
│   │   ├── UploadArea.jsx     # 上传区域
│   │   ├── UploadResult.jsx   # 上传结果
│   │   └── Footer.jsx         # 页脚组件
│   ├── lib/
│   │   └── api.js             # API 调用封装
│   ├── App.jsx                # 主应用
│   ├── main.jsx               # 入口文件
│   └── index.css              # 全局样式
├── public/
│   └── favicon.ico            # 网站图标
├── index.html                 # HTML 模板
├── package.json               # 依赖配置
├── vite.config.js             # Vite 配置
├── tailwind.config.js         # Tailwind CSS 配置
├── postcss.config.js          # PostCSS 配置
├── vercel.json                # Vercel 路由配置
└── README.md                  # 项目说明
```

---

## 📡 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/random` | GET | 随机返回一张图片（全部分类 + 外部图片） |
| `/api/wallpaper` | GET | 随机返回横屏图片（仅 wallpaper 文件夹 + 对应外部图片） |
| `/api/cover` | GET | 随机返回竖屏图片（仅 cover 文件夹 + 对应外部图片） |
| `/api/json` | GET | 返回随机图片的 JSON 信息 |
| `/api/list` | GET | 返回所有图片列表（按分类分组） |
| `/api/stats` | GET | 返回统计信息（各分类图片数量） |
| `/api/upload` | POST | 上传图片（multipart/form-data） |
| `/wallpaper/:filename` | GET | 代理访问横屏图片 |
| `/cover/:filename` | GET | 代理访问竖屏图片 |

### 使用示例

```bash
# 随机获取图片
curl https://tt.hangdn.com/api/random

# 随机获取横屏图片
curl https://tt.hangdn.com/api/wallpaper

# 随机获取竖屏图片
curl https://tt.hangdn.com/api/cover

# 获取 JSON 格式
curl https://tt.hangdn.com/api/json

# 获取统计信息
curl https://tt.hangdn.com/api/stats

# 获取图片列表
curl https://tt.hangdn.com/api/list

# 上传图片
curl -X POST -F "file=@image.jpg" -F "folder=wallpaper" https://tt.hangdn.com/api/upload

# 直接访问图片
https://tt.hangdn.com/wallpaper/20260610_image.jpg
```

### JSON 返回示例

```json
{
  "code": "200",
  "imgurl": "https://tt.hangdn.com/api/random",
  "source": "https://raw.githubusercontent.com/chnbsdan/imgbed-storage/main/wallpaper/20260610_image.jpg",
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
| `GITHUB_REPO` | 存储图片的仓库名 | 可选（默认 imgbed-storage） |

### 获取 GitHub Token

1. 访问 GitHub → Settings → Developer settings → Personal access tokens
2. 点击 **Generate new token (classic)**
3. 勾选 `repo` 权限（完整控制私有仓库）
4. 生成并复制 Token（以 `ghp_` 开头）

---

## 📦 部署步骤

### 1. 创建 GitHub 图片存储仓库

创建一个新的私有仓库用于存储图片，例如 `imgbed-storage`：

```
imgbed-storage/
├── wallpaper/   # 横屏图片存放目录
├── cover/       # 竖屏图片存放目录
└── external.json # 外部图片配置文件（可选）
```

### 2. 配置外部图片（可选）

在 `imgbed-storage` 仓库根目录创建 `external.json`：

```json
{
  "wallpaper": [
    "https://example.com/landscape1.jpg",
    "https://example.com/landscape2.jpg"
  ],
  "cover": [
    "https://example.com/portrait1.jpg",
    "https://example.com/portrait2.jpg"
  ]
}
```

### 3. Fork 或克隆本项目

```bash
git clone https://github.com/chnbsdan/imgbed.git
cd imgbed
```

### 4. 安装依赖

```bash
npm install
```

### 5. 本地开发测试

```bash
npm run dev
```

### 6. 部署到 Vercel

**方法一：使用 Vercel CLI**

```bash
npm install -g vercel
vercel --prod
```

**方法二：通过 Vercel 网页**

1. 访问 [Vercel](https://vercel.com)
2. 点击 **Add New** → **Project**
3. 导入你的 GitHub 仓库
4. 在 **Environment Variables** 中添加 `GITHUB_TOKEN`
5. 点击 **Deploy**

### 7. 绑定自定义域名（可选）

1. 在 Vercel 项目设置中进入 **Domains**
2. 添加你的域名（如 `tt.hangdn.com`）
3. 在你的 DNS 服务商添加 CNAME 记录：
   - 类型：`CNAME`
   - 名称：你的子域名
   - 目标：`cname.vercel-dns.com`
   - 代理状态：**关闭**（灰色云朵）

---

## 🎨 界面效果

### 主要界面特性
- 🌫️ **毛玻璃外框** - 所有卡片统一毛玻璃效果
- 📊 **统计卡片** - 紧凑横排设计，节省空间
- 🔘 **换背景按钮** - 绿色背景，悬停变亮
- 📤 **上传区域** - 高度增加，悬停变天蓝色
- 🖱️ **一键复制** - 点击复制图片链接
- 👁️ **图片预览** - 上传后直接预览
- 🔗 **左上角 LOGO** - 点击跳转 GitHub 仓库

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

示例：`20260610_风景照片.jpg`

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

### v2.0 (2026-06-11)
- ✨ 新增外部图片 JSON 管理，支持按分类配置
- 🎨 优化界面：毛玻璃效果、紧凑统计卡片
- 🖱️ 换背景按钮移至上传区域，只从横屏获取
- 🎨 上传区域高度增加，悬停变天蓝色
- 🔧 修复图片代理 Content-Type 问题
- 📱 优化移动端响应式布局

### v1.0 (2026-06-10)
- 🎉 初始版本发布
- 📤 支持横屏/竖屏分类上传
- 🔗 随机图片 API
- 📊 统计信息 API
- 🌐 图片代理访问

---

## 📄 许可证

MIT License © 2026 chnbsdan

```text
MIT License

Copyright (c) 2026 chnbsdan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/chnbsdan/imgbed)
- [在线演示](https://tt.hangdn.com)
- [Vercel 部署](https://vercel.com)
- [GitHub Token 申请](https://github.com/settings/tokens)

---

## 👤 作者

- GitHub: [chnbsdan](https://github.com/chnbsdan)
- 博客: [Aoso Blog](https://aoso.hangdn.com)

---

⭐ 如果觉得这个项目有用，欢迎 Star！

---

