cat > src/index.js << 'EOF'
export default {
  async fetch(request, env) {
    // 尝试读取环境变量
    const token = env.GITHUB_TOKEN || '未设置'
    const user = env.GITHUB_USER || '未设置'
    const repo = env.GITHUB_REPO || '未设置'
    
    // 返回 JSON 响应
    return new Response(JSON.stringify({
      status: 'Worker is running!',
      env: { user, repo, tokenExists: !!token },
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
EOF
