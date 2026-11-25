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
    'Toque no botão (ou no link abaixo). Ele é só seu.',
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

  const bt = (href, rotulo, cor = '#111') => `<p style="margin:18px 0"><a href="${esc(href)}" style="background:${cor};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(rotulo)}</a></p>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:560px">
<p>${esc(oi)}</p>
<p>Obrigado por comprar o <b>${esc(p.nome)}</b>. Seu pagamento foi aprovado e o acesso já está liberado.</p>
${produto === 'tablet' ? '<p>Agora eu monto o passo a passo para o seu modelo exato. Quando ficar pronto, ele aparece na sua área e eu te aviso no WhatsApp da compra.</p>' : ''}
${zap ? bt(zap, 'Chamar o Luis no WhatsApp', '#1a7f37') : ''}
${bt(acesso, produto === 'tablet' ? 'Entrar na minha área' : 'Abrir o meu guia')}

<ol>${passos.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
<p style="font-size:13px;color:#666">Se o botão não abrir, copie este link: <a href="${esc(acesso)}">${esc(acesso)}</a></p>
<p>Guarde este e-mail: o link vale para sempre.</p>
${p.suporte && !zap ? '<p>Suporte: eu vou te chamar no WhatsApp que você deixou na compra.</p>' : ''}
<p>Se travar em qualquer coisa, é só responder este e-mail.</p>
<p>Luis<br>@cobaia.dev</p></div>`;

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
