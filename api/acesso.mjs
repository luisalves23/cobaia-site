/* /acesso/ : a porta de entrada do comprador. Só o e-mail da compra. */
import { PRODUTOS, lerSessao, voltaSegura } from '../lib/compras.mjs';
import { pagina, esc } from '../lib/ui.mjs';

const ERROS = {
  'email': 'Esse e-mail não parece completo. Confira e tente de novo.',
  'nao-encontrado': 'Não achei compra com esse e-mail. Use o mesmo e-mail que você digitou na Kiwify. Se acabou de comprar, pode levar alguns minutos. Se continuar, me chama no WhatsApp.',
  'link': 'Esse link não está completo. Digite o e-mail da compra abaixo.',
  'formulario': 'Algo deu errado no envio. Tente de novo.',
};

export function GET(request) {
  const u = new URL(request.url);
  const erro = u.searchParams.get('erro') || '';
  const email = u.searchParams.get('email') || '';
  const produto = PRODUTOS[u.searchParams.get('produto')] ? u.searchParams.get('produto') : '';
  const volta = voltaSegura(u.searchParams.get('volta') || '');
  const s = lerSessao(request);
  const logado = s && s.produtos.length ? s.email : '';

  const corpo = `
<span class="badge">ÁREA DO COMPRADOR</span>
<h1>Seu <em>acesso</em></h1>
<p class="s">Digite o e-mail que você usou na compra. Sem senha: o material abre na hora.</p>
<form method="post" action="/api/entrar/">
<label for="e">E-mail da compra</label>
<input id="e" name="email" type="email" autocomplete="email" inputmode="email" required value="${esc(email)}" placeholder="voce@email.com">
${produto ? `<input type="hidden" name="produto" value="${esc(produto)}">` : ''}
${volta ? `<input type="hidden" name="volta" value="${esc(volta)}">` : ''}
${ERROS[erro] ? `<p class="msg err" role="alert">${esc(ERROS[erro])}</p>` : ''}
${u.searchParams.get('saiu') ? '<p class="msg">Você saiu. Para voltar, é só digitar o e-mail de novo.</p>' : ''}
<button class="bt" type="submit">Abrir meu material</button>
</form>
${logado ? `<p class="msg ok">Você já está conectado como <b>${esc(logado)}</b>. <a href="/minha-area/">Ir para a minha área</a></p>` : ''}
<p class="help">Não achou o e-mail certo? Procure na sua caixa de entrada o recibo da Kiwify: o e-mail da compra é o que recebeu esse recibo. Ainda travado? Me chama no direct do <a href="https://instagram.com/cobaia.dev" rel="noopener">@cobaia.dev</a>.</p>`;
  return pagina({ titulo: 'Seu acesso', corpo });
}
