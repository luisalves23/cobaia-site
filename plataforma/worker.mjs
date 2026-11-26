/* Plataforma do Cobaia no Cloudflare (sem servidor).
   O site é servido direto como arquivos estáticos. Este Worker só entra em:
     POST /webhook/kiwify?produto=<id>   avisos da Kiwify (compra, Pix, reembolso, chargeback)
     /area/ ...                           login por e-mail + código de 6 dígitos e lista do que a pessoa comprou
     /gta/guia/  /notebook/guia/  /tablet/g/<modelo>/   guias pagos: só passam daqui com sessão e produto ativo
   Regra de ouro: quais produtos a pessoa tem é SEMPRE lido do banco, a cada pedido. O cookie só diz quem ela é.
   Configuração (painel do Cloudflare > Worker > Settings > Variables and Secrets): ver plataforma/LEIAME.md */
import { prepararBanco, segredoDe, liberar, cortarPedido, produtosAtivos } from './banco.mjs';
import { PRODUTOS, liberados, produtoDoCaminho, infoProduto, normEmail, emailValido } from './produtos.mjs';
import { esc, emailCompra, emailCodigo, enviarEmail } from './emails.mjs';

const SESSAO = 'cobaia_sessao', APARELHO = 'cobaia_aparelho';
const UM_ANO = 365 * 24 * 3600;
const PROTEGIDO = /^\/(gta\/guia|notebook\/guia|tablet\/g)(\/|$)/i;

/* ---------- pequenas peças ---------- */
const SEGUROS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'cache-control': 'no-store' };
const html = (status, corpo, extra = {}) => new Response(corpo, { status, headers: { ...SEGUROS, 'content-type': 'text/html; charset=utf-8', ...extra } });
const texto = (status, corpo) => new Response(corpo, { status, headers: { ...SEGUROS, 'content-type': 'text/plain; charset=utf-8' } });
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...SEGUROS, 'content-type': 'application/json' } });
function redirecionar(para, cookies = []) {
  const h = new Headers({ ...SEGUROS, location: para });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(null, { status: 303, headers: h });
}
const cookie = (nome, valor, maxAge) => `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
function lerCookie(req, nome) {
  const m = (req.headers.get('cookie') || '').split(/;\s*/).find((p) => p.startsWith(nome + '='));
  try { return m ? decodeURIComponent(m.slice(nome.length + 1)) : ''; } catch { return ''; }
}
const ipDe = (req) => String(req.headers.get('cf-connecting-ip') || '').slice(0, 64);
const navegadorDe = (req) => String(req.headers.get('user-agent') || '').slice(0, 300);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const hash = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
async function hmacSha1(chave, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}
function igual(a, b) { // comparação em tempo constante
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function aleatorio(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function codigo6() {
  const u = new Uint32Array(1);
  do crypto.getRandomValues(u); while (u[0] >= 4294000000); // sem viés
  return String(u[0] % 1e6).padStart(6, '0');
}
const lista = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const siteDe = (env, url) => (env.SITE || url.origin).replace(/\/$/, '');

/* ---------- Kiwify ---------- */
const STATUS = {
  order_approved: 'pago', paid: 'pago', approved: 'pago',
  order_refunded: 'reembolsado', refunded: 'reembolsado',
  chargeback: 'chargeback', chargedback: 'chargeback',
};

async function assinaturaOk(env, corpo, assinatura) {
  if (!/^[0-9a-f]{40}$/i.test(assinatura || '')) return false;
  for (const t of lista(env.KIWIFY_TOKENS)) if (igual(await hmacSha1(t, corpo), assinatura.toLowerCase())) return true;
  return false;
}

/* O suporte do notebook pode vir como order bump do guia, ou comprado pela página /notebook. */
function produtoReal(env, produto, corpo, d) {
  if (produto === 'notebook' && (corpo.toLowerCase().includes('suporte pessoal') || (env.KIWIFY_SUPORTE_ID && corpo.includes(env.KIWIFY_SUPORTE_ID)))) return 'notebook-suporte';
  if (produto === 'suporte' && JSON.stringify(d.TrackingParameters || d.tracking_parameters || {}).toLowerCase().includes('notebook')) return 'notebook-suporte';
  return produto;
}

export async function processarKiwify(env, site, corpo, produtoUrl, assinatura) {
  if (!(await assinaturaOk(env, corpo, assinatura))) return [401, { ok: false, erro: 'assinatura' }];
  if (!Object.hasOwn(PRODUTOS, produtoUrl)) return [400, { ok: false, erro: 'produto desconhecido na URL do webhook' }];
  let d;
  try { d = JSON.parse(corpo); } catch { return [400, { ok: false, erro: 'json' }]; }

  const db = env.DB;
  const c = d.Customer || d.customer || {};
  const email = normEmail(c.email || d.email);
  const pedido = String(d.order_id || d.order_ref || '');
  const tipo = String(d.webhook_event_type || '');
  const situacao = String(d.order_status || '');
  const ev = await db.prepare('INSERT INTO eventos_kiwify (produto_url, tipo, status, pedido, email, corpo) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(produtoUrl, tipo, situacao, pedido, email, corpo).first();
  const fim = async (st, obj) => { await db.prepare('UPDATE eventos_kiwify SET resultado = ? WHERE id = ?').bind(JSON.stringify(obj), ev.id).run(); return [st, obj]; };

  if (!pedido || !emailValido(email)) return fim(400, { ok: false, erro: 'sem e-mail ou pedido' });
  const nome = String(c.full_name || c.first_name || c.name || '').slice(0, 120) || null;
  const telefone = String(c.mobile || c.phone || '').replace(/\D/g, '').slice(0, 20) || null;
  const produto = produtoReal(env, produtoUrl, corpo, d);
  const status = STATUS[tipo] || STATUS[situacao];

  // Pix gerado e ainda não pago: fica guardado para as mensagens de 15 min e 24 h (etapa 2).
  if (!status && String(d.payment_method || '').toLowerCase() === 'pix' && /waiting|pending|pix_created|created/i.test(tipo + ' ' + situacao)) {
    await db.prepare('INSERT INTO pix (pedido, email, telefone, nome, produto, valor, link_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (pedido) DO NOTHING')
      .bind(pedido, email, telefone, nome, produto, String((d.Commissions && d.Commissions.charge_amount) || d.charge_amount || '') || null, String(d.checkout_link || d.pix_link || '') || null).run();
    return fim(200, { ok: true, pix: 'pendente' });
  }
  if (!status) return fim(200, { ok: true, ignorado: tipo || situacao || '?' });
  if (status !== 'pago') return fim(200, { ok: true, status, cortados: await cortarPedido(db, pedido, status) });

  await db.prepare("UPDATE pix SET pago_em = datetime('now') WHERE pedido = ? AND pago_em IS NULL").bind(pedido).run();
  await liberar(db, { email, produtos: liberados(produto), pedido, origem: 'kiwify', nome, telefone });

  // E-mail de acesso: uma vez por pedido. Se falhar, o 500 faz a Kiwify reenviar o aviso e o e-mail tenta de novo.
  const jaFoi = await db.prepare('SELECT 1 FROM envios WHERE tipo = ? AND ok = 1').bind('compra:' + pedido).first();
  if (!jaFoi) {
    const ok = await enviarEmail(env, { para: email, ...emailCompra({ site, nome, email, produtos: liberados(produto) }), tipo: 'compra:' + pedido });
    if (!ok) return fim(500, { ok: false, erro: 'email', produto });
  }
  return fim(200, { ok: true, produto, status });
}

/* ---------- páginas da área ---------- */
function pagina(titulo, miolo) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)} · @cobaia.dev</title><meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#0c0c0c"><link rel="icon" href="/assets/img/favicon.png">
<style>
:root{--ink:#0c0c0c;--paper:#f2efe8;--muted:#a8a39a;--line:#2a2a2a;--red:#ff2d2d}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--paper);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
main{max-width:560px;margin:0 auto;padding:48px 16px}
.selo{font:700 12px ui-monospace,monospace;letter-spacing:.12em;color:var(--red)}
h1{font-size:clamp(30px,8vw,40px);line-height:1.1;margin:10px 0 8px}
p.s{color:var(--muted);margin:0 0 22px}
.cx{background:#161616;border:1px solid var(--line);border-radius:22px;padding:26px 22px}
label{display:block;font:700 12px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 8px}
input{width:100%;font:500 18px system-ui,sans-serif;color:var(--paper);background:#000;border:1px solid var(--line);border-radius:14px;padding:13px 14px}
input:focus{outline:2px solid var(--red);outline-offset:2px}
input.cod{font:700 30px ui-monospace,monospace;letter-spacing:.35em;text-align:center}
button,.bt{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;text-align:center;margin-top:18px;font-weight:800;font-size:18px;background:var(--red);color:var(--ink);border-radius:14px;padding:13px 0}
.err{margin:0 0 16px;padding:12px 14px;border-radius:14px;background:rgba(255,45,45,.14);border:1px solid rgba(255,45,45,.4)}
.prod{display:block;text-decoration:none;color:inherit;background:#161616;border:1px solid var(--line);border-radius:18px;padding:18px;margin:0 0 12px}
a.prod:hover{border-color:var(--red)}.prod b{display:block;font-size:18px;margin-bottom:4px}.prod span{color:var(--muted);font-size:15px}
.rodape{margin-top:26px;font-size:14px;color:var(--muted)}.rodape a{color:var(--muted)}
</style></head><body><main><div class="selo">@COBAIA.DEV</div>${miolo}</main></body></html>`;
}

const telaEmail = (erro = '', volta = '') => pagina('Entrar', `<h1>Sua área</h1><p class="s">Digite o e-mail que você usou na compra. Mandamos um código na hora.</p>
<form class="cx" method="post" action="/area/entrar">${erro ? `<p class="err">${esc(erro)}</p>` : ''}
<input type="hidden" name="volta" value="${esc(volta)}"><label for="e">Seu e-mail</label>
<input id="e" name="email" type="email" autocomplete="email" inputmode="email" required autofocus>
<button type="submit">Receber código</button></form>`);

const telaCodigo = (email, erro = '', volta = '') => pagina('Código', `<h1>Confira seu e-mail</h1>
<p class="s">Se <b>${esc(email)}</b> tiver uma compra, o código de 6 dígitos chega em instantes. Olhe também o spam.</p>
<form class="cx" method="post" action="/area/codigo">${erro ? `<p class="err">${esc(erro)}</p>` : ''}
<input type="hidden" name="email" value="${esc(email)}"><input type="hidden" name="volta" value="${esc(volta)}">
<label for="c">Código</label><input id="c" class="cod" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus>
<button type="submit">Entrar</button></form>
<p class="rodape"><a href="/area/">Usar outro e-mail</a></p>`);

function telaArea(env, email, produtos) {
  const num = String(env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
  const zap = num ? `https://wa.me/${num}?text=${encodeURIComponent('Oi, Luis! Sou ' + email + ' e preciso de ajuda.')}` : '';
  const itens = produtos.map((p) => {
    const i = infoProduto(p); if (!i) return '';
    if (i.pasta) return `<a class="prod" href="${esc(i.pasta)}"><b>${esc(i.nome)}</b><span>${esc(i.descricao)}</span></a>`;
    if (i.suporte && zap) return `<a class="prod" href="${esc(zap)}"><b>${esc(i.nome)}</b><span>Toque para falar com o Luis no WhatsApp.</span></a>`;
    return `<div class="prod"><b>${esc(i.nome)}</b><span>${esc(i.descricao)}</span></div>`;
  }).join('');
  return pagina('Sua área', `<h1>Sua área</h1><p class="s">${esc(email)}</p>${itens}
<p class="rodape">${zap ? `<a href="${esc(zap)}">Ajuda no WhatsApp</a> · ` : ''}<a href="/area/sair">Sair deste aparelho</a></p>`);
}

/* ---------- sessão e login ---------- */
async function sessaoAtual(env, req) {
  const t = lerCookie(req, SESSAO);
  if (!t || t.length > 100) return null;
  return env.DB.prepare('SELECT hash, email, aparelho FROM sessoes WHERE hash = ? AND encerrada_em IS NULL').bind(await hash(t)).first();
}

const registrarEntrada = (env, req, s, caminho) => env.DB.batch([
  env.DB.prepare('INSERT INTO entradas (email, aparelho, ip, navegador, caminho) VALUES (?, ?, ?, ?, ?)').bind(s.email, s.aparelho, ipDe(req), navegadorDe(req), caminho.slice(0, 300)),
  env.DB.prepare("UPDATE sessoes SET ultimo_em = datetime('now'), ip = ? WHERE hash = ?").bind(ipDe(req), s.hash),
]);

const voltaSegura = (v) => (/^\/(gta\/guia|notebook\/guia|tablet\/g)\/[A-Za-z0-9/_.-]*$/.test(v || '') && !String(v).includes('..') ? v : '/area/');

async function pedirCodigo(env, req, form) {
  const email = normEmail(form.get('email'));
  const volta = voltaSegura(form.get('volta'));
  if (!emailValido(email)) return html(400, telaEmail('Esse e-mail não parece certo. Confira e tente de novo.', volta));
  const db = env.DB, ip = ipDe(req);
  // Limite: 10 pedidos por hora por IP e 5 por e-mail.
  const lim = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM pedidos_login WHERE ip = ? AND quando > datetime('now', '-1 hour')) AS por_ip,
      (SELECT COUNT(*) FROM pedidos_login WHERE email = ? AND quando > datetime('now', '-1 hour')) AS por_email`).bind(ip, email).first();
  if (lim.por_ip >= 10 || lim.por_email >= 5) return html(429, telaEmail('Muitas tentativas. Espere alguns minutos e tente de novo.', volta));
  await db.batch([
    db.prepare('INSERT INTO pedidos_login (email, ip) VALUES (?, ?)').bind(email, ip),
    db.prepare("DELETE FROM pedidos_login WHERE quando < datetime('now', '-1 day')"),
  ]);
  // Só manda código para quem tem compra ativa. A tela é a mesma nos dois casos: ninguém descobre quem comprou.
  if ((await produtosAtivos(db, email)).length) {
    const codigo = codigo6();
    await db.batch([
      db.prepare("UPDATE codigos SET usado_em = datetime('now') WHERE email = ? AND usado_em IS NULL").bind(email),
      db.prepare("INSERT INTO codigos (email, hash, expira_em, ip) VALUES (?, ?, datetime('now', '+15 minutes'), ?)").bind(email, await hash(email + ':' + codigo + ':' + env.SEGREDO), ip),
    ]);
    await enviarEmail(env, { para: email, ...emailCodigo({ codigo }), tipo: 'codigo' });
  }
  return html(200, telaCodigo(email, '', volta));
}

async function conferirCodigo(env, req, form) {
  const email = normEmail(form.get('email'));
  const codigo = String(form.get('codigo') || '').replace(/\D/g, '');
  const volta = voltaSegura(form.get('volta'));
  const db = env.DB;
  const c = await db.prepare("SELECT id, hash, tentativas FROM codigos WHERE email = ? AND usado_em IS NULL AND expira_em > datetime('now') ORDER BY id DESC LIMIT 1").bind(email).first();
  if (!c || c.tentativas >= 5) return html(400, telaCodigo(email, 'Código vencido. Peça um novo.', volta));
  if (codigo.length !== 6 || !igual(c.hash, await hash(email + ':' + codigo + ':' + env.SEGREDO))) {
    await db.prepare('UPDATE codigos SET tentativas = tentativas + 1 WHERE id = ?').bind(c.id).run();
    return html(400, telaCodigo(email, 'Código errado. Confira e tente de novo.', volta));
  }
  // Marca como usado só se ninguém usou antes (dois envios ao mesmo tempo não abrem duas sessões).
  const uso = await db.prepare("UPDATE codigos SET usado_em = datetime('now') WHERE id = ? AND usado_em IS NULL").bind(c.id).run();
  if (!uso.meta.changes) return html(400, telaCodigo(email, 'Código vencido. Peça um novo.', volta));
  if (!(await produtosAtivos(db, email)).length) return html(403, telaEmail('Esse e-mail não tem compra ativa.'));

  let aparelho = lerCookie(req, APARELHO);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(aparelho)) aparelho = aleatorio(18);
  const token = aleatorio(32);
  await db.prepare('INSERT INTO sessoes (hash, email, aparelho, ip, navegador) VALUES (?, ?, ?, ?, ?)').bind(await hash(token), email, aparelho, ipDe(req), navegadorDe(req)).run();
  return redirecionar(volta, [cookie(SESSAO, token, UM_ANO), cookie(APARELHO, aparelho, 5 * UM_ANO)]);
}

/* ---------- guias pagos ---------- */
async function servirProtegido(env, req, url) {
  let caminho;
  try { caminho = decodeURIComponent(url.pathname); } catch { return texto(400, 'caminho inválido'); }
  // O produto exigido sai do caminho já decodificado. Qualquer truque ("..", "\", "//") é recusado antes.
  if (/\.\.|\\|\/\/|\0/.test(caminho)) return texto(400, 'caminho inválido');
  if (/^\/(gta\/guia|notebook\/guia|tablet\/g\/[a-z0-9-]{3,60})$/.test(caminho)) return redirecionar(caminho + '/');
  const produto = produtoDoCaminho(caminho);
  if (!produto) return texto(404, 'não encontrado');

  const s = await sessaoAtual(env, req);
  if (!s) return redirecionar('/area/?volta=' + encodeURIComponent(caminho));
  if (!(await produtosAtivos(env.DB, s.email)).includes(produto)) {
    return html(403, pagina('Sem acesso', `<h1>Esse material não está na sua conta</h1><p class="s">Você entrou como ${esc(s.email)}.</p><a class="bt" href="/area/">Ver o que eu tenho</a>`));
  }
  const arq = await env.ASSETS.fetch(new Request(new URL(caminho, url.origin), { method: req.method, headers: { accept: req.headers.get('accept') || '*/*' } }));
  if (arq.status >= 300 && arq.status < 400) return arq; // o próprio servidor de arquivos ajusta a barra no fim
  if (!arq.ok) return texto(404, 'não encontrado');
  if ((arq.headers.get('content-type') || '').includes('text/html')) await registrarEntrada(env, req, s, caminho);
  const h = new Headers(arq.headers);
  h.set('cache-control', 'private, no-store');
  h.set('x-robots-tag', 'noindex, nofollow, noarchive');
  h.set('referrer-policy', 'no-referrer');
  h.set('x-content-type-options', 'nosniff');
  return new Response(arq.body, { status: 200, headers: h });
}

/* ---------- roteamento ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    // A checagem dos guias usa o caminho decodificado, para "%2F" e afins não pularem a porta.
    let dec;
    try { dec = decodeURIComponent(p); } catch { return texto(400, 'caminho inválido'); }
    const protegido = PROTEGIDO.test(dec);
    const dinamico = p === '/webhook/kiwify' || p === '/area' || p.startsWith('/area/');
    if (!protegido && !dinamico) return env.ASSETS.fetch(req); // páginas públicas: direto, sem banco

    try {
      await prepararBanco(env.DB);
      env = { ...env, SEGREDO: await segredoDe(env) };

      if (protegido) return req.method === 'GET' || req.method === 'HEAD' ? await servirProtegido(env, req, url) : texto(405, 'método não permitido');
      if (p === '/webhook/kiwify') {
        if (req.method !== 'POST') return json(200, { ok: true, info: 'webhook da Kiwify: use POST' });
        const corpo = await req.text();
        if (corpo.length > 256 * 1024) return json(413, { ok: false });
        const [st, obj] = await processarKiwify(env, siteDe(env, url), corpo, url.searchParams.get('produto') || '', url.searchParams.get('signature') || '');
        return json(st, obj);
      }
      if (p === '/area' || p === '/area/') {
        const s = await sessaoAtual(env, req);
        if (!s) return html(200, telaEmail('', voltaSegura(url.searchParams.get('volta'))));
        await registrarEntrada(env, req, s, p);
        return html(200, telaArea(env, s.email, await produtosAtivos(env.DB, s.email)));
      }
      if (req.method === 'POST' && (p === '/area/entrar' || p === '/area/codigo')) {
        const corpo = await req.text();
        if (corpo.length > 4096) return texto(413, 'grande demais');
        const form = new URLSearchParams(corpo);
        return await (p === '/area/entrar' ? pedirCodigo(env, req, form) : conferirCodigo(env, req, form));
      }
      if (p === '/area/sair') {
        const t = lerCookie(req, SESSAO);
        if (t) await env.DB.prepare("UPDATE sessoes SET encerrada_em = datetime('now') WHERE hash = ?").bind(await hash(t)).run();
        return redirecionar('/area/', [cookie(SESSAO, '', 0)]);
      }
      return redirecionar('/area/');
    } catch (e) {
      console.error('plataforma:', (e && e.stack) || e);
      return texto(500, 'erro interno');
    }
  },
};
