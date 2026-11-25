/* /admin/ : painel do Luis. Protegido pela variável ADMIN_CHAVE (digitada a cada ação).
   Gera o link pessoal de acesso de um comprador (para mandar no WhatsApp) e, se quiser, manda o e-mail de acesso.
   O site não guarda compras: quem tem o link entra. */
import crypto from 'node:crypto';
import { PRODUTOS, normEmail, linkAcesso } from '../lib/compras.mjs';
import { pagina, esc } from '../lib/ui.mjs';
import { enviarBoasVindas } from '../lib/email.mjs';

const chaveOk = (c) => {
  const k = process.env.ADMIN_CHAVE || '';
  if (!k || !c) return false;
  const a = crypto.createHash('sha256').update(String(c)).digest();
  const b = crypto.createHash('sha256').update(k).digest();
  return crypto.timingSafeEqual(a, b);
};

const opcoes = (sel) => Object.entries(PRODUTOS).map(([k, p]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(p.nome)}</option>`).join('');

function tela({ msg = '', tipo = '', email = '', produto = 'notebook', link = '' } = {}) {
  const corpo = `
<span class="badge">PAINEL</span>
<h1>Liberar <em>acesso</em></h1>
<p class="s">Gera o link pessoal de um comprador. Cada ação pede a chave do painel (ADMIN_CHAVE na Vercel).</p>
<form method="post" action="/admin/">
<label for="k">Chave do painel</label><input id="k" name="chave" type="password" autocomplete="current-password" required>
<label for="e">E-mail do comprador</label><input id="e" name="email" type="email" required value="${esc(email)}">
<label for="p">Produto</label><select id="p" name="produto">${opcoes(produto)}</select>
<label for="a">Ação</label>
<select id="a" name="acao">
<option value="link">Só gerar o link (eu mando no WhatsApp)</option>
<option value="email">Gerar o link e mandar o e-mail de acesso</option>
</select>
${msg ? `<p class="msg ${tipo}" role="status">${msg}</p>` : ''}
<button class="bt" type="submit">Executar</button>
</form>
${link ? `<p class="s">Link de acesso:</p><pre>${esc(link)}</pre>` : ''}`;
  return pagina({ titulo: 'Painel', corpo, wide: true });
}

export function GET() { return tela(); }

export async function POST(request) {
  const f = await request.formData();
  const email = normEmail(f.get('email'));
  const produto = PRODUTOS[f.get('produto')] ? String(f.get('produto')) : 'notebook';
  const base = { email, produto };
  if (!chaveOk(f.get('chave'))) return tela({ ...base, msg: 'Chave errada.', tipo: 'err' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return tela({ ...base, msg: 'Faltou o e-mail.', tipo: 'err' });
  const link = linkAcesso(produto, email);
  if (f.get('acao') !== 'email') return tela({ ...base, link, msg: 'Link gerado. Ele abre o material sem senha.', tipo: 'ok' });
  try {
    const r = await enviarBoasVindas({ produto, email, nome: '' });
    if (!r.enviado) return tela({ ...base, link, msg: 'E-mail não enviado: ' + esc(r.motivo) + '. Mande o link pelo WhatsApp.', tipo: 'err' });
  } catch (e) {
    return tela({ ...base, link, msg: 'O Gmail recusou o envio: ' + esc(e && e.message) + '. Mande o link pelo WhatsApp.', tipo: 'err' });
  }
  return tela({ ...base, link, msg: 'E-mail de acesso enviado para ' + esc(email) + '.', tipo: 'ok' });
}
