/* Ferramenta de linha de comando para o Luis (ou o Claude por SSH) mexer em acessos até o painel ficar pronto.
   Na máquina:  sudo -u cobaia bash -c 'set -a; . /etc/cobaia/env; node --no-warnings /opt/cobaia/site/maquina/ferramentas/acesso.mjs <comando>'
     ver <email>                       mostra produtos, sessões e aparelhos
     liberar <email> <produto>         libera (ex.: liberar ana@x.com tablet:sm-t561m-r7q2)
     cortar <email> <produto>          corta
     aparelhos [dias]                  e-mails com mais aparelhos nos últimos N dias (padrão 30) */
import { banco } from '../compartilhado/banco.mjs';
import { liberar, cortar, produtosAtivos } from '../compartilhado/acessos.mjs';
import { normEmail, produtoValido } from '../compartilhado/produtos.mjs';

const [cmd, a, b] = process.argv.slice(2);
const db = banco();

if (cmd === 'ver' && a) {
  const email = normEmail(a);
  console.log('Produtos ativos:', produtosAtivos(email).join(', ') || '(nenhum)');
  console.table(db.prepare('SELECT produto, pedido, origem, status, criado_em, cortado_em, motivo_corte FROM acessos WHERE email = ? ORDER BY id').all(email));
  console.table(db.prepare('SELECT aparelho, criado_em, ultimo_em, ip, substr(navegador, 1, 60) navegador, encerrada_em FROM sessoes WHERE email = ? ORDER BY ultimo_em DESC').all(email));
} else if (cmd === 'liberar' && a && b) {
  if (!produtoValido(b)) { console.error('produto desconhecido:', b); process.exit(1); }
  console.log('liberados:', liberar({ email: a, produtos: [b], pedido: 'luis', origem: 'luis' }));
} else if (cmd === 'cortar' && a && b) {
  console.log('cortados:', cortar(a, b, 'luis'));
} else if (cmd === 'aparelhos') {
  const dias = Number(a || 30);
  console.table(db.prepare(`SELECT email, COUNT(DISTINCT aparelho) aparelhos, COUNT(DISTINCT ip) ips, COUNT(*) entradas, MAX(quando) ultima
    FROM entradas WHERE quando > datetime('now', ?) GROUP BY email ORDER BY aparelhos DESC, ips DESC LIMIT 30`).all(`-${dias} days`));
} else {
  console.log('Uso: ver <email> | liberar <email> <produto> | cortar <email> <produto> | aparelhos [dias]');
}
