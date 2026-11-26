/* Os e-mails que a máquina manda. Texto curto, um botão, nenhuma imagem pesada. */
import { CONFIG } from './config.mjs';
import { esc } from './http.mjs';
import { infoProduto } from './produtos.mjs';

function moldura(titulo, miolo) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0c0c0c;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#f2efe8">
<div style="max-width:520px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:20px;padding:32px 26px">
<p style="margin:0 0 6px;font:700 12px monospace;letter-spacing:.12em;color:#ff2d2d">@COBAIA.DEV</p>
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2">${esc(titulo)}</h1>
${miolo}
<p style="margin:26px 0 0;font-size:13px;color:#8a8a8a">Dúvida? É só responder este e-mail.</p>
</div></body></html>`;
}

const botao = (url, txt) => `<p style="margin:22px 0"><a href="${esc(url)}" style="display:inline-block;background:#ff2d2d;color:#0c0c0c;text-decoration:none;font-weight:700;font-size:17px;border-radius:12px;padding:13px 26px">${esc(txt)}</a></p>`;

export function emailCompra({ nome, email, produtos }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || '';
  const oi = primeiro ? `Oi, ${primeiro}!` : 'Oi!';
  const nomes = produtos.map((p) => (infoProduto(p) || { nome: p }).nome);
  const url = CONFIG.SITE + '/area/';
  const tablet = produtos.includes('tablet');
  const linhasTxt = [
    oi, '',
    'Seu pagamento foi aprovado e o acesso já está liberado:', ...nomes.map((n) => '- ' + n), '',
    tablet ? 'O guia do tablet é feito para o seu modelo. Quando ficar pronto, ele aparece na sua área e eu te aviso no WhatsApp.' : '',
    'Para entrar: abra ' + url + ', digite este e-mail (' + email + ') e use o código que chega aqui na hora.',
    'Não tem senha. Vale para qualquer aparelho e para tudo que você comprar comigo.',
    '', 'Luis, do @cobaia.dev',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  const html = moldura('Seu acesso está liberado', `
<p style="margin:0 0 10px;font-size:16px;line-height:1.5">${esc(oi)} Seu pagamento foi aprovado. Já está liberado:</p>
<ul style="margin:0 0 6px;padding-left:20px;font-size:16px;line-height:1.6">${nomes.map((n) => `<li><b>${esc(n)}</b></li>`).join('')}</ul>
${tablet ? '<p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#cfcac0">O guia do tablet é feito para o seu modelo. Quando ficar pronto, ele aparece na sua área e eu te aviso no WhatsApp.</p>' : ''}
${botao(url, 'Entrar na minha área')}
<p style="margin:0;font-size:15px;line-height:1.5;color:#cfcac0">Digite este e-mail (<b style="color:#f2efe8">${esc(email)}</b>) e use o código que chega aqui na hora. Não tem senha.</p>`);
  return { assunto: 'Seu acesso está liberado', html, texto: linhasTxt.join('\n') };
}

export function emailCodigo({ codigo }) {
  const texto = `Seu código para entrar no @cobaia.dev: ${codigo}\n\nEle vale por 15 minutos e só funciona uma vez.\nSe não foi você que pediu, pode ignorar este e-mail.`;
  const html = moldura('Seu código de acesso', `
<p style="margin:0 0 14px;font-size:16px;line-height:1.5">Digite este código na tela de entrada:</p>
<p style="margin:0 0 14px;font:700 40px monospace;letter-spacing:.25em;color:#f2efe8">${esc(codigo)}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#8a8a8a">Vale por 15 minutos e só funciona uma vez. Se não foi você que pediu, pode ignorar.</p>`);
  return { assunto: `Seu código: ${codigo}`, html, texto };
}
