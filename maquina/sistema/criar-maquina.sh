#!/usr/bin/env bash
# Cria a máquina "cobaia" na Oracle e fica tentando até ter vaga.
# Rodar no Cloud Shell da Oracle (ícone >_ no topo do painel), que já vem com o oci logado:
#   curl -fsSL https://raw.githubusercontent.com/luisalves23/cobaia-site/<ramo>/maquina/sistema/criar-maquina.sh | bash
# Tenta a Ampere 4 OCPU / 24 GB e a AMD Micro em turnos, a cada 60 s, e para na primeira que der certo.
# Também prepara a rede (sub-rede pública e portas 22, 80 e 443 abertas). Pode rodar de novo sem duplicar nada.
set -uo pipefail
C="${OCI_TENANCY:-${OCI_CLI_TENANCY:-}}"
[ -n "$C" ] || { echo "Rode no Cloud Shell da Oracle."; exit 1; }
NOME=cobaia
q() { oci "$@" 2>/dev/null; }

echo "== chaves SSH"
[ -f ~/.ssh/id_rsa.pub ] || ssh-keygen -q -t rsa -b 4096 -N '' -f ~/.ssh/id_rsa
cat ~/.ssh/id_rsa.pub > ~/cobaia-chaves.pub
for f in ~/*.pub; do [ "$f" = ~/cobaia-chaves.pub ] || { cat "$f"; echo; } >> ~/cobaia-chaves.pub; done
echo "   $(grep -c . ~/cobaia-chaves.pub) chave(s): a do Cloud Shell e as .pub enviadas para cá"

echo "== máquina já existe?"
JA=$(q compute instance list -c "$C" --display-name "$NOME" --query 'data[?"lifecycle-state"!=`TERMINATED`] | [0].id' --raw-output)
if [ -n "$JA" ] && [ "$JA" != "null" ]; then INST="$JA"; echo "   já existe"; else INST=""; fi

if [ -z "$INST" ]; then
  echo "== rede"
  VCN=$(q network vcn list -c "$C" --query 'data[0].id' --raw-output)
  if [ -z "$VCN" ] || [ "$VCN" = "null" ]; then
    VCN=$(q network vcn create -c "$C" --cidr-block 10.0.0.0/16 --display-name cobaia --dns-label cobaia --wait-for-state AVAILABLE --query data.id --raw-output)
  fi
  IGW=$(q network internet-gateway list -c "$C" --vcn-id "$VCN" --query 'data[0].id' --raw-output)
  if [ -z "$IGW" ] || [ "$IGW" = "null" ]; then
    IGW=$(q network internet-gateway create -c "$C" --vcn-id "$VCN" --is-enabled true --display-name cobaia --wait-for-state AVAILABLE --query data.id --raw-output)
  fi
  RT=$(q network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"' --raw-output)
  q network route-table update --rt-id "$RT" --force --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" >/dev/null
  SL=$(q network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)
  regra() { echo "{\"source\":\"0.0.0.0/0\",\"protocol\":\"6\",\"isStateless\":false,\"tcpOptions\":{\"destinationPortRange\":{\"min\":$1,\"max\":$1}}}"; }
  q network security-list update --security-list-id "$SL" --force --ingress-security-rules \
    "[$(regra 22),$(regra 80),$(regra 443),{\"source\":\"0.0.0.0/0\",\"protocol\":\"1\",\"isStateless\":false,\"icmpOptions\":{\"type\":3,\"code\":4}},{\"source\":\"10.0.0.0/16\",\"protocol\":\"1\",\"isStateless\":false,\"icmpOptions\":{\"type\":3}}]" >/dev/null
  SUB=$(q network subnet list -c "$C" --vcn-id "$VCN" --query 'data[?"prohibit-public-ip-on-vnic"==`false`] | [0].id' --raw-output)
  if [ -z "$SUB" ] || [ "$SUB" = "null" ]; then
    SUB=$(q network subnet create -c "$C" --vcn-id "$VCN" --cidr-block 10.0.0.0/24 --display-name cobaia --dns-label publica --wait-for-state AVAILABLE --query data.id --raw-output)
  fi
  [ -n "$SUB" ] && [ "$SUB" != "null" ] || { echo "Não consegui preparar a rede. Mande print desta tela."; exit 1; }
  echo "   rede pronta, portas 22, 80 e 443 abertas"

  AD=$(q iam availability-domain list -c "$C" --query 'data[0].name' --raw-output)
  img() { q compute image list -c "$C" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" --shape "$1" --sort-by TIMECREATED --sort-order DESC --query 'data[0].id' --raw-output; }
  IMG_ARM=$(img VM.Standard.A1.Flex); IMG_AMD=$(img VM.Standard.E2.1.Micro)

  tentar() { # shape imagem [config]
    local extra=(); [ -n "${3:-}" ] && extra=(--shape-config "$3")
    oci compute instance launch -c "$C" --availability-domain "$AD" --display-name "$NOME" --shape "$1" "${extra[@]}" \
      --image-id "$2" --subnet-id "$SUB" --assign-public-ip true --ssh-authorized-keys-file ~/cobaia-chaves.pub \
      --query data.id --raw-output 2>&1
  }
  echo "== tentando criar (Ctrl+C para parar)"
  n=0
  while [ -z "$INST" ]; do
    n=$((n+1))
    for t in arm amd; do
      if [ $t = arm ]; then R=$(tentar VM.Standard.A1.Flex "$IMG_ARM" '{"ocpus":4,"memoryInGBs":24}'); else R=$(tentar VM.Standard.E2.1.Micro "$IMG_AMD"); fi
      ID=$(grep -o 'ocid1\.instance[^" ]*' <<<"$R" | head -1)
      if [ -n "$ID" ]; then INST="$ID"; echo "   conseguiu: $t"; break; fi
      if ! grep -qiE 'capacity|TooManyRequests|InternalError' <<<"$R"; then echo "Erro diferente, parei:"; echo "$R" | head -20; exit 1; fi
    done
    [ -n "$INST" ] || { echo "   $(date +%H:%M) tentativa $n: sem vaga, tento de novo em 60 s"; sleep 60; }
  done
fi

echo "== esperando ligar"
oci compute instance get --instance-id "$INST" --wait-for-state RUNNING --max-wait-seconds 600 >/dev/null 2>&1
IP=$(q compute instance list-vnics --instance-id "$INST" --query 'data[0]."public-ip"' --raw-output)
echo
echo "PRONTO. IP público: $IP"
echo "Para entrar daqui mesmo:  ssh ubuntu@$IP"
