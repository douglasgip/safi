'use strict';
// Telas TEMPORÁRIAS (apresentação do Aldemar): só mostram dados fixos copiados das planilhas/documentos.
// Não podem ler nem gravar nada no banco além de conferir o login, e não ficam ligadas na Home nem na ajuda.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { ler, scriptsDaPagina } = require('./helpers/carregar');

// (o Fluxo Financeiro (OTB) virou tela de verdade em 25/11/2026: otb.html, testada em otb.test.js)
const TELAS = { 'temp-fluxo-pedidos.html': 'tmp_pedidos', 'temp-templates.html': 'tmp_templates' };
const codigoDe = arq => scriptsDaPagina(ler(arq)).filter(s => !s.src).map(s => s.codigo).join('\n');

test('telas temporárias: só conferem o login (user_profiles) — nenhuma outra leitura ou gravação', () => {
  for (const arq of Object.keys(TELAS)) {
    const c = codigoDe(arq);
    const froms = [...c.matchAll(/sb\.from\('([^']+)'\)/g)].map(m => m[1]);
    assert.deepStrictEqual(froms, ['user_profiles'], arq);
    assert.doesNotMatch(c, /\.rpc\(|\.insert\(|\.upsert\(|\.update\(|\.delete\(|functions\.invoke|fetch\(/, arq);
  }
});

test('telas temporárias: setor "Temporária" no menu, sem card na Home nem texto de ajuda', () => {
  const sidebar = ler('sidebar.js'), home = ler('index.html'), ajuda = ler('ajuda-conteudo.js');
  assert.match(sidebar, /\{ id: 'temporaria', label: 'Temporária', items: \['tmp_pedidos', 'tmp_templates'\] \}/);
  for (const [arq, key] of Object.entries(TELAS)) {
    assert.match(sidebar, new RegExp(key + ": \\{[^\\n]*temp: true"), key + ' sem marca temp');
    assert.ok(!home.includes('card-' + key), 'Home não deve ter card de ' + key);
    assert.ok(!new RegExp('\\b' + key + '\\s*:').test(ajuda), 'ajuda não deve ter ' + key);
    assert.match(ler(arq), /Temporária · só apresentação/);
  }
});

test('Fluxo Pedido Compras: totais calculados batem com a planilha (pedidos 228.438,96; saldo 226.093,85)', () => {
  const c = codigoDe('temp-fluxo-pedidos.html');
  const ini = c.indexOf('const MESES'), fim = c.indexOf('function render');
  const ctx = vm.createContext({});
  vm.runInContext(c.slice(ini, fim) + '\nglobalThis.r = { tP: totalDe(PED), tN: totalDe(NFS), mP: porMes(PED) };', ctx);
  assert.strictEqual(ctx.r.tP.toFixed(2), '228438.96');
  assert.strictEqual((ctx.r.tP - ctx.r.tN).toFixed(2), '226093.85');
  // vencimentos da planilha: NOV 7.594,68 · DEZ 107.237,51 · JAN 57.081,37 · FEV 41.837,23 · MAR 10.893,41 · ABR/MAI/JUN 1.228,66
  assert.deepStrictEqual(Array.from(ctx.r.mP, v => v.toFixed(2)), ['7594.68', '107237.51', '57081.37', '41837.23', '10893.41', '1228.66', '1228.66', '1228.66']);
});
