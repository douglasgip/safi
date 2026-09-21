// Exportação em PDF do SAFI — botão "Gerar PDF", janela de opções e motor do relatório (A4, vertical ou horizontal).
//
//   SafiPdf.iniciar({
//     chave, titulo, subtitulo, sb, profile, accent,
//     opcoes:  [{ id, label, padrao, dica? }],                 // o que a pessoa pode ligar/desligar
//     filtros: () => [['Mês', 'Ago/2026'], ...],               // filtros selecionados na tela agora
//     nomeArquivo: () => 'SAFI-Painel-do-Conselho-2026-08',
//     coletar: async (sel) => ({ blocos: [...], contextoIA: '...' })   // sel = { orientacao, opcoes:{id:true/false} }
//   })
//
// Blocos: { tipo:'kpis',    opcao, titulo?, itens:[{ l, v, vCor?, linhas?:[{ t, cor? }], barra? }] }
//         { tipo:'graficos',opcao, titulo?, itens:[{ t, url, ratio }] }            (SafiPdf.imgDeCanvas gera url/ratio)
//         { tipo:'tabela',  opcao, titulo?, colunas:[{ h, al, larg }], linhas:[{ c:[...], k, cor:{col:[r,g,b]} }], fonte? }
//         { tipo:'texto',   opcao, titulo?, texto }        { tipo:'nota', opcao, texto }
//
// Toda exportação exige uma "finalidade" e é registrada (tabela exportacoes_pdf) para o administrador.
(function () {
  'use strict';
  var LIBS = ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'];
  var CFG = null, LOGO = null, ocupado = false;
  var COR = { navy: [15, 23, 42], tx: [30, 41, 59], mut: [100, 116, 139], lin: [226, 232, 240], bg: [241, 245, 249], ok: [21, 128, 61], ruim: [185, 28, 28], acc: [2, 132, 199] };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Mantém só o que a fonte padrão do PDF (Helvetica/WinAnsi) desenha; troca símbolos por equivalentes simples.
  function limpa(s) {
    s = String(s == null ? '' : s);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), ch = s.charAt(i);
      if (c === 0x2212) out += '-';
      else if (c === 0x25B2) out += '+';
      else if (c === 0x25BC) out += '-';
      else if (c === 0x2192) out += '->';
      else if (c === 0x2190) out += '<-';
      else if (c === 0x2009 || c === 0x202f) out += ' ';
      else if (c === 9 || c === 10 || (c >= 32 && c <= 255) || c === 0x2013 || c === 0x2014 || c === 0x2018 || c === 0x2019 || c === 0x201c || c === 0x201d || c === 0x2022 || c === 0x2026) out += ch;
    }
    return out;
  }
  function hexRgb(h) { h = String(h || '#38bdf8').replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return isNaN(n) ? '56,189,248' : ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }

  // ── Bibliotecas e logo (carregados só quando alguém clica em "Gerar PDF") ──
  function carregarScript(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { erro(new Error('Não foi possível carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function carregarLibs() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
    return carregarScript(LIBS[0]).then(function () { return carregarScript(LIBS[1]); });
  }
  function carregarLogo() {
    if (LOGO) return Promise.resolve(LOGO);
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () { LOGO = { url: img.src, ratio: img.naturalWidth / img.naturalHeight }; ok(LOGO); };
      img.onerror = function () { ok(null); };
      img.src = '/public/logo cheia.png';
    });
  }
  // ── Gráficos para impressão (preto e branco) ──────────────────────────────
  // Refaz o gráfico da tela em versão de papel: fundo branco, preto/cinza, PADRÕES (hachuras) em vez de cores,
  // linhas com traços e marcadores diferentes, valores escritos sobre as barras/pontos, legenda clara
  // e uma tabela com os números (montada a partir dos mesmos dados).
  var ORIENT = 'vertical';
  function scratch(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function padrao(tipo) {
    var c = scratch(14, 14), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 14, 14); x.strokeStyle = '#000'; x.fillStyle = '#000'; x.lineWidth = 2.2;
    var diag = function (inv) { x.beginPath(); for (var k = -14; k <= 28; k += 7) { if (inv) { x.moveTo(k, 0); x.lineTo(k - 14, 14); } else { x.moveTo(k, 14); x.lineTo(k + 14, 0); } } x.stroke(); };
    if (tipo === 'escuro') { x.fillStyle = '#222'; x.fillRect(0, 0, 14, 14); }
    else if (tipo === 'claro') { x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, 14, 14); }
    else if (tipo === 'diag') diag(false);
    else if (tipo === 'diag2') diag(true);
    else if (tipo === 'cruz') { diag(false); diag(true); }
    else if (tipo === 'pontos') { x.beginPath(); x.arc(3.5, 3.5, 2.4, 0, 7); x.arc(10.5, 10.5, 2.4, 0, 7); x.fill(); }
    else if (tipo === 'horiz') { x.beginPath(); x.moveTo(0, 3.5); x.lineTo(14, 3.5); x.moveTo(0, 10.5); x.lineTo(14, 10.5); x.stroke(); }
    else if (tipo === 'vert') { x.beginPath(); x.moveTo(3.5, 0); x.lineTo(3.5, 14); x.moveTo(10.5, 0); x.lineTo(10.5, 14); x.stroke(); }
    return x.createPattern(c, 'repeat');
  }
  var SEQ_PADRAO = ['escuro', 'diag', 'pontos', 'claro', 'cruz', 'diag2', 'horiz', 'vert'];
  var TRACOS = [[], [12, 6], [3, 5], [14, 5, 3, 5]];
  var MARCAS = ['circle', 'triangle', 'rect', 'rectRot', 'cross'];
  function compacto(v) {
    var a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e6) return s + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
    if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString('pt-BR') + ' mil';
    return s + a.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }
  function inteiro(v) { return (Math.round(v) < 0 ? '-' : '') + Math.abs(Math.round(v)).toLocaleString('pt-BR'); }

  // opt: { nomesCores: {corOriginal: 'nome na legenda'}, sinaisCores: {corOriginal: '+' | '-'} } — para gráficos com cor por barra (ponte).
  function imgDeCanvas(canvas, opt) {
    opt = opt || {};
    var ch = null;
    try { ch = window.Chart && window.Chart.getChart && window.Chart.getChart(canvas); } catch (e) {}
    if (!ch) return imgSimples(canvas);
    try { return imprimivel(ch, opt) || imgSimples(canvas); } catch (e) { return imgSimples(canvas); }
  }
  // Plano B: copia a imagem da tela sobre fundo escuro.
  function imgSimples(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    var pad = 14, c = scratch(canvas.width + pad * 2, canvas.height + pad * 2), x = c.getContext('2d');
    x.fillStyle = '#0f172a'; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvas, pad, pad);
    return { url: c.toDataURL('image/jpeg', 0.92), ratio: c.width / c.height };
  }

  function imprimivel(ch, opt) {
    var land = ORIENT === 'horizontal', W = land ? 900 : 1000, H = Math.round(W / (land ? 1.95 : 2.6)), F = land ? 1.25 : 1;   // horizontal: dois gráficos lado a lado; F aumenta a letra para continuar legível
    var tipo = ch.config.type || 'bar', pizza = tipo === 'pie' || tipo === 'doughnut';
    var labels = (ch.data.labels || []).map(function (l) { return Array.isArray(l) ? l.join(' ') : String(l); });
    var vis = []; ch.data.datasets.forEach(function (d, i) { if (ch.isDatasetVisible(i)) vis.push(d); });
    if (!vis.length) return null;
    var fmtTick = {};
    Object.keys(ch.scales || {}).forEach(function (id) { var t = ch.scales[id].options && ch.scales[id].options.ticks; if (t && typeof t.callback === 'function') fmtTick[id] = t.callback; });
    var maxAbs = 0; vis.forEach(function (d) { (d.data || []).forEach(function (v) { var n = Array.isArray(v) ? Math.max(Math.abs(v[0]), Math.abs(v[1])) : Math.abs(+v || 0); if (n > maxAbs) maxAbs = n; }); });
    var fmtValor = function (v, axisId) { if (maxAbs >= 1000) return compacto(v); var cb = fmtTick[axisId || 'y']; return cb ? String(cb(v)) : compacto(v); };
    var fmtTabela = function (v, axisId) { if (maxAbs >= 1000) return inteiro(v); var cb = fmtTick[axisId || 'y']; return cb ? String(cb(v)) : String(Math.round(v * 10) / 10).replace('.', ','); };

    var linhaIdx = 0, barraIdx = 0, coresUnicas = [], legendaCustom = null;
    var datasets = vis.map(function (d, si) {
      var t = d.type || tipo, o = { type: d.type, label: d.label, data: d.data, yAxisID: d.yAxisID, xAxisID: d.xAxisID, stack: d.stack, order: d.order };
      if (t === 'line') {
        o.borderColor = '#000'; o.borderWidth = 3; o.borderDash = TRACOS[linhaIdx % TRACOS.length]; o.pointStyle = MARCAS[linhaIdx % MARCAS.length];
        o.pointRadius = 7; o.pointBorderColor = '#000'; o.pointBorderWidth = 2; o.pointBackgroundColor = linhaIdx % 2 ? '#000' : '#fff'; o.fill = false; o.tension = 0.15; o.spanGaps = !!d.spanGaps;
        linhaIdx++;
      } else if (Array.isArray(d.backgroundColor)) {
        o.backgroundColor = d.backgroundColor.map(function (c) { var k = coresUnicas.indexOf(c); if (k < 0) { coresUnicas.push(c); k = coresUnicas.length - 1; } return padrao(SEQ_PADRAO[k % SEQ_PADRAO.length]); });
        o.borderColor = '#000'; o.borderWidth = 2;
        if (pizza) o.borderWidth = 2.5;
        legendaCustom = function () { return coresUnicas.map(function (c, k) { return { text: (opt.nomesCores && opt.nomesCores[c]) || (pizza ? '' : 'Série ' + (k + 1)), fillStyle: padrao(SEQ_PADRAO[k % SEQ_PADRAO.length]), strokeStyle: '#000', lineWidth: 2, hidden: false, index: k }; }); };
      } else {
        o.backgroundColor = padrao(SEQ_PADRAO[barraIdx % SEQ_PADRAO.length]); o.borderColor = '#000'; o.borderWidth = 2; barraIdx++;
      }
      return o;
    });

    // Pizza: legenda com valor e percentual
    var totalPizza = 0; if (pizza) (vis[0].data || []).forEach(function (v) { totalPizza += +v || 0; });
    var legendaPizza = pizza ? function () { return labels.map(function (l, k) { var v = +vis[0].data[k] || 0; return { text: l + ' - ' + compacto(v) + ' (' + (totalPizza ? (v / totalPizza * 100).toFixed(1).replace('.', ',') : '0') + '%)', fillStyle: datasets[0].backgroundColor[k], strokeStyle: '#000', lineWidth: 2, hidden: false, index: k }; }); } : null;

    var legendaPadrao = function () {
      return datasets.map(function (o, i) {
        var linha = (o.type || tipo) === 'line';
        return { text: o.label || ('Série ' + (i + 1)), datasetIndex: i, hidden: false, pointStyle: linha ? 'line' : 'rect', fillStyle: linha ? '#fff' : o.backgroundColor, strokeStyle: '#000', lineWidth: linha ? 3 : 2, lineDash: linha ? o.borderDash : [] };
      });
    };
    var scales = {};
    if (!pizza) Object.keys(ch.scales || {}).forEach(function (id) {
      var sc = ch.scales[id], eixoY = sc.axis === 'y';
      scales[id] = { position: sc.position, stacked: sc.options && sc.options.stacked, ticks: { color: '#000', font: { size: Math.round(18 * F) }, maxRotation: 0, autoSkip: true, callback: function (v, i) { return eixoY ? (fmtValor(+v, id)) : (labels[i] != null ? labels[i] : v); } },
        grid: { color: eixoY && id === Object.keys(ch.scales).filter(function (k) { return ch.scales[k].axis === 'y'; })[0] ? '#bdbdbd' : 'rgba(0,0,0,0)', drawOnChartArea: eixoY && id === Object.keys(ch.scales).filter(function (k) { return ch.scales[k].axis === 'y'; })[0] }, border: { color: '#000', width: 2 } };
    });

    // Valores escritos no gráfico (só quando não polui)
    var nPontos = labels.length, nSeries = datasets.length;
    var comRotulos = !pizza && ((nPontos <= 13 && nSeries <= 2) || coresUnicas.length > 0);
    var rotulos = {
      id: 'rotulosImpressao',
      afterDatasetsDraw: function (c) {
        if (!comRotulos) return;
        var x = c.ctx; x.save(); x.font = 'bold ' + Math.round(17 * F) + 'px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'bottom';
        c.data.datasets.forEach(function (d, di) {
          var meta = c.getDatasetMeta(di); if (meta.hidden) return;
          var orig = vis[di]; var axisId = (orig && orig.yAxisID) || 'y';
          meta.data.forEach(function (el, i) {
            var raw = d.data[i]; if (raw == null) return;
            var txt, px = el.x, py = el.y;
            if (Array.isArray(raw)) {
              var cor = orig.backgroundColor[i], mag = Math.abs(raw[1] - raw[0]);
              txt = ((opt.sinaisCores && opt.sinaisCores[cor]) || '') + compacto(mag); py = Math.min(el.y, el.base);
            } else txt = fmtValor(+raw, axisId);
            var w = x.measureText(txt).width;
            x.fillStyle = 'rgba(255,255,255,0.92)'; x.fillRect(px - w / 2 - 3, py - Math.round(26 * F), w + 6, Math.round(22 * F));
            x.fillStyle = '#000'; x.fillText(txt, px, py - 6);
          });
        });
        x.restore();
      }
    };
    var fundo = { id: 'fundoBranco', beforeDraw: function (c) { c.ctx.save(); c.ctx.fillStyle = '#fff'; c.ctx.fillRect(0, 0, c.width, c.height); c.ctx.restore(); } };

    var cv = scratch(W, H), cfg = {
      type: pizza ? tipo : (ch.config.type || 'bar'), data: { labels: labels, datasets: datasets },
      options: { responsive: false, animation: false, devicePixelRatio: 1, maintainAspectRatio: false, layout: { padding: { top: 14, right: 14, bottom: 6, left: 6 } },
        plugins: { legend: { display: !!(legendaCustom || pizza || datasets.length > 1), position: pizza ? 'right' : 'top', labels: { color: '#000', font: { size: Math.round(19 * F) }, boxWidth: Math.round(44 * F), boxHeight: Math.round(20 * F), padding: 14, usePointStyle: !(legendaPizza || legendaCustom), generateLabels: legendaPizza || legendaCustom || legendaPadrao } }, tooltip: { enabled: false } },
        scales: scales },
      plugins: [fundo, rotulos]
    };
    var chart = new window.Chart(cv, cfg); chart.update('none');
    var url = cv.toDataURL('image/png'); chart.destroy();

    // Tabela com os mesmos números
    var dados;
    if (pizza) {
      dados = { colunas: ['Item', 'Valor', '%'], linhas: labels.map(function (l, k) { var v = +vis[0].data[k] || 0; return [l, fmtTabela(v), (totalPizza ? (v / totalPizza * 100).toFixed(1).replace('.', ',') : '0') + '%']; }) };
    } else if (coresUnicas.length) {
      dados = { colunas: ['Item'].concat(labels), linhas: [['Valor'].concat(vis[0].data.map(function (v, i) { var mag = Array.isArray(v) ? Math.abs(v[1] - v[0]) : +v; var s = (opt.sinaisCores && opt.sinaisCores[vis[0].backgroundColor[i]]) || ''; return s + fmtTabela(mag); }))] };
    } else {
      dados = { colunas: ['Série'].concat(labels), linhas: vis.map(function (d) { return [d.label || 'Série'].concat((d.data || []).map(function (v) { return v == null ? '-' : fmtTabela(+v, d.yAxisID || 'y'); })); }) };
    }
    return { url: url, ratio: W / H, dados: dados, png: true };
  }

  // ── Botão no cabeçalho ──
  function injetarEstilo() {
    if ($('#safi-pdf-style')) return;
    var st = document.createElement('style'); st.id = 'safi-pdf-style';
    st.textContent =
      '.sp-btn{position:relative;display:inline-flex;align-items:center;gap:7px;padding:7px 13px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#94a3b8;font-family:Inter,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}' +
      '.sp-btn:hover{background:rgba(var(--sp-rgb,56,189,248),0.12);border-color:rgba(var(--sp-rgb,56,189,248),0.35);color:var(--sp-acc,#38bdf8)}' +
      '.sp-btn.sp-float{position:fixed;top:12px;right:150px;z-index:150;background:rgba(8,11,20,0.9)}' +
      '@media (max-width:768px){.sp-btn .sp-lbl{display:none}.sp-btn{padding:8px 9px}}' +
      '.sp-ov{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s ease,visibility 0s linear .25s}' +
      '.sp-ov.open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .25s ease,visibility 0s}' +
      '.sp-card{width:100%;max-width:560px;max-height:90vh;overflow-y:auto;background:rgba(12,10,30,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:26px;box-shadow:0 24px 60px rgba(0,0,0,0.7);font-family:Inter,sans-serif;color:#e2e8f0;transform:translateY(10px) scale(.98);transition:transform .28s cubic-bezier(.16,1,.3,1)}' +
      '.sp-ov.open .sp-card{transform:none}' +
      '.sp-t{font-size:18px;font-weight:800;color:#f8fafc;margin-bottom:4px}' +
      '.sp-s{font-size:12.5px;color:#64748b;margin-bottom:16px}' +
      '.sp-lbl2{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--sp-acc,#38bdf8);margin:16px 0 8px}' +
      '.sp-filtros{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 13px;font-size:12px;color:#94a3b8;line-height:1.7}' +
      '.sp-filtros b{color:#e2e8f0}' +
      '.sp-orient{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.sp-orient label{display:flex;align-items:center;gap:10px;padding:10px 13px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;color:#cbd5e1;background:rgba(255,255,255,0.03)}' +
      '.sp-orient label:has(input:checked){border-color:var(--sp-acc,#38bdf8);background:rgba(var(--sp-rgb,56,189,248),0.1);color:#f8fafc}' +
      '.sp-orient .fo{width:16px;height:22px;border:2px solid currentColor;border-radius:2px;flex-shrink:0}' +
      '.sp-orient .fo.h{width:22px;height:16px}' +
      '.sp-ops{display:flex;flex-direction:column;gap:7px}' +
      '.sp-ops label{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#cbd5e1;cursor:pointer;line-height:1.35}' +
      '.sp-ops label small{display:block;font-size:11px;color:#64748b;margin-top:1px}' +
      '.sp-ops input,.sp-orient input{accent-color:var(--sp-acc,#38bdf8);margin-top:2px}' +
      '.sp-txt{width:100%;min-height:74px;padding:11px 13px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f1f5f9;font-family:Inter,sans-serif;font-size:13px;resize:vertical;color-scheme:dark}' +
      '.sp-txt:focus{outline:none;border-color:var(--sp-acc,#38bdf8)}' +
      '.sp-aviso{font-size:11.5px;color:#fde68a;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:10px;padding:9px 12px;margin-top:10px;line-height:1.5}' +
      '.sp-erro{display:none;font-size:12px;color:#fca5a5;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:9px 12px;margin-top:12px;line-height:1.45}' +
      '.sp-erro.on{display:block}' +
      '.sp-ok{display:none;font-size:12.5px;color:#6ee7b7;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.28);border-radius:10px;padding:10px 13px;margin-top:12px;line-height:1.5}' +
      '.sp-ok.on{display:block}' +
      '.sp-acoes{display:flex;gap:10px;margin-top:18px}' +
      '.sp-b{padding:12px 18px;border-radius:12px;font-family:Inter,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#94a3b8}' +
      '.sp-b:hover{background:rgba(255,255,255,0.09);color:#f1f5f9}' +
      '.sp-b.pri{flex:1;background:linear-gradient(135deg,rgba(var(--sp-rgb,56,189,248),1),rgba(var(--sp-rgb,56,189,248),0.7));border:none;color:#06121f}' +
      '.sp-b.pri:disabled{opacity:.6;cursor:wait}' +
      '@media (prefers-reduced-motion:reduce){.sp-ov,.sp-card{transition:none}}';
    document.head.appendChild(st);
  }
  var ICONE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>';
  function colocarBotao() {
    if ($('#sp-btn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'sp-btn'; b.className = 'sp-btn';
    b.setAttribute('aria-label', 'Gerar PDF'); b.innerHTML = ICONE + '<span class="sp-lbl">Gerar PDF</span>';
    b.addEventListener('click', abrirJanela);
    var tentativas = 0;
    (function tenta() {
      var ajuda = $('#sa-help-btn');
      if (ajuda) {
        ajuda.parentNode.insertBefore(b, ajuda);
        // Na tela do DRE/Resumo o botão "Sobre" é empurrado para a direita por margem automática:
        // passa essa margem para o "Gerar PDF", para os dois ficarem juntos à direita (e não colados à logo).
        if (ajuda.style.marginLeft === 'auto') { b.style.marginLeft = 'auto'; b.style.marginRight = '10px'; ajuda.style.marginLeft = '0'; }
        return;
      }
      if (++tentativas < 30) return setTimeout(tenta, 200);
      var hdr = $('header.header') || $('.header'), dcNav = $('#dc-nav-right');
      if (hdr) hdr.appendChild(b); else if (dcNav) dcNav.parentNode.insertBefore(b, dcNav); else { b.classList.add('sp-float'); document.body.appendChild(b); }
    })();
  }

  // ── Janela de opções ──
  function aviso(msg, erro) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:10500;background:rgba(15,23,42,0.97);border:1px solid ' + (erro ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.14)') + ';border-radius:12px;padding:13px 22px;font:600 13px Inter,sans-serif;color:#f1f5f9;box-shadow:0 12px 32px rgba(0,0,0,0.5);max-width:90vw';
    t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 3800);
  }
  function abrirJanela() {
    if (!CFG || ocupado) return;
    var acc = CFG.accent || '#38bdf8';
    document.documentElement.style.setProperty('--sp-acc', acc); document.documentElement.style.setProperty('--sp-rgb', hexRgb(acc));
    var ov = $('#sp-janela');
    if (!ov) { ov = document.createElement('div'); ov.id = 'sp-janela'; ov.className = 'sp-ov'; ov.addEventListener('mousedown', function (e) { if (e.target === ov && !ocupado) fecharJanela(); }); document.body.appendChild(ov); }
    var filtros = []; try { filtros = CFG.filtros() || []; } catch (e) {}
    ov.innerHTML =
      '<div class="sp-card" role="dialog" aria-modal="true">' +
        '<div class="sp-t">Gerar PDF — ' + esc(CFG.titulo) + '</div>' +
        '<div class="sp-s">O arquivo usa os filtros que estão selecionados agora, em folha A4.</div>' +
        '<div class="sp-filtros">' + (filtros.length ? filtros.map(function (f) { return '<b>' + esc(f[0]) + ':</b> ' + esc(f[1]); }).join('<br>') : 'Sem filtros.') + '</div>' +
        '<div class="sp-lbl2">Orientação da folha</div>' +
        '<div class="sp-orient"><label><input type="radio" name="sp-or" value="vertical" checked><span class="fo"></span>Vertical</label><label><input type="radio" name="sp-or" value="horizontal"><span class="fo h"></span>Horizontal</label></div>' +
        '<div class="sp-lbl2">O que incluir</div>' +
        '<div class="sp-ops">' + opcoesComExtras().map(function (o) {
          return '<label><input type="checkbox" data-op="' + esc(o.id) + '"' + (o.padrao === false ? '' : ' checked') + '><span>' + esc(o.label) + (o.dica ? '<small>' + esc(o.dica) + '</small>' : '') + '</span></label>';
        }).join('') + '</div>' +
        '<div class="sp-lbl2">Finalidade desta exportação <span style="color:#fca5a5">*</span></div>' +
        '<textarea class="sp-txt" id="sp-fin" maxlength="300" placeholder="Ex.: Enviar o resultado de agosto para o conselheiro Fabiano antes da reunião"></textarea>' +
        '<div class="sp-erro" id="sp-erro"></div><div class="sp-ok" id="sp-ok"></div>' +
        '<div class="sp-acoes"><button type="button" class="sp-b pri" id="sp-gerar">Gerar PDF</button><button type="button" class="sp-b" id="sp-fechar">Cancelar</button></div>' +
      '</div>';
    void ov.offsetWidth; ov.classList.add('open');
    $('#sp-fechar', ov).addEventListener('click', function () { if (!ocupado) fecharJanela(); });
    $('#sp-gerar', ov).addEventListener('click', gerar);
    setTimeout(function () { var t = $('#sp-fin'); if (t) t.focus(); }, 300);
  }
  // Onde há gráficos, oferece também a tabela com os valores (ajuda muito na impressão em preto e branco).
  function opcoesComExtras() {
    var l = CFG.opcoes.slice(), i = -1;
    l.forEach(function (o, k) { if (o.id === 'graficos') i = k; });
    if (i >= 0 && !l.some(function (o) { return o.id === 'dadosGraficos'; })) l.splice(i + 1, 0, { id: 'dadosGraficos', label: 'Tabela com os valores de cada gráfico', dica: 'Recomendado para impressão em preto e branco.' });
    return l;
  }
  function fecharJanela() { var ov = $('#sp-janela'); if (ov) ov.classList.remove('open'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ocupado) fecharJanela(); });
  function erro(msg) { var e = $('#sp-erro'); if (e) { e.textContent = msg || ''; e.classList.toggle('on', !!msg); } }

  // ── Fluxo: valida → registra → (resumo IA) → monta o PDF → baixa ──
  function gerar() {
    var fin = ($('#sp-fin').value || '').trim();
    if (fin.length < 8) { erro('Informe a finalidade da exportação (mínimo de 8 caracteres). Ela é obrigatória.'); $('#sp-fin').focus(); return; }
    erro(''); var okBox = $('#sp-ok'); okBox.classList.remove('on');
    var orient = ($('input[name="sp-or"]:checked') || {}).value || 'vertical';
    var sel = { orientacao: orient, opcoes: {}, finalidade: fin };
    var marcadas = [];
    document.querySelectorAll('#sp-janela [data-op]').forEach(function (c) { sel.opcoes[c.getAttribute('data-op')] = c.checked; if (c.checked) marcadas.push(c.getAttribute('data-op')); });
    if (!marcadas.length) { erro('Marque pelo menos uma parte para incluir no PDF.'); return; }
    var btn = $('#sp-gerar'); ocupado = true; btn.disabled = true;
    var status = function (t) { btn.textContent = t; };
    var nome = limpa(CFG.nomeArquivo()).replace(/[^\w\-.]+/g, '-').replace(/-+/g, '-') + '.pdf';
    var filtros = []; try { filtros = CFG.filtros() || []; } catch (e) {}
    var comIA = !!sel.opcoes.ia, avisoIA = '';
    ORIENT = orient;

    status('Registrando…');
    registrar({ tela: CFG.chave, tela_titulo: CFG.titulo, filtros: filtros.map(function (f) { return f[0] + ': ' + f[1]; }).join(' | '), orientacao: orient,
      secoes: opcoesComExtras().filter(function (o) { return sel.opcoes[o.id]; }).map(function (o) { return o.label; }), com_ia: comIA, finalidade: fin, arquivo: nome })
    .then(function () { status('Carregando…'); return Promise.all([carregarLibs(), carregarLogo()]); })
    .then(function () { status('Coletando dados…'); return Promise.resolve(CFG.coletar(sel)); })
    .then(function (dados) {
      if (!comIA) return { dados: dados, ia: null };
      status('GerônIA analisando…');
      return resumoIA(dados.contextoIA || '', filtros).then(function (t) { return { dados: dados, ia: t }; }, function (e) { avisoIA = ' O resumo do GerônIA não pôde ser gerado agora (' + (e && e.message || 'erro') + '); o PDF saiu sem ele.'; return { dados: dados, ia: null }; });
    })
    .then(function (r) {
      status('Montando o PDF…');
      var blob = montarPdf(sel, filtros, r.dados, r.ia, nome);
      return blob;
    })
    .then(function (blob) {
      ocupado = false; btn.disabled = false; btn.textContent = 'Gerar PDF';
      okBox.innerHTML = 'PDF gerado e baixado: <b>' + esc(nome) + '</b>.' + esc(avisoIA);
      okBox.classList.add('on');
      if (navigator.canShare && blob) {
        try {
          var arq = new File([blob], nome, { type: 'application/pdf' });
          if (navigator.canShare({ files: [arq] })) {
            var sh = document.createElement('button'); sh.type = 'button'; sh.className = 'sp-b'; sh.textContent = 'Compartilhar…';
            sh.addEventListener('click', function () { navigator.share({ files: [arq], title: nome }).catch(function () {}); });
            $('.sp-acoes').insertBefore(sh, $('#sp-fechar'));
          }
        } catch (e) { /* compartilhamento é um extra */ }
      }
      $('#sp-fechar').textContent = 'Fechar';
    })
    .catch(function (e) {
      ocupado = false; btn.disabled = false; btn.textContent = 'Gerar PDF';
      erro('Não foi possível gerar o PDF: ' + (e && e.message ? e.message : e));
    });
  }

  function registrar(reg) {
    var sb = CFG.sb;
    if (!sb) return Promise.reject(new Error('Sessão indisponível.'));
    return new Promise(function (ok, no) {
      try {
        sb.from('exportacoes_pdf').insert(reg).then(function (r) {
          if (r && r.error) return no(new Error('não foi possível concluir agora, tente novamente em instantes'));
          ok();
        }, function (e) { no(e); });
      } catch (e) { no(e); }
    });
  }

  // Resumo executivo pelo GerônIA. Usa a própria conversa dele (que já respeita o acesso do usuário) e apaga a conversa depois.
  function resumoIA(contexto, filtros) {
    var sb = CFG.sb, url = (sb && sb.supabaseUrl) || CFG.supabaseUrl;
    var pergunta = 'Você está escrevendo o "Resumo executivo" que vai impresso no topo de um relatório PDF da tela "' + CFG.titulo + '" do SAFI, com os filtros: ' +
      filtros.map(function (f) { return f[0] + ' = ' + f[1]; }).join('; ') + '.\n\nNúmeros exibidos na tela:\n' + contexto +
      '\n\nEscreva de 4 a 8 linhas, em tom formal e direto: destaques do período, principais variações e pontos de atenção ou riscos. ' +
      'Sem saudação, sem perguntas de acompanhamento, sem bloco de sugestões e sem repetir todos os números. Use somente os dados que você recebeu; se algo não estiver nos dados, não invente.';
    var token;
    return sb.auth.getSession().then(function (r) {
      token = r && r.data && r.data.session && r.data.session.access_token;
      if (window.UserMenu && window.UserMenu.freshToken) return window.UserMenu.freshToken(sb, token);
      return token;
    }).then(function (t) {
      return fetch(url + '/functions/v1/geronia-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify({ message: pergunta, model: 'standard' }) });
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.thread_id) { try { sb.from('geronia_threads').delete().eq('id', d.thread_id).then(function () {}, function () {}); } catch (e) {} }
      if (!d || !d.reply) throw new Error(d && d.error ? d.error : 'sem resposta');
      var t = String(d.reply).replace(/<<<SUGESTOES>>>[\s\S]*?<<<FIM_SUGESTOES>>>/g, '').replace(/<<<SUGESTOES>>>[\s\S]*$/g, '');
      t = t.replace(/\*\*/g, '').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/`/g, '').trim();
      if (!t) throw new Error('resposta vazia');
      return t;
    });
  }

  // ── Motor do PDF ──
  function montarPdf(sel, filtros, dados, textoIA, nome) {
    var J = window.jspdf.jsPDF, land = sel.orientacao === 'horizontal';
    var doc = new J({ orientation: land ? 'l' : 'p', unit: 'pt', format: 'a4', compress: true });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 30, CW = W - M * 2, TOPO = 46, BASE = 38;
    var y = M, cabecalhos = {};
    var quem = (CFG.profile && (CFG.profile.full_name || CFG.profile.email)) || 'usuário';
    var quando = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    function cor(c, tipo) { var a = c || COR.tx; if (tipo === 'fill') doc.setFillColor(a[0], a[1], a[2]); else if (tipo === 'draw') doc.setDrawColor(a[0], a[1], a[2]); else doc.setTextColor(a[0], a[1], a[2]); }
    function txt(s, x, yy, o) { doc.text(limpa(s), x, yy, o); }
    function linhaGradiente(x, yy, w) {
      var n = 28, a = [14, 165, 233], b = [124, 58, 237];
      for (var i = 0; i < n; i++) { doc.setFillColor(Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n), Math.round(a[2] + (b[2] - a[2]) * i / n)); doc.rect(x + w * i / n, yy, w / n + 0.6, 2.2, 'F'); }
    }
    function cabecalhoCorrida() {
      var p = doc.internal.getCurrentPageInfo().pageNumber; if (cabecalhos[p]) return; cabecalhos[p] = 1;
      if (LOGO) doc.addImage(LOGO.url, 'PNG', M, 16, 14 * LOGO.ratio, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor(COR.mut); txt(CFG.titulo + '  ·  ' + (dados.subtitulo || ''), W - M, 26, { align: 'right' });
      cor(COR.lin, 'draw'); doc.setLineWidth(0.6); doc.line(M, 34, W - M, 34);
    }
    function novaPagina() { doc.addPage(); y = TOPO; cabecalhoCorrida(); }
    function garante(h) { if (y + h > H - BASE) novaPagina(); }

    // Cabeçalho da 1ª página
    cabecalhos[1] = 1;
    var lh = 30;
    if (LOGO) doc.addImage(LOGO.url, 'PNG', M, y, lh * LOGO.ratio, lh);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); cor(COR.navy); txt(CFG.titulo, W - M, y + 13, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); cor(COR.mut); if (dados.subtitulo) txt(dados.subtitulo, W - M, y + 26, { align: 'right' });
    y += lh + 8; linhaGradiente(M, y, CW); y += 12;
    doc.setFontSize(8); cor(COR.tx);
    var linhasMeta = [];
    if (filtros.length) linhasMeta.push('Filtros:  ' + filtros.map(function (f) { return f[0] + ' - ' + f[1]; }).join('   |   '));
    linhasMeta.push('Finalidade:  ' + sel.finalidade);
    linhasMeta.forEach(function (l, i) {
      var partes = doc.splitTextToSize(limpa(l), CW);
      partes.forEach(function (p) { txt(p, M, y); y += 10.5; });
    });
    y += 6;

    function titulo(t) {
      if (!t) return;
      garante(34); cor(COR.acc, 'fill'); doc.rect(M, y - 8, 3, 11, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); cor(COR.navy); txt(t, M + 8, y); y += 12;
    }

    // ---- Blocos ----
    function kpis(b) {
      titulo(b.titulo);
      var n = b.itens.length, cols = land ? (n <= 5 ? n : (n % 3 === 0 ? 3 : 4)) : Math.min(n, 3), gap = 9, cw = (CW - gap * (cols - 1)) / cols;
      for (var i = 0; i < n; i += cols) {
        var linha = b.itens.slice(i, i + cols);
        var alt = 0;
        var prep = linha.map(function (it) {
          doc.setFontSize(7.5); var ls = [];
          (it.linhas || []).forEach(function (l) { doc.splitTextToSize(limpa(l.t), cw - 20).forEach(function (p) { ls.push({ t: p, cor: l.cor }); }); });
          var h = 12 + 24 + ls.length * 10.5 + 12; if (h > alt) alt = h; return { it: it, ls: ls };
        });
        garante(alt + 8);
        prep.forEach(function (p, j) {
          var x = M + j * (cw + gap);
          cor(COR.bg, 'fill'); cor(COR.lin, 'draw'); doc.setLineWidth(0.5); doc.roundedRect(x, y, cw, alt, 5, 5, 'FD');
          cor(p.it.barra || COR.acc, 'fill'); doc.rect(x, y + 5, 3, alt - 10, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); cor(COR.mut); txt(String(p.it.l).toUpperCase(), x + 12, y + 14);
          doc.setFontSize(15); cor(p.it.vCor || COR.navy); txt(p.it.v, x + 12, y + 33);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
          p.ls.forEach(function (l, k) { cor(l.cor || COR.mut); txt(l.t, x + 12, y + 46 + k * 10.5); });
        });
        y += alt + 8;
      }
      y += 4;
    }
    // Mede quanto uma tabela ocupa (num PDF de rascunho, com as mesmas fontes) — para decidir se cabe na página
    // inteira e nunca cortar uma tabela ao meio quando ela cabe numa página só.
    var docMedida = null;
    function estiloTabela(b, fonte, cols, largura, geo) {
      var total = cols.reduce(function (a, c) { return a + (c.larg || 1); }, 0), estilos = {};
      cols.forEach(function (c, i) { estilos[i] = { halign: c.al || 'left', cellWidth: largura * (c.larg || 1) / total }; });
      return {
        head: [cols.map(function (c) { return limpa(c.h); })],
        body: b.linhas.map(function (l) { return l.c.map(limpa); }),
        tableWidth: largura, theme: 'plain', columnStyles: estilos,
        styles: { font: 'helvetica', fontSize: fonte, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, lineColor: COR.lin, lineWidth: 0.3, textColor: COR.tx, overflow: 'linebreak' },
        headStyles: { fillColor: COR.navy, textColor: 255, fontStyle: 'bold', fontSize: fonte - 0.5 },
        didParseCell: function (d) {
          if (d.section === 'head') { d.cell.styles.halign = cols[d.column.index].al || 'left'; return; }
          if (d.section !== 'body') return;
          var l = b.linhas[d.row.index]; if (!l) return; var k = l.k || '';
          if (k === 'H') { d.cell.styles.fillColor = [226, 232, 240]; d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = fonte - 1; d.cell.styles.textColor = COR.mut; }
          else if (k === 'R' || k === 'T') { d.cell.styles.fillColor = COR.bg; d.cell.styles.fontStyle = 'bold'; }
          else if (k === 'I') { d.cell.styles.fontStyle = 'bold'; }
          else if (k === 'S') { d.cell.styles.textColor = COR.mut; if (d.column.index === 0) d.cell.styles.cellPadding = { top: 2.2, bottom: 2.2, left: 14, right: 4 }; }
          else if (k === 'SS') { d.cell.styles.textColor = COR.mut; d.cell.styles.fontSize = fonte - 0.8; if (d.column.index === 0) d.cell.styles.cellPadding = { top: 2, bottom: 2, left: 24, right: 4 }; }
          if (l.cor && l.cor[d.column.index]) d.cell.styles.textColor = l.cor[d.column.index];
        }
      };
    }
    function alturaTabela(b, fonte, cols, largura) {
      try {
        if (!docMedida) docMedida = new J({ orientation: land ? 'l' : 'p', unit: 'pt', format: 'a4' });
        while (docMedida.getNumberOfPages() > 1) docMedida.deletePage(docMedida.getNumberOfPages());
        var cfg = estiloTabela(b, fonte, cols, largura); cfg.startY = TOPO; cfg.margin = { left: M, right: M, top: TOPO, bottom: BASE };
        docMedida.autoTable(cfg);
        var paginas = docMedida.getNumberOfPages();
        return paginas > 1 ? 1e6 : docMedida.lastAutoTable.finalY - TOPO;   // 1e6 = não cabe numa página: pode dividir
      } catch (e) { return 1e6; }
    }
    // geo (opcional): { x, w, y } desenha a tabela numa coluna específica e devolve o y final (sem mexer no cursor).
    function tabela(b, geo) {
      var fonte = b.fonte || 8, cols = b.colunas, largura = geo ? geo.w : CW, usavel = H - TOPO - BASE;
      if (!geo) {
        var h = alturaTabela(b, fonte, cols, largura), extra = (b.titulo ? 26 : 0) + 8;
        // Cabe numa página inteira? Então a tabela (com o título) fica junta: vai para a próxima página se não couber aqui.
        if (h <= usavel - extra) { if (y + h + extra > H - BASE) novaPagina(); }
        else garante(80);                                          // tabela longa: pelo menos título + cabeçalho + algumas linhas
        titulo(b.titulo);
      }
      var cfg = estiloTabela(b, fonte, cols, largura);
      cfg.startY = geo ? geo.y : y; cfg.margin = geo ? { left: geo.x, right: W - geo.x - geo.w, top: TOPO, bottom: BASE } : { left: M, right: M, top: TOPO, bottom: BASE };
      cfg.didDrawPage = function () { cabecalhoCorrida(); };
      doc.autoTable(cfg);
      var fim = doc.lastAutoTable.finalY;
      if (geo) return fim;
      y = fim + 12;
    }
    function graficos(b) {
      var itens = b.itens, cols = land && itens.length > 1 ? 2 : 1, gap = 14, cw = (CW - gap * (cols - 1)) / cols, maxH = land ? 172 : 215, primeiro = true;
      var comDados = function (it) { return it.dados && sel.opcoes.dadosGraficos !== false; };
      var cfgDados = function (it, larg) { var nc = it.dados.colunas.length; return { tipo: 'tabela', fonte: nc > 9 ? (larg < 450 ? 5.6 : 6.3) : (larg < 450 ? 6.4 : 7), colunas: it.dados.colunas.map(function (c, i) { return { h: c, al: i === 0 ? 'left' : 'right', larg: i === 0 ? 1.9 : 1 }; }), linhas: it.dados.linhas.map(function (l) { return { c: l }; }) }; };
      for (var i = 0; i < itens.length; i += cols) {
        var linha = itens.slice(i, i + cols);
        var dims = linha.map(function (it) { var w = cw, h = w / it.ratio; if (h > maxH) { h = maxH; w = h * it.ratio; } return { w: w, h: h }; });
        var altImg = Math.max.apply(null, dims.map(function (d) { return d.h; })) + 18;
        var altTab = 0;
        linha.forEach(function (it) { if (comDados(it)) { var c = cfgDados(it, cw), a = alturaTabela(c, c.fonte, c.colunas, cw); altTab = Math.max(altTab, a >= 1e6 ? 60 : a); } });
        garante(altImg + altTab + 8 + (primeiro && b.titulo ? 26 : 0));   // título + gráfico(s) + tabela(s) sempre juntos
        if (primeiro) { titulo(b.titulo); primeiro = false; }
        linha.forEach(function (it, j) {
          var x = M + j * (cw + gap), xi = x + (cw - dims[j].w) / 2;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); cor(COR.tx); txt(it.t || '', x, y + 6);
          doc.addImage(it.url, it.png ? 'PNG' : 'JPEG', xi, y + 12, dims[j].w, dims[j].h);
          cor(COR.lin, 'draw'); doc.setLineWidth(0.5); doc.rect(xi, y + 12, dims[j].w, dims[j].h);
        });
        var yTab = y + altImg, yMax = yTab;
        linha.forEach(function (it, j) { if (comDados(it)) { var f = tabela(cfgDados(it, cw), { x: M + j * (cw + gap), w: cw, y: yTab }); if (f > yMax) yMax = f; } });
        y = yMax + 12;
      }
      y += 2;
    }
    function texto(b) {
      titulo(b.titulo);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); cor(COR.tx);
      String(b.texto).split('\n').forEach(function (par) {
        if (!par.trim()) { y += 4; return; }
        doc.splitTextToSize(limpa(par), CW - 6).forEach(function (l) { garante(13); txt(l, M + 3, y); y += 12; });
        y += 3;
      });
      y += 4;
    }
    function nota(b) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); cor(COR.mut);
      doc.splitTextToSize(limpa(b.texto), CW).forEach(function (l) { garante(11); txt(l, M, y); y += 9.5; });
      y += 4; doc.setFont('helvetica', 'normal');
    }

    // Resumo do GerônIA, se pedido, vem primeiro
    if (textoIA) {
      garante(70);
      // A quebra de linhas precisa ser medida com a MESMA fonte e tamanho em que o texto será desenhado (9 pt);
      // antes era medida com a fonte anterior (menor) e as linhas passavam da margem direita, saindo cortadas.
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      var partes = doc.splitTextToSize(limpa(textoIA), CW - 24), alt = 26 + partes.length * 12 + 20;
      garante(Math.min(alt, H - TOPO - BASE));
      cor([238, 246, 255], 'fill'); cor([186, 214, 240], 'draw'); doc.setLineWidth(0.6); doc.roundedRect(M, y, CW, Math.min(alt, H - y - BASE), 6, 6, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); cor(COR.acc); txt('RESUMO EXECUTIVO - GERÔNIA', M + 12, y + 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); cor(COR.tx);
      var yy = y + 31; var restantes = partes.slice();
      while (restantes.length) {
        if (yy > H - BASE - 10) { novaPagina(); yy = y + 4; }
        txt(restantes.shift(), M + 12, yy); yy += 12;
      }
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); cor(COR.mut); txt('Texto gerado por inteligência artificial a partir dos dados da tela. Confira os números antes de decidir.', M + 12, yy + 4);
      y = yy + 26;
    }

    (dados.blocos || []).forEach(function (b) {
      if (b.opcao && sel.opcoes[b.opcao] === false) return;
      if ((b.tipo === 'kpis' || b.tipo === 'graficos') && !(b.itens && b.itens.length)) return;   // nada para mostrar: não deixa título solto
      if (b.tipo === 'tabela' && !(b.linhas && b.linhas.length)) return;
      if (b.tipo === 'kpis') kpis(b); else if (b.tipo === 'graficos') graficos(b); else if (b.tipo === 'tabela') tabela(b); else if (b.tipo === 'texto') texto(b); else if (b.tipo === 'nota') nota(b);
    });

    // Rodapé em todas as páginas
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p); cor(COR.lin, 'draw'); doc.setLineWidth(0.6); doc.line(M, H - 26, W - M, H - 26);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); cor(COR.mut);
      txt('Gerado por ' + quem + ' em ' + quando + '  -  Confidencial: uso interno do Grupo Sacoman', M, H - 15);
      txt('Página ' + p + ' de ' + n, W - M, H - 15, { align: 'right' });
    }
    doc.setProperties({ title: nome.replace(/\.pdf$/, ''), subject: CFG.titulo, author: quem, creator: 'SAFI' });
    var blob = doc.output('blob');
    doc.save(nome);
    return blob;
  }

  function iniciar(cfg) {
    CFG = cfg; injetarEstilo();
    var acc = cfg.accent || '#38bdf8';
    document.documentElement.style.setProperty('--sp-acc', acc); document.documentElement.style.setProperty('--sp-rgb', hexRgb(acc));
    colocarBotao();
  }

  window.SafiPdf = { iniciar: iniciar, imgDeCanvas: imgDeCanvas, aviso: aviso };
})();
