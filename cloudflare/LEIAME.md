# Site público em cobaia.dev.br (Cloudflare)

Desde 26/11/2026 o site principal do @cobaia.dev fica em **cobaia.dev.br**, no Cloudflare (plano grátis).
O site antigo na Vercel (`cobaia-dev.vercel.app`) continua no ar, com as mesmas páginas, para quem ainda tem o link antigo e para quem comprou antes da mudança.

| Peça | O que é |
|---|---|
| Páginas | Saem direto da pasta do repositório. O que não vai para o ar está em `/.assetsignore`. Redirecionamentos simples em `/_redirects`, cache em `/_headers`. |
| `cloudflare/site.mjs` | Worker que vê todo pedido antes. Guias pagos e páginas de obrigado vão para a área (`cobaia.dev.br/area`, repositório `cobaia-materiais`). Guias do tablet ficam na Vercel. `/api/...` não existe aqui. |
| `/wrangler.jsonc` | Worker `cobaia-site`, rota `cobaia.dev.br/*`. A rota `cobaia.dev.br/area*` é do Worker `cobaia-materiais` e ganha por ser mais específica. |

Publicação: Workers Builds do Cloudflare, a cada push na branch ligada ao Worker `cobaia-site`.

Testar no computador: `npx wrangler@4 dev --port 8798` e abrir `http://127.0.0.1:8798/30-dias/`.
