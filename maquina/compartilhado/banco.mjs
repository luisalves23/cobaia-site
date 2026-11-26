/* O banco da operação: um arquivo SQLite só, aberto por todos os serviços.
   Usa o SQLite que já vem dentro do Node (node:sqlite), sem dependência nenhuma.
   As tabelas são criadas na primeira vez que qualquer serviço abre o banco. */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';

const ESQUEMA = `
-- Todo aviso que a Kiwify manda, cru, para poder reprocessar se o formato mudar.
CREATE TABLE IF NOT EXISTS eventos_kiwify (
  id INTEGER PRIMARY KEY,
  recebido_em TEXT NOT NULL DEFAULT (datetime('now')),
  produto_url TEXT, tipo TEXT, status TEXT, pedido TEXT, email TEXT,
  corpo TEXT NOT NULL,
  resultado TEXT
);

-- Quem tem acesso a quê. É a ÚNICA fonte da verdade da plataforma.
-- Só duas coisas escrevem aqui: o serviço vendas (aviso assinado da Kiwify) e o Luis (painel ou ferramenta).
CREATE TABLE IF NOT EXISTS acessos (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  produto TEXT NOT NULL,
  pedido TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL,                 -- kiwify | luis | importacao
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | cortado
  valido_ate TEXT,                      -- vazio = sem prazo (decisão de 26/11/2026)
  nome TEXT, telefone TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  cortado_em TEXT, motivo_corte TEXT,
  UNIQUE (email, produto, pedido)
);
CREATE INDEX IF NOT EXISTS acessos_email ON acessos (email);
CREATE INDEX IF NOT EXISTS acessos_pedido ON acessos (pedido);

-- Pix gerado e ainda não pago. O relógio (etapa 2) manda as mensagens de 15 min e 24 h.
CREATE TABLE IF NOT EXISTS pix (
  pedido TEXT PRIMARY KEY,
  email TEXT, telefone TEXT, nome TEXT, produto TEXT, valor TEXT, link_pagamento TEXT,
  gerado_em TEXT NOT NULL DEFAULT (datetime('now')),
  pago_em TEXT, msg1_em TEXT, msg2_em TEXT
);

-- Códigos de login de 6 dígitos (guardados só como hash).
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

-- Sessões abertas (uma por aparelho). O cookie guarda só o id aleatório; aqui fica o hash dele.
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

-- Cada entrada na plataforma, para o painel mostrar compartilhamento.
CREATE TABLE IF NOT EXISTS entradas (
  id INTEGER PRIMARY KEY,
  quando TEXT NOT NULL DEFAULT (datetime('now')),
  email TEXT, aparelho TEXT, ip TEXT, navegador TEXT, caminho TEXT
);
CREATE INDEX IF NOT EXISTS entradas_email ON entradas (email, quando);

-- Tudo que a máquina mandou por e-mail (e se deu certo).
CREATE TABLE IF NOT EXISTS envios (
  id INTEGER PRIMARY KEY,
  quando TEXT NOT NULL DEFAULT (datetime('now')),
  canal TEXT NOT NULL,      -- email | whatsapp
  para TEXT NOT NULL, assunto TEXT, tipo TEXT,
  ok INTEGER NOT NULL, erro TEXT
);
`;

let db;
export function banco() {
  if (db) return db;
  if (CONFIG.BANCO !== ':memory:') fs.mkdirSync(path.dirname(CONFIG.BANCO), { recursive: true });
  db = new DatabaseSync(CONFIG.BANCO);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  db.exec(ESQUEMA);
  return db;
}

/* Executa várias escritas como uma coisa só: ou tudo, ou nada. */
export function transacao(fn) {
  const d = banco();
  d.exec('BEGIN IMMEDIATE');
  try { const r = fn(d); d.exec('COMMIT'); return r; }
  catch (e) { d.exec('ROLLBACK'); throw e; }
}
