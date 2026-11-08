import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from '../scripts/build.mjs';

test('build gera HTML completo, sem tokens pendentes', async () => {
  delete process.env.META_PIXEL_ID;
  const { buildHash } = await build({ quiet: true });
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /\{\{|\}\}/);
  assert.match(html, /FALAR COM UM CORRETOR AGORA/);
  assert.match(html, /CRECI 20462/);
  assert.match(html, /https:\/\/wa\.me\/5571996095022\?text=Ol%C3%A1!/);
  assert.match(html, new RegExp(`main\\.js\\?v=${buildHash}`));
  assert.match(html, /Loja com mezanino/);
  assert.match(html, /A partir de R\$ 206\.640/);
  assert.match(html, /FALAR COM O CORRETOR/);
  const cfg = await readFile(new URL('../dist/assets/site.config.js', import.meta.url), 'utf8');
  assert.match(cfg, /"metaPixelId": "840355202407276"/);
});

test('META_PIXEL_ID do ambiente é aplicado e validado', async () => {
  process.env.META_PIXEL_ID = '123456789012345';
  await build({ quiet: true });
  const cfg = await readFile(new URL('../dist/assets/site.config.js', import.meta.url), 'utf8');
  assert.match(cfg, /"metaPixelId": "123456789012345"/);
  process.env.META_PIXEL_ID = 'abc';
  await assert.rejects(build({ quiet: true }), /META_PIXEL_ID inválido/);
  delete process.env.META_PIXEL_ID;
  await build({ quiet: true });
});
