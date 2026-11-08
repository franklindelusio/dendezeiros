/**
 * Monta o link do WhatsApp (wa.me abre o app no celular e o
 * WhatsApp Web/Desktop no computador).
 */
export function campaignRef(utm = {}) {
  const clean = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  const parts = [clean(utm.utm_campaign), clean(utm.utm_content)].filter(Boolean);
  if (!parts.length) {
    const src = clean(utm.utm_source);
    if (src) parts.push(src);
  }
  return parts.join('/').slice(0, 40);
}

export function buildWhatsAppUrl({ number, message, appendCampaignRef = false }, utm = {}) {
  const digits = String(number).replace(/\D/g, '');
  let text = message;
  if (appendCampaignRef) {
    const ref = campaignRef(utm);
    if (ref) text += `\n\nRef: ${ref}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
