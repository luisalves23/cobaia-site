/* E-mail de boas-vindas mandado pelo próprio site quando uma compra é aprovada.
   Sai pelo Gmail do Luis (SMTP com senha de app), então chega como um e-mail pessoal dele.
   Variáveis na Vercel:
     EMAIL_USUARIO   o endereço do Gmail que envia (ex.: fulano@gmail.com)
     EMAIL_SENHA_APP a senha de app de 16 letras do Google (não é a senha da conta)
   Sem essas variáveis o site não manda nada e a compra segue normal. */
import nodemailer from 'nodemailer';
import { PRODUTOS, SITE, linkAcesso } from './compras.mjs';
import { esc } from './ui.mjs';


export const emailConfigurado = () => !!(process.env.EMAIL_USUARIO && process.env.EMAIL_SENHA_APP);

function linkZap(produto, email) {
  const zap = String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, '');
  if (!zap) return '';
  const msg = 'Oi, Luis! Comprei o suporte' + (produto === 'notebook-suporte' ? ' do notebook' : '') + ' (' + email + '). Vamos começar?';
  return `https://wa.me/${zap}?text=${encodeURIComponent(msg)}`;
}

/* Monta assunto, texto e HTML do e-mail para um produto. Exportado para teste. */
export function montarEmail({ produto, email, nome }) {
  const p = PRODUTOS[produto];
  if (!p) return null;
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || '';
  const oi = primeiro ? `Oi, ${primeiro}!` : 'Oi!';
  const acesso = linkAcesso(produto, email);
  const zap = p.suporte ? linkZap(produto, email) : '';

  const passos = [
    'Toque na imagem ou no botão. Ele é só seu.',
    'O material abre na hora. Não tem senha.',
    'Para voltar outro dia, de qualquer aparelho, abra este mesmo link.',
  ];
  const linhas = [oi, '', `Obrigado por comprar o ${p.nome}. Seu pagamento foi aprovado e o acesso já está liberado.`, ''];
  if (produto === 'tablet') {
    linhas.push('Agora eu monto o passo a passo para o seu modelo exato. Quando ficar pronto, ele aparece na sua área e eu te aviso no WhatsApp da compra.', '');
    linhas.push('Seu link de acesso:');
  } else {
    linhas.push('Seu link de acesso:');
  }
  linhas.push(acesso, '');
  passos.forEach((t, i) => linhas.push(`${i + 1}. ${t}`));
  linhas.push('', 'Guarde este e-mail: o link vale para sempre.');
  if (p.suporte) {
    linhas.push('', zap
      ? `Suporte: me chama no WhatsApp por este link, que eu te acompanho do início ao fim: ${zap}`
      : 'Suporte: eu vou te chamar no WhatsApp que você deixou na compra.');
  }
  linhas.push('', 'Se travar em qualquer coisa, é só responder este e-mail.', '', 'Luis', '@cobaia.dev');
  const texto = linhas.join('\n');

  /* HTML no estilo "cartão": capa do produto clicável, botão grande, caixa com o e-mail da compra.
     Imagens pelo endereço público do site; só cores com background-color (o Gmail corta o atalho "background"). */
  const capa = { notebook: 'og/dia06.png', 'notebook-suporte': 'og/dia06.png', gta: 'og/dia11.png', tablet: 'og/dia08.png' }[produto] || 'og/dia06.png';
  const cor = produto === 'gta' ? '#c0398f' : '#e8322b';
  const bola = (n) => `<td valign="top" style="padding:0 10px 10px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="26" height="26" align="center" bgcolor="#111111" style="background-color:#111111;border-radius:13px;color:#ffffff;font-weight:bold;font-size:13px;line-height:26px">${n}</td></tr></table></td>`;
  const bt = (href, rotulo, c) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${c}" style="background-color:${c};border-radius:999px"><a href="${esc(href)}" target="_blank" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;padding:16px 34px">${esc(rotulo)} &rarr;</a></td></tr></table></td></tr></table>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;background-color:#f3f1ee;padding:24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f1ee" style="background-color:#f3f1ee"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden">
<tr><td><a href="${esc(acesso)}" target="_blank"><img src="${SITE}/assets/${capa}" width="520" alt="${esc(p.nome)}" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${cor};font-weight:bold">Acesso liberado</p>
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111111">${esc(oi)} Seu material está pronto.</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#333333">Obrigado por comprar o <b>${esc(p.nome)}</b>. Seu pagamento foi aprovado e o acesso já está liberado.</p>
${produto === 'tablet' ? '<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#333333">Agora eu monto o passo a passo para o seu modelo exato. Quando ficar pronto, ele aparece na sua área e eu te aviso no WhatsApp da compra.</p>' : ''}
${bt(acesso, produto === 'tablet' ? 'Entrar na minha área' : 'Abrir meu material', cor)}
${zap ? bt(zap, 'Chamar o Luis no WhatsApp', '#1a7f37') : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#faf7f2" style="background-color:#faf7f2;border:2px dashed ${cor};border-radius:12px"><tr><td align="center" style="padding:16px 18px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#777777">Seu e-mail de acesso</p>
<p style="margin:0;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;color:#111111;word-break:break-all">${esc(email)}</p>
<p style="margin:6px 0 0;font-size:12px;color:#777777">Se o botão não abrir, entre em ${SITE.replace('https://', '')}/acesso e digite este e-mail. Não tem senha.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 28px 4px">
<p style="margin:0 0 10px;font-size:16px;font-weight:bold;color:#111111">Como entrar</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5;color:#333333">
${passos.map((t, i) => `<tr>${bola(i + 1)}<td style="padding:2px 0 10px">${esc(t)}</td></tr>`).join('\n')}
</table>
</td></tr>
${p.suporte && !zap ? '<tr><td style="padding:0 28px 8px"><p style="margin:0;font-size:15px;line-height:1.6;color:#333333">Suporte: eu vou te chamar no WhatsApp que você deixou na compra.</p></td></tr>' : ''}
<tr><td style="padding:0 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#111111" style="background-color:#111111;border-radius:12px"><tr><td style="padding:16px 18px;color:#f3f1ee;font-size:14px;line-height:1.6"><b style="color:${cor}">Guarde este e-mail:</b> o botão vale para sempre, de qualquer aparelho.</td></tr></table></td></tr>
<tr><td style="padding:18px 28px 26px">
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333">Se travar em qualquer coisa, é só responder este e-mail.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:12px"><img src="${SITE}/assets/img/luis.jpg" width="48" height="48" alt="Luis" style="display:block;border-radius:24px;border:0"></td><td valign="middle" style="font-size:14px;line-height:1.4;color:#333333">Abraço,<br><b style="color:#111111">Luis</b> &middot; @cobaia.dev</td></tr></table>
</td></tr>
</table></td></tr></table></div>`;

  return { assunto: `Seu acesso: ${p.nome}`, texto, html };
}

let transporte = null;
/* Para os testes trocarem o envio real por um falso. */
export function usarTransporte(t) { transporte = t; }

export async function enviarBoasVindas({ produto, email, nome }) {
  if (!transporte && !emailConfigurado()) return { enviado: false, motivo: 'sem EMAIL_USUARIO/EMAIL_SENHA_APP' };
  const m = montarEmail({ produto, email, nome });
  if (!m) return { enviado: false, motivo: 'produto desconhecido' };
  const t = transporte || nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USUARIO, pass: String(process.env.EMAIL_SENHA_APP).replace(/\s/g, '') },
  });
  await t.sendMail({
    from: { name: 'Luis | cobaia.dev', address: process.env.EMAIL_USUARIO || 'teste@exemplo.invalid' },
    to: email,
    subject: m.assunto,
    text: m.texto,
    html: m.html,
  });
  return { enviado: true };
}
