'use strict';
// Orçamento e Metas (reformulado em 2026-11-11, modelo "BUDGET"): por operação e mês, estoque inicial em peças,
// vendas e compras previstas × realizadas (R$ e peças), tudo digitado; estoque final em cadeia.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const html = ler('orcamento.html');
const codigo = scriptsDaPagina(html).map(s => s.codigo).join('\n');
const ym = (a, m) => a * 100 + m;
const CAMPOS = ['estoque_inicial_pcs', 'vendas_previstas', 'vendas_realizadas', 'vendas_pcs', 'compras_previstas', 'compras_realizadas', 'compras_pcs'];
const mesesEntre = extrairFuncao(codigo, 'mesesEntre', {});
const calcLinha = extrairFuncao(codigo, 'calcLinha', {});
const encadearEstoque = extrairFuncao(codigo, 'encadearEstoque', { ym, mesesEntre });
const totalPeriodo = extrairFuncao(codigo, 'totalPeriodo', { ym, calcLinha, CAMPOS });
const lerPecas = extrairFuncao(codigo, 'lerPecas', {});
const j = x => JSON.parse(JSON.stringify(x));
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);

test('período: de setembro a março atravessa o ano', () => {
  assert.deepStrictEqual(j(mesesEntre(202609, 202703)).map(p => p.ano + '-' + p.mes), ['2026-9', '2026-10', '2026-11', '2026-12', '2027-1', '2027-2', '2027-3']);
  assert.deepStrictEqual(j(mesesEntre(202703, 202609)), [], '"De" depois de "Até" = vazio');
});

test('vendas: saldo = realizadas − previstas; % = realizadas ÷ previstas', () => {
  const c = calcLinha({ vendas_previstas: 100000, vendas_realizadas: 120000 });
  assert.strictEqual(c.vSaldo, 20000);
  perto(c.vPct, 1.2);
});

test('compras: saldo = previstas − realizadas; % = saldo ÷ previstas (como na planilha)', () => {
  const c = calcLinha({ compras_previstas: 80000, compras_realizadas: 60000 });
  assert.strictEqual(c.cSaldo, 20000);
  perto(c.cPct, 0.25);
});

test('mês sem nada lançado não mostra saldo nem % (não vira zero)', () => {
  const c = calcLinha({});
  assert.strictEqual(c.vSaldo, null); assert.strictEqual(c.vPct, null);
  assert.strictEqual(c.cSaldo, null); assert.strictEqual(c.cPct, null);
  assert.strictEqual(calcLinha({ vendas_realizadas: 500 }).vPct, null, 'sem previsto não dá para dividir');
});

test('estoque: final = inicial − peças vendidas + peças compradas, e vira o inicial do mês seguinte', () => {
  const meses = mesesEntre(202609, 202611);
  const porMes = {
    202609: { estoque_inicial_pcs: 10000, vendas_pcs: 3000, compras_pcs: 2000 },
    202610: { vendas_pcs: 4000, compras_pcs: 5000 },
    202611: { vendas_pcs: 1000 },
  };
  const e = j(encadearEstoque(porMes, meses));
  assert.deepStrictEqual(e[202609], { ini: 10000, fim: 9000, herdado: false });
  assert.deepStrictEqual(e[202610], { ini: 9000, fim: 10000, herdado: true });
  assert.deepStrictEqual(e[202611], { ini: 10000, fim: 9000, herdado: true });
});

test('estoque: inicial digitado corrige a cadeia (inventário)', () => {
  const porMes = { 202609: { estoque_inicial_pcs: 10000, vendas_pcs: 3000 }, 202610: { estoque_inicial_pcs: 6500, vendas_pcs: 500 } };
  const e = j(encadearEstoque(porMes, mesesEntre(202609, 202610)));
  assert.deepStrictEqual(e[202610], { ini: 6500, fim: 6000, herdado: false });
});

test('estoque: a cadeia começa no primeiro mês lançado, mesmo antes do período mostrado', () => {
  const porMes = { 202607: { estoque_inicial_pcs: 5000, compras_pcs: 1000 }, 202608: { vendas_pcs: 2000 } };
  const e = j(encadearEstoque(porMes, mesesEntre(202609, 202609)));
  assert.deepStrictEqual(e[202609], { ini: 4000, fim: 4000, herdado: true });
});

test('estoque: sem nenhum estoque inicial não inventa o final', () => {
  const e = j(encadearEstoque({ 202609: { vendas_pcs: 300, compras_pcs: 1000 } }, mesesEntre(202609, 202610)));
  assert.strictEqual(e[202609].fim, null);
  assert.strictEqual(e[202610].ini, null);
});

test('total do período: soma R$ e peças; estoque inicial do 1º mês e final do último', () => {
  const meses = mesesEntre(202609, 202610);
  const linhas = [
    { vendas_previstas: 100, vendas_realizadas: 90, vendas_pcs: 10, compras_previstas: 50, compras_realizadas: 40, compras_pcs: 5 },
    { vendas_previstas: 100, vendas_realizadas: 130, vendas_pcs: 12, compras_previstas: 50, compras_realizadas: 70 },
  ];
  const est = { 202609: { ini: 100, fim: 95 }, 202610: { ini: 95, fim: 83 } };
  const t = j(totalPeriodo(linhas, est, meses));
  assert.strictEqual(t.vendas_previstas, 200); assert.strictEqual(t.vendas_realizadas, 220); assert.strictEqual(t.vSaldo, 20);
  perto(t.vPct, 1.1);
  assert.strictEqual(t.compras_previstas, 100); assert.strictEqual(t.cSaldo, -10);
  assert.strictEqual(t.compras_pcs, 5); assert.strictEqual(t.vendas_pcs, 22);
  assert.strictEqual(t.ini, 100); assert.strictEqual(t.fim, 83);
});

test('peças: aceita milhar com ponto e vazio fica vazio', () => {
  assert.strictEqual(lerPecas('1.250'), 1250);
  assert.strictEqual(lerPecas(''), null);
  assert.strictEqual(lerPecas('  '), null);
});

test('tela: as 3 operações na ordem da planilha e grava em orcamento_mensal por operação/mês', () => {
  assert.ok(codigo.indexOf("id: 'Exposicao'") < codigo.indexOf("id: 'ViaCloset'") && codigo.indexOf("id: 'ViaCloset'") < codigo.indexOf("id: 'GIP'"));
  assert.match(codigo, /from\('orcamento_mensal'\)\.upsert\(ups, \{ onConflict: 'operacao,ano,mes' \}\)/);
  assert.doesNotMatch(codigo, /orcamento_gastos|metas_receita/, 'tabelas antigas foram apagadas');
});

test('Conselho: meta compara com o Faturamento; orçado de gastos não existe mais (fica nulo)', () => {
  const conselho = scriptsDaPagina(ler('conselho.html')).map(s => s.codigo).join('\n');
  assert.match(conselho, /id: 'rb'[^\n]*orc: 'rb', rotOrc: 'Meta'/);
  const orcado = extrairFuncao(conselho, 'orcado', {
    porChave: {
      'GIP|2026|9': { tem_meta: true, meta_receita: 300, tem_orc_gastos: false },
      'Exposicao|2026|9': { tem_meta: false, tem_orc_gastos: false },
    },
  });
  assert.deepStrictEqual(j(orcado(['GIP'], 2026, 9)), { rb: 300, opex: null });
  assert.strictEqual(orcado(['GIP', 'Exposicao'], 2026, 9), null, 'Exposição sem venda prevista: o conjunto não compara');
});

test('GerônIA: lê o orçamento novo com o estoque encadeado igual à tela', () => {
  const { carregarEdge } = require('./helpers/carregar');
  const { pegar } = carregarEdge('geronia-chat');
  const txt = pegar('orcamentoText')([
    { operacao: 'Exposicao', ano: 2026, mes: 9, estoque_inicial_pcs: 10000, vendas_previstas: 100000, vendas_realizadas: 90000, vendas_pcs: 3000, compras_pcs: 2000 },
    { operacao: 'Exposicao', ano: 2026, mes: 10, vendas_pcs: 4000, compras_pcs: 5000 },
  ]);
  assert.match(txt, /Set\/2026: estoque inicial 10\.000 pçs/);
  assert.match(txt, /Out\/2026: estoque inicial 9\.000 pçs[^\n]*estoque final 10\.000 pçs/);
  assert.strictEqual(pegar('orcamentoText')([]), '');
  const src = ler('_ds/geronia-chat_index.ts');
  assert.match(src, /from\('orcamento_mensal'\)/);
  assert.doesNotMatch(src, /ORÇAMENTO DE GASTOS|tem_orc_gastos/, 'orçamento de gastos não existe mais');
});
