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

// Funções do caixa (somaGastos … gastosPorCategoria) num contexto isolado.
function funcoesCaixa() {
  const vm = require('node:vm');
  const m = /const somaGastos = [\s\S]*?\n    function gastosPorCategoria[\s\S]*?\n    }\n/.exec(codigo);
  assert.ok(m, 'funções do caixa não encontradas');
  const ctx = vm.createContext({ NOME_CAT: { viagem: 'Viagem', hospedagem: 'Hospedagem', refeicao: 'Refeição', locomocao: 'Locomoção', outros: 'Outros' } });
  vm.runInContext(m[0] + 'globalThis.f = { totalGastos, totalPix, totalDinheiro, saldoFinal, gastosPorCategoria, nomeCategoria };', ctx);
  return ctx.f;
}

test('caixa: saldo final = valor enviado − gastos em DINHEIRO (Pix não desconta — pedido do Guilherme)', () => {
  const f = funcoesCaixa();
  const gastos = [{ valor: 350, categoria: 'Hospedagem', forma: 'pix' }, { valor: 80.5, categoria: 'Refeição', forma: 'dinheiro' }, { valor: 45.25, categoria: 'Refeição', forma: 'pix' }];
  assert.strictEqual(f.totalGastos(gastos), 475.75, 'o total de gastos continua somando tudo');
  assert.strictEqual(f.totalPix(gastos), 395.25);
  assert.strictEqual(f.saldoFinal(2000, gastos), 1919.5, 'só os R$ 80,50 em dinheiro descontam');
  assert.strictEqual(f.saldoFinal(50, gastos), -30.5, 'gastou mais dinheiro do que recebeu: saldo negativo');
  // caso da foto do Guilherme: R$ 15.000 com R$ 14.752,40 em gastos, se tudo em dinheiro
  const foto = [14474, 100, 148.4, 20, 10].map(v => ({ valor: v, categoria: 'Outros', forma: 'dinheiro' }));
  assert.strictEqual(f.saldoFinal(15000, foto), 247.6);
  foto[0].forma = 'pix';
  assert.strictEqual(f.saldoFinal(15000, foto), 14721.6, 'o maior gasto em Pix volta para o saldo');
});

test('caixa: categoria em texto livre, agrupada sem diferenciar maiúsculas; códigos antigos viram nome', () => {
  const f = funcoesCaixa();
  const gastos = [{ valor: 100, categoria: 'Pedágio' }, { valor: 20, categoria: 'pedágio ' }, { valor: 50, categoria: 'refeicao' }, { valor: 10, categoria: '' }];
  assert.deepStrictEqual(j(f.gastosPorCategoria(gastos)), { 'Pedágio': 120, 'Refeição': 50, 'Sem categoria': 10 });
  assert.strictEqual(f.nomeCategoria('locomocao'), 'Locomoção');
  assert.strictEqual(f.nomeCategoria('Combustível'), 'Combustível');
});

test('caixa: campo de categoria é de escrever (com sugestões), não uma lista fechada', () => {
  assert.match(codigo, /class="g-cat" placeholder="Categoria/);
  assert.doesNotMatch(codigo, /<select class="g-cat"/);
  assert.match(codigo, /attachAutocomplete\(el, sugestoesCategoria\)/);
});

test('viagem: formulário tem compradora, dinheiro entregue, troco, lojas do rateio e gastos Dinheiro/Pix', () => {
  const html = ler('tesouraria.html');
  assert.match(html, /id="ts-valor"/);
  assert.match(html, /id="ts-devolvido"/);
  assert.match(html, /id="ts-lojas"/);
  assert.match(html, /id="ts-add-gasto"/);
  assert.ok(codigo.includes("['viagem', 'Viagem'], ['hospedagem', 'Hospedagem'], ['refeicao', 'Refeição'], ['locomocao', 'Locomoção'], ['outros', 'Outros']"));
  assert.match(codigo, /data-forma="dinheiro"/);
  assert.match(codigo, /data-forma="pix"/);
  assert.doesNotMatch(html, /id="ts-tipo"/, 'saque/sangria saíram da viagem (agora são do Caixa)');
  assert.ok(codigo.includes("attachAutocomplete(g('ts-portador'), () => distintosPortadores())"), 'compradora se alimenta dos nomes já usados');
});

// ── Tesouraria v2 (2026-11-17, reunião com o Guilherme): Caixa = só dinheiro físico; Viagens ─────────
test('viagem: troco devolvido sai do que está com a compradora; total da viagem soma dinheiro + Pix', () => {
  const f = funcoesCaixa();
  const gastos = [{ valor: 1000, forma: 'dinheiro' }, { valor: 400, forma: 'pix' }];
  assert.strictEqual(f.saldoFinal(3000, gastos, 1500), 500, '3.000 entregue − 1.000 em dinheiro − 1.500 de troco');
  assert.strictEqual(f.saldoFinal(3000, gastos), 2000, 'sem troco informado');
  assert.strictEqual(f.totalGastos(gastos), 1400, 'o Pix entra no total da viagem');
});

test('viagem: o rateio entre lojas divide o TOTAL da viagem (dinheiro + Pix)', () => {
  assert.match(codigo, /dividirRateio\(totalViagem\(r\.gastos\), r\.rateio_ops \|\| \[\]\)/);
  assert.match(codigo, /dividirRateio\(totalViagem\(gastosForm\), lojasSel\)/);
});

function caixa() {
  const vm = require('node:vm');
  const m = /const TIPOS_CAIXA = [\s\S]*?\n    const saldoCaixa = [^\n]*\n/.exec(codigo);
  assert.ok(m, 'regras do caixa não encontradas');
  const ctx = vm.createContext({});
  vm.runInContext(m[0] + 'globalThis.f = { extratoCaixa, saldoCaixa, TIPOS_CAIXA };', ctx);
  return ctx.f;
}

test('caixa: saque, sangria, outra entrada e troca (pix → dinheiro) ENTRAM; saída sai', () => {
  const { saldoCaixa } = caixa();
  const movs = [
    { data: '2026-11-01', tipo: 'saque', valor: 5000 },
    { data: '2026-11-02', tipo: 'sangria', valor: 1200, loja: 'Exposicao' },
    { data: '2026-11-03', tipo: 'entrada', valor: 300 },
    { data: '2026-11-04', tipo: 'troca', valor: 500 },
    { data: '2026-11-05', tipo: 'saida', valor: 1000 },
  ];
  assert.strictEqual(saldoCaixa(movs, []), 6000);
});

test('caixa: dinheiro entregue à viagem sai, troco devolvido volta, Pix da viagem não mexe', () => {
  const { saldoCaixa, extratoCaixa } = caixa();
  const movs = [{ data: '2026-11-01', tipo: 'saque', valor: 10000 }];
  const viagens = [{ id: 'v1', data: '2026-11-10', portador: 'Renata', valor_enviado: 6000, devolvido: 800, gastos: [{ valor: 5200, forma: 'dinheiro' }, { valor: 3000, forma: 'pix' }] }];
  assert.strictEqual(saldoCaixa(movs, viagens), 4800, '10.000 − 6.000 entregue + 800 de troco; os 3.000 em Pix não entram');
  const e = JSON.parse(JSON.stringify(extratoCaixa(movs, viagens)));
  assert.deepStrictEqual(e.map(x => [x.tipo, x.valor, x.saldo]), [['saque', 10000, 10000], ['viagem', -6000, 4000], ['devolucao', 800, 4800]]);
  assert.strictEqual(saldoCaixa([], []), 0);
});

test('caixa: extrato em ordem de data, com saldo acumulado linha a linha', () => {
  const { extratoCaixa } = caixa();
  const e = JSON.parse(JSON.stringify(extratoCaixa([
    { data: '2026-11-05', tipo: 'saida', valor: 100, created_at: 'b' },
    { data: '2026-11-01', tipo: 'saque', valor: 1000, created_at: 'a' },
  ], [])));
  assert.deepStrictEqual(e.map(x => x.saldo), [1000, 900]);
});

test('cheque: campo "Cheque para" no formulário, na tabela e no que é gravado', () => {
  const html = ler('tesouraria.html');
  assert.match(html, /<label for="ch-para">Cheque para<\/label><input type="date" id="ch-para">/);
  assert.match(codigo, /<th>Cheque para<\/th>/);
  assert.match(codigo, /cheque_para: g\('ch-para'\)\.value \|\| null/);
});

test('abas: Cheques, Caixa e Viagens; o Caixa mostra o total de dinheiro físico', () => {
  const html = ler('tesouraria.html');
  for (const t of ['cheques', 'caixa', 'viagens']) assert.match(html, new RegExp('data-tab="' + t + '"'));
  assert.match(html, /Dinheiro físico em caixa<\/div>/);
  assert.match(codigo, /from\('tesouraria_caixa'\)/);
});
