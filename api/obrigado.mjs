/* Páginas de obrigado da Kiwify (configuradas em cada produto):
     /notebook/obrigado/          → comprou só o guia
     /notebook/obrigado-suporte/  → comprou o suporte (o guia vem junto): o botão do WhatsApp vem primeiro
   O acesso vai por e-mail: um link pessoal, mandado assim que a Kiwify avisa a compra.
   O número do WhatsApp vem da variável WHATSAPP_SUPORTE (55 + DDD + número). */
import { pagina, esc } from '../lib/ui.mjs';

const aviso = `<div class="prod"><span class="pill">Olhe o seu e-mail</span><h2>Seu link de acesso já está a caminho</h2>
<p>Mandei para o e-mail da compra uma mensagem com o assunto <b>"Seu acesso"</b>. Toque no botão dela e o guia abre, sem senha. Chega em até 2 minutos.</p>
<p>Não chegou? Olhe em Spam e em Promoções.</p></div>`;

const zapLink = (texto) => {
  const zap = String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
  return zap ? `https://wa.me/${zap}?text=${encodeURIComponent(texto)}` : '';
};

export function GET(request) {
  const u = new URL(request.url);
  const p = u.searchParams.get('p') === 'notebook-suporte' ? 'notebook-suporte' : 'notebook';
  const email = (u.searchParams.get('email') || '').slice(0, 120);
  const pix = '<p class="help">Pagou com Pix ou boleto? O e-mail sai assim que o pagamento for confirmado (Pix leva poucos minutos).</p>';

  if (p === 'notebook-suporte') {
    const zap = zapLink('Oi, Luis! Comprei o suporte do notebook' + (email ? ` (${email})` : '') + '. Vamos começar?');
    const corpo = `
<span class="badge">COMPRA CONFIRMADA</span>
<h1>Bora <em>começar</em></h1>
<p class="s">Primeiro passo: me chama no WhatsApp. A mensagem já vai pronta, é só tocar em enviar. A partir daí eu acompanho você até o notebook ficar pronto.</p>
${zap ? `<a class="bt" href="${esc(zap)}" target="_blank" rel="noopener">Chamar o Luis no WhatsApp</a>` : '<div class="msg">Eu vou te chamar no WhatsApp que você deixou na compra.</div>'}
${aviso}
${pix}`;
    return pagina({ titulo: 'Obrigado', corpo });
  }

  const zap = zapLink('Oi, Luis! Comprei o guia do notebook' + (email ? ` (${email})` : '') + ' e não achei o e-mail com o link de acesso.');
  const corpo = `
<span class="badge">COMPRA CONFIRMADA</span>
<h1>Seu guia <em>chegou</em></h1>
<p class="s">Pagamento aprovado. O guia é seu.</p>
${aviso}
${pix}
${zap ? `<a class="bt alt" href="${esc(zap)}" target="_blank" rel="noopener">Não chegou? Me chama no WhatsApp</a>` : ''}`;
  return pagina({ titulo: 'Obrigado', corpo });
}
