// Tiny static server for preview.html (ES modules need http://, not file://).
//   node tools/serve.mjs  → http://localhost:4173/preview.html
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.png': 'image/png', '.css': 'text/css' };

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(root, url === '/' ? 'preview.html' : url));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`preview → http://localhost:${port}/preview.html`));
