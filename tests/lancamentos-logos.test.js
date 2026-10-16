'use strict';
// Lançamentos: dropdowns de empresa com logo (Lançar Valores e Resumo Contábil).
// Combinado com o Douglas: EP e Guilherme (GIP) = logo da GIP; Isa = Exposição; Juliane = Via Closet.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { ler, caminho, scriptsDaPagina } = require('./helpers/carregar');

const html = ler('lancamentos.html');
const codigo = scriptsDaPagina(html).map(s => s.codigo).join('\n');

function mapaDeLogos() {
  const m = /const EMPRESA_LOGOS = (\{[\s\S]*?\});/.exec(codigo);
  assert.ok(m, 'EMPRESA_LOGOS não encontrado');
  return vm.runInNewContext('(' + m[1] + ')');
}

test('logos: cada empresa usa a logo combinada', () => {
  const L = mapaDeLogos();
  assert.strictEqual(L.EP, '/public/gipecommerce_logo.png');
  assert.strictEqual(L.GIP, '/public/gipecommerce_logo.png');
  assert.strictEqual(L.Exposicao, '/public/exposicaopaulista_logo.png');
  assert.strictEqual(L.ViaCloset, '/public/viacloset_logo.png');
});

test('logos: todos os arquivos existem', () => {
  for (const [id, url] of Object.entries(mapaDeLogos())) {
    assert.ok(fs.existsSync(caminho(url.replace(/^\//, ''))), id + ': ' + url + ' não existe');
  }
});

test('logos: toda empresa de Lançamentos (menos RP, sem logo) tem logo', () => {
  const L = mapaDeLogos();
  const ids = [...codigo.matchAll(/\{ ?id: ?'(\w+)'/g)].map(m => m[1]).filter(id => id !== 'RP');
  assert.ok(ids.length >= 4);
  for (const id of ids) assert.ok(L[id], id + ' sem logo');
});

test('logos: os dois dropdowns de empresa são trocados, mantendo o <select> nativo', () => {
  for (const id of ['f-empresa', 'rs-empresa']) {
    assert.match(html, new RegExp('<select id="' + id + '"'), id + ' deixou de ser <select>');
    assert.match(codigo, new RegExp("attachLogoSelect\\(document\\.getElementById\\('" + id + "'\\)\\)|attachLogoSelect\\(sel\\)"));
  }
  // O contrato com o resto do código: select escondido, não removido; .value continua funcionando.
  assert.match(codigo, /sel\.style\.display = 'none'/);
  assert.match(codigo, /sel\.dispatchEvent\(new Event\('change'\)\)/);
  assert.match(codigo, /Object\.defineProperty\(sel, 'value'/);
});
