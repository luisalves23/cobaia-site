/* Os e-mails que a plataforma manda. Texto curto, um botão, nenhuma imagem pesada. */
import { infoProduto } from './produtos.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

export function emailCompra({ site, nome, email, produtos }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || '';
  const oi = primeiro ? `Oi, ${primeiro}!` : 'Oi!';
  const nomes = produtos.map((p) => (infoProduto(p) || { nome: p }).nome);
  const url = site + '/area/';
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

/* Manda pela API do Brevo ou do Resend (planos grátis). EMAIL_SERVICO=console só escreve no log.
   Registra cada envio na tabela envios. Nunca lança erro: devolve true se saiu. */
export async function enviarEmail(env, { para, assunto, html, texto, tipo }) {
  const de = env.EMAIL_DE || 'Luis do Cobaia <ola@cobaia.dev.br>';
  const resp = env.EMAIL_RESPONDER_PARA || '';
  let ok = false, erro = null;
  try {
    let r;
    if (env.EMAIL_SERVICO === 'brevo') {
      const m = /^(.*)<([^>]+)>\s*$/.exec(de);
      const corpo = { sender: m ? { name: m[1].trim(), email: m[2].trim() } : { email: de.trim() }, to: [{ email: para }], subject: assunto, htmlContent: html, textContent: texto };
      if (resp) corpo.replyTo = { email: resp };
      r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env.EMAIL_CHAVE, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(corpo) });
    } else if (env.EMAIL_SERVICO === 'resend') {
      const corpo = { from: de, to: [para], subject: assunto, html, text: texto };
      if (resp) corpo.reply_to = resp;
      r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.EMAIL_CHAVE, 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
    } else if (env.EMAIL_SERVICO === 'console') {
      console.log(`[e-mail para ${para}] ${assunto}\n${texto}`);
    } else throw new Error('EMAIL_SERVICO não configurado');
    if (r && !r.ok) throw new Error(env.EMAIL_SERVICO + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
    ok = true;
  } catch (e) { erro = String((e && e.message) || e).slice(0, 500); console.error('e-mail falhou:', tipo, erro); }
  await env.DB.prepare('INSERT INTO envios (canal, para, assunto, tipo, ok, erro) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('email', para, assunto, tipo || '', ok ? 1 : 0, erro).run();
  return ok;
}
