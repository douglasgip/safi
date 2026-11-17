'use strict';
// Painel do Conselho: filtro de período (um mês, YTD, trimestre, últimos 3/12, ano inteiro, meses específicos).
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('conselho.html')).map(s => s.codigo).join('\n');
const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const idxM = p => p.ano * 12 + p.mes - 1;
const deIdx = i => ({ ano: Math.floor(i / 12), mes: (i % 12) + 1 });
const G = { idxM, deIdx, MES_CURTO };
const mesesDoPeriodo = extrairFuncao(codigo, 'mesesDoPeriodo', G);
const periodoAnterior = extrairFuncao(codigo, 'periodoAnterior', G);
const periodoAnoAnterior = extrairFuncao(codigo, 'periodoAnoAnterior', G);
const rotuloPeriodo = extrairFuncao(codigo, 'rotuloPeriodo', G);
const j = x => JSON.parse(JSON.stringify(x));
const ms = (ano, ...m) => m.map(mes => ({ ano, mes }));

test('período: um mês, YTD, trimestre até o mês, últimos 3 e 12, ano inteiro', () => {
  assert.deepStrictEqual(j(mesesDoPeriodo('mes', 2026, 10)), ms(2026, 10));
  assert.deepStrictEqual(j(mesesDoPeriodo('ytd', 2026, 10)), ms(2026, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
  assert.deepStrictEqual(j(mesesDoPeriodo('tri', 2026, 11)), ms(2026, 10, 11));
  assert.deepStrictEqual(j(mesesDoPeriodo('u3', 2026, 2)), [...ms(2025, 12), ...ms(2026, 1, 2)], 'atravessa a virada do ano');
  assert.strictEqual(mesesDoPeriodo('u12', 2026, 10).length, 12);
  assert.strictEqual(mesesDoPeriodo('ano', 2026, 3).length, 12);
});

test('meses específicos: ordena, tira repetidos e, vazio, cai no mês escolhido', () => {
  assert.deepStrictEqual(j(mesesDoPeriodo('esp', 2026, 10, [...ms(2026, 9, 3), { ano: 2026, mes: 3 }])), ms(2026, 3, 9));
  assert.deepStrictEqual(j(mesesDoPeriodo('esp', 2026, 10, [])), ms(2026, 10));
});

test('comparação: período anterior do mesmo tamanho e mesmo período do ano anterior', () => {
  assert.deepStrictEqual(j(periodoAnterior(ms(2026, 4, 5, 6))), ms(2026, 1, 2, 3));
  assert.deepStrictEqual(j(periodoAnterior(ms(2026, 1, 2))), ms(2025, 11, 12));
  // meses específicos (mar e mai): volta o tamanho do intervalo (3 meses) mantendo a distância entre eles
  assert.deepStrictEqual(j(periodoAnterior(ms(2026, 3, 5))), [{ ano: 2025, mes: 12 }, { ano: 2026, mes: 2 }]);
  assert.deepStrictEqual(j(periodoAnoAnterior(ms(2026, 1, 10))), ms(2025, 1, 10));
});

test('rótulo do período', () => {
  assert.strictEqual(rotuloPeriodo(ms(2026, 10)), 'Out/2026');
  assert.strictEqual(rotuloPeriodo(ms(2026, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)), 'Jan–Out/2026');
  assert.strictEqual(rotuloPeriodo([...ms(2025, 12), ...ms(2026, 1)]), 'Dez/2025–Jan/2026');
  assert.strictEqual(rotuloPeriodo(ms(2026, 3, 9)), 'Mar, Set/2026');
});

test('realizado do período soma os meses (e operações) — mês sem DRE não zera o período', () => {
  const porChave = {
    'GIP|2026|9': { receita_bruta: 100, deducoes: 10, custos_variaveis: 40, gastos_operacionais: 20, desp_financeiras: 0, ir_csll: 0 },
    'GIP|2026|10': { receita_bruta: 300, deducoes: 30, custos_variaveis: 120, gastos_operacionais: 20, desp_financeiras: 0, ir_csll: 0 },
  };
  const snap = extrairFuncao(codigo, 'snap', {});
  const zero = () => ({ rb: 0, ded: 0, cv: 0, go: 0, df: 0, ir: 0, cmv: 0, pessoal: 0 });
  const somar = (a, b) => { Object.keys(a).forEach(x => { a[x] += (b[x] || 0); }); return a; };
  const brutoDoMes = extrairFuncao(codigo, 'brutoDoMes', { porChave, detalhePorChave: {}, zero, somar });
  const realizadoP = extrairFuncao(codigo, 'realizadoP', { brutoDoMes, zero, somar, snap });
  const s = realizadoP(['GIP'], ms(2026, 8, 9, 10));
  assert.strictEqual(s.rb, 400);
  assert.strictEqual(s.mc, 400 - 40 - 160);
  assert.strictEqual(s.res, 200 - 40);
  assert.strictEqual(realizadoP(['GIP'], ms(2026, 1, 2)), null);
});

test('metas: o realizado só conta os meses que têm meta (meta de set–dez não se compara com venda de jan–out)', () => {
  const resumoMetas = extrairFuncao(codigo, 'resumoMetas', {});
  const pc = {
    'GIP|2026|8': { tem_meta: false, meta_receita: 0, receita_bruta: 5000 },
    'GIP|2026|9': { tem_meta: true, meta_receita: 1000, receita_bruta: 900 },
    'GIP|2026|10': { tem_meta: true, meta_receita: 1000, receita_bruta: 1100 },
  };
  const r = resumoMetas(['GIP'], ms(2026, 8, 9, 10), ms(2026, 8, 9, 10), pc);
  assert.strictEqual(r.meta, 2000);
  assert.strictEqual(r.real, 2000, 'agosto (sem meta) fica fora do realizado');
  assert.strictEqual(r.pct, 1);
});

test('meta do período só existe se todos os meses têm meta (senão não compara)', () => {
  const tab = { 9: { rb: 1000, opex: null }, 10: { rb: 2000, opex: null } };
  const orcadoP = extrairFuncao(codigo, 'orcadoP', { orcado: (ops, a, m) => tab[m] || null });
  assert.deepStrictEqual(j(orcadoP(['GIP'], ms(2026, 9, 10))), { rb: 3000, opex: null });
  assert.strictEqual(orcadoP(['GIP'], ms(2026, 8, 9, 10)), null);
  assert.deepStrictEqual(j(orcadoP(['GIP'], ms(2026, 10))), { rb: 2000, opex: null });
});

test('o filtro de período manda em todo o painel (KPIs, operações, rentabilidade, pessoas, indicadores e PDF)', () => {
  assert.match(ler('conselho.html'), /<select class="fe-select" id="sel-per">[\s\S]*value="ytd"[\s\S]*value="esp"/);
  assert.match(codigo, /const cur = realizadoP\(ops, meses\);/);
  assert.match(codigo, /renderOps\(meses, rot, modo\)/);
  assert.match(codigo, /renderPessoas\(ops, meses, rot, cur\)/);
  assert.match(codigo, /renderIndicadores\(ops, meses, rot\)/);
  assert.match(codigo, /\['Período', ULTIMO\.rot/);
});
