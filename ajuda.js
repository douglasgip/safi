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
      '.sa-ov{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s ease,visibility 0s linear .25s}' +
      '.sa-ov.open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .25s ease,visibility 0s}' +
      '.sa-ov .sa-card{transform:translateY(10px) scale(.98);transition:transform .28s cubic-bezier(.16,1,.3,1)}' +
      '.sa-ov.open .sa-card{transform:none}' +
      '.sa-card{width:100%;max-width:780px;max-height:88vh;overflow-y:auto;background:rgba(12,10,30,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 26px;box-shadow:0 24px 60px rgba(0,0,0,0.7);font-family:Inter,sans-serif;color:#e2e8f0;}' +
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
      '.sa-tour{position:fixed;inset:0;z-index:10000;background:rgba(4,8,20,0.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);transition:clip-path .38s cubic-bezier(.4,0,.2,1),-webkit-clip-path .38s cubic-bezier(.4,0,.2,1),opacity .35s ease}' +
      '.sa-ring{position:fixed;z-index:10001;border:2px solid var(--sa-acc);border-radius:12px;box-shadow:0 0 0 4px rgba(var(--sa-rgb),0.18),0 0 32px rgba(var(--sa-rgb),0.35);pointer-events:auto;transition:top .38s cubic-bezier(.4,0,.2,1),left .38s cubic-bezier(.4,0,.2,1),width .38s cubic-bezier(.4,0,.2,1),height .38s cubic-bezier(.4,0,.2,1),opacity .35s ease}' +
      '.sa-tip{position:fixed;z-index:10002;width:340px;max-width:calc(100vw - 24px);background:rgba(12,14,34,0.99);border:1px solid rgba(var(--sa-rgb),0.35);border-radius:16px;padding:18px 18px 14px;box-shadow:0 20px 50px rgba(0,0,0,0.65);font-family:Inter,sans-serif;transition:opacity .25s ease}' +
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
      '@media (prefers-reduced-motion:reduce){.sa-tour,.sa-ring,.sa-tip,.sa-ov,.sa-ov .sa-card{transition:none}}';
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
    void ov.offsetWidth; // garante o ponto de partida da transição
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
    var c = conteudo(ST.ctx.key), v = String(c.versao);
    if (lsGet(vistoKey()) !== v) { lsSet(vistoKey(), v); remotoGravar(v); }
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

  // Rolagem suave própria (a página desliza e o foco desliza junto; nada "pula").
  function scrollerDe(el) {
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p;
    }
    return document.scrollingElement || document.documentElement;
  }
  function fixoOuCabecalho(el) {
    if (el.closest('header, .header, #dc-nav-right')) return true;
    for (var p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true;
    return false;
  }
  function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rolar(sc, para, ms, fim) {
    var de = sc.scrollTop, dist = para - de, t0 = null, feito = false;
    function acabar() { if (feito) return; feito = true; sc.scrollTop = para; fim(); }
    if (Math.abs(dist) < 2) return fim();
    setTimeout(acabar, ms + 250); // rede de segurança (aba em segundo plano não anima)
    (function passo(ts) {
      if (feito) return;
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms);
      sc.scrollTop = de + dist * suave(k);
      if (k < 1) requestAnimationFrame(passo); else acabar();
    })(performance.now());
  }
  function planejarRolagem(el) {
    if (fixoOuCabecalho(el)) return { sc: null, para: 0, delta: 0 };
    var sc = scrollerDe(el), r = el.getBoundingClientRect(), vh = innerHeight, topo = 76, base = 20, util = vh - topo - base;
    var ok = r.top >= topo - 4 && r.bottom <= vh - base + 4;
    var desejado = r.height <= util ? sc.scrollTop + (r.top + r.height / 2 - (topo + util / 2)) : sc.scrollTop + (r.top - topo);
    var max = sc.scrollHeight - sc.clientHeight;
    var para = ok ? sc.scrollTop : Math.max(0, Math.min(max, desejado));
    return { sc: sc, para: para, delta: para - sc.scrollTop };
  }
  // Retângulo do alvo já com a rolagem concluída (o foco vai direto para o lugar final).
  function retanguloFinal(el, s, delta) {
    if (s.sidebar) return { left: 0, top: 0, width: el.offsetWidth, height: el.offsetHeight };
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top - delta, width: r.width, height: r.height };
  }

  function semTransicao(lista, fn) {
    lista.forEach(function (e) { e.style.transition = 'none'; });
    fn(); void lista[0].offsetWidth;
    lista.forEach(function (e) { e.style.transition = ''; });
  }
  function aplicarAnel(rect, instantaneo) {
    var tour = ST.tour, pad = 6, vw = innerWidth, vh = innerHeight;
    var l = Math.max(4, rect.left - pad), t = Math.max(4, rect.top - pad);
    var w = Math.max(8, Math.min(vw - 8 - l, rect.width + pad * 2)), h = Math.max(8, Math.min(vh - 8 - t, rect.height + pad * 2));
    tour.caixa = { l: l, t: t, w: w, h: h };
    var poe = function () {
      tour.ring.style.left = l + 'px'; tour.ring.style.top = t + 'px'; tour.ring.style.width = w + 'px'; tour.ring.style.height = h + 'px';
      var cp = roundedHole(l, t, w, h, 12); tour.ov.style.clipPath = cp; tour.ov.style.webkitClipPath = cp;
    };
    if (instantaneo) semTransicao([tour.ring, tour.ov], poe); else poe();
  }
  // Balão: abaixo do alvo, senão acima, senão ao lado, senão no canto.
  function colocarTip(instantaneo) {
    var tour = ST.tour, b = tour.caixa, tip = tour.tip, vw = innerWidth, vh = innerHeight;
    var tw = Math.min(340, vw - 24), th = tip.offsetHeight || 170, gap = 14, tl, tt;
    tl = Math.min(Math.max(12, b.l + b.w / 2 - tw / 2), vw - tw - 12);
    if (b.t + b.h + gap + th <= vh - 8) tt = b.t + b.h + gap;
    else if (b.t - gap - th >= 8) tt = b.t - gap - th;
    else if (b.l + b.w + gap + tw <= vw - 8) { tl = b.l + b.w + gap; tt = Math.min(Math.max(12, b.t), vh - th - 12); }
    else if (b.l - gap - tw >= 8) { tl = b.l - gap - tw; tt = Math.min(Math.max(12, b.t), vh - th - 12); }
    else tt = vh - th - 12;
    var poe = function () { tip.style.left = tl + 'px'; tip.style.top = Math.max(8, tt) + 'px'; };
    if (instantaneo) semTransicao([tip], poe); else poe();
  }

  function iniciarTour() {
    if (!ST.ctx || ST.tour) return;
    fecharGuia();
    var todos = tourSteps(ST.ctx.key).filter(function (s) { return s.clicar || achar(s.sel); });
    if (!todos.length) return;
    setAccent();
    var tour = ST.tour = { steps: todos, i: 0, gen: 0, caixa: { l: 0, t: 0, w: 0, h: 0 } };
    var ov = tour.ov = document.createElement('div'); ov.className = 'sa-tour'; ov.style.opacity = '0';
    var ring = tour.ring = document.createElement('div'); ring.className = 'sa-ring'; ring.style.opacity = '0';
    var tip = tour.tip = document.createElement('div'); tip.className = 'sa-tip'; tip.setAttribute('role', 'dialog'); tip.style.opacity = '0';
    document.body.appendChild(ov); document.body.appendChild(ring); document.body.appendChild(tip);
    ov.addEventListener('click', function (e) { e.stopPropagation(); });
    tour.onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); fimTour(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
    };
    // Rolagem/redimensionamento feitos pela própria pessoa: o foco acompanha na hora.
    tour.onMove = function () { if (tour.raf || tour.rolando) return; tour.raf = requestAnimationFrame(function () { tour.raf = 0; reposicionar(); }); };
    document.addEventListener('keydown', tour.onKey, true);
    window.addEventListener('resize', tour.onMove);
    window.addEventListener('scroll', tour.onMove, true);
    marcarVisto();
    mostrar(0, 1, true);
  }

  function sidebarEls() { var p = ST.ctx.prefix; return [$('#' + p + '-sidebar'), $('#' + p + '-sidebar-backdrop')]; }
  function abrirSidebar(on) { sidebarEls().forEach(function (e) { if (e) e.classList[on ? 'add' : 'remove']('open'); }); }

  function reposicionar() {
    var tour = ST.tour; if (!tour || !tour.el) return;
    if (!document.body.contains(tour.el)) { var novo = achar(tour.step.sel); if (!novo) return; tour.el = novo; }
    aplicarAnel(retanguloFinal(tour.el, tour.step, 0), true);
    colocarTip(true);
  }

  // Mostra o passo i. `primeiro` = abertura do tour; passos que trocam de aba "esmaecem" em vez de deslizar.
  function mostrar(i, dir, primeiro) {
    var tour = ST.tour; if (!tour) return;
    var s = tour.steps[i], gen = ++tour.gen, corte = !!s.clicar && !primeiro;
    tour.tip.style.opacity = '0';                       // o texto antigo sai antes de o novo entrar
    if (corte) tour.ring.style.opacity = '0';
    abrirSidebar(!!s.sidebar);
    if (s.clicar) { var b = $(s.clicar); if (b) b.click(); if (s.voltar) tour.voltar = s.voltar; }
    setTimeout(function () {
      if (!ST.tour || tour.gen !== gen) return;
      var el = achar(s.sel);
      if (!el) { // alvo indisponível (ex.: dados ainda carregando): segue na direção em que a pessoa está indo
        var prox = i + (dir || 1);
        if (prox < 0 || prox >= tour.steps.length) { if (dir === -1) return mostrar(i + 1, 1, primeiro); return fimTour(); }
        return mostrar(prox, dir, primeiro);
      }
      tour.i = i; tour.el = el; tour.step = s;
      var plano = s.sidebar ? { sc: null, para: 0, delta: 0 } : planejarRolagem(el);
      var rf = retanguloFinal(el, s, plano.delta);
      var instantaneo = !!primeiro || corte;             // sem ponto de partida visível → aparece no lugar, com fade
      tour.rolando = !!(plano.sc && plano.delta);
      aplicarAnel(rf, instantaneo);
      // Foco e rolagem viajam juntos (mesma duração e curva); ao fim, um ajuste fino sem movimento perceptível.
      if (tour.rolando) rolar(plano.sc, plano.para, 380, function () { tour.rolando = false; if (ST.tour && tour.gen === gen) reposicionar(); });
      requestAnimationFrame(function () { tour.ov.style.opacity = '1'; tour.ring.style.opacity = '1'; });
      // Texto novo entra (já no lugar final) depois que o antigo saiu.
      setTimeout(function () {
        if (!ST.tour || tour.gen !== gen) return;
        render(); colocarTip(true);
        requestAnimationFrame(function () { tour.tip.style.opacity = '1'; });
      }, primeiro ? 120 : 170);
    }, s.clicar && !primeiro ? 220 : 0);
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
    mostrar(j, d, false);
  }

  function fimTour() {
    var tour = ST.tour; if (!tour) return;
    ST.tour = null; tour.gen++;
    document.removeEventListener('keydown', tour.onKey, true);
    window.removeEventListener('resize', tour.onMove);
    window.removeEventListener('scroll', tour.onMove, true);
    abrirSidebar(false);
    if (tour.voltar) { var vb = $(tour.voltar); if (vb) vb.click(); }
    // Sai com fade (nada some de repente).
    [tour.ov, tour.ring, tour.tip].forEach(function (e) { if (e) { e.style.pointerEvents = 'none'; e.style.opacity = '0'; } });
    setTimeout(function () { [tour.ov, tour.ring, tour.tip].forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); }); }, 380);
    var b = $('#sa-help-btn'); if (b) b.focus({ preventScroll: true });
  }

  // Abre o tour sozinho na primeira visita: espera a tela terminar de carregar (alvos visíveis, sem janela aberta).
  function agendarAuto() {
    var tentativas = 0, anterior = -1;
    (function tenta() {
      if (ST.tour) return;
      tentativas++;
      var ocupada = $('.modal-overlay.open, .sa-ov.open, #perm-overlay');
      var perm = $('#perm-overlay'); if (perm && getComputedStyle(perm).display === 'none') ocupada = $('.modal-overlay.open, .sa-ov.open');
      // Conta quantos passos da tela estão visíveis (o que a pessoa não pode ver simplesmente não entra no tour).
      // Começa quando há pelo menos um e a contagem parou de mudar (a tela terminou de carregar).
      var visiveis = tourSteps(ST.ctx.key).filter(function (s) { return !s.sidebar && !s.clicar && s.sel !== '#sa-help-btn' && achar(s.sel); }).length;
      var estavel = visiveis > 0 && visiveis === anterior;
      anterior = visiveis;
      if (estavel && !ocupada) return setTimeout(function () { if (!ST.tour && lsGet(vistoKey()) === null) iniciarTour(); }, 300);
      if (tentativas < 28) setTimeout(tenta, 500);
    })();
  }

  // "Já viu?" vale por USUÁRIO (tabela ajuda_vistas), não só por navegador; o localStorage é só cache.
  function remotoLer(cb) {
    var sb = ST.ctx.sb, uid = ST.ctx.profile && ST.ctx.profile.id;
    if (!sb || !uid) return cb(null, false);
    try {
      sb.from('ajuda_vistas').select('versao').eq('chave', ST.ctx.key).maybeSingle().then(function (r) {
        if (r.error) return cb(null, false);
        cb(r.data ? String(r.data.versao) : null, true);
      }, function () { cb(null, false); });
    } catch (e) { cb(null, false); }
  }
  function remotoGravar(v) {
    var sb = ST.ctx && ST.ctx.sb, uid = ST.ctx && ST.ctx.profile && ST.ctx.profile.id;
    if (!sb || !uid) return;
    try { sb.from('ajuda_vistas').upsert({ user_id: uid, chave: ST.ctx.key, versao: v, visto_em: new Date().toISOString() }, { onConflict: 'user_id,chave' }).then(function () {}, function () {}); } catch (e) { /* gravar o "já viu" nunca pode impedir o tour */ }
  }

  function attach(o) {
    if (!o || !conteudo(o.key)) return;
    if (ST.ctx && ST.ctx.key === o.key && $('#sa-help-btn')) { ST.ctx.profile = o.profile || ST.ctx.profile; if (o.sb) ST.ctx.sb = o.sb; return; }
    ST.ctx = { prefix: o.prefix, key: o.key, profile: o.profile || {}, accent: o.accent || {}, sb: o.sb || null };
    injectStyle(); setAccent(); injectButton();
    var c = conteudo(o.key), versao = String(c.versao);
    remotoLer(function (rem, ok) {
      var local = lsGet(vistoKey());
      if (ok && rem !== null) lsSet(vistoKey(), rem);
      else if (ok && local !== null) remotoGravar(local);      // já tinha visto neste navegador: passa a valer em todos
      var visto = rem !== null ? rem : local;
      if (visto === null) agendarAuto();
      else if (visto !== versao) { var b = $('#sa-help-btn'); if (b) b.classList.add('novo'); }
    });
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
