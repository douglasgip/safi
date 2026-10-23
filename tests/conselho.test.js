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
const resumoGastos = extrairFuncao(codigo, 'resumoGastos', {});
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

test('orçamento no Conselho: orçado × real por grupo, só das operações com orçamento', () => {
  const linhas = [
    { operacao: 'GIP', ano: 2026, mes: 9, campo: 'Despesas de Pessoal', ordem: 5, orcado: 70000, realizado: 69313, tem_orc: true },
    { operacao: 'GIP', ano: 2026, mes: 9, campo: 'Despesas Administrativas', ordem: 2, orcado: 20000, realizado: 26873.46, tem_orc: true },
    { operacao: 'ViaCloset', ano: 2026, mes: 9, campo: 'Despesas de Pessoal', ordem: 5, orcado: 0, realizado: 79717.53, tem_orc: false },
    { operacao: 'GIP', ano: 2026, mes: 8, campo: 'Despesas de Pessoal', ordem: 5, orcado: 70000, realizado: 83814.73, tem_orc: true },
  ];
  const r = JSON.parse(JSON.stringify(resumoGastos(['GIP', 'ViaCloset'], [{ ano: 2026, mes: 9 }], linhas)));
  assert.deepStrictEqual(r.com, ['GIP']);
  assert.deepStrictEqual(r.grupos.map(x => x.campo), ['Despesas Administrativas', 'Despesas de Pessoal'], 'na ordem do DRE');
  assert.strictEqual(r.tot.orcado, 90000);
  assert.ok(Math.abs(r.tot.real - 96186.46) < 0.01, 'sem o real da Via Closet, que não tem orçamento');
  const acum = resumoGastos(['GIP'], [8, 9].map(mes => ({ ano: 2026, mes })), linhas);
  assert.strictEqual(acum.tot.orcado, 160000);
});

test('bloco Metas e Orçamento está na tela, no render e no PDF', () => {
  const html = ler('conselho.html');
  assert.match(html, /id="panel-mo"/);
  assert.match(codigo, /renderMetasOrc\(ops, ano, mes\)/);
  assert.match(codigo, /rpc\('conselho_orcamento_campos'/);
  assert.match(codigo, /id: 'metasorc'/);
  assert.match(codigo, /if \(sel\.opcoes\.metasorc\)/);
});
