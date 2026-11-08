/* Simulação da YouTube IFrame API para testes automatizados (não vai para produção).
 * Opções via window.__ytMock = { autoplayAllowed, duration, failWithError } */
(function () {
  var opts = window.__ytMock || {};
  var duration = opts.duration || 90;
  var S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
  window.__ytLog = [];
  // Simula "gesto do usuário": clique real na página no último segundo.
  var lastClick = -1e9;
  document.addEventListener('click', function () { lastClick = Date.now(); }, true);
  function hasGesture() { return Date.now() - lastClick < 1000; }

  function Player(id, cfg) {
    var self = this;
    var mount = document.getElementById(id);
    var iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.className = mount.className;
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.src = 'about:blank';
    iframe.style.background = 'repeating-linear-gradient(160deg,#1b3f35 0 40px,#21483d 40px 80px)';
    mount.replaceWith(iframe);
    this._iframe = iframe;
    this._t = 0; this._state = S.UNSTARTED; this._muted = !!(cfg.playerVars && cfg.playerVars.mute);
    this._cfg = cfg; this._timer = null;
    window.__ytPlayer = this;
    window.__ytLog.push({ host: cfg.host, vars: cfg.playerVars, videoId: cfg.videoId });
    setTimeout(function () {
      if (opts.failWithError) { cfg.events.onError && cfg.events.onError({ data: 150 }); return; }
      cfg.events.onReady && cfg.events.onReady({ target: self });
    }, 50);
  }
  Player.prototype._set = function (s) { this._state = s; this._cfg.events.onStateChange && this._cfg.events.onStateChange({ data: s, target: this }); };
  Player.prototype.playVideo = function () {
    var gesture = hasGesture();
    if (!opts.autoplayAllowed && !gesture) return; // autoplay bloqueado
    if (!this._muted && !gesture) return;
    if (this._state === S.PLAYING) return;
    var self = this;
    this._set(S.PLAYING);
    this._timer = setInterval(function () {
      self._t = Math.min(duration, self._t + 0.25);
      if (self._t >= duration) { clearInterval(self._timer); self._timer = null; self._set(S.ENDED); }
    }, 250);
  };
  Player.prototype.pauseVideo = function () { clearInterval(this._timer); this._timer = null; this._set(S.PAUSED); };
  Player.prototype.seekTo = function (t) { this._t = t; };
  Player.prototype.mute = function () { this._muted = true; };
  Player.prototype.unMute = function () { this._muted = false; };
  Player.prototype.isMuted = function () { return this._muted; };
  Player.prototype.setVolume = function () {};
  Player.prototype.getPlayerState = function () { return this._state; };
  Player.prototype.getCurrentTime = function () { return this._t; };
  Player.prototype.getDuration = function () { return duration; };
  Player.prototype.getIframe = function () { return this._iframe; };

  window.YT = { Player: Player, PlayerState: S };
  setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 30);
})();
