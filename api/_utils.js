// api/_utils.js - 兼容 Vercel 和 Cloudflare 的请求处理
// 作用：自动检测运行环境，将 Cloudflare 的请求转换为 Vercel 格式

/**
 * 创建兼容层处理器
 * @param {Function} handlerFn - 原始处理函数 (req, res) => {}
 * @returns {Function} 兼容两个平台的处理函数
 */
export function createHandler(handlerFn) {
  return async (reqOrContext, resOrNext) => {
    // 检测是否为 Cloudflare Pages 环境
    // Cloudflare 的 onRequest 第一个参数是 context，包含 request, env, params
    const isCloudflare = reqOrContext && typeof reqOrContext.request !== 'undefined'

    if (isCloudflare) {
      // ========== Cloudflare Pages Functions 模式 ==========
      const context = reqOrContext
      const request = context.request
      const url = new URL(request.url)

      // 获取请求体
      let bodyText = ''
      try {
        bodyText = await request.text()
      } catch (e) {
        bodyText = ''
      }

      // 构建类似 Vercel 的 req 对象
      const req = {
        method: request.method,
        url: request.url,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(request.headers),
        body: bodyText,
        env: context.env,  // Cloudflare 环境变量
        // 添加 json 方法
        json: async () => {
          try {
            return JSON.parse(bodyText)
          } catch {
            return {}
          }
        }
      }

      // 构建类似 Vercel 的 res 对象
      let responseBody = null
      let responseStatus = 200
      const responseHeaders = {}

      const res = {
        statusCode: 200,
        headers: {},
        setHeader: (key, value) => {
          responseHeaders[key] = value
          res.headers[key] = value
        },
        status: (code) => {
          responseStatus = code
          res.statusCode = code
          return res
        },
        json: (data) => {
          responseHeaders['Content-Type'] = 'application/json'
          responseBody = JSON.stringify(data)
          return new Response(responseBody, {
            status: responseStatus,
            headers: responseHeaders
          })
        },
        send: (body) => {
          responseBody = body
          return new Response(responseBody, {
            status: responseStatus,
            headers: responseHeaders
          })
        }
      }

      // 执行原始处理函数
      const result = await handlerFn(req, res)

      // 如果处理函数返回了 Response，直接返回
      if (result instanceof Response) {
        return result
      }

      // 否则返回构建的响应
      if (responseBody !== null) {
        return new Response(responseBody, {
          status: responseStatus,
          headers: responseHeaders
        })
      }

      return new Response('OK', { status: 200 })
    } else {
      // ========== Vercel Serverless Function 模式 ==========
      return handlerFn(reqOrContext, resOrNext)
    }
  }
}

/**
 * 获取环境变量（兼容两种平台）
 * @param {string} key - 环境变量名
 * @param {Object} env - Cloudflare 环境变量对象
 * @returns {string} 环境变量值
 */
export function getEnv(key, env = {}) {
  // Cloudflare 环境
  if (env && env[key]) return env[key]
  // Vercel 环境
  if (process.env && process.env[key]) return process.env[key]
  return null
}

/**
 * 解析 multipart/form-data（适配两个平台）
 * @param {string} contentType - Content-Type 头
 * @param {Buffer|ArrayBuffer} body - 请求体
 * @returns {Object} 解析后的表单数据
 */
export async function parseMultipart(contentType, body) {
  const boundary = getBoundary(contentType)
  if (!boundary) return {}

  // 将 ArrayBuffer 转换为 Buffer
  const buffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(body)

  const result = {}
  const boundaryBuffer = Buffer.from(`--${boundary}`)

  let start = 0
  let end = buffer.indexOf(boundaryBuffer, start)

  while (end !== -1) {
    start = end + boundaryBuffer.length
    let nextBoundary = buffer.indexOf(boundaryBuffer, start)
    let partEnd = nextBoundary !== -1 ? nextBoundary : buffer.length

    // 跳过开头的 \r\n
    if (buffer[start] === 13 && buffer[start + 1] === 10) {
      start += 2
    }

    const part = buffer.slice(start, partEnd)
    if (part.length === 0) {
      end = nextBoundary
      continue
    }

    // 查找 headers 结束位置
    let headerEnd = -1
    for (let i = 0; i < part.length - 3; i++) {
      if (part[i] === 13 && part[i + 1] === 10 && part[i + 2] === 13 && part[i + 3] === 10) {
        headerEnd = i
        break
      }
    }

    if (headerEnd === -1) {
      end = nextBoundary
      continue
    }

    const headers = part.slice(0, headerEnd).toString()
    const content = part.slice(headerEnd + 4)

    const nameMatch = headers.match(/name="([^"]+)"/)
    if (!nameMatch) {
      end = nextBoundary
      continue
    }

    const name = nameMatch[1]

    if (headers.includes('filename')) {
      const filenameMatch = headers.match(/filename="([^"]+)"/)
      const contentEnd = content.length >= 2 &&
        content[content.length - 2] === 13 &&
        content[content.length - 1] === 10
        ? content.length - 2
        : content.length
      const fileData = content.slice(0, contentEnd)

      result[name] = {
        filename: filenameMatch ? filenameMatch[1] : 'unknown',
        data: Buffer.from(fileData),
        size: fileData.length
      }
    } else {
      const textEnd = content.length >= 2 &&
        content[content.length - 2] === 13 &&
        content[content.length - 1] === 10
        ? content.length - 2
        : content.length
      result[name] = content.slice(0, textEnd).toString()
    }

    end = nextBoundary
  }

  return result
}

function getBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  return match ? (match[1] || match[2]) : null
}

/**
 * 生成文件名
 * @param {string} originalName - 原始文件名
 * @returns {string} 格式化后的文件名
 */
export function generateFilename(originalName) {
  const now = new Date()
  const datePrefix = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const safeName = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
  const ext = originalName.split('.').pop().toLowerCase()
  return `${datePrefix}_${safeName}.${ext}`
}
