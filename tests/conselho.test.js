'use strict';
// Painel do Conselho: as contas de EBITDA / Resultado. Regressão contra mexer na fórmula sem querer.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('conselho.html')).map(s => s.codigo).join('\n');
const snap = extrairFuncao(codigo, 'snap', {});

const mes = { rb: 1000, ded: 100, cv: 200, go: 300, df: 0, ir: 0, cmv: 150, pessoal: 80 };

test('conselho: sem despesa financeira nem IR, EBITDA == Resultado Líquido', () => {
  const s = snap(mes);
  assert.strictEqual(s.rl, 900);
  assert.strictEqual(s.mc, 700);
  assert.strictEqual(s.ebitda, 400);
  assert.strictEqual(s.res, 400);
});

test('conselho: despesas financeiras e IR reduzem o Resultado mas não o EBITDA', () => {
  const s = snap({ ...mes, go: 300, df: 40, ir: 10 });
  assert.strictEqual(s.ebitda, 450); // 700 - (300 - 40 - 10)
  assert.strictEqual(s.res, 400);    // 450 - 40 - 10
});

test('conselho: percentuais ficam nulos quando não há faturamento', () => {
  const s = snap({ ...mes, rb: 0 });
  assert.strictEqual(s.ebitdaPct, null);
  assert.strictEqual(s.mcPct, null);
});

test('conselho: margem bruta desconta o CMV da receita líquida', () => {
  assert.strictEqual(snap(mes).mb, 750);
});

test('conselho: avisa quando EBITDA == Resultado por falta de despesa financeira e IR', () => {
  const aviso = extrairFuncao(codigo, 'avisoEbitdaIgual', {});
  assert.match(aviso(snap(mes)), /EBITDA igual ao Resultado/);
  assert.strictEqual(aviso(snap({ ...mes, df: 40 })), null);
  assert.strictEqual(aviso(snap({ ...mes, ir: 10 })), null);
  assert.strictEqual(aviso(null), null);
});

test('conselho: o aviso entra na faixa de avisos da tela', () => {
  assert.match(codigo, /avisoEbitdaIgual\(cur\)[^\n]*msgs\.push/);
});

// ── Bloco "Metas e Orçamento" ───────────────────────────────────────────────
const resumoMetas = extrairFuncao(codigo, 'resumoMetas', {});
const resumoCompras = extrairFuncao(codigo, 'resumoCompras', {});
const pc = {
  'GIP|2026|7': { tem_meta: true, meta_receita: 1000, receita_bruta: 900 },
  'GIP|2026|8': { tem_meta: true, meta_receita: 1000, receita_bruta: 1100 },
  'GIP|2026|9': { tem_meta: true, meta_receita: 1000, receita_bruta: 800 },
  'ViaCloset|2026|9': { tem_meta: false, meta_receita: 0, receita_bruta: 5000 },
};
const tri3 = [7, 8, 9].map(mes => ({ ano: 2026, mes }));

test('metas no Conselho: trimestre soma as metas dos meses e o realizado até o mês', () => {
  const r = resumoMetas(['GIP'], tri3, tri3.slice(0, 2), pc);    // agosto selecionado: realizado de jul+ago
  assert.strictEqual(r.meta, 3000);
  assert.strictEqual(r.real, 2000);
  assert.strictEqual(r.falta, 1000);
});

test('metas no Conselho: operação sem meta não entra (não infla o atingimento)', () => {
  const r = resumoMetas(['GIP', 'ViaCloset'], [{ ano: 2026, mes: 9 }], [{ ano: 2026, mes: 9 }], pc);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.com)), ['GIP']);
  assert.strictEqual(r.real, 800, 'a venda da Via Closet (sem meta) fica de fora');
  assert.strictEqual(r.pct, 0.8);
  assert.strictEqual(resumoMetas(['ViaCloset'], [{ ano: 2026, mes: 9 }], [{ ano: 2026, mes: 9 }], pc).pct, null);
});

test('compras no Conselho: previstas × realizadas por operação, só das que têm compra prevista', () => {
  const linhas = [
    { operacao: 'GIP', ano: 2026, mes: 9, compras_previstas: 100000, compras_realizadas: 120000 },
    { operacao: 'Exposicao', ano: 2026, mes: 9, compras_previstas: 50000, compras_realizadas: 30000 },
    { operacao: 'ViaCloset', ano: 2026, mes: 9, compras_previstas: null, compras_realizadas: 9999 },
    { operacao: 'GIP', ano: 2026, mes: 8, compras_previstas: 80000, compras_realizadas: 70000 },
  ];
  const r = JSON.parse(JSON.stringify(resumoCompras(['GIP', 'Exposicao', 'ViaCloset'], [{ ano: 2026, mes: 9 }], linhas)));
  assert.deepStrictEqual(r.com, ['GIP', 'Exposicao'], 'Via Closet sem compra prevista fica de fora');
  assert.deepStrictEqual(r.tot, { prev: 150000, real: 150000 });
  assert.strictEqual(r.saldo, 0);
  assert.strictEqual(r.uso, 1);
  const acum = resumoCompras(['GIP'], [8, 9].map(mes => ({ ano: 2026, mes })), linhas);
  assert.strictEqual(acum.tot.prev, 180000);
  assert.strictEqual(acum.tot.real, 190000);
});

test('bloco Metas e Orçamento está na tela, no render e no PDF', () => {
  const html = ler('conselho.html');
  assert.match(html, /id="panel-mo"/);
  assert.match(codigo, /renderMetasOrc\(ops, ano, mes\)/);
  assert.match(codigo, /from\('orcamento_mensal'\)\.select\('operacao,ano,mes,compras_previstas,compras_realizadas'\)/);
  assert.doesNotMatch(codigo, /conselho_orcamento_campos/, 'RPC antigo (orçamento de gastos) foi apagado');
  assert.match(codigo, /id: 'metasorc'/);
  assert.match(codigo, /if \(sel\.opcoes\.metasorc\)/);
});
