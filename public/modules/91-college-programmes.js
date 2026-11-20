/* =========================================================================
   Junior College: programmes and test ranks (inside the Junior College setup on Setup > Classes).
   - Programme: besides the combination (MPC, BiPC ...), a college can tag each student with a programme
     such as Regular, IIT-JEE, NEET or Foundation, and see headcount and board pass percentage for each.
   - Test ranks: one rank list for a test across the whole year, one combination, or one programme.
     (The exams module ranks students inside one section; a college also needs the wider list.)
   Ranks use the same rule as report cards: the total of the countable subjects, tied students share a
   rank, and a student with nothing to score is left out.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'college-programmes';
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; } catch(e){}
  const YEARS = ['1st Year', '2nd Year'];
  const DEFAULT_LIST = ['Regular', 'IIT-JEE', 'NEET', 'Foundation'];
  let data = { list: DEFAULT_LIST.slice(), by: {} }, loaded = false, loading = false;
  let ui = { year: '1st Year', combo: '', exam: '', rYear: '1st Year', scope: 'year', scopeVal: '' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase();
  const canEdit = () => { try { return !!currentUser && ['Admin', 'Principal', 'Office Assistant'].includes(currentUser.role); } catch(e){ return false; } };
  const nameOf = s => ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;
  const combos = () => { try { return window.clgData().combos || []; } catch(e){ return []; } };

  function clean(d){
    const list = []; ((d && d.list) || DEFAULT_LIST).forEach(x => { const n = String(x || '').trim().slice(0, 24); if(n && !list.some(y => norm(y) === norm(n))) list.push(n); });
    if(!list.length) DEFAULT_LIST.forEach(x => list.push(x));
    const by = {}; Object.keys((d && d.by) || {}).forEach(id => { const v = d.by[id]; if(list.includes(v)) by[String(id)] = v; });
    return { list: list.slice(0, 12), by };
  }
  async function load(){ try { data = clean(await storageGet(KEY, data)); } catch(e){} loaded = true; paint(); }
  async function persist(){ data = clean(data); await storageSet(KEY, data); }
  const paint = () => { try { window.clgRepaint(); } catch(e){} };
  const progOf = id => data.by[id] || data.list[0];
  const active = () => scxActiveStudents().filter(s => YEARS.includes(s.className));

  /* ---- ranks (pure helper, also used by tests) ---- */
  function rankList(exam, cohort){
    const rows = [];
    cohort.forEach(s => {
      const subs = getExamSubjects(exam, s.className, s.section).filter(x => x.countable !== false);
      const max = subs.reduce((a, x) => a + (Number(x.maxMarks) || 0), 0);
      if(!max) return;
      let got = 0, any = false;
      subs.forEach(x => { const r = examResults.find(r => r.examId === exam.id && r.studentId === s.id && r.subject === x.name); if(r && r.marks != null && r.marks !== '') { any = true; got += Number(r.marks) || 0; } });
      if(!any) return;
      rows.push({ s, got, max, pct: got * 100 / max });
    });
    rows.sort((a, b) => b.pct - a.pct || nameOf(a.s).localeCompare(nameOf(b.s)));
    let rank = 1; rows.forEach((r, i) => { if(i > 0 && r.pct < rows[i - 1].pct - 1e-9) rank = i + 1; r.rank = rank; });
    return rows;
  }
  window.clpRankList = rankList;

  function progCard(){
    const cs = combos(); if(!cs.length) return '';
    if(!ui.combo || !cs.some(c => c.name === ui.combo)) ui.combo = cs[0].name;
    const dis = canEdit() ? '' : 'disabled';
    const st = active().filter(s => s.className === ui.year && norm(s.section) === norm(ui.combo)).sort((a, b) => String(a.admissionNo || '').localeCompare(String(b.admissionNo || ''), undefined, { numeric: true }));
    let boardRes = {}; try { boardRes = {}; } catch(e){}
    const counts = data.list.map(p => { const a = active().filter(s => progOf(s.id) === p); return `<tr><td><b>${esc(p)}</b></td><td>${a.filter(s => s.className === YEARS[0]).length}</td><td>${a.filter(s => s.className === YEARS[1]).length}</td>${canEdit() && data.list.length > 1 ? `<td><button type="button" class="scx-x" onclick="cpgDrop('${esc(p)}')" aria-label="Remove ${esc(p)}">&times;</button></td>` : '<td></td>'}</tr>`; }).join('');
    const rows = st.map(s => `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')}</small></td><td><select class="input" ${dis} onchange="cpgSet('${esc(s.id)}',this.value)">${data.list.map(p => `<option ${p === progOf(s.id) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></td></tr>`).join('');
    return scxCard('Programmes', 'Tag each student with a programme (for example IIT-JEE or NEET) besides the combination. A student with no tag counts as ' + esc(data.list[0]) + '.',
      `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:1;min-width:260px"><table class="table" style="width:100%"><thead><tr><th>Programme</th><th>1st Year</th><th>2nd Year</th><th></th></tr></thead><tbody>${counts}</tbody></table>
          ${canEdit() ? `<div style="display:flex;gap:8px;margin-top:8px"><input class="input" id="cpgNew" maxlength="24" placeholder="New programme"><button type="button" class="sf-btn sf-btn--soft" onclick="cpgAdd()">Add</button></div>` : ''}</div>
        <div style="flex:2;min-width:300px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px">
            <div class="f-field"><label>Year</label><select class="input" onchange="cpgSel('year',this.value)">${YEARS.map(y => `<option ${y === ui.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
            <div class="f-field"><label>Combination</label><select class="input" onchange="cpgSel('combo',this.value)">${cs.map(c => `<option ${c.name === ui.combo ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            ${canEdit() && st.length ? `<div class="f-field"><label>Set everyone here to</label><select class="input" id="cpgAll">${data.list.map(p => `<option>${esc(p)}</option>`).join('')}</select></div><button type="button" class="sf-btn sf-btn--soft" onclick="cpgAll()">Apply to ${st.length}</button>` : ''}
          </div>
          ${st.length ? `<div style="max-height:360px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Programme</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="scx-note">No students in this combination yet.</p>'}
        </div></div>`);
  }

  function rankCard(){
    const cs = combos(); if(!cs.length) return '';
    const exs = (typeof examDefs !== 'undefined' && Array.isArray(examDefs)) ? examDefs : [];
    if(!exs.some(e => e.id === ui.exam)) ui.exam = exs.length ? exs[0].id : '';
    let cohort = active().filter(s => s.className === ui.rYear);
    let scopeSel = '';
    if(ui.scope === 'combo'){ if(!cs.some(c => c.name === ui.scopeVal)) ui.scopeVal = cs[0].name; cohort = cohort.filter(s => norm(s.section) === norm(ui.scopeVal)); scopeSel = `<div class="f-field"><label>Combination</label><select class="input" onchange="cpgSel('scopeVal',this.value)">${cs.map(c => `<option ${c.name === ui.scopeVal ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`; }
    if(ui.scope === 'prog'){ if(!data.list.includes(ui.scopeVal)) ui.scopeVal = data.list[0]; cohort = cohort.filter(s => progOf(s.id) === ui.scopeVal); scopeSel = `<div class="f-field"><label>Programme</label><select class="input" onchange="cpgSel('scopeVal',this.value)">${data.list.map(p => `<option ${p === ui.scopeVal ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>`; }
    const exam = exs.find(e => e.id === ui.exam);
    const rows = exam ? rankList(exam, cohort) : [];
    const table = !exam ? '<p class="scx-note">No exams created yet. Create a test in Manage Exams first.</p>'
      : rows.length ? `<div style="max-height:420px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Rank</th><th>Student</th><th>Combination</th><th>Programme</th><th>Marks</th><th>%</th></tr></thead><tbody>${rows.slice(0, 500).map(r => `<tr><td><b>${r.rank}</b></td><td>${esc(nameOf(r.s))}<br><small>${esc(r.s.admissionNo || '')}</small></td><td>${esc(r.s.section)}</td><td>${esc(progOf(r.s.id))}</td><td>${r.got} / ${r.max}</td><td><b>${r.pct.toFixed(1)}%</b></td></tr>`).join('')}</tbody></table></div><p class="scx-note" style="margin-top:6px">${rows.length} student${rows.length === 1 ? '' : 's'} ranked. Ties share a rank. Students with no marks entered are left out.</p>`
      : '<p class="scx-note">No marks entered for this test in this group yet.</p>';
    return scxCard('Test ranks', 'One rank list for a test across the whole year, one combination, or one programme. Report cards still show the rank inside the section.',
      `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
        <div class="f-field"><label>Test</label><select class="input" onchange="cpgSel('exam',this.value)">${exs.map(e => `<option value="${esc(e.id)}" ${e.id === ui.exam ? 'selected' : ''}>${esc(e.name || e.id)}</option>`).join('')}</select></div>
        <div class="f-field"><label>Year</label><select class="input" onchange="cpgSel('rYear',this.value)">${YEARS.map(y => `<option ${y === ui.rYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        <div class="f-field"><label>Rank across</label><select class="input" onchange="cpgSel('scope',this.value)"><option value="year" ${ui.scope === 'year' ? 'selected' : ''}>Whole year</option><option value="combo" ${ui.scope === 'combo' ? 'selected' : ''}>One combination</option><option value="prog" ${ui.scope === 'prog' ? 'selected' : ''}>One programme</option></select></div>${scopeSel}</div>${table}`);
  }

  function card(){
    if(!loaded){ if(!loading){ loading = true; load(); } return ''; }
    return progCard() + rankCard();
  }

  window.cpgSel = (k, v) => { if(k in ui){ ui[k] = v; if(k === 'scope') ui.scopeVal = ''; paint(); } };
  window.cpgSet = async (id, v) => { if(!canEdit() || !data.list.includes(v)) return; data.by[id] = v; await persist(); paint(); };
  window.cpgAll = async () => {
    if(!canEdit()) return; const v = (document.getElementById('cpgAll') || {}).value; if(!data.list.includes(v)) return;
    const st = active().filter(s => s.className === ui.year && norm(s.section) === norm(ui.combo));
    st.forEach(s => { data.by[s.id] = v; }); await persist(); paint(); showToast(st.length + ' student' + (st.length === 1 ? '' : 's') + ' set to ' + v + '.');
  };
  window.cpgAdd = async () => {
    if(!canEdit()) return; const v = String((document.getElementById('cpgNew') || {}).value || '').trim().slice(0, 24);
    if(!v) return; if(data.list.some(x => norm(x) === norm(v))){ showToast('That programme already exists.'); return; }
    if(data.list.length >= 12){ showToast('Up to 12 programmes.'); return; }
    data.list.push(v); await persist(); paint();
  };
  window.cpgDrop = async (p) => {
    if(!canEdit() || data.list.length < 2) return;
    const used = Object.keys(data.by).filter(id => data.by[id] === p && active().some(s => s.id === id)).length;
    if(p === data.list[0]){ showToast('The first programme is the default, so it cannot be removed.'); return; }
    if(used){ showToast(p + ' is used by ' + used + ' student' + (used === 1 ? '' : 's') + '. Change them first.'); return; }
    if(!await showConfirmDialog('Remove the programme "' + p + '"?', { title: 'Remove programme?', okText: 'Remove' })) return;
    data.list = data.list.filter(x => x !== p); await persist(); paint();
  };

  if(typeof window.clgRegisterCard === 'function') window.clgRegisterCard(card);
})();
