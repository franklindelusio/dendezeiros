#!/usr/bin/env node
/**
 * Servidor local: gera /dist, serve em http://localhost:5173 e
 * refaz o build quando algo em src/, public/ ou site.config.js muda
 * (recarregue a página no navegador).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT) || 5173;
const preview = process.argv.includes('--preview');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.ico': 'image/x-icon',
};

await build();

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(dist, path));
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, () => console.log(`→ http://localhost:${port}  (teste A/B: ?cta=immediate | ?cta=seconds:10 | ?cta=percent:50, logs: ?debug)`));

if (!preview) {
  let timer;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120); };
  for (const p of ['src', 'public']) watch(join(root, p), { recursive: true }, rebuild);
  watch(join(root, 'site.config.js'), rebuild);
}
