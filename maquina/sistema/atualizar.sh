#!/usr/bin/env bash
# Atualizador: roda a cada 5 min (cobaia-atualizador.timer). Puxa o GitHub e, se mudou algo, reinicia os serviços.
set -euo pipefail
source /etc/cobaia/env
cd /opt/cobaia/site
RAMO="${RAMO:-main}"

antes=$(git rev-parse HEAD)
sudo -u cobaia git fetch --quiet origin "$RAMO"
sudo -u cobaia git reset --quiet --hard "origin/$RAMO"
depois=$(git rev-parse HEAD)
[ "$antes" = "$depois" ] && exit 0

echo "atualizado: $antes -> $depois"
mudou=$(git diff --name-only "$antes" "$depois")
if grep -q '^maquina/sistema/' <<<"$mudou"; then
  install -m 644 maquina/sistema/cobaia@.service /etc/systemd/system/
  install -m 644 maquina/sistema/cobaia-atualizador.service maquina/sistema/cobaia-atualizador.timer /etc/systemd/system/
  systemctl daemon-reload
fi
if grep -q '^maquina/porteiro/' <<<"$mudou"; then systemctl reload caddy; fi
if grep -qE '^maquina/(servicos|compartilhado)/' <<<"$mudou"; then
  for s in $(systemctl list-units --plain --no-legend 'cobaia@*.service' | awk '{print $1}'); do systemctl restart "$s"; done
fi
