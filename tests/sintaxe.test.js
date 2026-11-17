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

for (const arq of ['sidebar.js', 'ajuda.js', 'ajuda-conteudo.js', 'pdf.js', 'pdf-dc.js', 'user-menu.js', 'support.js', 'conselho-indicadores.js']) {
  test(`sintaxe de ${arq}`, () => {
    assert.doesNotThrow(() => new vm.Script(ler(arq), { filename: arq }));
  });
}

// Regressão (17/11/2026, Cascata): "const esc" na tela + "function esc" no user-menu.js = SyntaxError
// "Identifier already declared" e tela em branco — o teste de sintaxe acima olha cada script sozinho e não pega.
// Regra do navegador: o mesmo nome de topo em dois scripts da página só pode se os dois forem function/var.
function nomesDeTopo(codigo) {
  const linhas = codigo.split(/\r?\n/).filter(l => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l));
  const ind = Math.min(...linhas.map(l => l.match(/^\s*/)[0].length));
  const out = [];
  for (const l of linhas) {
    if (l.match(/^\s*/)[0].length !== ind) continue;
    const m = /^\s*(?:async\s+)?(function|var|let|const|class)\s+([A-Za-z_$][\w$]*)/.exec(l);
    if (m) out.push({ nome: m[2], tipo: m[1] });
  }
  return out;
}
function conflitosDaPagina(html) {
  const decl = new Map(), conflitos = [];
  scriptsDaPagina(html).forEach((s, i) => {
    let codigo = s.codigo, origem = 'script ' + i;
    if (s.src) {
      const arq = s.src.replace(/^\//, '');
      if (/^https?:/.test(s.src) || !fs.existsSync(caminho(arq))) return;
      codigo = ler(arq); origem = arq;
    }
    if (!codigo.trim()) return;
    for (const d of nomesDeTopo(codigo)) {
      const ant = decl.get(d.nome);
      if (ant && ant.origem !== origem && (/let|const|class/.test(d.tipo) || /let|const|class/.test(ant.tipo))) conflitos.push(d.nome + ' (' + ant.origem + ' e ' + origem + ')');
      if (!ant) decl.set(d.nome, { ...d, origem });
    }
  });
  return conflitos;
}
for (const pagina of paginas) {
  test(`nomes de topo de ${pagina} não colidem com os scripts compartilhados`, () => {
    assert.deepStrictEqual(conflitosDaPagina(ler(pagina)), []);
  });
}
test('o detector de colisão pega "const esc" numa tela que carrega o user-menu.js', () => {
  const html = '<script src="/user-menu.js"></script><script>\n    const esc = s => s;\n    const ok = 1;\n</script>';
  assert.deepStrictEqual(conflitosDaPagina(html), ['esc (user-menu.js e script 1)']);
});

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
