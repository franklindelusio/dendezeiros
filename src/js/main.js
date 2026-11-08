import config from '../site.config.js';
import { setupVideo } from './player.js';
import { buildWhatsAppUrl } from './whatsapp.js';
import { createTracker, readUtm, EVENTS } from './tracking.js';
import { resolveCtaRule, ruleLabel, isUnlocked } from './cta-rule.js';

const UNLOCK_KEY = 'dz_cta_unlocked';
const ENGAGED_SECONDS = 30;
const params = new URLSearchParams(location.search);
const debug = params.has('debug');

function init() {
  const rule = resolveCtaRule(config.cta, location.search);
  const utm = readUtm();
  const waUrl = buildWhatsAppUrl(config.whatsapp, utm);

  const tracker = createTracker({
    pixelId: config.tracking.metaPixelId,
    requireConsent: config.tracking.requireConsent,
    debug,
    baseParams: { cta_rule: ruleLabel(rule), video_id: config.video.youtubeId, ...utm },
  });

  /* ---------- CTA ---------- */
  const cta = document.getElementById('cta');
  const live = document.getElementById('cta-live');
  let unlocked = false;

  function unlock(reason) {
    if (unlocked) return;
    unlocked = true;
    cta.dataset.state = 'unlocked';
    cta.dataset.reason = reason;
    if (reason !== 'immediate' && reason !== 'remembered') live.textContent = config.copy.unlockedAnnouncement;
    if (config.cta.rememberUnlock) { try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch { /* ok */ } }
    if (debug) console.info('[cta] liberado:', reason);
  }

  let rememberedUnlock = false;
  try { rememberedUnlock = config.cta.rememberUnlock && sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch { /* ok */ }
  const hasVideo = Boolean(String(config.video.youtubeId || '').trim());
  if (rule.mode === 'immediate' || !hasVideo) unlock('immediate');
  else if (rememberedUnlock) unlock('remembered');

  // Contact: somente no clique real em um link do WhatsApp (nunca ao liberar o botão).
  // Toques repetidos em sequência (duplo toque) contam uma vez só.
  let lastContactAt = -Infinity;
  document.querySelectorAll('a[data-placement]').forEach((a) => {
    a.href = waUrl; // inclui referência de campanha, se houver UTMs
    a.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastContactAt < 2000) return;
      lastContactAt = now;
      tracker.event(EVENTS.CONTACT, {
        content_name: config.project.name,
        placement: a.dataset.placement,
        cta_unlocked: unlocked,
      }, { once: false });
    });
  });

  /* ---------- vídeo ---------- */
  const milestones = [
    [0.25, EVENTS.VIDEO_25],
    [0.5, EVENTS.VIDEO_50],
    [0.75, EVENTS.VIDEO_75],
  ];

  if (hasVideo) setupVideo({
    videoId: config.video.youtubeId,
    host: config.video.privacyEnhanced ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com',
    autoplayMuted: config.video.autoplayMuted,
    timeoutMs: config.video.apiTimeoutMs,
    title: config.copy.videoLabel,
    onStart: () => tracker.event(EVENTS.VIDEO_START),
    onComplete: () => {
      tracker.event(EVENTS.VIDEO_COMPLETE);
      unlock('video-complete');
    },
    onProgress: (info) => {
      for (const [frac, name] of milestones) {
        if (info.coverage >= frac) tracker.event(name, { watched_seconds: Math.round(info.watched) });
      }
      // 30 s de reprodução efetiva (não é tempo na página), uma vez por visualização.
      if (info.watched >= ENGAGED_SECONDS) tracker.event(EVENTS.VIDEO_ENGAGED_30S, { watched_seconds: ENGAGED_SECONDS });
      if (!unlocked && isUnlocked(rule, info)) unlock(rule.mode);
    },
    onFailure: (reason) => {
      // Nunca bloqueia o visitante: se o vídeo falhar, o WhatsApp é liberado.
      unlock(`fallback:${reason}`);
    },
  });

  /* ---------- consentimento (LGPD) ---------- */
  const banner = document.getElementById('consent');
  const reopen = document.getElementById('consent-reopen');
  if (tracker.pixelEnabled) {
    reopen.hidden = false;
    const showBanner = (show) => {
      banner.hidden = !show;
      document.documentElement.classList.toggle('consent-open', show);
    };
    if (tracker.needsConsentPrompt) showBanner(true);
    banner.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-consent]');
      if (!btn) return;
      tracker.setConsent(btn.dataset.consent);
      showBanner(false);
    });
    reopen.addEventListener('click', () => {
      showBanner(true);
      banner.querySelector('[data-consent="granted"]').focus();
    });
  }
}

try {
  init();
  window.__lpReady = true;
} catch (err) {
  // Navegador incompatível ou erro inesperado: libera o contato.
  const cta = document.getElementById('cta');
  if (cta) cta.dataset.state = 'unlocked';
  window.__lpReady = true;
  console.warn('Falha na inicialização; contato liberado.', err);
}
