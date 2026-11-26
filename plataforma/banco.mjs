/* O banco da plataforma: D1 (o SQLite do Cloudflare). As tabelas são criadas na primeira vez que o Worker roda. */
import { normEmail, produtoValido } from './produtos.mjs';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS eventos_kiwify (
  id INTEGER PRIMARY KEY,
  recebido_em TEXT NOT NULL DEFAULT (datetime('now')),
  produto_url TEXT, tipo TEXT, status TEXT, pedido TEXT, email TEXT,
  corpo TEXT NOT NULL,
  resultado TEXT
);
CREATE TABLE IF NOT EXISTS acessos (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  produto TEXT NOT NULL,
  pedido TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  valido_ate TEXT,
  nome TEXT, telefone TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  cortado_em TEXT, motivo_corte TEXT,
  UNIQUE (email, produto, pedido)
);
CREATE INDEX IF NOT EXISTS acessos_email ON acessos (email);
CREATE INDEX IF NOT EXISTS acessos_pedido ON acessos (pedido);
CREATE TABLE IF NOT EXISTS pix (
  pedido TEXT PRIMARY KEY,
  email TEXT, telefone TEXT, nome TEXT, produto TEXT, valor TEXT, link_pagamento TEXT,
  gerado_em TEXT NOT NULL DEFAULT (datetime('now')),
  pago_em TEXT, msg1_em TEXT, msg2_em TEXT
);
CREATE TABLE IF NOT EXISTS codigos (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  hash TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  usado_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT
);
CREATE INDEX IF NOT EXISTS codigos_email ON codigos (email);
CREATE TABLE IF NOT EXISTS pedidos_login (
  id INTEGER PRIMARY KEY,
  quando TEXT NOT NULL DEFAULT (datetime('now')),
  email TEXT, ip TEXT
);
CREATE INDEX IF NOT EXISTS pedidos_login_quando ON pedidos_login (quando);
CREATE TABLE IF NOT EXISTS sessoes (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  aparelho TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_em TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT, navegador TEXT,
  encerrada_em TEXT
);
CREATE INDEX IF NOT EXISTS sessoes_email ON sessoes (email);
CREATE TABLE IF NOT EXISTS entradas (
  id INTEGER PRIMARY KEY,
  quando TEXT NOT NULL DEFAULT (datetime('now')),
  email TEXT, aparelho TEXT, ip TEXT, navegador TEXT, caminho TEXT
);
CREATE INDEX IF NOT EXISTS entradas_email ON entradas (email, quando);
CREATE TABLE IF NOT EXISTS ajustes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS envios (
  id INTEGER PRIMARY KEY,
  quando TEXT NOT NULL DEFAULT (datetime('now')),
  canal TEXT NOT NULL,
  para TEXT NOT NULL, assunto TEXT, tipo TEXT,
  ok INTEGER NOT NULL, erro TEXT
);
`;

let pronto = false, segredo = '';
export async function prepararBanco(db) {
  if (pronto) return;
  await db.batch(ESQUEMA.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  pronto = true;
}

/* Segredo que mistura os códigos de login. Se não estiver no painel (SEGREDO), nasce sozinho no banco na 1ª vez. */
export async function segredoDe(env) {
  if (env.SEGREDO && env.SEGREDO.length >= 32) return env.SEGREDO;
  if (segredo) return segredo;
  const novo = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare("INSERT INTO ajustes (chave, valor) VALUES ('segredo', ?) ON CONFLICT DO NOTHING").bind(novo).run();
  segredo = (await env.DB.prepare("SELECT valor FROM ajustes WHERE chave = 'segredo'").first()).valor;
  return segredo;
}

/* ---------- acessos: só o aviso assinado da Kiwify e o Luis escrevem aqui ---------- */
export async function liberar(db, { email, produtos, pedido = '', origem, nome = null, telefone = null }) {
  email = normEmail(email);
  if (!['kiwify', 'luis', 'importacao'].includes(origem)) throw new Error('origem inválida');
  for (const p of produtos) if (!produtoValido(p)) throw new Error('produto desconhecido: ' + p);
  const novos = [];
  const passos = [];
  for (const p of produtos) {
    const antes = await db.prepare('SELECT status FROM acessos WHERE email = ? AND produto = ? AND pedido = ?').bind(email, p, pedido).first();
    if (antes && antes.status === 'ativo') continue;
    passos.push(antes
      ? db.prepare("UPDATE acessos SET status = 'ativo', cortado_em = NULL, motivo_corte = NULL WHERE email = ? AND produto = ? AND pedido = ?").bind(email, p, pedido)
      : db.prepare('INSERT INTO acessos (email, produto, pedido, origem, nome, telefone) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(email, p, pedido, origem, nome, telefone));
    novos.push(p);
  }
  if (passos.length) await db.batch(passos); // batch do D1 é uma transação: tudo ou nada
  return novos;
}

const SEM_ACESSO = `UPDATE sessoes SET encerrada_em = datetime('now')
  WHERE encerrada_em IS NULL AND email NOT IN (SELECT email FROM acessos WHERE status = 'ativo')`;

export async function cortarPedido(db, pedido, motivo) {
  if (!pedido) return 0;
  const [r] = await db.batch([
    db.prepare("UPDATE acessos SET status = 'cortado', cortado_em = datetime('now'), motivo_corte = ? WHERE pedido = ? AND status = 'ativo'").bind(motivo, pedido),
    db.prepare(SEM_ACESSO),
  ]);
  return r.meta.changes;
}

export async function cortar(db, email, produto, motivo) {
  const [r] = await db.batch([
    db.prepare("UPDATE acessos SET status = 'cortado', cortado_em = datetime('now'), motivo_corte = ? WHERE email = ? AND produto = ? AND status = 'ativo'").bind(motivo, normEmail(email), produto),
    db.prepare(SEM_ACESSO),
  ]);
  return r.meta.changes;
}

export async function produtosAtivos(db, email) {
  const { results } = await db.prepare(`SELECT DISTINCT produto FROM acessos
    WHERE email = ? AND status = 'ativo' AND (valido_ate IS NULL OR valido_ate > datetime('now'))`).bind(normEmail(email)).all();
  return results.map((l) => l.produto);
}
