'use strict';
// Aviso de dado atrasado no BI (27/11/2026). Decidido com o Douglas:
// - faixa SEMPRE visível no topo do BI: "Exposição até 26/11 · Via Closet até 26/11 · E-commerce até 26/11";
//   a operação atrasada fica âmbar (1 dia) ou vermelha (2 dias ou mais);
// - todo mundo com acesso ao BI vê até que dia vai cada operação; o admin vê também o motivo e o que fazer;
// - às 10h, se algo atrasou, o robô manda WhatsApp para o "Meu numero" do Douglas (nunca para o grupo).
// "Até que dia" = o último dia que o robô CONFERIU (com ou sem venda: domingo/feriado a loja não vende e isso
// não é atraso). O robô informa isso ao SAFI (bi-importar, campo "situacao") e o SAFI guarda em bi_atualizacao.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao, carregarEdge } = require('./helpers/carregar');

const html = ler('bi.html');
const codigo = scriptsDaPagina(html).filter(s => !s.src).map(s => s.codigo).join('\n');
const atrasoBI = extrairFuncao(codigo, 'atrasoBI', {});
const quando = (d, h) => new Date(2026, 10, d, h, 0);

test('BI: atraso conta a partir de ontem (depois das 9h) ou anteontem (antes do robô rodar)', () => {
  assert.strictEqual(atrasoBI('2026-11-26', quando(27, 10)), 0);
  assert.strictEqual(atrasoBI('2026-11-25', quando(27, 10)), 1);
  assert.strictEqual(atrasoBI('2026-11-23', quando(27, 10)), 3);
  assert.strictEqual(atrasoBI('2026-11-25', quando(27, 7)), 0, 'às 7h o robô ainda não rodou: anteontem está em dia');
  assert.strictEqual(atrasoBI('2026-11-24', quando(27, 7)), 1);
  assert.strictEqual(atrasoBI(null, quando(27, 10)), null, 'sem registro ainda');
});

test('BI: faixa sempre visível com cada operação; âmbar 1 dia, vermelho 2+; motivo só para o admin', () => {
  assert.match(html, /id="bi-atualizado"/);
  assert.match(codigo, /from\('bi_atualizacao'\)/);
  const f = codigo.match(/function faixaAtualizacao\([\s\S]*?\n    }\n/)[0];
  assert.match(f, /atraso >= 2 \? 'vermelho' : atraso === 1 \? 'ambar'/);
  assert.match(f, /if \(admin\b/);
  assert.match(f, /ultimo_erro/);
});

test('bi-importar: recebe a situação do robô (até que dia conferiu / erro) e responde a consulta do alerta', () => {
  const { pegar } = carregarEdge('bi-importar');
  const normalizarSituacao = pegar('normalizarSituacao');
  const j = x => JSON.parse(JSON.stringify(x));
  const r = j(normalizarSituacao({ Exposicao: { conferido_ate: '2026-11-26' }, 'E-commerce': { erro: 'não consegui ler o GeFinance' }, Loja: { conferido_ate: '2026-11-26' } }, '2026-11-27'));
  assert.deepStrictEqual(r.itens, [{ operacao: 'Exposicao', conferido_ate: '2026-11-26' }, { operacao: 'GIP', erro: 'não consegui ler o GeFinance' }]);
  assert.strictEqual(r.erros.length, 1, 'operação desconhecida vira erro');
  assert.strictEqual(j(normalizarSituacao({ ViaCloset: { conferido_ate: '2026-11-28' } }, '2026-11-27')).itens.length, 0, 'dia no futuro não vale');
  assert.strictEqual(j(normalizarSituacao({ ViaCloset: { erro: 'x'.repeat(900) } }, '2026-11-27')).itens[0].erro.length, 300);
  const src = ler('_ds/bi-importar_index.ts');
  assert.match(src, /corpo\?\.consulta === true/);
  assert.match(src, /from\('bi_atualizacao'\)/);
  assert.match(src, /greatest|conferido_ate: maior/);
});

test('robô: informa ao SAFI até que dia conferiu cada loja e o e-commerce, ou o erro (com motivo em português)', () => {
  const py = ler('scripts/seta_robo.py');
  const fn = nome => py.match(new RegExp('def ' + nome + '\\([\\s\\S]*?\\r?\\n\\r?\\n\\r?\\n'))[0];
  assert.match(fn('informar_situacao'), /"situacao"/);
  assert.match(fn('motivo_amigavel'), /window handle/);
  const r = fn('rodar');
  assert.ok(r.indexOf('informar_situacao(') > -1 && r.indexOf('informar_situacao(') < r.lastIndexOf('raise falha'), 'informa antes de acusar o erro');
  assert.match(fn('gefinance_do_dia'), /informar_situacao\(cfg, \{'GIP': \{'conferido_ate'/);
  assert.match(fn('gefinance_do_dia'), /informar_situacao\(cfg, \{'GIP': \{'erro'/);
});

test('alerta das 10h: WhatsApp só para o "Meu numero", com a mesma regra de atraso do BI', () => {
  const py = ler('scripts/whatsapp_robo.py');
  const fn = nome => py.match(new RegExp('def ' + nome + '\\([\\s\\S]*?\\r?\\n\\r?\\n\\r?\\n'))[0];
  assert.match(fn('atraso_bi'), /hora >= 9/);
  const a = fn('alerta_bi');
  assert.match(a, /GRUPO_TESTE/);
  assert.doesNotMatch(a, /abrir_grupo\(page\)|abrir_grupo\(page, GRUPO\)/, 'nunca no grupo dos colaboradores');
  assert.match(py, /modo == 'alerta-bi'/);
});
