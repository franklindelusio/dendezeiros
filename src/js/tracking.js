/**
 * Rastreamento: Meta Pixel (somente com consentimento) + dataLayer.
 *
 * Eventos enviados ao Pixel:
 *   PageView         padrão  — ao carregar, se o visitante já consentiu; ou no aceite
 *   Contact          padrão  — SOMENTE no clique em um link do WhatsApp
 *   VideoStart       personalizado — primeira reprodução
 *   VideoEngaged30s  personalizado — 30 s de reprodução EFETIVA (uma vez por visualização)
 *   VideoProgress25/50/75, VideoComplete — personalizados, progresso do vídeo
 *
 * Nada de dados pessoais: os parâmetros passam por uma lista fixa de chaves
 * (sem nome, telefone, e-mail etc.), e a correspondência avançada automática
 * e os eventos automáticos de clique do Pixel ficam desligados.
 *
 * Eventos ocorridos antes da escolha de consentimento ficam apenas na memória
 * desta página: são enviados se o visitante aceitar, descartados se recusar.
 */
export const EVENTS = Object.freeze({
  CONTACT: 'Contact',
  VIDEO_START: 'VideoStart',
  VIDEO_ENGAGED_30S: 'VideoEngaged30s',
  VIDEO_25: 'VideoProgress25',
  VIDEO_50: 'VideoProgress50',
  VIDEO_75: 'VideoProgress75',
  VIDEO_COMPLETE: 'VideoComplete',
});

const STANDARD = new Set(['PageView', 'Contact']);
const CONSENT_KEY = 'dz_consent_v1';
const UTM_KEY = 'dz_utm';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/** Únicas chaves que podem ir para o Pixel. */
export const ALLOWED_PARAMS = Object.freeze([
  'content_name', 'placement', 'cta_rule', 'cta_unlocked', 'video_id', 'watched_seconds', ...UTM_FIELDS,
]);

/** Filtra os parâmetros: só chaves permitidas, valores curtos, sem padrões de e-mail/telefone. */
export function sanitizeParams(params = {}) {
  const out = {};
  for (const key of ALLOWED_PARAMS) {
    const v = params[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'number' || typeof v === 'boolean') { out[key] = v; continue; }
    const s = String(v).slice(0, 100);
    if (/@|\+?\d[\d\s().-]{7,}\d/.test(s)) continue; // parece e-mail ou telefone: descarta
    out[key] = s;
  }
  return out;
}

function safeGet(store, key) { try { return store.getItem(key); } catch { return null; } }
function safeSet(store, key, val) { try { store.setItem(key, val); } catch { /* storage indisponível */ } }

/** Lê UTMs da URL; se ausentes, recupera os da sessão (ex.: navegação interna). */
export function readUtm(search = location.search) {
  const params = new URLSearchParams(search);
  const fromUrl = {};
  for (const k of UTM_FIELDS) {
    const v = params.get(k);
    if (v) fromUrl[k] = v.slice(0, 100);
  }
  if (Object.keys(fromUrl).length) {
    safeSet(sessionStorage, UTM_KEY, JSON.stringify(fromUrl));
    return fromUrl;
  }
  try { return JSON.parse(safeGet(sessionStorage, UTM_KEY) || '{}'); } catch { return {}; }
}

export function createTracker({ pixelId, requireConsent, debug, baseParams = {} }) {
  let consent = requireConsent ? safeGet(localStorage, CONSENT_KEY) : 'granted';
  let pixelLoaded = false;
  const sentOnce = new Set();   // eventos "uma vez por visualização"
  const pending = [];           // eventos antes da decisão de consentimento
  const base = sanitizeParams(baseParams);
  window.dataLayer = window.dataLayer || [];

  const log = (...a) => { if (debug) console.info('[tracking]', ...a); };
  const decided = () => consent === 'granted' || consent === 'denied';

  function loadPixel() {
    if (pixelLoaded || !pixelId) return;
    pixelLoaded = true;
    // Snippet oficial do Meta Pixel; o próprio snippet impede carregamento duplicado.
    /* eslint-disable */
    if (!window.fbq) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script',PIXEL_SRC);
    }
    /* eslint-enable */
    // Sem eventos automáticos de clique/formulário (evita duplicar o Contact).
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('init', pixelId); // sem dados de correspondência avançada
    window.fbq('track', 'PageView', base);
    log('Pixel carregado', pixelId, '→ PageView', base);
  }

  function send(name, payload) {
    loadPixel();
    window.fbq(STANDARD.has(name) ? 'track' : 'trackCustom', name, payload);
    log('→ Pixel', name, payload);
  }

  /**
   * @param {string} name
   * @param {object} params
   * @param {{once?: boolean}} opts  once=true: no máximo uma vez por visualização da página
   */
  function event(name, params = {}, { once = true } = {}) {
    if (once) {
      if (sentOnce.has(name)) return false;
      sentOnce.add(name);
    }
    const payload = { ...base, ...sanitizeParams(params) };
    window.dataLayer.push({ event: name, ...payload });
    if (!pixelId) return true;
    if (consent === 'granted') send(name, payload);
    else if (!decided()) { pending.push([name, payload]); log('(aguardando consentimento)', name); }
    else log('(consentimento recusado — não enviado)', name);
    return true;
  }

  function setConsent(value) {
    if (value !== 'granted' && value !== 'denied') return;
    consent = value;
    safeSet(localStorage, CONSENT_KEY, value);
    if (value === 'granted') {
      if (pixelLoaded && window.fbq) window.fbq('consent', 'grant');
      loadPixel();
      while (pending.length) send(...pending.shift());
    } else {
      pending.length = 0;
      if (pixelLoaded && window.fbq) window.fbq('consent', 'revoke');
    }
    log('Consentimento:', value);
  }

  if (pixelId && consent === 'granted') loadPixel();

  return {
    event,
    setConsent,
    get consent() { return consent; },
    get needsConsentPrompt() { return Boolean(pixelId) && requireConsent && !decided(); },
    get pixelEnabled() { return Boolean(pixelId); },
  };
}
