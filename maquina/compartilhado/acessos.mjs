/* Liberar, cortar e consultar acessos. Toda mudança de acesso passa por aqui. */
import { banco, transacao } from './banco.mjs';
import { normEmail, produtoValido } from './produtos.mjs';

/* Libera produtos para um e-mail. Devolve os que eram novos (para saber se manda e-mail). */
export function liberar({ email, produtos, pedido = '', origem, nome = null, telefone = null }) {
  email = normEmail(email);
  if (!['kiwify', 'luis', 'importacao'].includes(origem)) throw new Error('origem inválida');
  const novos = [];
  transacao((d) => {
    for (const p of produtos) {
      if (!produtoValido(p)) throw new Error('produto desconhecido: ' + p);
      const antes = d.prepare('SELECT status FROM acessos WHERE email = ? AND produto = ? AND pedido = ?').get(email, p, pedido);
      if (antes && antes.status === 'ativo') continue;
      if (antes) {
        // Compra aprovada de novo depois de um corte (ex.: chargeback revertido): reativa.
        d.prepare("UPDATE acessos SET status = 'ativo', cortado_em = NULL, motivo_corte = NULL WHERE email = ? AND produto = ? AND pedido = ?").run(email, p, pedido);
      } else {
        d.prepare('INSERT INTO acessos (email, produto, pedido, origem, nome, telefone) VALUES (?, ?, ?, ?, ?, ?)').run(email, p, pedido, origem, nome, telefone);
      }
      novos.push(p);
    }
  });
  return novos;
}

/* Corta todos os acessos de um pedido (reembolso ou chargeback). */
export function cortarPedido(pedido, motivo) {
  if (!pedido) return 0;
  const r = banco().prepare("UPDATE acessos SET status = 'cortado', cortado_em = datetime('now'), motivo_corte = ? WHERE pedido = ? AND status = 'ativo'").run(motivo, pedido);
  if (r.changes) encerrarSessoesSemAcesso();
  return Number(r.changes);
}

export function cortar(email, produto, motivo) {
  const r = banco().prepare("UPDATE acessos SET status = 'cortado', cortado_em = datetime('now'), motivo_corte = ? WHERE email = ? AND produto = ? AND status = 'ativo'").run(motivo, normEmail(email), produto);
  if (r.changes) encerrarSessoesSemAcesso();
  return Number(r.changes);
}

/* Quem ficou sem nenhum produto ativo perde as sessões abertas. */
function encerrarSessoesSemAcesso() {
  banco().prepare(`UPDATE sessoes SET encerrada_em = datetime('now')
    WHERE encerrada_em IS NULL AND email NOT IN (SELECT email FROM acessos WHERE status = 'ativo')`).run();
}

/* Produtos ativos e dentro do prazo de um e-mail. Consultado a cada página protegida. */
export function produtosAtivos(email) {
  const linhas = banco().prepare(`SELECT DISTINCT produto FROM acessos
    WHERE email = ? AND status = 'ativo' AND (valido_ate IS NULL OR valido_ate > datetime('now'))`).all(normEmail(email));
  return linhas.map((l) => l.produto);
}

export const temAcesso = (email, produto) => produtosAtivos(email).includes(produto);
export const temAlgumAcesso = (email) => produtosAtivos(email).length > 0;
