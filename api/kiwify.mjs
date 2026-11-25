/* Webhook da Kiwify: https://cobaia-dev.vercel.app/api/kiwify?produto=<tablet|gta|notebook|notebook-suporte|suporte>
   Um webhook por produto na Kiwify, com os eventos: Compra aprovada, Compra reembolsada e Chargeback.
   A Kiwify assina cada envio: ?signature= é o HMAC-SHA1 (hex) do corpo cru, com o token do webhook como chave.
   O token fica na variável KIWIFY_TOKEN da Vercel (vários tokens separados por vírgula).
   Compra aprovada: manda para o comprador o e-mail com o link pessoal de acesso (lib/email.mjs). Nada é gravado. */
import crypto from 'node:crypto';
import { PRODUTOS, normEmail } from '../lib/compras.mjs';
import { enviarBoasVindas } from '../lib/email.mjs';

const STATUS = {
  order_approved: 'pago', paid: 'pago',
  order_refunded: 'reembolsado', refunded: 'reembolsado',
  chargeback: 'chargeback', chargedback: 'chargeback',
};

function assinaturaOk(corpo, assinatura) {
  const tokens = (process.env.KIWIFY_TOKEN || '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!tokens.length || !/^[0-9a-f]{40}$/i.test(assinatura || '')) return false;
  const rec = Buffer.from(assinatura.toLowerCase());
  return tokens.some((t) => {
    const certo = Buffer.from(crypto.createHmac('sha1', t).update(corpo).digest('hex'));
    return crypto.timingSafeEqual(certo, rec);
  });
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function POST(request) {
  const url = new URL(request.url);
  const corpo = await request.text();
  if (!assinaturaOk(corpo, url.searchParams.get('signature'))) return json({ ok: false, erro: 'assinatura' }, 401);

  const produto = url.searchParams.get('produto') || '';
  if (!PRODUTOS[produto]) return json({ ok: false, erro: 'produto desconhecido na URL do webhook' }, 400);

  let d;
  try { d = JSON.parse(corpo); } catch (e) { return json({ ok: false, erro: 'json' }, 400); }

  const status = STATUS[d.webhook_event_type] || STATUS[d.order_status];
  // eventos que não mexem no acesso (pix gerado, boleto, recusada...): só confirma o recebimento
  if (!status) return json({ ok: true, ignorado: d.webhook_event_type || d.order_status || '?' });

  const c = d.Customer || d.customer || {};
  const email = normEmail(c.email || d.email);
  const pedido = String(d.order_id || d.order_ref || '');
  if (!email || !pedido) return json({ ok: false, erro: 'sem e-mail ou pedido' }, 400);

  /* Qual e-mail mandar: o suporte do notebook pode vir junto no pedido do guia (order bump)
     ou ser comprado pela página /notebook (src=notebook). Nesses casos vai o e-mail do suporte, que já libera o guia. */
  let alvo = produto;
  if (produto === 'notebook') {
    const txt = corpo.toLowerCase();
    if (txt.includes('suporte pessoal') || (process.env.KIWIFY_SUPORTE_ID && corpo.includes(process.env.KIWIFY_SUPORTE_ID))) alvo = 'notebook-suporte';
  }
  if (produto === 'suporte') {
    const tp = JSON.stringify(d.TrackingParameters || d.tracking_parameters || {}).toLowerCase();
    if (tp.includes('notebook')) alvo = 'notebook-suporte';
  }

  // Reembolso e chargeback: sem cadastro, não há o que cortar. Só registra no log da Vercel.
  if (status !== 'pago') { console.log('kiwify', status, produto, pedido); return json({ ok: true, produto, status }); }

  const nome = c.full_name || c.first_name || c.name || '';
  let email_ = 'falhou';
  try {
    const r = await enviarBoasVindas({ produto: alvo, email, nome });
    email_ = r.enviado ? 'enviado' : r.motivo;
    if (!r.enviado) console.log('email de acesso nao enviado:', r.motivo, alvo, pedido);
  } catch (e) {
    console.error('email de acesso falhou:', e && e.message, alvo, pedido);
    // 500 faz a Kiwify reenviar o aviso mais tarde, e o e-mail tenta de novo
    return json({ ok: false, erro: 'email', produto: alvo }, 500);
  }
  return json({ ok: true, produto: alvo, status, bump: alvo !== produto, email: email_ });
}

export function GET() {
  return json({ ok: true, info: 'webhook da Kiwify: use POST' });
}
