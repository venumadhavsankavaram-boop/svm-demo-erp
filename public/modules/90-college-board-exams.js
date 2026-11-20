/* =========================================================================
   Junior College: government (board) exams - tracking only (inside the Junior College setup on Setup > Classes).
   The board runs the public exams, issues the hall tickets and publishes the results. This ERP does not
   create any of that. It keeps a record next to each student:
     - Hall tickets: the board hall ticket number, and whether the ticket is Pending, Downloaded,
       Handed over, or Held (for example, until fees are cleared).
     - Results: the released result for a year (total, result, backlog subjects), typed in or pasted from a
       sheet, with pass percentage by combination so the college can see how each group did.
   Nothing is fetched from the board's website: the result pages ask for the student's own hall ticket
   number and date of birth, so the college copies the released result in instead.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'college-board';
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; } catch(e){}
  const TICKET = ['Pending', 'Downloaded', 'Handed over', 'Held'];
  const RESULT = ['Not released', 'Pass', 'Fail', 'Absent'];
  const YEARS = ['1st Year', '2nd Year'];
  let data = { students: {} }, loaded = false, loading = false;
  let ui = { tab: 'tickets', year: '1st Year', combo: '', session: '' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase();
  const canEdit = () => { try { return !!currentUser && ['Admin', 'Principal', 'Office Assistant'].includes(currentUser.role); } catch(e){ return false; } };
  const nameOf = s => ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;
  const cleanHt = v => String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 15);
  const num = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };

  function clean(d){
    const out = { students: {} };
    Object.keys((d && d.students) || {}).forEach(id => {
      const r = d.students[id] || {};
      const res = {};
      YEARS.forEach(y => {
        const x = (r.res || {})[y]; if(!x) return;
        res[y] = { session: String(x.session || '').slice(0, 30), total: num(x.total), outOf: num(x.outOf), result: RESULT.includes(x.result) ? x.result : 'Not released', backlogs: String(x.backlogs || '').slice(0, 120) };
      });
      out.students[String(id)] = { ht: cleanHt(r.ht), ticket: TICKET.includes(r.ticket) ? r.ticket : 'Pending', res };
    });
    return out;
  }
  async function load(){ try { data = clean(await storageGet(KEY, data)); } catch(e){} loaded = true; paint(); }
  async function persist(){ data = clean(data); await storageSet(KEY, data); }
  const paint = () => { try { window.clgRepaint(); } catch(e){} };
  const rec = id => data.students[id] || (data.students[id] = { ht: '', ticket: 'Pending', res: {} });
  const combos = () => { try { return window.clgData().combos || []; } catch(e){ return []; } };
  function list(){
    return scxActiveStudents().filter(s => s.className === ui.year && norm(s.section) === norm(ui.combo))
      .sort((a, b) => String(a.admissionNo || '').localeCompare(String(b.admissionNo || ''), undefined, { numeric: true }));
  }
  const dupHt = (id, ht) => !!ht && Object.keys(data.students).some(k => k !== id && data.students[k].ht === ht);

  function summary(){
    const rows = combos().map(c => {
      const st = scxActiveStudents().filter(s => s.className === ui.year && norm(s.section) === norm(c.name));
      let pass = 0, fail = 0, absent = 0, pend = 0;
      st.forEach(s => { const x = ((data.students[s.id] || {}).res || {})[ui.year]; const r = x ? x.result : 'Not released'; if(r === 'Pass') pass++; else if(r === 'Fail') fail++; else if(r === 'Absent') absent++; else pend++; });
      const done = pass + fail;
      return `<tr><td><b>${esc(c.name)}</b></td><td>${st.length}</td><td>${pass}</td><td>${fail}</td><td>${absent}</td><td>${pend}</td><td><b>${done ? Math.round(pass * 100 / done) + '%' : '-'}</b></td></tr>`;
    }).join('');
    return `<div style="overflow-x:auto;margin-top:14px"><table class="table" style="width:100%"><thead><tr><th>${esc(ui.year)}</th><th>Students</th><th>Passed</th><th>Failed</th><th>Absent</th><th>Not entered</th><th>Pass %</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function card(){
    if(!loaded){ if(!loading){ loading = true; load(); } return ''; }
    const cs = combos(); if(!cs.length) return '';
    if(!ui.combo || !cs.some(c => c.name === ui.combo)) ui.combo = cs[0].name;
    const dis = canEdit() ? '' : 'disabled';
    const tabBtn = (k, l) => `<button type="button" onclick="cbxTab('${k}')" aria-pressed="${ui.tab === k}" style="padding:8px 16px;border-radius:10px;border:2px solid ${ui.tab === k ? 'var(--navy,#1a2a52)' : 'var(--border,#dde3ee)'};background:${ui.tab === k ? 'var(--navy,#1a2a52)' : 'transparent'};color:${ui.tab === k ? '#fff' : 'var(--navy,#1a2a52)'};font-weight:700;cursor:pointer">${l}</button>`;
    const filters = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin:12px 0">
      <div class="f-field"><label>Year</label><select class="input" onchange="cbxSel('year',this.value)">${YEARS.map(y => `<option ${y === ui.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
      <div class="f-field"><label>Combination</label><select class="input" onchange="cbxSel('combo',this.value)">${cs.map(c => `<option ${c.name === ui.combo ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      ${ui.tab === 'results' ? `<div class="f-field"><label>Exam session</label><input class="input" ${dis} placeholder="e.g. March 2027" value="${esc(ui.session)}" onchange="cbxSel('session',this.value)"></div>` : ''}
      <a class="sf-btn sf-btn--soft" href="https://bie.ap.gov.in" target="_blank" rel="noopener">Andhra Pradesh board site</a>
      <a class="sf-btn sf-btn--soft" href="https://tgbie.cgg.gov.in" target="_blank" rel="noopener">Telangana board site</a></div>`;
    const st = list();
    let rows = '';
    if(ui.tab === 'tickets'){
      rows = st.map(s => { const r = data.students[s.id] || { ht: '', ticket: 'Pending' }; const d = dupHt(s.id, r.ht);
        return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')}</small></td>
        <td><input class="input" ${dis} maxlength="15" style="min-width:140px${d ? ';border-color:#b3261e' : ''}" placeholder="Hall ticket no." value="${esc(r.ht)}" onchange="cbxHt('${esc(s.id)}',this.value)">${d ? '<br><small style="color:#b3261e">Same number on another student</small>' : ''}</td>
        <td><select class="input" ${dis} onchange="cbxTicket('${esc(s.id)}',this.value)">${TICKET.map(t => `<option ${t === r.ticket ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`; }).join('');
    } else {
      rows = st.map(s => { const r = data.students[s.id] || { ht: '', res: {} }; const x = (r.res || {})[ui.year] || { total: '', outOf: '', result: 'Not released', backlogs: '' };
        return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')}${r.ht ? ' &middot; HT ' + esc(r.ht) : ''}</small></td>
        <td><input class="input" ${dis} type="number" min="0" style="width:90px" value="${x.total || ''}" onchange="cbxRes('${esc(s.id)}','total',this.value)"></td>
        <td><input class="input" ${dis} type="number" min="0" style="width:90px" value="${x.outOf || ''}" onchange="cbxRes('${esc(s.id)}','outOf',this.value)"></td>
        <td><select class="input" ${dis} onchange="cbxRes('${esc(s.id)}','result',this.value)">${RESULT.map(t => `<option ${t === x.result ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input class="input" ${dis} style="min-width:160px" placeholder="e.g. Chemistry" value="${esc(x.backlogs)}" onchange="cbxRes('${esc(s.id)}','backlogs',this.value)"></td></tr>`; }).join('');
    }
    const head = ui.tab === 'tickets' ? '<th>Student</th><th>Board hall ticket no.</th><th>Hall ticket status</th>' : '<th>Student</th><th>Total marks</th><th>Out of</th><th>Result</th><th>Backlog subjects</th>';
    const table = st.length ? `<div style="overflow-x:auto"><table class="table" style="width:100%"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="scx-note">No students in this combination yet.</p>';
    const paste = canEdit() ? `<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600">Paste ${ui.tab === 'tickets' ? 'hall ticket numbers' : 'released results'} from a sheet</summary>
      <p class="scx-note" style="margin:8px 0">One student per line, separated by commas or tabs: <b>${ui.tab === 'tickets' ? 'admission no, hall ticket no' : 'admission no, total marks, out of, Pass or Fail'}</b>. Copy the columns straight from Excel.</p>
      <textarea id="cbxPaste" class="input" rows="5" style="width:100%" placeholder="${ui.tab === 'tickets' ? 'A001, 2611234567' : 'A001, 812, 1000, Pass'}"></textarea>
      <div style="margin-top:8px"><button type="button" class="sf-btn sf-btn--primary" onclick="cbxImport()">Add these</button></div></details>` : '';
    return scxCard('Board exams (government)', 'The board runs the public exams and issues hall tickets and results. Here the college keeps a record: who has which hall ticket and where it stands, and each student\'s released result. Nothing is fetched from the board site; copy the released result in.',
      `<div style="display:flex;gap:8px;flex-wrap:wrap">${tabBtn('tickets', 'Hall tickets')}${tabBtn('results', 'Released results')}</div>${filters}${table}${paste}${ui.tab === 'results' ? summary() : ''}`);
  }

  window.cbxTab = k => { ui.tab = k; paint(); };
  window.cbxSel = (k, v) => { if(k in ui) ui[k] = v; if(k !== 'session') paint(); };
  window.cbxHt = async (id, v) => { if(!canEdit()) return; rec(id).ht = cleanHt(v); await persist(); paint(); };
  window.cbxTicket = async (id, v) => { if(!canEdit() || !TICKET.includes(v)) return; rec(id).ticket = v; await persist(); };
  window.cbxRes = async (id, f, v) => {
    if(!canEdit()) return;
    const r = rec(id); r.res = r.res || {};
    const x = r.res[ui.year] = r.res[ui.year] || { session: ui.session, total: 0, outOf: 0, result: 'Not released', backlogs: '' };
    if(f === 'total' || f === 'outOf') x[f] = num(v); else if(f === 'result' && RESULT.includes(v)) x.result = v; else if(f === 'backlogs') x.backlogs = String(v || '').slice(0, 120); else return;
    if(ui.session) x.session = ui.session;
    if(x.outOf && x.total > x.outOf) showToast('Total is more than "Out of". Please check.');
    await persist(); paint();
  };
  window.cbxImport = async function(){
    if(!canEdit()) return;
    const box = document.getElementById('cbxPaste'); const text = box ? box.value : '';
    const byAdm = {}; scxActiveStudents().forEach(s => { if(s.admissionNo) byAdm[norm(s.admissionNo)] = s; });
    let ok = 0; const bad = [];
    String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((line, i) => {
      const p = line.split(/[\t,]/).map(x => x.trim());
      const s = byAdm[norm(p[0])];
      if(!s){ bad.push(i + 1); return; }
      if(ui.tab === 'tickets'){
        const ht = cleanHt(p[1]); if(!ht){ bad.push(i + 1); return; }
        rec(s.id).ht = ht; ok++;
      } else {
        const result = RESULT.find(r => norm(r) === norm(p[3])); if(!result || result === 'Not released'){ bad.push(i + 1); return; }
        const r = rec(s.id); r.res = r.res || {};
        r.res[ui.year] = { session: ui.session, total: num(p[1]), outOf: num(p[2]), result, backlogs: '' }; ok++;
      }
    });
    await persist(); paint();
    showToast(ok + ' student' + (ok === 1 ? '' : 's') + ' updated' + (bad.length ? '. Lines not matched: ' + bad.slice(0, 8).join(', ') + (bad.length > 8 ? '...' : '') : '.'), ok ? 'burst' : undefined);
  };

  if(typeof window.clgRegisterCard === 'function') window.clgRegisterCard(card);
})();
