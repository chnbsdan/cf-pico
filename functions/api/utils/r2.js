// functions/api/utils/r2.js - R2 元数据操作

export async function saveChunkSession(bucket, uploadId, data) {
  if (!bucket) return false
  const key = `chunk_sessions/${uploadId}.json`
  try {
    await bucket.put(key, JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    })
    return true
  } catch (e) {
    console.error('保存分片会话失败:', e)
    return false
  }
}

export async function getChunkSession(bucket, uploadId) {
  if (!bucket) return null
  const key = `chunk_sessions/${uploadId}.json`
  try {
    const object = await bucket.get(key)
    if (!object) return null
    const content = await object.text()
    return JSON.parse(content)
  } catch (e) {
    console.error('获取分片会话失败:', e)
    return null
  }
}

export async function deleteChunkSession(bucket, uploadId) {
  if (!bucket) return false
  const key = `chunk_sessions/${uploadId}.json`
  try {
    await bucket.delete(key)
    return true
  } catch (e) {
    console.error('删除分片会话失败:', e)
    return false
  }
}

export async function saveCompletedFile(bucket, fileId, metadata) {
  if (!bucket) return false
  const key = `completed_files/${fileId}.json`
  try {
    await bucket.put(key, JSON.stringify(metadata, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    })
    return true
  } catch (e) {
    console.error('保存文件元数据失败:', e)
    return false
  }
}

export async function getCompletedFile(bucket, fileId) {
  if (!bucket) return null
  const key = `completed_files/${fileId}.json`
  try {
    const object = await bucket.get(key)
    if (!object) return null
    const content = await object.text()
    return JSON.parse(content)
  } catch (e) {
    console.error('获取文件元数据失败:', e)
    return null
  }
}

export async function deleteCompletedFile(bucket, fileId) {
  if (!bucket) return false
  const key = `completed_files/${fileId}.json`
  try {
    await bucket.delete(key)
    return true
  } catch (e) {
    console.error('删除文件元数据失败:', e)
    return false
  }
}