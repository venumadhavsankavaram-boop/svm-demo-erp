/* Demo Trials (demo install only): give each school you show the demo its OWN login with an end date,
   see who has actually signed in, extend or switch off a trial, and copy a ready WhatsApp invite.
   Does nothing on a real school's install (the server says demo:false there). */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = m => { try{ showToast(m); }catch(e){ console.log(m); } };
  let isDemo = false, owner = false, data = null, invite = null, probed = false, busy = false;
  async function api(method, url, body){
    const r = await fetch(url, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let j = null; try{ j = await r.json(); }catch(e){}
    if(!r.ok){ const err = new Error((j && j.error) || 'Something went wrong'); err.status = r.status; throw err; }
    return j;
  }
  const dstr = iso => { if(!iso) return '-'; const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const ago = iso => { if(!iso) return 'Never'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if(m < 2) return 'Just now'; if(m < 60) return m + ' min ago'; if(m < 1440) return Math.round(m / 60) + ' hr ago'; const d = Math.round(m / 1440); return d + (d === 1 ? ' day ago' : ' days ago'); };

  function css(){
    if($('dtCss')) return;
    const s = document.createElement('style'); s.id = 'dtCss';
    s.textContent = `
      .dt-card{background:#fff;border:1px solid var(--border,#e3e8f3);border-radius:16px;padding:16px 18px;margin-bottom:14px;}
      .dt-card h3{margin:0 0 10px;font-size:1.05rem;color:var(--navy,#14325c);display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;}
      .dt-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end;} .dt-f label{font-size:.8rem;color:#667;display:block;margin-bottom:3px;}
      .dt-f input,.dt-f select,.dt-msg{width:100%;padding:9px;border:1px solid #d6dcea;border-radius:10px;font:inherit;box-sizing:border-box;}
      .dt-msg{min-height:150px;font-size:.88rem;line-height:1.5;background:#f7fbf8;}
      .dt-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px;} .dt-tile{background:#f4f7fd;border-radius:12px;padding:10px 12px;} .dt-tile b{display:block;font-size:1.4rem;color:#211a4e;} .dt-tile span{font-size:.78rem;color:#667;}
      .dt-tbl{width:100%;border-collapse:collapse;font-size:.88rem;} .dt-tbl th,.dt-tbl td{text-align:left;padding:8px 6px;border-top:1px solid #eef1f7;vertical-align:top;} .dt-tbl th{font-size:.74rem;color:#667;text-transform:uppercase;}
      .dt-pill{font-weight:700;font-size:.74rem;padding:3px 10px;border-radius:999px;white-space:nowrap;display:inline-block;} .dt-acts{display:flex;gap:6px;flex-wrap:wrap;}
      .dt-note{font-size:.84rem;color:#667;line-height:1.45;margin-top:6px;}
    `;
    document.head.appendChild(s);
  }
  const ROLE_HELP = { 'Admin': 'everything: students, fees, accounts, staff, settings', 'Principal': 'the management view', 'Accountant': 'fees, receipts and accounts', 'Office Assistant': 'front-office work', 'Teacher': 'attendance, marks and homework', 'Parent': 'the parent app: fees, attendance and notices', 'Student': 'the student view' };
  function inviteText(list, pw){
    list = Array.isArray(list) ? list : [list]; const t = list[0];
    const head = `Hello${t.contact ? ' ' + t.contact : ''},\n\nHere ${list.length > 1 ? 'are your trial logins' : 'is your trial login'} for the SVM EdTech School ERP demo. It holds sample data only, so try anything freely.\n\nLink: ${location.origin}\n`;
    const who = list.length > 1 ? `Password (the same for every login): ${pw}\n\nSign in with each one to see that part of the school:\n${list.map(x => '- ' + x.role + ' (' + (ROLE_HELP[x.role] || x.role) + '): ' + x.username).join('\n')}\n` : `Username: ${t.username}\nPassword: ${pw}\nYou are signing in as: ${t.role}\n`;
    return head + who + `\nValid until: ${dstr(t.expiresAt)}\n\nThe sample data resets every night. Reply here if you would like a short walkthrough.\n\nSVM EdTech`;
  }
  const groupsOf = ts => { const m = new Map(); ts.forEach(t => { const k = t.school + '|' + (t.createdAt || '').slice(0, 16); if(!m.has(k)) m.set(k, []); m.get(k).push(t); }); return Array.from(m.values()); };
  function status(t){
    if(t.revoked) return ['#fde4e1', '#b3261e', 'Switched off'];
    if(t.expired) return ['#eceff4', '#555', 'Ended'];
    const d = Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 86400000));
    return ['#dff5e6', '#17703a', d + (d === 1 ? ' day left' : ' days left')];
  }
  function ensureShell(){
    if(!isDemo || !owner || !currentUser || currentUser.role !== 'Admin') return;
    css();
    const dash = $('view-dashboard');
    if(dash && !$('view-demotrials')){ const v = document.createElement('div'); v.id = 'view-demotrials'; v.style.display = 'none'; dash.parentNode.insertBefore(v, dash); }
    const anchor = $('navAdminTools2') || $('navUsersRoles');
    if(anchor && !$('navDemoTrials')){
      const b = document.createElement('button'); b.className = 'sb-link'; b.id = 'navDemoTrials'; b.setAttribute('onclick', "switchView('demotrials')");
      b.innerHTML = '<span class="sb-icon-wrap"><svg class="sb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8l9-5 9 5-9 5z"/><path d="M7 11v5c2 2 8 2 10 0v-5"/></svg></span> Demo Trials';
      anchor.insertAdjacentElement('afterend', b);
    }
  }
  async function probe(){
    if(probed) return; probed = true;
    try{
      const info = await (await fetch('/api/demo-info', { cache: 'no-store' })).json(); isDemo = !!(info && info.demo);
      if(!isDemo || !currentUser || currentUser.role !== 'Admin') return;
      await api('GET', '/api/demo/trials'); owner = true; ensureShell(); const n = $('navDemoTrials'); if(n) n.style.display = 'flex';
      try{ if(typeof updateSbSectionVisibility === 'function') updateSbSectionVisibility(); }catch(e){}
    }catch(e){ owner = false; }
  }
  async function load(){ try{ data = await api('GET', '/api/demo/trials'); }catch(e){ toast(e.message); } }
  async function render(){
    const v = $('view-demotrials'); if(!v) return; if(!data) await load(); if(!data) return;
    const ts = data.trials, G = groupsOf(ts), live = G.filter(g => g.some(t => !t.revoked && !t.expired));
    v.innerHTML = `<div class="topbar"><div><h1>Demo Trials</h1><p style="margin:0;color:#667">Give each school its own demo login with an end date, and see who has really opened it.</p></div></div>
      <div class="dt-tiles"><div class="dt-tile"><b>${live.length}</b><span>Active trials</span></div><div class="dt-tile"><b>${G.filter(g => g.some(t => t.logins > 0)).length}</b><span>Opened at least once</span></div><div class="dt-tile"><b>${live.filter(g => g.every(t => !t.logins)).length}</b><span>Active, never opened</span></div><div class="dt-tile"><b>${G.length - live.length}</b><span>Ended or off</span></div></div>
      <div class="dt-card"><h3>Create a trial login</h3><div class="dt-f">
        <div><label>School name *</label><input id="dtSchool" placeholder="e.g. Green Valley School"></div>
        <div><label>Contact person</label><input id="dtContact" placeholder="Principal / owner"></div>
        <div><label>WhatsApp number</label><input id="dtPhone" placeholder="98xxxxxxxx" inputmode="tel"></div>
        <div><label>Sign in as</label><select id="dtRole"><option value="All">All roles - full experience (recommended)</option>${data.roles.map(r => `<option>${esc(r)}</option>`).join('')}</select></div>
        <div><label>Valid for (days)</label><input id="dtDays" type="number" min="1" max="60" value="7"></div>
        <div><button class="btn btn-primary" id="dtCreate" style="width:100%">Create login</button></div></div>
        <div class="dt-note"><b>All roles</b> makes one login for each role (Admin, Principal, Accountant, Office Assistant, Teacher, Parent, Student) with the same password, so the school can try every view. A trial login can look around and try things, but cannot see or change logins, passwords or the audit trail.</div></div>
      ${invite ? `<div class="dt-card" style="border-left:6px solid #17703a"><h3>Message ready to send <span style="font-size:.8rem;color:#b3261e;font-weight:600">The password is shown only now</span></h3><textarea class="dt-msg" id="dtMsg" readonly>${esc(invite.text)}</textarea>
        <div class="dt-acts" style="margin-top:8px"><button class="btn btn-primary" id="dtCopy">Copy message</button>${invite.phone ? `<a class="btn btn-secondary" target="_blank" rel="noopener" href="https://wa.me/${esc(invite.phone.length === 10 ? '91' + invite.phone : invite.phone)}?text=${encodeURIComponent(invite.text)}">Open in WhatsApp</a>` : ''}<button class="btn btn-secondary" id="dtDone">Done</button></div></div>` : ''}
      <div class="dt-card"><h3>Trials <label style="font-size:.84rem;font-weight:500;color:#445"><input type="checkbox" id="dtShow" ${data.showLogins ? 'checked' : ''}> Show the shared demo logins on the sign-in page</label></h3>
        ${ts.length ? `<div style="overflow:auto"><table class="dt-tbl"><thead><tr><th>School</th><th>Contact</th><th>Role / username</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>
        ${G.map(g => { const t0 = g[0], st = status(g.find(t => !t.revoked && !t.expired) || t0), ids = g.map(t => t.id).join(','), last = g.map(t => t.lastLogin).filter(Boolean).sort().pop() || '', n = g.reduce((s, t) => s + t.logins, 0), allOff = g.every(t => t.revoked);
          return `<tr><td><b>${esc(t0.school)}</b><div class="dt-note" style="margin:0">Created ${dstr(t0.createdAt)}</div></td><td>${esc(t0.contact || '-')}<div class="dt-note" style="margin:0">${esc(t0.phone || '')}</div></td><td>${g.map(t => esc(t.role) + ': <b>' + esc(t.username) + '</b>').join('<br>')}</td>
          <td><span class="dt-pill" style="background:${st[0]};color:${st[1]}">${esc(st[2])}</span><div class="dt-note" style="margin:2px 0 0">to ${dstr(t0.expiresAt)}</div></td><td>${n ? esc(ago(last)) + '<div class="dt-note" style="margin:0">' + n + ' sign-in' + (n === 1 ? '' : 's') + '</div>' : '<span style="color:#8a5a00">Never opened</span>'}</td>
          <td><div class="dt-acts"><button class="btn btn-secondary" data-a="extend" data-id="${esc(ids)}">+7 days</button><button class="btn btn-secondary" data-a="pw" data-id="${esc(ids)}">New password</button><button class="btn btn-secondary" data-a="${allOff ? 'on' : 'off'}" data-id="${esc(ids)}">${allOff ? 'Switch on' : 'Switch off'}</button><button class="btn btn-secondary" data-a="del" data-id="${esc(ids)}">Delete</button></div></td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="dt-note">No trial logins yet. Create the first one above.</div>'}
        <div class="dt-note">Everything resets to fresh sample data every night at 2 AM, but trial logins stay until they end. Passwords are stored scrambled, so use "New password" if a school loses theirs.</div></div>`;
    $('dtCreate').onclick = create;
    const cp = $('dtCopy'); if(cp) cp.onclick = async () => { try{ await navigator.clipboard.writeText(invite.text); toast('Copied.'); }catch(e){ $('dtMsg').select(); document.execCommand('copy'); toast('Copied.'); } };
    const dn = $('dtDone'); if(dn) dn.onclick = () => { invite = null; render(); };
    $('dtShow').onchange = async e => { try{ await api('PUT', '/api/demo/public-logins', { show: e.target.checked }); data.showLogins = e.target.checked; toast(e.target.checked ? 'Shared logins are shown on the sign-in page.' : 'Shared logins are now hidden from the sign-in page.'); }catch(er){ toast(er.message); e.target.checked = !e.target.checked; } };
    v.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => act(b.dataset.a, b.dataset.id));
  }
  async function create(){
    if(busy) return; const g = id => ($(id) || {}).value || '';
    if(!g('dtSchool').trim()) return toast('Please type the school name.');
    busy = true;
    try{
      const j = await api('POST', '/api/demo/trials', { school: g('dtSchool'), contact: g('dtContact'), phone: g('dtPhone'), role: g('dtRole') || 'All', days: g('dtDays') });
      invite = { text: inviteText(j.trials || [j.trial], j.password), phone: j.trial.phone.replace(/\D/g, '') }; data = null; await render(); const m = $('dtMsg'); if(m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }catch(e){ toast(e.message); } busy = false;
  }
  async function act(a, id){
    const ids = String(id).split(','), g = data.trials.filter(x => ids.indexOf(x.id) >= 0), t = g[0]; if(!t || busy) return; busy = true;
    try{
      if(a === 'extend'){ for(const x of g) await api('POST', '/api/demo/trials/' + x.id + '/extend', { days: 7 }); toast('Extended by 7 days.'); }
      else if(a === 'off' || a === 'on'){ for(const x of g) await api('POST', '/api/demo/trials/' + x.id + '/revoke', { revoked: a === 'off' }); toast(a === 'off' ? 'Switched off. They are signed out.' : 'Switched on.'); }
      else if(a === 'pw'){ if(!confirm('Make a new password for ' + t.school + '? The old one stops working.')) { busy = false; return; } const j = await api('POST', '/api/demo/trials/' + t.id + '/password', {}); for(const x of g.slice(1)) await api('POST', '/api/demo/trials/' + x.id + '/password', { password: j.password }); invite = { text: inviteText(g, j.password), phone: (t.phone || '').replace(/\D/g, '') }; }
      else if(a === 'del'){ if(!confirm('Delete the trial for ' + t.school + '? Their login' + (g.length > 1 ? 's stop' : ' stops') + ' working for good.')) { busy = false; return; } for(const x of g) await api('DELETE', '/api/demo/trials/' + x.id); toast('Deleted.'); }
      data = null; await render();
    }catch(e){ toast(e.message); } busy = false;
  }
  const origSwitch = window.switchView;
  window.switchView = function(view){
    try{ probe().then(ensureShell); ensureShell(); }catch(e){}
    if(view !== 'demotrials' || !owner){
      const r = origSwitch.apply(this, arguments);
      const v = $('view-demotrials'); if(v) v.style.display = 'none';
      const n = $('navDemoTrials'); if(n) n.classList.remove('active');
      return r;
    }
    const root = $('view-dashboard') ? $('view-dashboard').parentNode : null;
    if(root) Array.from(root.children).forEach(c => { if(c.id && c.id.indexOf('view-') === 0 && c.id !== 'view-demotrials') c.style.display = 'none'; });
    document.querySelectorAll('.sb-link.active').forEach(b => b.classList.remove('active'));
    const n = $('navDemoTrials'); if(n) n.classList.add('active');
    $('view-demotrials').style.display = 'block';
    try{ closeMobileSidebar(); }catch(e){}
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    data = null; invite = null; render();
  };
  if(typeof applyRolePermissions === 'function'){
    const o = applyRolePermissions;
    window.applyRolePermissions = function(){
      const r = o.apply(this, arguments);
      try{
        if(!currentUser || currentUser.role !== 'Admin'){ const n = $('navDemoTrials'); if(n) n.remove(); probed = false; owner = false; }
        else { probe(); if(owner){ ensureShell(); const n = $('navDemoTrials'); if(n) n.style.display = 'flex'; } }
      }catch(e){}
      return r;
    };
  }
})();
