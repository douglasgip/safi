'use strict';
// Página pública da meta de peças (/meta, sem login) — 26/11/2026.
// Dezembro/2026: Exposição 48 mil, Via Closet 8 mil, GIP 80 mil. Operação que bate 100% sorteia um patinete;
// meta geral batida sorteia uma motinha elétrica. Os números vêm do BI (bi_kpi_diario.pecas) por uma porta
// pública no banco (meta_pecas_publica) que só devolve peças, meta e "ontem" — nada de R$ nem outras tabelas.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { ler, caminho, scriptsDaPagina, extrairFuncao } = require('./helpers/carregar');

const html = ler('meta.html');
const codigo = scriptsDaPagina(html).filter(s => !s.src).map(s => s.codigo).join('\n');
const resumoMeta = extrairFuncao(codigo, 'resumoMeta', {});
const j = x => JSON.parse(JSON.stringify(x));
const OPS = [{ operacao: 'Exposicao', meta: 48000, feito: 0, ontem: 0 }, { operacao: 'ViaCloset', meta: 8000, feito: 0, ontem: 0 }, { operacao: 'GIP', meta: 80000, feito: 0, ontem: 0 }];
const dez = (hoje, ate, ops = OPS) => ({ hoje, inicio: '2026-12-01', fim: '2026-12-31', ate, ops });

test('meta: antes de começar mostra quando começa e a duração (sem "ontem")', () => {
  const r = j(resumoMeta(dez('2026-11-26', null)));
  assert.strictEqual(r.estado, 'antes');
  assert.strictEqual(r.rotulo, 'Dezembro · começa em 01/12');
  assert.strictEqual(r.ontemRotulo, 'Começa em');
  assert.strictEqual(r.ontemTexto, '5 dias');
  assert.strictEqual(r.diasRotulo, 'Dias de meta');
  assert.strictEqual(r.diasTexto, '31');
  assert.strictEqual(r.P, 0);
});

test('meta: em andamento soma as 3 operações, conta os dias que faltam (hoje incluso) e mostra o dia mais recente', () => {
  const ops = [{ operacao: 'Exposicao', meta: 48000, feito: 32400, ontem: 610 }, { operacao: 'ViaCloset', meta: 8000, feito: 5100, ontem: 140 }, { operacao: 'GIP', meta: 80000, feito: 81200, ontem: 5113 }];
  const r = j(resumoMeta(dez('2026-12-19', '2026-12-18', ops)));
  assert.strictEqual(r.estado, 'andamento');
  assert.deepStrictEqual(r.tot, { feito: 118700, meta: 136000, ontem: 5863 });
  assert.ok(Math.abs(r.P - 118700 / 136000) < 1e-9);
  assert.strictEqual(r.rotulo, 'Dezembro · até 18/12');
  assert.strictEqual(r.ontemRotulo, 'Ontem');
  assert.strictEqual(r.ontemTexto, '+5.863');
  assert.strictEqual(r.diasRotulo, 'Dias restantes');
  assert.strictEqual(r.diasTexto, '13');
});

test('meta: se o robô atrasou, não diz "ontem" — diz o dia certo', () => {
  const r = j(resumoMeta(dez('2026-12-19', '2026-12-16')));
  assert.strictEqual(r.ontemRotulo, 'Em 16/12');
});

test('meta: no 1º dia ainda sem dados, e depois de acabar', () => {
  assert.strictEqual(j(resumoMeta(dez('2026-12-01', null))).rotulo, 'Dezembro · começou');
  const fim = j(resumoMeta(dez('2027-01-05', '2026-12-31')));
  assert.strictEqual(fim.estado, 'encerrada');
  assert.strictEqual(fim.diasRotulo, 'Encerrada em');
  assert.strictEqual(fim.diasTexto, '31/12');
});

test('meta: página pública só lê a porta pública (sem login, sem outras tabelas, sem R$, sem emoji, sem rascunho)', () => {
  assert.match(codigo, /sb\.rpc\('meta_pecas_publica'\)/);
  assert.doesNotMatch(codigo, /sb\.from\(|auth\.getSession|location\.replace\('\/login'\)/);
  assert.doesNotMatch(html, /R\$|faturamento|margem|RASCUNHO|rascunho-logos|simular/i);
  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u, 'sem emojis');
});

test('meta: com a meta perto de 0% a motinha e os patinetes ficam "estacionados" no começo da barra (não saem da tela)', () => {
  assert.match(codigo, /carro\.style\.left = `max\(\$\{w\}%, \$\{L - 6\}px\)`/);
  assert.match(codigo, /x\.style\.left = `max\(\$\{w\}%, \$\{PAT - 4\}px\)`/);
});

test('meta: meta geral batida abre o presente (caixa cai, treme, explode e aparece a motinha) uma vez por visita', () => {
  const ap = codigo.match(/function abrirPresente\([\s\S]*?\n    }\n/)[0];
  assert.match(ap, /\/public\/meta\/caixa\.png/);
  assert.match(ap, /veiculoHTML\('moto'/);
  assert.match(ap, /explodirConfete\(/);
  assert.match(codigo, /if \(!presenteAberto\) \{ presenteAberto = true;[^\n]*abrirPresente/);
  assert.ok(fs.existsSync(caminho('public/meta/caixa.png')), 'falta a imagem da caixa de presente');
});

test('meta: a caixa segura o suspense (treme por uns 3 s) antes de estourar', () => {
  const t = +codigo.match(/const TEMPO_ESTOURO = (\d+);/)[1];
  assert.ok(t >= 3500, 'estoura cedo demais: ' + t + ' ms');
  assert.match(codigo, /\}, TEMPO_ESTOURO\);/);
});

test('meta: cada operação que bate 100% solta confete do próprio card quando ele aparece na tela', () => {
  assert.match(codigo, /function explodirConfete\(/);
  assert.match(codigo, /new IntersectionObserver\([\s\S]*?explodirConfete\(/);
  assert.match(codigo, /o\.feito >= o\.meta/);
});

test('meta: rota /meta publicada e as imagens existem', () => {
  assert.match(ler('vercel.json'), /"source": "\/meta", "destination": "\/meta\.html"/);
  for (const m of html.matchAll(/\/public\/meta\/([\w.]+)/g)) assert.ok(fs.existsSync(caminho('public/meta/' + m[1])), 'falta public/meta/' + m[1]);
});
