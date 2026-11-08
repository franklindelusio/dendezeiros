import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, sanitizeParams, EVENTS } from '../src/js/tracking.js';

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), clear: () => m.clear() };
}
let calls;
beforeEach(() => {
  calls = [];
  globalThis.window = { fbq: (...a) => calls.push(a) }; // fbq simulado (sem rede)
  globalThis.localStorage = memStore();
  globalThis.sessionStorage = memStore();
});
const PIXEL = '840355202407276';
const make = (extra = {}) => createTracker({ pixelId: PIXEL, requireConsent: true, baseParams: { video_id: 'g8UmuXhZ55Y' }, ...extra });
const names = () => calls.map((c) => c.slice(0, 2).join(':'));

test('sem consentimento: nada vai ao Pixel', () => {
  const t = make();
  assert.equal(t.needsConsentPrompt, true);
  t.event(EVENTS.VIDEO_START);
  assert.equal(calls.length, 0);
});

test('aceite: autoConfig desligado, init, PageView e eventos pendentes, nesta ordem', () => {
  const t = make();
  t.event(EVENTS.VIDEO_START);
  t.event(EVENTS.VIDEO_ENGAGED_30S, { watched_seconds: 30 });
  t.setConsent('granted');
  assert.deepEqual(calls[0], ['set', 'autoConfig', false, PIXEL]);
  assert.deepEqual(names().slice(1), [`init:${PIXEL}`, 'track:PageView', 'trackCustom:VideoStart', 'trackCustom:VideoEngaged30s']);
});

test('recusa: pendentes descartados e nada enviado depois', () => {
  const t = make();
  t.event(EVENTS.VIDEO_START);
  t.setConsent('denied');
  t.event(EVENTS.CONTACT, { placement: 'primary' }, { once: false });
  assert.equal(calls.length, 0);
  assert.equal(t.needsConsentPrompt, false);
});

test('consentimento lembrado: PageView ao carregar', () => {
  localStorage.setItem('dz_consent_v1', 'granted');
  make();
  assert.deepEqual(names().slice(1), [`init:${PIXEL}`, 'track:PageView']);
});

test('Contact é evento padrão (track) e VideoEngaged30s é personalizado e único', () => {
  localStorage.setItem('dz_consent_v1', 'granted');
  const t = make();
  calls.length = 0;
  t.event(EVENTS.CONTACT, { placement: 'primary', content_name: 'Dendezeiros Vila Comercial' }, { once: false });
  t.event(EVENTS.VIDEO_ENGAGED_30S);
  t.event(EVENTS.VIDEO_ENGAGED_30S);
  assert.deepEqual(names(), ['track:Contact', 'trackCustom:VideoEngaged30s']);
  assert.equal(calls[0][2].placement, 'primary');
});

test('PageView não se repete ao reaceitar', () => {
  const t = make();
  t.setConsent('granted');
  t.setConsent('denied');
  t.setConsent('granted');
  assert.equal(names().filter((n) => n === 'track:PageView').length, 1);
  assert.deepEqual(calls.filter((c) => c[0] === 'consent').map((c) => c[1]), ['revoke', 'grant']);
});

test('sem Pixel ID: nenhuma chamada e nenhum pedido de consentimento', () => {
  const t = make({ pixelId: '' });
  t.event(EVENTS.CONTACT, {}, { once: false });
  t.setConsent('granted');
  assert.equal(calls.length, 0);
  assert.equal(t.needsConsentPrompt, false);
});

test('parâmetros: só chaves permitidas, sem e-mail/telefone', () => {
  const p = sanitizeParams({
    placement: 'primary', watched_seconds: 30, cta_unlocked: true,
    email: 'a@b.com', phone: '71999999999', name: 'Fulano',
    utm_content: 'contato@fulano.com', utm_term: '+55 71 99609-5022', utm_campaign: 'lancamento',
  });
  assert.deepEqual(p, { placement: 'primary', cta_unlocked: true, watched_seconds: 30, utm_campaign: 'lancamento' });
});
