/* Multi-branch support — the screens.
   The server does the real work (see branches.js): it keeps every branch's records apart and answers each request
   for ONE branch (or "all branches", read only). This file adds:
     - a bar at the top of the page: which branch you are working in, with a switcher for the group-level Admin
     - a "Branches" manager (add / edit / delete a branch, branch totals, move students between branches)
     - a Branch choice on user accounts
   With a single branch nothing here is visible, apart from the "Branches" entry in the account menu that lets the
   Admin add the second campus. */
(function(){
  var B = { loaded:false, multi:false, branches:[], branchId:null, all:false, locked:false, groupLevel:true, mainId:'main' };
  window.branchState = function(){ return B; };

  function esc(v){ return typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function toast(m){ if(typeof showToast === 'function') showToast(m); }
  function money(n){ return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
  function nameOf(id){ var b = B.branches.find(function(x){ return x.id === id; }); return b ? b.name : ''; }
  window.branchNameOf = nameOf;
  function isAdmin(){ return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'Admin'; }
  function canManage(){ return isAdmin() && B.groupLevel && !B.locked; }

  // Short label for a record: "North Campus", or '' for a single-branch school.
  window.branchLabelFor = function(rec){
    if(!B.multi || !rec) return '';
    var id = rec.branchId || (B.all ? B.mainId : B.branchId);
    return nameOf(id);
  };
  // Small tag shown beside a user account in Users & Roles.
  window.branchTag = function(u){
    if(!B.multi || !u) return '';
    var mgmt = u.role === 'Admin' || u.role === 'Principal';
    var t = u.branchId ? nameOf(u.branchId) : (mgmt ? 'All branches' : nameOf(B.mainId));
    return t ? '<small class="br-tag">🏫 ' + esc(t) + '</small>' : '';
  };

  var css = document.createElement('style');
  css.textContent =
    '.br-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 0 18px;padding:10px 14px;border:1px solid var(--border);border-radius:14px;background:var(--white);box-shadow:0 8px 24px -18px rgba(22,16,51,.35);font-size:.9rem;color:var(--ink)}' +
    '.br-bar b{font-weight:700}.br-ic{font-size:1.1rem}' +
    '.br-bar select{padding:7px 10px;border:1px solid var(--border);border-radius:10px;background:var(--white);color:var(--ink);font:inherit;font-weight:600;max-width:60vw}' +
    '.br-bar .br-sp{flex:1}.br-note{color:var(--ink-soft);font-size:.85rem}' +
    '.br-bar.br-all{background:var(--warning-bg);border-color:rgba(203,154,46,.5)}' +
    '.br-btn{border:1px solid var(--border);background:transparent;color:var(--ink);border-radius:10px;padding:7px 12px;font:inherit;font-weight:600;cursor:pointer}' +
    '.br-btn:hover{background:var(--soft-fill,rgba(110,108,150,.08))}' +
    '.br-btn.primary{background:var(--navy);border-color:var(--navy);color:#fff}.br-btn.danger{color:var(--danger-ink);border-color:rgba(209,16,115,.35)}' +
    '.br-tag{display:block;color:var(--ink-soft);font-weight:600;margin-top:2px}' +
    '#brOverlay{z-index:45}#brOverlay .modal{max-width:820px;width:calc(100vw - 24px)}' +
    '#brOverlay h3{margin:22px 0 8px;font-size:1.02rem}#brOverlay .modal-sub{padding-right:34px}' +
    '.br-table{width:100%;border-collapse:collapse;font-size:.9rem}.br-table th,.br-table td{padding:9px 8px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}' +
    '.br-table th{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}.br-table td.r,.br-table th.r{text-align:right}' +
    '.br-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700;background:var(--info-bg);color:var(--info-ink);margin-left:6px}' +
    '.br-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}' +
    '.br-grid label{display:block;font-size:.78rem;font-weight:700;color:var(--ink-soft);margin-bottom:4px}' +
    '.br-grid input,.br-grid select{width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:10px;background:var(--white);color:var(--ink);font:inherit;box-sizing:border-box}' +
    '.br-card{border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:8px;background:var(--cream)}' +
    '.br-list{max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--white);margin-top:8px}' +
    '.br-list label{display:flex;gap:8px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--border);font-size:.88rem;cursor:pointer}' +
    '.br-row-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}' +
    '.br-menu-item{display:none}';
  document.head.appendChild(css);

  async function load(){
    try{
      var r = await fetch('/api/branches');
      if(!r.ok) return;
      var j = await r.json();
      B.loaded = true; B.multi = !!j.multi; B.branches = j.branches || []; B.mainId = j.mainId || 'main';
      B.branchId = j.scope ? j.scope.branchId : null; B.all = !!(j.scope && j.scope.all); B.locked = !!(j.scope && j.scope.locked);
      B.groupLevel = !j.scope || j.scope.groupLevel !== false;
    }catch(e){}
  }

  function menuEntry(){
    var menu = document.getElementById('sbUserMenu');
    if(!menu) return;
    var btn = document.getElementById('brMenuBtn');
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'brMenuBtn'; btn.setAttribute('role', 'menuitem'); btn.className = 'approvals-bell-btn';
      btn.innerHTML = '<span class="approvals-bell-icon">🏫</span><span class="sb-btn-label">Branches</span>';
      btn.onclick = function(){ if(typeof closeSbUserMenu === 'function') closeSbUserMenu(); openBranchManager(); };
      var acct = Array.prototype.find.call(menu.children, function(el){ return /myaccount/.test(el.getAttribute('onclick') || ''); });
      menu.insertBefore(btn, acct || menu.firstChild);
    }
    btn.style.display = canManage() ? '' : 'none';
  }

  function renderBar(){
    var main = document.querySelector('main.main');
    if(!main) return;
    var bar = document.getElementById('branchBar');
    if(!B.multi){ if(bar) bar.remove(); return; }
    if(!bar){ bar = document.createElement('div'); bar.id = 'branchBar'; main.insertBefore(bar, main.firstChild); }
    var cur = nameOf(B.branchId);
    if(B.locked){
      bar.className = 'br-bar';
      bar.innerHTML = '<span class="br-ic">🏫</span><span>Branch: <b>' + esc(cur) + '</b></span><span class="br-note">You work in this branch only.</span>';
      return;
    }
    var opts = B.branches.map(function(b){ return '<option value="' + esc(b.id) + '"' + (!B.all && b.id === B.branchId ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') +
      '<option value="all"' + (B.all ? ' selected' : '') + '>All branches (view only)</option>';
    bar.className = 'br-bar' + (B.all ? ' br-all' : '');
    bar.innerHTML = '<span class="br-ic">🏫</span><label for="brSel"><b>Branch</b></label><select id="brSel" aria-label="Choose branch">' + opts + '</select>' +
      (B.all ? '<span class="br-note">👁 Viewing every branch together. Records cannot be added or changed here — choose one branch to do that.</span>' : '') +
      '<span class="br-sp"></span>' + (canManage() ? '<button type="button" class="br-btn" id="brManageBtn">Manage branches</button>' : '');
    document.getElementById('brSel').onchange = function(){ switchBranch(this.value); };
    var mb = document.getElementById('brManageBtn'); if(mb) mb.onclick = openBranchManager;
  }

  async function switchBranch(id){
    try{
      var r = await fetch('/api/branches/switch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ branchId: id }) });
      var j = await r.json().catch(function(){ return {}; });
      if(!r.ok){ toast(j.error || 'Could not switch branch.'); renderBar(); return; }
      location.reload();
    }catch(e){ toast('Could not switch branch.'); }
  }

  async function init(){
    await load();
    wrapSchoolInfo();
    renderBar();
    menuEntry();
  }
  window.branchesInit = init;

  // ------- Branch manager -------
  var summary = {};
  function overlay(){
    var o = document.getElementById('brOverlay');
    if(!o){
      o = document.createElement('div'); o.id = 'brOverlay'; o.className = 'modal-overlay';
      o.innerHTML = '<div class="modal"><div class="modal-inner"><button class="modal-close" aria-label="Close" onclick="closeBranchManager()">&times;</button><div id="brBody"></div></div></div>';
      o.addEventListener('mousedown', function(e){ if(e.target === o) closeBranchManager(); });
      document.body.appendChild(o);
    }
    return o;
  }
  window.closeBranchManager = function(){ var o = document.getElementById('brOverlay'); if(o) o.classList.remove('open'); };
  var mv = { from: '', cls: '', sec: '', q: '', picked: new Set(), to: '' };

  window.openBranchManager = async function(){
    if(!canManage()){ toast('Only the group-level Admin can manage branches.'); return; }
    await load();
    overlay().classList.add('open');
    document.getElementById('brBody').innerHTML = '<p class="br-note">Loading…</p>';
    try{
      var r = await fetch('/api/branches/summary');
      var j = r.ok ? await r.json() : { branches: [] };
      summary = {}; (j.branches || []).forEach(function(x){ summary[x.id] = x; });
    }catch(e){ summary = {}; }
    mv = { from: B.all ? B.mainId : (B.branchId || B.mainId), cls: '', sec: '', q: '', picked: new Set(), to: '' };
    renderManager();
  };

  function renderManager(){
    var body = document.getElementById('brBody');
    var rows = B.branches.map(function(b){
      var s = summary[b.id] || {};
      var canDel = !b.isMain;
      return '<tr><td><b>' + esc(b.name) + '</b>' + (b.isMain ? '<span class="br-pill">Main</span>' : '') + '<br><span class="br-note">' + esc(b.code || '') + (b.address ? ' · ' + esc(b.address) : '') + (b.phone ? ' · ' + esc(b.phone) : '') + '</span></td>' +
        '<td class="r">' + (s.students == null ? '—' : s.students) + '</td><td class="r">' + (s.collected == null ? '—' : money(s.collected)) + '</td><td class="r">' + (s.users == null ? '—' : s.users) + '</td>' +
        '<td><div class="br-row-actions"><button type="button" class="br-btn" onclick="brEdit(\'' + esc(b.id) + '\')">Edit</button>' + (canDel ? '<button type="button" class="br-btn danger" onclick="brDelete(\'' + esc(b.id) + '\')">Delete</button>' : '') + '</div></td></tr>';
    }).join('');
    body.innerHTML =
      '<h2 style="margin:0 0 4px">Branches</h2><p class="modal-sub">One ERP, several campuses. Each branch keeps its own students, fees, attendance, marks, accounts, stock, timetable and so on. Fee types, exam types, subjects, staff and the website are shared by all branches.</p>' +
      '<table class="br-table"><thead><tr><th>Branch</th><th class="r">Students</th><th class="r">Fees collected</th><th class="r">Logins</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<h3 id="brFormTitle">Add a branch</h3><div class="br-card"><input type="hidden" id="brEditId" value="">' +
      '<div class="br-grid"><div><label>Branch name *</label><input id="brName" maxlength="120" placeholder="e.g. North Campus"></div>' +
      '<div><label>Short code</label><input id="brCode" maxlength="12" placeholder="e.g. NORTH"></div>' +
      '<div><label>Phone</label><input id="brPhone" maxlength="40"></div>' +
      '<div><label>Email</label><input id="brEmail" maxlength="120"></div>' +
      '<div style="grid-column:1/-1"><label>Address</label><input id="brAddress" maxlength="300"></div></div>' +
      '<div style="margin-top:12px;display:flex;gap:8px"><button type="button" class="br-btn primary" id="brSaveBtn" onclick="brSave()">Add branch</button><button type="button" class="br-btn" id="brCancelBtn" style="display:none" onclick="brEdit(null)">Cancel edit</button></div>' +
      '<p class="br-note" style="margin:10px 0 0">After adding a branch, choose it in the top bar to add its students. Create a login for each branch under Users &amp; Roles and pick that branch on it — that person will then see only that branch.</p></div>' +
      moveHtml();
    wireMove();
  }

  window.brEdit = function(id){
    var b = id ? B.branches.find(function(x){ return x.id === id; }) : null;
    document.getElementById('brEditId').value = b ? b.id : '';
    document.getElementById('brName').value = b ? b.name : '';
    document.getElementById('brCode').value = b ? b.code : '';
    document.getElementById('brPhone').value = b ? b.phone : '';
    document.getElementById('brEmail').value = b ? b.email : '';
    document.getElementById('brAddress').value = b ? b.address : '';
    document.getElementById('brFormTitle').textContent = b ? 'Edit branch' : 'Add a branch';
    document.getElementById('brSaveBtn').textContent = b ? 'Save changes' : 'Add branch';
    document.getElementById('brCancelBtn').style.display = b ? '' : 'none';
    if(b) document.getElementById('brFormTitle').scrollIntoView({ block: 'nearest' });
  };
  window.brSave = async function(){
    var id = document.getElementById('brEditId').value;
    var data = { name: document.getElementById('brName').value.trim(), code: document.getElementById('brCode').value.trim(), phone: document.getElementById('brPhone').value.trim(), email: document.getElementById('brEmail').value.trim(), address: document.getElementById('brAddress').value.trim() };
    if(!data.name){ toast('Give the branch a name.'); return; }
    var wasSingle = !B.multi;
    try{
      var r = await fetch(id ? '/api/branches/' + encodeURIComponent(id) : '/api/branches', { method: id ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
      var j = await r.json().catch(function(){ return {}; });
      if(!r.ok){ toast(j.error || 'Could not save the branch.'); return; }
      toast(id ? 'Branch updated.' : 'Branch added.');
      if(wasSingle && !id){ location.reload(); return; } // multi-branch mode just turned on
      await load(); renderBar();
      var rr = await fetch('/api/branches/summary'); if(rr.ok){ var jj = await rr.json(); summary = {}; (jj.branches || []).forEach(function(x){ summary[x.id] = x; }); }
      renderManager();
    }catch(e){ toast('Could not save the branch.'); }
  };
  window.brDelete = async function(id){
    var b = B.branches.find(function(x){ return x.id === id; }); if(!b) return;
    var ok = typeof showConfirmDialog === 'function' ? await showConfirmDialog('Delete the branch "' + b.name + '"? Only an empty branch can be deleted.', { title: 'Delete branch', okText: 'Delete' }) : confirm('Delete ' + b.name + '?');
    if(!ok) return;
    try{
      var r = await fetch('/api/branches/' + encodeURIComponent(id), { method: 'DELETE' });
      var j = await r.json().catch(function(){ return {}; });
      if(!r.ok){ toast(j.error || 'Could not delete the branch.'); return; }
      toast('Branch deleted.');
      if(B.branches.length <= 2){ location.reload(); return; }
      await load(); renderBar(); renderManager();
    }catch(e){ toast('Could not delete the branch.'); }
  };

  // ------- Move students -------
  function studentBranchId(s){ return s.branchId || (B.all ? B.mainId : (B.branchId || B.mainId)); }
  function movePool(){
    var list = (typeof students !== 'undefined' && Array.isArray(students)) ? students : [];
    return list.filter(function(s){ return studentBranchId(s) === mv.from; });
  }
  function moveMatches(){
    var q = mv.q.trim().toLowerCase();
    return movePool().filter(function(s){
      if(mv.cls && s.className !== mv.cls) return false;
      if(mv.sec && s.section !== mv.sec) return false;
      if(q && ((s.firstName || '') + ' ' + (s.lastName || '') + ' ' + (s.admissionNo || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function moveHtml(){
    var pool = movePool();
    var classes = Array.from(new Set(pool.map(function(s){ return s.className; }).filter(Boolean)));
    var secs = Array.from(new Set(pool.filter(function(s){ return !mv.cls || s.className === mv.cls; }).map(function(s){ return s.section; }).filter(Boolean)));
    var m = moveMatches();
    var shown = m.slice(0, 200);
    var fromOpts = B.branches.map(function(b){ return '<option value="' + esc(b.id) + '"' + (b.id === mv.from ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('');
    var toOpts = '<option value="">Choose…</option>' + B.branches.filter(function(b){ return b.id !== mv.from; }).map(function(b){ return '<option value="' + esc(b.id) + '"' + (b.id === mv.to ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('');
    var fromLocked = !B.all; // in a single-branch view only that branch's students are loaded
    var rows = shown.map(function(s){
      return '<label><input type="checkbox" data-mv="' + esc(s.id) + '"' + (mv.picked.has(s.id) ? ' checked' : '') + '> <span>' + esc((s.firstName || '') + ' ' + (s.lastName || '')) + '</span><span class="br-note">' + esc(s.className || '') + (s.section ? '-' + esc(s.section) : '') + ' · ' + esc(s.admissionNo || '') + '</span></label>';
    }).join('') || '<p class="br-note" style="padding:10px">No students match.</p>';
    return '<h3>Move students between branches</h3><div class="br-card">' +
      '<p class="br-note" style="margin:0 0 10px">Moves the student together with their fee receipts, discounts, extra fees, attendance and marks. Useful when you first split an existing school into branches.' + (fromLocked ? '' : '') + '</p>' +
      '<div class="br-grid"><div><label>From branch</label><select id="mvFrom"' + (fromLocked ? ' disabled' : '') + '>' + fromOpts + '</select></div>' +
      '<div><label>Class</label><select id="mvCls"><option value="">All classes</option>' + classes.map(function(c){ return '<option' + (c === mv.cls ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Section</label><select id="mvSec"><option value="">All sections</option>' + secs.map(function(c){ return '<option' + (c === mv.sec ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Search</label><input id="mvQ" placeholder="Name or admission no." value="' + esc(mv.q) + '"></div></div>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-top:10px;flex-wrap:wrap"><label style="display:flex;gap:6px;align-items:center;font-weight:600;cursor:pointer"><input type="checkbox" id="mvAll"> Select all ' + m.length + ' matching</label><span class="br-note" id="mvCount">' + mv.picked.size + ' selected</span></div>' +
      '<div class="br-list" id="mvList">' + rows + '</div>' + (m.length > shown.length ? '<p class="br-note">Showing the first ' + shown.length + ' of ' + m.length + '. Narrow it with Class, Section or Search, or tick "Select all matching".</p>' : '') +
      '<div class="br-grid" style="margin-top:12px;align-items:end"><div><label>Move to</label><select id="mvTo">' + toOpts + '</select></div><div><button type="button" class="br-btn primary" id="mvGo">Move selected students</button></div></div></div>';
  }
  function wireMove(){
    var $ = function(id){ return document.getElementById(id); };
    if(!$('mvFrom')) return;
    var rerender = function(){ var y = document.getElementById('brBody').parentNode.scrollTop; var h = moveHtml(); var host = document.getElementById('brBody'); var i = host.innerHTML.indexOf('<h3>Move students'); host.innerHTML = host.innerHTML.slice(0, i) + h; wireMove(); };
    $('mvFrom').onchange = function(){ mv.from = this.value; mv.cls = ''; mv.sec = ''; mv.picked = new Set(); mv.to = ''; rerender(); };
    $('mvCls').onchange = function(){ mv.cls = this.value; mv.sec = ''; rerender(); };
    $('mvSec').onchange = function(){ mv.sec = this.value; rerender(); };
    var t; $('mvQ').oninput = function(){ var v = this.value; clearTimeout(t); t = setTimeout(function(){ mv.q = v; rerender(); var q = $('mvQ'); if(q){ q.focus(); q.setSelectionRange(v.length, v.length); } }, 250); };
    $('mvTo').onchange = function(){ mv.to = this.value; };
    $('mvAll').onchange = function(){ var on = this.checked; moveMatches().forEach(function(s){ if(on) mv.picked.add(s.id); else mv.picked.delete(s.id); }); rerender(); };
    $('mvList').onchange = function(e){ var id = e.target && e.target.getAttribute('data-mv'); if(!id) return; if(e.target.checked) mv.picked.add(id); else mv.picked.delete(id); $('mvCount').textContent = mv.picked.size + ' selected'; };
    $('mvGo').onclick = async function(){
      if(!mv.picked.size){ toast('Tick the students to move.'); return; }
      if(!mv.to){ toast('Choose the branch to move them to.'); return; }
      var ok = typeof showConfirmDialog === 'function' ? await showConfirmDialog('Move ' + mv.picked.size + ' student(s) to ' + nameOf(mv.to) + '? Their fees, attendance and marks move with them.', { title: 'Move students', okText: 'Move' }) : true;
      if(!ok) return;
      try{
        var r = await fetch('/api/branches/move-students', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ studentIds: Array.from(mv.picked), toBranch: mv.to }) });
        var j = await r.json().catch(function(){ return {}; });
        if(!r.ok){ toast(j.error || 'Could not move the students.'); return; }
        toast(j.moved + ' student(s) moved to ' + j.toName + '.');
        location.reload();
      }catch(e){ toast('Could not move the students.'); }
    };
  }

  // ------- Branch choice on user accounts -------
  function fillUserBranch(u){
    var f = document.getElementById('uBranchField'), s = document.getElementById('uBranch');
    if(!f || !s) return;
    if(!B.multi || !B.groupLevel || B.locked){ f.style.display = 'none'; return; }
    s.innerHTML = '<option value="">All branches (Admin / Principal only)</option>' + B.branches.map(function(b){ return '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>'; }).join('');
    var want = u ? (u.branchId || '') : (B.all ? B.mainId : (B.branchId || B.mainId));
    s.value = want;
    f.style.display = 'block';
  }
  var _open = window.openUserModal, _edit = window.editUser;
  if(typeof _open === 'function') window.openUserModal = function(){ var r = _open.apply(this, arguments); fillUserBranch(null); return r; };
  if(typeof _edit === 'function') window.editUser = function(id){ var r = _edit.apply(this, arguments); var u = (typeof users !== 'undefined') ? users.find(function(x){ return x.id === id; }) : null; fillUserBranch(u); return r; };


  // ------- Branch name, address and phone on receipts and printouts -------
  // Every printout reads the school profile (name, address, phone, email). While you work in a branch other than the
  // main one, those four details come from that branch instead (set in Branches > Edit). The saved school profile is
  // never changed: the Setup > School Profile screen and every save always use the real profile.
  var RAWSCHOOL = 0;
  function activeBranch(){
    if(RAWSCHOOL || !B.multi || B.all || !B.branchId || B.branchId === B.mainId) return null;
    return B.branches.find(function(x){ return x.id === B.branchId; }) || null;
  }
  function wrapSchoolInfo(){
    try{
      if(typeof schoolInfo !== 'object' || !schoolInfo || schoolInfo.__isBrOverlay) return;
      schoolInfo = new Proxy(schoolInfo, {
        get: function(t, k){
          if(k === '__isBrOverlay') return true;
          if(k === 'toJSON') return function(){ return Object.assign({}, t); };
          var b = activeBranch();
          if(b){
            if(k === 'name' && b.name) return b.name;
            if(k === 'address' && b.address) return b.address;
            if(k === 'phone' && b.phone) return b.phone;
            if(k === 'email' && b.email) return b.email;
          }
          return t[k];
        },
        set: function(t, k, v){ t[k] = v; return true; }
      });
    }catch(e){}
  }
  function rawWrap(name){
    var f = window[name];
    if(typeof f !== 'function' || f.__brRaw) return;
    var w = function(){
      RAWSCHOOL++;
      var r;
      try{ r = f.apply(this, arguments); }catch(e){ RAWSCHOOL--; throw e; }
      if(r && typeof r.then === 'function') return r.then(function(v){ RAWSCHOOL--; wrapSchoolInfo(); return v; }, function(e){ RAWSCHOOL--; wrapSchoolInfo(); throw e; });
      RAWSCHOOL--; wrapSchoolInfo(); return r;
    };
    w.__brRaw = true; window[name] = w;
  }
  ['loadSchoolInfo', 'renderSchoolProfileTab', 'scxProfileItems', 'scxMeter', 'scxSaveProfile', 'saveSchoolProfile'].forEach(rawWrap);
  // Anything that stores the school profile always stores the real one.
  var _ss = window.storageSet;
  if(typeof _ss === 'function' && !_ss.__brRaw){
    window.storageSet = function(k, v){
      if(k === 'school-info' && v && v.__isBrOverlay){ RAWSCHOOL++; try{ v = JSON.parse(JSON.stringify(v)); } finally { RAWSCHOOL--; } }
      return _ss.apply(this, [k, v].concat(Array.prototype.slice.call(arguments, 2)));
    };
    window.storageSet.__brRaw = true;
  }
  // "All branches" / "Branch: North Campus" for the heading of reports. '' for a single-branch school.
  window.branchScopeText = function(){
    if(!B.multi) return '';
    return B.all ? 'All branches' : ('Branch: ' + (nameOf(B.branchId) || ''));
  };

  // Run once the app has loaded for the signed-in user.
  var _apply = window.applyRolePermissions;
  if(typeof _apply === 'function'){
    window.applyRolePermissions = function(){
      var r = _apply.apply(this, arguments);
      try{ init(); }catch(e){}
      return r;
    };
  }
})();
