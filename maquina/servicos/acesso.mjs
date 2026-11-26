/* Serviço acesso: a plataforma do aluno.
   /area/           entrar (e-mail + código de 6 dígitos) e ver os produtos comprados
   /gta/guia/...    /notebook/guia/...    /tablet/g/<modelo>/...   guias pagos, servidos só daqui
   Regra de ouro: quais produtos a pessoa tem é SEMPRE lido do banco, a cada pedido. O cookie só diz quem ela é. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CONFIG, exigir } from '../compartilhado/config.mjs';
import { banco } from '../compartilhado/banco.mjs';
import { esc, lerCorpo, lerCookie, cookie, responder, redirecionar, ipDe, navegadorDe, hash, aleatorio, igual, dentroDoLimite } from '../compartilhado/http.mjs';
import { produtoDoCaminho, infoProduto, normEmail, emailValido } from '../compartilhado/produtos.mjs';
import { produtosAtivos, temAcesso, temAlgumAcesso } from '../compartilhado/acessos.mjs';
import { enviarEmail } from '../compartilhado/carteiro.mjs';
import { emailCodigo } from '../compartilhado/modelos-email.mjs';

const SESSAO = 'cobaia_sessao', APARELHO = 'cobaia_aparelho';
const UM_ANO = 365 * 24 * 3600;
const seguro = () => CONFIG.SITE.startsWith('https://');

/* ---------- páginas ---------- */
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

function telaArea(email, produtos) {
  const zap = CONFIG.WHATSAPP_SUPORTE ? `https://wa.me/${CONFIG.WHATSAPP_SUPORTE}?text=${encodeURIComponent('Oi, Luis! Sou ' + email + ' e preciso de ajuda.')}` : '';
  const itens = produtos.map((p) => {
    const i = infoProduto(p); if (!i) return '';
    if (i.pasta) return `<a class="prod" href="${esc(i.pasta)}"><b>${esc(i.nome)}</b><span>${esc(i.descricao)}</span></a>`;
    if (i.suporte && zap) return `<a class="prod" href="${esc(zap)}"><b>${esc(i.nome)}</b><span>Toque para falar com o Luis no WhatsApp.</span></a>`;
    return `<div class="prod"><b>${esc(i.nome)}</b><span>${esc(i.descricao)}</span></div>`;
  }).join('');
  return pagina('Sua área', `<h1>Sua área</h1><p class="s">${esc(email)}</p>${itens}
<p class="rodape">${zap ? `<a href="${esc(zap)}">Ajuda no WhatsApp</a> · ` : ''}<a href="/area/sair">Sair deste aparelho</a></p>`);
}

/* ---------- sessão ---------- */
function sessaoAtual(req) {
  const t = lerCookie(req, SESSAO);
  if (!t || t.length > 100) return null;
  const s = banco().prepare('SELECT hash, email, aparelho, ultimo_em FROM sessoes WHERE hash = ? AND encerrada_em IS NULL').get(hash(t));
  return s || null;
}

function registrarEntrada(req, s, caminho) {
  const d = banco();
  d.prepare('INSERT INTO entradas (email, aparelho, ip, navegador, caminho) VALUES (?, ?, ?, ?, ?)').run(s.email, s.aparelho, ipDe(req), navegadorDe(req), caminho.slice(0, 300));
  d.prepare("UPDATE sessoes SET ultimo_em = datetime('now'), ip = ? WHERE hash = ?").run(ipDe(req), s.hash);
}

const voltaSegura = (v) => (/^\/(gta\/guia|notebook\/guia|tablet\/g)\/[A-Za-z0-9/_.-]*$/.test(v || '') ? v : '/area/');

/* ---------- login por código ---------- */
async function pedirCodigo(req, res, form) {
  const email = normEmail(form.get('email'));
  const volta = voltaSegura(form.get('volta'));
  if (!emailValido(email)) return responder(res, 400, telaEmail('Esse e-mail não parece certo. Confira e tente de novo.', volta));
  const ip = ipDe(req);
  if (!dentroDoLimite('ip:' + ip, 10, 3600e3) || !dentroDoLimite('email:' + email, 5, 3600e3)) {
    return responder(res, 429, telaEmail('Muitas tentativas. Espere alguns minutos e tente de novo.', volta));
  }
  // Só manda código para quem tem compra ativa. A tela é a mesma nos dois casos: ninguém descobre quem comprou.
  if (temAlgumAcesso(email)) {
    const codigo = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    const d = banco();
    d.prepare("UPDATE codigos SET usado_em = datetime('now') WHERE email = ? AND usado_em IS NULL").run(email);
    d.prepare("INSERT INTO codigos (email, hash, expira_em, ip) VALUES (?, ?, datetime('now', '+15 minutes'), ?)").run(email, hash(email + ':' + codigo + ':' + CONFIG.SEGREDO), ip);
    await enviarEmail({ para: email, ...emailCodigo({ codigo }), tipo: 'codigo' });
  }
  responder(res, 200, telaCodigo(email, '', volta));
}

function conferirCodigo(req, res, form) {
  const email = normEmail(form.get('email'));
  const codigo = String(form.get('codigo') || '').replace(/\D/g, '');
  const volta = voltaSegura(form.get('volta'));
  if (!dentroDoLimite('cod-ip:' + ipDe(req), 20, 3600e3)) return responder(res, 429, telaCodigo(email, 'Muitas tentativas. Espere alguns minutos.', volta));
  const d = banco();
  const c = d.prepare("SELECT id, hash, tentativas FROM codigos WHERE email = ? AND usado_em IS NULL AND expira_em > datetime('now') ORDER BY id DESC LIMIT 1").get(email);
  if (!c || c.tentativas >= 5) return responder(res, 400, telaCodigo(email, 'Código vencido. Peça um novo.', volta));
  if (codigo.length !== 6 || !igual(c.hash, hash(email + ':' + codigo + ':' + CONFIG.SEGREDO))) {
    d.prepare('UPDATE codigos SET tentativas = tentativas + 1 WHERE id = ?').run(c.id);
    return responder(res, 400, telaCodigo(email, 'Código errado. Confira e tente de novo.', volta));
  }
  d.prepare("UPDATE codigos SET usado_em = datetime('now') WHERE id = ?").run(c.id);
  if (!temAlgumAcesso(email)) return responder(res, 403, telaEmail('Esse e-mail não tem compra ativa.'));

  let aparelho = lerCookie(req, APARELHO);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(aparelho)) aparelho = aleatorio(18);
  const token = aleatorio(32);
  d.prepare('INSERT INTO sessoes (hash, email, aparelho, ip, navegador) VALUES (?, ?, ?, ?, ?)').run(hash(token), email, aparelho, ipDe(req), navegadorDe(req));
  res.setHeader('set-cookie', [cookie(SESSAO, token, { maxAge: UM_ANO, seguro: seguro() }), cookie(APARELHO, aparelho, { maxAge: 5 * UM_ANO, seguro: seguro() })]);
  redirecionar(res, volta);
}

/* ---------- arquivos protegidos ---------- */
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.pdf': 'application/pdf', '.zip': 'application/zip', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

function servirProtegido(req, res, caminho) {
  let rel;
  try { rel = decodeURIComponent(caminho); } catch { return responder(res, 400, 'caminho inválido', 'text/plain'); }
  const raiz = path.resolve(CONFIG.RAIZ_SITE);
  let arquivo = path.resolve(raiz, '.' + path.posix.normalize(rel));
  if (!arquivo.startsWith(raiz + path.sep)) return responder(res, 400, 'caminho inválido', 'text/plain');
  let st;
  try { arquivo = fs.realpathSync(arquivo); st = fs.statSync(arquivo); } catch { return responder(res, 404, 'não encontrado', 'text/plain'); }
  if (!arquivo.startsWith(fs.realpathSync(raiz) + path.sep)) return responder(res, 400, 'caminho inválido', 'text/plain');
  const pasta = st.isDirectory();
  if (pasta && !caminho.endsWith('/')) return redirecionar(res, caminho + '/');
  // O produto exigido sai do caminho JÁ normalizado: "../" não leva de um guia para outro.
  const norm = '/' + path.relative(raiz, arquivo).split(path.sep).join('/') + (pasta ? '/' : '');
  const produto = produtoDoCaminho(norm);
  if (!produto) return responder(res, 404, 'não encontrado', 'text/plain');

  const s = sessaoAtual(req);
  if (!s) return redirecionar(res, '/area/?volta=' + encodeURIComponent(norm));
  if (!temAcesso(s.email, produto)) return responder(res, 403, pagina('Sem acesso', `<h1>Esse material não está na sua conta</h1><p class="s">Você entrou como ${esc(s.email)}.</p><a class="bt" href="/area/">Ver o que eu tenho</a>`));

  if (pasta) {
    arquivo = path.join(arquivo, 'index.html');
    try { st = fs.statSync(arquivo); } catch { return responder(res, 404, 'não encontrado', 'text/plain'); }
  }
  const ext = path.extname(arquivo).toLowerCase();
  if (ext === '.html') registrarEntrada(req, s, caminho);
  res.writeHead(200, { 'content-type': TIPOS[ext] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(arquivo).pipe(res);
}

/* ---------- roteamento ---------- */
export function criarServidor() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      if (p === '/area' || p === '/area/') {
        const s = sessaoAtual(req);
        if (!s) return responder(res, 200, telaEmail('', voltaSegura(url.searchParams.get('volta'))));
        registrarEntrada(req, s, p);
        return responder(res, 200, telaArea(s.email, produtosAtivos(s.email)));
      }
      if (req.method === 'POST' && (p === '/area/entrar' || p === '/area/codigo')) {
        const form = new URLSearchParams(await lerCorpo(req, 4096));
        return p === '/area/entrar' ? await pedirCodigo(req, res, form) : conferirCodigo(req, res, form);
      }
      if (p === '/area/sair') {
        const t = lerCookie(req, SESSAO);
        if (t) banco().prepare("UPDATE sessoes SET encerrada_em = datetime('now') WHERE hash = ?").run(hash(t));
        res.setHeader('set-cookie', cookie(SESSAO, '', { maxAge: 0, seguro: seguro() }));
        return redirecionar(res, '/area/');
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && /^\/(gta\/guia|notebook\/guia|tablet\/g)(\/|$)/.test(p)) return servirProtegido(req, res, p);
      responder(res, 404, 'não encontrado', 'text/plain');
    } catch (e) {
      console.error('acesso:', e);
      responder(res, 500, 'erro interno', 'text/plain');
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  exigir('SEGREDO', 'EMAIL_SERVICO');
  banco();
  criarServidor().listen(CONFIG.PORTA_ACESSO, '127.0.0.1', () => console.log('acesso na porta', CONFIG.PORTA_ACESSO));
}
