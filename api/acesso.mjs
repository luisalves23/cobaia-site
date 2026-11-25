/* /acesso/ : a porta de entrada do comprador. O acesso é pelo link pessoal que chega no e-mail da compra. */
import { lerSessao } from '../lib/compras.mjs';
import { pagina, esc } from '../lib/ui.mjs';

const ERROS = {
  link: 'Esse link não está completo ou foi alterado. Abra de novo o link do e-mail, tocando direto nele.',
  'pelo-email': 'O acesso agora é pelo link que chegou no seu e-mail. Veja abaixo como achar.',
};

export function GET(request) {
  const u = new URL(request.url);
  const erro = u.searchParams.get('erro') || '';
  const s = lerSessao(request);
  const zap = String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
  const ajuda = zap ? `https://wa.me/${zap}?text=${encodeURIComponent('Oi, Luis! Comprei um guia e não achei o e-mail com o link de acesso.')}` : '';

  const corpo = `
<span class="badge">ÁREA DO COMPRADOR</span>
<h1>Seu <em>acesso</em></h1>
${ERROS[erro] ? `<p class="msg err" role="alert">${esc(ERROS[erro])}</p>` : ''}
${u.searchParams.get('saiu') ? '<p class="msg">Você saiu. Para voltar, é só abrir de novo o link do e-mail.</p>' : ''}
${s && s.produtos.length ? `<p class="msg ok">Você já está conectado como <b>${esc(s.email)}</b>. <a href="/minha-area/">Ir para o meu material</a></p>` : ''}
<p class="s">Logo depois da compra, eu te mando um e-mail com o assunto <b>"Seu acesso"</b>. Dentro dele tem um link só seu: toque nele e o material abre. Sem senha.</p>
<ol class="s">
<li>Procure na caixa de entrada do e-mail que você usou na compra.</li>
<li>Não achou? Olhe em Spam e em Promoções.</li>
<li>Guarde esse e-mail: o link vale para sempre, em qualquer aparelho.</li>
</ol>
${ajuda ? `<a class="bt" href="${esc(ajuda)}" target="_blank" rel="noopener">Não achei o e-mail: falar com o Luis</a>` : '<p class="help">Não achou? Me chama no direct do <a href="https://instagram.com/cobaia.dev" rel="noopener">@cobaia.dev</a>.</p>'}`;
  return pagina({ titulo: 'Seu acesso', corpo });
}
