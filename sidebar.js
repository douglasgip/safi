// Barra lateral única do SAFI — organizada por setores. Uma só definição de itens,
// setores e regras de permissão; cada página só chama mount() e apply().
//
//   SafiSidebar.mount('df', { accent: {...} })          // desenha o esqueleto em #df-sidebar
//   SafiSidebar.apply('df', profile, { email, sb })     // mostra o que o usuário pode ver
//
// Para adicionar uma tela nova: incluir em ITEMS (com a regra de permissão) e em
// SECTIONS (no setor certo). Setor sem nenhum item visível some sozinho.
(function () {
  'use strict';

  var SVG = function (paths, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  };

  var ICONS = {
    home: SVG('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    resumo: SVG('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
    dre: SVG('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
    lancamentos: SVG('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>', 14),
    fluxocaixa: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.1 1.12-2 2.5-2s2.5.9 2.5 2c0 2.5-5 1.5-5 4 0 1.1 1.12 2 2.5 2s2.5-.9 2.5-2"/>'),
    geronia: '<img src="/public/GerônIA.png" alt="GerônIA" style="width:18px;height:18px;border-radius:50%;object-fit:cover;flex-shrink:0">',
    mapasoc: SVG('<rect x="3" y="11" width="7" height="10" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 16h4M17 10v4"/>'),
    funcionarios: SVG('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    pedidos: SVG('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    despfixas: SVG('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>'),
    conciliacao: SVG('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    calcimport: SVG('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="6" y1="11" x2="6" y2="11.01"/><line x1="18" y1="11" x2="18" y2="11.01"/>'),
    conselho: SVG('<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>'),
    reunioes: SVG('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>'),
    orcamento: SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    fechamento: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>'),
    admin: SVG('<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
    chevron: SVG('<polyline points="6 9 12 15 18 9"/>', 14)
  };

  // Regras de permissão. Resumo/DRE são opt-out (só somem com false explícito);
  // o resto é opt-in (só aparece com true). Admin vê tudo.
  var ITEMS = {
    home: { label: 'Home', href: '/', can: function () { return true; } },
    geronia: { label: 'GerônIA', href: '/geronia', can: function () { return true; } },
    resumo: { label: 'Resumo Contábil', href: '/resumocontabil', can: function (p) { return p.is_admin || p.can_resumo !== false; } },
    fechamento: { label: 'Fechamento do Mês', href: '/fechamento', can: function (p) { return p.is_admin || p.can_fechar_mes === true; } },
    conselho: { label: 'Painel do Conselho', href: '/conselho', can: function (p) { return p.is_admin || p.can_dre !== false; } },
    reunioes: { label: 'Reuniões e Decisões', href: '/reunioes', can: function (p) { return p.is_admin || p.can_reunioes === true || p.can_reunioes_editar === true; } },
    orcamento: { label: 'Orçamento', href: '/orcamento', can: function (p) { return p.is_admin || p.can_orcamento === true; } },
    dre: { label: 'DRE', href: '/dre', can: function (p) { return p.is_admin || p.can_dre !== false; } },
    lancamentos: { label: 'Lançamentos', href: '/lancamentos', sub: true, can: function (p) { return p.is_admin || p.can_lancamentos === true; } },
    fluxocaixa: { label: 'Fluxo de Caixa', href: '/fluxo-caixa', can: function (p) { return p.is_admin || p.can_fluxo_caixa === true; } },
    despfixas: { label: 'Despesas Fixas', href: '/despesas-fixas', can: function (p) { return p.is_admin || p.can_despesas_fixas === true; } },
    pedidos: { label: 'Pedidos', href: '/pedidos', can: function (p) { return p.is_admin || p.can_pedidos === true; } },
    conciliacao: { label: 'Conciliação', href: '/conciliacao', can: function (p) { return p.is_admin || p.pedidos_pode_conciliar === true || p.can_despesas_fixas === true; } },
    calcimport: { label: 'Calculadora de Importação', href: '/calculadora-importacao', can: function (p) { return p.is_admin || p.can_calc_importacao === true; } },
    funcionarios: { label: 'Funcionários', href: '/funcionarios', can: function (p) { return p.is_admin || p.can_funcionarios === true; } },
    mapasoc: { label: 'Mapa Societário', href: '/mapa-societario', can: function (p) { return p.is_admin || p.can_mapa_societario === true; } }
  };

  // Setores, na ordem em que aparecem. 'lancamentos' fica aninhado sob 'dre'.
  var SECTIONS = [
    { id: 'geral', label: 'Visão Geral', items: ['home', 'geronia'] },
    { id: 'conselho', label: 'Conselho', items: ['conselho', 'reunioes'] },
    { id: 'financeiro', label: 'Financeiro', items: ['dre', 'orcamento', 'fluxocaixa', 'despfixas'] },
    { id: 'contabil', label: 'Contábil', items: ['resumo', 'fechamento'] },
    { id: 'compras', label: 'Compras', items: ['pedidos', 'conciliacao', 'calcimport'] },
    { id: 'pessoal', label: 'Pessoal', items: ['funcionarios'] },
    { id: 'gestao', label: 'Gestão', items: ['mapasoc'] }
  ];

  var PATH_TO_KEY = {
    '/': 'home', '/resumocontabil': 'resumo', '/dre': 'dre', '/lancamentos': 'lancamentos',
    '/fluxo-caixa': 'fluxocaixa', '/geronia': 'geronia', '/mapa-societario': 'mapasoc',
    '/funcionarios': 'funcionarios', '/pedidos': 'pedidos', '/despesas-fixas': 'despfixas',
    '/conciliacao': 'conciliacao', '/fechamento': 'fechamento', '/conselho': 'conselho', '/reunioes': 'reunioes', '/orcamento': 'orcamento', '/calculadora-importacao': 'calcimport'
  };

  var COLLAPSED_KEY = 'safi-sidebar-collapsed-sections';
  var LANC_KEY = 'sidebar-lancamentos-collapsed';

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function injectStyle() {
    if (document.getElementById('safi-sidebar-style')) return;
    var st = document.createElement('style');
    st.id = 'safi-sidebar-style';
    st.textContent =
      '.sb-sec{display:flex;flex-direction:column;gap:4px}' +
      '.sb-sec + .sb-sec{margin-top:8px}' +
      '.sb-sec-h{display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 12px 6px;background:transparent;border:none;cursor:pointer;font-family:Inter,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#475569;text-align:left}' +
      '.sb-sec-h:hover{color:#94a3b8}' +
      '.sb-sec-h svg{transition:transform .2s cubic-bezier(.16,1,.3,1)}' +
      '.sb-sec.collapsed .sb-sec-h svg{transform:rotate(-90deg)}' +
      '.sb-sec-body{display:flex;flex-direction:column;gap:4px}' +
      '.sb-sec.collapsed .sb-sec-body{display:none}';
    document.head.appendChild(st);
  }

  function itemHtml(prefix, key, active) {
    var it = ITEMS[key];
    var cls = 'dc-sidebar-nav-btn' + (it.sub ? ' dc-sidebar-sub-btn' : '') + (key === active ? ' active' : '');
    return '<a href="' + it.href + '" id="' + prefix + '-sidebar-' + key + '" class="' + cls + '" style="display:none">' + ICONS[key] + it.label + '</a>';
  }

  // DRE + Lançamentos: linha do DRE com seta que recolhe o submenu de Lançamentos.
  function dreGroupHtml(prefix, active) {
    return '<div id="' + prefix + '-sidebar-dre-row" class="dc-sidebar-group-row" style="display:none">' +
      '<a href="/dre" id="' + prefix + '-sidebar-dre" class="dc-sidebar-nav-btn' + (active === 'dre' ? ' active' : '') + '" style="flex:1">' + ICONS.dre + 'DRE</a>' +
      '<button type="button" id="' + prefix + '-sidebar-dre-toggle" class="dc-sidebar-chevron" aria-label="Recolher/expandir Lançamentos" aria-expanded="true" style="display:none">' + ICONS.chevron + '</button>' +
      '</div>' +
      '<div class="dc-sidebar-submenu" id="' + prefix + '-sidebar-dre-submenu">' + itemHtml(prefix, 'lancamentos', active) + '</div>';
  }

  function sectionHtml(prefix, sec, active) {
    var inner = sec.items.map(function (k) { return k === 'dre' ? dreGroupHtml(prefix, active) : itemHtml(prefix, k, active); }).join('');
    return '<div class="sb-sec" data-sec="' + sec.id + '" style="display:none">' +
      '<button type="button" class="sb-sec-h" data-sec-toggle="' + sec.id + '" aria-expanded="true"><span>' + esc(sec.label) + '</span>' + ICONS.chevron + '</button>' +
      '<div class="sb-sec-body">' + inner + '</div></div>';
  }

  function mount(prefix, opts) {
    opts = opts || {};
    var root = document.getElementById(prefix + '-sidebar');
    if (!root) return;
    injectStyle();
    var active = opts.active || PATH_TO_KEY[location.pathname.replace(/\/+$/, '') || '/'] || null;
    var adm = opts.accent || {};
    var admRgb = adm.adminRgb || '245,158,11';
    var admFg = adm.adminFg || '#f59e0b';

    root.innerHTML =
      '<div style="padding:24px 20px 16px;border-bottom:1px solid rgba(255,255,255,0.07)">' +
        '<div id="' + prefix + '-sidebar-user" style="display:flex;align-items:center;gap:12px;margin-bottom:4px"></div>' +
        '<div style="font-size:9px;font-weight:600;color:#334155;letter-spacing:2px;text-transform:uppercase;margin-top:12px">Navegação</div>' +
      '</div>' +
      '<div id="' + prefix + '-sidebar-nav" style="padding:12px 12px;flex:1;display:flex;flex-direction:column">' +
        SECTIONS.map(function (s) { return sectionHtml(prefix, s, active); }).join('') +
      '</div>' +
      '<div style="padding:12px 12px 28px;border-top:1px solid rgba(255,255,255,0.07)">' +
        '<a href="/admin" id="' + prefix + '-sidebar-admin" style="display:none;align-items:center;gap:12px;padding:13px 20px;background:rgba(' + admRgb + ',0.08);border:1px solid rgba(' + admRgb + ',0.2);border-radius:10px;color:' + admFg + ';font-family:Inter,sans-serif;font-size:14px;font-weight:600;text-decoration:none">' + ICONS.admin + 'Admin</a>' +
      '</div>';

    root._safiActive = active;
    root._safiAccent = opts.accent || {};

    // Setores recolhíveis (lembra a escolha; o setor da página atual sempre abre).
    var collapsed = readJSON(COLLAPSED_KEY);
    root.querySelectorAll('.sb-sec').forEach(function (el) {
      var id = el.getAttribute('data-sec');
      var hasActive = !!el.querySelector('.active');
      if (collapsed[id] && !hasActive) { el.classList.add('collapsed'); el.querySelector('.sb-sec-h').setAttribute('aria-expanded', 'false'); }
    });
    root.addEventListener('click', function (e) {
      var h = e.target.closest('[data-sec-toggle]');
      if (!h) return;
      var sec = h.closest('.sb-sec');
      var on = !sec.classList.contains('collapsed');
      sec.classList.toggle('collapsed', on);
      h.setAttribute('aria-expanded', String(!on));
      var c = readJSON(COLLAPSED_KEY);
      c[sec.getAttribute('data-sec')] = on;
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(c)); } catch (err) {}
    });

    // Seta do DRE → recolhe/expande Lançamentos (preferência compartilhada entre telas).
    var btn = document.getElementById(prefix + '-sidebar-dre-toggle');
    var sub = document.getElementById(prefix + '-sidebar-dre-submenu');
    if (btn && sub) {
      var isCollapsed = localStorage.getItem(LANC_KEY) === '1';
      var applyLanc = function () {
        sub.classList.toggle('collapsed', isCollapsed);
        btn.classList.toggle('collapsed', isCollapsed);
        btn.setAttribute('aria-expanded', String(!isCollapsed));
      };
      applyLanc();
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        isCollapsed = !isCollapsed;
        try { localStorage.setItem(LANC_KEY, isCollapsed ? '1' : '0'); } catch (err) {}
        applyLanc();
      });
    }
  }

  function apply(prefix, profile, opts) {
    opts = opts || {};
    var root = document.getElementById(prefix + '-sidebar');
    if (!root) return;
    // Perfil ausente (erro na busca) nunca libera acesso: só Home e GerônIA aparecem.
    if (!profile) profile = { is_admin: false, can_resumo: false, can_dre: false };
    var show = function (id, display) { var el = document.getElementById(prefix + '-sidebar-' + id); if (el) el.style.display = display || 'flex'; };

    Object.keys(ITEMS).forEach(function (key) {
      if (!ITEMS[key].can(profile)) return;
      if (key === 'dre') show('dre-row');
      else show(key);
    });
    // A seta do DRE só existe se o usuário tem Lançamentos.
    if (ITEMS.lancamentos.can(profile) && ITEMS.dre.can(profile)) show('dre-toggle');

    // Setor só aparece se sobrar algum item visível dentro dele.
    root.querySelectorAll('.sb-sec').forEach(function (sec) {
      var any = false;
      sec.querySelectorAll('a, .dc-sidebar-group-row').forEach(function (el) { if (el.style.display === 'flex') any = true; });
      sec.style.display = any ? 'flex' : 'none';
    });

    if (profile.is_admin) show('admin');

    // Cartão do usuário (iniciais + nome + cargo).
    var acc = root._safiAccent || {};
    var email = opts.email || '';
    var name = (profile.full_name || email.split('@')[0] || 'Usuário').trim();
    var parts = name.split(/\s+/);
    var initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    var userEl = document.getElementById(prefix + '-sidebar-user');
    if (userEl) {
      userEl.innerHTML =
        '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,' + (acc.g1 || '#f59e0b') + ',' + (acc.g2 || '#d97706') + ');display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:' + (acc.text || '#1a0a00') + ';flex-shrink:0">' + esc(initials) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:1px;min-width:0">' +
          '<div style="font-size:12px;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">' + esc(name) + '</div>' +
          (profile.role ? '<div style="font-size:9px;font-weight:600;color:#64748b;white-space:nowrap">' + (profile.is_admin ? '&#9670; ' : '') + esc(profile.role) + '</div>' : '') +
        '</div>';
      if (window.UserMenu && opts.sb) window.UserMenu.attach(userEl, opts.sb);
    }
  }

  window.SafiSidebar = { mount: mount, apply: apply };
})();
