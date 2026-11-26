# Máquina do Cobaia (Oracle Cloud)

> **Substituído (26/11/2026):** a operação foi para o Cloudflare, sem servidor. Ver `plataforma/LEIAME.md`. Esta pasta fica só como referência.

A operação inteira numa VM gratuita da Oracle. Plano completo: doc "Operação do Cobaia na Oracle".
Esta pasta é a **etapa 1: entrega automática**. Nada aqui depende da Vercel.

## Peças

| Pasta | O que é |
|---|---|
| `porteiro/Caddyfile` | HTTPS automático e quem atende cada caminho. Páginas públicas saem direto; guias pagos só pelo serviço acesso. |
| `servicos/vendas.mjs` | Webhook da Kiwify (`/webhook/kiwify?produto=<id>`): confere assinatura, grava o aviso cru, libera ou corta acesso, guarda Pix pendente, manda o e-mail da compra. |
| `servicos/acesso.mjs` | Plataforma do aluno (`/area/`): login por e-mail + código de 6 dígitos, lista dos produtos, guias pagos, registro de cada entrada. |
| `compartilhado/` | Banco (SQLite do próprio Node, um arquivo só), catálogo de produtos, acessos, e-mail (Brevo ou Resend) e HTTP. |
| `ferramentas/acesso.mjs` | Ver, liberar e cortar acessos e listar quem usa muitos aparelhos, até o painel existir. |
| `ferramentas/importar-kiwify.mjs` | Importa a planilha de vendas antigas. Não manda e-mail. |
| `sistema/` | Instalador, unidades do systemd, atualizador (puxa o GitHub a cada 5 min) e modelo do `/etc/cobaia/env`. |
| `testes/` | Teste de ponta a ponta sem internet: `node --test maquina/testes/*.test.mjs` |

Zero dependências de npm: só Node 22+ e Caddy.

## Regras de segurança (não quebrar)

1. Só duas coisas liberam produto: o aviso da Kiwify com assinatura conferida e o Luis (ferramenta ou painel). Nada vindo do navegador.
2. O cookie de login guarda só um id aleatório da sessão. Quais produtos a pessoa tem é lido do banco a cada página.
3. Guia pago nunca é servido pelo Caddy direto: o caminho vai para o serviço acesso, que confere o produto exigido pelo caminho **já normalizado**.
4. Código de login: 15 min, uso único, 5 tentativas, guardado só como hash. Limite por IP e por e-mail.
5. A tela de login responde igual para e-mail com e sem compra.

## Instalar numa máquina nova

1. Oracle: criar a VM Ubuntu 24.04 (Ampere A1 ou AMD micro), guardar a chave SSH no PC.
2. Na rede da VM (Security List), liberar entrada TCP 80 e 443.
3. Por SSH: `curl -fsSL https://raw.githubusercontent.com/luisalves23/cobaia-site/<ramo>/maquina/sistema/instalar.sh | sudo bash -s -- <ramo>`
4. Preencher `/etc/cobaia/env` (tokens da Kiwify, chave do e-mail, WhatsApp) e `sudo systemctl restart cobaia@vendas cobaia@acesso`.
5. Na Kiwify, um webhook por produto apontando para `https://<SITE_HOST>/webhook/kiwify?produto=<id>` com os eventos: compra aprovada, Pix gerado, reembolso, chargeback.

Trocar para o domínio definitivo: em `/etc/cobaia/env`, `SITE_HOST=cobaia.dev.br` e `SITE=https://cobaia.dev.br`, apontar o DNS para o IP da máquina e `sudo systemctl restart caddy cobaia@vendas cobaia@acesso`. Depois atualizar a URL dos webhooks na Kiwify.

## Ver o que está acontecendo

```
journalctl -u cobaia@vendas -f          # avisos da Kiwify
journalctl -u cobaia@acesso -f          # logins
sudo sqlite3 /var/lib/cobaia/cobaia.db "select recebido_em, tipo, status, pedido, resultado from eventos_kiwify order by id desc limit 10"
```
