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
  // Gráfico da tela → imagem para o PDF (fundo escuro, para manter as cores e o texto claro do gráfico legíveis no papel).
  function imgDeCanvas(canvas, largura) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    // Garante que o gráfico está no estado final (sem animação em andamento) antes de copiar.
    try { var gr = window.Chart && window.Chart.getChart && window.Chart.getChart(canvas); if (gr) { gr.stop(); gr.update('none'); } } catch (e) {}
    var pad = 14, c = document.createElement('canvas');
    c.width = canvas.width + pad * 2; c.height = canvas.height + pad * 2;
    var x = c.getContext('2d'); x.fillStyle = '#0f172a'; x.fillRect(0, 0, c.width, c.height); x.drawImage(canvas, pad, pad);
    return { url: c.toDataURL('image/jpeg', 0.92), ratio: c.width / c.height };
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
        '<div class="sp-ops">' + CFG.opcoes.map(function (o) {
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

    status('Registrando…');
    registrar({ tela: CFG.chave, tela_titulo: CFG.titulo, filtros: filtros.map(function (f) { return f[0] + ': ' + f[1]; }).join(' | '), orientacao: orient,
      secoes: CFG.opcoes.filter(function (o) { return sel.opcoes[o.id]; }).map(function (o) { return o.label; }), com_ia: comIA, finalidade: fin, arquivo: nome })
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
    function graficos(b) {
      titulo(b.titulo);
      var n = b.itens.length, cols = land && n > 1 ? 2 : 1, gap = 12, cw = (CW - gap * (cols - 1)) / cols, maxH = land ? 215 : 235;
      for (var i = 0; i < n; i += cols) {
        var linha = b.itens.slice(i, i + cols), alt = 0;
        var dims = linha.map(function (it) { var w = it.ratio < 1.5 ? cw * 0.5 : cw, h = w / it.ratio; if (h > maxH) { h = maxH; w = h * it.ratio; } if (h + 16 > alt) alt = h + 16; return { w: w, h: h }; });
        garante(alt + 6);
        linha.forEach(function (it, j) {
          var x = M + j * (cw + gap);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); cor(COR.mut); txt(it.t || '', x, y + 8);
          doc.addImage(it.url, 'JPEG', x, y + 12, dims[j].w, dims[j].h);
        });
        y += alt + 8;
      }
      y += 2;
    }
    function tabela(b) {
      titulo(b.titulo);
      var fonte = b.fonte || 8, cols = b.colunas;
      var total = cols.reduce(function (a, c) { return a + (c.larg || 1); }, 0);
      var estilos = {};
      cols.forEach(function (c, i) { estilos[i] = { halign: c.al || 'left', cellWidth: CW * (c.larg || 1) / total }; });
      doc.autoTable({
        head: [cols.map(function (c) { return limpa(c.h); })],
        body: b.linhas.map(function (l) { return l.c.map(limpa); }),
        startY: y, margin: { left: M, right: M, top: TOPO, bottom: BASE }, tableWidth: CW,
        styles: { font: 'helvetica', fontSize: fonte, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, lineColor: COR.lin, lineWidth: 0.3, textColor: COR.tx, overflow: 'linebreak' },
        headStyles: { fillColor: COR.navy, textColor: 255, fontStyle: 'bold', fontSize: fonte - 0.5 },
        columnStyles: estilos, theme: 'plain',
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
        },
        didDrawPage: function () { cabecalhoCorrida(); }
      });
      y = doc.lastAutoTable.finalY + 12;
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
