export default {
  async fetch(request, env) {
    const token = env.GITHUB_TOKEN || '未设置'
    const user = env.GITHUB_USER || '未设置'
    const repo = env.GITHUB_REPO || '未设置'

    return new Response(JSON.stringify({
      user,
      repo,
      tokenExists: !!token
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
