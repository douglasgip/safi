'use strict';
// Robô do Seta: ele só exporta as planilhas (Resumo das Vendas + Listagem das Vendas) e manda as linhas cruas;
// as contas e a conferência ficam no bi-importar. Gabarito: Exposição, 17/11/2026 (conferido com o relatório e o Analytics).
const test = require('node:test');
const assert = require('node:assert');
const { ler, carregarEdge } = require('./helpers/carregar');

const { pegar } = carregarEdge('bi-importar');
const kpiDasPlanilhas = pegar('kpiDasPlanilhas');
const prepararPlanilhas = pegar('prepararPlanilhas');
const dataDoSeta = pegar('dataDoSeta');
const j = x => JSON.parse(JSON.stringify(x));
const HOJE = '2026-11-18';
const fx = JSON.parse(ler('tests/fixtures/seta_expo_20261117.json'));
const plan = (extra = {}) => ({ operacao: 'Exposicao', data: '2026-11-17', resumo: fx.resumo, listagem: fx.listagem, ...extra });

test('17/11 da Exposição: faturamento, lucro (sem o frete), vendas, ticket e P.A batem com o Seta', () => {
  const r = j(kpiDasPlanilhas(plan(), HOJE));
  assert.strictEqual(r.ok, true, r.motivo);
  assert.deepStrictEqual(r.linha, {
    operacao: 'Exposicao', data: '2026-11-17', fonte: 'automacao',
    faturamento: 25995.93, margem: 12326, ticket_medio: 206.32, pecas_atendimento: 4.65, qtd_vendas: 126,
  });
});

test('vendas: conta o número da venda uma vez só (venda dividida entre vendedoras) e ignora devoluções', () => {
  const listagem = [
    { codigo: '1', data: '17-Nov-26', total: 100 }, { codigo: '1', data: '17-Nov-26', total: 50 },
    { codigo: '2', data: '17-Nov-26', total: -30 }, { codigo: '3', data: '17-Nov-26', total: 80 },
  ];
  const resumo = [{ quantidade: 5, total: 200, lucro: 90, frete: 0 }];
  const r = j(kpiDasPlanilhas(plan({ resumo, listagem }), HOJE));
  assert.strictEqual(r.linha.qtd_vendas, 2);
  assert.strictEqual(r.linha.ticket_medio, 100);
  assert.strictEqual(r.linha.pecas_atendimento, 2.5);
});

test('conferência: listagem com venda de outro dia é recusada (o filtro de data não pegou)', () => {
  const listagem = fx.listagem.map((l, i) => i === 3 ? { ...l, data: '16-Nov-26' } : l);
  const r = j(kpiDasPlanilhas(plan({ listagem }), HOJE));
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /outro dia/);
});

test('conferência: resumo e listagem com totais diferentes são recusados (não grava número errado)', () => {
  const resumo = fx.resumo.map((l, i) => i === 0 ? { ...l, total: l.total + 10 } : l);
  const r = j(kpiDasPlanilhas(plan({ resumo }), HOJE));
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /não batem/);
});

test('dia sem venda nenhuma não vira faturamento zero (fica de fora e é avisado)', () => {
  const r = j(kpiDasPlanilhas(plan({ resumo: [], listagem: [] }), HOJE));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.semVendas, true);
});

test('data do Seta: "17-Nov-26" e "17/11/2026" viram aaaa-mm-dd; lixo vira null', () => {
  assert.strictEqual(dataDoSeta('17-Nov-26'), '2026-11-17');
  assert.strictEqual(dataDoSeta('03-Feb-27'), '2027-02-03');
  assert.strictEqual(dataDoSeta('17/11/2026'), '2026-11-17');
  assert.strictEqual(dataDoSeta('2026-11-17'), '2026-11-17');
  assert.strictEqual(dataDoSeta('ontem'), null);
});

test('lote de planilhas: as boas viram linhas; as recusadas voltam com o motivo, operação e dia', () => {
  const r = j(prepararPlanilhas([plan(), plan({ operacao: 'Loja X' }), plan({ data: '2026-11-16' })], HOJE));
  assert.strictEqual(r.boas.length, 1);
  assert.deepStrictEqual(r.erros.map(e => e.linha), [2, 3]);
  assert.match(r.erros[1].motivo, /outro dia/);
});

test('a função aceita planilhas e tem modo ensaio (calcula e devolve sem gravar)', () => {
  const fonte = ler('_ds/bi-importar_index.ts');
  assert.match(fonte, /corpo\?\.planilhas/);
  assert.match(fonte, /corpo\?\.ensaio === true/);
});

test('robô do Seta: segredos só no arquivo de configuração do PC, nunca no código', () => {
  const py = ler('scripts/seta_robo.py');
  assert.match(py, /SAFI-robo/);
  assert.match(py, /config\.ini/);
  assert.doesNotMatch(py, /senha\s*=\s*['"][^'"]+['"]/i);
  assert.doesNotMatch(py, /Bearer [A-Za-z0-9]{12,}/);
  assert.match(py, /"planilhas"/);
});

test('robô do Seta: comando token enxerga a linha "token =" vazia (não lê a linha de baixo)', () => {
  const py = ler('scripts/seta_robo.py');
  const ini = py.match(/def criar_token\(\):[\s\S]*?re\.search\(r'\(\?(\w+)\)(.*?)', txt\)/);
  assert.ok(ini, 'regex do criar_token não encontrada');
  const re = new RegExp(ini[2], ini[1]);
  const cfg = '[seta exposicao]\nusuario = a\nsenha = b\n\n[safi]\ntoken = \n\n[lojas]\nexposicao = 1\n';
  const m = cfg.match(re);
  assert.ok(m, 'não achou a linha token');
  assert.equal(m[1], '', 'linha vazia tem que ser lida como vazia');
  const cheio = cfg.replace('token = ', 'token = abc123');
  assert.equal(cheio.match(re)[1], 'abc123');
});

test('robô do Seta: confere cada relatório logo após exportar e tenta de novo se vier trocado', () => {
  const py = ler('scripts/seta_robo.py');
  const fn = py.match(/def exportar_dia\([\s\S]*?\r?\n\r?\n\r?\n/);
  assert.ok(fn, 'exportar_dia não encontrada');
  assert.match(fn[0], /for tentativa in range/);
  assert.match(fn[0], /salvar_como\(caminho\)[\s\S]*ler_planilha\(caminho, colunas\)/);
  assert.match(py, /TENTATIVAS_RELATORIO = [2-5]\b/);
});

test('robô do Seta: grava o passo a passo e os erros em robo.log (para conferir rodadas agendadas)', () => {
  const py = ler('scripts/seta_robo.py');
  assert.match(py, /robo\.log/);
  const fnLog = py.match(/def log\([\s\S]*?\r?\n\r?\n\r?\n/);
  assert.ok(fnLog);
  assert.match(fnLog[0], /open\(LOG/);
  assert.match(py, /if __name__ == '__main__':[\s\S]*except Exception[\s\S]*log\('ERRO/);
});

test('robô do Seta: dia sem vendas (feriado) — reconhece o aviso do Seta e manda o dia vazio', () => {
  const py = ler('scripts/seta_robo.py');
  const pad = py.match(/SEM_REGISTRO = r'([^']+)'/);
  assert.ok(pad, 'padrão do aviso não encontrado');
  const re = new RegExp(pad[1], 'i');
  for (const t of ['Nenhum registro encontrado!', 'Não há dados para exibir', 'Não foram encontrados registros', 'Sem movimento no período'])
    assert.match(t, re, t);
  for (const t of ['Deseja realmente sair?', 'Erro ao conectar no banco'])
    assert.doesNotMatch(t, re, t);
  assert.match(py, /except SemRegistros:[\s\S]*?return False/);
  assert.match(py, /def dia_sem_vendas[\s\S]*?'resumo': \[\], 'listagem': \[\]/);
  assert.match(py, /exportar_dia\(top, form, loja, d\) is False[\s\S]*?dia_sem_vendas/);
});

test('robô do Seta: erro num dia não perde os dias bons (manda ao SAFI e só depois acusa o erro)', () => {
  const py = ler('scripts/seta_robo.py');
  const fn = py.match(/def rodar\([\s\S]*?\r?\n\r?\n\r?\n/)[0];
  assert.match(fn, /falha = falha or e/);
  const envio = fn.indexOf('enviar(cfg, planilhas');
  const ultimoRaise = fn.lastIndexOf('raise falha');
  assert.ok(envio > 0 && ultimoRaise > envio, 'o erro tem que ser acusado depois do envio');
});
