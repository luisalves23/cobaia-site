/* Casca das páginas geradas pelas funções (/acesso, /minha-area, /admin). Mesmo visual do site. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const CSS = `
.ac{min-height:100vh;display:grid;place-items:center;padding-block:40px}
.ac .card{width:100%;max-width:460px;padding:34px 26px;border-radius:30px}
.ac.wide .card{max-width:640px}
.ac h1{font-size:clamp(44px,11vw,62px);margin:18px 0 8px}
.ac p.s{color:var(--muted);margin:0 0 22px}
.ac label{display:block;font:700 12px var(--f-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px}
.ac input,.ac select,.ac textarea{width:100%;box-sizing:border-box;font:500 17px var(--f-body);color:var(--paper);background:rgba(0,0,0,.45);border:1px solid var(--line);border-radius:14px;padding:13px 14px}
.ac input:focus,.ac select:focus{outline:2px solid var(--red);outline-offset:2px}
.ac .bt{all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;text-align:center;margin-top:22px;font:400 24px var(--f-display);letter-spacing:.5px;background:var(--red);color:var(--ink);border-radius:14px;padding:12px 0 10px}
.ac .bt.alt{background:transparent;color:var(--paper);border:1px solid var(--line);font-size:20px}
.ac .bt[aria-busy=true]{opacity:.6;pointer-events:none}
.ac .msg{margin:16px 0 0;padding:12px 14px;border-radius:14px;font-size:15px;background:rgba(242,238,230,.06);border:1px solid var(--line)}
.ac .msg.err{background:rgba(255,45,45,.14);border-color:rgba(255,45,45,.4)}
.ac .msg.ok{background:rgba(80,200,120,.12);border-color:rgba(80,200,120,.4)}
.ac .help{font-size:14px;color:var(--dim);margin:20px 0 0}
.ac .help a{color:var(--paper)}
.ac .prod{margin:16px 0 0;padding:18px;border-radius:20px;background:rgba(0,0,0,.35);border:1px solid var(--line)}
.ac .prod h2{font:400 28px/1 var(--f-display);letter-spacing:.4px;margin:0 0 6px;text-transform:uppercase}
.ac .prod p{margin:0;color:var(--muted);font-size:15px}
.ac .prod .bt{margin-top:14px;font-size:21px}
.ac .pill{display:inline-block;font:700 11px var(--f-mono);letter-spacing:.1em;text-transform:uppercase;padding:3px 9px;border-radius:20px;margin-bottom:10px;background:rgba(80,200,120,.16);color:#8fe0a8}
.ac .pill.wait{background:rgba(255,190,60,.14);color:#ffd27a}
.ac .pill.off{background:rgba(255,45,45,.16);color:#ff8a8a}
.ac .who{font:500 13px var(--f-mono);color:var(--dim);margin-top:22px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.ac .who a{color:var(--muted)}
.ac pre{white-space:pre-wrap;word-break:break-all;font:12px/1.5 var(--f-mono);background:rgba(0,0,0,.5);padding:12px;border-radius:12px;max-height:320px;overflow:auto}
`;

export function pagina({ titulo, corpo, status = 200, wide = false, headers = {} }) {
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)} · @cobaia.dev</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#0c0c0c">
<link rel="icon" href="/assets/img/favicon.png">
<link rel="stylesheet" href="/assets/site.css">
<style>${CSS}</style></head>
<body><div class="bg" aria-hidden="true"><i></i><i></i><i></i></div>
<main class="ac${wide ? ' wide' : ''}"><div class="card glass">${corpo}</div></main>
<script>document.querySelectorAll('form').forEach(function(f){f.addEventListener('submit',function(){var b=f.querySelector('.bt');if(b){b.setAttribute('aria-busy','true');b.dataset.t=b.textContent;b.textContent='Conferindo a compra…';}});});</script>
</body></html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', ...headers },
  });
}

export const redirecionar = (location, headers = {}) =>
  new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store', ...headers } });
