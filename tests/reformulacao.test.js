'use strict';
// Reformulação de 2026-11-11: Fluxo de Caixa, Despesas Fixas, Fechamento do Mês, Pedidos, Conciliação,
// Produtos & Estoque e Plano Orçamentário saíram do SAFI (telas, permissões e tabelas).
// Nada pode continuar apontando para elas — senão vira link quebrado ou consulta a tabela apagada.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { ler, caminho } = require('./helpers/carregar');

const ARQUIVOS = ['fluxo-caixa.html', 'despesas-fixas.html', 'fechamento.html', 'pedidos.html', 'conciliacao.html', 'produtos.html', 'plano-orcamentario.html'];
const ROTAS = ['/fluxo-caixa', '/despesas-fixas', '/fechamento', '/pedidos', '/conciliacao', '/produtos', '/plano-orcamentario'];
const CHAVES = ['fluxocaixa', 'despfixas', 'fechamento', 'pedidos', 'conciliacao', 'produtos', 'planoorc'];
const PERMISSOES = /can_fluxo_caixa|can_despesas_fixas|despesas_fixas_(epgip|exposicao|viacloset)|can_pedidos|pedidos_(epgip|exposicao|viacloset|pode_\w+)|can_fechar_mes|can_produtos|can_plano_orcamentario/;
const TABELAS = /from\(['"](pedidos|pedidos_parcelas|despesas_fixas|despesas_fixas_lancamentos|fechamentos|fechamentos_log|produtos|produtos_analise|produtos_vendas_mes|produtos_importacoes|plano_orcamentario)['"]\)|rpc\(['"](fechamento_definir|auditoria_checagens|produtos_\w+)['"]/;

// Telas e funções que continuam no ar.
const TELAS = fs.readdirSync(caminho('.')).filter(f => f.endsWith('.html'));
const FUNCOES = ['_ds/admin-create-user_index.ts', '_ds/admin-update-user_index.ts', '_ds/geronia-chat_index.ts'];

test('os arquivos das telas retiradas não existem mais', () => {
  for (const f of ARQUIVOS) assert.ok(!fs.existsSync(caminho(f)), f + ' ainda existe');
});

test('menu, Home e ajuda não citam as telas retiradas', () => {
  const sidebar = ler('sidebar.js'), home = ler('index.html'), ajuda = ler('ajuda.js'), conteudo = ler('ajuda-conteudo.js');
  for (const k of CHAVES) {
    assert.ok(!new RegExp("'" + k + "'|\\b" + k + ':').test(sidebar), 'sidebar.js cita ' + k);
    assert.ok(!home.includes('card-' + k), 'Home cita card-' + k);
    assert.ok(!new RegExp('\\b' + k + ': \\[').test(ajuda), 'ajuda.js cita ' + k);
    assert.ok(!new RegExp('^  ' + k + ': \\{', 'm').test(conteudo), 'ajuda-conteudo.js cita ' + k);
  }
  for (const r of ROTAS) assert.ok(!sidebar.includes("'" + r + "'"), 'sidebar.js cita ' + r);
});

test('endereço antigo (favorito) volta para a Home em vez de dar erro', () => {
  const v = JSON.parse(ler('vercel.json'));
  for (const r of ROTAS) {
    assert.ok(!v.rewrites.some(x => x.source === r), r + ' ainda tem rewrite');
    assert.ok((v.redirects || []).some(x => x.source === r && x.destination === '/'), r + ' sem redirect para a Home');
  }
});

test('nenhuma tela ou função consulta as tabelas apagadas nem usa as permissões retiradas', () => {
  const achados = [];
  for (const f of [...TELAS, 'sidebar.js', ...FUNCOES]) {
    const s = ler(f);
    if (TABELAS.test(s)) achados.push(f + ': ' + s.match(TABELAS)[0]);
    if (PERMISSOES.test(s)) achados.push(f + ': ' + s.match(PERMISSOES)[0]);
  }
  assert.deepStrictEqual(achados, []);
});

test('Lançamentos: sem Fechamento do Mês, nenhum mês fica travado', () => {
  const l = ler('lancamentos.html');
  assert.ok(!l.includes("from('fechamentos')"));
  assert.match(l, /mesesTravados = new Set\(\);/);
});

test('GerônIA só lista funcionários ativos', () => {
  assert.match(ler('_ds/geronia-chat_index.ts'), /from\('funcionarios'\)[^\n]*\.eq\('status', 'ativo'\)/);
});

test('textos de ajuda e telas não citam mais as telas retiradas', () => {
  const NOMES = /Fechamento do Mês|Despesas Fixas|Fluxo de Caixa|Conciliação|Produtos &(amp;)? Estoque|Plano Orçamentário|\bPedidos\b|\bpedidos\b/;
  const achados = [];
  for (const f of ['ajuda-conteudo.js', ...TELAS]) {
    // comentários de código podem citar a história; o que conta é o texto que a pessoa vê
    const s = ler(f).split(/\r?\n/).filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\/\/ .*retirada/.test(l)).join('\n');
    const m = s.match(NOMES);
    if (m) achados.push(f + ': ' + m[0]);
  }
  assert.deepStrictEqual(achados, []);
});
