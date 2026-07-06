// functions/api/github.js - GitHub Release 文件代理（支持在线预览）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filename = url.searchParams.get('path');

  if (!filename) {
    return new Response('Missing path parameter', { status: 400 });
  }

  // 从环境变量获取配置
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO; // 格式: "用户名/仓库名"
  const tag = env.GITHUB_RELEASE_TAG || 'cf-pico-storage';

  if (!token || !repo) {
    return new Response('GitHub configuration missing', { status: 500 });
  }

  try {
    // 1. 获取 Release 信息，找到对应附件
    const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
    const releaseRes = await fetch(releaseUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cf-pico-proxy'
      }
    });

    if (!releaseRes.ok) {
      return new Response('Release not found', { status: 404 });
    }

    const release = await releaseRes.json();
    const asset = release.assets.find(a => a.name === filename);

    if (!asset) {
      return new Response('File not found in release', { status: 404 });
    }

    // 2. 获取文件内容
    const fileRes = await fetch(asset.browser_download_url, {
      headers: {
        'User-Agent': 'cf-pico-proxy'
      }
    });

    if (!fileRes.ok) {
      return new Response('Failed to fetch file', { status: fileRes.status });
    }

    // 3. 判断文件类型，设置正确的 Content-Type
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const contentTypeMap = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // 4. 返回文件，关键点：设置 Content-Disposition 为 inline
    const fileBuffer = await fileRes.arrayBuffer();
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('GitHub proxy error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}
