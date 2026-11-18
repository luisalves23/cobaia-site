/* Entrar só com o e-mail da compra. POST email, produto (opcional), volta (opcional).
   Se a compra ainda não chegou (o aviso da Kiwify às vezes atrasa uns segundos), espera um pouco e tenta de novo. */
import { PRODUTOS, lerCompra, comprasAtivas, ativo, cookieSessao, normEmail, voltaSegura } from '../lib/compras.mjs';
import { redirecionar } from '../lib/ui.mjs';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST(request) {
  let f;
  try { f = await request.formData(); } catch (e) { return redirecionar('/acesso/?erro=formulario'); }
  const email = normEmail(f.get('email'));
  const produto = PRODUTOS[f.get('produto')] ? String(f.get('produto')) : '';
  const volta = voltaSegura(String(f.get('volta') || ''));
  const q = (erro) => '/acesso/?' + new URLSearchParams({ erro, email, ...(produto ? { produto } : {}), ...(volta ? { volta } : {}) });

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return redirecionar(q('email'));

  // vindo da página de obrigado (com produto): tenta por até ~9 s, pra cobrir o atraso do aviso da Kiwify
  const tentativas = produto ? 4 : 1;
  let regs = [];
  for (let i = 0; i < tentativas; i++) {
    regs = produto ? [await lerCompra(produto, email)].filter(Boolean) : await comprasAtivas(email);
    if (regs.some(ativo)) break;
    if (regs.length) break; // existe, mas sem compra ativa: não adianta esperar
    if (i < tentativas - 1) await espera(3000);
  }
  // com produto informado mas sem compra dele, ainda vale entrar se tiver outra compra ativa
  if (produto && !regs.some(ativo)) {
    const outras = await comprasAtivas(email);
    if (outras.some(ativo)) regs = outras;
  }

  if (!regs.length) return redirecionar(q('nao-encontrado'));
  if (!regs.some(ativo)) return redirecionar(q('encerrado'));

  const certo = regs.find(ativo);
  const destino = volta || (produto && regs.some((r) => r.produto === produto && ativo(r)) ? PRODUTOS[produto].destino : '/minha-area/');
  return redirecionar(destino || PRODUTOS[certo.produto].destino, { 'set-cookie': cookieSessao(email) });
}

export function GET() { return redirecionar('/acesso/'); }
