'use strict';
// Orçamento e Metas: orçamento só de Gastos Operacionais (orçado × real, AV e AH) e metas de receita lançadas por mês (trimestre e ano = soma dos meses).
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const html = ler('orcamento.html');
const codigo = scriptsDaPagina(html).map(s => s.codigo).join('\n');
const analisarLinha = extrairFuncao(codigo, 'analisarLinha', {});
const periodo = extrairFuncao(codigo, 'periodo', {});
const progressoMeta = extrairFuncao(codigo, 'progressoMeta', {});
const fracaoDecorrida = extrairFuncao(codigo, 'fracaoDecorrida', {});
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);

test('orçado × real: diferença, % usado, AV e AH', () => {
  // conta de 1.000 orçado e 1.200 real; total de gastos 4.000 orçado / 5.000 real; mês anterior 800 orçado / 1.000 real
  const a = analisarLinha(1000, 1200, 800, 1000, 4000, 5000);
  assert.strictEqual(a.dif, 200);           // gastou 200 a mais
  perto(a.ating, 1.2);                      // usou 120% do orçado
  perto(a.avOrc, 0.25); perto(a.avReal, 0.24);
  perto(a.ahOrc, 0.25); perto(a.ahReal, 0.2);
});

test('orçado × real: sem orçamento ou sem período anterior não divide por zero', () => {
  const a = analisarLinha(0, 500, 0, 0, 0, 500);
  assert.strictEqual(a.ating, null);
  assert.strictEqual(a.avOrc, null);
  assert.strictEqual(a.ahOrc, null);
  assert.strictEqual(a.ahReal, null);
  perto(a.avReal, 1);
});

test('período: mês compara com o mês anterior, janeiro com dezembro do ano anterior', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(periodo('mes', 2026, 9))), { meses: [{ ano: 2026, mes: 9 }], ant: [{ ano: 2026, mes: 8 }] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(periodo('mes', 2026, 1))).ant, [{ ano: 2025, mes: 12 }]);
});

test('período: acumulado vai de janeiro até o mês e compara com o mesmo intervalo do ano anterior', () => {
  const p = JSON.parse(JSON.stringify(periodo('acum', 2026, 3)));
  assert.deepStrictEqual(p.meses.map(x => x.mes), [1, 2, 3]);
  assert.ok(p.ant.every(x => x.ano === 2025));
});

test('metas: progresso pode passar de 100% e o que falta nunca fica negativo', () => {
  const p = progressoMeta(1000, 1300);
  perto(p.pct, 1.3);
  assert.strictEqual(p.falta, 0);
  assert.strictEqual(progressoMeta(1000, 250).falta, 750);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(progressoMeta(0, 500))), { pct: null, falta: null });
});

test('metas: quanto do trimestre/ano já passou (marca de ritmo)', () => {
  assert.strictEqual(fracaoDecorrida(2026, 4, new Date(2026, 8, 30)), 0);  // T4 ainda não começou
  assert.strictEqual(fracaoDecorrida(2026, 1, new Date(2026, 8, 30)), 1);  // T1 já acabou
  const meio = fracaoDecorrida(2026, 3, new Date(2026, 7, 16));             // meados de agosto
  assert.ok(meio > 0.45 && meio < 0.55, String(meio));
  assert.ok(fracaoDecorrida(2026, 0, new Date(2026, 6, 2)) > 0.49);         // ano: início de julho ≈ metade
});

test('tela: duas abas (orçamento de gastos e metas) e grava nas tabelas novas', () => {
  assert.match(html, /data-aba="orc"/);
  assert.match(html, /data-aba="metas"/);
  assert.match(codigo, /from\('orcamento_gastos'\)/);
  assert.match(codigo, /from\('metas_receita'\)/);
  assert.doesNotMatch(codigo, /from\('orcamento'\)/, 'a tabela antiga (orçamento do DRE inteiro) não é mais usada');
});

test('tela: só entram contas da classe Gastos Operacionais', () => {
  assert.match(codigo, /chaveDe\[c\.classe_id\] === 'gastos_operacionais'/);
});

test('Conselho: meta compara com o Faturamento e orçado com os Gastos Operacionais', () => {
  const conselho = scriptsDaPagina(ler('conselho.html')).map(s => s.codigo).join('\n');
  assert.match(conselho, /id: 'rb'[^\n]*orc: 'rb', rotOrc: 'Meta'/);
  assert.match(conselho, /id: 'opex'[^\n]*orc: 'opex', rotOrc: 'Orçado'/);
  assert.doesNotMatch(conselho, /orc_receita_bruta|orc_deducoes|orc_custos_variaveis/, 'colunas antigas do RPC');
  const orcado = require('./helpers/carregar').extrairFuncao(conselho, 'orcado', {
    porChave: {
      'GIP|2026|9': { tem_meta: true, meta_receita: 300, tem_orc_gastos: true, orc_gastos_operacionais: 100, orc_desp_financeiras: 10, orc_ir_csll: 0 },
      'Exposicao|2026|9': { tem_meta: false, tem_orc_gastos: true, orc_gastos_operacionais: 50, orc_desp_financeiras: 0, orc_ir_csll: 0 },
    },
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(orcado(['GIP'], 2026, 9))), { rb: 300, opex: 90 });
  // Exposição sem meta: no conjunto, a meta some mas o orçado de gastos continua
  assert.deepStrictEqual(JSON.parse(JSON.stringify(orcado(['GIP', 'Exposicao'], 2026, 9))), { rb: null, opex: 140 });
  assert.strictEqual(orcado(['ViaCloset'], 2026, 9), null);
});

test('Conselho e GerônIA leem o sinal novo (tem_orc_gastos), não o antigo do orçamento do DRE inteiro', () => {
  for (const arq of ['conselho.html', '_ds/geronia-chat_index.ts']) {
    const src = ler(arq);
    assert.match(src, /tem_orc_gastos/, arq);
    assert.doesNotMatch(src, /tem_orcamento/, arq);
  }
});

test('metas por mês: o trimestre e o ano são a soma dos meses lançados', () => {
  const somaMetas = extrairFuncao(codigo, 'somaMetas', {});
  const metas = { 1: 100000, 2: 120000, 3: 80000, 10: 300000, 11: 450000 };
  assert.strictEqual(somaMetas(metas, [1, 2, 3]), 300000);          // 1º trimestre
  assert.strictEqual(somaMetas(metas, [10, 11, 12]), 750000);       // dezembro sem meta não zera o resto
  assert.strictEqual(somaMetas(metas, [4, 5, 6]), null);            // trimestre sem nenhuma meta = "não definida"
  assert.strictEqual(somaMetas(metas, Array.from({ length: 12 }, (_, i) => i + 1)), 1050000);
});

test('metas por mês: a tela grava e lê por mês (não por trimestre)', () => {
  assert.match(codigo, /upsert\(ups, \{ onConflict: 'operacao,ano,mes' \}\)/);
  assert.match(codigo, /from\('metas_receita'\)\.select\('mes,valor'\)/);
  assert.doesNotMatch(codigo, /trimestre: t, valor/);
  assert.match(codigo, /data-mes="' \+ m \+ '"/);
});
