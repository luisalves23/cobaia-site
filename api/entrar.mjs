/* /entrar/?t=<token> : o link pessoal que chega no e-mail da compra.
   Confere a assinatura, junta os acessos desse produto aos que a pessoa já tinha no cookie e manda para o material.
   POST (formulários antigos que pediam o e-mail): manda para /acesso/, que explica onde está o link. */
import { PRODUTOS, lerToken, lerSessao, cookieSessao, liberados } from '../lib/compras.mjs';
import { redirecionar } from '../lib/ui.mjs';

export function GET(request) {
  const u = new URL(request.url);
  const t = lerToken(u.searchParams.get('t') || '');
  if (!t) return redirecionar('/acesso/?erro=link');
  const atual = lerSessao(request);
  const mesmo = atual && atual.email === t.email;
  const produtos = [...(mesmo ? atual.produtos : []), ...liberados(t.produto)];
  return redirecionar(PRODUTOS[t.produto].destino, { 'set-cookie': cookieSessao(t.email, produtos) });
}

export function POST() { return redirecionar('/acesso/?erro=pelo-email'); }
