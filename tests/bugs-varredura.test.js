'use strict';
// Bugs da varredura geral (lista de 2026-09-25), corrigidos em 2026-10-23.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao, carregarEdge } = require('./helpers/carregar');
const cod = arq => scriptsDaPagina(ler(arq)).map(s => s.codigo).join('\n');

test('Calculadora de Importação: sem peso em nenhum produto, o frete é rateado pelo valor (não some)', () => {
  const fatiaFrete = extrairFuncao(cod('calculadora-importacao.html'), 'fatiaFrete', {});
  assert.strictEqual(fatiaFrete(0, 0, 0.4), 0.4, 'peso total zero -> usa a fatia do valor');
  assert.strictEqual(fatiaFrete(30, 120, 0.4), 0.25, 'com peso, continua rateando pelo peso');
  // os pedaços somam 100% do frete
  const produtos = [{ p: 0, v: 0.7 }, { p: 0, v: 0.3 }];
  assert.ok(Math.abs(produtos.reduce((a, x) => a + fatiaFrete(x.p, 0, x.v), 0) - 1) < 1e-9);
});

test('GerônIA: escapeHtml escapa aspas (texto da IA não quebra atributos HTML)', () => {
  const escapeHtml = extrairFuncao(cod('geronia.html'), 'escapeHtml', {});
  assert.strictEqual(escapeHtml('a "b" <c> & \'d\''), 'a &quot;b&quot; &lt;c&gt; &amp; &#39;d&#39;');
});

test('GerônIA e resumo do PDF: a chamada à IA tem tempo limite (não fica "pensando" para sempre)', () => {
  const g = cod('geronia.html');
  assert.match(g, /new AbortController\(\)/);
  assert.match(g, /signal: ctrl\.signal/);
  assert.match(g, /demorou demais/);
  const p = ler('pdf.js');
  assert.match(p, /new AbortController\(\)/);
  assert.match(p, /signal: ctrl\.signal/);
});

test('Mapa Societário: empresa sem nome fantasia nem razão social não derruba a tela', () => {
  const nomeEmpresa = extrairFuncao(cod('mapa-societario.html'), 'nomeEmpresa', {});
  assert.strictEqual(nomeEmpresa({}), 'Empresa sem nome');
  assert.strictEqual(nomeEmpresa({ nome_empresarial: 'Isabela S Navarrete Confecções' }), 'Isabela S Navarrete Confecções');
  assert.strictEqual(nomeEmpresa({ nome_fantasia: 'Isa Confecções', nome_empresarial: 'X' }), 'Isa Confecções');
  assert.strictEqual(nomeEmpresa({ nome_fantasia: '   ' , nome_empresarial: 'X' }), 'X');
});

test('admin-update-user: não deixa trocar o e-mail da conta do admin (travaria o login para sempre)', () => {
  const { pegar } = carregarEdge('admin-update-user', { Date });
  const bloqueia = pegar('trocaEmailDoAdminBloqueada');
  assert.strictEqual(bloqueia({ id: 'adm', email: 'douglasgip24@gmail.com' }, 'adm', 'outro@x.com'), true);
  assert.strictEqual(bloqueia({ id: 'adm', email: 'douglasgip24@gmail.com' }, 'adm', 'douglasgip24@gmail.com'), false);
  assert.strictEqual(bloqueia({ id: 'adm', email: 'douglasgip24@gmail.com' }, 'adm', undefined), false);
  assert.strictEqual(bloqueia({ id: 'adm', email: 'douglasgip24@gmail.com' }, 'outro', 'novo@x.com'), false);
});

test('admin-update-user: usuário inexistente devolve erro em vez de "sucesso" sem alterar nada', () => {
  const fonte = ler('_ds/admin-update-user_index.ts');
  assert.match(fonte, /if \(!before\)\s*\n?\s*return new Response\(JSON\.stringify\(\{ error: 'Usuário não encontrado' \}\), \{ status: 404/);
});
