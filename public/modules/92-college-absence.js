/* =========================================================================
   Junior College: students absent several days in a row (inside the Junior College setup on Setup > Classes).
   The college sets how many days (default 3). The list shows each student of 1st or 2nd Year who has been
   absent for that many attendance days in a row, up to the latest day attendance was taken, with the
   parent's phone. "Tell parent" sends the parent an in-app and push notice; pressing it again for the same
   streak does nothing. Same-day Absent alerts already go to parents; this one is for a longer streak.
   How a streak is counted: only days when attendance was actually taken count (so Sundays and holidays
   never break or add to it); a day is "absent" when the student has an Absent mark and no Present mark
   that day; a day with no mark for the student ends the streak.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'college-absence';
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; } catch(e){}
  const YEARS = ['1st Year', '2nd Year'];
  let data = { days: 3 }, loaded = false, loading = false, ui = { year: 'All' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const canEdit = () => { try { return !!currentUser && ['Admin', 'Principal', 'Office Assistant'].includes(currentUser.role); } catch(e){ return false; } };
  const nameOf = s => ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;
  const dayOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

  /* Pure: who has been absent for at least minDays attendance days in a row. */
  function streaks(records, stus, minDays){
    const ids = new Set(stus.map(s => s.id));
    const byStu = {}, days = new Set();
    (records || []).forEach(r => {
      if(!r || !dayOk(r.date) || !ids.has(r.studentId)) return;
      days.add(r.date);
      const m = byStu[r.studentId] = byStu[r.studentId] || {};
      const x = m[r.date] = m[r.date] || { a: false, p: false };
      if(r.status === 'Absent') x.a = true; else if(r.status === 'Present' || r.status === 'Late') x.p = true;
    });
    const order = Array.from(days).sort().reverse();
    const out = [];
    stus.forEach(s => {
      const m = byStu[s.id]; if(!m) return;
      let n = 0, last = '';
      for(const d of order){
        const x = m[d];
        if(!x || x.p || !x.a) break;
        n++; if(!last) last = d;
      }
      if(n >= minDays) out.push({ student: s, days: n, lastDate: last });
    });
    return out.sort((a, b) => b.days - a.days || nameOf(a.student).localeCompare(nameOf(b.student)));
  }
  window.clabStreaks = streaks;

  function clean(d){ const n = Math.floor(Number(d && d.days)); return { days: n >= 2 && n <= 30 ? n : 3 }; }
  async function load(){ try { data = clean(await storageGet(KEY, data)); } catch(e){} loaded = true; paint(); }
  async function persist(){ data = clean(data); await storageSet(KEY, data); }
  const paint = () => { try { window.clgRepaint(); } catch(e){} };
  const scope = () => scxActiveStudents().filter(s => YEARS.includes(s.className) && (ui.year === 'All' || s.className === ui.year));
  let cached = [];

  function card(){
    if(!loaded){ if(!loading){ loading = true; load(); } return ''; }
    const recs = (typeof attendanceRecords !== 'undefined' && Array.isArray(attendanceRecords)) ? attendanceRecords : [];
    cached = streaks(recs, scope(), data.days);
    const dis = canEdit() ? '' : 'disabled';
    const rows = cached.map((x, i) => { const s = x.student; const ph = s.fatherPhone || s.motherPhone || '';
      return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')} &middot; ${esc(s.className)} ${esc(s.section)}</small></td><td><b>${x.days}</b> days<br><small>until ${esc(x.lastDate)}</small></td><td>${ph ? esc(ph) : '<small>no phone on file</small>'}</td><td>${canEdit() ? `<button type="button" class="sf-btn sf-btn--soft" onclick="clabTell(${i})">Tell parent</button>` : ''}</td></tr>`; }).join('');
    const table = cached.length
      ? `<div style="overflow-x:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Absent</th><th>Parent phone</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="scx-note">No one has been absent for ${data.days} or more attendance days in a row.</p>`;
    return scxCard('Absent several days in a row', 'Students who have been absent for the chosen number of attendance days in a row, up to the latest day attendance was taken. Same-day Absent alerts already reach parents; this is for a longer streak.',
      `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">
        <div class="f-field" style="width:150px"><label>Alert after (days)</label><input class="input" ${dis} type="number" min="2" max="30" value="${data.days}" onchange="clabDays(this.value)"></div>
        <div class="f-field"><label>Year</label><select class="input" onchange="clabYear(this.value)">${['All'].concat(YEARS).map(y => `<option ${y === ui.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        ${canEdit() && cached.length ? `<button type="button" class="sf-btn sf-btn--primary" onclick="clabTellAll()">Tell all ${cached.length} parent${cached.length === 1 ? '' : 's'}</button>` : ''}</div>${table}`);
  }

  async function send(items){
    const notices = items.map(x => ({ studentId: x.student.id, days: x.days, lastDate: x.lastDate }));
    try {
      const res = await fetch('/api/college/absence-notice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ notices }) });
      const j = await res.json().catch(() => ({}));
      if(!res.ok){ showToast(j.error || 'Could not send the notice.'); return; }
      showToast(j.sent + ' parent notice' + (j.sent === 1 ? '' : 's') + ' sent' + (j.skipped ? ', ' + j.skipped + ' already sent earlier' : '') + '.', j.sent ? 'burst' : undefined);
    } catch(e){ showToast('No connection. Please try again.'); }
  }
  window.clabDays = async v => { if(!canEdit()) return; data.days = Math.floor(Number(v)) || 3; await persist(); paint(); };
  window.clabYear = v => { ui.year = v; paint(); };
  window.clabTell = async i => { if(!canEdit() || !cached[i]) return; await send([cached[i]]); };
  window.clabTellAll = async () => {
    if(!canEdit() || !cached.length) return;
    if(!await showConfirmDialog('Send a notice to the parents of ' + cached.length + ' student' + (cached.length === 1 ? '' : 's') + '?', { title: 'Tell parents?', okText: 'Send' })) return;
    await send(cached);
  };

  if(typeof window.clgRegisterCard === 'function') window.clgRegisterCard(card);
})();
