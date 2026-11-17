'use strict';
// Indicadores do conselho (modelo do Aldemar): as contas precisam reproduzir os documentos de 30/09/2026.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { ler, scriptsDaPagina } = require('./helpers/carregar');

const ctx = vm.createContext({ console });
vm.runInContext(ler('conselho-indicadores.js'), ctx, { filename: 'conselho-indicadores.js' });
const f = nome => vm.runInContext(nome, ctx);
const j = x => JSON.parse(JSON.stringify(x));
const r0 = v => Math.round(v);

// DRE jan–set/2026 do SAFI (valores conferidos com o banco em 17/11/2026), em um "mês" só com a soma.
const dreGIP = { rb: 14535855.56, ded: 4595166.66, cv: 7456148.54, go: 1202106.92, df: 0, ir: 0, cmv: 5988735.43, pessoal: 728361.93,
  grupos: { 'Despesas de Pessoal': 728361.93, 'Despesas de Ocupação': 46461, 'Despesas Comerciais': 0, 'Devoluções/Cancelamentos': 1209184, 'Chargebacks': 0 } };
const dreExpo = { rb: 8137812, ded: 361416.12, cv: 4867038.76, go: 1421065.86, df: 0, ir: 0, cmv: 4413406.78, pessoal: 858546.48,
  grupos: { 'Despesas de Pessoal': 858546.48, 'Despesas de Ocupação': 192827, 'Despesas Comerciais': 55424 } };
const balGIP = { operacao: 'GIP', data_base: '2026-09-30', estoque_custo: 2006800, clientes: [{ dias: 7, valor: 272650 }],
  fornecedores: [{ dias: 30, valor: 854860 }, { dias: 60, valor: 415420 }, { dias: 90, valor: 41250 }], emprestimos_cp: 450000, emprestimos_lp: 0, pl: 1386680 };
const iniGIP = { operacao: 'GIP', data_base: '2025-12-31', estoque_custo: 1513800, clientes: [], fornecedores: [] };
const balExpo = { operacao: 'Exposicao', data_base: '2026-09-30', estoque_custo: 2185805, clientes: [{ dias: 83, valor: 1392245 }], fornecedores: [{ dias: 63, valor: 639360 }], emprestimos_cp: 0, emprestimos_lp: 0, pl: 1555200 };
const iniExpo = { operacao: 'Exposicao', data_base: '2025-12-31', estoque_custo: 1786205, clientes: [], fornecedores: [] };

function calc(dre, bal, ini, extra) {
  const S = f('indSomarDre')([dre]);
  const C = f('indConsolidar');
  return j(f('indCalcular')({ dre: S, nMeses: 9, dreB: S, nMesesB: 9, dreTri: S, base: C([bal]), ini: C([ini]), ...extra }));
}

test('GIP: PME, PMP, ciclo, NCG, liquidez e gap batem com o documento do Aldemar', () => {
  const I = calc(dreGIP, balGIP, iniGIP);
  assert.strictEqual(r0(I.pme), 79);
  assert.strictEqual(r0(I.pmr), 7);
  assert.strictEqual(r0(I.pmp), 41);
  assert.strictEqual(r0(I.ciclo), 45);
  assert.strictEqual(r0(I.ncg), 967920);
  assert.strictEqual(I.liqCorrente.toFixed(2), '1.29');
  assert.strictEqual(I.liqSeca.toFixed(2), '0.15');
  assert.strictEqual((I.estrutura * 100).toFixed(1), '44.0');
  assert.strictEqual((I.financEstoque * 100).toFixed(1), '65.4');
  assert.strictEqual(r0(I.gap), 38);
  assert.ok(Math.abs(I.gapRs - 842000) < 1500, 'gap ≈ R$ 842 mil');
  assert.strictEqual((I.empPL * 100).toFixed(1), '32.5');
  assert.strictEqual(r0(I.ncgDias), 18);
});

test('Exposição: PME 121, ciclo 141, NCG 2.938.690, liquidez 5,60 / 2,18, gap 58 dias', () => {
  const I = calc(dreExpo, balExpo, iniExpo);
  assert.strictEqual(r0(I.pme), 121);
  assert.strictEqual(r0(I.ciclo), 141);
  assert.strictEqual(r0(I.ncg), 2938690);
  assert.strictEqual(I.liqCorrente.toFixed(2), '5.60');
  assert.strictEqual(I.liqSeca.toFixed(2), '2.18');
  assert.strictEqual(r0(I.gap), 58);
  assert.strictEqual((I.estrutura * 100).toFixed(1), '70.9');
  assert.strictEqual((I.financEstoque * 100).toFixed(1), '29.3');
});

test('resultado do DRE: margens sobre o faturamento e despesas variáveis SEM o CMV (critério do Aldemar)', () => {
  const I = calc(dreExpo, balExpo, iniExpo);
  assert.strictEqual(r0(I.rl), 7776396);
  assert.strictEqual(r0(I.mc), 2909357);
  assert.strictEqual(r0(I.res), 1488291);
  assert.strictEqual((I.mcPct * 100).toFixed(1), '35.8');
  assert.strictEqual(r0(I.despVar), 815048);
  // diretas + indiretas = variáveis + todos os gastos operacionais
  assert.strictEqual(r0(I.diretas + I.indiretas), r0(I.despVar + I.opex));
  assert.strictEqual(r0(I.indiretas), r0(1421065.86 - 858546.48 - 192827 - 55424));
});

test('geração de caixa: parcial (resultado − aumento do estoque) quando a abertura só tem estoque', () => {
  const I = calc(dreGIP, balGIP, iniGIP);
  assert.strictEqual(I.gerCaixaCompleta, false);
  assert.strictEqual(r0(I.gerCaixa), r0(I.resB - (2006800 - 1513800)));
});

test('pessoas: médias mensais por funcionário e por vendedor; sem vendedor marcado não inventa número', () => {
  const I = calc(dreExpo, balExpo, iniExpo, { hc: 31, vend: 9 });
  assert.strictEqual(r0(I.fatFunc), r0(8137812 / 9 / 31));
  assert.strictEqual(r0(I.mcVend), r0(2909357 / 9 / 9));
  const sem = calc(dreExpo, balExpo, iniExpo, { hc: 31, vend: 0 });
  assert.strictEqual(sem.fatVend, null);
});

test('por vendedor no conjunto: o faturamento do e-commerce (sem vendedor) não entra na conta', () => {
  const S = f('indSomarDre');
  const I = j(f('indCalcular')({ dre: S([dreExpo, dreGIP]), nMeses: 9, dreVend: S([dreExpo]), hc: 47, vend: 9 }));
  assert.strictEqual(r0(I.fatVend), r0(8137812 / 9 / 9));
  assert.strictEqual(r0(I.fatFunc), r0((8137812 + 14535855.56) / 9 / 47), 'por funcionário continua o conjunto todo');
});

test('sem balanço: indicadores do DRE aparecem e os de balanço ficam como "falta"', () => {
  const S = f('indSomarDre')([dreExpo]);
  const I = f('indCalcular')({ dre: S, nMeses: 9 });
  assert.strictEqual(I.pme, undefined);
  const pilares = j(f('indPilares')(I, {}));
  const ncg = pilares[1].linhas.find(l => l.l === 'NCG');
  assert.strictEqual(ncg.falta, true);
  assert.match(ncg.como, /balanço/);
  const rl = pilares[0].linhas.find(l => l.l === 'Receita Líquida');
  assert.strictEqual(rl.falta, false);
  assert.strictEqual(pilares.length, 6);
});

test('escolha do balanço: o último completo até o mês; abertura do ano não serve de data-base', () => {
  const esc = f('indEscolherBalancos');
  const lista = [iniGIP, balGIP, iniExpo, balExpo];
  const out = esc(lista, ['GIP'], '2026-10-31');
  assert.strictEqual(out.dataBase, '2026-09-30');
  assert.strictEqual(out.dataIni, '2025-12-31');
  assert.strictEqual(esc(lista, ['GIP'], '2026-08-31').dataBase, null, 'antes de 30/09 não há balanço completo');
  // conjunto: só vale a data em que TODAS as operações têm balanço
  assert.strictEqual(esc(lista, ['GIP', 'ViaCloset'], '2026-10-31').dataBase, null);
  const dois = esc(lista, ['GIP', 'Exposicao'], '2026-10-31');
  assert.strictEqual(dois.base.estoque_custo, 2006800 + 2185805);
  assert.strictEqual(f('indSomaFaixas')(dois.base.fornecedores), 1311530 + 639360);
});

test('consolidação: campo que uma operação não informou fica vazio (não vira zero)', () => {
  const c = j(f('indConsolidar')([{ ...balGIP, caixa: 100 }, { ...balExpo, caixa: null }]));
  assert.strictEqual(c.caixa, null);
  assert.strictEqual(c.pl, 1386680 + 1555200);
});

test('pergunta-chave: estoque parado mais tempo que o prazo do fornecedor = consumindo caixa', () => {
  const I = calc(dreExpo, balExpo, iniExpo);
  assert.match(f('indPerguntaChave')(I), /consumindo caixa/);
});

test('ligação na tela: painel, botão de balanço, script e opção do PDF', () => {
  const html = ler('conselho.html');
  assert.match(html, /<script src="\/conselho-indicadores\.js"><\/script>/);
  assert.match(html, /id="panel-ind"/);
  assert.match(html, /id="ind-modal"/);
  const codigo = scriptsDaPagina(html).map(s => s.codigo).join('\n');
  assert.match(codigo, /renderIndicadores\(ops, ano, mes\)/);
  assert.match(codigo, /indCarregar\(y\)/);
  assert.match(codigo, /id: 'indicadores'/);
  assert.match(codigo, /indPodeEditar = !!prof\.is_admin/);
});
