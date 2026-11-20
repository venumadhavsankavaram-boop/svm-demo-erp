/* =========================================================================
   Degree College: the dashboard panel. With the College Pack on and Degree College chosen, the school's "Total Strength"
   banner is replaced by "Degree College at a glance": students per programme and year with seats, and what needs
   attention today (low attendance, reimbursement files with something to fix, backlogs, internships still open).
   Reuses the look of the Junior College panel (95-college-dashboard.js).
   ========================================================================= */
(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isDG = () => { try { return typeof window.clgIsDegreeCollege === 'function' && window.clgIsDegreeCollege(); } catch(e){ return false; } };
  const yearIdx = c => { const m = /^(?:Honours|Degree) Year (\d)$/.exec(c || ''); return m ? Number(m[1]) : 0; };

  /* Pure: every number the panel shows, from plain data. dg = { S, R, X } from the Degree College pack. */
  function summarize({ students, dg, records }){
    const S = (dg && dg.S) || { programmes: [], grading: { attendanceMin: 75 } }, R = (dg && dg.R) || { marks: {} }, X = (dg && dg.X) || { reim: {}, intern: {} };
    const min = (S.grading && S.grading.attendanceMin) || 75;
    const act = (students || []).filter(s => yearIdx(s.className) >= 1);
    const progs = (S.programmes || []).map(p => {
      const years = p.pattern === 'degree3' ? 3 : 4, fam = p.pattern === 'degree3' ? 'Degree' : 'Honours';
      const counts = []; for(let n = 1; n <= years; n++) counts.push(act.filter(s => s.className === fam + ' Year ' + n && String(s.section || '').toLowerCase() === p.name.toLowerCase()).length);
      return { name: p.name, stream: p.stream, counts, seats: p.seats || [] };
    });
    const low = [], reimFix = [];
    act.forEach(s => {
      const days = {};
      (records || []).forEach(r => { if(!r || r.studentId !== s.id) return; const x = days[r.date] = days[r.date] || { a: false, p: false }; if(r.status === 'Absent') x.a = true; else if(r.status === 'Present' || r.status === 'Late') x.p = true; });
      let tot = 0, pres = 0; Object.keys(days).forEach(d => { if(days[d].p){ tot++; pres++; } else if(days[d].a) tot++; });
      const pct = tot ? pres * 100 / tot : null;
      if(pct != null && pct < min) low.push(s.id);
      const r = (X.reim || {})[s.id];
      if(r && r.applying){
        const bad = !String(r.incomeNo || '').trim() || !String(r.casteNo || '').trim() || !String(r.rationNo || '').trim() || r.bank !== 'Yes' || r.bio !== 'Yes' || (pct != null && pct < min);
        if(bad) reimFix.push(s.id);
      }
    });
    let backlogStudents = 0;
    const g = (window.dgCleanGrading || (x => x))(S.grading);
    act.forEach(s => {
      const m = (R.marks || {})[s.id]; if(!m) return;
      const p = (S.programmes || []).find(x => x.name.toLowerCase() === String(s.section || '').toLowerCase()); if(!p) return;
      const bad = (p.courses || []).some(c => { const r = window.dgCourseResult ? window.dgCourseResult(m[c.id], c, g) : null; return r && r.complete && !r.passed; });
      if(bad) backlogStudents++;
    });
    let openIntern = 0;
    act.forEach(s => { const r = (X.intern || {})[s.id] || {}; if(['community', 'short'].some(k => ((r[k] || {}).status || 'Not started') !== 'Completed')) openIntern++; });
    return { total: act.length, perYear: [1, 2, 3, 4].map(n => act.filter(s => yearIdx(s.className) === n).length), progs, low: low.length, min, reimFix: reimFix.length, backlogStudents, openIntern };
  }
  window.dgdSummarize = summarize;

  function panel(sm){
    const bar = (n, seats, label) => { const pct = seats ? Math.min(100, Math.round(100 * n / seats)) : 0; return `<div class="cd-meter">${esc(label)}: <b>${n}</b>${seats ? ' of ' + seats + ' seats' : ''}<i><em class="${seats && n >= seats ? 'full' : ''}" style="width:${pct}%"></em></i></div>`; };
    const cards = sm.progs.map(p => `<div class="cd-combo"><h4>${esc(p.name)}<small>${esc(p.stream || '')}</small></h4>${p.counts.map((n, i) => bar(n, p.seats[i] || 0, 'Year ' + (i + 1))).join('')}</div>`).join('');
    const tile = (num, text) => `<button type="button" class="cd-tile" onclick="switchView('classessetup')"><b>${num}</b><span>${esc(text)}</span></button>`;
    return `<div class="cd-head"><div><div class="cd-title">Degree College at a glance</div><div class="cd-sub">Students by programme and year, and what needs attention</div></div>
      <div class="cd-nums"><div class="cd-num"><b>${sm.total}</b><span>Students</span></div>${sm.perYear.map((n, i) => n ? `<div class="cd-num alt"><b>${n}</b><span>Year ${i + 1}</span></div>` : '').join('')}</div></div>
      ${cards ? `<div class="cd-grid">${cards}</div>` : ''}
      <div class="cd-tiles">${tile(sm.low, 'students below ' + sm.min + '% attendance')}${tile(sm.reimFix, 'fee reimbursement files to fix')}${tile(sm.backlogStudents, 'students with a backlog')}${tile(sm.openIntern, 'students with community service or short-term internship open')}</div>`;
  }

  async function render(){
    if(!isDG()) return;
    const el = document.getElementById('view-dashboard'); if(!el) return;
    let students = [], dg = null;
    try { students = scxActiveStudents(); } catch(e){}
    try { dg = window.dgData ? window.dgData() : null; } catch(e){}
    if(!dg || !dg.S || !dg.S.programmes.length){ try { dg = { S: await storageGet('degree-structure', { programmes: [], grading: {} }), R: await storageGet('degree-results', { marks: {} }), X: await storageGet('degree-extras', { reim: {}, intern: {} }) }; } catch(e){} }
    if(!document.getElementById('clgDashCss') && window.cldCss){ const st = document.createElement('style'); st.id = 'clgDashCss'; st.textContent = window.cldCss; document.head.appendChild(st); }
    const old = document.getElementById('clgDash'); if(old) old.remove();
    const host = document.createElement('div'); host.id = 'clgDash';
    let recs = []; try { recs = attendanceRecords; } catch(e){}
    host.innerHTML = panel(summarize({ students, dg, records: recs }));
    const top = el.querySelector('.topbar');
    if(top && top.parentNode) top.parentNode.insertBefore(host, top.nextSibling); else el.insertBefore(host, el.firstChild);
  }
  const prev = window.clgRenderDash;
  window.clgRenderDash = function(){ return Promise.resolve(prev ? prev.apply(this, arguments) : null).then(render, render); };

  const orig = (typeof renderDashboard === 'function') ? renderDashboard : null;
  if(orig && !orig.__dgd){
    const wrapped = async function(){ const r = await orig.apply(this, arguments); try { await render(); } catch(e){} return r; };
    wrapped.__dgd = true; window.renderDashboard = wrapped;
  }
})();
