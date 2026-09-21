// "Sobre esta tela" do SAFI — botão no cabeçalho, guia em janela e tour guiado (spotlight).
// O conteúdo de cada tela mora em /ajuda-conteudo.js (window.SAFI_AJUDA). Este arquivo é só o motor.
//
//   SafiAjuda.attach({ prefix, key, profile })   // chamado pela SafiSidebar.apply() (e à mão em admin/geronia)
//   SafiAjuda.abrirGuia() / SafiAjuda.iniciarTour()
//
// Primeira visita do usuário à tela → o tour abre sozinho (uma única vez por usuário e navegador).
// Depois, só quando a pessoa clicar em "Sobre esta tela". Se o texto da tela for atualizado (versao),
// o botão ganha um pontinho de "novidade".
(function () {
  'use strict';
  var LS = 'safi-ajuda:';
  var ST = { ctx: null, tour: null };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function conteudo(key) { var A = window.SAFI_AJUDA; return A && A.telas && A.telas[key] || null; }
  function $(s, r) { return (r || document).querySelector(s); }

  var ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  function accent() { var a = ST.ctx && ST.ctx.accent; return (a && a.g1) || '#38bdf8'; }
  function hexRgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return isNaN(n) ? '56,189,248' : ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }

  function injectStyle() {
    if ($('#safi-ajuda-style')) return;
    var st = document.createElement('style'); st.id = 'safi-ajuda-style';
    st.textContent =
      ':root{--sa-acc:#38bdf8;--sa-rgb:56,189,248}' +
      '.sa-hdr-right{display:flex;align-items:center;gap:10px}' +
      '.sa-help-btn{position:relative;display:inline-flex;align-items:center;gap:7px;padding:7px 13px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#94a3b8;font-family:Inter,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}' +
      '.sa-help-btn:hover{background:rgba(var(--sa-rgb),0.12);border-color:rgba(var(--sa-rgb),0.35);color:var(--sa-acc)}' +
      '.sa-help-btn .sa-dot{display:none;position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:#fbbf24;border:2px solid #080b14}' +
      '.sa-help-btn.novo .sa-dot{display:block}' +
      '.sa-help-btn.sa-float{position:fixed;top:12px;right:16px;z-index:150;background:rgba(8,11,20,0.9)}' +
      '@media (max-width:768px){.sa-help-btn .sa-lbl{display:none}.sa-help-btn{padding:8px 9px}}' +
      /* guia */
      '.sa-ov{position:fixed;inset:0;z-index:9500;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)}' +
      '.sa-ov.open{display:flex}' +
      '.sa-card{width:100%;max-width:780px;max-height:88vh;overflow-y:auto;background:rgba(12,10,30,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 26px;box-shadow:0 24px 60px rgba(0,0,0,0.7);font-family:Inter,sans-serif;color:#e2e8f0;animation:saIn .22s ease}' +
      '@keyframes saIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}' +
      '.sa-title{font-size:18px;font-weight:800;color:#f8fafc;margin-bottom:4px}' +
      '.sa-sub{font-size:12.5px;color:#64748b;margin-bottom:18px}' +
      '.sa-intro{background:rgba(var(--sa-rgb),0.07);border:1px solid rgba(var(--sa-rgb),0.22);border-radius:10px;padding:13px 16px;margin-bottom:18px;font-size:12.5px;color:#cbd5e1;line-height:1.55}' +
      '.sa-intro b{color:var(--sa-acc)}' +
      '.sa-sec{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sa-acc);margin-bottom:12px}' +
      '.sa-steps{display:grid;grid-template-columns:1fr 1fr;gap:16px 20px;margin-bottom:22px}' +
      '.sa-step{display:flex;gap:11px}' +
      '.sa-num{flex-shrink:0;width:25px;height:25px;border-radius:50%;background:var(--sa-acc);color:#06121f;font-weight:800;font-size:12.5px;display:flex;align-items:center;justify-content:center}' +
      '.sa-st-t{font-size:12.5px;font-weight:700;color:#f1f5f9;margin-bottom:4px}' +
      '.sa-st-d{font-size:11.5px;color:#94a3b8;line-height:1.5}' +
      '.sa-st-d b,.sa-li b{color:#e2e8f0}' +
      '.sa-two{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:6px}' +
      '.sa-box-t{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--sa-acc);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(var(--sa-rgb),0.2)}' +
      'ul.sa-ul{list-style:none;margin:0;padding:0}' +
      'ul.sa-ul li{font-size:11.5px;color:#94a3b8;margin-bottom:10px;padding-left:16px;position:relative;line-height:1.5}' +
      'ul.sa-ul li::before{content:"●";color:var(--sa-acc);position:absolute;left:0;font-size:8px;top:5px}' +
      '.sa-terms{margin-top:14px}' +
      '.sa-term{font-size:11.5px;color:#94a3b8;line-height:1.5;margin-bottom:8px}' +
      '.sa-term b{color:#e2e8f0}' +
      '.sa-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07);font-size:11.5px;color:#94a3b8;line-height:1.5}' +
      '.sa-meta b{color:#e2e8f0}' +
      '.sa-warn{background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:10px;padding:12px 15px;margin-top:14px;font-size:11.5px;color:#fde68a;line-height:1.5}' +
      '.sa-warn b{color:#fbbf24}' +
      '.sa-actions{display:flex;gap:10px;margin-top:22px}' +
      '.sa-btn{padding:12px 18px;border-radius:12px;font-family:Inter,sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#94a3b8}' +
      '.sa-btn:hover{background:rgba(255,255,255,0.09);color:#f1f5f9}' +
      '.sa-btn.pri{flex:1;background:linear-gradient(135deg,rgba(var(--sa-rgb),1),rgba(var(--sa-rgb),0.7));border:none;color:#06121f}' +
      '.sa-btn.pri:hover{filter:brightness(1.08);color:#06121f}' +
      '.sa-ver{font-size:10px;color:#475569;margin-top:12px;text-align:right}' +
      '@media (max-width:700px){.sa-steps,.sa-two{grid-template-columns:1fr}.sa-card{padding:22px 18px}}' +
      /* tour */
      '.sa-tour{position:fixed;inset:0;z-index:10000;background:rgba(4,8,20,0.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);transition:clip-path .38s cubic-bezier(.4,0,.2,1),-webkit-clip-path .38s cubic-bezier(.4,0,.2,1)}' +
      '.sa-ring{position:fixed;z-index:10001;border:2px solid var(--sa-acc);border-radius:12px;box-shadow:0 0 0 4px rgba(var(--sa-rgb),0.18),0 0 32px rgba(var(--sa-rgb),0.35);pointer-events:auto;transition:top .38s cubic-bezier(.4,0,.2,1),left .38s cubic-bezier(.4,0,.2,1),width .38s cubic-bezier(.4,0,.2,1),height .38s cubic-bezier(.4,0,.2,1),opacity .2s}' +
      '.sa-tip{position:fixed;z-index:10002;width:340px;max-width:calc(100vw - 24px);background:rgba(12,14,34,0.99);border:1px solid rgba(var(--sa-rgb),0.35);border-radius:16px;padding:18px 18px 14px;box-shadow:0 20px 50px rgba(0,0,0,0.65);font-family:Inter,sans-serif;transition:top .38s cubic-bezier(.4,0,.2,1),left .38s cubic-bezier(.4,0,.2,1),opacity .2s}' +
      '.sa-tip-t{font-size:14px;font-weight:800;color:#f8fafc;margin-bottom:6px}' +
      '.sa-tip-d{font-size:12.5px;color:#a8b4c6;line-height:1.55}' +
      '.sa-tip-d b{color:#e2e8f0}' +
      '.sa-tip-f{display:flex;align-items:center;gap:8px;margin-top:14px}' +
      '.sa-tip-f .sp{flex:1}' +
      '.sa-skip{background:transparent;border:none;color:#64748b;font-family:Inter,sans-serif;font-size:12px;font-weight:600;cursor:pointer;padding:6px 4px}' +
      '.sa-skip:hover{color:#cbd5e1}' +
      '.sa-nav{padding:8px 13px;border-radius:9px;font-family:Inter,sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#cbd5e1}' +
      '.sa-nav:hover{background:rgba(255,255,255,0.1)}' +
      '.sa-nav.pri{background:var(--sa-acc);border-color:transparent;color:#06121f}' +
      '.sa-nav.pri:hover{filter:brightness(1.1)}' +
      '@media (prefers-reduced-motion:reduce){.sa-tour,.sa-ring,.sa-tip{transition:none}.sa-card{animation:none}}';
    document.head.appendChild(st);
  }

  // ── Botão no cabeçalho ───────────────────────────────────────────────────
  function injectButton() {
    var old = $('#sa-help-btn'); if (old) return old;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'sa-help-btn'; btn.className = 'sa-help-btn';
    btn.setAttribute('aria-label', 'Sobre esta tela');
    btn.innerHTML = ICON + '<span class="sa-lbl">Sobre esta tela</span><i class="sa-dot"></i>';
    btn.addEventListener('click', abrirGuia);
    var hdr = $('header.header') || $('.header');
    var dcNav = $('#dc-nav-right');
    if (hdr) {
      var wrap = $('.sa-hdr-right', hdr);
      if (!wrap) {
        wrap = document.createElement('div'); wrap.className = 'sa-hdr-right';
        var last = hdr.lastElementChild;
        // Leva junto o bloco da direita já existente (status, atalhos, "voltar"), se estiver visível.
        if (last && !last.classList.contains('header-brand') && !last.classList.contains('header-left') && last.offsetParent !== null) wrap.appendChild(last);
        hdr.appendChild(wrap);
      }
      wrap.insertBefore(btn, wrap.firstChild);
    } else if (dcNav) {
      dcNav.parentNode.insertBefore(btn, dcNav); btn.style.marginLeft = 'auto'; btn.style.marginRight = '12px';
    } else {
      btn.classList.add('sa-float'); document.body.appendChild(btn);
    }
    return btn;
  }

  // ── Guia (janela "Sobre esta tela") ──────────────────────────────────────
  function guiaHtml(c) {
    var h = '<div class="sa-title">' + esc(c.titulo) + ' — Sobre esta tela</div><div class="sa-sub">Guia rápido de uso.</div>';
    if (c.resumo) h += '<div class="sa-intro">' + c.resumo + '</div>';
    if (c.passos && c.passos.length) {
      h += '<div class="sa-sec">Como usar</div><div class="sa-steps">' + c.passos.map(function (p, i) {
        return '<div class="sa-step"><div class="sa-num">' + (i + 1) + '</div><div><div class="sa-st-t">' + p.t + '</div><div class="sa-st-d">' + p.d + '</div></div></div>';
      }).join('') + '</div>';
    }
    var dicas = c.dicas && c.dicas.length, nao = c.naoFaz && c.naoFaz.length;
    if (dicas || nao) {
      h += '<div class="sa-two"><div>' + (dicas ? '<div class="sa-box-t">Dicas importantes</div><ul class="sa-ul">' + c.dicas.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
        '<div>' + (nao ? '<div class="sa-box-t">O que esta tela NÃO faz</div><ul class="sa-ul">' + c.naoFaz.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '') + '</div></div>';
    }
    if (c.termos && c.termos.length) h += '<div class="sa-terms"><div class="sa-box-t">Termos desta tela</div>' + c.termos.map(function (t) { return '<div class="sa-term"><b>' + t.t + ':</b> ' + t.d + '</div>'; }).join('') + '</div>';
    if (c.quemVe || c.dados) h += '<div class="sa-meta">' + (c.quemVe ? '<div><b>Quem vê:</b> ' + c.quemVe + '</div>' : '') + (c.dados ? '<div><b>De onde vêm os dados:</b> ' + c.dados + '</div>' : '') + '</div>';
    h += '<div class="sa-warn"><b>Dúvidas ou algo não bateu?</b> Chama o Douglas — ou pergunte ao GerônIA, que conhece todas as telas do SAFI.' + (c.aviso ? '<br>' + c.aviso : '') + '</div>';
    h += '<div class="sa-actions">' + (tourSteps(ST.ctx.key).length ? '<button type="button" class="sa-btn pri" id="sa-go-tour">▶ Ver tour guiado desta tela</button>' : '') + '<button type="button" class="sa-btn" id="sa-close">Fechar</button></div>';
    h += '<div class="sa-ver">Guia v' + esc(c.versao) + '</div>';
    return h;
  }
  function abrirGuia() {
    if (!ST.ctx) return;
    var c = conteudo(ST.ctx.key); if (!c) return;
    setAccent();
    var ov = $('#sa-guia');
    if (!ov) { ov = document.createElement('div'); ov.id = 'sa-guia'; ov.className = 'sa-ov'; ov.addEventListener('mousedown', function (e) { if (e.target === ov) fecharGuia(); }); document.body.appendChild(ov); }
    ov.innerHTML = '<div class="sa-card" role="dialog" aria-modal="true">' + guiaHtml(c) + '</div>';
    ov.classList.add('open');
    $('#sa-close', ov).addEventListener('click', fecharGuia);
    var t = $('#sa-go-tour', ov); if (t) t.addEventListener('click', function () { fecharGuia(); iniciarTour(); });
    marcarVisto();
  }
  function fecharGuia() { var ov = $('#sa-guia'); if (ov) ov.classList.remove('open'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ST.tour) fecharGuia(); });

  function setAccent() { var a = accent(); document.documentElement.style.setProperty('--sa-acc', a); document.documentElement.style.setProperty('--sa-rgb', hexRgb(a)); }
  function vistoKey() { return LS + ((ST.ctx.profile && ST.ctx.profile.id) || 'anon') + ':' + ST.ctx.key; }
  function marcarVisto() {
    var c = conteudo(ST.ctx.key); lsSet(vistoKey(), String(c.versao));
    var b = $('#sa-help-btn'); if (b) b.classList.remove('novo');
  }

  // ── Tour guiado ──────────────────────────────────────────────────────────
  function visivel(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function achar(sel) {
    var l; try { l = document.querySelectorAll(sel); } catch (e) { return null; }
    for (var i = 0; i < l.length; i++) if (visivel(l[i])) return l[i];
    return null;
  }
  function tourSteps(key) {
    var c = conteudo(key); if (!c) return [];
    var p = ST.ctx.prefix;
    var passos = (c.tour || []).slice();
    // Passos finais comuns a todas as telas.
    if (p && $('#' + p + '-sidebar .sb-sec')) passos.push({ sel: '#' + p + '-sidebar', sidebar: true, t: 'Menu de navegação', d: 'As telas ficam agrupadas por <b>setor</b> (Financeiro, Contábil, Compras…). Você só enxerga o que o seu acesso libera. Os grupos recolhem e expandem com um clique.' });
    passos.push({ sel: '#sa-help-btn', t: 'Sobre esta tela', d: 'Precisou rever? Clique aqui a qualquer momento para abrir o guia e refazer este tour.' });
    return passos;
  }

  function roundedHole(l, t, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    var R = l + w, B = t + h;
    return 'path(evenodd, "M0 0H' + innerWidth + 'V' + innerHeight + 'H0Z M' + (l + r) + ' ' + t + 'H' + (R - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + R + ' ' + (t + r) + 'V' + (B - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (R - r) + ' ' + B + 'H' + (l + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + l + ' ' + (B - r) + 'V' + (t + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (l + r) + ' ' + t + 'Z")';
  }

  function iniciarTour() {
    if (!ST.ctx || ST.tour) return;
    fecharGuia();
    var todos = tourSteps(ST.ctx.key).filter(function (s) { return s.clicar || achar(s.sel); });
    if (!todos.length) return;
    setAccent();
    var tour = ST.tour = { steps: todos, i: 0, els: {} };
    var ov = tour.ov = document.createElement('div'); ov.className = 'sa-tour';
    var ring = tour.ring = document.createElement('div'); ring.className = 'sa-ring';
    var tip = tour.tip = document.createElement('div'); tip.className = 'sa-tip'; tip.setAttribute('role', 'dialog');
    document.body.appendChild(ov); document.body.appendChild(ring); document.body.appendChild(tip);
    ov.addEventListener('click', function (e) { e.stopPropagation(); });
    tour.onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); fimTour(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
    };
    tour.onMove = function () { if (tour.raf) return; tour.raf = requestAnimationFrame(function () { tour.raf = 0; posicionar(true); }); };
    document.addEventListener('keydown', tour.onKey, true);
    window.addEventListener('resize', tour.onMove);
    window.addEventListener('scroll', tour.onMove, true);
    marcarVisto();
    mostrar(0);
  }

  function sidebarEls() { var p = ST.ctx.prefix; return [$('#' + p + '-sidebar'), $('#' + p + '-sidebar-backdrop')]; }
  function abrirSidebar(on) { sidebarEls().forEach(function (e) { if (e) e.classList[on ? 'add' : 'remove']('open'); }); }

  function mostrar(i, dir) {
    var tour = ST.tour; if (!tour) return;
    var s = tour.steps[i];
    abrirSidebar(!!s.sidebar);
    var go = function () {
      var el = achar(s.sel);
      if (!el) { // alvo sumiu (ex.: dados ainda carregando): pula na direção em que a pessoa está indo
        var prox = i + (dir || 1);
        if (prox < 0 || prox >= tour.steps.length) { if (dir === -1) return mostrar(i + 1, 1); return fimTour(); }
        return mostrar(prox, dir);
      }
      tour.i = i; tour.el = el; tour.step = s;
      if (!s.sidebar) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      render();
      setTimeout(function () { posicionar(false); }, s.sidebar ? 340 : 60);
    };
    if (s.clicar) { var b = $(s.clicar); if (b) b.click(); if (s.voltar) tour.voltar = s.voltar; setTimeout(go, 200); }
    else setTimeout(go, s.sidebar ? 20 : 0);
  }

  function render() {
    var tour = ST.tour, s = tour.step, n = tour.steps.length, ult = tour.i === n - 1;
    tour.tip.innerHTML = '<div class="sa-tip-t">' + s.t + '</div><div class="sa-tip-d">' + s.d + '</div>' +
      '<div class="sa-tip-f"><button type="button" class="sa-skip" id="sa-skip">' + (ult ? '' : 'Pular tour') + '</button><span class="sp"></span>' +
      (tour.i > 0 ? '<button type="button" class="sa-nav" id="sa-prev">‹ Anterior</button>' : '') +
      '<button type="button" class="sa-nav pri" id="sa-next">' + (ult ? 'Concluir' : 'Próximo ' + (tour.i + 1) + '/' + n) + '</button></div>';
    var sk = $('#sa-skip', tour.tip); if (sk) sk.addEventListener('click', fimTour);
    var pv = $('#sa-prev', tour.tip); if (pv) pv.addEventListener('click', function () { ir(-1); });
    $('#sa-next', tour.tip).addEventListener('click', function () { ir(1); });
    $('#sa-next', tour.tip).focus({ preventScroll: true });
  }

  function ir(d) {
    var tour = ST.tour; if (!tour) return;
    var j = tour.i + d;
    if (j >= tour.steps.length) return fimTour();
    if (j < 0) return;
    mostrar(j, d);
  }

  function posicionar(instant) {
    var tour = ST.tour; if (!tour || !tour.el) return;
    var r = tour.el.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
    var l = Math.max(4, r.left - pad), t = Math.max(4, r.top - pad);
    var w = Math.min(vw - 8 - l, r.width + pad * 2), h = Math.min(vh - 8 - t, r.height + pad * 2);
    var ring = tour.ring, ov = tour.ov, tip = tour.tip;
    if (instant) { ring.style.transition = ov.style.transition = tip.style.transition = 'none'; }
    ring.style.left = l + 'px'; ring.style.top = t + 'px'; ring.style.width = w + 'px'; ring.style.height = h + 'px';
    var cp = roundedHole(l, t, w, h, 12);
    ov.style.clipPath = cp; ov.style.webkitClipPath = cp;
    // Balão: abaixo do alvo, senão acima, senão no canto inferior.
    var tw = Math.min(340, vw - 24), th = tip.offsetHeight || 170, gap = 14, tl, tt;
    tl = Math.min(Math.max(12, l + w / 2 - tw / 2), vw - tw - 12);
    if (t + h + gap + th <= vh - 8) tt = t + h + gap;
    else if (t - gap - th >= 8) tt = t - gap - th;
    else if (l + w + gap + tw <= vw - 8) { tl = l + w + gap; tt = Math.min(Math.max(12, t), vh - th - 12); }
    else if (l - gap - tw >= 8) { tl = l - gap - tw; tt = Math.min(Math.max(12, t), vh - th - 12); }
    else tt = vh - th - 12;
    tip.style.left = tl + 'px'; tip.style.top = Math.max(8, tt) + 'px';
    if (instant) { void ring.offsetWidth; ring.style.transition = ov.style.transition = tip.style.transition = ''; }
  }

  function fimTour() {
    var tour = ST.tour; if (!tour) return;
    document.removeEventListener('keydown', tour.onKey, true);
    window.removeEventListener('resize', tour.onMove);
    window.removeEventListener('scroll', tour.onMove, true);
    abrirSidebar(false);
    if (tour.voltar) { var vb = $(tour.voltar); if (vb) vb.click(); }
    [tour.ov, tour.ring, tour.tip].forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); });
    ST.tour = null;
    var b = $('#sa-help-btn'); if (b) b.focus({ preventScroll: true });
  }

  // Abre o tour sozinho na primeira visita: espera a tela terminar de carregar (alvos visíveis, sem janela aberta).
  function agendarAuto() {
    var tentativas = 0;
    (function tenta() {
      if (ST.tour) return;
      tentativas++;
      var ocupada = $('.modal-overlay.open, .sa-ov.open, #perm-overlay');
      var perm = $('#perm-overlay'); if (perm && getComputedStyle(perm).display === 'none') ocupada = $('.modal-overlay.open, .sa-ov.open');
      var passos = tourSteps(ST.ctx.key).filter(function (s) { return !s.sidebar && !s.clicar && s.sel !== '#sa-help-btn'; });
      var pronto = passos.length && achar(passos[0].sel);
      if (pronto && !ocupada) return setTimeout(function () { if (!ST.tour) iniciarTour(); }, 500);
      if (tentativas < 24) setTimeout(tenta, 500);
    })();
  }

  function attach(o) {
    if (!o || !conteudo(o.key)) return;
    if (ST.ctx && ST.ctx.key === o.key && $('#sa-help-btn')) { ST.ctx.profile = o.profile || ST.ctx.profile; return; }
    ST.ctx = { prefix: o.prefix, key: o.key, profile: o.profile || {}, accent: o.accent || {} };
    injectStyle(); setAccent(); injectButton();
    var c = conteudo(o.key), visto = lsGet(vistoKey());
    if (visto === null) agendarAuto();
    else if (visto !== String(c.versao)) { var b = $('#sa-help-btn'); if (b) b.classList.add('novo'); }
  }

  // ── Manual em texto puro (o GerônIA lê isto). A página Admin sincroniza com a tabela ajuda_manual. ──
  var ROTAS = {
    home: ['/', 'Visão Geral'], geronia: ['/geronia', 'Visão Geral'], conselho: ['/conselho', 'Conselho'], reunioes: ['/reunioes', 'Conselho'],
    dre: ['/dre', 'Financeiro'], lancamentos: ['/lancamentos', 'Financeiro (submenu do DRE)'], orcamento: ['/orcamento', 'Financeiro'],
    fluxocaixa: ['/fluxo-caixa', 'Financeiro'], despfixas: ['/despesas-fixas', 'Financeiro'], resumo: ['/resumocontabil', 'Contábil'],
    fechamento: ['/fechamento', 'Contábil'], pedidos: ['/pedidos', 'Compras'], conciliacao: ['/conciliacao', 'Compras'],
    produtos: ['/produtos', 'Compras'], calcimport: ['/calculadora-importacao', 'Compras'], funcionarios: ['/funcionarios', 'Pessoal'],
    mapasoc: ['/mapa-societario', 'Gestão'], admin: ['/admin', 'Gestão']
  };
  function plano(h) { return String(h == null ? '' : h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h >>> 0); }
  function manualTexto() {
    var A = window.SAFI_AJUDA; if (!A) return [];
    return Object.keys(A.telas).map(function (k) {
      var c = A.telas[k], r = ROTAS[k] || ['', ''];
      var t = 'TELA: ' + c.titulo + ' (rota ' + r[0] + ', setor ' + r[1] + ')\nPara que serve: ' + plano(c.resumo);
      if (c.passos && c.passos.length) t += '\nComo usar: ' + c.passos.map(function (p, i) { return (i + 1) + ') ' + plano(p.t) + ' — ' + plano(p.d); }).join(' ');
      if (c.dicas && c.dicas.length) t += '\nDicas: ' + c.dicas.map(plano).join(' | ');
      if (c.naoFaz && c.naoFaz.length) t += '\nO que NÃO faz: ' + c.naoFaz.map(plano).join(' | ');
      if (c.termos && c.termos.length) t += '\nTermos: ' + c.termos.map(function (x) { return plano(x.t) + ' = ' + plano(x.d); }).join(' | ');
      if (c.quemVe) t += '\nQuem vê: ' + plano(c.quemVe);
      if (c.dados) t += '\nDe onde vêm os dados: ' + plano(c.dados);
      return { chave: k, titulo: c.titulo, texto: t, versao: String(c.versao), hash: hash(t) };
    });
  }

  // Mantém a tabela ajuda_manual igual ao ajuda-conteudo.js (só o admin consegue gravar; grava apenas o que mudou).
  var sincronizando = false;
  function sincronizarManual(sb) {
    if (sincronizando || !sb || !window.SAFI_AJUDA) return;
    sincronizando = true;
    var novo = manualTexto();
    sb.from('ajuda_manual').select('chave,hash').then(function (r) {
      if (r.error) return;
      var atual = r.data || [], h = {}; atual.forEach(function (x) { h[x.chave] = x.hash; });
      var mudou = novo.filter(function (m) { return h[m.chave] !== m.hash; }).map(function (m) { m.atualizado_em = new Date().toISOString(); return m; });
      var sumiu = atual.filter(function (x) { return !novo.some(function (m) { return m.chave === x.chave; }); }).map(function (x) { return x.chave; });
      if (mudou.length) sb.from('ajuda_manual').upsert(mudou, { onConflict: 'chave' }).then(function () {});
      if (sumiu.length) sb.from('ajuda_manual').delete().in('chave', sumiu).then(function () {});
    }).catch(function () {});
  }

  window.SafiAjuda = { attach: attach, abrirGuia: abrirGuia, iniciarTour: iniciarTour, manualTexto: manualTexto, sincronizarManual: sincronizarManual };
})();
