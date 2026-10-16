'use strict';
// Utilidades para testar o código do SAFI sem navegador e sem dependências.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const RAIZ = path.resolve(__dirname, '..', '..');
const caminho = rel => path.join(RAIZ, rel);
const ler = rel => fs.readFileSync(caminho(rel), 'utf8');

// Todos os <script> de uma página: { src, tipo, codigo }
function scriptsDaPagina(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const src = /\bsrc="([^"]+)"/.exec(attrs);
    const tipo = /\btype="([^"]+)"/.exec(attrs);
    out.push({ src: src ? src[1] : null, tipo: tipo ? tipo[1] : '', codigo: m[2] });
  }
  return out;
}

// Edge functions (.ts em _ds/): roda só o que vem antes do Deno.serve (constantes e funções puras),
// sem os imports (esm.sh / npm:) e sem os tipos. Devolve um contexto de onde se lê qualquer nome.
function carregarEdge(nome, extras) {
  const fonte = ler(`_ds/${nome}_index.ts`);
  const corte = fonte.indexOf('Deno.serve(');
  if (corte < 0) throw new Error(`Deno.serve não encontrado em ${nome}`);
  const js = stripTypeScriptTypes(fonte.slice(0, corte).replace(/^import .*$/gm, ''));
  const ctx = vm.createContext({ console, Deno: { env: { get: () => undefined } }, ...extras });
  vm.runInContext(js, ctx, { filename: `${nome}_index.ts` });
  return { ctx, pegar: nomeDoSimbolo => vm.runInContext(nomeDoSimbolo, ctx) };
}

// Pega uma função declarada no topo de um script (por nome) e a compila num contexto isolado.
function extrairFuncao(codigo, nome, globais) {
  const re = new RegExp(String.raw`(?:async\s+)?function\s+` + nome + String.raw`\s*\(`);
  const m = re.exec(codigo);
  if (!m) throw new Error(`função ${nome} não encontrada`);
  const fimParams = codigo.indexOf(')', m.index + m[0].length);
  let prof = 0, fim = -1;
  for (let k = codigo.indexOf('{', fimParams); k < codigo.length; k++) {
    const c = codigo[k];
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) { fim = k + 1; break; } }
  }
  if (fim < 0) throw new Error(`fim da função ${nome} não encontrado`);
  const ctx = vm.createContext({ console, ...globais });
  vm.runInContext(codigo.slice(m.index, fim) + `\nglobalThis.__f = ${nome};`, ctx);
  return ctx.__f;
}

module.exports = { RAIZ, caminho, ler, scriptsDaPagina, carregarEdge, extrairFuncao };
