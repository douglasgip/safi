'use strict';
// BI das Lojas (2026-11-17): KPIs diários da planilha "KPI's Lojas" do Guilherme; meta digitada no próprio BI.
// Filtros: várias operações somadas, período livre/atalhos, dia da semana e comparação com outro período.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('bi.html')).map(s => s.codigo).join('\n');
// helpers de data da página (mesmo texto da tela)
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dt = s => new Date(s + 'T12:00:00');
const somaDias = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };
assert.ok(codigo.includes("const somaDias = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };"));
const LOJA = { Exposicao: true, ViaCloset: true, GIP: false };
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const diasPadrao = extrairFuncao(codigo, 'diasPadrao', {});
const vendasDoDia = extrairFuncao(codigo, 'vendasDoDia', {});
const totais = extrairFuncao(codigo, 'totais', { vendasDoDia });
const periodoPreset = extrairFuncao(codigo, 'periodoPreset', { iso, dt, somaDias });
const deslocaMeses = extrairFuncao(codigo, 'deslocaMeses', { iso });
const periodoComparacao = extrairFuncao(codigo, 'periodoComparacao', { dt, somaDias, deslocaMeses });
const metaDoPeriodo = extrairFuncao(codigo, 'metaDoPeriodo', { dt, somaDias });
const porDia = extrairFuncao(codigo, 'porDia', { totais });
const porDiaDaSemana = extrairFuncao(codigo, 'porDiaDaSemana', { totais, dt, ORDEM_SEMANA });
const j = x => JSON.parse(JSON.stringify(x));
const perto = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) < tol, a + ' ≠ ' + b);

test('dias de funcionamento padrão: lojas de segunda a sábado, e-commerce todos os dias', () => {
  assert.strictEqual(diasPadrao(2026, 11, true), 25, 'novembro/2026 tem 5 domingos');
  assert.strictEqual(diasPadrao(2026, 11, false), 30);
});

test('vendas do dia: a quantidade lançada ou, sem ela, faturamento ÷ ticket médio', () => {
  assert.strictEqual(vendasDoDia({ faturamento: 27933.69, ticket_medio: 187.47, qtd_vendas: 149 }), 149);
  perto(vendasDoDia({ faturamento: 10815.43, ticket_medio: 183.31, qtd_vendas: null }), 59, 0.01);
});

// Exposição, 03 e 04/11/2026 (planilha do Guilherme).
const expo = [
  { operacao: 'Exposicao', data: '2026-11-03', faturamento: 27933.69, margem: 12300.88, ticket_medio: 187.47, pecas_atendimento: 5.22, qtd_vendas: 149 },
  { operacao: 'Exposicao', data: '2026-11-04', faturamento: 19374.09, margem: 8553.97, ticket_medio: 179.39, pecas_atendimento: 5.08, qtd_vendas: 108 },
];

test('totais: ticket médio e peças por atendimento PONDERADOS pelas vendas (não média simples dos dias)', () => {
  const t = totais(expo);
  perto(t.fat, 47307.78);
  assert.strictEqual(t.vendas, 257);
  perto(t.ticket, 47307.78 / 257);
  perto(t.pecasAtend, (149 * 5.22 + 108 * 5.08) / 257);
  perto(t.margemPct, 20854.85 / 47307.78, 1e-9);
});

test('totais com e-commerce junto: peças por atendimento só conta as lojas (o e-commerce não tem)', () => {
  const t = totais(expo.concat([{ operacao: 'GIP', data: '2026-11-03', faturamento: 39897.89, margem: 6522.66, ticket_medio: 71.25, pecas_atendimento: null, qtd_vendas: 560 }]));
  perto(t.pecasAtend, (149 * 5.22 + 108 * 5.08) / 257);
  assert.strictEqual(t.vendas, 817);
});

test('atalhos de período (semana começa na segunda)', () => {
  const h = '2026-11-17';  // terça
  assert.deepStrictEqual(j(periodoPreset('hoje', h)), { de: h, ate: h });
  assert.deepStrictEqual(j(periodoPreset('ontem', h)), { de: '2026-11-16', ate: '2026-11-16' });
  assert.deepStrictEqual(j(periodoPreset('semana', h)), { de: '2026-11-16', ate: '2026-11-22' });
  assert.deepStrictEqual(j(periodoPreset('semana_ant', h)), { de: '2026-11-09', ate: '2026-11-15' });
  assert.deepStrictEqual(j(periodoPreset('mes', h)), { de: '2026-11-01', ate: '2026-11-30' });
  assert.deepStrictEqual(j(periodoPreset('mes_ant', h)), { de: '2026-10-01', ate: '2026-10-31' });
  assert.deepStrictEqual(j(periodoPreset('ano', h)), { de: '2026-01-01', ate: '2026-12-31' });
  assert.deepStrictEqual(j(periodoPreset('semana', '2026-11-22')), { de: '2026-11-16', ate: '2026-11-22' }, 'domingo fica na semana que começou na segunda');
});

test('comparação: período anterior do mesmo tamanho, mesmo período do mês e do ano anterior', () => {
  assert.deepStrictEqual(j(periodoComparacao('anterior', '2026-11-09', '2026-11-15')), { de: '2026-11-02', ate: '2026-11-08' });
  assert.deepStrictEqual(j(periodoComparacao('mes', '2026-11-01', '2026-11-15')), { de: '2026-10-01', ate: '2026-10-15' });
  assert.deepStrictEqual(j(periodoComparacao('mes', '2026-03-01', '2026-03-31')), { de: '2026-02-01', ate: '2026-02-28' }, '31/03 − 1 mês = 28/02');
  assert.deepStrictEqual(j(periodoComparacao('ano', '2026-11-01', '2026-11-30')), { de: '2025-11-01', ate: '2025-11-30' });
  assert.strictEqual(periodoComparacao('', '2026-11-01', '2026-11-30'), null);
});

// Metas por DIA (como na planilha do Guilherme): Exposição 17.878,30 em 23 dias de novembro (sem 02/11, 20/11 e domingos).
const FECHADOS = ['2026-11-02', '2026-11-20'];
const metasDia = {};
for (let d = 1; d <= 30; d++) {
  const s = '2026-11-' + String(d).padStart(2, '0');
  if (dt(s).getDay() !== 0 && !FECHADOS.includes(s)) metasDia['Exposicao|' + s] = 17878.3;
}
const metaDia = (op, s) => (op + '|' + s) in metasDia ? metasDia[op + '|' + s] : null;
const semUltima = () => null;

test('metas por dia: novembro da Exposição soma a meta do mês da planilha (23 dias × 17.878,30)', () => {
  perto(metaDoPeriodo(['Exposicao'], '2026-11-01', '2026-11-30', null, metaDia, semUltima).meta, 411200.9, 0.01);
});

test('meta do período é a soma das metas dos dias do período (a 1ª semana tem 5 dias com meta: 02/11 não tem)', () => {
  perto(metaDoPeriodo(['Exposicao'], '2026-11-01', '2026-11-07', null, metaDia, semUltima).meta, 17878.3 * 5, 0.01);
});

test('meta do período com filtro de dia da semana: só os sábados', () => {
  perto(metaDoPeriodo(['Exposicao'], '2026-11-01', '2026-11-30', [6], metaDia, semUltima).meta, 17878.3 * 4, 0.01);   // 4 sábados
});

test('ritmo: o esperado soma as metas dos dias até o último dia com dado (feriado sem meta não pesa)', () => {
  const r = metaDoPeriodo(['Exposicao'], '2026-11-01', '2026-11-30', null, metaDia, op => op === 'Exposicao' ? '2026-11-04' : null);
  perto(r.esperado, 17878.3 * 2, 0.01);   // 03 e 04/11 (02/11 não tem meta)
  perto(r.linhaDia['2026-11-04'], 17878.3, 0.01);
  perto(r.linhaDia['2026-11-30'], 17878.3, 0.01, 'a linha de meta do gráfico vai até o fim do período');
});

test('dia com meta diferente (ex.: Black Friday) entra com o valor dele', () => {
  const md = (op, s) => s === '2026-11-27' ? 60000 : metaDia(op, s);
  perto(metaDoPeriodo(['Exposicao'], '2026-11-27', '2026-11-28', null, md, semUltima).meta, 60000 + 17878.3, 0.01);
});

test('operação sem meta lançada: a meta do período é só das que têm, e a tela avisa quais faltam', () => {
  const r = metaDoPeriodo(['Exposicao', 'GIP'], '2026-11-01', '2026-11-30', null, metaDia, semUltima);
  perto(r.meta, 411200.9, 0.01);
  assert.deepStrictEqual(j(r.semMeta), ['GIP']);
  assert.strictEqual(metaDoPeriodo(['GIP'], '2026-11-01', '2026-11-30', null, metaDia, semUltima).meta, null);
});

test('distribuir a meta do mês: divide igual entre os dias escolhidos, sem perder centavo', () => {
  const distribuirMeta = extrairFuncao(codigo, 'distribuirMeta', {});
  const d = j(distribuirMeta(100, ['2026-11-03', '2026-11-04', '2026-11-05']));
  assert.deepStrictEqual(d, { '2026-11-03': 33.34, '2026-11-04': 33.33, '2026-11-05': 33.33 });
  assert.deepStrictEqual(j(distribuirMeta(100, [])), {});
});

test('dias em que a loja abre (base do distribuir): lojas de segunda a sábado, e-commerce todos', () => {
  const diasAbertos = extrairFuncao(codigo, 'diasAbertos', { iso });
  assert.strictEqual(diasAbertos(2026, 11, true).length, 25);
  assert.strictEqual(diasAbertos(2026, 11, false).length, 30);
  assert.ok(!diasAbertos(2026, 11, true).includes('2026-11-01'), '01/11/2026 é domingo');
});

test('projeção do mês com meta: o ritmo até hoje aplicado à meta do mês inteiro', () => {
  const projecaoOp = extrairFuncao(codigo, 'projecaoOp', {});
  perto(projecaoOp(351513.33, 196661.3, 411200.9, null), 351513.33 / 196661.3 * 411200.9, 0.01);
  perto(projecaoOp(1000, null, null, { media: 100, dias: 30 }), 3000, 0.01, 'sem meta: média diária × dias');
});

test('várias operações: cada dia vira uma linha só, somando as operações', () => {
  const d = porDia(expo.concat([{ operacao: 'ViaCloset', data: '2026-11-03', faturamento: 10577.48, margem: 5215.84, ticket_medio: 157.87, pecas_atendimento: 2.03, qtd_vendas: 67 }]));
  assert.strictEqual(d.length, 2);
  perto(d[0].faturamento, 27933.69 + 10577.48);
  assert.strictEqual(d[0].qtd_vendas, 216);
  perto(d[0].ticket_medio, (27933.69 + 10577.48) / 216);
});

test('quadro por dia da semana: média por dia, em ordem de segunda a domingo', () => {
  const s = porDiaDaSemana([
    { data: '2026-11-07', faturamento: 100, margem: 40, ticket_medio: 10, qtd_vendas: 10 },  // sábado
    { data: '2026-11-14', faturamento: 300, margem: 120, ticket_medio: 15, qtd_vendas: 20 }, // sábado
    { data: '2026-11-03', faturamento: 50, margem: 20, ticket_medio: 5, qtd_vendas: 10 },    // terça
  ]);
  assert.deepStrictEqual(s.map(x => x.wd), [2, 6]);
  assert.strictEqual(s[1].dias, 2);
  assert.strictEqual(s[1].fatMedio, 200);
  perto(s[1].ticket, 400 / 30);
});

test('tela: filtros de operações, período, dia da semana e comparação; meta em quadro próprio', () => {
  const html = ler('bi.html');
  for (const id of ['sel-ops', 'sel-per', 'dt-de', 'dt-ate', 'sel-dias', 'sel-cmp', 'mt-op', 'mt-mes', 'tb-sem']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(codigo, /if \(tem && F\.ops\.length === 1\) return;/, 'a última operação não pode sair');
  assert.match(codigo, /from\('bi_meta_diaria'\)\.upsert\(ups, \{ onConflict: 'operacao,data' \}\)/);
  assert.doesNotMatch(codigo, /bi_meta_mensal/, 'a meta mensal virou a soma das metas diárias');
  assert.ok(codigo.includes('const podeMeta = () => !!(prof.is_admin || prof.can_orcamento);'), 'só admin ou quem tem Budget lança meta');
});

test('atingimento com operação SEM meta: o faturamento dela não entra na conta contra a meta das outras', () => {
  const fatComMeta = extrairFuncao(codigo, 'fatComMeta', {});
  const ls = expo.concat([{ operacao: 'GIP', data: '2026-11-03', faturamento: 39897.89 }]);
  const r = metaDoPeriodo(['Exposicao', 'GIP'], '2026-11-01', '2026-11-30', null, metaDia, semUltima);
  assert.ok(r.comMeta.has('Exposicao|2026-11') && !r.comMeta.has('GIP|2026-11'));
  perto(fatComMeta(ls, r.comMeta), 47307.78, 0.01);   // só a Exposição; os R$ 39.897,89 do e-commerce ficam fora
});

test('cartões com nomes específicos: a meta atingida tem cartão próprio, em destaque (não some no rodapé do faturamento)', () => {
  for (const nome of ['Faturamento no período', 'Meta atingida', 'Ritmo até hoje', 'Projeção para o fim do mês', 'Margem de contribuição', 'Ticket médio', 'Vendas no período'])
    assert.ok(codigo.includes("l: '" + nome + "'"), 'falta o cartão "' + nome + '"');
  assert.doesNotMatch(codigo, /l: 'Ritmo × meta'/, 'nome antigo, que confundia com o atingimento');
  assert.ok(codigo.includes("'<div class=\"kpi' + (x.d ? ' destaque' : '')"), 'a linha de cima (faturamento, meta, ritmo, projeção) é destacada');
});

test('semanas do mês (segunda a domingo, só os dias do mês) — base do "Distribuir" semanal', () => {
  const semanasDoMes = extrairFuncao(codigo, 'semanasDoMes', { iso });
  const s = j(semanasDoMes(2026, 11));
  assert.strictEqual(s.length, 6);
  assert.deepStrictEqual(s[0], ['2026-11-01'], '01/11/2026 é domingo: a 1ª semana do mês tem um dia só');
  assert.deepStrictEqual(s[1], ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepStrictEqual(s[5], ['2026-11-30']);
});

test('distribuir uma semana: divide entre os dias em que a loja abre naquela semana e não mexe nas outras', () => {
  const distribuirMeta = extrairFuncao(codigo, 'distribuirMeta', {});
  const semanasDoMes = extrairFuncao(codigo, 'semanasDoMes', { iso });
  const diasAbertos = extrairFuncao(codigo, 'diasAbertos', { iso });
  const abertos = new Set(diasAbertos(2026, 11, true));
  const semana = semanasDoMes(2026, 11)[4].filter(d => abertos.has(d));   // 23 a 28/11 (sem o domingo 29)
  assert.strictEqual(semana.length, 6);
  const d = distribuirMeta(120000, semana);
  assert.strictEqual(d['2026-11-27'], 20000);
  assert.strictEqual(d['2026-11-29'], undefined);
  assert.match(codigo, /data-semana=/, 'cada linha do calendário tem o campo da semana');
});
