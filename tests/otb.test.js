'use strict';
// Fluxo Financeiro (OTB) — tela editável (25/11/2026), substitui a tela temporária de apresentação.
// Regras combinadas com o Douglas: permissão própria (ver / editar), cada mês fecha sozinho (igual à planilha,
// sem saldo anterior), período escolhido pela pessoa, linhas da planilha + criar/renomear/ocultar.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const html = ler('otb.html');
const codigo = scriptsDaPagina(html).filter(s => !s.src).map(s => s.codigo).join('\n');
const j = x => JSON.parse(JSON.stringify(x));

const parseValor = extrairFuncao(codigo, 'parseValor', {});
const mesesEntre = extrairFuncao(codigo, 'mesesEntre', {});
const chave = extrairFuncao(codigo, 'chave', {});
const calcularBloco = extrairFuncao(codigo, 'calcularBloco', { chave });
const alteracoes = extrairFuncao(codigo, 'alteracoes', {});

test('OTB: valor digitado no jeito brasileiro', () => {
  assert.strictEqual(parseValor('190.300'), 190300);
  assert.strictEqual(parseValor('1.234,56'), 1234.56);
  assert.strictEqual(parseValor('R$ 2.000'), 2000);
  assert.strictEqual(parseValor('-1.740'), -1740);
  assert.strictEqual(parseValor('0'), 0);
  assert.strictEqual(parseValor(''), null);
  assert.strictEqual(parseValor('  '), null);
  assert.ok(Number.isNaN(parseValor('abc')));
});

test('OTB: período escolhido vira lista de meses (máximo 12; invertido não quebra)', () => {
  assert.deepStrictEqual(j(mesesEntre('2026-11', '2027-01')), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepStrictEqual(j(mesesEntre('2026-11', '2026-11')), ['2026-11-01']);
  assert.deepStrictEqual(j(mesesEntre('2027-01', '2026-11')), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.strictEqual(mesesEntre('2026-01', '2028-12').length, 12);
});

// Planilha do Aldemar (nov/26, dez/26, jan/27) — só o necessário para conferir as somas.
const MESES = ['2026-11-01', '2026-12-01', '2027-01-01'];
function montar(def) {
  const linhas = [], val = {};
  def.forEach(([nome, tipo, porEmpresa], i) => {
    const id = 'L' + i;
    linhas.push({ id, nome, tipo, ordem: i, ativo: true });
    for (const [emp, vs] of Object.entries(porEmpresa)) vs.forEach((v, m) => { if (v != null) val[chave(id, emp, MESES[m])] = v; });
  });
  return { linhas, val };
}
const ECOM = montar([
  ['Contas a receber', 'e', { GIP: [190300, 0, 0], EP: [25220, 0, 0] }],
  ['Resgate saldo vendas', 'e', { GIP: [136590, 0, 0], EP: [45000, 1, 0] }],
  ['A receber vendas projetadas', 'e', { GIP: [300000, 1300000, 800000], EP: [40000, 120000, 0] }],
  ['Contas a pagar', 's', { GIP: [208100, 924070, 155290], EP: [50380, 79480, 54770] }],
  ['Pedidos a faturar', 's', { GIP: [202000, 37000, 0] }],
  ['Prov. desp. operacionais', 's', { GIP: [10000, 15000, 15000], EP: [2000, 3000, 3000] }],
  ['Desp. pessoal / FOPA', 's', { GIP: [40000, 120000, 80000], EP: [0, 20000, 20000] }],
  ['Impostos - D.A.S', 's', { GIP: [75000, 100000, 80000], EP: [0, 0, 0] }],
  ['Alfândega', 's', { GIP: [0, 0, 0], EP: [0, 0, 200000] }],
  ['Investimentos', 'i', { GIP: [null, 0, 740000], EP: [0, 0, 195000] }],
]);

test('OTB: entradas, saídas e saldo de cada mês batem com a planilha (e-commerce GIP / E.P.)', () => {
  const r = calcularBloco(ECOM.linhas, ECOM.val, ['GIP', 'EP'], MESES);
  const col = (emp, campo) => MESES.map(m => r[emp][m][campo]);
  assert.deepStrictEqual(col('GIP', 'ent'), [626890, 1300000, 800000]);
  assert.deepStrictEqual(col('GIP', 'sai'), [535100, 1196070, 330290]);
  assert.deepStrictEqual(col('GIP', 'saldo'), [91790, 103930, 469710]);
  assert.deepStrictEqual(col('EP', 'saldo'), [57840, 17521, -277770]);
  // consolidado do bloco
  assert.deepStrictEqual(MESES.map(m => r.total[m].saldo), [149630, 121451, 191940]);
});

test('OTB: linha informativa (Investimentos) e linha oculta ficam FORA da soma; cada mês fecha sozinho', () => {
  const linhas = ECOM.linhas.map(l => l.nome === 'Pedidos a faturar' ? { ...l, ativo: false } : l);
  const r = calcularBloco(linhas, ECOM.val, ['GIP', 'EP'], MESES);
  assert.strictEqual(r.GIP['2026-11-01'].sai, 535100 - 202000);
  assert.strictEqual(r.GIP['2027-01-01'].ent, 800000, 'investimento de 740.000 não entra');
  assert.strictEqual(r.GIP['2026-12-01'].saldo, 1300000 - (1196070 - 37000), 'dezembro não herda o saldo de novembro');
});

test('OTB: só grava o que mudou — valor novo/alterado vira gravação, apagado vira exclusão', () => {
  const orig = { a: 100, b: 200, c: 0 };
  const ed = { a: 100, b: 250, c: null, d: 50 };
  const r = alteracoes(orig, ed);
  assert.deepStrictEqual(j(r.gravar).sort(), ['b', 'd']);
  assert.deepStrictEqual(j(r.apagar), ['c']);
  assert.deepStrictEqual(j(alteracoes(orig, { a: 100 })), { gravar: [], apagar: [] }, 'célula não mexida não conta');
});

test('OTB: quem só tem "ver" não edita; editar exige admin ou can_otb_editar', () => {
  assert.match(codigo, /podeEditar = !!\(me\.is_admin \|\| me\.can_otb_editar === true\)/);
  assert.match(codigo, /me\.is_admin \|\| me\.can_otb === true \|\| me\.can_otb_editar === true/);
  assert.match(codigo, /sb\.from\('otb_valores'\)/);
  assert.match(codigo, /sb\.from\('otb_linhas'\)/);
});

test('OTB: ligado no menu (setor Financeiro), rota /fluxo-otb e a tela temporária antiga saiu', () => {
  const sidebar = ler('sidebar.js'), vercel = ler('vercel.json');
  assert.match(sidebar, /otb: \{ label: 'Fluxo Financeiro \(OTB\)', href: '\/fluxo-otb'/);
  assert.match(sidebar, /\{ id: 'financeiro', label: 'Financeiro', items: \[[^\]]*'otb'/);
  assert.match(vercel, /"source": "\/fluxo-otb", "destination": "\/otb\.html"/);
  assert.doesNotMatch(sidebar, /tmp_fluxo/);
  assert.doesNotMatch(vercel, /temp-fluxo-financeiro/);
});
