/* =========================================================================
   Junior College: practical exam batches (shown inside the Junior College setup on Setup > Classes).
   Pick a year, a combination and a practical subject, say how many students fit in one batch, and the
   students of that combination are split into batches in admission-number order. Each batch gets a date,
   a time, a lab and, if students go elsewhere (as the board's "jumbling" does), an exam centre.
   Lab marks are entered in Exams like any other subject, because a practical (for example "Physics
   Practical") is an ordinary subject. Nothing existing is changed.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'college-practicals';
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; } catch(e){}
  const YEARS = ['1st Year', '2nd Year'];
  let data = { batches: [] }, loaded = false, loading = false, sel = { year: YEARS[0], combo: '', subject: '', size: 20 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase();
  const canEdit = () => { try { return !!currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Principal'); } catch(e){ return false; } };
  const nameOf = s => ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;

  function clean(d){
    const out = { batches: [] };
    ((d && d.batches) || []).forEach(b => {
      if(!b || !b.id) return;
      out.batches.push({
        id: String(b.id), year: String(b.year || ''), combo: String(b.combo || ''), subject: String(b.subject || ''), name: String(b.name || '').slice(0, 40),
        date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '', time: String(b.time || '').slice(0, 20), lab: String(b.lab || '').slice(0, 60),
        centre: String(b.centre || '').slice(0, 80), studentIds: (b.studentIds || []).map(String).slice(0, 500),
      });
    });
    return out;
  }
  async function load(){ try { data = clean(await storageGet(KEY, data)); } catch(e){} loaded = true; paintSoon(); }
  async function persist(){ data = clean(data); await storageSet(KEY, data); }
  function paintSoon(){ try { window.clgRepaint(); } catch(e){} }

  function combos(){ try { return window.clgData().combos || []; } catch(e){ return []; } }
  function practicalSubjects(year, combo){
    return (typeof subjectsList !== 'undefined' ? subjectsList : []).filter(s => s.className === year && /practical|lab/i.test(s.name || '') && (s.sections || []).some(z => norm(z) === norm(combo))).map(s => s.name);
  }
  function studentsOf(year, combo){
    return scxActiveStudents().filter(s => s.className === year && norm(s.section) === norm(combo))
      .sort((a, b) => String(a.admissionNo || '').localeCompare(String(b.admissionNo || ''), undefined, { numeric: true }) || nameOf(a).localeCompare(nameOf(b)));
  }
  function byId(id){ return scxActiveStudents().find(s => s.id === id); }

  function card(){
    if(!loaded){ if(!loading){ loading = true; load(); } return ''; }
    const cs = combos();
    if(!cs.length) return '';
    if(!sel.combo || !cs.some(c => c.name === sel.combo)) sel.combo = cs[0].name;
    const subs = practicalSubjects(sel.year, sel.combo);
    if(!subs.includes(sel.subject)) sel.subject = subs[0] || '';
    const n = studentsOf(sel.year, sel.combo).length;
    const dis = canEdit() ? '' : 'disabled';
    const form = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">
      <div class="f-field"><label>Year</label><select class="input" ${dis} onchange="clpSel('year',this.value)">${YEARS.map(y => `<option ${y === sel.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
      <div class="f-field"><label>Combination</label><select class="input" ${dis} onchange="clpSel('combo',this.value)">${cs.map(c => `<option ${c.name === sel.combo ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="f-field"><label>Practical subject</label><select class="input" ${dis} onchange="clpSel('subject',this.value)">${subs.length ? subs.map(x => `<option ${x === sel.subject ? 'selected' : ''}>${esc(x)}</option>`).join('') : '<option value="">(none: add a subject with "Practical" in its name)</option>'}</select></div>
      <div class="f-field" style="width:120px"><label>Students per batch</label><input class="input" ${dis} type="number" min="1" max="200" value="${sel.size}" onchange="clpSel('size',this.value)"></div>
      ${canEdit() ? `<button type="button" class="sf-btn sf-btn--primary" ${subs.length && n ? '' : 'disabled'} onclick="clpMake()">Make batches (${n} student${n === 1 ? '' : 's'})</button>` : ''}
    </div>`;
    const rows = data.batches.slice().sort((a, b) => (a.date || 'z').localeCompare(b.date || 'z') || a.name.localeCompare(b.name, undefined, { numeric: true })).map(b => `<tr>
      <td><b>${esc(b.subject)}</b><br><small>${esc(b.year)} &middot; ${esc(b.combo)}</small></td>
      <td>${esc(b.name)}<br><small>${b.studentIds.length} student${b.studentIds.length === 1 ? '' : 's'}</small></td>
      <td><input class="input" ${dis} type="date" value="${esc(b.date)}" onchange="clpSet('${b.id}','date',this.value)"></td>
      <td><input class="input" ${dis} style="min-width:90px" placeholder="10:00 AM" value="${esc(b.time)}" onchange="clpSet('${b.id}','time',this.value)"></td>
      <td><input class="input" ${dis} style="min-width:90px" placeholder="Physics lab" value="${esc(b.lab)}" onchange="clpSet('${b.id}','lab',this.value)"></td>
      <td><input class="input" ${dis} style="min-width:140px" placeholder="Own college" value="${esc(b.centre)}" onchange="clpSet('${b.id}','centre',this.value)"></td>
      <td style="white-space:nowrap"><button type="button" class="sf-btn sf-btn--soft" onclick="clpList('${b.id}')">Student list</button>${canEdit() ? ` <button type="button" class="scx-x" onclick="clpDel('${b.id}')" aria-label="Delete batch">&times;</button>` : ''}</td></tr>`).join('');
    const table = data.batches.length
      ? `<div style="overflow-x:auto"><table class="table" style="width:100%"><thead><tr><th>Subject</th><th>Batch</th><th>Date</th><th>Time</th><th>Lab</th><th>Exam centre</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="scx-note">No batches yet. Choose a year, combination and practical subject, then press Make batches.</p>';
    return scxCard('Practical exam batches', 'Split each combination into practical batches and give every batch a date, lab and, if students go to another college, an exam centre. Enter lab marks in Exams like any other subject.', form + table);
  }

  window.clpSel = function(k, v){ sel[k] = k === 'size' ? Math.max(1, Math.min(200, parseInt(v, 10) || 20)) : v; if(k === 'year'){ sel.subject = ''; } if(k === 'combo'){ sel.subject = ''; } paintSoon(); };
  window.clpMake = async function(){
    if(!canEdit() || !sel.subject) return;
    const list = studentsOf(sel.year, sel.combo);
    if(!list.length){ showToast('No students in ' + sel.combo + ' (' + sel.year + ') yet.'); return; }
    const size = sel.size || 20, count = Math.ceil(list.length / size);
    const same = b => b.year === sel.year && b.combo === sel.combo && b.subject === sel.subject;
    if(data.batches.some(same) && !await showConfirmDialog('Batches for ' + sel.subject + ' (' + sel.combo + ', ' + sel.year + ') already exist. Replace them with ' + count + ' new batch' + (count === 1 ? '' : 'es') + '? Dates and labs you typed will be lost.', { title: 'Replace batches?', okText: 'Replace' })) return;
    data.batches = data.batches.filter(b => !same(b));
    for(let i = 0; i < count; i++){
      data.batches.push({ id: 'pb_' + Date.now().toString(36) + i, year: sel.year, combo: sel.combo, subject: sel.subject, name: 'Batch ' + (i + 1), date: '', time: '', lab: '', centre: '', studentIds: list.slice(i * size, (i + 1) * size).map(s => s.id) });
    }
    await persist(); paintSoon();
    showToast(count + ' batch' + (count === 1 ? '' : 'es') + ' made for ' + sel.subject + '.', 'burst');
  };
  window.clpSet = async function(id, f, v){ if(!canEdit()) return; const b = data.batches.find(x => x.id === id); if(!b || !['date', 'time', 'lab', 'centre'].includes(f)) return; b[f] = v; await persist(); };
  window.clpDel = async function(id){ if(!canEdit()) return; if(!await showConfirmDialog('Delete this batch? The students stay in the college; only this practical batch is removed.', { title: 'Delete batch?', okText: 'Delete' })) return; data.batches = data.batches.filter(b => b.id !== id); await persist(); paintSoon(); };
  window.clpList = function(id){
    const b = data.batches.find(x => x.id === id); if(!b) return;
    const info = (typeof schoolInfo !== 'undefined' && schoolInfo) ? schoolInfo : {};
    const rows = b.studentIds.map(byId).filter(Boolean).map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.admissionNo || '')}</td><td>${esc(nameOf(s))}</td><td></td><td></td></tr>`).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(b.subject)} ${esc(b.name)}</title><style>body{font:14px system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:6px 8px;text-align:left}h2,h3,p{margin:4px 0}</style>
      <h2>${esc(info.name || '')}</h2><h3>${esc(b.subject)} &mdash; ${esc(b.name)}</h3>
      <p>${esc(b.year)} &middot; ${esc(b.combo)} &middot; ${esc(b.date || 'Date to be fixed')} ${esc(b.time)} &middot; ${esc(b.lab || 'Lab to be fixed')}</p>
      <p><b>Exam centre:</b> ${esc(b.centre || 'Own college')}</p><br>
      <table><thead><tr><th>#</th><th>Admission no.</th><th>Name</th><th>Marks</th><th>Signature</th></tr></thead><tbody>${rows}</tbody></table>`;
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = (b.subject + '-' + b.name + '.html').replace(/[^\w.-]+/g, '_'); document.body.appendChild(a); a.click(); a.remove();
      showToast('List downloaded. Open it and use Print.');
    } catch(e){ showToast('Could not create the list.'); }
  };

  if(typeof window.clgRegisterCard === 'function') window.clgRegisterCard(card);
})();
