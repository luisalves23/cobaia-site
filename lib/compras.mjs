/* Acesso sem cadastro: o site não guarda compras.
   A Kiwify avisa a compra aprovada em /api/kiwify. O site manda para o e-mail do comprador um link pessoal,
   assinado com GUIA_SEGREDO: /entrar/?t=<token>. Quem abre o link ganha um cookie com os produtos liberados.
   Só quem comprou recebe o link; ele vale para sempre e em qualquer aparelho.
   Limite: reembolso e chargeback não cortam o acesso (não há cadastro para apagar). */
import crypto from 'node:crypto';

export const SITE = 'https://cobaia-dev.vercel.app';

/* Produtos vendidos. "destino" é para onde o comprador vai depois de entrar.
   "guia" é o caminho protegido. "libera" são os acessos que a compra dá. */
export const PRODUTOS = {
  tablet: {
    nome: 'Guia do seu tablet',
    destino: '/minha-area/',
    descricao: 'O passo a passo feito pro seu modelo, até o limite que ele aguenta.',
  },
  gta: {
    nome: 'Guia completo de cortes de GTA VI',
    destino: '/gta/guia/',
    guia: '/gta/guia/',
    descricao: 'O guia completo do Dia 11, com a skill e os pedidos prontos pra colar.',
  },
  notebook: {
    nome: 'Notebook Ressuscitado: guia completo',
    destino: '/notebook/guia/',
    guia: '/notebook/guia/',
    descricao: 'O passo a passo completo, por fases, do notebook parado ao notebook rápido e bonito.',
  },
  'notebook-suporte': {
    nome: 'Notebook Ressuscitado: suporte pessoal do Luis',
    destino: '/minha-area/',
    guia: '/notebook/guia/',
    suporte: true,
    descricao: 'O Luis com você no WhatsApp, do início ao fim, até o notebook ficar pronto. O guia completo vem junto.',
  },
  /* O produto de suporte que já existia na Kiwify (o do tablet), agora valendo pra qualquer serviço.
     Webhook: /api/kiwify?produto=suporte. Se a compra veio da página /notebook (src=notebook no checkout),
     o webhook registra também 'notebook-suporte', que libera o guia do notebook. */
  suporte: {
    nome: 'Suporte pessoal do Luis',
    destino: '/minha-area/',
    suporte: true,
    descricao: 'Atendimento comigo no WhatsApp, do começo ao fim do seu projeto.',
  },
};


const LIBERA = {
  tablet: ['tablet'],
  gta: ['gta'],
  notebook: ['notebook'],
  'notebook-suporte': ['notebook', 'notebook-suporte'],
  suporte: ['suporte'],
};
export const liberados = (produto) => LIBERA[produto] || [];

export const normEmail = (e) => String(e || '').trim().toLowerCase();

const segredo = () => process.env.GUIA_SEGREDO || '';
const b64 = (s) => Buffer.from(s).toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString();
const hmac = (s) => crypto.createHmac('sha256', segredo()).update(s).digest('base64url');
const confere = (v, sig) => {
  const certo = hmac(v);
  return !!sig && sig.length === certo.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(certo));
};

/* Link pessoal de acesso de um comprador a um produto. */
export function tokenAcesso(produto, email) {
  if (!segredo()) throw new Error('GUIA_SEGREDO não configurado');
  const v = b64(JSON.stringify({ p: produto, e: normEmail(email) }));
  return v + '.' + hmac(v);
}
export const linkAcesso = (produto, email) => `${SITE}/entrar/?t=${tokenAcesso(produto, email)}`;

export function lerToken(t) {
  if (!segredo() || typeof t !== 'string') return null;
  const [v, sig] = t.split('.');
  if (!v || !confere(v, sig)) return null;
  try {
    const o = JSON.parse(unb64(v));
    return PRODUTOS[o.p] && o.e ? { produto: o.p, email: o.e } : null;
  } catch (e) { return null; }
}

/* ---------- sessão do comprador: cookie assinado com o e-mail e os acessos ---------- */
const COOKIE = 'cobaia_guias';
const IDADE = 400 * 86400;

export function cookieSessao(email, produtos) {
  const v = b64(JSON.stringify({ e: normEmail(email), p: Array.from(new Set(produtos)) }));
  return `${COOKIE}=${v}.${hmac(v)}; Path=/; Max-Age=${IDADE}; HttpOnly; Secure; SameSite=Lax`;
}
export const cookieSair = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/* { email, produtos } de quem já abriu um link, ou null. */
export function lerSessao(req) {
  if (!segredo()) return null;
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(COOKIE + '='));
  if (!m) return null;
  const [v, sig] = decodeURIComponent(m.slice(COOKIE.length + 1)).split('.');
  if (!v || !confere(v, sig)) return null;
  try {
    const o = JSON.parse(unb64(v));
    return { email: o.e || '', produtos: (o.p || []).filter((p) => PRODUTOS[p]) };
  } catch (e) { return null; }
}

/* Caminho de volta seguro: só caminhos do próprio site. */
export const voltaSegura = (v) => (typeof v === 'string' && /^\/[a-z0-9\-/]*$/i.test(v) && !v.startsWith('//') ? v : '');
