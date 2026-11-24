/* /api/vagas : quantas vagas do brinde (guia grátis pros 10 primeiros do suporte) ainda restam. Usado pela landing /notebook. */
import { contarSuporte, BRINDE_LIMITE } from '../lib/compras.mjs';

export async function GET() {
  let restantes = null;
  try { restantes = Math.max(0, BRINDE_LIMITE - (await contarSuporte())); } catch (e) {}
  return new Response(JSON.stringify({ restantes, limite: BRINDE_LIMITE }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
