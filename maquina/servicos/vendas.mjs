/* Serviço vendas: recebe os avisos da Kiwify.
   Endereço do webhook (um por produto na Kiwify): <SITE>/webhook/kiwify?produto=<id>
   Eventos a marcar na Kiwify: Compra aprovada, Pix gerado, Compra reembolsada, Chargeback.
   A Kiwify assina cada envio: ?signature= é o HMAC-SHA1 (hex) do corpo cru, com o token do webhook como chave.
   Todo aviso é gravado cru em eventos_kiwify antes de qualquer coisa. */
import http from 'node:http';
import crypto from 'node:crypto';
import { CONFIG, exigir } from '../compartilhado/config.mjs';
import { banco } from '../compartilhado/banco.mjs';
import { lerCorpo, json, igual } from '../compartilhado/http.mjs';
import { PRODUTOS, liberados, normEmail, emailValido } from '../compartilhado/produtos.mjs';
import { liberar, cortarPedido } from '../compartilhado/acessos.mjs';
import { enviarEmail } from '../compartilhado/carteiro.mjs';
import { emailCompra } from '../compartilhado/modelos-email.mjs';

const STATUS = {
  order_approved: 'pago', paid: 'pago', approved: 'pago',
  order_refunded: 'reembolsado', refunded: 'reembolsado',
  chargeback: 'chargeback', chargedback: 'chargeback',
};

export function assinaturaOk(corpo, assinatura) {
  if (!/^[0-9a-f]{40}$/i.test(assinatura || '')) return false;
  return CONFIG.KIWIFY_TOKENS.some((t) => igual(crypto.createHmac('sha1', t).update(corpo).digest('hex'), assinatura.toLowerCase()));
}

/* O suporte do notebook pode vir como order bump do guia, ou comprado pela página /notebook. */
function produtoReal(produto, corpo, d) {
  if (produto === 'notebook') {
    if (corpo.toLowerCase().includes('suporte pessoal') || (CONFIG.KIWIFY_SUPORTE_ID && corpo.includes(CONFIG.KIWIFY_SUPORTE_ID))) return 'notebook-suporte';
  }
  if (produto === 'suporte') {
    const tp = JSON.stringify(d.TrackingParameters || d.tracking_parameters || {}).toLowerCase();
    if (tp.includes('notebook')) return 'notebook-suporte';
  }
  return produto;
}

export async function processar(corpo, produtoUrl, assinatura) {
  if (!assinaturaOk(corpo, assinatura)) return [401, { ok: false, erro: 'assinatura' }];
  if (!Object.hasOwn(PRODUTOS, produtoUrl)) return [400, { ok: false, erro: 'produto desconhecido na URL do webhook' }];

  let d;
  try { d = JSON.parse(corpo); } catch { return [400, { ok: false, erro: 'json' }]; }

  const c = d.Customer || d.customer || {};
  const email = normEmail(c.email || d.email);
  const pedido = String(d.order_id || d.order_ref || '');
  const tipo = String(d.webhook_event_type || '');
  const situacao = String(d.order_status || '');
  const db = banco();
  const evento = db.prepare('INSERT INTO eventos_kiwify (produto_url, tipo, status, pedido, email, corpo) VALUES (?, ?, ?, ?, ?, ?)')
    .run(produtoUrl, tipo, situacao, pedido, email, corpo).lastInsertRowid;
  const fim = (status, obj) => { db.prepare('UPDATE eventos_kiwify SET resultado = ? WHERE id = ?').run(JSON.stringify(obj), evento); return [status, obj]; };

  if (!pedido || !emailValido(email)) return fim(400, { ok: false, erro: 'sem e-mail ou pedido' });
  const nome = String(c.full_name || c.first_name || c.name || '').slice(0, 120) || null;
  const telefone = String(c.mobile || c.phone || '').replace(/\D/g, '').slice(0, 20) || null;
  const produto = produtoReal(produtoUrl, corpo, d);
  const status = STATUS[tipo] || STATUS[situacao];

  // Pix gerado e ainda não pago: guarda para o relógio da etapa 2.
  if (!status && String(d.payment_method || '').toLowerCase() === 'pix' && /waiting|pending|pix_created|created/i.test(tipo + ' ' + situacao)) {
    db.prepare(`INSERT INTO pix (pedido, email, telefone, nome, produto, valor, link_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (pedido) DO NOTHING`).run(pedido, email, telefone, nome, produto,
      String((d.Commissions && d.Commissions.charge_amount) || d.charge_amount || '') || null,
      String(d.checkout_link || d.pix_link || '') || null);
    return fim(200, { ok: true, pix: 'pendente' });
  }
  if (!status) return fim(200, { ok: true, ignorado: tipo || situacao || '?' });

  if (status !== 'pago') {
    const cortados = cortarPedido(pedido, status);
    return fim(200, { ok: true, status, cortados });
  }

  db.prepare("UPDATE pix SET pago_em = datetime('now') WHERE pedido = ? AND pago_em IS NULL").run(pedido);
  liberar({ email, produtos: liberados(produto), pedido, origem: 'kiwify', nome, telefone });

  // E-mail de acesso: uma vez por pedido. Se falhar, 500 faz a Kiwify reenviar o aviso e o e-mail tenta de novo.
  const jaFoi = db.prepare("SELECT 1 FROM envios WHERE tipo = ? AND ok = 1").get('compra:' + pedido);
  if (!jaFoi) {
    const m = emailCompra({ nome, email, produtos: liberados(produto) });
    const ok = await enviarEmail({ para: email, ...m, tipo: 'compra:' + pedido });
    if (!ok) return fim(500, { ok: false, erro: 'email', produto });
  }
  return fim(200, { ok: true, produto, status });
}

export function criarServidor() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/webhook/kiwify' && req.method === 'POST') {
        const corpo = await lerCorpo(req);
        const [st, obj] = await processar(corpo, url.searchParams.get('produto') || '', url.searchParams.get('signature') || '');
        return json(res, st, obj);
      }
      if (url.pathname === '/webhook/kiwify') return json(res, 200, { ok: true, info: 'webhook da Kiwify: use POST' });
      json(res, 404, { ok: false });
    } catch (e) {
      console.error('vendas:', e);
      json(res, 500, { ok: false, erro: 'interno' });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  exigir('KIWIFY_TOKENS', 'EMAIL_SERVICO');
  banco();
  criarServidor().listen(CONFIG.PORTA_VENDAS, '127.0.0.1', () => console.log('vendas na porta', CONFIG.PORTA_VENDAS));
}
