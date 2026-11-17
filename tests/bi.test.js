'use strict';
// BI das Lojas (2026-11-17): KPIs diários da planilha "KPI's Lojas" do Guilherme; meta digitada no próprio BI.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('bi.html')).map(s => s.codigo).join('\n');
const diasPadrao = extrairFuncao(codigo, 'diasPadrao', {});
const vendasDoDia = extrairFuncao(codigo, 'vendasDoDia', {});
const resumoMes = extrairFuncao(codigo, 'resumoMes', { vendasDoDia });
const perto = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) < tol, a + ' ≠ ' + b);

test('dias de funcionamento padrão: lojas de segunda a sábado, e-commerce todos os dias', () => {
  assert.strictEqual(diasPadrao(2026, 11, true), 25, 'novembro/2026 tem 5 domingos');
  assert.strictEqual(diasPadrao(2026, 11, false), 30);
  assert.strictEqual(diasPadrao(2026, 2, false), 28);
});

test('vendas do dia: a quantidade lançada ou, sem ela, faturamento ÷ ticket médio', () => {
  assert.strictEqual(vendasDoDia({ faturamento: 27933.69, ticket_medio: 187.47, qtd_vendas: 149 }), 149);
  perto(vendasDoDia({ faturamento: 10815.43, ticket_medio: 183.31, qtd_vendas: null }), 59, 0.01);
  assert.strictEqual(vendasDoDia({ faturamento: 100, ticket_medio: null, qtd_vendas: null }), null);
});

// Exposição, 03 e 04/11/2026 (planilha do Guilherme).
const dias = [
  { faturamento: 27933.69, margem: 12300.88, ticket_medio: 187.47, pecas_atendimento: 5.22, qtd_vendas: 149 },
  { faturamento: 19374.09, margem: 8553.97, ticket_medio: 179.39, pecas_atendimento: 5.08, qtd_vendas: 108 },
];

test('resumo do mês: soma o faturamento e a margem; margem % sobre o faturamento', () => {
  const r = resumoMes(dias, 411200.9, 23, 2);
  perto(r.fat, 47307.78);
  perto(r.margem, 20854.85);
  perto(r.margemPct, 20854.85 / 47307.78, 1e-9);
  perto(r.ating, 47307.78 / 411200.9, 1e-9);
  perto(r.metaDia, 17878.3, 0.01);
});

test('ticket médio e peças por atendimento do mês são PONDERADOS pelas vendas (não média simples dos dias)', () => {
  const r = resumoMes(dias, null, 23, 2);
  assert.strictEqual(r.vendas, 257);
  perto(r.ticket, 47307.78 / 257);                       // ≈ 184,08 (a média simples daria 183,43)
  perto(r.pecasAtend, (149 * 5.22 + 108 * 5.08) / 257);  // ≈ 5,16
});

test('ritmo e projeção usam os dias já trabalhados (com venda)', () => {
  const r = resumoMes(dias, 411200.9, 23, 2);
  perto(r.ritmo, 47307.78 / (17878.3 * 2), 1e-4);         // ≈ 132% — à frente da meta
  perto(r.projecao, 47307.78 / 2 * 23);
});

test('sem meta: atingimento, ritmo e meta diária ficam vazios (não viram zero)', () => {
  const r = resumoMes(dias, null, 23, 2);
  assert.strictEqual(r.ating, null);
  assert.strictEqual(r.ritmo, null);
  assert.strictEqual(r.metaDia, null);
  assert.ok(r.projecao > 0, 'projeção não depende da meta');
});

test('e-commerce sem peças por atendimento: o indicador fica vazio, o resto calcula', () => {
  const r = resumoMes([{ faturamento: 83771.57, margem: 15477.01, ticket_medio: 75.06, pecas_atendimento: null, qtd_vendas: 1116 }], null, 30, 1);
  assert.strictEqual(r.pecasAtend, null);
  assert.strictEqual(r.vendas, 1116);
  perto(r.ticket, 83771.57 / 1116);
});

test('tela: lê bi_kpi_diario e grava a meta em bi_meta_mensal por operação/mês; só Budget/admin altera a meta', () => {
  assert.match(codigo, /from\('bi_kpi_diario'\)/);
  assert.match(codigo, /from\('bi_meta_mensal'\)\.upsert\(\{ operacao: opSel, ano, mes, meta, dias_funcionamento: dias \}, \{ onConflict: 'operacao,ano,mes' \}\)/);
  assert.match(codigo, /const podeMeta = !!\(prof\.is_admin \|\| prof\.can_orcamento\)/);
});
