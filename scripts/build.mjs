#!/usr/bin/env node
/**
 * Build sem dependências: gera /dist pronto para o Cloudflare Pages.
 *  - insere os textos de site.config.js no HTML (com escape);
 *  - aplica META_PIXEL_ID (variável de ambiente) se definida;
 *  - copia CSS/JS/arquivos públicos e versiona os links (cache).
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildWhatsAppUrl } from '../src/js/whatsapp.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'dist');

const esc = (v) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

export async function build({ quiet = false } = {}) {
  const cfgUrl = pathToFileURL(join(root, 'site.config.js')).href + `?t=${Date.now()}`;
  const config = structuredClone((await import(cfgUrl)).default);

  // Pixel: variável de ambiente tem prioridade
  const envPixel = (process.env.META_PIXEL_ID || '').trim();
  if (envPixel) config.tracking.metaPixelId = envPixel;
  const pixel = String(config.tracking.metaPixelId || '').trim();
  if (pixel && !/^\d{6,20}$/.test(pixel)) {
    throw new Error(`META_PIXEL_ID inválido ("${pixel}"): use apenas os dígitos do ID do Pixel.`);
  }
  config.tracking.metaPixelId = pixel;

  const css = minifyCss(await readFile(join(src, 'style.css'), 'utf8'));
  const jsDir = join(src, 'js');
  const jsFiles = (await readdir(jsDir)).filter((f) => f.endsWith('.js'));
  const configModule = `/* gerado por scripts/build.mjs — edite site.config.js */\nexport default ${JSON.stringify(config, null, 2)};\n`;

  const hash = createHash('sha256');
  hash.update(css).update(configModule);
  for (const f of jsFiles.sort()) hash.update(await readFile(join(jsDir, f)));
  const buildHash = hash.digest('hex').slice(0, 10);

  const hasVideo = Boolean(String(config.video.youtubeId || '').trim());
  const ytHost = config.video.privacyEnhanced ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  const waIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.9 3 3 6.6 3 11.2c0 2.3 1 4.4 2.7 5.9L5 21l4.1-1.9c.9.3 1.9.4 2.9.4 5.1 0 9-3.6 9-8.3S17.1 3 12 3Zm0 15c-.9 0-1.8-.1-2.6-.4l-.4-.1-2 .9.4-1.9-.3-.3C5.8 15 5 13.2 5 11.2 5 7.8 8.1 5 12 5s7 2.8 7 6.2-3.1 6.8-7 6.8Z"/></svg>';

  const storesHtml = (config.stores || []).map((st) => `
        <li class="card">
          <div class="card-img"><img src="${esc(st.image)}" alt="" width="900" height="700" loading="lazy">${st.tag ? `<span class="card-tag">${esc(st.tag)}</span>` : ''}</div>
          <div class="card-body">
            <h3>${esc(st.name)}</h3>
            <p class="card-area">${esc(st.area)}</p>
            <p class="card-detail">${esc(st.detail)}</p>
            ${st.price ? `<p class="card-price">${esc(st.price)}</p>` : ''}
          </div>
        </li>`).join('');
  const highlightsHtml = (config.highlights || []).map((h) => `<li>${esc(h)}</li>`).join('');

  const derived = {
    build: { hash: buildHash },
    whatsapp: { href: buildWhatsAppUrl(config.whatsapp) },
    icon: { whatsapp: waIcon },
    storesHtml,
    highlightsHtml,
    video: {
      initialState: hasVideo ? 'loading' : 'soon',
      preconnect: hasVideo ? `<link rel="preconnect" href="${ytHost}">\n  <link rel="preconnect" href="https://www.youtube.com">` : '',
      poster: hasVideo ? '' : `<div class="player-soon"><img src="${esc(config.media.vila)}" alt="" width="2000" height="699"><span>${esc(config.copy.videoSoon)}</span></div>`,
    },
  };
  const RAW = new Set(['icon.whatsapp', 'storesHtml', 'highlightsHtml', 'video.preconnect', 'video.poster']);

  let html = await readFile(join(src, 'index.html'), 'utf8');
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    let v = get(derived, key);
    if (v === undefined) v = get(config, key);
    if (v === undefined) throw new Error(`Token sem valor no HTML: ${m}`);
    return RAW.has(key) ? String(v) : esc(v);
  });

  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'assets', 'js'), { recursive: true });
  await cp(join(root, 'public'), out, { recursive: true });
  await writeFile(join(out, 'index.html'), html);
  await writeFile(join(out, 'assets', 'style.css'), css);
  await writeFile(join(out, 'assets', 'site.config.js'), configModule);
  for (const f of jsFiles) await cp(join(jsDir, f), join(out, 'assets', 'js', f));

  if (!quiet) {
    console.log(`✓ dist gerado (build ${buildHash})`);
    console.log(`  CTA: ${config.cta.mode}${config.cta.mode === 'seconds' ? ` (${config.cta.seconds}s)` : config.cta.mode === 'percent' ? ` (${config.cta.percent}%)` : ''}`);
    console.log(`  Meta Pixel: ${pixel ? pixel : 'não configurado (defina META_PIXEL_ID)'}`);
  }
  return { config, buildHash };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error('✗ Falha no build:', err.message); process.exit(1); });
}
