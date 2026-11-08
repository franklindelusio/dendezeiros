/**
 * Regras de liberação do botão principal (testes A/B).
 */
export function resolveCtaRule(cfg, search) {
  const rule = { mode: cfg.mode, seconds: cfg.seconds, percent: cfg.percent };
  const raw = cfg.allowUrlOverride ? new URLSearchParams(search).get('cta') : null;
  if (raw) {
    const [mode, val] = raw.split(':');
    const n = Number(val);
    if (mode === 'immediate') rule.mode = 'immediate';
    else if (mode === 'seconds') { rule.mode = 'seconds'; if (n > 0) rule.seconds = n; }
    else if (mode === 'percent') { rule.mode = 'percent'; if (n > 0 && n <= 100) rule.percent = n; }
  }
  if (!['immediate', 'seconds', 'percent'].includes(rule.mode)) rule.mode = 'seconds';
  return rule;
}

export function ruleLabel(rule) {
  if (rule.mode === 'immediate') return 'immediate';
  return rule.mode === 'seconds' ? `seconds_${rule.seconds}` : `percent_${rule.percent}`;
}

/** Critério atingido? Vídeos mais curtos que o limite liberam perto do fim. */
export function isUnlocked(rule, { watched, coverage, duration }) {
  if (rule.mode === 'immediate') return true;
  if (rule.mode === 'percent' && duration > 0) return coverage * 100 >= rule.percent;
  const target = duration > 0 ? Math.min(rule.seconds, duration * 0.9) : rule.seconds;
  return watched >= target;
}

