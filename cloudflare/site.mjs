/* Site público do @cobaia.dev em cobaia.dev.br (Cloudflare Workers + arquivos estáticos).
   As páginas saem direto da pasta do repositório. Este Worker só cuida do que não é página pública:
   - a área do comprador e os guias pagos moram em cobaia.dev.br/area (outro Worker, repositório cobaia-materiais);
   - quem comprou antes da mudança continua no site antigo da Vercel (decisão do Luis, 26/11/2026);
   - as funções da Vercel (/api/...) não existem aqui.
   O que não vai para o ar como arquivo fica em /.assetsignore. Redirecionamentos simples em /_redirects. */

const VERCEL = 'https://cobaia-dev.vercel.app';

function ir(destino, status = 302) {
  return new Response(null, { status, headers: { location: destino, 'cache-control': 'no-store' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return new Response('caminho inválido', { status: 400 }); }
    if (/\.\.|\\|\0/.test(p)) return new Response('caminho inválido', { status: 400 });
    const low = p.toLowerCase();

    // Guias pagos novos: só pela área, que confere o login e a compra.
    let m = /^\/(gta\/guia|notebook\/guia|teste\/guia)(\/.*)?$/.exec(low);
    if (m) return ir('/area/' + m[1] + '/');
    // Páginas de obrigado da Kiwify: levam direto para a área, já voltando para o guia.
    if (/^\/gta\/obrigado(\/|$)/.test(low)) return ir('/area/?volta=/gta/guia/');
    if (/^\/notebook\/obrigado(-suporte)?(\/|$)/.test(low)) return ir('/area/?volta=/notebook/guia/');
    // Guias do tablet (feitos por modelo) e o obrigado do tablet continuam no site antigo, com o login de lá.
    if (/^\/tablet\/(g|obrigado)(\/|$)/.test(low)) return ir(VERCEL + url.pathname + url.search);
    // Entradas antigas da área.
    if (/^\/(acesso|entrar|minha-area|admin)(\/|$)/.test(low)) return ir('/area/');
    // Funções da Vercel não existem aqui.
    if (low.startsWith('/api/')) return new Response('não encontrado', { status: 404 });

    return env.ASSETS.fetch(req);
  },
};
