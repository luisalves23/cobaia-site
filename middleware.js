/* Páginas pagas: só abrem para quem abriu o link pessoal do e-mail da compra (cookie assinado, ver lib/compras.mjs).
   Acessos vêm do link pessoal do e-mail ou do e-mail digitado em /acesso/ (lista ACESSO_LIBERADO).
   - /gta/guia/         acesso "gta"
   - /notebook/guia/    acesso "notebook" (o suporte do notebook também libera)
   - /tablet/g/<slug>/  acesso "tablet"
   Legado: guias de tablet entregues antes ainda abrem com e-mail + senha das variáveis
     GUIA_<SLUG>_LOGIN e GUIA_<SLUG>_SENHA (cookie assinado com GUIA_SEGREDO).
   <SLUG> é a pasta do guia em maiúsculas, com "-" trocado por "_". */
// lib/compras.mjs é ESM e o middleware é empacotado como CommonJS: import dinâmico.
const libCompras = () => import('./lib/compras.mjs');

export const config = { runtime: 'nodejs', matcher: ['/tablet/g/:path*', '/gta/guia/:path*', '/notebook/guia/:path*'] };

const enc = new TextEncoder();

async function assinatura(slug, login, senha, segredo) {
  const key = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(slug + '|' + login + '|' + senha));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function igual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function lerCookie(req, nome) {
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(nome + '='));
  return m ? decodeURIComponent(m.slice(nome.length + 1)) : '';
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function telaLogin(acao, erro, login) {
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Entrar no seu guia · @cobaia.dev</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#0c0c0c">
<link rel="icon" href="/assets/img/favicon.png">
<link rel="stylesheet" href="/assets/site.css">
<style>
.lg{min-height:100vh;display:grid;place-items:center;padding-block:40px}
.lg .glass{width:100%;max-width:440px;padding:34px 26px;border-radius:30px}
.lg h1{font-size:clamp(46px,12vw,64px);margin:18px 0 6px}
.lg p.s{color:var(--muted);margin:0 0 22px}
.lg label{display:block;font:700 12px var(--f-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px}
.lg input{width:100%;box-sizing:border-box;font:500 17px var(--f-body);color:var(--paper);background:rgba(0,0,0,.45);border:1px solid var(--line);border-radius:14px;padding:13px 14px}
.lg input:focus{outline:2px solid var(--red);outline-offset:2px}
.lg button{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;text-align:center;margin-top:22px;font:400 24px var(--f-display);letter-spacing:.5px;background:var(--red);color:var(--ink);border-radius:14px;padding:12px 0 10px}
.lg .err{margin:16px 0 0;padding:12px 14px;border-radius:14px;background:rgba(255,45,45,.14);border:1px solid rgba(255,45,45,.4);font-size:15px}
.lg .help{font-size:14px;color:var(--dim);margin:20px 0 0}
</style></head>
<body><div class="bg" aria-hidden="true"><i></i><i></i><i></i></div>
<main class="lg"><form class="glass" method="post" action="${esc(acao)}">
<span class="badge">GUIA PREMIUM</span>
<h1>Entre no seu <em>guia</em></h1>
<p class="s">Use o e-mail da compra e a senha que chegou junto com este link.</p>
<label for="l">E-mail</label><input id="l" name="login" type="email" autocomplete="username" inputmode="email" required value="${esc(login || '')}">
<label for="s">Senha</label><input id="s" name="senha" type="password" autocomplete="current-password" required>
${erro ? '<p class="err" role="alert">E-mail ou senha não conferem. Confira e tente de novo.</p>' : ''}
<button type="submit">Abrir o guia</button>
<p class="help">Comprou pelo site? <a href="/acesso/?volta=${esc(acao)}" style="color:var(--paper)">Entre só com o e-mail da compra</a>. Não conseguiu? Responda a mensagem do WhatsApp em que recebeu este link.</p>
</form></main></body></html>`;
  return new Response(html, {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' },
  });
}

const NADA = undefined; // segue para a página estática
const ir = (location) => new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });

async function legado(req, slug) {
  const env = (k) => process.env[k];
  const chave = 'GUIA_' + slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const login = (env(chave + '_LOGIN') || '').trim().toLowerCase();
  const senha = env(chave + '_SENHA') || '';
  const segredo = env('GUIA_SEGREDO') || '';
  if (!login || !senha || !segredo) return null; // sem legado pra esse guia
  const certo = await assinatura(slug, login, senha, segredo);
  const nomeCookie = 'guia_' + slug.replace(/[^a-z0-9]/gi, '_');
  const base = '/tablet/g/' + slug + '/';
  if (req.method === 'POST') {
    let l = '', s = '';
    try { const f = await req.formData(); l = String(f.get('login') || '').trim().toLowerCase(); s = String(f.get('senha') || ''); } catch (e) {}
    if (igual(l, login) && igual(s, senha)) {
      return new Response(null, { status: 303, headers: { location: base, 'cache-control': 'no-store', 'set-cookie': `${nomeCookie}=${certo}; Path=${base}; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax` } });
    }
    return telaLogin(base, true, l);
  }
  if (igual(lerCookie(req, nomeCookie), certo)) return 'ok';
  return telaLogin(base, false, '');
}

export default async function middleware(req) {
  const { lerSessao } = await libCompras();
  const p = new URL(req.url).pathname;
  const tem = (k) => { const s = lerSessao(req); return !!s && s.produtos.includes(k); };

  if (p.startsWith('/notebook/guia')) return tem('notebook') ? NADA : ir('/acesso/?produto=notebook&volta=/notebook/guia/');
  if (p.startsWith('/gta/guia')) return tem('gta') ? NADA : ir('/acesso/?produto=gta&volta=/gta/guia/');

  // /tablet/g/<slug>/
  const slug = p.split('/')[3] || '';
  if (!slug) return new Response('Não encontrado', { status: 404, headers: { 'cache-control': 'no-store' } });
  if (tem('tablet')) return NADA;
  // quem já entrou antes com login e senha (cookie antigo) continua entrando; quem não entrou vai pro /acesso/ só com o e-mail
  if (req.method !== 'POST' && (await legado(req, slug)) === 'ok') return NADA;
  return ir('/acesso/?produto=tablet&volta=' + encodeURIComponent('/tablet/g/' + slug + '/'));
}
