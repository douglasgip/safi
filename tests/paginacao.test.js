'use strict';
// Regressão (2026-10): o Supabase corta respostas em 1000 linhas; com 1011 lançamentos, a folha
// da Via Closet de setembro sumiu do DRE detalhado e do GerônIA. Toda leitura de
// lancamentos_valores precisa paginar.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const DC = 'Grupo Sacoman - Painel Contábil.dc.html';
const codigoDc = scriptsDaPagina(ler(DC)).map(s => s.codigo).join('\n');

// Servidor falso: devolve no máximo `teto` linhas por requisição, como o PostgREST.
function fetchFalso(total, teto) {
  const chamadas = [];
  const f = async url => {
    chamadas.push(url);
    const off = +/offset=(\d+)/.exec(url)[1];
    const lim = Math.min(+/limit=(\d+)/.exec(url)[1], teto);
    const linhas = [];
    for (let i = off; i < Math.min(off + lim, total); i++) linhas.push({ id: i + 1 });
    return { json: async () => linhas };
  };
  return { f, chamadas };
}

test('DRE: traz as 1011 linhas mesmo com teto de 1000 por resposta', async () => {
  const { f, chamadas } = fetchFalso(1011, 1000);
  const buscar = extrairFuncao(codigoDc, 'buscarTodasPaginasREST', { fetch: f });
  const linhas = await buscar('http://x/rest/v1/lancamentos_valores?select=*', {});
  assert.strictEqual(linhas.length, 1011);
  assert.strictEqual(linhas[1010].id, 1011);
  assert.strictEqual(new Set(linhas.map(l => l.id)).size, 1011, 'sem duplicadas');
  assert.ok(chamadas.length >= 2);
});

test('DRE: funciona também se o teto do servidor for menor (ex.: 500)', async () => {
  const { f } = fetchFalso(1700, 500);
  const buscar = extrairFuncao(codigoDc, 'buscarTodasPaginasREST', { fetch: f });
  assert.strictEqual((await buscar('http://x?a=1', {})).length, 1700);
});

test('DRE: tabela vazia e múltiplo exato da página não travam', async () => {
  for (const total of [0, 1000, 2000]) {
    const { f } = fetchFalso(total, 1000);
    const buscar = extrairFuncao(codigoDc, 'buscarTodasPaginasREST', { fetch: f });
    assert.strictEqual((await buscar('http://x?a=1', {})).length, total);
  }
});

test('DRE: resposta de erro (objeto) é devolvida em vez de virar loop infinito', async () => {
  const f = async () => ({ json: async () => ({ message: 'JWT expired' }) });
  const buscar = extrairFuncao(codigoDc, 'buscarTodasPaginasREST', { fetch: f });
  assert.deepStrictEqual(await buscar('http://x?a=1', {}), { message: 'JWT expired' });
});

test('DRE: a leitura de lancamentos_valores usa o paginador', () => {
  assert.match(codigoDc, /buscarTodasPaginasREST\(`[^`]*lancamentos_valores/);
  assert.doesNotMatch(codigoDc, /fetch\(`[^`]*lancamentos_valores[^`]*`/, 'não voltar a ler direto, sem paginar');
});

test('GerônIA: a leitura de lancamentos_valores pagina com range()', () => {
  const ts = ler('_ds/geronia-chat_index.ts');
  const i = ts.indexOf(".from('lancamentos_valores')");
  assert.ok(i > 0);
  const trecho = ts.slice(i, i + 600);
  assert.match(trecho, /\.order\('id'\)/, 'ordem estável é obrigatória para paginar');
  assert.match(trecho, /\.range\(/);
});

test('nenhuma tela lê lancamentos_valores sem paginar', () => {
  const fs = require('node:fs');
  const { RAIZ } = require('./helpers/carregar');
  const suspeitas = [];
  for (const arq of fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'))) {
    const src = ler(arq);
    if (!/from\('lancamentos_valores'\)\s*\.select/.test(src.replace(/\s+/g, ' '))) continue;
    // Lê tudo do ano sem filtro de empresa/mês e sem range: perigoso.
    if (!/\.range\(/.test(src)) suspeitas.push(arq);
  }
  assert.deepStrictEqual(suspeitas, [], 'páginas que leem lancamentos_valores sem range(): confirme que o filtro cabe em <1000 linhas');
});
