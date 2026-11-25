/* Páginas de obrigado da Kiwify (configuradas em cada produto):
     /notebook/obrigado/          → comprou só o guia
     /notebook/obrigado-suporte/  → comprou o suporte (o guia vem junto): o botão do WhatsApp vem primeiro
   O formulário de e-mail vai direto pra /api/entrar com o produto, que espera até ~9 s pelo aviso da Kiwify.
   O número do WhatsApp vem da variável WHATSAPP_SUPORTE (55 + DDD + número). */
import { pagina, esc } from '../lib/ui.mjs';

const form = (produto, email, botao, alt = false) => `<form method="post" action="/api/entrar/">
<label for="e">E-mail da compra</label>
<input id="e" name="email" type="email" autocomplete="email" inputmode="email" required value="${esc(email)}" placeholder="voce@email.com">
<input type="hidden" name="produto" value="${produto}">
<button class="bt${alt ? ' alt' : ''}" type="submit">${botao}</button>
</form>`;

const zapLink = (texto) => {
  const zap = String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
  return zap ? `https://wa.me/${zap}?text=${encodeURIComponent(texto)}` : '';
};

export function GET(request) {
  const u = new URL(request.url);
  const p = u.searchParams.get('p') === 'notebook-suporte' ? 'notebook-suporte' : 'notebook';
  const email = (u.searchParams.get('email') || '').slice(0, 120);
  const pix = '<p class="help">Pagou com Pix ou boleto? O acesso abre assim que o pagamento for confirmado (Pix leva poucos minutos).</p>';

  if (p === 'notebook-suporte') {
    const zap = zapLink('Oi, Luis! Comprei o suporte do notebook' + (email ? ` (${email})` : '') + '. Vamos começar?');
    const corpo = `
<span class="badge">COMPRA CONFIRMADA</span>
<h1>Bora <em>começar</em></h1>
<p class="s">Primeiro passo: me chama no WhatsApp. A mensagem já vai pronta, é só tocar em enviar. A partir daí eu acompanho você até o notebook ficar pronto.</p>
${zap ? `<a class="bt" href="${esc(zap)}" target="_blank" rel="noopener">Chamar o Luis no WhatsApp</a>` : '<div class="msg">Eu vou te chamar no WhatsApp que você deixou na compra.</div>'}
<div class="prod"><span class="pill">Guia incluído</span><h2>O guia completo</h2><p>Ele já é seu. Digite o e-mail da compra pra abrir.</p>
${form('notebook-suporte', email, 'Entrar no guia', true)}</div>
${pix}`;
    return pagina({ titulo: 'Obrigado', corpo });
  }

  const zap = zapLink('Oi, Luis! Comprei o guia do notebook' + (email ? ` (${email})` : '') + ' e preciso de uma ajuda com o acesso.');
  const corpo = `
<span class="badge">COMPRA CONFIRMADA</span>
<h1>Seu guia <em>chegou</em></h1>
<p class="s">Digite o e-mail que você usou na compra. Não tem senha: o e-mail é a sua chave.</p>
${form('notebook', email, 'Entrar no guia agora')}
<p class="help">Pra voltar depois, é só entrar em cobaia-dev.vercel.app/acesso com o mesmo e-mail.</p>
${pix}
${zap ? `<a class="bt alt" href="${esc(zap)}" target="_blank" rel="noopener">Dúvida? Me chama no WhatsApp</a>` : ''}`;
  return pagina({ titulo: 'Obrigado', corpo });
}
