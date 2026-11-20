/* =========================================================================
   Junior College: the college dashboard. With the College Pack on and Junior College chosen, the school's "Total Strength"
   banner is replaced (see the college look in index.html) by a "College at a glance" panel: students per year, each
   combination with its seats, and four things a college looks at every day. Everything else on the dashboard stays.
   ========================================================================= */
(function(){
  'use strict';
  const YEARS = ['1st Year', '2nd Year'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase();
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const isJC = () => { try { return typeof window.clgIsJuniorCollege === 'function' && window.clgIsJuniorCollege(); } catch(e){ return false; } };

  /* Pure: every number the panel shows, from plain data. */
  function summarize({ students, combos, board, schol, absentDays, streaks }){
    const act = (students || []).filter(s => YEARS.includes(s.className));
    const count = (y, c) => act.filter(s => s.className === y && norm(s.section) === norm(c)).length;
    const perCombo = (combos || []).map(c => ({ name: c.name, stream: c.stream, y1: count(YEARS[0], c.name), y2: count(YEARS[1], c.name), s1: (c.seats || [])[0] || 0, s2: (c.seats || [])[1] || 0 }));
    const second = act.filter(s => s.className === YEARS[1]);
    const b = (board && board.students) || {};
    const ticketsPending = second.filter(s => { const r = b[s.id]; return !r || !['Handed over'].includes(r.ticket); }).length;
    const first = act.filter(s => s.className === YEARS[0]);
    const released = second.map(s => b[s.id] && b[s.id].res && b[s.id].res[YEARS[0]]).filter(x => x && (x.result === 'Pass' || x.result === 'Fail'));
    const passPct = released.length ? Math.round(100 * released.filter(x => x.result === 'Pass').length / released.length) : null;
    const recs = (schol && schol.records) || [];
    const pending = recs.filter(r => r.status !== 'Rejected').reduce((a, r) => a + Math.max(0, (Number(r.claimed) || 0) - (Number(r.received) || 0)), 0);
    return { total: act.length, y1: first.length, y2: second.length, perCombo, ticketsPending, passPct, passOf: released.length, scholPending: pending, absent: streaks ? streaks.length : 0, absentDays };
  }
  window.cldSummarize = summarize;

  const CSS = `
  #clgDash{margin:6px 0 20px}
  #clgDash .cd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
  #clgDash .cd-title{font-family:inherit;font-weight:800;font-size:1.25rem;color:var(--navy)}
  #clgDash .cd-sub{font-size:.8rem;color:var(--ink-soft)}
  #clgDash .cd-nums{display:flex;gap:10px;flex-wrap:wrap}
  #clgDash .cd-num{background:var(--login-accent);color:#fff;border-radius:8px;padding:10px 16px;min-width:110px}
  #clgDash .cd-num b{display:block;font-size:1.6rem;line-height:1.1}
  #clgDash .cd-num span{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;opacity:.85}
  #clgDash .cd-num.alt{background:var(--white);color:var(--ink);border:1px solid var(--border)}
  #clgDash .cd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:12px}
  #clgDash .cd-combo{background:var(--white);border:1px solid var(--border);border-top:3px solid var(--login-accent);border-radius:8px;padding:12px 14px}
  #clgDash .cd-combo h4{margin:0;font-size:1rem;color:var(--navy);display:flex;justify-content:space-between;align-items:baseline}
  #clgDash .cd-combo h4 small{font-weight:500;color:var(--ink-soft);font-size:.72rem}
  #clgDash .cd-meter{margin-top:8px;font-size:.76rem;color:var(--ink-soft)}
  #clgDash .cd-meter i{display:block;height:6px;border-radius:3px;background:rgba(var(--login-accent-rgb),.14);margin-top:3px;overflow:hidden}
  #clgDash .cd-meter i em{display:block;height:100%;background:var(--login-accent)}
  #clgDash .cd-meter i em.full{background:var(--danger,#D11073)}
  #clgDash .cd-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
  #clgDash .cd-tile{background:var(--white);border:1px solid var(--border);border-radius:8px;padding:12px 14px;cursor:pointer;text-align:left;font:inherit;color:inherit}
  #clgDash .cd-tile:hover{border-color:var(--login-accent)}
  #clgDash .cd-tile b{display:block;font-size:1.35rem;color:var(--navy)}
  #clgDash .cd-tile span{font-size:.76rem;color:var(--ink-soft)}`;

  window.cldCss = CSS;

  function panel(sm){
    const bar = (n, seats, label) => {
      const pct = seats ? Math.min(100, Math.round(100 * n / seats)) : 0;
      return `<div class="cd-meter">${esc(label)}: <b>${n}</b>${seats ? ' of ' + seats + ' seats' : ''}<i><em class="${seats && n >= seats ? 'full' : ''}" style="width:${pct}%"></em></i></div>`;
    };
    const combos = sm.perCombo.map(c => `<div class="cd-combo"><h4>${esc(c.name)}<small>${esc(c.stream || '')}</small></h4>${bar(c.y1, c.s1, '1st Year')}${bar(c.y2, c.s2, '2nd Year')}</div>`).join('');
    const tile = (num, text, view) => `<button type="button" class="cd-tile" onclick="switchView('${view}')"><b>${num}</b><span>${esc(text)}</span></button>`;
    return `<div class="cd-head"><div><div class="cd-title">College at a glance</div><div class="cd-sub">Students by year and combination, and what needs attention</div></div>
      <div class="cd-nums"><div class="cd-num"><b>${sm.total}</b><span>Students</span></div><div class="cd-num alt"><b>${sm.y1}</b><span>1st Year</span></div><div class="cd-num alt"><b>${sm.y2}</b><span>2nd Year</span></div></div></div>
      ${combos ? `<div class="cd-grid">${combos}</div>` : ''}
      <div class="cd-tiles">
        ${tile(sm.absent, 'absent ' + sm.absentDays + '+ days in a row', 'classessetup')}
        ${tile(sm.ticketsPending, '2nd Year hall tickets not handed over', 'classessetup')}
        ${tile(sm.scholPending ? inr(sm.scholPending) : '₹0', 'scholarship money still to come', 'classessetup')}
        ${tile(sm.passPct == null ? '-' : sm.passPct + '%', sm.passPct == null ? '1st Year board results not entered' : '1st Year board pass rate (' + sm.passOf + ' released)', 'classessetup')}
      </div>`;
  }

  async function render(){
    if(!isJC()) return;
    const el = document.getElementById('view-dashboard'); if(!el) return;
    let board = { students: {} }, schol = { records: [] }, absent = { days: 3 };
    try { board = await storageGet('college-board', board); } catch(e){}
    try { schol = await storageGet('college-scholarships', schol); } catch(e){}
    try { absent = await storageGet('college-absence', absent); } catch(e){}
    const days = Math.max(2, Math.min(30, Number(absent && absent.days) || 3));
    let students = [], streaks = [], combos = [];
    try { students = scxActiveStudents(); } catch(e){}
    try { combos = (window.clgData().combos) || []; } catch(e){}
    try { streaks = window.clabStreaks(attendanceRecords, students.filter(s => YEARS.includes(s.className)), days); } catch(e){}
    if(!document.getElementById('clgDashCss')){ const st = document.createElement('style'); st.id = 'clgDashCss'; st.textContent = CSS; document.head.appendChild(st); }
    const old = document.getElementById('clgDash'); if(old) old.remove();
    const host = document.createElement('div'); host.id = 'clgDash';
    host.innerHTML = panel(summarize({ students, combos, board, schol, absentDays: days, streaks }));
    const top = el.querySelector('.topbar');
    if(top && top.parentNode) top.parentNode.insertBefore(host, top.nextSibling); else el.insertBefore(host, el.firstChild);
  }
  window.clgRenderDash = render;

  /* Add the panel after the normal dashboard has drawn. */
  const orig = (typeof renderDashboard === 'function') ? renderDashboard : null;
  if(orig && !orig.__cld){
    const wrapped = async function(){
      const r = await orig.apply(this, arguments);
      try {
        await render();
      } catch(e){}
      return r;
    };
    wrapped.__cld = true;
    window.renderDashboard = wrapped;
  }
})();
