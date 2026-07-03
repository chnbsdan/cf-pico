## 📁 `public/_redirects` 文件说明

### 文件作用

`_redirects` 是 Cloudflare Pages 的**路由控制文件**，用于定义 URL 重定向和重写规则。在 SPA（单页应用）项目中，它确保：
1. **API 请求** 不被 SPA 路由拦截
2. **前端路由** 正确返回 `index.html`
3. **静态资源** 正常加载

---

### CF-Pico 的 `_redirects` 配置

```plaintext
# 静态资源直接访问（不重定向）
/logo.png -
/favicon.ico -

# API 请求直接转发，不走 SPA 重定向
/api/* /api/:splat 200

# 其他所有请求返回 index.html（SPA 路由）
/* /index.html 200
```

---

### 规则详解

| 规则 | 含义 |
|------|------|
| `/logo.png -` | 直接访问 `/logo.png`，不重定向 |
| `/favicon.ico -` | 直接访问 `/favicon.ico`，不重定向 |
| `/api/* /api/:splat 200` | 所有 `/api/` 开头的请求，**原样转发给 Cloudflare Functions**，状态码 200 |
| `/* /index.html 200` | 其他所有请求（如 `/manage`、`/about`），返回 `index.html`，由前端路由处理 |

---

### 为什么 API 路由必须排除？

如果没有 `/api/* /api/:splat 200` 这一行，Cloudflare Pages 会把 `/api/upload`、`/api/hf/wallpaper/xxx.jpg` 等请求也重定向到 `index.html`，导致：

- ❌ 上传接口返回 HTML 页面而不是 JSON
- ❌ 图片代理返回 HTML 页面而不是图片
- ❌ 整个 API 系统瘫痪

---

### 对应的 Cloudflare Pages 配置

在 Cloudflare Pages 项目的 **设置 → 函数** 中，`_redirects` 文件需要与 Functions 路由配合：

```
functions/
└── api/
    ├── upload.js       # 匹配 /api/upload
    ├── hf/
    │   └── [path].js   # 匹配 /api/hf/*
    └── admin/
        └── delete.js   # 匹配 /api/admin/delete
```

`/api/* /api/:splat 200` 确保这些请求能正确到达 Functions。

---

### 部署注意事项

1. **文件位置**：必须放在 `public/_redirects`，Cloudflare Pages 会自动识别
2. **格式要求**：每行一条规则，空格分隔
3. **部署后生效**：修改后推送到 GitHub，Cloudflare Pages 自动部署即可

---

## 📁 完整的 `public/_redirects`

```plaintext
# 静态资源
/logo.png -
/favicon.ico -

# API 路由（必须排除，否则 API 会返回 index.html）
/api/* /api/:splat 200

# SPA 路由（所有其他请求返回 index.html）
/* /index.html 200
```
