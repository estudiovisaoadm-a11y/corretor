// Demo offline — roda sem internet: node demo.js
const { analisar, fichaMarkdown } = require('./src/ficha');

const casos = [
  {
    nome: 'DFImóveis — Águas Claras com selo seguro',
    url: 'https://www.dfimoveis.com.br/venda/df/aguas-claras/sul/apartamento?imovelseguro=true',
    texto: 'Apartamento 70m² R$ 550 mil em Águas Claras Sul, aceita financiamento FGTS, escritura e habite-se ok, matrícula atualizada.'
  },
  {
    nome: 'WImóveis — queda de preço',
    url: 'https://www.wimoveis.com.br/venda/apartamentos/df/brasilia/asa-norte?sort=most_lowered_price',
    texto: 'Ap 65m² R$ 620 mil Asa Norte, somente à vista, não aceita permuta, sem menção de documentos.'
  },
  {
    nome: 'NetImóveis — DF genérico',
    url: 'https://www.netimoveis.com/venda/distrito-federal/brasilia/apartamento?tipo=apartamento&localizacao=BR-DF-brasilia---&transacao=venda',
    texto: 'Casa 120m² R$ 700 mil, aceita permuta por outro imóvel com torna, aceita financiamento, IPTU em dia.'
  }
];

for (const c of casos) {
  const a = analisar({ url: c.url, texto: c.texto });
  console.log('\n' + '='.repeat(70));
  console.log(c.nome);
  console.log(fichaMarkdown(a));
}
