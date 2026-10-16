'use strict';
// Tesouraria > aba Cheques.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('tesouraria.html')).map(s => s.codigo).join('\n');
const statusCheque = extrairFuncao(codigo, 'statusCheque', {});
const proximoNumero = extrairFuncao(codigo, 'proximoNumero', {});

test('cheque compensado fica "ok" mesmo com data passada', () => {
  assert.strictEqual(statusCheque({ compensado: true, compensacao: '2020-01-01' }, '2026-10-16'), 'ok');
});

test('cheque não compensado com data passada é "venc"', () => {
  assert.strictEqual(statusCheque({ compensado: false, compensacao: '2026-10-15' }, '2026-10-16'), 'venc');
});

test('cheque que compensa hoje ou depois está "aberto"; sem data também', () => {
  assert.strictEqual(statusCheque({ compensado: false, compensacao: '2026-10-16' }, '2026-10-16'), 'aberto');
  assert.strictEqual(statusCheque({ compensado: false, compensacao: '2026-11-01' }, '2026-10-16'), 'aberto');
  assert.strictEqual(statusCheque({ compensado: false, compensacao: null }, '2026-10-16'), 'aberto');
});

test('próximo número de cheque mantém zeros à esquerda', () => {
  assert.strictEqual(proximoNumero('000123'), '000124');
  assert.strictEqual(proximoNumero('999'), '1000');
  assert.strictEqual(proximoNumero('AB12'), 'AB12');
});
