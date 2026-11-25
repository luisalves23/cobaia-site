/* /admin/ : painel do Luis. Protegido pela variável ADMIN_CHAVE (digitada a cada ação).
   - Consultar um comprador
   - Liberar um guia de tablet pronto para um comprador (slug da pasta em /tablet/g/)
   - Registrar uma compra feita fora do webhook (ex.: quem comprou antes dele existir)
   - Mandar de novo o e-mail de acesso (link e login)
   - Revogar o acesso na mão */
import crypto from 'node:crypto';
import { PRODUTOS, lerCompra, gravarCompra, aplicarEvento, normEmail } from '../lib/compras.mjs';
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

function tela({ msg = '', tipo = '', email = '', produto = 'tablet', resultado = '' } = {}) {
  const corpo = `
<span class="badge">PAINEL</span>
<h1>Compras</h1>
<p class="s">Cada ação pede a chave do painel (variável ADMIN_CHAVE na Vercel).</p>
<form method="post">
<label for="k">Chave do painel</label><input id="k" name="chave" type="password" autocomplete="current-password" required>
<label for="e">E-mail do comprador</label><input id="e" name="email" type="email" required value="${esc(email)}">
<label for="p">Produto</label><select id="p" name="produto">${opcoes(produto)}</select>
<label for="g">Guia do tablet (só para "Liberar guia")</label><input id="g" name="guia" placeholder="ex.: sm-t561m-r7q2" pattern="[a-z0-9\\-]+">
<label for="a">Ação</label>
<select id="a" name="acao">
<option value="consultar">Consultar</option>
<option value="liberar">Liberar guia do tablet pronto</option>
<option value="registrar">Registrar compra feita fora da Kiwify/webhook</option>
<option value="email">Mandar o e-mail de acesso (link e login)</option>
<option value="revogar">Revogar acesso</option>
</select>
${msg ? `<p class="msg ${tipo}" role="status">${msg}</p>` : ''}
<button class="bt" type="submit">Executar</button>
</form>
${resultado ? `<pre>${esc(resultado)}</pre>` : ''}`;
  return pagina({ titulo: 'Painel de compras', corpo, wide: true });
}

export function GET() { return tela(); }

export async function POST(request) {
  const f = await request.formData();
  const email = normEmail(f.get('email'));
  const produto = PRODUTOS[f.get('produto')] ? String(f.get('produto')) : 'tablet';
  const acao = String(f.get('acao') || 'consultar');
  const guia = String(f.get('guia') || '').trim().toLowerCase();
  const base = { email, produto };
  if (!chaveOk(f.get('chave'))) return tela({ ...base, msg: 'Chave errada.', tipo: 'err' });
  if (!email) return tela({ ...base, msg: 'Faltou o e-mail.', tipo: 'err' });

  if (acao === 'registrar') {
    const r = await aplicarEvento({ produto, email, pedido: 'manual-' + Date.now(), status: 'pago', origem: 'painel' });
    return tela({ ...base, msg: 'Compra registrada. O comprador já entra com o e-mail.', tipo: 'ok', resultado: JSON.stringify(r, null, 1) });
  }

  const reg = await lerCompra(produto, email);
  if (!reg) return tela({ ...base, msg: 'Nenhuma compra desse produto com esse e-mail.', tipo: 'err' });

  if (acao === 'liberar') {
    if (produto !== 'tablet' || !/^[a-z0-9-]+$/.test(guia)) return tela({ ...base, msg: 'Para liberar, escolha o produto do tablet e informe o slug do guia.', tipo: 'err', resultado: JSON.stringify(reg, null, 1) });
    reg.guias = Array.from(new Set([...(reg.guias || []), guia]));
    await gravarCompra(reg);
    return tela({ ...base, msg: `Guia liberado. Link pra mandar: https://cobaia-dev.vercel.app/tablet/g/${esc(guia)}/ (ele entra só com o e-mail).`, tipo: 'ok', resultado: JSON.stringify(reg, null, 1) });
  }
  if (acao === 'email') {
    if (!Object.values(reg.pedidos || {}).some((p) => p.status === 'pago')) return tela({ ...base, msg: 'Essa compra não está ativa. Nada enviado.', tipo: 'err', resultado: JSON.stringify(reg, null, 1) });
    try {
      const r = await enviarBoasVindas({ produto, email, nome: reg.nome });
      if (!r.enviado) return tela({ ...base, msg: 'E-mail não enviado: ' + esc(r.motivo) + '.', tipo: 'err', resultado: JSON.stringify(reg, null, 1) });
    } catch (e) {
      return tela({ ...base, msg: 'O Gmail recusou o envio: ' + esc(e && e.message) + '.', tipo: 'err', resultado: JSON.stringify(reg, null, 1) });
    }
    return tela({ ...base, msg: 'E-mail de acesso enviado para ' + esc(email) + '.', tipo: 'ok', resultado: JSON.stringify(reg, null, 1) });
  }
  if (acao === 'revogar') {
    for (const k of Object.keys(reg.pedidos || {})) if (reg.pedidos[k].status === 'pago') reg.pedidos[k] = { status: 'reembolsado', origem: 'painel', em: new Date().toISOString() };
    await gravarCompra(reg);
    return tela({ ...base, msg: 'Acesso revogado.', tipo: 'ok', resultado: JSON.stringify(reg, null, 1) });
  }
  return tela({ ...base, resultado: JSON.stringify(reg, null, 1) });
}
