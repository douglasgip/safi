'use strict';
// Funções puras das edge functions (rodam fora do Deno: só a parte antes do Deno.serve).
const test = require('node:test');
const assert = require('node:assert');
const { ler, carregarEdge } = require('./helpers/carregar');

test('backup: nome de aba respeita 31 caracteres e desempata nomes iguais', () => {
  const { pegar } = carregarEdge('backup-mensal');
  const nomeAba = pegar('nomeAba');
  const usados = new Set();
  const longo = 'tabela_com_um_nome_muito_mas_muito_comprido_mesmo';
  const a = nomeAba(longo, usados);
  const b = nomeAba(longo, usados);
  assert.ok(a.length <= 31 && b.length <= 31);
  assert.notStrictEqual(a, b);
  assert.strictEqual(nomeAba('a/b?c', new Set()), 'a_b_c');
});

test('backup: objetos viram JSON e nulos viram célula vazia', () => {
  const { pegar } = carregarEdge('backup-mensal');
  const out = pegar('achatarLinha')({ a: null, b: { x: 1 }, c: 5, d: undefined });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(out)), { a: '', b: '{"x":1}', c: 5, d: '' });
});

test('backup: base64 de arquivo grande (mais de um bloco) bate com o do Node', () => {
  const { pegar } = carregarEdge('backup-mensal', { btoa });
  const buf = new Uint8Array(30000).map((_, i) => i % 251);
  assert.strictEqual(pegar('bufferParaBase64')(buf), Buffer.from(buf).toString('base64'));
});

test('admin-update-user: só devolve origens do SAFI e limita edições em massa', () => {
  const { pegar } = carregarEdge('admin-update-user', { Date });
  const cors = pegar('corsFor');
  const req = origem => ({ headers: { get: () => origem } });
  assert.strictEqual(cors(req('https://painel.topfinds.com.br'))['Access-Control-Allow-Origin'], 'https://painel.topfinds.com.br');
  assert.strictEqual(cors(req('https://site-malicioso.com'))['Access-Control-Allow-Origin'], 'https://painel.topfinds.com.br');
  const limitado = pegar('rateLimited');
  let barrado = false;
  for (let i = 0; i < 31; i++) barrado = limitado('u1');
  assert.strictEqual(barrado, true);
  assert.strictEqual(limitado('u2'), false);
});

test('admin-update-user: remover autenticador só na virada Sim -> Não', () => {
  const fonte = ler('_ds/admin-update-user_index.ts');
  assert.match(fonte, /mfa_obrigatorio === false && before\?\.mfa_obrigatorio === true/);
  assert.match(fonte, /mfa\.deleteFactor/);
});
