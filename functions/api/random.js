// functions/api/random.js - GET /api/random
import { getFolderImages } from './utils/github.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  const token = env.GITHUB_TOKEN;
  
  const folders = ['wallpaper', 'cover', 'sh', 'sd'];
  let allImages = [];
  
  for (const folder of folders) {
    const images = await getFolderImages(folder, token);
    allImages = allImages.concat(images.map(f => ({ ...f, folder })));
  }
  
  if (allImages.length === 0) {
    return new Response('No images found', { status: 404 });
  }
  
  const random = allImages[Math.floor(Math.random() * allImages.length)];
  const baseUrl = new URL(request.url).origin;
  const imageUrl = `${baseUrl}/api/image?path=${random.folder}/${random.name}`;
  
  if (format === 'json') {
    const result = {
      code: 200,
      imgurl: imageUrl,
      total: allImages.length
    };
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  const response = await fetch(random.download_url);
  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  });
}