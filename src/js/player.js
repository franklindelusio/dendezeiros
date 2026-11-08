/**
 * Player do YouTube (IFrame Player API) + controle acessível.
 * Não esconde marca/controles do YouTube; o botão abaixo do vídeo
 * apenas chama a API oficial (play, ativar som, pausar).
 */
import { WatchTracker } from './watch-tracker.js';

const API_SRC = 'https://www.youtube.com/iframe_api';
const POLL_MS = 250;

export function loadYouTubeApi(timeoutMs, onSlow) {
  return new Promise((resolve, reject) => {
    if (window.YT && typeof window.YT.Player === 'function') return resolve(window.YT);
    // Demora: avisa (para liberar o WhatsApp), mas continua aguardando a API.
    const timer = setTimeout(() => onSlow && onSlow(), timeoutMs);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = API_SRC;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error('api-load-failed')); };
    document.head.appendChild(s);
  });
}

/**
 * @param {object} o
 * @param {(info:{watched:number, coverage:number, duration:number}) => void} o.onProgress
 * @param {() => void} o.onStart       primeira reprodução
 * @param {() => void} o.onComplete    fim do vídeo
 * @param {(reason:string, fatal:boolean) => void} o.onFailure
 */
export function setupVideo(o) {
  const frame = document.getElementById('player-frame');
  const fallback = document.getElementById('player-fallback');
  const btn = document.getElementById('player-btn');
  const btnLabel = btn.querySelector('.player-btn-label');
  const tracker = new WatchTracker();

  let player = null;
  let ready = false;
  let started = false;
  let pollTimer = null;
  let failed = false;

  const setFrame = (s) => { frame.dataset.state = s; };

  function fail(reason, fatal) {
    if (fatal) {
      setFrame('error');
      fallback.hidden = false;
      btn.hidden = true;
      stopPolling();
    }
    if (!failed || fatal) o.onFailure(reason, fatal);
    failed = true;
  }

  function call(method, ...args) {
    try { return player && typeof player[method] === 'function' ? player[method](...args) : undefined; }
    catch { return undefined; }
  }

  function isPlaying() { return call('getPlayerState') === 1; }

  function updateButton() {
    if (!ready) return;
    let action, label;
    if (!isPlaying()) {
      action = 'play';
      label = started ? 'Continuar apresentação' : 'Assistir apresentação';
    } else if (call('isMuted')) {
      action = 'unmute';
      label = 'Ativar som';
    } else {
      action = 'pause';
      label = 'Pausar';
    }
    if (btn.dataset.action !== action) {
      btn.dataset.action = action;
      btnLabel.textContent = label;
    } else if (btnLabel.textContent !== label) {
      btnLabel.textContent = label;
    }
    btn.hidden = false;
  }

  function sample() {
    const t = call('getCurrentTime');
    tracker.sample(typeof t === 'number' ? t : NaN, true);
    const duration = Number(call('getDuration')) || 0;
    o.onProgress({ watched: tracker.watchedSeconds, coverage: tracker.coverage(duration), duration });
    updateButton();
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => { try { sample(); } catch (e) { fail('poll-error', false); } }, POLL_MS);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function onStateChange(e) {
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) {
      if (!started) { started = true; o.onStart(); }
      setFrame('playing');
      sample();
      startPolling();
    } else {
      // pausa, buffer, fim: conta o último trecho e congela a contagem
      if (pollTimer) sample();
      stopPolling();
      tracker.break();
      if (e.data === S.ENDED) o.onComplete();
      if (ready) setFrame('ready');
    }
    updateButton();
  }

  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'play') {
      call('unMute');
      call('setVolume', 100);
      call('playVideo');
      // Alguns navegadores (ex.: iOS) recusam iniciar com som fora do iframe.
      // Nesse caso, tenta sem som — o botão passa a oferecer "Ativar som".
      setTimeout(() => {
        if (!isPlaying() && call('getPlayerState') !== 3) { call('mute'); call('playVideo'); }
        updateButton();
      }, 1500);
    } else if (action === 'unmute') {
      call('unMute');
      call('setVolume', 100);
    } else if (action === 'pause') {
      call('pauseVideo');
    }
    setTimeout(updateButton, 200);
  });

  loadYouTubeApi(o.timeoutMs, () => {
    if (ready) return;
    fallback.hidden = false;
    o.onFailure('api-timeout', false);
    failed = true;
  })
    .then((YT) => {
      player = new YT.Player('yt-player', {
        videoId: o.videoId,
        host: o.host,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: o.autoplayMuted ? 1 : 0,
          mute: o.autoplayMuted ? 1 : 0,
          playsinline: 1,
          rel: 0,
          controls: 1,
          origin: location.origin,
        },
        events: {
          onReady: () => {
            ready = true;
            if (frame.dataset.state !== 'error') fallback.hidden = true;
            setFrame('ready');
            const iframe = call('getIframe');
            if (iframe) iframe.title = o.title;
            if (o.autoplayMuted) {
              call('mute');
              call('playVideo');
            }
            updateButton();
          },
          onStateChange,
          onError: (e) => fail(`player-error-${e && e.data}`, true),
        },
      });
    })
    .catch((err) => fail((err && err.message) || 'api-error', true));

  return { tracker };
}
