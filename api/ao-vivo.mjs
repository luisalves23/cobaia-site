/* Medidor real da página /notebook: quantas pessoas estão nela agora e quantas visitas ela já teve.
   Cada aba manda um sinal a cada 60 s (POST). O Blob guarda um arquivo por visitante:
     ao-vivo/online/<id>   reescrito a cada sinal (a data de envio diz se a pessoa ainda está lá)
     ao-vivo/visitas/<id>  criado só na primeira visita daquele navegador
   GET devolve { online, visitas } e fica 20 s em cache na Vercel, pra não listar o Blob a cada acesso. */
import { put, list, del } from '@vercel/blob';

const json = (obj, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } });

const opts = { access: 'private', contentType: 'text/plain', addRandomSuffix: false, cacheControlMaxAge: 60 };

export async function POST(request) {
  const u = new URL(request.url);
  const id = u.searchParams.get('id') || '';
  if (!/^[a-z0-9]{12,40}$/.test(id)) return json({ ok: false }, 400);
  await put(`ao-vivo/online/${id}`, '1', { ...opts, allowOverwrite: true });
  if (u.searchParams.get('novo') === '1') {
    try { await put(`ao-vivo/visitas/${id}`, '1', { ...opts, allowOverwrite: false }); } catch (e) { /* já contado */ }
  }
  return json({ ok: true });
}

async function listarTudo(prefix, maxPaginas) {
  const out = [];
  let cursor;
  for (let i = 0; i < maxPaginas; i++) {
    const r = await list({ prefix, limit: 1000, cursor });
    out.push(...r.blobs);
    if (!r.hasMore) break;
    cursor = r.cursor;
  }
  return out;
}

export async function GET() {
  try {
    const agora = Date.now();
    const on = await listarTudo('ao-vivo/online/', 10);
    const online = on.filter((b) => agora - new Date(b.uploadedAt).getTime() < 90_000).length;
    const velhos = on.filter((b) => agora - new Date(b.uploadedAt).getTime() > 10 * 60_000).slice(0, 500).map((b) => b.url);
    if (velhos.length) await del(velhos).catch(() => {});
    const visitas = (await listarTudo('ao-vivo/visitas/', 100)).length;
    return json({ online, visitas }, 200, 'public, s-maxage=20, stale-while-revalidate=40');
  } catch (e) {
    return json({ online: 0, visitas: 0 }, 200, 'public, s-maxage=10');
  }
}
