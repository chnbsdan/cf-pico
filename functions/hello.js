# 创建 functions/api/ 目录
mkdir -p functions/api

# 创建 hello.js 文件
cat > functions/api/hello.js << 'EOF'
export async function onRequest(context) {
  return new Response(JSON.stringify({
    message: "Hello from Cloudflare!",
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
EOF
