'use strict';
// As telas TEMPORÁRIAS de apresentação do Aldemar foram retiradas em 25/11/2026
// (o Fluxo Financeiro (OTB) virou tela de verdade: otb.html; Fluxo Pedido Compras e Templates foram excluídas).
// Este teste garante que não sobrou nada delas no menu, nas rotas nem nos arquivos.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { ler, caminho } = require('./helpers/carregar');

test('telas temporárias excluídas: sem arquivo, sem item/setor no menu e sem rota', () => {
  for (const arq of ['temp-fluxo-financeiro.html', 'temp-fluxo-pedidos.html', 'temp-templates.html']) {
    assert.ok(!fs.existsSync(caminho(arq)), arq + ' ainda existe');
  }
  const sidebar = ler('sidebar.js'), vercel = ler('vercel.json');
  assert.doesNotMatch(sidebar, /tmp_|temporaria|Temporária|temp: true/);
  assert.doesNotMatch(vercel, /\/temp-/);
});
