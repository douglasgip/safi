// PDF das telas Resumo Contábil e DRE (que vivem na mesma página "Painel Contábil").
// Lê o estado da página (window.__dcApp) — filtros escolhidos, dados carregados — e monta os blocos para o SafiPdf.
(function () {
  'use strict';
  var OK = [21, 128, 61], RUIM = [185, 28, 28];
  var brl2 = function (n) { n = +n || 0; return (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var int0 = function (n) { n = +n || 0; return (Math.round(n) < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('pt-BR'); };
  var p1 = function (x) { return x == null || !isFinite(x) ? '-' : (x * 100).toFixed(1).replace('.', ',') + '%'; };
  var neg = function (v) { return v < 0 ? RUIM : null; };
  var g = function (id) { return document.getElementById(id); };

  function periodo(app) {
    var s = app.state, ms = Math.min(s.monthStart, s.monthEnd), me = Math.max(s.monthStart, s.monthEnd);
    return { ms: ms, me: me, rot: ms === me ? app._months[ms] : app._months[ms] + ' a ' + app._months[me] };
  }
  function graficosVisiveis(app, lista) {
    var out = [];
    lista.forEach(function (c) {
      var cv = g(c[0]); if (!cv || !cv.offsetParent) return;
      var img = SafiPdf.imgDeCanvas(cv); if (img) out.push({ t: c[1], url: img.url, ratio: img.ratio, png: img.png, dados: img.dados });
    });
    return out;
  }
  function textoKpis(itens) { return itens.map(function (it) { return '- ' + it.l + ': ' + it.v + (it.linhas && it.linhas.length ? ' | ' + it.linhas.map(function (l) { return l.t; }).join(' | ') : ''); }).join('\n'); }

  // ── Resumo Contábil ──
  function resumo(app) {
    var s = app.state, ms = Math.min(s.monthStart, s.monthEnd);
    function dados() {
      var eData = app._getEData(ms + 1), prev = ms > 0 ? app._getEData(ms) : null, sel = s.resumoSel;
      var nome = function (e) { return app._coLabels[e.id] || e.nome || e.id; };
      var somados = eData.filter(function (e) { return sel.indexOf(e.id) >= 0; });
      var tot = somados.reduce(function (a, e) { return { en: a.en + e.entrada, sa: a.sa + e.saida, de: a.de + (e.despesa || 0), re: a.re + e.resultado, es: a.es + (e.estoque || 0) }; }, { en: 0, sa: 0, de: 0, re: 0, es: 0 });
      return { eData: eData, prev: prev, sel: sel, nome: nome, somados: somados, tot: tot };
    }
    return {
      chave: 'resumo', titulo: 'Resumo Contábil',
      opcoes: [
        { id: 'kpis', label: 'Totais do consolidado (entrada, saída, despesa, resultado, estoque)' },
        { id: 'empresas', label: 'Resumo por empresa (tabela completa)' },
        { id: 'graficos', label: 'Gráficos' },
        { id: 'alertas', label: 'Destaques e alertas' },
        { id: 'ia', label: 'Resumo executivo do GerônIA', padrao: false, dica: 'Texto gerado por IA a partir dos números da tela.' },
      ],
      filtros: function () { var d = dados(); return [['Competência', app._months[ms]], ['Empresas somadas no consolidado', d.somados.length === d.eData.length ? 'Todas' : (d.somados.map(d.nome).join(', ') || 'Nenhuma')]]; },
      nomeArquivo: function () { return 'SAFI-Resumo-Contabil-' + app._months[ms].replace('/', ''); },
      coletar: function (sel) {
        var d = dados(), blocos = [];
        var kp = [
          { l: 'Entrada total', v: brl2(d.tot.en), linhas: [{ t: 'Somando ' + d.somados.length + ' de ' + d.eData.length + ' empresas' }] },
          { l: 'Saída total', v: brl2(d.tot.sa) },
          { l: 'Despesa total', v: brl2(d.tot.de) },
          { l: 'Resultado', v: brl2(d.tot.re), vCor: neg(d.tot.re), barra: [2, 132, 199] },
          { l: 'Estoque contábil', v: brl2(d.tot.es) },
        ];
        blocos.push({ tipo: 'kpis', opcao: 'kpis', titulo: 'Consolidado - ' + app._months[ms], itens: kp });
        var linhas = d.eData.map(function (e) {
          var prev = d.prev ? d.prev.filter(function (p) { return p.id === e.id; })[0] : null, var_ = '-';
          if (prev && Math.abs(prev.resultado) >= 1) { var x = (e.resultado - prev.resultado) / Math.abs(prev.resultado); var_ = (x >= 0 ? '+' : '-') + Math.abs(x * 100).toFixed(1).replace('.', ',') + '%'; }
          var cor = {}; if (e.resultado < 0) cor[5] = RUIM; if (var_ !== '-') cor[6] = var_[0] === '+' ? OK : RUIM;
          return { cor: cor, c: [d.nome(e), e.regimeShort || '-', brl2(e.entrada), brl2(e.saida), brl2(e.despesa), brl2(e.resultado), var_, brl2(e.estoque), e.id === 'EP' ? '-' : (e.aliquota || '-'), d.sel.indexOf(e.id) >= 0 ? 'Sim' : 'Não'] };
        });
        linhas.push({ k: 'T', cor: neg(d.tot.re) ? { 5: RUIM } : {}, c: ['Consolidado (somados)', '', brl2(d.tot.en), brl2(d.tot.sa), brl2(d.tot.de), brl2(d.tot.re), '', brl2(d.tot.es), '', ''] });
        blocos.push({ tipo: 'tabela', opcao: 'empresas', titulo: 'Resumo por empresa - ' + app._months[ms], fonte: 7.5,
          colunas: [{ h: 'Empresa', larg: 1.4 }, { h: 'Regime', larg: 0.9 }, { h: 'Entrada', al: 'right', larg: 1.3 }, { h: 'Saída', al: 'right', larg: 1.3 }, { h: 'Despesa', al: 'right', larg: 1.2 }, { h: 'Resultado', al: 'right', larg: 1.3 }, { h: 'Var. resultado vs mês ant.', al: 'right', larg: 1.1 }, { h: 'Estoque', al: 'right', larg: 1.2 }, { h: 'Alíquota', al: 'right', larg: 0.8 }, { h: 'No consolidado', al: 'center', larg: 0.9 }], linhas: linhas });
        var gr = sel.opcoes.graficos ? graficosVisiveis(app, [['chart-bar', 'Entrada / Saída / Despesa por empresa'], ['chart-line', 'Evolução']]) : [];
        blocos.push({ tipo: 'graficos', opcao: 'graficos', titulo: 'Gráficos', itens: gr });
        var al = (app._alertasArr || []).map(function (a) { return '• ' + a.label + ': ' + a.texto; });
        blocos.push({ tipo: 'texto', opcao: 'alertas', titulo: 'Destaques e alertas', texto: al.length ? al.join('\n') : 'Nenhum alerta no momento.' });
        return { blocos: blocos, subtitulo: app._months[ms], contextoIA: textoKpis(kp) + '\n' + d.eData.map(function (e) { return '- ' + d.nome(e) + ': entrada ' + brl2(e.entrada) + ', saída ' + brl2(e.saida) + ', despesa ' + brl2(e.despesa) + ', resultado ' + brl2(e.resultado); }).join('\n') };
      },
    };
  }

  // ── DRE ──
  function dre(app) {
    function estado() {
      var s = app.state, p = periodo(app), cos = s.selectedCos;
      var calc = app._dreCalcRange(cos, p.ms + 1, p.me + 1, true);
      return { s: s, p: p, cos: cos, calc: calc, cmp: s.compareEnabled ? app._cmpSides() : null };
    }
    function kpiItens(E) {
      var c = E.calc, rb = c.rb, trib = c.icms + c.das + c.oi, pc = function (v) { return rb > 0 ? p1(v / rb) + ' do faturamento' : ''; };
      return [
        { l: 'Faturamento', v: brl2(rb) },
        { l: 'Receita líquida', v: brl2(c.rl), linhas: [{ t: pc(c.rl) }] },
        { l: 'Margem de contribuição', v: brl2(c.mc), vCor: neg(c.mc), linhas: [{ t: pc(c.mc) }] },
        { l: 'Resultado líquido', v: brl2(c.res), vCor: neg(c.res), linhas: [{ t: pc(c.res) }], barra: [2, 132, 199] },
        { l: 'Gastos operacionais', v: brl2(c.gop), linhas: [{ t: pc(c.gop) }] },
        { l: 'Tributos (ICMS, DAS e outros)', v: brl2(trib), linhas: [{ t: pc(trib) }] },
      ];
    }
    function extrairDetalhados(E, orient) {
      var d = app._lancDetalheRows(E.cos, E.p.ms + 1, E.p.me + 1, false);
      var rot = function (m) { return app._months[m - 1].slice(0, 3); };
      var cols = [{ h: 'Conta', larg: 2.6 }].concat(d.months.map(function (m) { return { h: rot(m), al: 'right', larg: 1 }; })).concat([{ h: 'Total', al: 'right', larg: 1.15 }, { h: 'AV% total', al: 'right', larg: 0.8 }]);
      var kmap = { header: 'H', total: 'I', 'total-neg': 'I', subtotal: 'R', campo: 'S', leaf: 'S', sub: 'SS', 'campo-lite': 'S' };
      var linhas = d.rows.map(function (r) {
        var k = kmap[r.kind] || '', cor = {};
        if (r.kind === 'header') return { k: 'H', c: [r.label].concat(d.months.map(function () { return ''; })).concat(['', '']) };
        r.cells.forEach(function (c, i) { if (c.v != null && c.v < 0) cor[i + 1] = RUIM; });
        if (r.total < 0) cor[d.months.length + 1] = RUIM;
        var av = r.baseTotal > 0 ? p1(Math.abs(r.total) / r.baseTotal) : '-';
        return { k: k, cor: cor, c: [r.label].concat(r.cells.map(function (c) { return c.v == null ? '' : int0(c.v); })).concat([int0(r.total), av]) };
      });
      return { cols: cols, linhas: linhas, n: d.months.length };
    }
    return {
      chave: 'dre', titulo: 'DRE',
      opcoes: [
        { id: 'kpis', label: 'Indicadores do período' },
        { id: 'ops', label: 'Resumo por operação' },
        { id: 'comparacao', label: 'Comparação A × B', dica: 'Só entra se a comparação estiver ligada na tela.' },
        { id: 'graficos', label: 'Gráficos' },
        { id: 'dre', label: 'Tabela do DRE (com AV%, AH% e % do bloco)' },
        { id: 'detalhados', label: 'Lançamentos detalhados (linha a linha, mês a mês)', padrao: false, dica: 'Pode ocupar várias páginas; fica melhor na folha horizontal.' },
        { id: 'ia', label: 'Resumo executivo do GerônIA', padrao: false, dica: 'Texto gerado por IA a partir dos números da tela.' },
      ],
      filtros: function () {
        var E = estado(), f = [['Período', E.p.rot], ['Operações', E.cos.map(function (c) { return app._dreLabels[c] || c; }).join(', ')]];
        if (E.cmp && E.cmp.on) f.push(['Comparação (A × B)', 'A: ' + E.cmp.aCosLabel + ' em ' + periodoTxt(app, E.cmp.aMs, E.cmp.aMe) + '   |   B: ' + E.cmp.bCosLabel + ' em ' + periodoTxt(app, E.cmp.bMs, E.cmp.bMe)]);
        return f;
      },
      nomeArquivo: function () { var E = estado(); return 'SAFI-DRE-' + E.p.rot.replace(/\//g, '').replace(/ a /g, '_a_').replace(/\s+/g, ''); },
      coletar: function (sel) {
        var E = estado(), blocos = [], itens = kpiItens(E);
        blocos.push({ tipo: 'kpis', opcao: 'kpis', titulo: 'Indicadores - ' + E.p.rot, itens: itens });
        var linhasOps = E.cos.map(function (co) {
          var c = app._dreCalcRange([co], E.p.ms + 1, E.p.me + 1, true), rb = c.rb;
          return { cor: { 5: neg(c.res) || undefined }, c: [app._dreLabels[co] || co, brl2(c.rb), brl2(c.rl), brl2(c.mc), rb > 0 ? p1(c.mc / rb) : '-', brl2(c.res), rb > 0 ? p1(c.res / rb) : '-'] };
        });
        blocos.push({ tipo: 'tabela', opcao: 'ops', titulo: 'Por operação - ' + E.p.rot,
          colunas: [{ h: 'Operação', larg: 1.5 }, { h: 'Faturamento', al: 'right', larg: 1.3 }, { h: 'Receita líquida', al: 'right', larg: 1.3 }, { h: 'Margem de contribuição', al: 'right', larg: 1.4 }, { h: 'Margem %', al: 'right', larg: 0.8 }, { h: 'Resultado', al: 'right', larg: 1.3 }, { h: 'Resultado %', al: 'right', larg: 0.9 }], linhas: linhasOps });
        if (E.cmp && E.cmp.on && !E.cmp.identico) {
          var mk = function (nome, a, b) { var dif = a - b, pc = b !== 0 ? dif / Math.abs(b) : null; return { cor: { 3: dif >= 0 ? OK : RUIM, 4: dif >= 0 ? OK : RUIM }, c: [nome, brl2(a), brl2(b), (dif >= 0 ? '+' : '-') + brl2(Math.abs(dif)).replace('-', ''), pc == null ? '-' : (dif >= 0 ? '+' : '-') + Math.abs(pc * 100).toFixed(1).replace('.', ',') + '%'] }; };
          blocos.push({ tipo: 'tabela', opcao: 'comparacao', titulo: 'Comparação A x B',
            colunas: [{ h: 'Indicador', larg: 1.6 }, { h: 'A - ' + E.cmp.aCosLabel + ' (' + periodoTxt(app, E.cmp.aMs, E.cmp.aMe) + ')', al: 'right', larg: 1.6 }, { h: 'B - ' + E.cmp.bCosLabel + ' (' + periodoTxt(app, E.cmp.bMs, E.cmp.bMe) + ')', al: 'right', larg: 1.6 }, { h: 'Diferença (A - B)', al: 'right', larg: 1.3 }, { h: 'Variação', al: 'right', larg: 0.9 }],
            linhas: [mk('Faturamento', E.cmp.aCalc.rb, E.cmp.bCalc.rb), mk('Margem de contribuição', E.cmp.aCalc.mc, E.cmp.bCalc.mc), mk('Resultado líquido', E.cmp.aCalc.res, E.cmp.bCalc.res)] });
        }
        var gr = sel.opcoes.graficos ? graficosVisiveis(app, [['chart-dre-evo', 'Evolução mensal'], ['chart-line', 'Evolução do resultado'], ['chart-dre-margem', 'Margem'], ['chart-dre-pie', 'Faturamento por operação']]) : [];
        blocos.push({ tipo: 'graficos', opcao: 'graficos', titulo: 'Gráficos', itens: gr });
        // Tabela do DRE
        var rows = app._dreRows(E.cos);
        var Lp = E.p.me - E.p.ms + 1, baseTxt = (E.p.ms - Lp >= 0) ? 'AH% (vs ' + (Lp === 1 ? app._months[E.p.ms - 1].slice(0, 3) : 'período anterior') + ')' : 'AH% (sem base)';
        var linhas = rows.map(function (r) {
          if (r.t === 'H') return { k: 'H', c: [r.l, '', '', '', ''] };
          var cor = {}; if (r.v != null && r.v < 0) cor[1] = RUIM; if (r.h && r.h !== '—') cor[3] = r.h[0] === '+' ? OK : RUIM;
          return { k: r.t === 'R' ? 'R' : r.t === 'S' ? 'S' : 'I', cor: cor, c: [r.l, r.v == null ? '' : brl2(r.v), r.a || '-', (r.h && r.h !== '—') ? r.h : '-', (r.bp && r.bp !== '—') ? r.bp : '-'] };
        });
        blocos.push({ tipo: 'tabela', opcao: 'dre', titulo: 'Demonstrativo de Resultados - ' + E.p.rot + ' (' + E.cos.map(function (c) { return app._dreLabels[c] || c; }).join(', ') + ')',
          colunas: [{ h: 'Conta', larg: 3 }, { h: 'Valor', al: 'right', larg: 1.6 }, { h: 'AV% (sobre a receita bruta)', al: 'right', larg: 1.2 }, { h: baseTxt, al: 'right', larg: 1.1 }, { h: '% do bloco', al: 'right', larg: 1 }], linhas: linhas });
        blocos.push({ tipo: 'nota', opcao: 'dre', texto: 'AV% = peso da linha sobre a receita bruta. AH% = variação frente ao período anterior equivalente. "% do bloco" = peso sobre o subtotal do bloco anterior (ex.: margem de contribuição sobre a receita líquida). Valores negativos aparecem com sinal de menos.' });
        if (sel.opcoes.detalhados) {
          var det = extrairDetalhados(E, sel.orientacao);
          blocos.push({ tipo: 'tabela', opcao: 'detalhados', titulo: 'Lançamentos detalhados - ' + E.p.rot + ' (valores em R$, sem centavos)', fonte: det.n > 8 ? 6 : 7, colunas: det.cols, linhas: det.linhas });
          blocos.push({ tipo: 'nota', opcao: 'detalhados', texto: 'Mostra cada classe, campo e subcampo do DRE mês a mês. AV% total = peso da linha no total do período (linhas de custos e gastos sobre o total do próprio bloco; demais sobre a receita bruta).' });
        }
        return { blocos: blocos, subtitulo: E.p.rot, contextoIA: textoKpis(itens) + '\n' + linhasOps.map(function (l) { return '- ' + l.c[0] + ': faturamento ' + l.c[1] + ', margem ' + l.c[4] + ', resultado ' + l.c[5] + ' (' + l.c[6] + ')'; }).join('\n') };
      },
    };
  }
  function periodoTxt(app, a, b) { var s = Math.min(a, b), e = Math.max(a, b); return s === e ? app._months[s] : app._months[s] + ' a ' + app._months[e]; }

  window.SafiPdfDC = {
    iniciar: function (app, prof, sb) {
      if (!window.SafiPdf) return;
      var cfg = app.state.tab === 1 ? dre(app) : resumo(app);
      cfg.sb = sb; cfg.profile = prof; cfg.accent = '#f59e0b';
      SafiPdf.iniciar(cfg);
    }
  };
})();
