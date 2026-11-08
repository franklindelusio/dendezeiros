#!/usr/bin/env node
/**
 * Publicação no Cloudflare Pages via Wrangler.
 *
 *   npm run deploy:check   → testes + build + verifica login e projeto (NÃO publica)
 *   npm run deploy         → o mesmo e, se tudo passar, publica
 *
 * Credenciais: `npx wrangler login` (OAuth, abre o navegador) OU as variáveis
 * CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID. Nada é gravado no projeto.
 * O Pixel ID, se houver, vem de META_PIXEL_ID no momento do build.
 */
import { spawnSync } from 'node:child_process';

const PROJECT = 'dendezeiros';
const BRANCH = 'main';
const checkOnly = process.argv.includes('--check');
const WRANGLER = ['--yes', 'wrangler@4'];

function run(cmd, args, { capture = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}
const wrangler = (args, opts) => run('npx', [...WRANGLER, ...args], opts);
function step(msg) { console.log(`\n▸ ${msg}`); }
function stop(msg) { console.error(`\n✗ ${msg}`); process.exit(1); }

step('Testes');
if (!run('npm', ['test']).ok) stop('Testes falharam — nada foi publicado.');

step('Build');
if (!run('npm', ['run', 'build']).ok) stop('Build falhou — nada foi publicado.');

step('Autenticação Cloudflare');
const who = wrangler(['whoami'], { capture: true });
if (!who.ok || /not authenticated|You are not/i.test(who.out)) {
  stop('Sem login na Cloudflare. Rode `npx wrangler login` (OAuth no navegador) ou defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID.');
}
const email = (who.out.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0];
console.log(`  conectado${email ? ` como ${email}` : ''}`);

step(`Projeto Pages "${PROJECT}"`);
const list = wrangler(['pages', 'project', 'list'], { capture: true });
if (!list.ok) stop(`Não foi possível listar projetos:\n${list.out}`);
const exists = new RegExp(`\\b${PROJECT}\\b`).test(list.out);
if (exists) {
  console.log('  já existe');
} else if (checkOnly) {
  console.log('  ainda não existe — será criado na primeira publicação (npm run deploy)');
} else {
  const c = wrangler(['pages', 'project', 'create', PROJECT, '--production-branch', BRANCH], { capture: true });
  if (!c.ok) stop(`Falha ao criar o projeto:\n${c.out}`);
  console.log('  criado');
}

if (checkOnly) {
  console.log('\n✓ Integração verificada. Nada foi publicado. Para publicar: npm run deploy');
  process.exit(0);
}

step('Publicando');
const dep = wrangler(['pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', BRANCH, '--commit-dirty=true'], { capture: true });
process.stdout.write(dep.out);
if (!dep.ok) stop('Publicação falhou.');
const urls = dep.out.match(/https:\/\/[\w.-]+\.pages\.dev\S*/g) || [];
console.log(`\n✓ Publicado: https://${PROJECT}.pages.dev${urls.length ? `  (esta versão: ${urls[urls.length - 1]})` : ''}`);
