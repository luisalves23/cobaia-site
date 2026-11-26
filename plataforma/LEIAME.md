# Plataforma do Cobaia no Cloudflare (sem servidor)

Site, guias pagos, entrega automática da Kiwify e login dos compradores, tudo no plano grátis do Cloudflare.
Substitui a ideia da máquina na Oracle (`maquina/`, guardada só como referência). Não há servidor para cuidar.

## Como funciona

| Peça | O que é |
|---|---|
| Arquivos estáticos | As páginas do site saem direto da pasta do repositório. O que não vai para o ar está em `/.assetsignore`. Redirecionamentos em `/_redirects`, cache em `/_headers`. |
| `plataforma/worker.mjs` | O Worker. Vê todo pedido primeiro (`run_worker_first`). Páginas públicas passam direto; ele só trabalha em `/webhook/kiwify`, `/area/` e nos guias pagos. |
| `plataforma/banco.mjs` | Banco D1 (SQLite do Cloudflare). As tabelas nascem sozinhas no primeiro uso. Liberar, cortar e consultar acessos. |
| `plataforma/produtos.mjs` | Catálogo: nome de cada produto, que pasta ele abre, o que cada compra libera. |
| `plataforma/emails.mjs` | E-mail da compra e do código de login, enviados pelo Brevo ou Resend. |
| `plataforma/testes/fluxo.mjs` | Teste de ponta a ponta contra o `wrangler dev` local. |
| `/wrangler.jsonc` | Configuração da publicação. |

## Regras de segurança (não quebrar)

1. Só duas coisas liberam produto: o aviso da Kiwify com assinatura conferida e o Luis. Nada vindo do navegador.
2. O cookie de login guarda só um id aleatório da sessão. Os produtos da pessoa são lidos do banco a cada página.
3. Guia pago nunca sai sem passar pelo Worker, que confere o produto pelo caminho **decodificado** (`%2F`, `..` e afins não pulam a porta).
4. Código de login: 15 min, uso único, 5 tentativas, guardado só como hash. Limite de 10 pedidos por hora por IP e 5 por e-mail.
5. A tela de login responde igual para e-mail com e sem compra.

## Configuração no painel do Cloudflare (Worker `cobaia` > Settings > Variables and Secrets)

| Nome | Tipo | Valor |
|---|---|---|
| `KIWIFY_TOKENS` | Secret | Tokens dos webhooks da Kiwify, separados por vírgula |
| `EMAIL_SERVICO` | Text | `brevo` (ou `resend`) |
| `EMAIL_CHAVE` | Secret | Chave da API do Brevo |
| `EMAIL_DE` | Text | `Luis do Cobaia <email-verificado-no-brevo>` |
| `EMAIL_RESPONDER_PARA` | Text | E-mail que recebe as respostas |
| `WHATSAPP_SUPORTE` | Text | Só números, com 55 |
| `KIWIFY_SUPORTE_ID` | Text | (opcional) id do produto "suporte pessoal" na Kiwify |
| `SITE` | Text | (opcional) `https://cobaia.dev.br` quando o domínio estiver ligado; sem ele, usa o endereço do próprio pedido |
| `SEGREDO` | Secret | (opcional) 64 letras aleatórias; sem ele, o Worker cria um e guarda no banco |

A publicação não apaga essas configurações (`keep_vars`).

## Webhooks da Kiwify

Um por produto: `https://<endereço>/webhook/kiwify?produto=<gta|notebook|tablet|suporte>`, com os eventos compra aprovada, Pix gerado, reembolso e chargeback.

## Testar no computador

```
# na raiz do repositório
printf 'KIWIFY_TOKENS=tok-teste\nEMAIL_SERVICO=console\n' > .dev.vars
npx wrangler@4 dev --port 8799 > /tmp/dev.log 2>&1 &
node plataforma/testes/fluxo.mjs http://127.0.0.1:8799 /tmp/dev.log
```

## Ver o que está acontecendo

Painel do Cloudflare > Workers > cobaia > Logs (avisos da Kiwify, erros de e-mail).
Banco: Storage & Databases > D1 > cobaia > Console, por exemplo
`select recebido_em, tipo, status, pedido, resultado from eventos_kiwify order by id desc limit 10`.

Liberar um guia de tablet feito sob medida (até o painel existir), no console do D1:
`insert into acessos (email, produto, origem) values ('pessoa@x.com', 'tablet:sm-t561m-r7q2', 'luis')`.
