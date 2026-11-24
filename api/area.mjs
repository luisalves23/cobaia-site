/* /minha-area/ : tudo o que o comprador tem, conferido na hora no cadastro. */
import { PRODUTOS, lerSessao, comprasAtivas, ativo } from '../lib/compras.mjs';
import { pagina, esc, redirecionar } from '../lib/ui.mjs';

function cartao(reg) {
  const p = PRODUTOS[reg.produto];
  if (!ativo(reg)) {
    return `<div class="prod"><span class="pill off">Acesso encerrado</span><h2>${esc(p.nome)}</h2><p>Essa compra foi reembolsada ou contestada, então o material saiu da sua área.</p></div>`;
  }
  if (reg.produto === 'tablet') {
    const guias = reg.guias || [];
    if (guias.length) {
      return `<div class="prod"><span class="pill">Liberado</span><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p>
${guias.map((g) => `<a class="bt" href="/tablet/g/${esc(g)}/">Abrir o guia${guias.length > 1 ? ' ' + esc(g.split('-')[0].toUpperCase()) : ''}</a>`).join('')}</div>`;
    }
    return `<div class="prod"><span class="pill wait">Compra confirmada · guia em produção</span><h2>${esc(p.nome)}</h2>
<p>Seu pagamento entrou. Agora eu monto o passo a passo pro seu modelo exato. Quando ficar pronto, ele aparece aqui nesta página e eu te aviso no WhatsApp da compra.</p>
<a class="bt alt" href="/tablet/o-mapa-do-tablet-velho.pdf" download>Enquanto isso: baixar o mapa do tablet (PDF)</a></div>`;
  }
  if (p.suporte) {
    const zap = String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
    const doNotebook = reg.produto === 'notebook-suporte';
    const msg = encodeURIComponent('Oi, Luis! Comprei o suporte pessoal' + (doNotebook ? ' do notebook' : '') + ' (' + reg.email + '). Vamos começar?');
    return `<div class="prod"><span class="pill">${doNotebook ? 'Suporte ativo · guia incluído' : 'Suporte ativo'}</span><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p>
${p.guia ? `<a class="bt" href="${esc(p.guia)}">Abrir o guia</a>` : ''}
${zap ? `<a class="bt${p.guia ? ' alt' : ''}" href="https://wa.me/${zap}?text=${msg}" target="_blank" rel="noopener">Chamar o Luis no WhatsApp</a>` : '<p>O Luis vai te chamar no WhatsApp que você deixou na compra.</p>'}</div>`;
  }
  return `<div class="prod"><span class="pill">Liberado</span><h2>${esc(p.nome)}</h2><p>${esc(p.descricao)}</p><a class="bt" href="${esc(p.destino)}">Abrir o guia</a></div>`;
}

export async function GET(request) {
  const email = lerSessao(request);
  if (!email) return redirecionar('/acesso/');
  let regs = await comprasAtivas(email);
  if (!regs.length) return redirecionar('/acesso/?erro=nao-encontrado&email=' + encodeURIComponent(email));
  // o suporte comprado pela página do notebook gera dois registros; mostra só o cartão do notebook
  if (regs.some((r) => r.produto === 'notebook-suporte')) regs = regs.filter((r) => r.produto !== 'suporte');
  regs.sort((a, b) => Number(ativo(b)) - Number(ativo(a)));
  const corpo = `
<span class="badge">MINHA ÁREA</span>
<h1>Seu <em>material</em></h1>
<p class="s">Tudo o que você comprou fica aqui. Salve esta página: é só voltar e entrar com o mesmo e-mail.</p>
${regs.map(cartao).join('')}
<p class="who"><span>${esc(email)}</span><a href="/api/sair">Sair</a></p>`;
  return pagina({ titulo: 'Minha área', corpo });
}
