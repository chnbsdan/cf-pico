// functions/api/github.js - 完整修改版
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const filename = url.searchParams.get('path');

  if (!filename) {
    return new Response('Missing path parameter', { status: 400 });
  }

  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  const tag = env.GITHUB_RELEASE_TAG || 'cf-pico-storage';

  if (!token || !repo) {
    return new Response('GitHub configuration missing', { status: 500 });
  }

  try {
    // 1. 先获取所有 Release，再过滤
    const listUrl = `https://api.github.com/repos/${repo}/releases`;
    const listRes = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'cf-pico-proxy'
      }
    });

    if (!listRes.ok) {
      return new Response('Failed to fetch releases', { status: listRes.status });
    }

    const releases = await listRes.json();
    const release = releases.find(r => r.tag_name === tag);

    if (!release) {
      return new Response(`Release with tag "${tag}" not found`, { status: 404 });
    }

    // 2. 在 Release 的 assets 中查找文件
    const asset = release.assets.find(a => a.name === filename);

    if (!asset) {
      return new Response(`File "${filename}" not found in release "${tag}"`, { status: 404 });
    }

    // 3. 获取文件内容
    const fileRes = await fetch(asset.browser_download_url, {
      headers: {
        'User-Agent': 'cf-pico-proxy'
      }
    });

    if (!fileRes.ok) {
      return new Response('Failed to fetch file', { status: fileRes.status });
    }

    // 4. 判断文件类型
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

    // 5. 返回文件
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
