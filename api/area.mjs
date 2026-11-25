/* /minha-area/ : o que a pessoa liberou abrindo os links do e-mail. */
import { PRODUTOS, lerSessao } from '../lib/compras.mjs';
import { pagina, esc, redirecionar } from '../lib/ui.mjs';

function cartao(produto, email) {
  const p = PRODUTOS[produto];
  if (p.suporte) {
    const zap = String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
    const doNotebook = produto === 'notebook-suporte';
    const msg = encodeURIComponent('Oi, Luis! Comprei o suporte' + (doNotebook ? ' do notebook' : '') + ' (' + email + '). Vamos começar?');
    return `<div class="prod"><span class="pill">${doNotebook ? 'Suporte ativo · guia incluído' : 'Suporte ativo'}</span><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p>
${zap ? `<a class="bt" href="https://wa.me/${zap}?text=${msg}" target="_blank" rel="noopener">Chamar o Luis no WhatsApp</a>` : '<p>O Luis vai te chamar no WhatsApp que você deixou na compra.</p>'}</div>`;
  }
  if (produto === 'tablet') {
    return `<div class="prod"><span class="pill">Compra confirmada</span><h2>${esc(p.nome)}</h2>
<p>Eu monto o passo a passo pro seu modelo exato e te mando o link dele no WhatsApp da compra.</p>
<a class="bt alt" href="/tablet/o-mapa-do-tablet-velho.pdf" download>Baixar o mapa do tablet (PDF)</a></div>`;
  }
  return `<div class="prod"><span class="pill">Liberado</span><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p><a class="bt" href="${esc(p.destino)}">Abrir o guia</a></div>`;
}

export function GET(request) {
  const s = lerSessao(request);
  if (!s || !s.produtos.length) return redirecionar('/acesso/');
  // o suporte do notebook já mostra o WhatsApp; o guia do notebook vem logo abaixo
  const ordem = s.produtos.slice().sort((a, b) => Number(!!PRODUTOS[b].suporte) - Number(!!PRODUTOS[a].suporte));
  const corpo = `
<span class="badge">MINHA ÁREA</span>
<h1>Seu <em>material</em></h1>
<p class="s">Tudo o que você comprou fica aqui. Para voltar outro dia, abra de novo o link do e-mail.</p>
${ordem.map((p) => cartao(p, s.email)).join('')}
<p class="who"><span>${esc(s.email)}</span><a href="/api/sair">Sair</a></p>`;
  return pagina({ titulo: 'Minha área', corpo });
}
