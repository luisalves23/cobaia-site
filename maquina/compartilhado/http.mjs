/* Peças pequenas de HTTP usadas pelos serviços. Sem framework: só o node:http. */
import crypto from 'node:crypto';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function lerCorpo(req, limite = 256 * 1024) {
  return new Promise((ok, falha) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > limite) { falha(new Error('corpo grande demais')); req.destroy(); } else partes.push(c); });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falha);
  });
}

export function lerCookie(req, nome) {
  const c = req.headers.cookie || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(nome + '='));
  return m ? decodeURIComponent(m.slice(nome.length + 1)) : '';
}

export function cookie(nome, valor, { maxAge, seguro = true } = {}) {
  let s = `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax`;
  if (seguro) s += '; Secure';
  if (maxAge !== undefined) s += `; Max-Age=${maxAge}`;
  return s;
}

const CABECALHOS_SEGUROS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cache-control': 'no-store',
};

export function responder(res, status, corpo, tipo = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { ...CABECALHOS_SEGUROS, 'content-type': tipo, ...extra });
  res.end(corpo);
}
export const json = (res, status, obj) => responder(res, status, JSON.stringify(obj), 'application/json');
export const redirecionar = (res, para, extra = {}) => { res.writeHead(303, { ...CABECALHOS_SEGUROS, location: para, ...extra }); res.end(); };

/* IP real: o porteiro (Caddy) é o único que fala com os serviços e põe o IP do visitante em X-Real-IP. */
export const ipDe = (req) => String(req.headers['x-real-ip'] || req.socket.remoteAddress || '').slice(0, 64);
export const navegadorDe = (req) => String(req.headers['user-agent'] || '').slice(0, 300);

export const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const aleatorio = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export function igual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Limite de tentativas em memória: chave -> horários recentes. Reinicia junto com o serviço, o que basta aqui. */
const baldes = new Map();
export function dentroDoLimite(chave, max, janelaMs) {
  const agora = Date.now();
  const lista = (baldes.get(chave) || []).filter((t) => agora - t < janelaMs);
  if (lista.length >= max) { baldes.set(chave, lista); return false; }
  lista.push(agora); baldes.set(chave, lista);
  if (baldes.size > 50000) baldes.clear();
  return true;
}
