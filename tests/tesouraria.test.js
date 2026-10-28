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

// ── Caixa (modelo novo de 2026-10-28, pedido do Guilherme) ───────────────────
const dividirRateio = extrairFuncao(codigo, 'dividirRateio', {});
const j = x => JSON.parse(JSON.stringify(x));

test('caixa: valor enviado dividido igualmente entre as lojas marcadas', () => {
  assert.deepStrictEqual(j(dividirRateio(3000, ['Exposicao', 'ViaCloset'])), { Exposicao: 1500, ViaCloset: 1500 });
  assert.deepStrictEqual(j(dividirRateio(900, ['GIP'])), { GIP: 900 });
  assert.deepStrictEqual(j(dividirRateio(1000, [])), {});
});

test('caixa: divisão em 3 não perde centavo (a sobra fica com a primeira loja)', () => {
  const d = j(dividirRateio(100, ['Exposicao', 'ViaCloset', 'GIP']));
  assert.deepStrictEqual(d, { Exposicao: 33.34, ViaCloset: 33.33, GIP: 33.33 });
  assert.strictEqual(Math.round((d.Exposicao + d.ViaCloset + d.GIP) * 100), 10000);
});

test('caixa: saldo final = valor enviado − gastos; gastos somados por categoria', () => {
  const ctx = {};
  const vm = require('node:vm');
  const m = /const totalGastos = [\s\S]*?\n    function gastosPorCategoria[\s\S]*?\n    }\n/.exec(codigo);
  assert.ok(m, 'funções do caixa não encontradas');
  vm.createContext(ctx);
  vm.runInContext(m[0] + 'globalThis.f = { totalGastos, saldoFinal, gastosPorCategoria };', ctx);
  const gastos = [{ valor: 350, categoria: 'hospedagem', forma: 'pix' }, { valor: 80.5, categoria: 'refeicao', forma: 'dinheiro' }, { valor: 45.25, categoria: 'refeicao', forma: 'pix' }];
  assert.strictEqual(ctx.f.totalGastos(gastos), 475.75);
  assert.strictEqual(ctx.f.saldoFinal(2000, gastos), 1524.25);
  assert.strictEqual(ctx.f.saldoFinal(400, gastos), -75.75, 'gastou mais do que recebeu: saldo negativo');
  assert.deepStrictEqual(j(ctx.f.gastosPorCategoria(gastos)), { hospedagem: 350, refeicao: 125.75 });
});

test('caixa: formulário tem Saque/Sangria, lojas do rateio, gastos com categoria e Dinheiro/Pix', () => {
  const html = ler('tesouraria.html');
  assert.match(html, /data-tipo="saque"[^>]*>Saque</);
  assert.match(html, /data-tipo="sangria">Sangria</);
  assert.match(html, /id="ts-lojas"/);
  assert.match(html, /id="ts-add-gasto"/);
  assert.match(codigo, /\['viagem', 'Viagem'\], \['hospedagem', 'Hospedagem'\], \['refeicao', 'Refeição'\], \['locomocao', 'Locomoção'\], \['outros', 'Outros'\]/);
  assert.match(codigo, /data-forma="dinheiro"/);
  assert.match(codigo, /data-forma="pix"/);
  assert.doesNotMatch(html, /id="ts-entrada"|id="ts-rat-exp"/, 'campos do modelo antigo saíram');
  assert.match(codigo, /attachAutocomplete\(g\('ts-portador'\), \(\) => distintosPortadores\(\)\)/, 'portador se alimenta dos nomes já usados');
});
