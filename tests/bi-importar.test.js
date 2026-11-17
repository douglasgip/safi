'use strict';
// bi-importar: porta de entrada do realizado do BI (automação em Python no PC do Douglas → SAFI).
const test = require('node:test');
const assert = require('node:assert');
const { ler, carregarEdge } = require('./helpers/carregar');

const { pegar } = carregarEdge('bi-importar');
const validarLinha = pegar('validarLinha');
const prepararLote = pegar('prepararLote');
const normalizarOperacao = pegar('normalizarOperacao');
const tokensIguais = pegar('tokensIguais');
const j = x => JSON.parse(JSON.stringify(x));
const HOJE = '2026-11-17';
const ok = { operacao: 'Exposicao', data: '2026-11-16', faturamento: 24330.78, margem: 11213.7, ticket_medio: 190.08, pecas_atendimento: 4.04, qtd_vendas: 128 };

test('linha completa vira o registro do dia, marcado como vindo da automação', () => {
  const r = j(validarLinha(ok, HOJE));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.linha, { operacao: 'Exposicao', data: '2026-11-16', fonte: 'automacao', faturamento: 24330.78, margem: 11213.7, ticket_medio: 190.08, pecas_atendimento: 4.04, qtd_vendas: 128 });
});

test('operação: aceita o código e os nomes usuais; "EP" não (no DRE, EP é parte do GIP)', () => {
  assert.strictEqual(normalizarOperacao('Exposição Paulista'), 'Exposicao');
  assert.strictEqual(normalizarOperacao(' via  closet '), 'ViaCloset');
  assert.strictEqual(normalizarOperacao('E-commerce'), 'GIP');
  assert.strictEqual(normalizarOperacao('GIP'), 'GIP');
  assert.strictEqual(normalizarOperacao('EP'), null);
  assert.strictEqual(j(validarLinha({ ...ok, operacao: 'Loja X' }, HOJE)).ok, false);
});

test('data: precisa ser aaaa-mm-dd válida e não pode estar no futuro', () => {
  assert.match(j(validarLinha({ ...ok, data: '16/11/2026' }, HOJE)).motivo, /data inválida/);
  assert.match(j(validarLinha({ ...ok, data: '2026-02-30' }, HOJE)).motivo, /data inválida/);
  assert.match(j(validarLinha({ ...ok, data: '2026-11-18' }, HOJE)).motivo, /futuro/);
  assert.strictEqual(j(validarLinha({ ...ok, data: HOJE }, HOJE)).ok, true, 'o próprio dia pode (parcial do dia)');
});

test('números: faturamento obrigatório; campos opcionais podem faltar; texto que não é número dá erro', () => {
  assert.match(j(validarLinha({ ...ok, faturamento: null }, HOJE)).motivo, /faturamento é obrigatório/);
  const sem = j(validarLinha({ operacao: 'GIP', data: '2026-11-16', faturamento: 83771.57 }, HOJE));
  assert.strictEqual(sem.ok, true);
  assert.strictEqual(sem.linha.pecas_atendimento, null, 'e-commerce não tem peças por atendimento');
  assert.strictEqual(j(validarLinha({ ...ok, faturamento: '24330.78' }, HOJE)).linha.faturamento, 24330.78, 'número em texto com ponto decimal');
  assert.match(j(validarLinha({ ...ok, ticket_medio: '190,08' }, HOJE)).motivo, /ticket_medio não é número/, 'vírgula decimal não: o script manda número');
  assert.match(j(validarLinha({ ...ok, qtd_vendas: -3 }, HOJE)).motivo, /negativo/);
  assert.strictEqual(j(validarLinha({ ...ok, margem: -50 }, HOJE)).ok, true, 'margem negativa existe (dia de liquidação)');
});

test('lote: linhas com erro não impedem as boas; o mesmo dia repetido vale a última', () => {
  const r = j(prepararLote([ok, { ...ok, operacao: 'X' }, { ...ok, faturamento: 30000 }], HOJE));
  assert.strictEqual(r.boas.length, 1);
  assert.strictEqual(r.boas[0].faturamento, 30000);
  assert.deepStrictEqual(r.erros.map(e => e.linha), [2]);
});

test('token comparado sem vazar pelo tempo e sem aceitar vazio', () => {
  assert.strictEqual(tokensIguais('abc', 'abc'), true);
  assert.strictEqual(tokensIguais('abc', 'abd'), false);
  assert.strictEqual(tokensIguais('', ''), false);
});

test('a função grava com upsert por operação+dia (reenviar substitui) e registra cada importação', () => {
  const fonte = ler('_ds/bi-importar_index.ts');
  assert.match(fonte, /from\('bi_kpi_diario'\)\.upsert\(.*\{ onConflict: 'operacao,data' \}\)/);
  assert.match(fonte, /from\('bi_importacoes'\)\.insert\(/);
  assert.match(fonte, /Deno\.env\.get\('BI_IMPORT_TOKEN'\)/);
});
