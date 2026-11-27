'use strict';
// Virada para 2027 (27/11/2026): o DRE/Resumo Contábil e o GerônIA liam só 2026 (ano fixo no código).
// Agora o ano vem do "mês de referência" (o mês anterior ao atual, porque o DRE fecha com um mês de atraso):
// em janeiro/2027 ainda abre em 2026 (dezembro); a partir de fevereiro/2027, em 2027. Dá para escolher o ano na tela.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao, carregarEdge } = require('./helpers/carregar');

const DC = ler('Grupo Sacoman - Painel Contábil.dc.html');
const comum = scriptsDaPagina(DC).filter(s => !s.src && s.tipo !== 'text/x-dc').map(s => s.codigo).join('\n');
const dcAnoRef = extrairFuncao(comum, 'dcAnoRef', {});
const dcAnoEscolhido = extrairFuncao(comum, 'dcAnoEscolhido', { dcAnoRef });
const dcMesRefIdx = extrairFuncao(comum, 'dcMesRefIdx', { dcAnoRef });
const dcAnosDisponiveis = extrairFuncao(comum, 'dcAnosDisponiveis', {});
const dia = (a, m, d = 15) => new Date(a, m - 1, d);
const j = x => JSON.parse(JSON.stringify(x));

test('DRE: ano de referência = ano do mês anterior (janeiro/2027 ainda é 2026, dezembro)', () => {
  assert.deepStrictEqual(j(dcAnoRef(dia(2026, 11))), { ano: 2026, idx: 9 });
  assert.deepStrictEqual(j(dcAnoRef(dia(2027, 1, 10))), { ano: 2026, idx: 11 });
  assert.deepStrictEqual(j(dcAnoRef(dia(2027, 2, 3))), { ano: 2027, idx: 0 });
});

test('DRE: ?ano= na URL escolhe o ano (entre 2026 e o ano atual); sem ele, o ano de referência', () => {
  assert.strictEqual(dcAnoEscolhido('', dia(2027, 1, 10)), 2026);
  assert.strictEqual(dcAnoEscolhido('', dia(2027, 3)), 2027);
  assert.strictEqual(dcAnoEscolhido('?ano=2027', dia(2027, 1, 10)), 2027);
  assert.strictEqual(dcAnoEscolhido('?x=1&ano=2026', dia(2027, 5)), 2026);
  assert.strictEqual(dcAnoEscolhido('?ano=2025', dia(2027, 5)), 2026, 'não há dados antes de 2026');
  assert.strictEqual(dcAnoEscolhido('?ano=2031', dia(2027, 5)), 2027, 'não vai além do ano atual');
});

test('DRE: mês de referência dentro do ano mostrado (ano passado = dezembro; ano novo ainda sem DRE = janeiro)', () => {
  assert.strictEqual(dcMesRefIdx(2026, dia(2026, 11)), 9);
  assert.strictEqual(dcMesRefIdx(2026, dia(2027, 1, 10)), 11);
  assert.strictEqual(dcMesRefIdx(2026, dia(2027, 6)), 11);
  assert.strictEqual(dcMesRefIdx(2027, dia(2027, 1, 10)), 0);
  assert.strictEqual(dcMesRefIdx(2027, dia(2027, 6)), 4);
  assert.deepStrictEqual(j(dcAnosDisponiveis(dia(2026, 11))), [2026]);
  assert.deepStrictEqual(j(dcAnosDisponiveis(dia(2027, 1))), [2026, 2027]);
});

test('DRE: nada de 2026 fixo (consultas, meses, rótulos, atalho "Ano") e tem o seletor de ano', () => {
  const dc = scriptsDaPagina(DC).filter(s => s.tipo === 'text/x-dc').map(s => s.codigo).join('\n');
  assert.doesNotMatch(DC, /ano=eq\.2026/);
  assert.doesNotMatch(DC, /'Jan\/2026'|Jan a Dez\/2026|— 2026|replace\('\/2026'/);
  assert.match(dc, /ano=eq\.\$\{this\._ano\}/);
  assert.match(DC, /onChange="\{\{ setAno \}\}"/);
  assert.match(dc, /_mesAtualIdx\(\)\{[\s\S]*?dcMesRefIdx\(this\._ano/);
});

test('GerônIA: lê o ano de referência e o anterior (a partir de 2027), com o ano em cada mês', () => {
  const { pegar } = carregarEdge('geronia-chat');
  const anosDosDados = pegar('anosDosDados');
  assert.deepStrictEqual(j(anosDosDados(dia(2026, 11))), [2026]);
  assert.deepStrictEqual(j(anosDosDados(dia(2027, 1, 10))), [2026]);
  assert.deepStrictEqual(j(anosDosDados(dia(2027, 2, 3))), [2026, 2027]);
  assert.deepStrictEqual(j(anosDosDados(dia(2028, 7))), [2027, 2028]);
  const opSummaryText = pegar('opSummaryText');
  const t = opSummaryText('Teste', { 202612: [{ receita_bruta: 100 }], 202701: [{ receita_bruta: 50 }] });
  assert.match(t, /Dezembro\/2026[\s\S]*Janeiro\/2027/);
  const src = ler('_ds/geronia-chat_index.ts');
  assert.doesNotMatch(src, /\.eq\('ano', 2026\)|\/2026:|de 2026 disponível|série mensal de 2026/);
});
