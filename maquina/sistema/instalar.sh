#!/usr/bin/env bash
# Instala a máquina do Cobaia do zero numa VM Ubuntu 24.04 da Oracle (ARM ou AMD).
# Rodar como root:  curl -fsSL <este arquivo cru no GitHub> | sudo bash -s -- <ramo>
# Ou, com o repositório já clonado:  sudo bash maquina/sistema/instalar.sh <ramo>
# Pode rodar de novo quantas vezes quiser: ele só completa o que falta.
set -euo pipefail
RAMO="${1:-main}"
REPO="${REPO:-https://github.com/luisalves23/cobaia-site.git}"

echo "== 1/7 pacotes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg sqlite3 debian-keyring debian-archive-keyring apt-transport-https iptables-persistent >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

echo "== 2/7 usuário e pastas"
id cobaia >/dev/null 2>&1 || useradd --system --home /opt/cobaia --shell /usr/sbin/nologin cobaia
install -d -o cobaia -g cobaia -m 755 /opt/cobaia
install -d -o cobaia -g cobaia -m 750 /var/lib/cobaia
install -d -o root -g cobaia -m 750 /etc/cobaia

echo "== 3/7 código"
if [ ! -d /opt/cobaia/site/.git ]; then
  sudo -u cobaia git clone --quiet --branch "$RAMO" "$REPO" /opt/cobaia/site
fi
cd /opt/cobaia/site
sudo -u cobaia git fetch --quiet origin "$RAMO" && sudo -u cobaia git reset --quiet --hard "origin/$RAMO"
chmod -R o+rX /opt/cobaia/site   # o Caddy lê as páginas públicas

echo "== 4/7 /etc/cobaia/env"
ENV=/etc/cobaia/env
[ -f "$ENV" ] || install -o root -g cobaia -m 640 maquina/sistema/env.exemplo "$ENV"
define() { grep -q "^$1=." "$ENV" || sed -i "s|^$1=.*|$1=$2|" "$ENV"; }
IP=$(curl -fsS https://api.ipify.org)
define SITE_HOST "${IP//./-}.sslip.io"
SITE_HOST=$(grep '^SITE_HOST=' "$ENV" | cut -d= -f2)
define SITE "https://$SITE_HOST"
define SEGREDO "$(openssl rand -hex 32)"
sed -i "s|^RAMO=.*|RAMO=$RAMO|" "$ENV"

echo "== 5/7 firewall (80 e 443)"
for p in 80 443; do
  iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport $p -j ACCEPT
done
netfilter-persistent save >/dev/null

echo "== 6/7 porteiro (Caddy)"
install -d /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/cobaia/env\n' > /etc/systemd/system/caddy.service.d/cobaia.conf
echo 'import /opt/cobaia/site/maquina/porteiro/Caddyfile' > /etc/caddy/Caddyfile

echo "== 7/7 serviços"
install -m 644 maquina/sistema/cobaia@.service maquina/sistema/cobaia-atualizador.service maquina/sistema/cobaia-atualizador.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cobaia@vendas cobaia@acesso cobaia-atualizador.timer >/dev/null
systemctl restart caddy cobaia@vendas cobaia@acesso

echo
echo "Pronto. Endereço: https://$SITE_HOST"
echo "Webhook da Kiwify: https://$SITE_HOST/webhook/kiwify?produto=<gta|notebook|tablet|suporte>"
echo "Falta preencher em $ENV: KIWIFY_TOKENS, EMAIL_SERVICO/EMAIL_CHAVE, WHATSAPP_SUPORTE. Depois: systemctl restart cobaia@vendas cobaia@acesso"
