#!/usr/bin/env bash
# Trava de gastos da conta Oracle do Cobaia (rodar no Cloud Shell depois do upgrade para Pay As You Go):
#   curl -fsSL https://raw.githubusercontent.com/luisalves23/cobaia-site/<ramo>/maquina/sistema/trava-oracle.sh | bash -s -- seu@email
# 1) Orçamento de 1 (na moeda da conta) com aviso por e-mail no primeiro centavo gasto.
# 2) Cota que proíbe criar máquina fora do grátis: só Ampere até 4 OCPU / 24 GB e até 2 AMD Micro; disco até 200 GB.
# Pode rodar de novo: não duplica nada.
set -uo pipefail
C="${OCI_TENANCY:-${OCI_CLI_TENANCY:-}}"
[ -n "$C" ] || { echo "Rode no Cloud Shell da Oracle."; exit 1; }
EMAIL="${1:-}"
[ -n "$EMAIL" ] || { echo "Falta o e-mail do aviso: ... | bash -s -- seu@email"; exit 1; }

echo "== 1/2 alerta de gasto"
B=$(oci budgets budget list -c "$C" --all --query 'data[?"display-name"==`cobaia-alerta`] | [0].id' --raw-output 2>/dev/null)
if [ -z "$B" ] || [ "$B" = "null" ]; then
  B=$(oci budgets budget create -c "$C" --display-name cobaia-alerta --amount 1 --reset-period MONTHLY \
      --target-type COMPARTMENT --targets "[\"$C\"]" --query data.id --raw-output) || { echo "Falhou o orçamento. Mande print."; exit 1; }
  oci budgets alert-rule create --budget-id "$B" --display-name primeiro-centavo --type ACTUAL \
      --threshold 1 --threshold-type PERCENTAGE --recipients "$EMAIL" \
      --message "Atenção: a conta Oracle do Cobaia começou a gastar. Veja Billing > Cost Analysis." >/dev/null \
      || { echo "Falhou o aviso por e-mail. Mande print."; exit 1; }
  echo "   criado: aviso para $EMAIL quando o gasto do mês passar de 0,01"
else
  echo "   já existia"
fi

echo "== 2/2 trava de recursos"
NOMES=$(oci limits definition list -c "$C" --service-name compute --all --query 'data[].name' --raw-output 2>/dev/null | tr -d '[]", ' | grep .)
achar() { grep -x "$1" <<<"$NOMES" | head -1; }
A1C=$(achar standard-a1-core-count); A1M=$(achar standard-a1-memory-count); MIC=$(achar standard-e2-micro-core-count)
if [ -z "$A1C" ] || [ -z "$A1M" ]; then
  echo "Não achei os nomes das cotas da Ampere. Mande print desta lista:"; grep -iE 'a1|micro' <<<"$NOMES"; exit 1
fi
REGRAS="\"zero compute-core quotas in tenancy\",\"zero compute-memory quotas in tenancy\""
REGRAS+=",\"set compute-core quota $A1C to 4 in tenancy\",\"set compute-memory quota $A1M to 24 in tenancy\""
[ -n "$MIC" ] && REGRAS+=",\"set compute-core quota $MIC to 2 in tenancy\""
REGRAS+=",\"set block-storage quota total-storage-gb to 200 in tenancy\""
Q=$(oci limits quota list -c "$C" --all --query 'data[?name==`cobaia-trava`] | [0].id' --raw-output 2>/dev/null)
if [ -z "$Q" ] || [ "$Q" = "null" ]; then
  oci limits quota create -c "$C" --name cobaia-trava --description "Só recursos Always Free" --statements "[$REGRAS]" >/dev/null \
    || { echo "Falhou a trava. Mande print."; exit 1; }
else
  oci limits quota update --quota-id "$Q" --statements "[$REGRAS]" --force >/dev/null || { echo "Falhou a trava. Mande print."; exit 1; }
fi
echo "   trava ativa: só Ampere até 4 OCPU / 24 GB${MIC:+, até 2 Micro} e disco até 200 GB"
echo
echo "PRONTO. Agora pode criar a máquina."
