'use strict';
// Painel do Conselho: as contas de EBITDA / Resultado. Regressão contra mexer na fórmula sem querer.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('conselho.html')).map(s => s.codigo).join('\n');
const snap = extrairFuncao(codigo, 'snap', {});

const mes = { rb: 1000, ded: 100, cv: 200, go: 300, df: 0, ir: 0, cmv: 150, pessoal: 80 };

test('conselho: sem despesa financeira nem IR, EBITDA == Resultado Líquido', () => {
  const s = snap(mes);
  assert.strictEqual(s.rl, 900);
  assert.strictEqual(s.mc, 700);
  assert.strictEqual(s.ebitda, 400);
  assert.strictEqual(s.res, 400);
});

test('conselho: despesas financeiras e IR reduzem o Resultado mas não o EBITDA', () => {
  const s = snap({ ...mes, go: 300, df: 40, ir: 10 });
  assert.strictEqual(s.ebitda, 450); // 700 - (300 - 40 - 10)
  assert.strictEqual(s.res, 400);    // 450 - 40 - 10
});

test('conselho: percentuais ficam nulos quando não há faturamento', () => {
  const s = snap({ ...mes, rb: 0 });
  assert.strictEqual(s.ebitdaPct, null);
  assert.strictEqual(s.mcPct, null);
});

test('conselho: margem bruta desconta o CMV da receita líquida', () => {
  assert.strictEqual(snap(mes).mb, 750);
});

test('conselho: avisa quando EBITDA == Resultado por falta de despesa financeira e IR', () => {
  const aviso = extrairFuncao(codigo, 'avisoEbitdaIgual', {});
  assert.match(aviso(snap(mes)), /EBITDA igual ao Resultado/);
  assert.strictEqual(aviso(snap({ ...mes, df: 40 })), null);
  assert.strictEqual(aviso(snap({ ...mes, ir: 10 })), null);
  assert.strictEqual(aviso(null), null);
});

test('conselho: o aviso entra na faixa de avisos da tela', () => {
  assert.match(codigo, /avisoEbitdaIgual\(cur\)[^\n]*msgs\.push/);
});

// ── Bloco "Metas e Orçamento" — EXCLUÍDO em 26/11/2026 (pedido do Douglas: não faz mais sentido nesta tela) ──
test('Painel do Conselho: o quadro Metas e Orçamento saiu (tela, render, PDF, ajuda); o Budget e o "× Meta" do Faturamento ficam', () => {
  const html = ler('conselho.html');
  assert.doesNotMatch(html, /id="panel-mo"|mo-metas|mo-gastos|\.mo-grid/);
  for (const nome of ['renderMetasOrc', 'dadosMetasOrc', 'resumoMetas', 'resumoCompras', 'moBarra', 'orcCompras']) assert.ok(!codigo.includes(nome), nome + ' ainda está na tela');
  assert.doesNotMatch(codigo, /from\('orcamento_mensal'\)/, 'o Painel não lê mais as compras do Budget');
  assert.doesNotMatch(codigo, /metasorc/, 'opção do PDF saiu');
  assert.match(codigo, /id: 'rb', l: 'Faturamento'[^\n]*orc: 'rb', rotOrc: 'Meta'/, 'o × Meta do Faturamento continua');
  const ajuda = ler('ajuda-conteudo.js');
  assert.doesNotMatch(ajuda, /#panel-mo|Acompanhe metas e orçamento/);
  assert.match(ler('orcamento.html'), /from\('orcamento_mensal'\)/, 'a tela Budget continua com os dados');
});
