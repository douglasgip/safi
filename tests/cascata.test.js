'use strict';
// Cascata de Lucratividade (subtela do DRE): projeção das linhas do DRE a partir do faturamento previsto.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const codigo = scriptsDaPagina(ler('cascata.html')).map(s => s.codigo).join('\n');
const regraDaClasse = extrairFuncao(codigo, 'regraDaClasse', {});
const baseDe = extrairFuncao(codigo, 'baseDe', { regraDaClasse });
const projetar = extrairFuncao(codigo, 'projetar', {});
const somarColunas = extrairFuncao(codigo, 'somarColunas', {});
const totais = extrairFuncao(codigo, 'totais', {});
const colunaDoCongelado = extrairFuncao(codigo, 'colunaDoCongelado', {});
const linhasParaCongelar = extrairFuncao(codigo, 'linhasParaCongelar', {});

const REC = '(+) Receita Operacional Bruta', DED = '(-) Deduções da Receita Bruta', CV = '(-) Custos Variáveis', GO = '(-) Gastos Operacionais';
const L = (mes, classe, campo, valor, op) => ({ operacao: op || 'Exposicao', ano: 2026, mes, classe, classe_ordem: { [REC]: 1, [DED]: 2, [CV]: 4, [GO]: 6 }[classe], campo, campo_ordem: 1, valor });
// Dois meses de base: faturamento 1.000 + 3.000 = 4.000; DAS 10%, CMV 50%, folha 200 e 400 (média 300).
const rows = [
  L(1, REC, 'Venda Total', 1000), L(1, DED, 'Simples Nacional (DAS)', 100), L(1, CV, 'CMV', 500), L(1, GO, 'Despesas de Pessoal', 200),
  L(2, REC, 'Venda Total', 3000), L(2, DED, 'Simples Nacional (DAS)', 300), L(2, CV, 'CMV', 1500), L(2, GO, 'Despesas de Pessoal', 400),
  L(1, REC, 'Venda Ecommerce', 9999, 'GIP'),
];
const k = (classe, campo) => classe + '|' + campo;

test('regra por classe: receita é o faturamento; deduções e custos variáveis em %; gastos operacionais pela média', () => {
  assert.strictEqual(regraDaClasse(REC), 'fat');
  assert.strictEqual(regraDaClasse(DED), 'pct');
  assert.strictEqual(regraDaClasse(CV), 'pct');
  assert.strictEqual(regraDaClasse(GO), 'media');
});

test('base: soma o período de uma operação só, conta os meses com faturamento', () => {
  const b = baseDe(rows, 'Exposicao', 202601, 202602);
  assert.strictEqual(b.fat, 4000);
  assert.strictEqual(b.n, 2);
  assert.strictEqual(b.itens[k(CV, 'CMV')].valor, 2000);
  assert.strictEqual(baseDe(rows, 'Exposicao', 202602, 202602).fat, 3000, 'só fevereiro');
});

test('projeção: variáveis acompanham o faturamento previsto; fixos ficam na média mensal (não triplicam)', () => {
  const p = projetar(baseDe(rows, 'Exposicao', 202601, 202602), 2200000);
  assert.strictEqual(p.fat, 2200000);
  assert.strictEqual(p.itens[k(DED, 'Simples Nacional (DAS)')].valor, 220000);   // 10%
  assert.strictEqual(p.itens[k(CV, 'CMV')].valor, 1100000);                      // 50%
  assert.strictEqual(p.itens[k(GO, 'Despesas de Pessoal')].valor, 300);          // média de 200 e 400
  const t = totais(p);
  assert.strictEqual(t.rl, 1980000);
  assert.strictEqual(t.mc, 880000);
  assert.strictEqual(t.res, 879700);
});

test('consolidado: soma as operações já projetadas, cada uma com os próprios índices', () => {
  const rows2 = rows.concat([L(1, REC, 'Venda Total', 1000, 'ViaCloset'), L(1, CV, 'CMV', 300, 'ViaCloset')]);
  const a = projetar(baseDe(rows2, 'Exposicao', 202601, 202602), 1000);   // CMV 50%
  const b = projetar(baseDe(rows2, 'ViaCloset', 202601, 202602), 1000);   // CMV 30%
  const c = somarColunas([a, b, null]);
  assert.strictEqual(c.fat, 2000);
  assert.strictEqual(c.itens[k(CV, 'CMV')].valor, 800);
});

test('congelar e reabrir a projeção devolve os mesmos números', () => {
  const p = projetar(baseDe(rows, 'Exposicao', 202601, 202602), 850000);
  const volta = colunaDoCongelado({ faturamento: 850000, linhas: JSON.parse(JSON.stringify(linhasParaCongelar(p))) });
  assert.strictEqual(volta.fat, 850000);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(totais(volta))), JSON.parse(JSON.stringify(totais(p))));
});

test('ligação: subtela do DRE acima de Lançamentos, com rota, card na Home e ajuda', () => {
  const sidebar = ler('sidebar.js');
  assert.match(sidebar, /itemHtml\(prefix, 'cascata', active\) \+ itemHtml\(prefix, 'lancamentos', active\)/);
  assert.match(sidebar, /cascata: \{ label: 'Cascata de Lucratividade', href: '\/cascata', sub: true/);
  assert.match(ler('vercel.json'), /"source": "\/cascata", "destination": "\/cascata.html"/);
  assert.match(ler('index.html'), /id="card-cascata"/);
  assert.match(ler('ajuda-conteudo.js'), /cascata: \{\n?\s*titulo: 'Cascata de Lucratividade'/);
  assert.match(ler('ajuda.js'), /cascata: \['\/cascata', 'Financeiro \(submenu do DRE\)'\]/);
});

// ── DRE Projetado – Lucratividade (simulador do Aldemar) ─────────────────────
const grupoSim = extrairFuncao(codigo, 'grupoSim', {});
const simDaColuna = extrairFuncao(codigo, 'simDaColuna', { grupoSim });
const simCalcular = extrairFuncao(codigo, 'simCalcular', {});
const simSomar = extrairFuncao(codigo, 'simSomar', {});
const r2 = v => Math.round(v * 100) / 100;

test('simulador: reproduz o print do Aldemar (100 mi, 26,6% / 55% / 34% / 1%)', () => {
  const c = simCalcular({ fat: 100000000, pVar: 0.266, pCpv: 0.55, pCdf: 0.34, pFin: 0.01 });
  assert.deepStrictEqual(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, r2(v)])), {
    fat: 100000000, var: 26600000, liq: 73400000, cpv: 40370000, mc: 33030000, cdf: 24956000, ebitda: 8074000, fin: 734000, res: 7340000,
  });
});

test('simulador: grupos do DRE — impostos/fretes/comissões, CPV (só o CMV), fixos e financeiras/IR', () => {
  assert.strictEqual(grupoSim({ classe: DED, campo: 'Simples Nacional (DAS)' }), 'var');
  assert.strictEqual(grupoSim({ classe: CV, campo: 'Frete Pago' }), 'var');
  assert.strictEqual(grupoSim({ classe: CV, campo: 'CMV' }), 'cpv');
  assert.strictEqual(grupoSim({ classe: GO, campo: 'Despesas de Pessoal' }), 'cdf');
  assert.strictEqual(grupoSim({ classe: GO, campo: 'Despesas Financeiras' }), 'fin');
  assert.strictEqual(grupoSim({ classe: GO, campo: 'IR e CSLL' }), 'fin');
});

test('simulador: parte do real — % saem do DRE e a cascata volta aos mesmos valores', () => {
  const col = { fat: 1000, itens: {
    a: { classe: DED, campo: 'DAS', valor: 100 }, b: { classe: CV, campo: 'Frete Pago', valor: 100 }, c: { classe: CV, campo: 'CMV', valor: 400 },
    d: { classe: GO, campo: 'Despesas de Pessoal', valor: 160 }, e: { classe: GO, campo: 'Despesas Financeiras', valor: 40 } } };
  const s = simDaColuna(col);
  assert.strictEqual(s.fat, 1000);
  assert.strictEqual(r2(s.pVar), 0.2);          // 200 ÷ 1.000 (sobre o bruto)
  assert.strictEqual(r2(s.pCpv), 0.5);          // 400 ÷ 800 (sobre o faturamento líquido)
  assert.strictEqual(r2(s.pCdf), 0.2);          // 160 ÷ 800
  assert.strictEqual(r2(s.pFin), 0.05);         // 40 ÷ 800
  const c = simCalcular(s);
  assert.strictEqual(r2(c.res), 1000 - 100 - 100 - 400 - 160 - 40);
});

test('simulador: consolidado soma os R$ das três empresas', () => {
  const a = simCalcular({ fat: 1000, pVar: 0.2, pCpv: 0.5, pCdf: 0.2, pFin: 0 });
  const b = simCalcular({ fat: 500, pVar: 0.1, pCpv: 0.4, pCdf: 0.3, pFin: 0.1 });
  const t = simSomar([a, b, null]);
  assert.strictEqual(t.fat, 1500);
  assert.strictEqual(r2(t.liq), 800 + 450);
  assert.strictEqual(r2(t.res), r2(a.res + b.res));
});

test('simulador: painel na Cascata, com abas por empresa e tabela própria', () => {
  const html = ler('cascata.html');
  assert.match(html, /DRE Projetado – Lucratividade/);
  assert.match(html, /from\('dre_simulacao'\)/);
  assert.match(html, /id="sim-abas"/);
});
