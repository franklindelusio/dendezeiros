/**
 * Contabiliza o tempo EFETIVAMENTE assistido de um vídeo.
 *
 * Recebe amostras periódicas da posição do player (currentTime) e:
 *  - só conta enquanto o vídeo está reproduzindo;
 *  - ignora saltos para frente (busca/arraste) maiores que `maxStep`;
 *  - não conta duas vezes trechos já assistidos (retrocesso + replay);
 *  - não depende do tempo de permanência na página.
 *
 * O vídeo é dividido em blocos de 1/RES segundo; cada bloco percorrido
 * em reprodução normal entra num conjunto (sem duplicidade).
 */
const RES = 4; // blocos de 0,25 s

export class WatchTracker {
  constructor({ maxStep = 1.6 } = {}) {
    this.maxStep = maxStep;
    this.buckets = new Set();
    this.last = null;
  }

  /** @param {number} t posição atual (s)  @param {boolean} playing */
  sample(t, playing) {
    if (!playing || typeof t !== 'number' || !Number.isFinite(t) || t < 0) {
      this.last = null; // pausa/buffer: a próxima amostra recomeça a partir dela
      return;
    }
    if (this.last !== null) {
      const delta = t - this.last;
      if (delta > 0 && delta <= this.maxStep) {
        const from = Math.floor(this.last * RES);
        const to = Math.floor(t * RES);
        for (let b = from; b < to; b++) this.buckets.add(b);
      }
      // delta <= 0 (retrocesso) ou > maxStep (salto): não conta nada.
    }
    this.last = t;
  }

  /** Reinicia a referência sem perder o que já foi assistido (ex.: fim do vídeo). */
  break() { this.last = null; }

  get watchedSeconds() { return this.buckets.size / RES; }

  /** Fração (0–1) do vídeo coberta, dado o total em segundos. */
  coverage(duration) {
    if (!duration || !Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(1, this.watchedSeconds / duration);
  }
}
