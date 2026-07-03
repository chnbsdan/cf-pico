// functions/api/utils/huggingface.js
// HuggingFace Git LFS 上传模块 - 专为 Dataset 设计

function getHFConfig(env) {
  const token = env.HF_TOKEN;
  const repo = env.HF_REPO; // 格式: "username/dataset-name"
  if (!token || !repo) throw new Error('HuggingFace 配置缺失');
  return { token, repo };
}

/**
 * 计算文件 SHA256
 */
async function computeSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 将文件对象转换为符合 LFS 要求的 sample (前 512 字节 base64)
 */
async function getFileSample(file) {
  const sampleBuffer = await file.slice(0, 512).arrayBuffer();
  const bytes = new Uint8Array(sampleBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * 执行 LFS 上传完整流程
 */
export async function uploadToHuggingFace(file, path, env) {
  try {
    const { token, repo } = getHFConfig(env);
    const fileBuffer = await file.arrayBuffer();
    const fileSize = fileBuffer.byteLength;
    const oid = await computeSHA256(fileBuffer);
    const sample = await getFileSample(file);

    // 1. Preupload - 检查文件是否需要 LFS
    const preuploadRes = await fetch(`https://huggingface.co/api/datasets/${repo}/preupload/main`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [{ path, size: fileSize, sample }] })
    });
    if (!preuploadRes.ok) throw new Error(`Preupload 失败: ${await preuploadRes.text()}`);
    const preuploadData = await preuploadRes.json();
    if (preuploadData.files?.[0]?.uploadMode !== 'lfs') {
      // 小文件或非 LFS 文件，使用普通上传 (此情况较少，暂不处理)
      throw new Error('此文件不需要 LFS 上传，请检查文件大小或类型');
    }

    // 2. LFS Batch - 获取上传 URL
    const batchRes = await fetch(`https://huggingface.co/datasets/${repo}.git/info/lfs/objects/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.git-lfs+json',
        'Content-Type': 'application/vnd.git-lfs+json'
      },
      body: JSON.stringify({
        operation: 'upload',
        transfers: ['basic'],
        hash_algo: 'sha256',
        ref: { name: 'main' },
        objects: [{ oid, size: fileSize }]
      })
    });
    if (!batchRes.ok) throw new Error(`LFS Batch 失败: ${await batchRes.text()}`);
    const batchData = await batchRes.json();
    const uploadAction = batchData.objects?.[0]?.actions?.upload;
    if (!uploadAction) throw new Error('无法获取 LFS 上传地址');

    // 3. 上传文件到 LFS 存储 (S3)
    const uploadRes = await fetch(uploadAction.href, {
      method: 'PUT',
      headers: uploadAction.header || {},
      body: file
    });
    if (!uploadRes.ok) throw new Error(`LFS 上传失败: ${await uploadRes.text()}`);

    // 4. Commit - 提交 LFS 文件引用
    const commitBody = [
      JSON.stringify({ key: 'header', value: { summary: `Upload ${path}` } }),
      JSON.stringify({ key: 'lfsFile', value: { path, algo: 'sha256', size: fileSize, oid } })
    ].join('\n');
    const commitRes = await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-ndjson'
      },
      body: commitBody
    });
    if (!commitRes.ok) throw new Error(`提交失败: ${await commitRes.text()}`);

    const fileUrl = `https://huggingface.co/datasets/${repo}/raw/main/${path}`;
    return { success: true, url: fileUrl, source: 'huggingface', path };

  } catch (error) {
    console.error('HuggingFace 上传错误:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 从 HuggingFace Dataset 删除文件
 */
export async function deleteFromHuggingFace(path, env) {
  try {
    const { token, repo } = getHFConfig(env);
    const commitBody = [
      JSON.stringify({ key: 'header', value: { summary: `Delete ${path}` } }),
      JSON.stringify({ key: 'deletedFile', value: { path } })
    ].join('\n');
    const res = await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-ndjson'
      },
      body: commitBody
    });
    if (!res.ok) throw new Error(`删除失败: ${await res.text()}`);
    return { success: true, message: '文件已删除' };
  } catch (error) {
    console.error('HuggingFace 删除错误:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取 HuggingFace Dataset 的文件列表
 */
export async function listFilesFromHuggingFace(env, folder = '') {
  try {
    const { token, repo } = getHFConfig(env);
    const res = await fetch(`https://huggingface.co/api/datasets/${repo}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`获取列表失败: ${await res.text()}`);
    const data = await res.json();
    let files = (data.siblings || [])
      .filter(f => {
        const name = f.rfilename || '';
        return !name.endsWith('/') && !['.gitattributes', 'README.md', '.gitignore'].includes(name);
      });
    if (folder) files = files.filter(f => f.rfilename.startsWith(folder + '/'));
    const formatted = files.map(f => ({
      name: f.rfilename.split('/').pop(),
      path: f.rfilename,
      size: f.size || 0,
      url: `https://huggingface.co/datasets/${repo}/raw/main/${f.rfilename}`,
      source: 'huggingface',
      folder: f.rfilename.split('/')[0] || ''
    }));
    return { success: true, files: formatted, total: formatted.length };
  } catch (error) {
    console.error('HuggingFace 列表错误:', error);
    return { success: false, error: error.message, files: [] };
  }
}
