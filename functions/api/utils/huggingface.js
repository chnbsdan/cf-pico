// functions/api/utils/huggingface.js
// HuggingFace Git LFS 上传模块 - 修复 0 字节问题

function getHFConfig(env) {
  const token = env.HF_TOKEN;
  const repo = env.HF_REPO;
  if (!token || !repo) throw new Error('HuggingFace 配置缺失');
  return { token, repo };
}

async function computeSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getFileSample(file) {
  const sampleBuffer = await file.slice(0, 512).arrayBuffer();
  const bytes = new Uint8Array(sampleBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function uploadToHuggingFace(file, path, env, request) {
  try {
    const { token, repo } = getHFConfig(env);
    const fileBuffer = await file.arrayBuffer();
    const fileSize = fileBuffer.byteLength;
    const oid = await computeSHA256(fileBuffer);
    const sample = await getFileSample(file);

    console.log(`📤 开始上传: ${path}, 大小: ${fileSize} bytes, OID: ${oid}`);

    // 1. Preupload
    const preuploadRes = await fetch(`https://huggingface.co/api/datasets/${repo}/preupload/main`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [{ path, size: fileSize, sample }] })
    });
    if (!preuploadRes.ok) throw new Error(`Preupload 失败: ${await preuploadRes.text()}`);
    const preuploadData = await preuploadRes.json();
    console.log('Preupload 结果:', JSON.stringify(preuploadData));
    
    if (preuploadData.files?.[0]?.uploadMode !== 'lfs') {
      throw new Error('此文件不需要 LFS 上传');
    }

    // 2. LFS Batch
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
    console.log('LFS Batch 结果:', JSON.stringify(batchData));
    
    const obj = batchData.objects?.[0];
    if (obj?.error) {
      throw new Error(`LFS 对象错误: ${obj.error.message}`);
    }
    
    // 如果文件已存在，直接跳过上传
    if (obj?.actions?.upload) {
      const uploadAction = obj.actions.upload;
      console.log('上传到 LFS:', uploadAction.href);
      
      // ✅ 重新读取文件为 Blob，确保 body 可用
      const fileBlob = await file.slice(0, file.size);
      const uploadRes = await fetch(uploadAction.href, {
        method: 'PUT',
        headers: uploadAction.header || {},
        body: fileBlob
      });
      
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`LFS 上传失败 (${uploadRes.status}): ${errText}`);
      }
      console.log('✅ LFS 上传成功');
    } else {
      console.log('ℹ️ 文件已存在于 LFS 存储中');
    }

    // 4. Commit - 使用 lfsFile 方式（更可靠）
    const commitBody = [
      JSON.stringify({ key: 'header', value: { summary: `Upload ${path}` } }),
      JSON.stringify({ 
        key: 'lfsFile', 
        value: { 
          path: path, 
          oid: oid, 
          size: fileSize,
          algo: 'sha256'
        } 
      })
    ].join('\n');

    console.log('提交 Commit...');
    const commitRes = await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-ndjson'
      },
      body: commitBody
    });

    if (!commitRes.ok) {
      const errorText = await commitRes.text();
      console.error('Commit 失败:', errorText);
      
      // ✅ 备用方案：使用 file + lfs: true
      console.log('尝试备用 Commit 格式...');
      const fallbackBody = [
        JSON.stringify({ key: 'header', value: { summary: `Upload ${path}` } }),
        JSON.stringify({ 
          key: 'file', 
          value: { 
            path: path, 
            content: '', 
            lfs: true,
            oid: oid,
            size: fileSize,
            algo: 'sha256'
          } 
        })
      ].join('\n');

      const fallbackRes = await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-ndjson'
        },
        body: fallbackBody
      });
      if (!fallbackRes.ok) {
        throw new Error(`备用提交失败: ${await fallbackRes.text()}`);
      }
      console.log('✅ 备用 Commit 成功');
    } else {
      console.log('✅ Commit 成功');
    }

    // 返回统一格式链接
    const baseUrl = new URL(request.url).origin;
    const fileUrl = `${baseUrl}/api/image?path=${path}`;

    return { success: true, url: fileUrl, source: 'huggingface', path };

  } catch (error) {
    console.error('HuggingFace 上传错误:', error);
    return { success: false, error: error.message };
  }
}

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
      url: `https://huggingface.co/datasets/${repo}/resolve/main/${f.rfilename}`,
      source: 'huggingface',
      folder: f.rfilename.split('/')[0] || ''
    }));
    return { success: true, files: formatted, total: formatted.length };
  } catch (error) {
    console.error('HuggingFace 列表错误:', error);
    return { success: false, error: error.message, files: [] };
  }
}
