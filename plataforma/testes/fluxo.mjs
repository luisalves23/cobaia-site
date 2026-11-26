/* Teste de ponta a ponta contra o Worker rodando local (wrangler dev), sem mandar nada de verdade.
   1) na raiz do repositório: printf "KIWIFY_TOKENS=tok-teste\nEMAIL_SERVICO=console\n" > .dev.vars
   2) npx wrangler dev --port 8799 > /tmp/dev.log 2>&1 &
   3) node plataforma/testes/fluxo.mjs http://127.0.0.1:8799 /tmp/dev.log
   Os códigos de login são lidos do log (o "e-mail" vai para o console). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [BASE = 'http://127.0.0.1:8799', LOG = '/tmp/dev.log'] = process.argv.slice(2);
const TOKEN = 'tok-teste';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
async function caso(nome, fn) {
  try { await fn(); console.log('ok   ', nome); } catch (e) { falhas++; console.log('FALHA', nome, '\n     ', e.message); }
}
const ir = (p, o = {}) => fetch(BASE + p, { redirect: 'manual', ...o });
const assinar = (corpo) => crypto.createHmac('sha1', TOKEN).update(corpo).digest('hex');
const kiwify = (produto, obj, assinatura) => {
  const corpo = JSON.stringify(obj);
  return ir(`/webhook/kiwify?produto=${produto}&signature=${assinatura ?? assinar(corpo)}`, { method: 'POST', body: corpo, headers: { 'content-type': 'application/json' } });
};
const sufixo = Date.now().toString(36);
const comprador = `ana.${sufixo}@exemplo.com`, curioso = `zé.${sufixo}@exemplo.com`.replace('é', 'e');
const pedido = 'PED-' + sufixo;
const compra = (status = 'order_approved', extra = {}) => ({ order_id: pedido, webhook_event_type: status, order_status: status === 'order_approved' ? 'paid' : status, Customer: { email: comprador, full_name: 'Ana Teste', mobile: '+55 31 99999-0000' }, ...extra });
const log = () => fs.readFileSync(LOG, 'utf8');
const contar = (re) => (log().match(re) || []).length;
async function ultimoCodigo(email) {
  for (let i = 0; i < 20; i++) {
    const blocos = log().split('[e-mail para ' + email + ']');
    if (blocos.length > 1) { const m = /: (\d{6})/.exec(blocos[blocos.length - 1]); if (m) return m[1]; }
    await espera(250);
  }
  throw new Error('código não apareceu no log');
}
const formulario = (o) => ({ method: 'POST', body: new URLSearchParams(o).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
const cookiesDe = (r) => r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

await caso('página pública abre e / vai para /30-dias/', async () => {
  assert.equal((await ir('/30-dias/')).status, 200);
  const r = await ir('/'); assert.equal(r.status, 302); assert.match(r.headers.get('location'), /\/30-dias\/$/);
});
await caso('arquivos internos não vão para o ar', async () => {
  for (const p of ['/plataforma/worker.mjs', '/maquina/LEIAME.md', '/wrangler.jsonc', '/.git/config', '/README.md', '/api/kiwify.mjs', '/.dev.vars']) {
    const r = await ir(p); assert.ok(r.status === 404 || (r.status >= 300 && r.status < 400 && !(await r.text()).includes('import')), p + ' -> ' + r.status);
  }
});
await caso('assinatura errada: 401', async () => assert.equal((await kiwify('gta', compra(), 'a'.repeat(40))).status, 401));
await caso('compra aprovada libera e manda 1 e-mail só', async () => {
  const antes = contar(new RegExp('\\[e-mail para ' + comprador.replace('.', '\\.') + '\\] Seu acesso', 'g'));
  assert.equal((await kiwify('gta', compra())).status, 200);
  assert.equal((await kiwify('gta', compra())).status, 200);
  await espera(500);
  assert.equal(contar(new RegExp('\\[e-mail para ' + comprador.replace('.', '\\.') + '\\] Seu acesso', 'g')) - antes, 1);
});
await caso('guia sem login vai para a área', async () => {
  const r = await ir('/gta/guia/'); assert.equal(r.status, 303); assert.match(r.headers.get('location'), /^\/area\/\?volta=/);
});
await caso('truque de caminho codificado não pula a porta', async () => {
  for (const p of ['/gta%2Fguia/', '/gta/%67uia/', '/GTA/guia/', '/gta/guia/cortes-gta.zip', '/gta/guia/%2e%2e/%2e%2e/notebook/guia/']) {
    const r = await ir(p); assert.ok([303, 400, 404].includes(r.status), p + ' -> ' + r.status);
    if (r.status === 200) throw new Error('vazou ' + p);
  }
});
await caso('quem não comprou vê a mesma tela e não recebe código', async () => {
  const r = await ir('/area/entrar', formulario({ email: curioso }));
  assert.equal(r.status, 200); assert.match(await r.text(), /Confira seu e-mail/);
  await espera(300); assert.equal(contar(new RegExp('\\[e-mail para ' + curioso.replace('.', '\\.') + '\\]', 'g')), 0);
});
let sessao = '';
await caso('comprador entra com o código e abre só o que comprou', async () => {
  await ir('/area/entrar', formulario({ email: comprador, volta: '/gta/guia/' }));
  const codigo = await ultimoCodigo(comprador);
  const r = await ir('/area/codigo', formulario({ email: comprador, codigo, volta: '/gta/guia/' }));
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/gta/guia/');
  sessao = cookiesDe(r); assert.match(sessao, /cobaia_sessao=/);
  const g = await ir('/gta/guia/', { headers: { cookie: sessao } }); assert.equal(g.status, 200); assert.match(g.headers.get('cache-control'), /no-store/);
  const z = await ir('/gta/guia/cortes-gta.zip', { headers: { cookie: sessao } }); assert.equal(z.status, 200);
  const n = await ir('/notebook/guia/', { headers: { cookie: sessao } }); assert.equal(n.status, 403);
  const t = await ir('/gta/guia/%2e%2e/%2e%2e/notebook/guia/', { headers: { cookie: sessao } }); assert.notEqual(t.status, 200);
  const a = await ir('/area/', { headers: { cookie: sessao } }); assert.match(await a.text(), /cortes de GTA VI/);
});
await caso('código usado não serve de novo', async () => {
  const codigo = await ultimoCodigo(comprador);
  const r = await ir('/area/codigo', formulario({ email: comprador, codigo }));
  assert.equal(r.status, 400);
});
await caso('5 códigos errados travam o código', async () => {
  await ir('/area/entrar', formulario({ email: comprador }));
  const certo = await ultimoCodigo(comprador);
  const errado = String((Number(certo) + 1) % 1e6).padStart(6, '0');
  for (let i = 0; i < 5; i++) assert.equal((await ir('/area/codigo', formulario({ email: comprador, codigo: errado }))).status, 400);
  assert.equal((await ir('/area/codigo', formulario({ email: comprador, codigo: certo }))).status, 400);
});
await caso('reembolso corta o acesso e derruba a sessão', async () => {
  assert.equal((await kiwify('gta', compra('order_refunded'))).status, 200);
  const g = await ir('/gta/guia/', { headers: { cookie: sessao } }); assert.equal(g.status, 303);
});
await caso('Pix gerado fica pendente (sem liberar)', async () => {
  const r = await kiwify('notebook', { order_id: 'PIX-' + sufixo, webhook_event_type: 'pix_created', order_status: 'waiting_payment', payment_method: 'pix', Customer: { email: 'pix.' + sufixo + '@exemplo.com' } });
  assert.deepEqual(await r.json(), { ok: true, pix: 'pendente' });
});

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
