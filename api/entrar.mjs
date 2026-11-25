/* /entrar/?t=<token> : o link pessoal que chega no e-mail da compra.
   Confere a assinatura, junta os acessos desse produto aos que a pessoa já tinha no cookie e manda para o material.
   POST email, produto (opcional), volta (opcional): entra só com o e-mail, se ele estiver na lista ACESSO_LIBERADO. */
import { PRODUTOS, lerToken, lerSessao, cookieSessao, liberados, acessosDoEmail, normEmail, voltaSegura } from '../lib/compras.mjs';
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

export async function POST(request) {
  let f;
  try { f = await request.formData(); } catch (e) { return redirecionar('/acesso/?erro=formulario'); }
  const email = normEmail(f.get('email'));
  const produto = PRODUTOS[f.get('produto')] ? String(f.get('produto')) : '';
  const volta = voltaSegura(String(f.get('volta') || ''));
  const q = (erro) => '/acesso/?' + new URLSearchParams({ erro, email, ...(produto ? { produto } : {}), ...(volta ? { volta } : {}) });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return redirecionar(q('email'));

  const acessos = acessosDoEmail(email);
  if (!acessos.length) return redirecionar(q('nao-encontrado'));
  const atual = lerSessao(request);
  const todos = [...(atual && atual.email === email ? atual.produtos : []), ...acessos];
  const cookie = { 'set-cookie': cookieSessao(email, todos) };

  if (volta) return redirecionar(volta, cookie);
  // suporte: vai pra área, onde o botão do WhatsApp aparece primeiro
  if (acessos.includes('notebook-suporte') || acessos.includes('suporte')) return redirecionar('/minha-area/', cookie);
  if (produto && acessos.includes(produto)) return redirecionar(PRODUTOS[produto].destino, cookie);
  const unico = acessos.length === 1 ? PRODUTOS[acessos[0]].destino : '/minha-area/';
  return redirecionar(unico, cookie);
}
