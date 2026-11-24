/* Webhook da Kiwify: https://cobaia-dev.vercel.app/api/kiwify?produto=<tablet|gta|notebook|suporte>
   Um webhook por produto na Kiwify, com os eventos: Compra aprovada, Compra reembolsada e Chargeback.
   A Kiwify assina cada envio: ?signature= é o HMAC-SHA1 (hex) do corpo cru, com o token do webhook como chave.
   O token fica na variável KIWIFY_TOKEN da Vercel (vários tokens separados por vírgula, se houver mais de um webhook). */
import crypto from 'node:crypto';
import { PRODUTOS, aplicarEvento, normEmail } from '../lib/compras.mjs';

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

  const base = {
    email, pedido, status,
    nome: c.full_name || c.first_name || c.name || '',
    celular: c.mobile || c.phone || '',
    origem: 'kiwify',
    extra: {
      produto_kiwify: (d.Product && (d.Product.product_name || d.Product.name)) || '',
      metodo: d.payment_method || '',
      aprovado_em: d.approved_date || '',
      // campos extras do checkout (ex.: modelo do tablet), se a Kiwify mandar
      campos: d.custom_fields || d.CustomFields || d.checkout_fields || null,
    },
  };
  await aplicarEvento({ produto, ...base });

  /* Order bump: no checkout do guia do notebook, o suporte pessoal pode vir junto no mesmo pedido.
     Se o aviso do guia citar o produto do suporte, o suporte é registrado também. Se a Kiwify mandar um aviso próprio do bump em
     ?produto=notebook-suporte, o registro é o mesmo e nada duplica. */
  let bump = false;
  if (produto === 'notebook') {
    const txt = corpo.toLowerCase();
    bump = txt.includes('suporte pessoal') || (process.env.KIWIFY_SUPORTE_ID && corpo.includes(process.env.KIWIFY_SUPORTE_ID));
    if (bump) await aplicarEvento({ produto: 'notebook-suporte', ...base });
  }
  /* Suporte comprado pelo botão da página /notebook: o checkout leva src=notebook (vem em TrackingParameters),
     então o suporte também libera o guia do notebook. Vendido por outro lugar, fica só o suporte. */
  if (produto === 'suporte') {
    const tp = JSON.stringify(d.TrackingParameters || d.tracking_parameters || {}).toLowerCase();
    bump = tp.includes('notebook');
    if (bump) await aplicarEvento({ produto: 'notebook-suporte', ...base });
  }
  return json({ ok: true, produto, status, bump });
}

export function GET() {
  return json({ ok: true, info: 'webhook da Kiwify: use POST' });
}
