import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WatchTracker } from '../src/js/watch-tracker.js';
import { buildWhatsAppUrl, campaignRef } from '../src/js/whatsapp.js';
import { resolveCtaRule, isUnlocked } from '../src/js/cta-rule.js';
import config from '../site.config.js';

/** Simula reprodução normal de `from` até `to` com amostras a cada 0,25 s. */
function play(t, from, to) {
  for (let x = from; x <= to + 1e-9; x += 0.25) t.sample(x, true);
}

test('conta apenas reprodução contínua', () => {
  const t = new WatchTracker();
  play(t, 0, 10);
  assert.equal(t.watchedSeconds, 10);
});

test('pausa congela a contagem e retomada continua', () => {
  const t = new WatchTracker();
  play(t, 0, 5);
  t.sample(5, false); // pausado
  t.sample(5, false);
  play(t, 5, 8);
  assert.equal(t.watchedSeconds, 8);
});

test('retroceder e rever não conta duas vezes', () => {
  const t = new WatchTracker();
  play(t, 0, 20);
  t.sample(5, true); // volta para 5 s
  play(t, 5, 20);
  assert.equal(t.watchedSeconds, 20);
});

test('avançar (arrastar) não conta o trecho pulado', () => {
  const t = new WatchTracker();
  play(t, 0, 5);
  t.sample(40, true); // salto
  play(t, 40, 45);
  assert.equal(t.watchedSeconds, 10);
});

test('tempo parado na página não conta', () => {
  const t = new WatchTracker();
  for (let i = 0; i < 200; i++) t.sample(0, true); // player travado em 0
  t.sample(NaN, true);
  assert.equal(t.watchedSeconds, 0);
});

test('cobertura percentual', () => {
  const t = new WatchTracker();
  play(t, 0, 30);
  assert.equal(t.coverage(60), 0.5);
  assert.equal(t.coverage(0), 0);
});

test('regra padrão: 30 s', () => {
  const rule = resolveCtaRule(config.cta, '');
  assert.deepEqual([rule.mode, rule.seconds], ['seconds', 30]);
  assert.equal(isUnlocked(rule, { watched: 29.75, coverage: 0.3, duration: 90 }), false);
  assert.equal(isUnlocked(rule, { watched: 30, coverage: 0.33, duration: 90 }), true);
});

test('vídeo menor que o limite libera perto do fim', () => {
  const rule = resolveCtaRule(config.cta, '');
  assert.equal(isUnlocked(rule, { watched: 18, coverage: 0.9, duration: 20 }), true);
});

test('overrides por URL (A/B)', () => {
  assert.equal(resolveCtaRule(config.cta, '?cta=immediate').mode, 'immediate');
  assert.deepEqual(resolveCtaRule(config.cta, '?cta=seconds:15'), { mode: 'seconds', seconds: 15, percent: config.cta.percent });
  const p = resolveCtaRule(config.cta, '?cta=percent:60');
  assert.equal(isUnlocked(p, { watched: 50, coverage: 0.59, duration: 85 }), false);
  assert.equal(isUnlocked(p, { watched: 51, coverage: 0.6, duration: 85 }), true);
  assert.equal(resolveCtaRule({ ...config.cta, allowUrlOverride: false }, '?cta=immediate').mode, 'seconds');
  assert.equal(resolveCtaRule(config.cta, '?cta=lixo').mode, 'seconds');
});

test('URL do WhatsApp com mensagem codificada', () => {
  const url = buildWhatsAppUrl(config.whatsapp);
  assert.ok(url.startsWith('https://wa.me/5571996095022?text='));
  const msg = decodeURIComponent(url.split('text=')[1]);
  assert.equal(msg, config.whatsapp.message);
});

test('referência de campanha curta e legível', () => {
  const utm = { utm_source: 'instagram', utm_campaign: 'Lançamento Nov/26', utm_content: 'video_maquete_01' };
  assert.equal(campaignRef(utm), 'lancamento-nov-26/video_maquete_01');
  const url = buildWhatsAppUrl(config.whatsapp, utm);
  assert.match(decodeURIComponent(url.split('text=')[1]), /\n\nRef: lancamento-nov-26\/video_maquete_01$/);
  assert.equal(campaignRef({}), '');
  assert.equal(campaignRef({ utm_source: 'facebook' }), 'facebook');
});
