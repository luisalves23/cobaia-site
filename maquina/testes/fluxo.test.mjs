/* Teste de ponta a ponta da etapa 1, sem internet: compra aprovada -> login por código -> guia abre -> reembolso corta.
   Rodar: node --test maquina/testes/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.BANCO = ':memory:';
process.env.SITE = 'http://localhost';
process.env.SEGREDO = 'segredo-de-teste';
process.env.KIWIFY_TOKENS = 'token-a,token-b';
process.env.EMAIL_SERVICO = 'console';

const { criarServidor: vendasSrv } = await import('../servicos/vendas.mjs');
const { criarServidor: acessoSrv } = await import('../servicos/acesso.mjs');

const ouvir = (srv) => new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
const vendas = await ouvir(vendasSrv());
const acesso = await ouvir(acessoSrv());
const base = (s) => `http://127.0.0.1:${s.address().port}`;

// Captura os e-mails impressos pelo carteiro em modo console.
const emails = [];
const logOriginal = console.log;
console.log = (...a) => { const t = a.join(' '); if (t.startsWith('[e-mail para')) emails.push(t); else logOriginal(...a); };

const assinar = (corpo, token = 'token-b') => crypto.createHmac('sha1', token).update(corpo).digest('hex');
async function webhook(obj, produto = 'gta', token) {
  const corpo = JSON.stringify(obj);
  const r = await fetch(`${base(vendas)}/webhook/kiwify?produto=${produto}&signature=${assinar(corpo, token)}`, { method: 'POST', body: corpo });
  return [r.status, await r.json()];
}
const compra = (extra = {}) => ({ webhook_event_type: 'order_approved', order_status: 'paid', order_id: 'P1', payment_method: 'pix', Customer: { email: 'Ana@Exemplo.com', full_name: 'Ana Souza', mobile: '+55 31 99999-0000' }, ...extra });

async function entrar(email) {
  const antes = emails.length;
  await fetch(`${base(acesso)}/area/entrar`, { method: 'POST', body: new URLSearchParams({ email }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const novo = emails.slice(antes).find((e) => e.includes(email.toLowerCase()) && e.includes('código'));
  if (!novo) return null;
  const codigo = /código para entrar no @cobaia.dev: (\d{6})/.exec(novo)[1];
  const r = await fetch(`${base(acesso)}/area/codigo`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ email, codigo }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { status: r.status, cookies };
}

test('assinatura errada é recusada', async () => {
  const [st] = await webhook(compra(), 'gta', 'token-errado');
  assert.equal(st, 401);
});

test('compra aprovada libera e manda e-mail uma vez só', async () => {
  const [st, r] = await webhook(compra());
  assert.equal(st, 200); assert.equal(r.status, 'pago');
  assert.equal(emails.filter((e) => e.includes('acesso está liberado')).length, 1);
  await webhook(compra()); // a Kiwify reenvia o mesmo aviso
  assert.equal(emails.filter((e) => e.includes('acesso está liberado')).length, 1);
});

test('sem login, o guia manda para a área', async () => {
  const r = await fetch(`${base(acesso)}/gta/guia/`, { redirect: 'manual' });
  assert.equal(r.status, 303);
  assert.match(r.headers.get('location'), /^\/area\/\?volta=/);
});

test('e-mail sem compra não recebe código', async () => {
  assert.equal(await entrar('ninguem@exemplo.com'), null);
});

test('login por código abre o guia comprado e barra o outro', async () => {
  const s = await entrar('ana@exemplo.com');
  assert.equal(s.status, 303);
  const g = await fetch(`${base(acesso)}/gta/guia/`, { headers: { cookie: s.cookies } });
  assert.equal(g.status, 200);
  const n = await fetch(`${base(acesso)}/notebook/guia/`, { headers: { cookie: s.cookies } });
  assert.equal(n.status, 403);
  const truque = await fetch(`${base(acesso)}/gta/guia/..%2F..%2Fnotebook/guia/`, { headers: { cookie: s.cookies }, redirect: 'manual' });
  assert.notEqual(truque.status, 200);
  const area = await (await fetch(`${base(acesso)}/area/`, { headers: { cookie: s.cookies } })).text();
  assert.match(area, /cortes de GTA VI/);
});

test('código errado 5 vezes trava', async () => {
  await fetch(`${base(acesso)}/area/entrar`, { method: 'POST', body: new URLSearchParams({ email: 'ana@exemplo.com' }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  for (let i = 0; i < 5; i++) await fetch(`${base(acesso)}/area/codigo`, { method: 'POST', body: new URLSearchParams({ email: 'ana@exemplo.com', codigo: '000000' }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const r = await fetch(`${base(acesso)}/area/codigo`, { method: 'POST', body: new URLSearchParams({ email: 'ana@exemplo.com', codigo: '000000' }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.match(await r.text(), /vencido/);
});

test('reembolso corta o acesso na hora', async () => {
  const s = await entrar('ana@exemplo.com');
  const [, r] = await webhook(compra({ webhook_event_type: 'order_refunded', order_status: 'refunded' }));
  assert.equal(r.cortados, 1);
  const g = await fetch(`${base(acesso)}/gta/guia/`, { headers: { cookie: s.cookies }, redirect: 'manual' });
  assert.notEqual(g.status, 200);
});

test('pix gerado fica pendente para o relógio', async () => {
  const [, r] = await webhook({ webhook_event_type: 'pix_created', order_status: 'waiting_payment', order_id: 'P2', payment_method: 'pix', Customer: { email: 'bia@exemplo.com', mobile: '31988887777' } }, 'notebook');
  assert.equal(r.pix, 'pendente');
});

test('fim', () => { vendas.close(); acesso.close(); console.log = logOriginal; });
