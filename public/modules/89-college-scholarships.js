/* =========================================================================
   Junior College: scholarship and fee reimbursement tracking (inside the Junior College setup on Setup > Classes).
   Many junior college students pay part or all of their fee through a government scholarship or fee
   reimbursement. This keeps one line per student and scheme: how much was claimed, where it stands
   (Eligible, Applied, Approved, Received, Rejected), how much has actually arrived, and what is still
   pending. It is a tracking list only: it does not change fee balances or receipts.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'college-scholarships';
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; } catch(e){}
  const STATUS = ['Eligible', 'Applied', 'Approved', 'Received', 'Rejected'];
  const SCHEMES = ['Fee reimbursement (government)', 'Post-matric scholarship', 'Minority scholarship', 'Merit scholarship', 'Management concession', 'Other'];
  let data = { records: [] }, loaded = false, loading = false, filter = 'All', search = '', adding = false, pick = '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
  const money = v => '₹' + num(v).toLocaleString('en-IN');
  const canEdit = () => { try { return !!currentUser && ['Admin', 'Principal', 'Accountant'].includes(currentUser.role); } catch(e){ return false; } };
  const nameOf = s => ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;
  const find = id => scxActiveStudents().find(s => s.id === id);

  function clean(d){
    const out = { records: [] };
    ((d && d.records) || []).forEach(r => {
      if(!r || !r.id || !r.studentId) return;
      out.records.push({
        id: String(r.id), studentId: String(r.studentId), scheme: String(r.scheme || '').slice(0, 80),
        status: STATUS.includes(r.status) ? r.status : 'Eligible', claimed: num(r.claimed), received: num(r.received),
        appliedOn: /^\d{4}-\d{2}-\d{2}$/.test(r.appliedOn || '') ? r.appliedOn : '', receivedOn: /^\d{4}-\d{2}-\d{2}$/.test(r.receivedOn || '') ? r.receivedOn : '',
        note: String(r.note || '').slice(0, 200),
      });
    });
    return out;
  }
  async function load(){ try { data = clean(await storageGet(KEY, data)); } catch(e){} loaded = true; paint(); }
  async function persist(){ data = clean(data); await storageSet(KEY, data); }
  const paint = () => { try { window.clgRepaint(); } catch(e){} };
  const pending = r => (r.status === 'Applied' || r.status === 'Approved') ? Math.max(0, r.claimed - r.received) : 0;

  function card(){
    if(!loaded){ if(!loading){ loading = true; load(); } return ''; }
    const dis = canEdit() ? '' : 'disabled';
    const recs = data.records;
    const tot = recs.reduce((a, r) => { a.claimed += r.status === 'Rejected' ? 0 : r.claimed; a.received += r.received; a.pending += pending(r); return a; }, { claimed: 0, received: 0, pending: 0 });
    const kpi = (l, v, tone) => `<div style="flex:1;min-width:130px;padding:10px 12px;border:1px solid var(--border,#dde3ee);border-radius:12px"><div style="font-size:.72rem;color:var(--ink-soft,#5b6784);text-transform:uppercase;letter-spacing:.04em">${l}</div><div style="font-size:1.2rem;font-weight:700;color:${tone || 'var(--navy,#1a2a52)'}">${v}</div></div>`;
    const shown = recs.filter(r => (filter === 'All' || r.status === filter) && (!search || ((find(r.studentId) ? nameOf(find(r.studentId)) + ' ' + (find(r.studentId).admissionNo || '') : '') + ' ' + r.scheme).toLowerCase().includes(search.toLowerCase())));
    const rows = shown.map(r => {
      const s = find(r.studentId);
      return `<tr>
        <td><b>${esc(s ? nameOf(s) : '(student not found)')}</b><br><small>${esc(s ? (s.admissionNo || '') + ' · ' + s.className + ' ' + s.section : '')}</small></td>
        <td>${esc(r.scheme)}</td>
        <td><select class="input" ${dis} onchange="clsSet('${r.id}','status',this.value)">${STATUS.map(x => `<option ${x === r.status ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        <td><input class="input" ${dis} type="number" min="0" style="width:100px" value="${r.claimed}" onchange="clsSet('${r.id}','claimed',this.value)"></td>
        <td><input class="input" ${dis} type="number" min="0" style="width:100px" value="${r.received}" onchange="clsSet('${r.id}','received',this.value)"></td>
        <td><b>${pending(r) ? money(pending(r)) : '-'}</b></td>
        <td><input class="input" ${dis} style="min-width:120px" placeholder="Note" value="${esc(r.note)}" onchange="clsSet('${r.id}','note',this.value)"></td>
        <td>${canEdit() ? `<button type="button" class="scx-x" onclick="clsDel('${r.id}')" aria-label="Delete">&times;</button>` : ''}</td></tr>`;
    }).join('');
    const stus = scxActiveStudents().filter(s => s.className === '1st Year' || s.className === '2nd Year');
    const addForm = adding && canEdit() ? `<div style="padding:12px;border:1px dashed var(--border,#dde3ee);border-radius:12px;margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <div class="f-field" style="min-width:220px;flex:1"><label>Student</label><select class="input" id="clsStudent">${stus.length ? stus.map(s => `<option value="${esc(s.id)}" ${s.id === pick ? 'selected' : ''}>${esc(nameOf(s))} (${esc(s.admissionNo || '')}, ${esc(s.className)} ${esc(s.section)})</option>`).join('') : '<option value="">No 1st or 2nd Year students yet</option>'}</select></div>
      <div class="f-field" style="min-width:200px"><label>Scheme</label><input class="input" id="clsScheme" list="clsSchemes" placeholder="Choose or type"><datalist id="clsSchemes">${SCHEMES.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="f-field" style="width:120px"><label>Amount claimed</label><input class="input" id="clsClaimed" type="number" min="0" value="0"></div>
      <button type="button" class="sf-btn sf-btn--primary" ${stus.length ? '' : 'disabled'} onclick="clsAdd()">Add</button>
      <button type="button" class="sf-btn sf-btn--soft" onclick="clsToggle()">Cancel</button></div>` : '';
    const bar = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      ${canEdit() ? `<button type="button" class="sf-btn sf-btn--primary" onclick="clsToggle()">+ Add scholarship</button>` : ''}
      <select class="input" style="width:150px" onchange="clsFilter(this.value)">${['All'].concat(STATUS).map(x => `<option ${x === filter ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <input class="input" style="width:200px" placeholder="Search name or scheme" value="${esc(search)}" onchange="clsSearch(this.value)"></div>`;
    const table = shown.length
      ? `<div style="overflow-x:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Scheme</th><th>Status</th><th>Claimed</th><th>Received</th><th>Pending</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="scx-note">${recs.length ? 'No records match this filter.' : 'No scholarships recorded yet. Press Add scholarship to start.'}</p>`;
    return scxCard('Scholarships and fee reimbursement', 'Track what is claimed from the government or a trust for each student, and what has actually arrived. This is a tracking list; it does not change fee balances or receipts.',
      `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${kpi('Claimed', money(tot.claimed))}${kpi('Received', money(tot.received), '#0b7a5a')}${kpi('Still pending', money(tot.pending), tot.pending ? '#b3261e' : '')}${kpi('Students', new Set(recs.map(r => r.studentId)).size)}</div>${bar}${addForm}${table}`);
  }

  window.clsToggle = () => { adding = !adding; paint(); };
  window.clsFilter = v => { filter = v; paint(); };
  window.clsSearch = v => { search = v; paint(); };
  window.clsAdd = async function(){
    if(!canEdit()) return;
    const sid = (document.getElementById('clsStudent') || {}).value, scheme = ((document.getElementById('clsScheme') || {}).value || '').trim();
    if(!sid){ showToast('Choose a student.'); return; }
    if(!scheme){ showToast('Choose or type the scheme.'); return; }
    if(data.records.some(r => r.studentId === sid && r.scheme.toLowerCase() === scheme.toLowerCase())){ showToast('This student already has that scheme. Edit the existing line.'); return; }
    const claimed = num((document.getElementById('clsClaimed') || {}).value);
    data.records.push({ id: 'sch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), studentId: sid, scheme, status: claimed ? 'Applied' : 'Eligible', claimed, received: 0, appliedOn: '', receivedOn: '', note: '' });
    adding = false; pick = ''; await persist(); paint(); showToast('Scholarship added.', 'burst');
  };
  window.clsSet = async function(id, f, v){
    if(!canEdit()) return;
    const r = data.records.find(x => x.id === id); if(!r) return;
    if(f === 'claimed' || f === 'received') r[f] = num(v);
    else if(f === 'status' && STATUS.includes(v)){ r.status = v; if(v === 'Received' && r.received < r.claimed) r.received = r.claimed; }
    else if(f === 'note') r.note = String(v || '').slice(0, 200);
    else return;
    if(r.received > r.claimed && r.claimed > 0 && f === 'received') showToast('Received is more than claimed. Please check the amount.');
    await persist(); paint();
  };
  window.clsDel = async function(id){
    if(!canEdit()) return;
    if(!await showConfirmDialog('Delete this scholarship line? The student and fee records are not affected.', { title: 'Delete line?', okText: 'Delete' })) return;
    data.records = data.records.filter(r => r.id !== id); await persist(); paint();
  };

  if(typeof window.clgRegisterCard === 'function') window.clgRegisterCard(card);
})();
