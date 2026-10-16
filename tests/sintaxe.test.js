'use strict';
// Regressão: um erro de sintaxe num <script> deixa a tela inteira em branco.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { RAIZ, ler, scriptsDaPagina, caminho } = require('./helpers/carregar');

const paginas = fs.readdirSync(RAIZ).filter(f => f.endsWith('.html'));

for (const pagina of paginas) {
  test(`sintaxe dos scripts de ${pagina}`, () => {
    scriptsDaPagina(ler(pagina)).forEach((s, i) => {
      if (s.src || !s.codigo.trim()) return;
      assert.doesNotThrow(() => new vm.Script(s.codigo, { filename: `${pagina}#script${i}` }), `${pagina}: script ${i}`);
    });
  });
}

for (const arq of ['sidebar.js', 'ajuda.js', 'ajuda-conteudo.js', 'pdf.js', 'pdf-dc.js', 'user-menu.js', 'support.js']) {
  test(`sintaxe de ${arq}`, () => {
    assert.doesNotThrow(() => new vm.Script(ler(arq), { filename: arq }));
  });
}

test('vercel.json é JSON válido', () => {
  assert.doesNotThrow(() => JSON.parse(ler('vercel.json')));
});

test('imagens citadas nas telas existem em /public', () => {
  const faltando = [];
  for (const pagina of paginas) {
    for (const m of ler(pagina).matchAll(/['"(]\/public\/([\w.\-]+\.(?:png|jpg|jpeg|svg|webp))/gi)) {
      if (!fs.existsSync(caminho('public/' + m[1]))) faltando.push(`${pagina} -> ${m[1]}`);
    }
  }
  assert.deepStrictEqual(faltando, []);
});
