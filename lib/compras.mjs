/* Cadastro de compras: quem pagou, de qual produto, e se ainda vale.
   Fica no Blob privado "cobaia-compras" (Vercel → Storage), um arquivo por comprador e produto:
     compras/<produto>/<sha256 do e-mail>.json
   A Kiwify avisa cada compra, reembolso e chargeback em /api/kiwify (ver api/kiwify.mjs).
   Toda página paga confere esse arquivo direto na origem, sem cache: estorno corta o acesso na hora. */
import { put, get } from '@vercel/blob';
import crypto from 'node:crypto';

/* Produtos vendidos. "destino" é para onde o comprador vai depois de entrar.
   "guia" é o caminho protegido (o middleware só deixa passar quem tem compra ativa). */
export const PRODUTOS = {
  tablet: {
    nome: 'Guia do seu tablet',
    destino: '/minha-area/',
    descricao: 'O passo a passo feito pro seu modelo, até o limite que ele aguenta.',
  },
  gta: {
    nome: 'Guia de cortes do GTA VI',
    destino: '/gta/guia/',
    guia: '/gta/guia/',
    descricao: 'O guia completo do Dia 11, com a skill e os pedidos prontos pra colar.',
  },
};

export const normEmail = (e) => String(e || '').trim().toLowerCase();
const hashEmail = (e) => crypto.createHash('sha256').update(normEmail(e)).digest('hex');
const caminho = (produto, email) => `compras/${produto}/${hashEmail(email)}.json`;

export async function lerCompra(produto, email) {
  if (!PRODUTOS[produto] || !normEmail(email)) return null;
  try {
    const r = await get(caminho(produto, email), { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e && e.name === 'BlobNotFoundError') return null;
    throw e;
  }
}

export async function gravarCompra(reg) {
  reg.atualizadoEm = new Date().toISOString();
  await put(caminho(reg.produto, reg.email), JSON.stringify(reg, null, 1), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return reg;
}

/* Ativo = pelo menos um pedido pago que não foi reembolsado nem contestado. */
export const ativo = (reg) => !!reg && Object.values(reg.pedidos || {}).some((p) => p.status === 'pago');

/* Todas as compras ativas de um e-mail, uma por produto. */
export async function comprasAtivas(email) {
  const out = [];
  await Promise.all(Object.keys(PRODUTOS).map(async (p) => {
    const r = await lerCompra(p, email);
    if (r) out.push(r);
  }));
  return out;
}

const FINAIS = new Set(['reembolsado', 'chargeback']);

/* Aplica um evento (da Kiwify ou do painel) ao registro do comprador.
   status: 'pago' | 'reembolsado' | 'chargeback'. Reembolso e chargeback são finais:
   se a Kiwify reenviar "compra aprovada" do mesmo pedido depois, o acesso não volta. */
export async function aplicarEvento({ produto, email, pedido, status, nome, celular, origem, extra }) {
  email = normEmail(email);
  const reg = (await lerCompra(produto, email)) || { produto, email, pedidos: {}, guias: [], criadoEm: new Date().toISOString() };
  if (nome) reg.nome = nome;
  if (celular) reg.celular = celular;
  if (extra) reg.extra = extra;
  const atual = reg.pedidos[pedido];
  if (!(atual && FINAIS.has(atual.status))) {
    reg.pedidos[pedido] = { status, origem: origem || 'kiwify', em: new Date().toISOString() };
  }
  return gravarCompra(reg);
}

/* ---------- sessão do comprador: cookie assinado só com o e-mail ----------
   O cookie diz QUEM é; O QUE pode ver é conferido no cadastro a cada página. */
const COOKIE = 'cobaia_acesso';
const segredo = () => process.env.GUIA_SEGREDO || '';
const b64 = (s) => Buffer.from(s).toString('base64url');
const hmac = (s) => crypto.createHmac('sha256', segredo()).update(s).digest('base64url');

export function cookieSessao(email) {
  const exp = Math.floor(Date.now() / 1000) + 400 * 86400;
  const v = b64(normEmail(email)) + '.' + exp;
  return `${COOKIE}=${v}.${hmac(v)}; Path=/; Max-Age=${400 * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
export const cookieSair = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function lerSessao(req) {
  if (!segredo()) return '';
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(COOKIE + '='));
  if (!m) return '';
  const [e, exp, sig] = decodeURIComponent(m.slice(COOKIE.length + 1)).split('.');
  if (!e || !exp || !sig) return '';
  const certo = hmac(e + '.' + exp);
  if (sig.length !== certo.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(certo))) return '';
  if (Number(exp) < Date.now() / 1000) return '';
  return Buffer.from(e, 'base64url').toString();
}

/* Caminho de volta seguro: só caminhos do próprio site. */
export const voltaSegura = (v) => (typeof v === 'string' && /^\/[a-z0-9\-/]*$/i.test(v) && !v.startsWith('//') ? v : '');
