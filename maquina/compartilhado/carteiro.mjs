/* Carteiro: manda e-mail pela API de um serviço com plano grátis (Brevo ou Resend) e registra cada envio.
   EMAIL_SERVICO=console só imprime no log (para testar sem mandar nada). */
import { CONFIG } from './config.mjs';
import { banco } from './banco.mjs';

function remetente() {
  const m = /^(.*)<([^>]+)>\s*$/.exec(CONFIG.EMAIL_DE);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Cobaia', email: CONFIG.EMAIL_DE.trim() };
}

async function brevo({ para, assunto, html, texto }) {
  const corpo = { sender: remetente(), to: [{ email: para }], subject: assunto, htmlContent: html, textContent: texto };
  if (CONFIG.EMAIL_RESPONDER_PARA) corpo.replyTo = { email: CONFIG.EMAIL_RESPONDER_PARA };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': CONFIG.EMAIL_CHAVE, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('brevo ' + r.status + ' ' + (await r.text()).slice(0, 300));
}

async function resend({ para, assunto, html, texto }) {
  const corpo = { from: CONFIG.EMAIL_DE, to: [para], subject: assunto, html, text: texto };
  if (CONFIG.EMAIL_RESPONDER_PARA) corpo.reply_to = CONFIG.EMAIL_RESPONDER_PARA;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: 'Bearer ' + CONFIG.EMAIL_CHAVE, 'content-type': 'application/json' },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('resend ' + r.status + ' ' + (await r.text()).slice(0, 300));
}

/* Manda e registra. Devolve true se saiu. Nunca lança erro: quem chama decide o que fazer com o false. */
export async function enviarEmail({ para, assunto, html, texto, tipo }) {
  let ok = false, erro = null;
  try {
    if (CONFIG.EMAIL_SERVICO === 'brevo') await brevo({ para, assunto, html, texto });
    else if (CONFIG.EMAIL_SERVICO === 'resend') await resend({ para, assunto, html, texto });
    else if (CONFIG.EMAIL_SERVICO === 'console') console.log(`[e-mail para ${para}] ${assunto}\n${texto}`);
    else throw new Error('EMAIL_SERVICO não configurado');
    ok = true;
  } catch (e) { erro = String(e && e.message || e).slice(0, 500); console.error('e-mail falhou:', tipo, erro); }
  banco().prepare('INSERT INTO envios (canal, para, assunto, tipo, ok, erro) VALUES (?, ?, ?, ?, ?, ?)')
    .run('email', para, assunto, tipo || '', ok ? 1 : 0, erro);
  return ok;
}
