'use strict';
// DRE: a linha "GIP Ecommerce" abre a venda por canal (marketplace), somando as contas de "Venda Ecommerce".
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const DC = 'Grupo Sacoman - Painel Contábil.dc.html';
const html = ler(DC);
const codigo = scriptsDaPagina(html).map(s => s.codigo).join('\n');
const canalDoSubcampo = extrairFuncao(codigo, 'canalDoSubcampo', {});
const agruparCanais = extrairFuncao(codigo, 'agruparCanais', { canalDoSubcampo });

test('cada conta de venda vai para o canal certo', () => {
  const casos = {
    'Shopee (EP)': 'Shopee', 'Shopee (Full)': 'Shopee', 'Shopee (Isa)': 'Shopee',
    'Mercado Livre (EP) (Full)': 'Mercado Livre', 'Mercado Livre (VIA)': 'Mercado Livre',
    'Shein (GIP)': 'Shein', 'TikTok (EP)': 'TikTok Shop', 'Magalu (GIP)': 'Magalu',
    'Temu (EP)': 'Temu', 'TEMu Douglas': 'Temu', 'Nuvemshop': 'Nuvemshop', 'Venda E-commerce': 'Outros',
  };
  for (const [conta, canal] of Object.entries(casos)) assert.strictEqual(canalDoSubcampo(conta), canal, conta);
});

test('agrupa por canal, do maior para o menor, e ignora contas zeradas', () => {
  const g = JSON.parse(JSON.stringify(agruparCanais([
    { nome: 'Shopee (GIP)', total: 216919.38, ant: 212945.41 },
    { nome: 'Shopee (VIA)', total: 209091.85, ant: 175705.88 },
    { nome: 'Shein (GIP)', total: 170793.54, ant: 122959.5 },
    { nome: 'Magalu (GIP)', total: 0, ant: 0 },
    { nome: 'Temu (EP)', total: 3359.5, ant: 1227.63 },
  ])));
  assert.deepStrictEqual(g.map(x => x.canal), ['Shopee', 'Shein', 'Temu']);
  assert.ok(Math.abs(g[0].total - 426011.23) < 0.01);
  assert.ok(Math.abs(g[0].ant - 388651.29) < 0.01);
  assert.deepStrictEqual(g[0].contas.map(c => c.nome), ['Shopee (GIP)', 'Shopee (VIA)']);
});

test('sem período anterior, o canal fica sem base (AH "—")', () => {
  const g = agruparCanais([{ nome: 'Shopee (EP)', total: 10, ant: null }, { nome: 'Shopee (GIP)', total: 5, ant: 3 }]);
  assert.strictEqual(g[0].ant, null);
});

test('a linha GIP Ecommerce tem a seta e só abre quando clicada', () => {
  assert.match(codigo, /ecomExpanded: false/);
  assert.match(codigo, /l:'GIP Ecommerce'[^\n]*toggle:/);
  assert.match(html, /onClick="\{\{ row\.toggleFn \}\}" title="Ver a venda por canal"/);
  assert.match(codigo, /_lancCampoIdByNome\['Venda Ecommerce'\]/);
});
