'use strict';
// Integração SAFI ⇄ Conekto (contrato integracao-safi.md) e o cadastro de Funcionários que a alimenta.
const test = require('node:test');
const assert = require('node:assert');
const { ler, scriptsDaPagina, extrairFuncao, carregarEdge } = require('./helpers/carregar');
const j = x => JSON.parse(JSON.stringify(x));

const htmlFunc = ler('funcionarios.html');
const codFunc = scriptsDaPagina(htmlFunc).map(s => s.codigo).join('\n');
const cpfValido = extrairFuncao(codFunc, 'cpfValido', {});

// ── Cadastro ───────────────────────────────────────────────────────────────
test('CPF: confere os dígitos verificadores (com ou sem máscara)', () => {
  assert.strictEqual(cpfValido('529.982.247-25'), true);   // CPF de exemplo do contrato
  assert.strictEqual(cpfValido('52998224725'), true);
  assert.strictEqual(cpfValido('529.982.247-24'), false);
  assert.strictEqual(cpfValido('111.111.111-11'), false);
  assert.strictEqual(cpfValido('1234'), false);
});

test('cadastro: gestão, nome, CPF válido e admissão são obrigatórios (o Conekto exige)', () => {
  const vm = require('node:vm');
  const m = /const CNPJS = \[[\s\S]*?\n    \];/.exec(codFunc);
  const ctx = vm.createContext({});
  vm.runInContext(m[0] + '\nglobalThis.CNPJS = CNPJS;', ctx);
  const validar = extrairFuncao(codFunc, 'validarCadastro', { CNPJS: ctx.CNPJS, cpfValido });
  const ok = { empresa: 'Exposição Paulista', nome: 'TESTE Giulia', cpf: '529.982.247-25', data_admissao: '2026-11-10', cnpj: '08297302000185' };
  assert.strictEqual(validar(ok), null);
  assert.match(validar({ ...ok, empresa: '' }), /gestão/);
  assert.match(validar({ ...ok, cpf: '529.982.247-24' }), /CPF inválido/);
  assert.match(validar({ ...ok, data_admissao: null }), /admissão/);
  assert.match(validar({ ...ok, cnpj: '00000000000000' }), /CNPJ/);
  assert.strictEqual(validar({ ...ok, cnpj: null }), null, 'CNPJ é opcional (padrão da gestão)');
});

test('bug corrigido: "Novo colaborador" não vem mais com GIP Ecommerce marcada', () => {
  assert.match(codFunc, /'<option value="">Selecione a gestão<\/option>' \+ allowedCompanies/);
  assert.match(codFunc, /allowedCompanies\.length === 1 \? allowedCompanies\[0\] : ''/);
});

test('desligar não apaga (guarda último dia e motivo) e excluir de vez é só do admin', () => {
  assert.match(codFunc, /update\(\{ status: 'desligado', data_desligamento: data, motivo_desligamento: motivo/);
  assert.match(codFunc, /sincronizarConekto\(r\.id, 'desligar'\)/);
  assert.match(codFunc, /currentProfile && currentProfile\.is_admin \? `<button class="btn-action btn-delete"/);
  assert.match(codFunc, /update\(\{ status: 'ativo', data_admissao: data, data_desligamento: null/, 'readmitir');
});

test('salvar envia ao Conekto pelo servidor (o token não fica na tela)', () => {
  assert.match(codFunc, /functions\.invoke\('conekto-sync'/);
  assert.match(codFunc, /await sincronizarConekto\(editId \|\| \(salvo && salvo\.id\), 'enviar'\)/);
  assert.doesNotMatch(htmlFunc, /conekto\.com\.br/);
  assert.doesNotMatch(htmlFunc, /CONEKTO_INTEGRATION_TOKEN/);
});

// ── SAFI → Conekto ─────────────────────────────────────────────────────────
const sync = carregarEdge('conekto-sync');
const colaborador = { id: '7a1c0f5e-0000-4000-8000-000000000001', cpf: '529.982.247-25', nome: ' TESTE Giulia Paula ', empresa: 'Exposição Paulista', data_admissao: '2026-11-03', cnpj: '08297302000185', data_nascimento: '1999-04-20', cargo: 'Vendedora', email: 'giulia@exemplo.com', telefone: '(44) 99999-1234', status: 'ativo', data_desligamento: null };

test('POST /colaboradores leva o cadastro completo, com CPF/telefone só em dígitos', () => {
  const p = j(sync.pegar('montarPayload')(colaborador));
  assert.deepStrictEqual(p, { safi_id: colaborador.id, cpf: '52998224725', nome: 'TESTE Giulia Paula', gestao: 'Exposição Paulista', admissao: '2026-11-03', cnpj: '08297302000185', nascimento: '1999-04-20', cargo: 'Vendedora', email: 'giulia@exemplo.com', telefone: '44999991234' });
  const vazio = j(sync.pegar('montarPayload')({ ...colaborador, cargo: null, email: '', cnpj: null }));
  assert.ok('cargo' in vazio && vazio.cargo === null, 'opcional vazio vai como null (fica vazio no Conekto)');
});

test('cada ação vira a chamada certa do contrato', () => {
  const plan = (a, f) => j(sync.pegar('planejarChamada')(a, f));
  assert.deepStrictEqual(plan('consultar', colaborador), { metodo: 'GET', caminho: '/colaboradores/52998224725', corpo: null });
  assert.strictEqual(plan('enviar', colaborador).metodo, 'POST');
  const deslig = { ...colaborador, status: 'desligado', data_desligamento: '2026-11-14' };
  assert.deepStrictEqual(plan('desligar', deslig), { metodo: 'PATCH', caminho: '/colaboradores/52998224725/desligamento', corpo: { data: '2026-11-14' } });
  assert.strictEqual(plan('enviar', deslig).metodo, 'PATCH', 'editar alguém desligado NÃO pode mandar POST (o POST readmite)');
  assert.match(plan('enviar', { ...colaborador, data_admissao: null }).erro, /admissão/);
  assert.match(plan('desligar', { ...colaborador, data_desligamento: null }).erro, /último dia/);
  assert.match(plan('enviar', { ...colaborador, cpf: '' }).erro, /CPF/);
});

test('modo teste: só vai ao Conekto colaborador fictício "TESTE…"; desligado não envia nada', () => {
  const lib = sync.pegar('liberadoNoModo');
  assert.strictEqual(lib('teste', colaborador), true);
  assert.strictEqual(lib('teste', { ...colaborador, nome: 'Giulia Paula' }), false);
  assert.strictEqual(lib('teste', { ...colaborador, nome: 'Testemunha da Silva' }), false, 'precisa ser a palavra TESTE');
  assert.strictEqual(lib('producao', { ...colaborador, nome: 'Giulia Paula' }), true);
  assert.strictEqual(lib('desligado', colaborador), false);
});

test('repete só em erro 500 ou falha de rede (chamadas idempotentes)', () => {
  const rep = sync.pegar('deveRepetir');
  assert.strictEqual(rep(null), true);
  assert.strictEqual(rep(500), true);
  assert.strictEqual(rep(503), true);
  assert.strictEqual(rep(400), false);
  assert.strictEqual(rep(409), false);
  assert.strictEqual(rep(200), false);
});

test('token do Conekto vem só da variável de ambiente', () => {
  const fonte = ler('_ds/conekto-sync_index.ts');
  assert.match(fonte, /Deno\.env\.get\('CONEKTO_INTEGRATION_TOKEN'\)/);
  assert.match(fonte, /https:\/\/www\.conekto\.com\.br\/api\/integracao/);
  assert.match(fonte, /from\('conekto_log'\)\.insert/, 'toda chamada fica registrada');
});

// ── Conekto → SAFI (webhook) ───────────────────────────────────────────────
const wh = carregarEdge('conekto-webhook');

test('webhook: token comparado por inteiro (vazio ou diferente é recusado)', () => {
  const iguais = wh.pegar('tokensIguais');
  assert.strictEqual(iguais('abc123', 'abc123'), true);
  assert.strictEqual(iguais('abc124', 'abc123'), false);
  assert.strictEqual(iguais('abc', 'abc123'), false);
  assert.strictEqual(iguais('', ''), false);
});

test('webhook: traduz os campos do contrato para o SAFI e ignora o resto', () => {
  const mapear = wh.pegar('mapearAlteracoes');
  const r = j(mapear({ full_name: 'Giulia Paula da Silva', telefone: '44988887777', gestao: 'via_closet', empresa: 'juliane', admissao_date: '2026-11-03', cpf: '529.982.247-25', campo_novo: 1 }));
  assert.deepStrictEqual(r.campos, { nome: 'Giulia Paula da Silva', telefone: '44988887777', empresa: 'Via Closet', cnpj: '02688541000180', data_admissao: '2026-11-03', cpf: '52998224725' });
  assert.deepStrictEqual(r.ignorados, ['campo_novo']);
});

test('webhook: desligamento e status vindos do Conekto', () => {
  const mapear = wh.pegar('mapearAlteracoes');
  assert.deepStrictEqual(j(mapear({ desligamento_date: '2026-11-14' }).campos), { data_desligamento: '2026-11-14', status: 'desligado' });
  assert.deepStrictEqual(j(mapear({ desligamento_date: null }).campos), { data_desligamento: null, status: 'ativo' });
  assert.deepStrictEqual(j(mapear({ is_active: false }).campos), { status: 'desligado' });
  assert.deepStrictEqual(j(mapear({ desligamento_date: '2026-11-14', is_active: true }).campos).status, 'desligado', 'a data manda');
  assert.deepStrictEqual(j(mapear({ gestao: 'loja_nova', admissao_date: '14/11/2026' })).ignorados, ['gestao', 'admissao_date'], 'valor fora do contrato não grava');
});

test('webhook: vale a última alteração (aviso atrasado não sobrescreve o SAFI)', () => {
  const atrasado = wh.pegar('avisoAtrasado');
  assert.strictEqual(atrasado('2026-11-10T14:03:11.512Z', '2026-11-10T15:00:00Z'), true);
  assert.strictEqual(atrasado('2026-11-10T14:03:11.512Z', '2026-11-10T13:00:00Z'), false);
  assert.strictEqual(atrasado(null, '2026-11-10T13:00:00Z'), false);
});

test('webhook: sem laço — nunca chama o Conekto de volta e usa token próprio', () => {
  const fonte = ler('_ds/conekto-webhook_index.ts').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'); // só o código
  assert.doesNotMatch(fonte, /conekto\.com\.br/);
  assert.doesNotMatch(fonte, /conekto-sync/);
  assert.doesNotMatch(fonte, /fetch\(/);
  assert.match(fonte, /Deno\.env\.get\('CONEKTO_WEBHOOK_TOKEN'\)/);
});
