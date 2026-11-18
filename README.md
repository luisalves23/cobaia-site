# cobaia-site

Site do @cobaia.dev: uma página por experimento do projeto 30 dias, com o guia completo prometido em cada vídeo.

- HTML, CSS e JS puros. Sem framework, sem build na Vercel.
- Cada página libera sozinha às 12h (Brasília) do dia dela (`assets/site.js`, função `releaseOf`).

## Adicionar um dia novo
1. Copie a capa reduzida (540 px de largura) para `assets/img/capa-diaNN.jpg`.
2. Adicione o dia em `DIAS` no `src/build.py`.
3. Crie o miolo em `src/dias/<palavra>.html` (use um dos existentes como modelo).
4. Rode `python3 src/build.py` e `node src/og.js` (imagem de prévia da DM) e faça o commit.

## Entrega dos produtos pagos (Kiwify)
Quem compra entra em `/acesso/` só com o e-mail da compra e vê tudo em `/minha-area/`.
- A Kiwify avisa cada compra, reembolso e chargeback no webhook `/api/kiwify?produto=<tablet|gta>` (`api/kiwify.mjs`).
- O cadastro fica no Blob privado `cobaia-compras` (`lib/compras.mjs`). Reembolso e chargeback cortam o acesso na hora.
- `middleware.js` protege `/gta/guia/` e `/tablet/g/<slug>/`, conferindo a compra a cada abertura.
- Painel em `/admin/` (chave `ADMIN_CHAVE`): consultar comprador, liberar guia de tablet pronto, registrar compra antiga, revogar.
- Variáveis na Vercel: `GUIA_SEGREDO`, `BLOB_READ_WRITE_TOKEN` (criada pelo Blob), `KIWIFY_TOKEN` (token do webhook; vários separados por vírgula), `ADMIN_CHAVE`.
- Produto novo: adicione em `PRODUTOS` (`lib/compras.mjs`) e o caminho do guia no `matcher` do `middleware.js`.
