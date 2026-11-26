/* Configuração da máquina. Tudo vem de variáveis de ambiente, que o systemd lê de /etc/cobaia/env.
   Nenhuma senha fica no GitHub. Modelo do arquivo: maquina/sistema/env.exemplo */

const lista = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const CONFIG = {
  // Endereço público da máquina, sem barra no fim. Hoje o provisório (sslip.io), depois https://cobaia.dev.br
  SITE: (process.env.SITE || 'http://localhost:8080').replace(/\/$/, ''),
  // Arquivo do banco SQLite
  BANCO: process.env.BANCO || '/var/lib/cobaia/cobaia.db',
  // Pasta do site (as páginas e os guias). Na máquina, o próprio clone do repositório.
  RAIZ_SITE: process.env.RAIZ_SITE || new URL('../../', import.meta.url).pathname,
  // Segredo que assina os cookies de login (64 letras aleatórias)
  SEGREDO: process.env.SEGREDO || '',
  // Tokens dos webhooks da Kiwify, separados por vírgula (um por produto)
  KIWIFY_TOKENS: lista(process.env.KIWIFY_TOKENS),
  // Id do produto "suporte pessoal" na Kiwify, para reconhecer o order bump do notebook
  KIWIFY_SUPORTE_ID: process.env.KIWIFY_SUPORTE_ID || '',
  // Envio de e-mail: 'brevo' ou 'resend' + a chave da API + o remetente
  EMAIL_SERVICO: process.env.EMAIL_SERVICO || '',
  EMAIL_CHAVE: process.env.EMAIL_CHAVE || '',
  EMAIL_DE: process.env.EMAIL_DE || 'Luis do Cobaia <ola@cobaia.dev.br>',
  EMAIL_RESPONDER_PARA: process.env.EMAIL_RESPONDER_PARA || '',
  // WhatsApp de suporte (só números, com 55)
  WHATSAPP_SUPORTE: String(process.env.WHATSAPP_SUPORTE || '').replace(/\D/g, ''),
  // Portas internas (o porteiro é quem fala com a internet)
  PORTA_VENDAS: Number(process.env.PORTA_VENDAS || 3001),
  PORTA_ACESSO: Number(process.env.PORTA_ACESSO || 3002),
};

export function exigir(...nomes) {
  const faltam = nomes.filter((n) => !CONFIG[n] || (Array.isArray(CONFIG[n]) && !CONFIG[n].length));
  if (faltam.length) console.error('Aviso: faltam variáveis em /etc/cobaia/env:', faltam.join(', '));
  if (faltam.includes('SEGREDO')) process.exit(1); // sem segredo não há login seguro
}
