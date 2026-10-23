'use strict';
// Reuniões e Decisões: exportar a reunião em PDF escolhendo o que entra (padrão: só Título e Ata).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const html = ler('reunioes.html');
const codigo = scriptsDaPagina(html).map(s => s.codigo).join('\n');
const blocosReuniao = extrairFuncao(codigo, 'blocosReuniao', {});
const TIPO = { conselho: 'Conselho' };
const fmt = s => s.split('-').reverse().join('/');
const reuniao = { titulo: 'Conselho — agosto', data: '2026-09-10', tipo: 'conselho', participantes: 'Fabiano, Aldemar', pauta: 'Resultado de agosto', ata: 'Decidido reduzir estoque parado.' };

test('caixas do PDF: as seis opções, com só Título e Ata marcados por padrão', () => {
  const m = /const PDF_REUNIAO_OPCOES = (\[[\s\S]*?\]);/.exec(codigo);
  assert.ok(m);
  const ops = JSON.parse(JSON.stringify(vm.runInNewContext(m[1])));
  assert.deepStrictEqual(ops.map(o => o.id), ['titulo', 'data', 'tipo', 'participantes', 'pauta', 'ata']);
  assert.deepStrictEqual(ops.filter(o => o.padrao).map(o => o.id), ['titulo', 'ata']);
  assert.strictEqual(ops.find(o => o.id === 'ata').label, 'Ata / resumo do que foi tratado');
});

test('padrão (Título + Ata): o PDF traz só o título e a ata', () => {
  const b = blocosReuniao(reuniao, { titulo: true, ata: true }, TIPO, fmt);
  assert.strictEqual(b.length, 2);
  assert.strictEqual(b[0].titulo, 'Conselho — agosto');
  assert.strictEqual(b[1].texto, 'Decidido reduzir estoque parado.');
  assert.ok(!JSON.stringify(b).includes('Fabiano'), 'participantes não podem vazar');
  assert.ok(!JSON.stringify(b).includes('Resultado de agosto'), 'pauta não pode vazar');
});

test('tudo marcado: data, tipo e participantes viram uma tabela; pauta e ata viram texto', () => {
  const b = blocosReuniao(reuniao, { titulo: true, data: true, tipo: true, participantes: true, pauta: true, ata: true }, TIPO, fmt);
  const tab = JSON.parse(JSON.stringify(b.find(x => x.tipo === 'tabela')));
  assert.deepStrictEqual(tab.linhas.map(l => l.c), [['Data', '10/09/2026'], ['Tipo', 'Conselho'], ['Participantes', 'Fabiano, Aldemar']]);
  assert.ok(b.some(x => x.titulo === 'Pauta'));
});

test('sem o título marcado, o título não aparece nem no cabeçalho do PDF', () => {
  const b = blocosReuniao(reuniao, { ata: true }, TIPO, fmt);
  assert.ok(!JSON.stringify(b).includes('Conselho — agosto'));
  assert.match(codigo, /blocosReuniao\(r, sel\.opcoes, TIPO_LABEL, fmtD\), subtitulo: ''/, 'o título só entra pelo bloco, nunca pelo cabeçalho');
});

test('botão Exportar PDF fica dentro da reunião aberta e usa o PDF padrão do SAFI (sem botão no topo)', () => {
  assert.match(html, /id="reu-pdf"[^>]*>Exportar PDF</);
  assert.match(html, /<script src="\/pdf\.js"><\/script>/);
  assert.match(codigo, /semBotao: true/);
  const pdf = ler('pdf.js');
  assert.match(pdf, /if \(!cfg\.semBotao\) colocarBotao\(\)/);
  assert.match(pdf, /abrir: function \(\) \{ abrirJanela\(\); \}/);
});
