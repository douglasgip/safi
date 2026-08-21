// user-menu.js — dropdown compartilhado (Trocar senha / Sair) para o badge de usuário.
// Usado por: index.html, "Grupo Sacoman - Painel Contábil.dc.html", geronia.html, admin.html
(function(){
  var STYLE_ID = 'usermenu-styles';
  function ensureStyles(){
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.usermenu-dropdown{position:fixed;z-index:5000;min-width:190px;background:#0f1626;border:1px solid rgba(255,255,255,0.1);border-radius:12px;box-shadow:0 16px 44px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.03);padding:6px;font-family:Inter,sans-serif;animation:usermenu-in .16s cubic-bezier(.16,1,.3,1)}' +
      '@keyframes usermenu-in{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}' +
      '.usermenu-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;background:transparent;border:none;border-radius:8px;color:#cbd5e1;font-family:Inter,sans-serif;font-size:12.5px;font-weight:600;cursor:pointer;text-align:left;transition:background .12s ease,color .12s ease}' +
      '.usermenu-item:hover{background:rgba(255,255,255,0.07);color:#f1f5f9}' +
      '.usermenu-item.danger:hover{background:rgba(239,68,68,0.12);color:#f87171}' +
      '.usermenu-item svg{flex-shrink:0}' +
      '.usermenu-overlay{position:fixed;inset:0;z-index:5100;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:usermenu-fade .15s ease}' +
      '@keyframes usermenu-fade{from{opacity:0}to{opacity:1}}' +
      '.usermenu-modal{width:100%;max-width:360px;background:#0f1626;border:1px solid rgba(255,255,255,0.1);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,0.6);padding:22px 22px 20px;font-family:Inter,sans-serif;animation:usermenu-in .18s cubic-bezier(.16,1,.3,1)}' +
      '.usermenu-modal h3{font-size:15px;font-weight:800;color:#f1f5f9;margin:0 0 4px;letter-spacing:-.2px}' +
      '.usermenu-modal p{font-size:11.5px;color:#64748b;margin:0 0 16px;line-height:1.5}' +
      '.usermenu-field{margin-bottom:12px}' +
      '.usermenu-field label{display:block;font-size:10.5px;font-weight:700;color:#94a3b8;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px}' +
      '.usermenu-field input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:9px;padding:10px 12px;color:#f1f5f9;font-family:Inter,sans-serif;font-size:13px;outline:none;transition:border-color .15s ease}' +
      '.usermenu-field input:focus{border-color:rgba(99,102,241,0.55)}' +
      '.usermenu-error{font-size:11.5px;color:#f87171;margin:-4px 0 12px;min-height:14px}' +
      '.usermenu-success{font-size:12.5px;color:#4ade80;font-weight:600;margin:-4px 0 12px}' +
      '.usermenu-actions{display:flex;gap:8px;margin-top:4px}' +
      '.usermenu-btn{flex:1;padding:10px 14px;border-radius:9px;font-family:Inter,sans-serif;font-size:12.5px;font-weight:700;cursor:pointer;border:none;transition:filter .12s ease,opacity .12s ease}' +
      '.usermenu-btn:hover{filter:brightness(0.94)}' +
      '.usermenu-btn:disabled{opacity:.55;cursor:default}' +
      '.usermenu-btn-primary{background:linear-gradient(135deg,#6366f1,#7c5cf0);color:#fff}' +
      '.usermenu-btn-ghost{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8}';
    document.head.appendChild(s);
  }

  var openDropdown = null;
  function closeDropdown(){
    if (openDropdown) { openDropdown.remove(); openDropdown = null; }
    document.removeEventListener('mousedown', onOutsideClick, true);
    document.removeEventListener('keydown', onEscape, true);
  }
  function onOutsideClick(e){ if (openDropdown && !openDropdown.contains(e.target)) closeDropdown(); }
  function onEscape(e){ if (e.key === 'Escape') closeDropdown(); }

  var ICON_KEY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5L18 5l3 3-2.5 2.5"/></svg>';
  var ICON_LOGOUT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';

  function positionMenu(menu, anchorEl){
    var r = anchorEl.getBoundingClientRect();
    var menuH = menu.offsetHeight || 96;
    var menuW = menu.offsetWidth || 190;
    var spaceBelow = window.innerHeight - r.bottom;
    var placeAbove = spaceBelow < (menuH + 14) && r.top > (menuH + 14);
    menu.style.top = placeAbove ? (r.top - menuH - 8) + 'px' : (r.bottom + 8) + 'px';
    var left = r.left;
    if (left + menuW > window.innerWidth - 10) left = window.innerWidth - menuW - 10;
    if (left < 10) left = 10;
    menu.style.left = left + 'px';
  }

  function openPasswordModal(sbClient){
    ensureStyles();
    var overlay = document.createElement('div');
    overlay.className = 'usermenu-overlay';
    overlay.innerHTML =
      '<div class="usermenu-modal">' +
        '<h3>Trocar senha</h3>' +
        '<p>Escolha uma nova senha de acesso. Mínimo de 6 caracteres.</p>' +
        '<div class="usermenu-field"><label>Nova senha</label><input type="password" id="usermenu-pwd1" autocomplete="new-password"></div>' +
        '<div class="usermenu-field"><label>Confirmar nova senha</label><input type="password" id="usermenu-pwd2" autocomplete="new-password"></div>' +
        '<div class="usermenu-error" id="usermenu-err"></div>' +
        '<div class="usermenu-actions">' +
          '<button class="usermenu-btn usermenu-btn-ghost" id="usermenu-cancel">Cancelar</button>' +
          '<button class="usermenu-btn usermenu-btn-primary" id="usermenu-save">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var pwd1 = overlay.querySelector('#usermenu-pwd1');
    var pwd2 = overlay.querySelector('#usermenu-pwd2');
    var errEl = overlay.querySelector('#usermenu-err');
    var saveBtn = overlay.querySelector('#usermenu-save');
    var cancelBtn = overlay.querySelector('#usermenu-cancel');

    function close(){ overlay.remove(); document.removeEventListener('keydown', escHandler, true); }
    function escHandler(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', escHandler, true);
    overlay.addEventListener('mousedown', function(e){ if (e.target === overlay) close(); });
    cancelBtn.addEventListener('click', close);

    function submit(){
      errEl.textContent = '';
      var p1 = pwd1.value, p2 = pwd2.value;
      if (!p1 || p1.length < 6) { errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'; return; }
      if (p1 !== p2) { errEl.textContent = 'As senhas não coincidem.'; return; }
      saveBtn.disabled = true; cancelBtn.disabled = true;
      saveBtn.textContent = 'Salvando…';
      sbClient.auth.updateUser({ password: p1 }).then(function(res){
        if (res && res.error) {
          errEl.textContent = res.error.message || 'Não foi possível atualizar a senha.';
          saveBtn.disabled = false; cancelBtn.disabled = false; saveBtn.textContent = 'Salvar';
          return;
        }
        overlay.querySelector('.usermenu-modal').innerHTML =
          '<h3>Trocar senha</h3><div class="usermenu-success">Senha atualizada com sucesso.</div>' +
          '<div class="usermenu-actions"><button class="usermenu-btn usermenu-btn-primary" id="usermenu-done" style="flex:1">Fechar</button></div>';
        overlay.querySelector('#usermenu-done').addEventListener('click', close);
      }).catch(function(){
        errEl.textContent = 'Erro de conexão. Tente novamente.';
        saveBtn.disabled = false; cancelBtn.disabled = false; saveBtn.textContent = 'Salvar';
      });
    }
    saveBtn.addEventListener('click', submit);
    pwd2.addEventListener('keydown', function(e){ if (e.key === 'Enter') submit(); });
    pwd1.focus();
  }

  function toggle(anchorEl, sbClient){
    if (openDropdown) { closeDropdown(); return; }
    ensureStyles();
    var menu = document.createElement('div');
    menu.className = 'usermenu-dropdown';
    menu.innerHTML =
      '<button class="usermenu-item" data-act="pwd">' + ICON_KEY + 'Trocar senha</button>' +
      '<button class="usermenu-item danger" data-act="logout">' + ICON_LOGOUT + 'Sair</button>';
    document.body.appendChild(menu);
    positionMenu(menu, anchorEl);
    openDropdown = menu;

    menu.querySelector('[data-act="pwd"]').addEventListener('click', function(){
      closeDropdown();
      openPasswordModal(sbClient);
    });
    menu.querySelector('[data-act="logout"]').addEventListener('click', function(){
      closeDropdown();
      sbClient.auth.signOut().then(function(){ window.location.replace('/login'); });
    });

    setTimeout(function(){
      document.addEventListener('mousedown', onOutsideClick, true);
      document.addEventListener('keydown', onEscape, true);
    }, 0);
  }

  // Garante um access_token válido antes de chamar uma Edge Function.
  // Só renova quando necessário (evita brigar com outras abas pela rotação
  // do refresh_token) e, se a renovação falhar (ex: outra aba já rotacionou
  // o refresh_token), recai pro que já está salvo no localStorage em vez de travar.
  function freshToken(sbClient, fallbackToken){
    return sbClient.auth.getSession().then(function(res){
      var session = res && res.data && res.data.session;
      var now = Math.floor(Date.now() / 1000);
      if (session && session.expires_at && (session.expires_at - now) > 60) {
        return session.access_token;
      }
      return sbClient.auth.refreshSession().then(function(r2){
        var s2 = r2 && r2.data && r2.data.session;
        return (s2 && s2.access_token) || (session && session.access_token) || fallbackToken;
      }).catch(function(){
        return (session && session.access_token) || fallbackToken;
      });
    }).catch(function(){ return fallbackToken; });
  }

  // ── "Pedir explicação do Gerôn" — popover que aparece ao dar clique duplo
  // num número. A pergunta já vem pronta (label + valor + operação + período),
  // então não adiciona nada ao prompt fixo do Gerôn — é como se o usuário
  // tivesse digitado ela mesmo.
  function showAskGeronPopover(x, y, question){
    var old = document.getElementById('ask-geron-popover');
    if (old) old.remove();
    if (!question) return;
    var pop = document.createElement('div');
    pop.id = 'ask-geron-popover';
    var left = Math.min(Math.max(x, 100), window.innerWidth - 100);
    var top = Math.min(y + 12, window.innerHeight - 50);
    pop.style.cssText = 'position:fixed;z-index:99999;left:' + left + 'px;top:' + top + 'px;transform:translateX(-50%);animation:askGeronPopIn .15s cubic-bezier(.16,1,.3,1)';
    if (!document.getElementById('ask-geron-style')) {
      var st = document.createElement('style');
      st.id = 'ask-geron-style';
      st.textContent = '@keyframes askGeronPopIn{from{opacity:0;transform:translateX(-50%) translateY(-4px) scale(.96)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}';
      document.head.appendChild(st);
    }
    pop.innerHTML =
      '<button type="button" style="display:flex;align-items:center;gap:7px;padding:8px 14px;background:#150a28;border:1px solid rgba(139,92,246,0.45);border-radius:20px;color:#e9d5ff;font-family:Inter,sans-serif;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,0.5);white-space:nowrap">' +
        '<img src="/public/GerônIA.png" alt="" style="width:16px;height:16px;border-radius:50%;object-fit:cover;flex-shrink:0">' +
        'Pedir explicação do Gerôn' +
      '</button>';
    document.body.appendChild(pop);
    var btn = pop.querySelector('button');
    var closeTimer = setTimeout(cleanup, 6000);
    // O popover fica "grudado" no pixel onde apareceu (position:fixed) — se a página
    // rolar, ele deixa de fazer sentido ali (fica flutuando sobre outro conteúdo em
    // vez de perto do número clicado), então some assim que detectar qualquer scroll.
    function cleanup(){
      if (pop.parentNode) pop.remove();
      clearTimeout(closeTimer);
      document.removeEventListener('mousedown', onOutside, true);
      window.removeEventListener('scroll', cleanup, true);
    }
    function onOutside(ev){ if (!pop.contains(ev.target)) cleanup(); }
    setTimeout(function(){
      document.addEventListener('mousedown', onOutside, true);
      window.addEventListener('scroll', cleanup, true);
    }, 0);
    btn.addEventListener('click', function(ev){
      ev.stopPropagation();
      cleanup();
      if (window.askGeron) window.askGeron(question);
      else window.location.href = '/geronia?q=' + encodeURIComponent(question);
    });
  }

  function attachAskGeronDelegation(container){
    if (!container || container.dataset.askgeronBound) return;
    container.dataset.askgeronBound = '1';
    container.addEventListener('dblclick', function(e){
      var el = e.target.closest('[data-ask]');
      if (!el) return;
      var q = el.getAttribute('data-ask');
      if (!q) return;
      e.preventDefault();
      if (window.getSelection) window.getSelection().removeAllRanges();
      showAskGeronPopover(e.clientX, e.clientY, q);
    });
  }

  window.AskGeron = { attachDelegation: attachAskGeronDelegation, popover: showAskGeronPopover };

  window.UserMenu = {
    attach: function(el, sbClient){
      if (!el || el.dataset.usermenuBound) return;
      el.dataset.usermenuBound = '1';
      el.style.cursor = 'pointer';
      el.addEventListener('click', function(e){
        e.stopPropagation();
        toggle(el, sbClient);
      });
    },
    freshToken: freshToken
  };
})();
