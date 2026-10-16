'use strict';
// Toda tela do SAFI precisa estar ligada em todos os lugares: menu, Home, rotas, ajuda e (se tiver
// permissão própria) tela de Admin + funções que criam/editam usuário.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { ler, caminho } = require('./helpers/carregar');

const sidebar = ler('sidebar.js');

// Recorta o literal ({...} ou [...]) de "var NOME = ..." do sidebar.js.
function literal(nome, abre, fecha) {
  const ini = sidebar.indexOf('var ' + nome + ' = ' + abre);
  assert.ok(ini >= 0, nome + ' não encontrado em sidebar.js');
  const comeco = sidebar.indexOf(abre, ini);
  let prof = 0;
  for (let k = comeco; k < sidebar.length; k++) {
    if (sidebar[k] === abre) prof++;
    else if (sidebar[k] === fecha && --prof === 0) return sidebar.slice(comeco, k + 1);
  }
  throw new Error('fim de ' + nome + ' não encontrado');
}

const ITEMS = vm.runInNewContext('(' + literal('ITEMS', '{', '}') + ')');
const PATH_TO_KEY = vm.runInNewContext('(' + literal('PATH_TO_KEY', '{', '}') + ')');
const SECTIONS = literal('SECTIONS', '[', ']');

const vercel = JSON.parse(ler('vercel.json'));
const rotas = new Map(vercel.rewrites.map(r => [r.source, r.destination]));
const home = ler('index.html');
const ajuda = ler('ajuda-conteudo.js');
const SEM_CARD = new Set(['home', 'geronia']);
// Lançamentos é aberto pelo alternador do DRE, não tem linha própria no menu.
const FORA_DO_MENU = new Set(['lancamentos']);

test('toda rota do menu existe em vercel.json e aponta para um arquivo real', () => {
  for (const [path, key] of Object.entries(PATH_TO_KEY)) {
    if (path === '/') continue;
    const dest = rotas.get(path);
    assert.ok(dest, path + ' (' + key + ') sem rewrite em vercel.json');
    assert.ok(fs.existsSync(caminho(decodeURIComponent(dest).replace(/^\//, ''))), path + ' -> arquivo inexistente');
  }
});

test('todo item do menu aparece em algum setor (SECTIONS)', () => {
  for (const key of Object.keys(ITEMS)) {
    if (SEM_CARD.has(key) || FORA_DO_MENU.has(key)) continue;
    assert.ok(SECTIONS.includes("'" + key + "'"), key + ' fora de SECTIONS');
  }
});

test('todo item do menu tem card na Home e texto de ajuda', () => {
  for (const key of Object.keys(ITEMS)) {
    if (SEM_CARD.has(key)) continue;
    assert.ok(home.includes('id="card-' + key + '"'), 'Home sem card-' + key);
    assert.ok(new RegExp('\\b' + key + '\\s*:').test(ajuda), 'ajuda-conteudo.js sem "' + key + '"');
  }
});

test('toda permissão can_* usada no menu existe no Admin e nas funções de criar/editar usuário', () => {
  const flags = new Set([...sidebar.matchAll(/\bp\.(can_[a-z_]+)/g)].map(m => m[1]));
  const admin = ler('admin.html');
  const criar = ler('_ds/admin-create-user_index.ts');
  const editar = ler('_ds/admin-update-user_index.ts');
  const faltando = [];
  for (const f of flags) {
    if (!admin.includes(f)) faltando.push('admin.html: ' + f);
    if (!criar.includes(f)) faltando.push('admin-create-user: ' + f);
    if (!editar.includes(f + ' !== undefined')) faltando.push('admin-update-user: ' + f);
  }
  assert.deepStrictEqual(faltando, []);
});

test('nenhum arquivo de teste/ferramenta é publicado no Vercel', () => {
  const ign = ler('.vercelignore').split(/\r?\n/);
  for (const x of ['tests', 'package.json', 'scripts', 'CLAUDE.md']) assert.ok(ign.includes(x), '.vercelignore sem ' + x);
});
