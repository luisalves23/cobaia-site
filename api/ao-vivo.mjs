/* Medidor ao vivo da /notebook: DESLIGADO.
   A versão anterior gravava no Vercel Blob a cada 60 s por visitante. Isso estourou a cota do plano Hobby
   e a Vercel suspendeu o Blob inteiro, levando junto as compras (webhook da Kiwify e login do comprador).
   O Blob agora é só para as compras. Para voltar a ter um medidor, ele precisa de outro armazenamento. */
const json = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=3600' } });

export function POST() { return json({ ok: true, desligado: true }); }
export function GET() { return json({ ok: false, online: 0, visitas: 0, desligado: true }); }
