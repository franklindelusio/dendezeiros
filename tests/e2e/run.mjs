/**
 * Testes de navegador (opcional): `npm i -D playwright && npx playwright install chromium`
 * e depois `node tests/e2e/run.mjs`. O YouTube e o Meta Pixel são simulados
 * localmente, para testar a lógica sem depender da rede.
 * Capturas de tela vão para tests/e2e/screens/.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const shots = join(here, 'screens');
await mkdir(shots, { recursive: true });
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const ytMock = await readFile(join(here, 'yt-mock.js'), 'utf8');

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };

function startServer(env = {}) {
  const p = spawn(process.execPath, [join(root, 'scripts', 'dev.mjs'), '--preview'], { env: { ...process.env, PORT: String(PORT), ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((res) => p.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) res(p); }));
}

const browser = await chromium.launch();

async function newPage(device, { yt = 'mock', ytOpts = {}, fb = 'mock' } = {}) {
  const ctx = await browser.newContext({ ...device, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((o) => { window.__ytMock = o; }, ytOpts);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, (r) => {
    if (yt === 'mock' && r.request().url().includes('iframe_api')) return r.fulfill({ contentType: 'text/javascript', body: ytMock });
    return r.abort();
  });
  await page.route(/connect\.facebook\.net/, (r) => fb === 'mock'
    ? r.fulfill({ contentType: 'text/javascript', body: 'window.__fbCalls = (window.fbq.queue||[]).map(a=>Array.from(a)); window.fbq.callMethod = function(){ window.__fbCalls.push(Array.from(arguments)); };' })
    : r.abort());
  await page.route(/wa\.me|api\.whatsapp\.com/, (r) => r.fulfill({ body: 'whatsapp' }));
  await page.clock.install();
  return { ctx, page, errors };
}

const state = (page) => page.locator('#cta').getAttribute('data-state');
const events = (page) => page.evaluate(() => (window.dataLayer || []).map((e) => e.event));

let server = await startServer();

/* 1) iPhone: autoplay mudo, contagem, pausa, liberação */
{
  const { ctx, page, errors } = await newPage(devices['iPhone 13'], { ytOpts: { autoplayAllowed: true, duration: 90 } });
  await page.goto(BASE + '/?utm_source=instagram&utm_campaign=lancamento&utm_content=reels01');
  await page.clock.runFor(500);
  await page.screenshot({ path: join(shots, 'iphone-13.png') });
  const box = await page.locator('#player-frame').boundingBox();
  check('iPhone: player 9:16', Math.abs(box.width / box.height - 9 / 16) < 0.01, `${Math.round(box.width)}×${Math.round(box.height)}`);
  check('iPhone: vídeo cabe na largura', box.x >= 0 && box.x + box.width <= 390);
  check('iPhone: CTA bloqueado no início', (await state(page)) === 'locked' && !(await page.locator('#cta-primary').isVisible()) && (await page.locator('#cta-hint').isVisible()));
  const sec = await page.locator('#cta-secondary').getAttribute('href');
  check('Link secundário disponível desde o início', (await page.locator('#cta-secondary').isVisible()) && sec.startsWith('https://wa.me/5571996095022?text='));
  check('Mensagem inclui referência curta da campanha', decodeURIComponent(sec.split('text=')[1]).endsWith('Ref: lancamento/reels01'));
  check('Autoplay mudo iniciou', (await page.locator('#player-btn').getAttribute('data-action')) === 'unmute');
  const ytCfg = await page.evaluate(() => window.__ytLog[0]);
  check('Player usa youtube-nocookie + playsinline', ytCfg.host === 'https://www.youtube-nocookie.com' && ytCfg.vars.playsinline === 1 && ytCfg.videoId === '6G0EiI1_WBg');

  await page.clock.runFor(15000);
  check('15 s assistidos: ainda bloqueado', (await state(page)) === 'locked');
  check('15 s assistidos: VideoEngaged30s ainda não disparou', !(await events(page)).includes('VideoEngaged30s'));
  await page.click('#player-btn'); // ativar som
  await page.clock.runFor(300);
  check('Botão vira "Pausar" após ativar som', (await page.locator('#player-btn').getAttribute('data-action')) === 'pause');
  await page.click('#player-btn'); // pausar
  await page.clock.runFor(300);
  await page.clock.runFor(60000);
  check('Pausado por 60 s: continua bloqueado (não conta permanência)', (await state(page)) === 'locked');
  check('Pausado por 60 s: VideoEngaged30s não disparou (tempo na página não conta)', !(await events(page)).includes('VideoEngaged30s'));
  await page.click('#player-btn'); // continuar
  await page.clock.runFor(16000);
  check('30 s efetivos: botão liberado', (await state(page)) === 'unlocked' && (await page.locator('#cta-primary').isVisible()));
  check('Link secundário some após liberar', !(await page.locator('#cta-secondary').isVisible()));
  const ev = await events(page);
  check('Eventos VideoStart, VideoEngaged30s e VideoProgress25 registrados', ev.includes('VideoStart') && ev.includes('VideoEngaged30s') && ev.includes('VideoProgress25') && !ev.includes('VideoProgress50'), ev.join(', '));
  check('Botão liberado NÃO dispara Contact', !ev.includes('Contact'));
  await page.screenshot({ path: join(shots, 'iphone-13-liberado.png') });

  const [waReq] = await Promise.all([ctx.waitForEvent('request', (r) => r.url().includes('wa.me')), page.click('#cta-primary')]);
  const waUrl = waReq.url();
  check('Clique abre wa.me com mensagem pré-preenchida', waUrl.startsWith('https://wa.me/5571996095022?text=') && decodeURIComponent(waUrl.split('text=')[1]).startsWith('Olá! Vi a apresentação da Vila Comercial Dendezeiros'), waUrl.slice(0, 70));
  const click = await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'Contact'));
  check('Clique registra um Contact com placement e UTMs', click.length === 1 && click[0].placement === 'primary' && click[0].utm_source === 'instagram' && click[0].cta_rule === 'seconds_30');
  check('Nenhum Lead disparado', !(await events(page)).includes('Lead'));

  await page.clock.runFor(70000);
  const ev2 = await events(page);
  check('Progresso 50/75 e VideoComplete', ['VideoProgress50', 'VideoProgress75', 'VideoComplete'].every((e) => ev2.includes(e)));
  await page.evaluate(() => window.__ytPlayer.seekTo(0));
  await page.click('#player-btn').catch(() => {});
  await page.clock.runFor(40000);
  check('Rever o vídeo não repete VideoEngaged30s', (await events(page)).filter((e) => e === 'VideoEngaged30s').length === 1);
  check('iPhone: sem erros no console', errors.length === 0, errors.join(' | '));

  await page.reload();
  await page.clock.runFor(300);
  check('Volta na mesma sessão: botão continua liberado', (await state(page)) === 'unlocked');
  await ctx.close();
}

/* 2) Android: autoplay bloqueado → ação explícita de reprodução */
{
  const { ctx, page, errors } = await newPage(devices['Pixel 7'], { ytOpts: { autoplayAllowed: false } });
  await page.goto(BASE + '/');
  await page.clock.runFor(4000);
  await page.screenshot({ path: join(shots, 'android-pixel7.png') });
  const btn = page.locator('#player-btn');
  check('Android: autoplay bloqueado mostra "Assistir apresentação"', (await btn.isVisible()) && (await btn.getAttribute('data-action')) === 'play' && (await btn.innerText()).includes('Assistir'));
  await page.clock.runFor(40000);
  check('Android: sem reprodução, CTA não libera por tempo na página', (await state(page)) === 'locked');
  await btn.click();
  await page.clock.runFor(31000);
  check('Android: após play manual e 30 s, libera', (await state(page)) === 'unlocked');
  check('Android: sem erros no console', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* 3) API do YouTube indisponível → WhatsApp liberado */
{
  const { ctx, page } = await newPage(devices['iPhone SE'], { yt: 'blocked' });
  await page.goto(BASE + '/');
  await page.clock.runFor(1000);
  check('Falha da API: CTA liberado e aviso do vídeo exibido', (await state(page)) === 'unlocked' && (await page.locator('#player-fallback').isVisible()));
  await page.screenshot({ path: join(shots, 'falha-video.png') });
  await ctx.close();
}

/* 4) Vídeo indisponível (erro do player) */
{
  const { ctx, page } = await newPage(devices['iPhone SE'], { ytOpts: { failWithError: true } });
  await page.goto(BASE + '/');
  await page.clock.runFor(500);
  check('Erro do player: CTA liberado', (await state(page)) === 'unlocked');
  await ctx.close();
}

/* 5) Teste A/B por URL */
{
  const { ctx, page } = await newPage(devices['iPhone 13'], { ytOpts: { autoplayAllowed: true } });
  await page.goto(BASE + '/?cta=immediate');
  await page.clock.runFor(200);
  check('?cta=immediate libera de imediato', (await state(page)) === 'unlocked');
  await page.goto(BASE + '/?cta=percent:50');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.clock.runFor(40000);
  const s1 = await state(page);
  await page.clock.runFor(6000);
  check('?cta=percent:50 libera só após 45 s de 90 s', s1 === 'locked' && (await state(page)) === 'unlocked');
  await ctx.close();
}

/* 6) Desktop e tablet: layout */
for (const [name, vp] of [['desktop-1440', { width: 1440, height: 900 }], ['desktop-1280', { width: 1280, height: 720 }], ['tablet-ipad', devices['iPad (gen 7)']]]) {
  const dev = vp.viewport ? vp : { viewport: vp };
  const { ctx, page, errors } = await newPage(dev, { ytOpts: { autoplayAllowed: true } });
  await page.goto(BASE + '/');
  await page.clock.runFor(500);
  const v = await page.locator('#player-frame').boundingBox();
  const h = await page.locator('h1').boundingBox();
  const vw = dev.viewport.width;
  check(`${name}: 9:16 preservado`, Math.abs(v.width / v.height - 9 / 16) < 0.01, `${Math.round(v.width)}×${Math.round(v.height)}`);
  if (vw >= 920) check(`${name}: duas colunas (vídeo à direita do título)`, v.x > h.x + h.width - 1 && v.y + v.height <= dev.viewport.height);
  check(`${name}: sem rolagem horizontal`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check(`${name}: sem erros no console`, errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: join(shots, `${name}.png`) });
  await ctx.close();
}

/* 7) Meta Pixel + consentimento (LGPD) — ID real do site.config.js, Pixel simulado */
{
  const PIXEL = '840355202407276';
  const { ctx, page } = await newPage(devices['iPhone 13'], { ytOpts: { autoplayAllowed: true } });
  const fbRequests = [];
  page.on('request', (r) => { if (r.url().includes('facebook')) fbRequests.push(r.url()); });
  const fbNames = async () => (await page.evaluate(() => window.__fbCalls || [])).map((c) => c.slice(0, 2).join(':'));
  await page.goto(BASE + '/?utm_source=instagram&utm_campaign=lancamento');
  await page.clock.runFor(1500);
  check('Pixel: barra de consentimento visível', await page.locator('#consent').isVisible());
  await page.screenshot({ path: join(shots, 'consentimento.png') });
  await page.clock.runFor(31000); // assiste 30 s ANTES de responder à barra
  check('Pixel: nada carregado antes do consentimento', fbRequests.length === 0);
  check('Pixel: sem fbq antes do consentimento', await page.evaluate(() => typeof window.fbq === 'undefined'));
  await page.click('[data-consent="granted"]');
  await page.clock.runFor(500);
  let names = await fbNames();
  const calls = await page.evaluate(() => window.__fbCalls);
  check('Pixel: autoConfig desligado antes do init', JSON.stringify(calls[0]) === JSON.stringify(['set', 'autoConfig', false, PIXEL]));
  check('Pixel: init com o ID da Feira Imob, sem dados de correspondência', calls.some((c) => c[0] === 'init' && c[1] === PIXEL && c.length === 2));
  check('Pixel: PageView uma vez após aceitar', names.filter((n) => n === 'track:PageView').length === 1, names.join(', '));
  check('Pixel: VideoEngaged30s assistido antes do aceite é enviado após aceitar', names.filter((n) => n === 'trackCustom:VideoEngaged30s').length === 1);
  check('Pixel: um único script fbevents.js', (await page.locator('script[src*="fbevents.js"]').count()) === 1);
  check('Pixel: Contact não disparou ao liberar o botão', (await state(page)) === 'unlocked' && !names.includes('track:Contact'));
  await page.locator('#cta-primary').dblclick(); // duplo toque
  await page.clock.runFor(300);
  names = await fbNames();
  check('Pixel: clique no WhatsApp envia Contact uma única vez (duplo toque)', names.filter((n) => n === 'track:Contact').length === 1, names.join(', '));
  await page.clock.runFor(3000);
  await page.locator('#cta-primary').click();
  await page.clock.runFor(300);
  check('Pixel: novo clique depois envia outro Contact', (await fbNames()).filter((n) => n === 'track:Contact').length === 2);
  const contact = (await page.evaluate(() => window.__fbCalls)).find((c) => c[1] === 'Contact')[2];
  const allowed = ['content_name', 'placement', 'cta_rule', 'cta_unlocked', 'video_id', 'watched_seconds', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  check('Pixel: Contact só com parâmetros permitidos', Object.keys(contact).every((k) => allowed.includes(k)) && contact.placement === 'primary' && contact.utm_campaign === 'lancamento', JSON.stringify(contact));
  check('Pixel: nenhum Lead', !(await fbNames()).some((n) => n.includes('Lead')));
  await page.reload();
  await page.clock.runFor(300);
  check('Pixel: escolha lembrada (barra não reaparece) e PageView na nova visita', !(await page.locator('#consent').isVisible()) && (await fbNames()).includes('track:PageView'));
  await ctx.close();

  const d = await newPage(devices['iPhone 13'], { ytOpts: { autoplayAllowed: true, duration: 40 } });
  const req2 = [];
  d.page.on('request', (r) => { if (r.url().includes('facebook')) req2.push(r.url()); });
  await d.page.goto(BASE + '/');
  await d.page.clock.runFor(32000);
  await d.page.click('[data-consent="denied"]');
  await d.page.clock.runFor(10000);
  await d.page.locator('#cta-primary').click();
  await d.page.clock.runFor(300);
  check('Pixel recusado: nenhuma requisição ao Facebook, nem eventos anteriores', req2.length === 0 && (await d.page.evaluate(() => typeof window.fbq === 'undefined')));
  await d.ctx.close();
}

server.kill();
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
process.exit(failed.length ? 1 : 0);
