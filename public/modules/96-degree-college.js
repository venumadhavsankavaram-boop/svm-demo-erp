/* =========================================================================
   Degree College pack (Setup > Programmes & Years, shown only when the College Pack is on AND "Degree College" is chosen).
   One panel with six tabs:
     Programmes     - programmes (B.A., B.Com, B.Sc ...), 4-year Honours or older 3-year pattern, seats per year, and the
                      courses of every semester with their type (Major, Minor, Elective ...) and credits.
                      "Create in the ERP" adds the year classes, programme sections and subjects (additive only).
     Marks          - internal and external marks, course by course.
     Results        - grade, SGPA and CGPA per student, and a printable mark sheet.
     Attendance     - attendance percentage, with students below the minimum (hall-ticket hold list).
     Reimbursement  - fee reimbursement tracker (income / caste / ration card numbers, bank link, biometric, attendance).
     Internship     - community service, short-term internship and semester internship per student.
   Like the Junior College pack, nothing existing is changed or renamed. Years are ordinary classes
   ("Honours Year 1..4" or "Degree Year 1..3"), each programme is an ordinary section, courses are ordinary subjects.
   The marks split, pass mark, grade scale and minimum attendance are settings the college edits to match its university.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'degree-structure', RKEY = 'degree-results', XKEY = 'degree-extras';
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; OBJECT_BACKED_KEYS[RKEY] = '/api/kv/' + RKEY; OBJECT_BACKED_KEYS[XKEY] = '/api/kv/' + XKEY; } catch(e){}

  const TYPES = ['Major', 'Minor', 'Elective', 'MDC', 'SEC', 'VAC', 'AEC', 'Practical', 'Internship', 'Project'];
  const ELECTIVE_TYPES = ['Minor', 'Elective'];
  const STREAMS = ['Arts', 'Commerce', 'Science', 'Computer', 'Other'];
  /* Starting point only: every college edits these to match its own university's rules. */
  const DEFAULT_SCALE = [
    { min: 90, grade: 'O', points: 10 }, { min: 80, grade: 'A+', points: 9 }, { min: 70, grade: 'A', points: 8 },
    { min: 60, grade: 'B+', points: 7 }, { min: 50, grade: 'B', points: 6 }, { min: 40, grade: 'C', points: 5 },
  ];
  const DEFAULT_GRADING = { internalMax: 25, externalMax: 75, passPct: 40, attendanceMin: 75, scale: DEFAULT_SCALE };
  let S = { grading: JSON.parse(JSON.stringify(DEFAULT_GRADING)), programmes: [] }, R = { marks: {} }, X = { reim: {}, intern: {}, release: {} };
  let loaded = false, loading = false;
  let ui = { tab: 'prog', prog: '', sem: 1, course: '', year: '' };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase();
  const nameOf = s => ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;
  const canEdit = () => { try { return !!currentUser && ['Admin', 'Principal', 'Office Assistant'].includes(currentUser.role); } catch(e){ return false; } };
  const canMark = () => { try { return !!currentUser && ['Admin', 'Principal', 'Office Assistant', 'Teacher'].includes(currentUser.role); } catch(e){ return false; } };
  const numOr = (v, d) => { const n = Number(v); return v !== '' && v != null && isFinite(n) ? n : d; };

  /* ---------------- pure helpers (also used by the tests) ---------------- */
  const yearsOf = p => (p && p.pattern === 'degree3') ? 3 : 4;
  const semsOf = p => yearsOf(p) * 2;
  const familyOf = p => (p && p.pattern === 'degree3') ? 'Degree' : 'Honours';
  const yearClass = (p, n) => familyOf(p) + ' Year ' + n;
  const yearOfSem = sem => Math.ceil(Number(sem) / 2);
  const yearIdxOf = (cls) => { const m = /^(?:Honours|Degree) Year (\d)$/.exec(cls || ''); return m ? Number(m[1]) : 0; };

  function cleanGrading(g){
    g = g || {};
    const scale = [];
    (Array.isArray(g.scale) ? g.scale : DEFAULT_SCALE).forEach(r => {
      const min = numOr(r && r.min, null), pts = numOr(r && r.points, null), gr = String((r && r.grade) || '').trim().slice(0, 4);
      if(min != null && pts != null && gr && min >= 0 && min <= 100) scale.push({ min, grade: gr, points: Math.max(0, Math.min(10, pts)) });
    });
    scale.sort((a, b) => b.min - a.min);
    const ok = (v, lo, hi, d) => { const n = Number(v); return isFinite(n) && n >= lo && n <= hi ? n : d; };
    return { internalMax: ok(g.internalMax, 0, 100, 25), externalMax: ok(g.externalMax, 1, 100, 75), passPct: ok(g.passPct, 0, 100, 40), attendanceMin: ok(g.attendanceMin, 0, 100, 75), scale: scale.length ? scale : DEFAULT_SCALE.map(x => ({ ...x })) };
  }
  /* "1 | Major | Programming in C | 4" per line; optional 5th and 6th columns = internal max, external max. */
  function parseCourses(text, grading){
    const g = cleanGrading(grading), out = [], seen = new Set();
    String(text || '').split('\n').forEach((line, i) => {
      const parts = line.split('|').map(x => x.trim());
      if(parts.length < 3) return;
      const sem = parseInt(parts[0], 10);
      let type = TYPES.find(t => norm(t) === norm(parts[1])) || null;
      const title = parts[2].slice(0, 80);
      if(!(sem >= 1 && sem <= 8) || !type || !title) return;
      const credits = Math.max(0, Math.min(12, numOr(parts[3], 0)));
      const c = { id: 'crs_' + sem + '_' + (out.length + 1), sem, type, title, credits };
      const im = numOr(parts[4], null), em = numOr(parts[5], null);
      if(im != null && im >= 0 && im <= 100) c.internalMax = im;
      if(em != null && em >= 1 && em <= 100) c.externalMax = em;
      const key = sem + '|' + norm(title); if(seen.has(key)) return; seen.add(key);
      out.push(c);
    });
    return out;
  }
  const coursesText = list => (list || []).map(c => [c.sem, c.type, c.title, c.credits].concat(c.internalMax != null || c.externalMax != null ? [c.internalMax != null ? c.internalMax : '', c.externalMax != null ? c.externalMax : ''] : []).join(' | ')).join('\n');
  const maxOf = (course, g) => ({ i: course.internalMax != null ? course.internalMax : g.internalMax, e: course.externalMax != null ? course.externalMax : g.externalMax });

  function gradeFor(pct, scale){
    for(const r of scale) if(pct + 1e-9 >= r.min) return { grade: r.grade, points: r.points };
    return { grade: 'F', points: 0 };
  }
  /* One course for one student: mark = { i, e } (blank = not entered). */
  function courseResult(mark, course, grading){
    const g = cleanGrading(grading), mx = maxOf(course, g);
    const has = v => v !== '' && v != null && isFinite(Number(v));
    if(!mark || !has(mark.i) && !has(mark.e)) return { entered: false };
    const complete = (mx.i === 0 || has(mark.i)) && has(mark.e);
    const i = has(mark.i) ? Number(mark.i) : 0, e = has(mark.e) ? Number(mark.e) : 0;
    const total = i + e, max = mx.i + mx.e, pct = max ? total * 100 / max : 0;
    if(!complete) return { entered: true, complete: false, total, max, pct };
    let passed = pct + 1e-9 >= g.passPct, gr = gradeFor(pct, g.scale);
    if(passed && gr.grade === 'F'){ const low = g.scale[g.scale.length - 1]; gr = { grade: low.grade, points: low.points }; }
    if(!passed) gr = { grade: 'F', points: 0 };
    return { entered: true, complete: true, total, max, pct, passed, grade: gr.grade, points: gr.points };
  }
  /* One semester: courses = that semester's courses, marksOf = { courseId: {i,e} }. */
  function semesterResult(courses, marksOf, grading){
    let credits = 0, earned = 0, gp = 0, backlogs = 0, done = 0;
    const rows = courses.map(c => {
      const r = courseResult((marksOf || {})[c.id], c, grading);
      if(r.entered && r.complete){ done++; credits += c.credits; gp += c.credits * r.points; if(r.passed) earned += c.credits; else backlogs++; }
      return { course: c, res: r };
    });
    return { rows, credits, earned, gp, sgpa: credits ? gp / credits : null, backlogs, done, total: courses.length, complete: courses.length > 0 && done === courses.length };
  }
  function cgpa(sems){ let c = 0, g = 0; sems.forEach(s => { c += s.credits; g += s.gp; }); return c ? g / c : null; }
  const fmt2 = v => v == null ? '-' : (Math.round(v * 100) / 100).toFixed(2);

  /* Attendance percentage for one student from the ERP's attendance records (same day rule as the absence streaks). */
  function attendancePct(records, studentId){
    const days = {};
    (records || []).forEach(r => {
      if(!r || r.studentId !== studentId || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return;
      const x = days[r.date] = days[r.date] || { a: false, p: false };
      if(r.status === 'Absent') x.a = true; else if(r.status === 'Present' || r.status === 'Late') x.p = true;
    });
    let tot = 0, pres = 0;
    Object.keys(days).forEach(d => { const x = days[d]; if(x.p){ tot++; pres++; } else if(x.a) tot++; });
    return tot ? { pct: pres * 100 / tot, days: tot, present: pres } : null;
  }
  /* Fee reimbursement: what still blocks payment for a student who has applied. */
  function reimStatus(rec, att, minPct){
    rec = rec || {};
    if(!rec.applying) return { applying: false, blockers: [], ready: false };
    const b = [];
    if(!String(rec.incomeNo || '').trim()) b.push('Income certificate number missing');
    if(!String(rec.casteNo || '').trim()) b.push('Caste certificate number missing');
    if(!String(rec.rationNo || '').trim()) b.push('Ration card number missing');
    if(rec.bank !== 'Yes') b.push(rec.bank === 'No' ? "Mother's bank account not Aadhaar-linked" : "Mother's bank link not checked");
    if(rec.bio !== 'Yes') b.push(rec.bio === 'No' ? 'Biometric not done' : 'Biometric not checked');
    if(att && att.pct < minPct) b.push('Attendance ' + Math.round(att.pct) + '% is below ' + minPct + '%');
    return { applying: true, blockers: b, ready: b.length === 0 };
  }
  window.dgYearsOf = yearsOf; window.dgParseCourses = parseCourses; window.dgCoursesText = coursesText; window.dgGradeFor = gradeFor;
  window.dgCourseResult = courseResult; window.dgSemesterResult = semesterResult; window.dgCgpa = cgpa;
  window.dgAttendancePct = attendancePct; window.dgReimStatus = reimStatus; window.dgCleanGrading = cleanGrading;

  /* ---------------- data ---------------- */
  function cleanProg(p, g){
    const name = String((p && p.name) || '').trim().slice(0, 24).toUpperCase(); if(!name) return null;
    const pattern = p.pattern === 'degree3' ? 'degree3' : 'honours4';
    const seats = [0, 1, 2, 3].map(i => Math.max(0, parseInt(((p.seats || [])[i]), 10) || 0));
    return { id: p.id || ('prg_' + Math.random().toString(36).slice(2, 8)), name, full: String(p.full || '').trim().slice(0, 80), pattern, stream: STREAMS.includes(p.stream) ? p.stream : 'Other', seats, courses: Array.isArray(p.courses) ? p.courses.filter(c => c && c.sem >= 1 && c.sem <= (pattern === 'degree3' ? 6 : 8)).slice(0, 120) : [] };
  }
  function clean(d){
    const grading = cleanGrading(d && d.grading), programmes = [], seen = new Set();
    ((d && d.programmes) || []).forEach(p => { const c = cleanProg(p || {}, grading); if(c && !seen.has(norm(c.name))){ seen.add(norm(c.name)); programmes.push(c); } });
    return { grading, programmes };
  }
  async function load(){
    try { S = clean(await storageGet(KEY, S)); } catch(e){}
    try { const r = await storageGet(RKEY, R); R = { marks: (r && r.marks) || {} }; } catch(e){}
    try { const x = await storageGet(XKEY, X); X = { reim: (x && x.reim) || {}, intern: (x && x.intern) || {}, release: (x && x.release) || {} }; } catch(e){}
    loaded = true; paint();
  }
  const persistS = async () => { S = clean(S); await storageSet(KEY, S); };
  const persistR = async () => { await storageSet(RKEY, R); };
  const persistX = async () => { await storageSet(XKEY, X); };
  const paint = () => { try { window.clgRepaint(); } catch(e){} };
  const prog = () => S.programmes.find(p => p.id === ui.prog) || S.programmes[0] || null;
  const active = () => { try { return scxActiveStudents(); } catch(e){ return []; } };
  const progStudents = p => p ? active().filter(s => norm(s.section) === norm(p.name) && yearIdxOf(s.className) >= 1 && s.className.startsWith(familyOf(p))) : [];
  const inYear = (p, n) => progStudents(p).filter(s => yearIdxOf(s.className) === n);
  const records = () => (typeof attendanceRecords !== 'undefined' && Array.isArray(attendanceRecords)) ? attendanceRecords : [];

  /* Sample programmes. Course titles are only a starting point: replace them with your university's syllabus. */
  const L = (sem, type, title, credits) => sem + ' | ' + type + ' | ' + title + ' | ' + credits;
  function starter(kind){
    const common = [L(1, 'AEC', 'English I', 3), L(1, 'AEC', 'Second Language I', 3), L(2, 'AEC', 'English II', 3), L(2, 'AEC', 'Second Language II', 3), L(2, 'VAC', 'Environmental Studies', 2)];
    const sets = {
      'B.Com (General)': { full: 'Bachelor of Commerce (General)', stream: 'Commerce', lines: common.concat([L(1, 'Major', 'Financial Accounting', 4), L(1, 'Major', 'Business Organisation', 4), L(1, 'MDC', 'Computer Fundamentals', 3), L(2, 'Major', 'Corporate Accounting', 4), L(2, 'Major', 'Business Economics', 4), L(2, 'SEC', 'Spreadsheet Skills', 2), L(3, 'Major', 'Cost Accounting', 4), L(3, 'Major', 'Business Law', 4), L(3, 'Minor', 'Minor Course I', 4), L(4, 'Major', 'Income Tax', 4), L(4, 'Major', 'Auditing', 4), L(4, 'Minor', 'Minor Course II', 4)]) },
      'B.Sc (Computer Sci)': { full: 'Bachelor of Science (Computer Science)', stream: 'Computer', lines: common.concat([L(1, 'Major', 'Programming Fundamentals', 4), L(1, 'Practical', 'Programming Lab', 2), L(1, 'MDC', 'Digital Literacy', 3), L(2, 'Major', 'Data Structures', 4), L(2, 'Practical', 'Data Structures Lab', 2), L(2, 'SEC', 'Web Basics', 2), L(3, 'Major', 'Database Systems', 4), L(3, 'Practical', 'Database Lab', 2), L(3, 'Minor', 'Minor Course I', 4), L(4, 'Major', 'Operating Systems', 4), L(4, 'Major', 'Computer Networks', 4), L(4, 'Minor', 'Minor Course II', 4)]) },
      'B.A. (HEP)': { full: 'Bachelor of Arts (History, Economics, Politics)', stream: 'Arts', lines: common.concat([L(1, 'Major', 'History Paper I', 4), L(1, 'Major', 'Economics Paper I', 4), L(1, 'MDC', 'Digital Literacy', 3), L(2, 'Major', 'History Paper II', 4), L(2, 'Major', 'Economics Paper II', 4), L(2, 'SEC', 'Communication Skills', 2), L(3, 'Major', 'Political Science Paper I', 4), L(3, 'Major', 'Indian Economy', 4), L(3, 'Minor', 'Minor Course I', 4), L(4, 'Major', 'Political Science Paper II', 4), L(4, 'Major', 'Public Administration', 4), L(4, 'Minor', 'Minor Course II', 4)]) },
    };
    const k = sets[kind]; if(!k) return null;
    return { id: 'prg_' + kind.replace(/\W+/g, '').toLowerCase(), name: kind.toUpperCase(), full: k.full, pattern: 'honours4', stream: k.stream, seats: [60, 60, 60, 60], courses: parseCourses(k.lines.join('\n'), S.grading) };
  }
  const STARTERS = ['B.Com (General)', 'B.Sc (Computer Sci)', 'B.A. (HEP)'];

  /* ---------------- UI ---------------- */
  const tabBtn = (id, label) => `<button type="button" class="sf-btn ${ui.tab === id ? 'sf-btn--primary' : 'sf-btn--soft'}" onclick="dgTab('${id}')">${label}</button>`;
  const progSelect = () => `<div class="f-field" style="min-width:210px"><label>Programme</label><select class="input" onchange="dgSel('prog',this.value)">${S.programmes.map(p => `<option value="${esc(p.id)}" ${p.id === (prog() || {}).id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  const noProg = '<p class="scx-note">Add a programme first, on the Programmes tab.</p>';

  function tabProgrammes(){
    const dis = canEdit() ? '' : 'disabled', gd = S.grading;
    const have = new Set(S.programmes.map(p => norm(p.name)));
    const left = STARTERS.filter(n => !have.has(norm(n)));
    const cards = S.programmes.map((p, i) => {
      const used = [1, 2, 3, 4].slice(0, yearsOf(p)).map(n => inYear(p, n).length);
      return `<article class="sf-card" style="padding:14px;margin-bottom:10px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="f-field" style="min-width:130px;flex:1"><label>Programme (short name, capitals)</label><input class="input" ${dis} maxlength="24" value="${esc(p.name)}" onchange="dgProgField(${i},'name',this.value)"></div>
          <div class="f-field" style="min-width:200px;flex:2"><label>Full name</label><input class="input" ${dis} maxlength="80" value="${esc(p.full)}" onchange="dgProgField(${i},'full',this.value)"></div>
          <div class="f-field" style="min-width:150px"><label>Pattern</label><select class="input" ${dis} onchange="dgProgField(${i},'pattern',this.value)"><option value="honours4" ${p.pattern === 'honours4' ? 'selected' : ''}>4-year Honours (8 semesters)</option><option value="degree3" ${p.pattern === 'degree3' ? 'selected' : ''}>3-year degree (6 semesters)</option></select></div>
          <div class="f-field" style="min-width:110px"><label>Stream</label><select class="input" ${dis} onchange="dgProgField(${i},'stream',this.value)">${STREAMS.map(s => `<option ${s === p.stream ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          ${canEdit() ? `<button type="button" class="scx-x" onclick="dgProgRemove(${i})" title="Remove programme" aria-label="Remove ${esc(p.name)}">&times;</button>` : ''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">${[0, 1, 2, 3].slice(0, yearsOf(p)).map(n => `<div class="f-field" style="width:110px"><label>Year ${n + 1} seats</label><input class="input" ${dis} type="number" min="0" value="${p.seats[n]}" onchange="dgProgField(${i},'seats${n}',this.value)"><small style="color:${p.seats[n] && used[n] >= p.seats[n] ? '#b3261e' : 'var(--ink-soft,#5b6784)'}">${used[n]} student${used[n] === 1 ? '' : 's'}${p.seats[n] && used[n] >= p.seats[n] ? ' (full)' : ''}</small></div>`).join('')}</div>
        <div class="f-field" style="margin-top:8px"><label>Courses <small style="font-weight:400;color:var(--ink-soft,#5b6784)">one per line: semester | type | title | credits (type is one of ${TYPES.join(', ')})</small></label>
          <textarea class="input" ${dis} rows="${Math.min(14, Math.max(5, p.courses.length + 1))}" style="font-family:monospace;font-size:.82rem" onchange="dgProgField(${i},'courses',this.value)">${esc(coursesText(p.courses))}</textarea></div>
        <small class="scx-note">${p.courses.length} course${p.courses.length === 1 ? '' : 's'}. Titles in the samples are placeholders. Replace them with your university's syllabus.</small>
      </article>`;
    }).join('');
    return `<div style="margin-bottom:12px">
      <h5 style="margin:0 0 6px">Results settings (match your university)</h5>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="f-field" style="width:120px"><label>Internal marks (max)</label><input class="input" ${dis} type="number" min="0" max="100" value="${gd.internalMax}" onchange="dgGrade('internalMax',this.value)"></div>
        <div class="f-field" style="width:120px"><label>External marks (max)</label><input class="input" ${dis} type="number" min="1" max="100" value="${gd.externalMax}" onchange="dgGrade('externalMax',this.value)"></div>
        <div class="f-field" style="width:120px"><label>Pass mark (%)</label><input class="input" ${dis} type="number" min="0" max="100" value="${gd.passPct}" onchange="dgGrade('passPct',this.value)"></div>
        <div class="f-field" style="width:150px"><label>Minimum attendance (%)</label><input class="input" ${dis} type="number" min="0" max="100" value="${gd.attendanceMin}" onchange="dgGrade('attendanceMin',this.value)"></div>
      </div>
      <div class="f-field" style="margin-top:8px"><label>Grade scale <small style="font-weight:400;color:var(--ink-soft,#5b6784)">one per line: lowest % | grade | grade points. Below the last line is F. This is a common 10-point scale to start from, so check it against your university.</small></label>
        <textarea class="input" ${dis} rows="${gd.scale.length + 1}" style="font-family:monospace;font-size:.82rem;max-width:340px" onchange="dgScale(this.value)">${esc(gd.scale.map(r => r.min + ' | ' + r.grade + ' | ' + r.points).join('\n'))}</textarea></div>
    </div>
    ${canEdit() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${left.length ? `<select class="input" style="width:auto" onchange="dgAddStarter(this.value);this.value=''"><option value="">+ Add a sample programme&hellip;</option>${left.map(n => `<option>${esc(n)}</option>`).join('')}</select>` : ''}
      <button type="button" class="sf-btn sf-btn--soft" onclick="dgAddCustom()">+ Add your own programme</button></div>` : '<p class="scx-note">Only the Admin, Principal or Office Assistant can change this.</p>'}
    ${S.programmes.length ? cards : '<p class="scx-note">No programmes yet. Add a sample programme to start, then edit it.</p>'}
    ${canEdit() && S.programmes.length ? `<div class="scx-savebar" style="margin-top:8px"><span class="scx-save-state">Changes save as you type. Press Create to put the years, programmes and courses into the ERP.</span><button type="button" class="sf-btn sf-btn--primary sf-btn--lg" onclick="dgApply()">Create in the ERP</button></div>` : ''}`;
  }

  function cohortForSem(p, sem){ const y = yearOfSem(sem); return progStudents(p).filter(s => yearIdxOf(s.className) >= y).sort((a, b) => String(a.admissionNo || '').localeCompare(String(b.admissionNo || ''), undefined, { numeric: true })); }
  const semCourses = (p, sem) => (p.courses || []).filter(c => c.sem === sem);
  const semSelect = p => `<div class="f-field" style="width:130px"><label>Semester</label><select class="input" onchange="dgSel('sem',this.value)">${Array.from({ length: semsOf(p) }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === ui.sem ? 'selected' : ''}>Semester ${n}</option>`).join('')}</select></div>`;

  function tabMarks(){
    const p = prog(); if(!p) return noProg;
    if(ui.sem > semsOf(p)) ui.sem = 1;
    const cs = semCourses(p, ui.sem);
    if(!cs.some(c => c.id === ui.course)) ui.course = cs.length ? cs[0].id : '';
    const course = cs.find(c => c.id === ui.course), g = S.grading;
    const head = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">${progSelect()}${semSelect(p)}
      <div class="f-field" style="min-width:220px"><label>Course</label><select class="input" onchange="dgSel('course',this.value)">${cs.map(c => `<option value="${esc(c.id)}" ${c.id === ui.course ? 'selected' : ''}>${esc(c.title)} (${esc(c.type)}, ${c.credits} cr)</option>`).join('')}</select></div></div>`;
    if(!course) return head + '<p class="scx-note">This semester has no courses yet. Add them on the Programmes tab.</p>';
    const mx = maxOf(course, g), st = cohortForSem(p, ui.sem), dis = canMark() ? '' : 'disabled';
    const rows = st.map(s => {
      const m = (R.marks[s.id] || {})[course.id] || {}, r = courseResult(m, course, g);
      return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')} &middot; ${esc(s.className)}</small></td>
        <td><input class="input" style="width:84px" ${dis} type="number" min="0" max="${mx.i}" step="0.5" value="${m.i == null ? '' : esc(m.i)}" onchange="dgMark('${esc(s.id)}','${esc(course.id)}','i',this.value)"></td>
        <td><input class="input" style="width:84px" ${dis} type="number" min="0" max="${mx.e}" step="0.5" value="${m.e == null ? '' : esc(m.e)}" onchange="dgMark('${esc(s.id)}','${esc(course.id)}','e',this.value)"></td>
        <td>${r.entered ? '<b>' + r.total + '</b> / ' + r.max : '-'}</td><td>${r.complete ? '<b style="color:' + (r.passed ? '#1b7f3b' : '#b3261e') + '">' + esc(r.grade) + '</b>' : '-'}</td></tr>`;
    }).join('');
    return head + `<p class="scx-note" style="margin:0 0 8px">Internal out of <b>${mx.i}</b>, external out of <b>${mx.e}</b>. Leave a box empty until the marks are in. The grade appears when both are entered.</p>`
      + (st.length ? `<div style="max-height:460px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="scx-note">No students of this programme have reached this semester yet.</p>');
  }

  function studentSemResults(p, s, sem){ return semesterResult(semCourses(p, sem), R.marks[s.id] || {}, S.grading); }
  function tabResults(){
    const p = prog(); if(!p) return noProg;
    if(ui.sem > semsOf(p)) ui.sem = 1;
    const st = cohortForSem(p, ui.sem);
    const rows = st.map(s => {
      const sr = studentSemResults(p, s, ui.sem);
      const all = []; for(let n = 1; n <= semsOf(p); n++){ const x = studentSemResults(p, s, n); if(x.credits) all.push(x); }
      const status = !sr.total ? 'No courses' : !sr.complete ? 'Marks incomplete (' + sr.done + '/' + sr.total + ')' : sr.backlogs ? '<b style="color:#b3261e">' + sr.backlogs + ' backlog' + (sr.backlogs === 1 ? '' : 's') + '</b>' : '<b style="color:#1b7f3b">Pass</b>';
      return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')} &middot; ${esc(s.className)}</small></td><td>${sr.credits ? sr.earned + ' / ' + sr.credits : '-'}</td><td><b>${fmt2(sr.sgpa)}</b></td><td>${fmt2(cgpa(all))}</td><td>${status}</td><td><button type="button" class="sf-btn sf-btn--soft" onclick="dgPrint('${esc(s.id)}')">Mark sheet</button></td></tr>`;
    }).join('');
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">${progSelect()}${semSelect(p)}</div>`
      + (st.length ? `<div style="max-height:480px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Credits earned</th><th>SGPA</th><th>CGPA so far</th><th>Result</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p class="scx-note" style="margin-top:6px">SGPA is the credit-weighted average of grade points for the semester. CGPA covers every semester with marks. A course below the pass mark earns no credit and counts as a backlog.</p>` : '<p class="scx-note">No students of this programme have reached this semester yet.</p>');
  }

  function tabAttendance(){
    const gd = S.grading, rel = X.release || {}, recs = records();
    const all = active().filter(s => yearIdxOf(s.className) >= 1).filter(s => !ui.prog || ui.prog === 'all' || (S.programmes.find(p => p.id === ui.prog) || {}).name === s.section);
    const list = all.map(s => ({ s, a: attendancePct(recs, s.id) })).sort((x, y) => (x.a ? x.a.pct : 101) - (y.a ? y.a.pct : 101));
    const below = list.filter(x => x.a && x.a.pct < gd.attendanceMin);
    const rows = below.map(x => { const held = !rel[x.s.id];
      return `<tr><td><b>${esc(nameOf(x.s))}</b><br><small>${esc(x.s.admissionNo || '')} &middot; ${esc(x.s.className)} ${esc(x.s.section)}</small></td><td><b style="color:#b3261e">${Math.round(x.a.pct)}%</b><br><small>${x.a.present} of ${x.a.days} days</small></td><td>${held ? '<b style="color:#b3261e">Hold hall ticket</b>' : 'Cleared by the Principal'}</td><td>${canEdit() ? `<button type="button" class="sf-btn sf-btn--soft" onclick="dgRelease('${esc(x.s.id)}')">${held ? 'Clear (condoned)' : 'Hold again'}</button>` : ''}</td></tr>`; }).join('');
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px"><div class="f-field"><label>Programme</label><select class="input" onchange="dgSel('prog',this.value)"><option value="all" ${(!ui.prog || ui.prog === 'all') ? 'selected' : ''}>All programmes</option>${S.programmes.map(p => `<option value="${esc(p.id)}" ${p.id === ui.prog ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="f-field" style="width:170px"><label>Minimum attendance (%)</label><input class="input" ${canEdit() ? '' : 'disabled'} type="number" min="0" max="100" value="${gd.attendanceMin}" onchange="dgGrade('attendanceMin',this.value)"></div></div>`
      + `<p class="scx-note" style="margin:0 0 8px"><b>${below.length}</b> of ${all.length} student${all.length === 1 ? '' : 's'} below ${gd.attendanceMin}%. This is the hold list for hall tickets and fee reimbursement. Attendance counts only the days it was actually taken.</p>`
      + (below.length ? `<div style="max-height:420px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Attendance</th><th>Hall ticket</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="scx-note">Nobody is below the minimum.</p>');
  }

  const YN = ['', 'Yes', 'No'];
  function reimRow(s, recs){
    const r = X.reim[s.id] || {}, a = attendancePct(recs, s.id), st = reimStatus(r, a, S.grading.attendanceMin), dis = canEdit() ? '' : 'disabled';
    const inp = (f, ph) => `<input class="input" style="min-width:110px" ${dis} placeholder="${ph}" value="${esc(r[f] || '')}" onchange="dgReim('${esc(s.id)}','${f}',this.value)">`;
    const sel = f => `<select class="input" ${dis} onchange="dgReim('${esc(s.id)}','${f}',this.value)">${YN.map(v => `<option value="${v}" ${(r[f] || '') === v ? 'selected' : ''}>${v || '-'}</option>`).join('')}</select>`;
    const badge = !st.applying ? '<small>Not applying</small>' : st.ready ? '<b style="color:#1b7f3b">Ready for payment</b>' : '<b style="color:#b3261e">' + st.blockers.length + ' to fix</b><br><small>' + st.blockers.map(esc).join('<br>') + '</small>';
    return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')} &middot; ${esc(s.className)} ${esc(s.section)}</small></td>
      <td><input type="checkbox" ${dis} ${r.applying ? 'checked' : ''} onchange="dgReim('${esc(s.id)}','applying',this.checked)" aria-label="Applying for fee reimbursement"></td>
      <td>${inp('incomeNo', 'Income cert no.')}</td><td>${inp('casteNo', 'Caste cert no.')}</td><td>${inp('rationNo', 'Ration card no.')}</td><td>${sel('bank')}</td><td>${sel('bio')}</td>
      <td>${a ? Math.round(a.pct) + '%' : '-'}</td><td style="min-width:190px">${badge}</td></tr>`;
  }
  function tabReim(){
    const p = prog(); if(!p) return noProg;
    const ys = Array.from({ length: yearsOf(p) }, (_, i) => i + 1), y = ys.includes(Number(ui.year)) ? Number(ui.year) : 0;
    const st = (y ? inYear(p, y) : progStudents(p)).sort((a, b) => String(a.admissionNo || '').localeCompare(String(b.admissionNo || ''), undefined, { numeric: true }));
    const recs = records();
    const stats = st.map(s => reimStatus(X.reim[s.id], attendancePct(recs, s.id), S.grading.attendanceMin));
    const ap = stats.filter(x => x.applying).length, ready = stats.filter(x => x.ready).length;
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">${progSelect()}
      <div class="f-field"><label>Year</label><select class="input" onchange="dgSel('year',this.value)"><option value="">All years</option>${ys.map(n => `<option value="${n}" ${n === y ? 'selected' : ''}>Year ${n}</option>`).join('')}</select></div></div>
      <p class="scx-note" style="margin:0 0 8px">A tracking sheet for the college clerk. It does <b>not</b> connect to the government portal. <b>${ap}</b> applying, <b>${ready}</b> with nothing blocking, <b>${ap - ready}</b> with something to fix.</p>`
      + (st.length ? `<div style="max-height:480px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th><th>Applying</th><th>Income cert</th><th>Caste cert</th><th>Ration card</th><th>Mother's bank linked to Aadhaar</th><th>Biometric done</th><th>Attendance</th><th>Status</th></tr></thead><tbody>${st.map(s => reimRow(s, recs)).join('')}</tbody></table></div>` : '<p class="scx-note">No students in this selection.</p>');
  }

  const INT_KINDS = [['community', 'Community service'], ['short', 'Short-term internship'], ['semester', 'Semester internship']];
  const INT_STATUS = ['Not started', 'In progress', 'Completed'];
  function tabIntern(){
    const p = prog(); if(!p) return noProg;
    const st = progStudents(p).sort((a, b) => String(a.admissionNo || '').localeCompare(String(b.admissionNo || ''), undefined, { numeric: true })), dis = canEdit() ? '' : 'disabled';
    const done = k => st.filter(s => ((X.intern[s.id] || {})[k] || {}).status === 'Completed').length;
    const rows = st.map(s => { const r = X.intern[s.id] || {};
      return `<tr><td><b>${esc(nameOf(s))}</b><br><small>${esc(s.admissionNo || '')} &middot; ${esc(s.className)}</small></td>${INT_KINDS.map(([k]) => `<td><select class="input" ${dis} onchange="dgIntern('${esc(s.id)}','${k}','status',this.value)">${INT_STATUS.map(v => `<option ${((r[k] || {}).status || 'Not started') === v ? 'selected' : ''}>${v}</option>`).join('')}</select></td>`).join('')}<td><input class="input" ${dis} maxlength="120" placeholder="Where / remarks" value="${esc((r.note) || '')}" onchange="dgIntern('${esc(s.id)}','','note',this.value)"></td></tr>`; }).join('');
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">${progSelect()}</div>
      <p class="scx-note" style="margin:0 0 8px">${INT_KINDS.map(([k, l]) => l + ': <b>' + done(k) + '</b> of ' + st.length + ' completed').join(' &middot; ')}</p>`
      + (st.length ? `<div style="max-height:460px;overflow:auto"><table class="table" style="width:100%"><thead><tr><th>Student</th>${INT_KINDS.map(([, l]) => `<th>${l}</th>`).join('')}<th>Remarks</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="scx-note">No students in this programme yet.</p>');
  }

  function card(){
    if(!loaded){ if(!loading){ loading = true; load(); } return ''; }
    if(!ui.prog && S.programmes.length) ui.prog = S.programmes[0].id;
    const body = ui.tab === 'marks' ? tabMarks() : ui.tab === 'res' ? tabResults() : ui.tab === 'att' ? tabAttendance() : ui.tab === 'reim' ? tabReim() : ui.tab === 'int' ? tabIntern() : tabProgrammes();
    return scxCard('Degree College', 'Programmes and courses, marks and results, attendance, fee reimbursement and internships.',
      `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${tabBtn('prog', 'Programmes')}${tabBtn('marks', 'Marks')}${tabBtn('res', 'Results')}${tabBtn('att', 'Attendance')}${tabBtn('reim', 'Reimbursement')}${tabBtn('int', 'Internship')}</div>${body}`);
  }

  /* ---------------- actions ---------------- */
  window.dgTab = t => { ui.tab = t; paint(); };
  window.dgSel = (k, v) => { if(k === 'sem') ui.sem = Number(v) || 1; else if(k in ui) ui[k] = v; if(k === 'prog') ui.course = ''; paint(); };
  window.dgGrade = async (k, v) => { if(!canEdit() || !['internalMax', 'externalMax', 'passPct', 'attendanceMin'].includes(k)) return; S.grading[k] = Number(v); await persistS(); paint(); };
  window.dgScale = async v => {
    if(!canEdit()) return;
    const sc = String(v || '').split('\n').map(l => l.split('|').map(x => x.trim())).filter(a => a.length >= 3).map(a => ({ min: a[0], grade: a[1], points: a[2] }));
    if(!sc.length){ showToast('Add at least one line, like: 40 | C | 5'); paint(); return; }
    S.grading.scale = sc; await persistS(); paint();
  };
  window.dgAddStarter = async name => { if(!canEdit()) return; const p = starter(name); if(!p || S.programmes.some(x => norm(x.name) === norm(p.name))) return; S.programmes.push(p); ui.prog = p.id; await persistS(); paint(); showToast(name + ' added. Replace the sample course titles with your university\'s syllabus.'); };
  window.dgAddCustom = async () => {
    if(!canEdit()) return; let n = 1; while(S.programmes.some(p => norm(p.name) === 'programme ' + n)) n++;
    const p = { id: 'prg_' + Date.now(), name: 'PROGRAMME ' + n, full: '', pattern: 'honours4', stream: 'Other', seats: [60, 60, 60, 60], courses: [] };
    S.programmes.push(p); ui.prog = p.id; await persistS(); paint();
  };
  window.dgProgRemove = async i => {
    if(!canEdit() || !S.programmes[i]) return; const p = S.programmes[i], n = progStudents(p).length;
    if(n){ showToast(p.name + ' has ' + n + ' student' + (n === 1 ? '' : 's') + ', so it cannot be removed from this list.'); return; }
    if(!await showConfirmDialog('Remove ' + p.name + ' from this list? (Classes and subjects already created in the ERP stay as they are.)')) return;
    S.programmes.splice(i, 1); await persistS(); paint();
  };
  window.dgProgField = async (i, f, v) => {
    if(!canEdit() || !S.programmes[i]) return; const p = S.programmes[i];
    if(f === 'name'){
      const nm = String(v || '').trim().slice(0, 24).toUpperCase();
      if(!nm){ showToast('A programme needs a name.'); paint(); return; }
      if(S.programmes.some((x, k) => k !== i && norm(x.name) === norm(nm))){ showToast('Another programme already has that name.'); paint(); return; }
      if(progStudents(p).length && norm(nm) !== norm(p.name)){ showToast(p.name + ' already has students, so its name is locked.'); paint(); return; }
      p.name = nm;
    } else if(f === 'full') p.full = String(v || '').slice(0, 80);
    else if(f === 'pattern'){ if(progStudents(p).length && v !== p.pattern){ showToast(p.name + ' already has students, so its pattern is locked.'); paint(); return; } p.pattern = v === 'degree3' ? 'degree3' : 'honours4'; p.courses = p.courses.filter(c => c.sem <= semsOf(p)); }
    else if(f === 'stream') p.stream = v;
    else if(/^seats[0-3]$/.test(f)) p.seats[Number(f[5])] = Math.max(0, parseInt(v, 10) || 0);
    else if(f === 'courses'){ const list = parseCourses(v, S.grading).filter(c => c.sem <= semsOf(p)); p.courses = list; }
    await persistS(); paint();
  };

  window.dgMark = async (sid, cid, field, v) => {
    if(!canMark() || (field !== 'i' && field !== 'e')) return;
    const p = prog(), c = p && p.courses.find(x => x.id === cid); if(!c) return;
    const mx = maxOf(c, S.grading), max = field === 'i' ? mx.i : mx.e;
    const m = (R.marks[sid] = R.marks[sid] || {}), cell = (m[cid] = m[cid] || {});
    if(v === '' || v == null){ delete cell[field]; }
    else {
      const n = Number(v);
      if(!isFinite(n) || n < 0 || n > max){ showToast('Marks must be between 0 and ' + max + '.'); paint(); return; }
      cell[field] = n;
    }
    if(!('i' in cell) && !('e' in cell)) delete m[cid];
    if(!Object.keys(m).length) delete R.marks[sid];
    await persistR(); paint();
  };
  window.dgRelease = async sid => { if(!canEdit()) return; X.release = X.release || {}; if(X.release[sid]) delete X.release[sid]; else X.release[sid] = true; await persistX(); paint(); };
  window.dgReim = async (sid, f, v) => {
    if(!canEdit() || !['applying', 'incomeNo', 'casteNo', 'rationNo', 'bank', 'bio'].includes(f)) return;
    const r = (X.reim[sid] = X.reim[sid] || {});
    if(f === 'applying') r.applying = !!v; else if(f === 'bank' || f === 'bio') r[f] = ['Yes', 'No'].includes(v) ? v : ''; else r[f] = String(v || '').trim().slice(0, 40);
    await persistX(); paint();
  };
  window.dgIntern = async (sid, kind, f, v) => {
    if(!canEdit()) return; const r = (X.intern[sid] = X.intern[sid] || {});
    if(kind === ''){ if(f === 'note') r.note = String(v || '').slice(0, 120); }
    else if(INT_KINDS.some(k => k[0] === kind) && f === 'status' && INT_STATUS.includes(v)) r[kind] = { status: v };
    await persistX(); paint();
  };

  window.dgPrint = sid => {
    const p = prog(), s = active().find(x => x.id === sid); if(!p || !s) return;
    let body = '', all = [];
    for(let n = 1; n <= semsOf(p); n++){
      const sr = studentSemResults(p, s, n); if(!sr.total || !sr.done) continue; all.push(sr);
      body += `<h3>Semester ${n}</h3><table><thead><tr><th>Course</th><th>Type</th><th>Credits</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th><th>Points</th></tr></thead><tbody>`
        + sr.rows.map(r => { const m = (R.marks[s.id] || {})[r.course.id] || {}; return `<tr><td>${esc(r.course.title)}</td><td>${esc(r.course.type)}</td><td>${r.course.credits}</td><td>${r.res.complete ? esc(m.i == null ? '' : m.i) : '-'}</td><td>${r.res.complete ? esc(m.e == null ? '' : m.e) : '-'}</td><td>${r.res.complete ? r.res.total + '/' + r.res.max : '-'}</td><td>${r.res.complete ? esc(r.res.grade) : '-'}</td><td>${r.res.complete ? r.res.points : '-'}</td></tr>`; }).join('')
        + `</tbody></table><p><b>SGPA: ${fmt2(sr.sgpa)}</b> &nbsp; Credits earned: ${sr.earned} of ${sr.credits}${sr.backlogs ? ' &nbsp; Backlogs: ' + sr.backlogs : ''}</p>`;
    }
    if(!body){ showToast('No marks have been entered for this student yet.'); return; }
    const w = window.open('', '_blank');
    if(!w){ showToast('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
    let sch = ''; try { sch = (schoolInfo && schoolInfo.name) || ''; } catch(e){}
    w.document.write(`<html><head><title>Mark sheet ${esc(s.admissionNo || s.id)}</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111}h1{font-size:20px;margin:0}h2{font-size:15px;margin:2px 0 14px;font-weight:400}h3{font-size:14px;margin:16px 0 6px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #888;padding:5px 7px;text-align:left}th{background:#eee}.who{margin:10px 0 4px;font-size:13px}</style></head><body onload="window.print()"><h1>${esc(sch || 'Degree College')}</h1><h2>Semester mark sheet</h2><div class="who"><b>${esc(nameOf(s))}</b> &nbsp; Admission no: ${esc(s.admissionNo || '')} &nbsp; Programme: ${esc(p.name)}${p.full ? ' (' + esc(p.full) + ')' : ''} &nbsp; ${esc(s.className)}</div>${body}<p><b>CGPA: ${fmt2(cgpa(all))}</b></p></body></html>`);
    w.document.close();
  };

  /* Put the structure into the ERP. Additive only. */
  window.dgApply = async function(){
    if(!canEdit()) return;
    S = clean(S);
    if(!S.programmes.length){ showToast('Add at least one programme first.'); return; }
    const classes = [], sections = [];
    S.programmes.forEach(p => { for(let n = 1; n <= yearsOf(p); n++){ const c = yearClass(p, n); if(!CLASS_LEVELS.includes(c) && !classes.includes(c)) classes.push(c); } if(!SECTIONS.some(s => norm(s) === norm(p.name)) && !sections.includes(p.name)) sections.push(p.name); });
    let addSubj = 0, extSubj = 0; const plan = [];
    S.programmes.forEach(p => p.courses.forEach(c => {
      const cls = yearClass(p, yearOfSem(c.sem)), ex = subjectsList.find(x => x.className === cls && norm(x.name) === norm(c.title));
      if(!ex) addSubj++; else if(!(ex.sections || []).some(z => norm(z) === norm(p.name))) extSubj++;
      plan.push([cls, p, c]);
    }));
    const msg = 'This will add to the ERP: ' + (classes.length ? 'classes ' + classes.join(', ') : 'no new classes') + '; ' + (sections.length ? 'sections ' + sections.join(', ') : 'no new sections') + '; subjects: ' + addSubj + ' new and ' + extSubj + ' extended to more programmes. Nothing is removed. Continue?';
    if(!await showConfirmDialog(msg, { title: 'Create the Degree College structure?', okText: 'Create' })) return;
    /* Existing classes keep exactly the sections they have now, so programmes never show up under school classes. */
    const oldSections = SECTIONS.slice();
    CLASS_LEVELS.forEach(c => { if(!/^(Honours|Degree) Year \d$/.test(c) && !(classSectionOverrides[c] && classSectionOverrides[c].length)) classSectionOverrides[c] = oldSections.slice(); });
    classes.forEach(c => CLASS_LEVELS.push(c));
    sections.forEach(n => SECTIONS.push(n));
    S.programmes.forEach(p => { for(let n = 1; n <= yearsOf(p); n++){ const c = yearClass(p, n); const cur = classSectionOverrides[c] && classSectionOverrides[c].length ? classSectionOverrides[c].slice() : []; if(!cur.some(s => norm(s) === norm(p.name))) cur.push(p.name); classSectionOverrides[c] = cur; } });
    let stamp = Date.now();
    plan.forEach(([cls, p, c]) => {
      const ex = subjectsList.find(x => x.className === cls && norm(x.name) === norm(c.title));
      if(!ex) subjectsList.push({ id: 'dsub_' + (stamp++), name: c.title, code: '', className: cls, sections: [p.name], sectionStaff: {}, staffIds: [], countable: true, elective: ELECTIVE_TYPES.includes(c.type) });
      else { ex.sections = Array.isArray(ex.sections) ? ex.sections : []; if(!ex.sections.some(z => norm(z) === norm(p.name))) ex.sections.push(p.name); if(ELECTIVE_TYPES.includes(c.type)) ex.elective = true; }
    });
    try {
      await storageSet('class-levels', CLASS_LEVELS); await storageSet('section-levels', SECTIONS);
      await storageSet('class-section-overrides', classSectionOverrides); await storageSet(SUBJECTS_KEY, subjectsList); await persistS();
    } catch(e){ showToast('Could not save everything. Please try again.'); return; }
    showToast('Done. Your years, programmes and courses are ready.', 'burst');
    try { renderClassesTab(document.getElementById('classesSetupBody')); } catch(e){ paint(); }
  };

  window.dgData = () => ({ S, R, X });
  if(typeof window.clgRegisterDegreeCard === 'function') window.clgRegisterDegreeCard(card);
})();
