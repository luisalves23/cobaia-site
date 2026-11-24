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

## Notebook Ressuscitado (/notebook)
- `/notebook/` é a landing de vendas (escrita à mão, fora do `build.py`). Links de checkout em `CHECKOUT` no fim do HTML.
- `/notebook/guia/` é o guia pago, gerado por `python3 src/notebook_guia.py` a partir de `src/notebook-guia/` (aulas em `aulas.html`; o conteúdo dos `<pre>` é escrito cru e escapado pelo script).
- Produtos `notebook` (guia) e `notebook-suporte` (suporte, sempre com o guia junto). O suporte também pode vir como order bump no checkout do guia: o webhook do guia reconhece "suporte pessoal" (ou `KIWIFY_SUPORTE_ID`) e registra os dois.
- Suporte: é o produto de suporte que já existia na Kiwify ("Suporte pessoal do Luis", vale pra qualquer serviço), com webhook `/api/kiwify?produto=suporte`. Quem compra pelo botão da página /notebook leva `src=notebook` no checkout; o webhook vê isso em `TrackingParameters` e registra também `notebook-suporte`, que libera o guia. Comprado por outro lugar, fica só o suporte (o guia pode ser liberado à mão em /admin/).
- Webhooks: `/api/kiwify?produto=notebook` (guia) e `/api/kiwify?produto=suporte` (suporte). Variável `WHATSAPP_SUPORTE` (55 + DDD + número) mostra o botão de WhatsApp na área do comprador do suporte.
