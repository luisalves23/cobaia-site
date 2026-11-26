/* Catálogo da plataforma. Cada produto diz o nome, a pasta protegida que ele abre e o que uma compra libera.
   Produto novo = uma entrada aqui + um webhook na Kiwify com ?produto=<id>. */

export const PRODUTOS = {
  tablet: {
    nome: 'Guia do seu tablet',
    descricao: 'O passo a passo feito para o seu modelo. Quando ficar pronto, ele aparece aqui.',
    // O guia do tablet é feito por modelo, depois da compra: o Luis libera "tablet:<pasta>" para a pessoa.
  },
  gta: {
    nome: 'Guia completo de cortes de GTA VI',
    descricao: 'O guia do Dia 11, com a skill e os pedidos prontos para colar.',
    pasta: '/gta/guia/',
  },
  notebook: {
    nome: 'Notebook Ressuscitado: guia completo',
    descricao: 'Do notebook parado ao notebook rápido e bonito, por fases.',
    pasta: '/notebook/guia/',
  },
  'notebook-suporte': {
    nome: 'Notebook Ressuscitado: suporte pessoal do Luis',
    descricao: 'O Luis com você no WhatsApp até o notebook ficar pronto.',
    suporte: true,
  },
  teste: {
    nome: 'Produto de teste',
    descricao: 'Só para testar a entrega. Não aparece no site.',
    pasta: '/teste/guia/',
  },
  suporte: {
    nome: 'Suporte pessoal do Luis',
    descricao: 'Atendimento com o Luis no WhatsApp, do começo ao fim.',
    suporte: true,
  },
};

/* O que cada compra libera (o suporte do notebook traz o guia junto). */
const LIBERA = {
  tablet: ['tablet'],
  gta: ['gta'],
  notebook: ['notebook'],
  'notebook-suporte': ['notebook', 'notebook-suporte'],
  suporte: ['suporte'],
  teste: ['teste'],
};
export const liberados = (produto) => LIBERA[produto] || [];

/* Guias de tablet feitos sob medida: produto "tablet:<pasta>" abre /tablet/g/<pasta>/ */
const TABLET = /^tablet:([a-z0-9-]{3,60})$/;
export const ehGuiaTablet = (p) => TABLET.test(p);

export function produtoValido(p) {
  return Object.hasOwn(PRODUTOS, p) || ehGuiaTablet(p);
}

export function infoProduto(p) {
  if (Object.hasOwn(PRODUTOS, p)) return PRODUTOS[p];
  const m = TABLET.exec(p);
  if (m) return { nome: 'Seu guia do tablet (' + m[1].split('-')[0].toUpperCase() + ')', descricao: 'Feito para o seu modelo.', pasta: '/tablet/g/' + m[1] + '/' };
  return null;
}

/* Que produto uma pasta protegida exige. Devolve null para o que não é protegido. */
export function produtoDoCaminho(caminho) {
  if (caminho.startsWith('/gta/guia/')) return 'gta';
  if (caminho.startsWith('/notebook/guia/')) return 'notebook';
  if (caminho.startsWith('/teste/guia/')) return 'teste';
  const m = /^\/tablet\/g\/([a-z0-9-]{3,60})\//.exec(caminho);
  if (m) return 'tablet:' + m[1];
  return null;
}

export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const emailValido = (e) => /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(e);
