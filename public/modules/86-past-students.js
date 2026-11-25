/* Copyright (c) 2026 SVM EdTech. All rights reserved. Proprietary and confidential.
   Unauthorised copying, modification or distribution of this file is prohibited. See LICENSE. */
/* ============================================================================
   Past Students (Alumni)
   ----------------------------------------------------------------------------
   Every school drops its highest class at year end - there is no next class to
   move them to - but the school still needs them afterwards: old dues to
   collect, receipts of earlier years, certificates (TC / study / bonafide) and
   the board marks sheet. This page keeps all of that in one list.

   A past student is anyone whose status is not Active (Passed Out, Transferred,
   Inactive). Graduation now sets status "Passed Out" and remembers the year in
   student.passedOutYear. Extra fields, saved with the student like any other:
     passedOutYear  e.g. "2025-26"      joinedClass  e.g. "LKG"
   Old dues are the unpaid "extra fees" of the student (carried-forward and
   opening balances included) - the same numbers the fee reports show.
   ========================================================================== */
(function(){
  const MARKS = ['Not received', 'Received', 'Handed over'];
  const PS = { q: '', status: 'all', year: 'all', owes: 'all', cls: 'all', marks: 'all', edit: '' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const isPast = s => !s.deleted && String(s.status || 'Active').trim().toLowerCase() !== 'active';
  const nameOf = s => ((s.lastName || '') + ' ' + (s.firstName || '')).trim();

  function leftInfo(s){
    // Year they left: the remembered one, else the year-end record written when they were promoted / graduated.
    const hist = (typeof feeYearHistory !== 'undefined' ? feeYearHistory : []).filter(h => h.studentId === s.id && (h.outcome === 'Graduated' || h.outcome === 'Transferred'));
    hist.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { year: s.passedOutYear || (hist[0] && hist[0].academicYear) || '', outcome: hist[0] ? hist[0].outcome : '' };
  }
  function oldDue(s){
    const F = window.__feeReports; if(!F || !F.studentFigures) return 0;
    try { const f = F.studentFigures(s, { types: [], old: true, extras: true }); return Math.round((f.oldDue || 0) + (f.extraDue || 0)); } catch(e){ return 0; }
  }
  function rowsAll(){
    return (students || []).filter(isPast).map(s => {
      const li = leftInfo(s), pays = (payments || []).filter(p => p.studentId === s.id && !p.voided);
      return { s, name: nameOf(s), year: li.year, due: oldDue(s), receipts: pays.length, paid: pays.reduce((a, p) => a + (typeof payNet === 'function' ? payNet(p) : Number(p.amount) || 0), 0),
        status: s.status || 'Inactive', joined: s.joinedClass || '', last: s.className || '', marks: s.boardMarksStatus || 'Not received' };
    });
  }
  function filtered(all){
    const q = PS.q.trim().toLowerCase();
    return all.filter(r => (!q || (r.name + ' ' + (r.s.admissionNo || '') + ' ' + (r.s.fatherName || '')).toLowerCase().includes(q))
      && (PS.status === 'all' || r.status === PS.status) && (PS.year === 'all' || r.year === PS.year) && (PS.cls === 'all' || r.last === PS.cls)
      && (PS.marks === 'all' || r.marks === PS.marks)
      && (PS.owes === 'all' || (PS.owes === 'yes' ? r.due > 0 : r.due <= 0)))
      .sort((a, b) => String(b.year).localeCompare(String(a.year)) || a.name.localeCompare(b.name));
  }

  function shell(){
    let el = document.getElementById('psOverlay');
    if(!el){
      el = document.createElement('div'); el.id = 'psOverlay';
      el.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(10,14,40,.55);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px;';
      el.innerHTML = '<div id="psBox" style="background:var(--card,#fff);color:var(--ink,#141a3c);border-radius:14px;max-width:1100px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);"></div>';
      el.addEventListener('mousedown', e => { if(e.target === el) closePastStudents(); });
      document.body.appendChild(el);
    }
    return el;
  }
  function paint(){
    const all = rowsAll(), list = filtered(all), box = document.getElementById('psBox');
    const years = [...new Set(all.map(r => r.year).filter(Boolean))].sort().reverse();
    const classes = [...new Set(all.map(r => r.last).filter(Boolean))];
    const statuses = [...new Set(all.map(r => r.status))];
    const owing = all.filter(r => r.due > 0), owingTotal = owing.reduce((a, r) => a + r.due, 0);
    const sel = (id, val, opts, label) => `<select id="${id}" onchange="psSet('${id}',this.value)" style="padding:7px 9px;border:1px solid var(--line,#d9ddec);border-radius:8px;"><option value="all">${label}</option>${opts.map(o => `<option ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
        <div><h2 style="margin:0;color:var(--navy,#1f2a6b);">Past Students (Alumni)</h2>
          <div style="color:var(--ink-soft,#55608a);font-size:.85rem;margin-top:4px;">Students who passed out, left or are inactive - with their old dues, receipts and certificates.</div></div>
        <button class="btn btn-ghost" onclick="closePastStudents()">Close</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0;">
        <div style="border:1px solid var(--line,#d9ddec);border-radius:10px;padding:10px 14px;"><b style="font-size:1.4rem;">${all.length}</b><div style="font-size:.78rem;color:var(--ink-soft,#55608a);">past students</div></div>
        <div style="border:1px solid var(--line,#d9ddec);border-radius:10px;padding:10px 14px;"><b style="font-size:1.4rem;color:${owing.length ? '#b3261e' : 'inherit'};">${owing.length}</b><div style="font-size:.78rem;color:var(--ink-soft,#55608a);">still owe money</div></div>
        <div style="border:1px solid var(--line,#d9ddec);border-radius:10px;padding:10px 14px;"><b style="font-size:1.4rem;color:${owingTotal ? '#b3261e' : 'inherit'};">${rs(owingTotal)}</b><div style="font-size:.78rem;color:var(--ink-soft,#55608a);">old dues to collect</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <input id="psQ" value="${esc(PS.q)}" placeholder="Search name, admission no, father" oninput="psSearch(this.value)" style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--line,#d9ddec);border-radius:8px;">
        ${sel('psStatus', PS.status, statuses, 'Any status')}${sel('psYear', PS.year, years, 'Any year')}${sel('psCls', PS.cls, classes, 'Any last class')}
        <select id="psOwes" onchange="psSet('psOwes',this.value)" style="padding:7px 9px;border:1px solid var(--line,#d9ddec);border-radius:8px;"><option value="all">Dues: any</option><option value="yes" ${PS.owes === 'yes' ? 'selected' : ''}>Owes money</option><option value="no" ${PS.owes === 'no' ? 'selected' : ''}>No dues</option></select>
        <select id="psMarks" onchange="psSet('psMarks',this.value)" style="padding:7px 9px;border:1px solid var(--line,#d9ddec);border-radius:8px;"><option value="all">Marks sheet: any</option>${MARKS.map(o => `<option ${PS.marks === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        <button class="btn btn-ghost" onclick="psExport()">Download Excel</button>
      </div>
      <div style="overflow-x:auto;border:1px solid var(--line,#d9ddec);border-radius:10px;"><table style="width:100%;border-collapse:collapse;font-size:.85rem;">
        <thead><tr style="background:var(--soft,#edeff8);text-align:left;">${['Name', 'Adm. No', 'Joined', 'Last class', 'Status', 'Year', 'Old dues', 'Receipts', 'Marks sheet', ''].map(h => `<th style="padding:8px;white-space:nowrap;">${h}</th>`).join('')}</tr></thead>
        <tbody>${list.slice(0, 300).map(r => `<tr style="border-top:1px solid var(--line,#d9ddec);">
          <td style="padding:7px 8px;"><b>${esc(r.name)}</b><div style="color:var(--ink-soft,#55608a);font-size:.75rem;">${esc(r.s.fatherName || '')}</div></td>
          <td style="padding:7px 8px;">${esc(r.s.admissionNo || '')}</td><td style="padding:7px 8px;">${esc(r.joined || '—')}</td><td style="padding:7px 8px;">${esc(r.last)}</td>
          <td style="padding:7px 8px;">${esc(r.status)}</td><td style="padding:7px 8px;">${esc(r.year || '—')}</td>
          <td style="padding:7px 8px;font-weight:600;color:${r.due > 0 ? '#b3261e' : 'inherit'};">${r.due > 0 ? rs(r.due) : '—'}</td><td style="padding:7px 8px;">${r.receipts}</td>
          <td style="padding:7px 8px;white-space:nowrap;color:${r.marks === 'Handed over' ? '#1b7a3a' : r.marks === 'Received' ? '#b26a00' : 'inherit'};">${esc(r.marks)}${r.s.boardMarksDate ? '<div style="font-size:.72rem;color:var(--ink-soft,#55608a);">' + esc(r.s.boardMarksDate) + '</div>' : ''}</td>
          <td style="padding:7px 8px;white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="psFees('${esc(r.s.id)}')">Fees</button> <button class="btn btn-ghost btn-sm" onclick="psEdit('${esc(r.s.id)}')">Edit</button></td></tr>`).join('') || `<tr><td colspan="10" style="padding:22px;text-align:center;color:var(--ink-soft,#55608a);">${all.length ? 'No students match these filters.' : 'No past students yet. Students appear here when they are promoted out of the highest class, transferred, or set to Inactive.'}</td></tr>`}</tbody></table></div>
      ${list.length > 300 ? `<div style="font-size:.8rem;color:var(--ink-soft,#55608a);margin-top:6px;">Showing the first 300 of ${list.length}. Use the filters or download Excel for all.</div>` : ''}
      <div style="font-size:.78rem;color:var(--ink-soft,#55608a);margin-top:10px;">Certificates (TC, study, bonafide) for past students: use <b>More Actions</b> and pick the student. Old dues are collected from the student's fee page (press <b>Fees</b>).</div>
      <div id="psEditBox"></div>`;
    if(PS.edit) paintEdit();
  }
  function paintEdit(){
    const s = (students || []).find(x => x.id === PS.edit), box = document.getElementById('psEditBox'); if(!s || !box) return;
    const cls = (typeof CLASS_LEVELS !== 'undefined' ? CLASS_LEVELS : []);
    const st = ['Passed Out', 'Transferred', 'Inactive', 'Active'], opt = (arr, v) => ['', ...arr].map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const f = 'padding:7px 9px;border:1px solid var(--line,#d9ddec);border-radius:8px;width:100%;';
    box.innerHTML = `<div style="margin-top:16px;border:2px solid var(--navy,#1f2a6b);border-radius:12px;padding:14px;">
      <b>${esc(nameOf(s))}</b> <span style="color:var(--ink-soft,#55608a);">(${esc(s.admissionNo || '')})</span>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:10px 0;">
        <label>Status<select id="psEStatus" style="${f}">${opt(st, s.status || 'Inactive')}</select></label>
        <label>Year they left<input id="psEYear" value="${esc(s.passedOutYear || leftInfo(s).year)}" placeholder="2025-26" style="${f}"></label>
        <label>Class they joined<select id="psEJoin" style="${f}">${opt(cls, s.joinedClass || '')}</select></label>
        <label>Last class<select id="psELast" style="${f}">${opt(cls, s.className || '')}</select></label></div>
      <div style="font-weight:600;margin:4px 0;">Board marks sheet</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:6px 0 10px;">
        <label>Where is it<select id="psEMarks" style="${f}">${MARKS.map(o => `<option ${o === (s.boardMarksStatus || 'Not received') ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
        <label>Date<input id="psEMDate" type="date" value="${esc(s.boardMarksDate || '')}" style="${f}"></label>
        <label>Handed to (name / signature taken)<input id="psEMTo" value="${esc(s.boardMarksTo || '')}" placeholder="Father / self / other" style="${f}"></label></div>
      <div style="font-size:.78rem;color:var(--ink-soft,#55608a);margin-bottom:8px;">Setting status to <b>Active</b> brings the student back into the normal lists.</div>
      <button class="btn btn-primary" onclick="psSave()">Save</button> <button class="btn btn-ghost" onclick="psEditClose()">Cancel</button></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  window.openPastStudents = async function(){
    try {
      const m = document.getElementById('moreActionsMenu'); if(m) m.classList.remove('open');
      await Promise.all([ensureDataLoaded('payments', loadPaymentsData), ensureDataLoaded('feeExtras', loadFeeExtras), typeof fyhEnsure === 'function' ? fyhEnsure() : null]);
    } catch(e){ /* show what we have */ }
    PS.edit = ''; shell().style.display = 'flex'; paint();
  };
  window.closePastStudents = function(){ const el = document.getElementById('psOverlay'); if(el) el.style.display = 'none'; };
  window.psSet = (id, v) => { PS[{ psStatus: 'status', psYear: 'year', psCls: 'cls', psOwes: 'owes', psMarks: 'marks' }[id]] = v; paint(); };
  let _t; window.psSearch = v => { PS.q = v; clearTimeout(_t); _t = setTimeout(() => { paint(); const i = document.getElementById('psQ'); if(i){ i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); };
  window.psFees = id => { closePastStudents(); try { switchView('managefee'); setTimeout(() => openStudentLedger(id), 400); } catch(e){ showToast('Open Manage Fee and search for the student.'); } };
  window.psEdit = id => { PS.edit = id; paintEdit(); };
  window.psEditClose = () => { PS.edit = ''; const b = document.getElementById('psEditBox'); if(b) b.innerHTML = ''; };
  window.psSave = async function(){
    const s = (students || []).find(x => x.id === PS.edit); if(!s) return;
    const v = id => (document.getElementById(id) || {}).value || '';
    if(typeof isManagementUser === 'function' && !isManagementUser()){ showToast('Only Admin or Principal can change this.'); return; }
    s.status = v('psEStatus') || s.status; s.passedOutYear = v('psEYear').trim(); s.joinedClass = v('psEJoin'); s.boardMarksStatus = v('psEMarks') || 'Not received'; s.boardMarksDate = v('psEMDate'); s.boardMarksTo = v('psEMTo').trim(); if(v('psELast')) s.className = v('psELast');
    try { await persist(); showToast('Saved.'); } catch(e){ showToast('Could not save - try again.'); return; }
    PS.edit = ''; paint();
  };
  window.psExport = function(){
    if(typeof XLSX === 'undefined'){ showToast('Excel is not available in this view.'); return; }
    const list = filtered(rowsAll());
    const aoa = [['Name', 'Admission No', 'Father', 'Joined class', 'Last class', 'Status', 'Year left', 'Old dues', 'Receipts', 'Board marks sheet', 'Marks sheet date', 'Handed to', 'Mobile']].concat(list.map(r => [r.name, r.s.admissionNo || '', r.s.fatherName || '', r.joined, r.last, r.status, r.year, r.due, r.receipts, r.marks, r.s.boardMarksDate || '', r.s.boardMarksTo || '', r.s.fatherPhone || r.s.contact || '']));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Past students'); XLSX.writeFile(wb, 'past-students.xlsx');
  };
})();
