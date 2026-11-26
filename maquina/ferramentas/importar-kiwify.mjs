/* Importa as vendas antigas a partir da planilha exportada da Kiwify (CSV). NÃO manda e-mail nenhum.
   O e-mail de mudança para os clientes antigos só sai no fim, com tudo pronto no cobaia.dev.br.
   Uso:  node importar-kiwify.mjs vendas.csv            (só mostra o que faria)
         node importar-kiwify.mjs vendas.csv --gravar   (grava no banco)
   Reconhece as colunas pelo nome (e-mail, status, produto, pedido/id), em português ou inglês. */
import fs from 'node:fs';
import { banco } from '../compartilhado/banco.mjs';
import { liberar } from '../compartilhado/acessos.mjs';
import { liberados, normEmail, emailValido } from '../compartilhado/produtos.mjs';

function lerCsv(txt) {
  const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => x.trim()));
}

const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const coluna = (cab, ...nomes) => cab.findIndex((h) => nomes.some((n) => sem(h).includes(n)));

function produtoDoNome(nome) {
  const n = sem(nome);
  if (n.includes('suporte') && n.includes('notebook')) return 'notebook-suporte';
  if (n.includes('suporte')) return 'suporte';
  if (n.includes('notebook')) return 'notebook';
  if (n.includes('gta')) return 'gta';
  if (n.includes('tablet')) return 'tablet';
  return null;
}

const [arquivo, flag] = process.argv.slice(2);
if (!arquivo) { console.log('Uso: node importar-kiwify.mjs vendas.csv [--gravar]'); process.exit(1); }
const [cab, ...dados] = lerCsv(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
const iEmail = coluna(cab, 'email', 'e-mail'), iStatus = coluna(cab, 'status'), iProd = coluna(cab, 'produto', 'product'), iPed = coluna(cab, 'pedido', 'order', 'id');
const iNome = coluna(cab, 'nome', 'name'), iTel = coluna(cab, 'telefone', 'celular', 'phone', 'mobile');
if ([iEmail, iStatus, iProd].includes(-1)) { console.error('Não achei as colunas de e-mail, status e produto. Cabeçalho:', cab); process.exit(1); }

const gravar = flag === '--gravar';
if (gravar) banco();
let ok = 0, pulados = 0;
for (const l of dados) {
  const email = normEmail(l[iEmail]), status = sem(l[iStatus] || ''), produto = produtoDoNome(l[iProd] || '');
  const pago = /pago|paid|aprovad|approved|complet/.test(status);
  if (!emailValido(email) || !produto || !pago) { pulados++; console.log('pulado:', email || '?', '|', l[iProd], '|', l[iStatus]); continue; }
  const pedido = iPed >= 0 ? String(l[iPed]).trim() : '';
  console.log((gravar ? 'importado: ' : 'importaria: ') + email + ' -> ' + liberados(produto).join(', '));
  if (gravar) liberar({ email, produtos: liberados(produto), pedido, origem: 'importacao', nome: iNome >= 0 ? l[iNome] : null, telefone: iTel >= 0 ? String(l[iTel]).replace(/\D/g, '') : null });
  ok++;
}
console.log(`\n${ok} vendas ${gravar ? 'importadas' : 'para importar'}, ${pulados} puladas.${gravar ? '' : ' Rode de novo com --gravar para gravar.'}`);
