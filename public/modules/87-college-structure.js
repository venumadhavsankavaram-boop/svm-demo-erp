/* =========================================================================
   Junior College structure (Setup > Classes).
   One switch - School or Junior College - and, for a Junior College, a setup screen for
   1st Year / 2nd Year, the combinations (MPC, BiPC, CEC, HEC ...), the subjects of each
   combination, and seats per year.

   How it fits the rest of the ERP (nothing existing is changed or renamed):
     - the two years are ordinary classes ("1st Year", "2nd Year");
     - each combination is an ordinary section of those classes, so fees, attendance,
       timetable, exams, report cards and admit cards all work as they do for a school;
     - subjects are ordinary subjects added to the matching sections;
     - "Optional" subjects use the existing Elective flag.
   Applying the structure only ADDS things. It never removes a class, section, subject or student.
   A School install keeps its switch on "School" and sees only a small card; nothing else changes.
   ========================================================================= */
(function(){
  'use strict';
  const KEY = 'college-structure';
  const YEARS = ['1st Year', '2nd Year'];
  try { OBJECT_BACKED_KEYS[KEY] = '/api/kv/' + KEY; } catch(e){}

  const LOOKS = [
    { id: 'classic', name: 'Classic', note: 'The original ERP look.' },
    { id: 'portal', name: 'Top-bar Portal', note: 'Navy and orange, menu along the top. Looks least like the school ERP.' },
    { id: 'campus', name: 'Campus Green', note: 'Deep green sidebar with gold accents.' },
    { id: 'academic', name: 'Light Academic', note: 'Ivory and white, navy and maroon, serif headings.' },
    { id: 'minimal', name: 'Modern Minimal', note: 'Clean white and grey with one indigo accent.' },
  ];
  let data = { institutionType: 'school', look: 'classic', combos: [] };
  let loaded = false;
  /* The College Pack is switched off everywhere (the public demo, every school) until the server setting COLLEGE_PACK=true is added on that install. */
  let packOn = null;
  async function packEnabled(){
    if(packOn !== null) return packOn;
    try { const r = await fetch('/api/demo-info', { cache: 'no-store' }); const j = r.ok ? await r.json() : null; packOn = !!(j && j.collegePack); } catch(e){ packOn = false; }
    return packOn;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').trim().toLowerCase();
  const canEdit = () => { try { return !!currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Principal'); } catch(e){ return false; } };

  /* Standard combinations most Andhra Pradesh / Telangana junior colleges run. All names are editable. */

  /* Other groups colleges commonly run. Not added automatically; picked from a list. Subjects are a starting point to edit. */
  const voc = (name, full) => ({ stream: 'Vocational', name, full, seats: [40, 40], subjects: ['English', 'General Foundation Course', full + ' Paper I', full + ' Paper II', full + ' Practical I', full + ' Practical II'] });
  const OPTIONAL = [
    { stream: 'Commerce', name: 'MEC', full: 'Mathematics, Economics, Commerce', seats: [60, 60], subjects: ['English', 'Second Language', 'Mathematics A', 'Economics', 'Commerce'] },
    voc('Accountancy', 'Accountancy and Taxation'), voc('Digital Mktg', 'Digital Marketing'), voc('Graphic Design', 'Graphic Design'),
    voc('Pharma Asst', 'Pharmaceutical Assistant'), voc('MLT', 'Medical Lab Technology'), voc('AI & ML', 'Artificial Intelligence and Machine Learning'),
    voc('Cloud & Data', 'Cloud Computing and Big Data'), voc('Electronics', 'Electronics and Video Engineering'),
  ];
  const PRESETS = [
    { stream: 'Science', name: 'MPC', seats: [60, 60], subjects: ['English', 'Second Language', 'Mathematics A', 'Mathematics B', 'Physics', 'Chemistry', 'Physics Practical', 'Chemistry Practical'] },
    { stream: 'Science', name: 'BiPC', seats: [60, 60], subjects: ['English', 'Second Language', 'Botany', 'Zoology', 'Physics', 'Chemistry', 'Botany Practical', 'Zoology Practical', 'Physics Practical', 'Chemistry Practical'] },
    { stream: 'Commerce', name: 'CEC', seats: [60, 60], subjects: ['English', 'Second Language', 'Civics', 'Economics', 'Commerce'] },
    { stream: 'Arts', name: 'HEC', seats: [60, 60], subjects: ['English', 'Second Language', 'History', 'Economics', 'Civics'] },
  ];

  function clean(d){
    const out = { institutionType: d && d.institutionType === 'junior_college' ? 'junior_college' : 'school', look: LOOKS.some(l => l.id === (d && d.look)) ? d.look : (d && d.institutionType === 'junior_college' ? 'portal' : 'classic'), combos: [] };
    ((d && d.combos) || []).forEach(c => {
      const name = String(c.name || '').trim().slice(0, 16);
      if(!name) return;
      out.combos.push({
        id: c.id || ('cmb_' + Math.random().toString(36).slice(2, 8)),
        stream: ['Science', 'Commerce', 'Arts', 'Vocational', 'Other'].includes(c.stream) ? c.stream : 'Other',
        name,
        seats: [Math.max(0, parseInt((c.seats || [])[0], 10) || 0), Math.max(0, parseInt((c.seats || [])[1], 10) || 0)],
        subjects: (c.subjects || []).map(s => String(s).trim()).filter(Boolean).slice(0, 30),
      });
    });
    return out;
  }
  async function load(){
    try { data = clean(await storageGet(KEY, data)); } catch(e){ /* keep defaults */ }
    loaded = true;
  }
  async function persist(){
    data = clean(data);
    await storageSet(KEY, data);
  }

  /* A subject line ending in "(optional)" becomes an elective. */
  function parseSubject(line){
    const m = /^(.*?)\s*\(\s*optional\s*\)\s*$/i.exec(line);
    return m ? { name: m[1].trim(), optional: true } : { name: String(line).trim(), optional: false };
  }

  function seatUsage(cls, sec){
    try {
      return scxActiveStudents().filter(s => s.className === cls && s.section === sec).length;
    } catch(e){ return 0; }
  }

  function card(title, hint, inner){ return scxCard(title, hint, inner); }

  function typeBtn(val, label, on, dis){
    return `<button type="button" ${dis} data-clg-type="${val}" onclick="clgSetType('${val}')" aria-pressed="${on}" style="padding:10px 20px;border-radius:12px;border:2px solid ${on ? 'var(--navy,#1a2a52)' : 'var(--border,#dde3ee)'};background:${on ? 'var(--navy,#1a2a52)' : 'transparent'};color:${on ? '#fff' : 'var(--navy,#1a2a52)'};font-weight:700;cursor:pointer">${label}</button>`;
  }
  function typeCard(){
    const jc = data.institutionType === 'junior_college';
    const dis = canEdit() ? '' : 'disabled';
    return card('What kind of institution is this?', 'A school runs classes from Baby Class to 10th. A junior college runs 1st Year and 2nd Year with combinations such as MPC and BiPC. You can switch any time and nothing is deleted.',
      `<div style="display:flex;gap:10px;flex-wrap:wrap">${typeBtn('school', 'School', !jc, dis)}${typeBtn('junior_college', 'Junior College', jc, dis)}</div>`)
      + (true ? card('Look of the ERP', 'Pick how this ERP looks. It works for a school or a college, applies to everyone using this ERP, and can be changed any time.',
        `<div style="display:flex;gap:10px;flex-wrap:wrap">${LOOKS.map(l => `<button type="button" ${dis} class="sf-btn ${data.look === l.id ? 'sf-btn--primary' : 'sf-btn--soft'}" style="flex:1 1 200px;text-align:left;display:block;padding:12px 14px" onclick="clgChooseLook('${l.id}')"><b>${esc(l.name)}</b><br><small style="font-weight:400">${esc(l.note)}</small></button>`).join('')}</div>`) : '');
  }
  window.clgChooseLook = async function(id){
    if(!canEdit() || !LOOKS.some(l => l.id === id)) return;
    data.look = id; setLook(id !== 'classic', id); await persist(); paint();
    showToast('Look changed to ' + LOOKS.find(l => l.id === id).name + '.');
  };

  function comboCard(c, i){
    const dis = canEdit() ? '' : 'disabled';
    const u1 = seatUsage(YEARS[0], c.name), u2 = seatUsage(YEARS[1], c.name);
    const meter = (n, seats, label) => {
      const full = seats > 0 && n >= seats;
      return `<span style="font-size:.78rem;color:${full ? '#b3261e' : 'var(--ink-soft,#5b6784)'}">${label}: <b>${n}</b>${seats ? ' of ' + seats + ' seats' + (full ? ' (full)' : '') : ' students'}</span>`;
    };
    return `<article class="sf-card" style="padding:14px;margin-bottom:10px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="f-field" style="min-width:110px;flex:1"><label>Combination</label><input class="input" ${dis} maxlength="16" value="${esc(c.name)}" onchange="clgField(${i},'name',this.value)"></div>
        <div class="f-field" style="min-width:120px"><label>Stream</label><select class="input" ${dis} onchange="clgField(${i},'stream',this.value)">${['Science', 'Commerce', 'Arts', 'Vocational', 'Other'].map(s => `<option ${s === c.stream ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="f-field" style="width:100px"><label>1st Year seats</label><input class="input" ${dis} type="number" min="0" value="${c.seats[0]}" onchange="clgField(${i},'seats0',this.value)"></div>
        <div class="f-field" style="width:100px"><label>2nd Year seats</label><input class="input" ${dis} type="number" min="0" value="${c.seats[1]}" onchange="clgField(${i},'seats1',this.value)"></div>
        ${canEdit() ? `<button type="button" class="scx-x" onclick="clgRemove(${i})" title="Remove combination" aria-label="Remove ${esc(c.name)}">&times;</button>` : ''}
      </div>
      <div class="f-field" style="margin-top:8px"><label>Subjects <small style="font-weight:400;color:var(--ink-soft,#5b6784)">one per line &middot; add (optional) after a subject the student may choose</small></label>
        <textarea class="input" ${dis} rows="${Math.min(10, Math.max(4, c.subjects.length + 1))}" onchange="clgField(${i},'subjects',this.value)">${esc(c.subjects.join('\n'))}</textarea></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">${meter(u1, c.seats[0], '1st Year')}${meter(u2, c.seats[1], '2nd Year')}</div>
    </article>`;
  }

  function optionsLeft(){ const have = new Set(data.combos.map(c => norm(c.name))); return OPTIONAL.filter(o => !have.has(norm(o.name))); }

  function collegeCard(){
    if(data.institutionType !== 'junior_college') return '';
    const have = new Set(data.combos.map(c => norm(c.name)));
    const missing = PRESETS.filter(p => !have.has(norm(p.name)));
    return card('Junior College setup', 'Step 1: list your combinations, subjects and seats. Step 2: press Create in the ERP. It adds 1st Year and 2nd Year as classes, each combination as a section, and the subjects. It only adds, never removes.', `
      ${canEdit() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${missing.length ? `<button type="button" class="sf-btn sf-btn--soft" onclick="clgAddStandard()">Add standard combinations (${missing.map(m => esc(m.name)).join(', ')})</button>` : ''}
        ${optionsLeft().length ? `<select class="input" style="width:auto" onchange="clgAddOption(this.value);this.value=''"><option value="">+ Add from the usual groups&hellip;</option>${optionsLeft().map(o => `<option value="${esc(o.name)}">${esc(o.name)} &mdash; ${esc(o.full)}</option>`).join('')}</select>` : ''}
        <button type="button" class="sf-btn sf-btn--soft" onclick="clgAddCustom()">+ Add your own group</button>
      </div>` : '<p class="scx-note">Only the Admin or Principal can change this.</p>'}
      ${data.combos.length ? data.combos.map(comboCard).join('') : '<p class="scx-note">No combinations yet. Press "Add standard combinations" to start from the usual ones.</p>'}
      ${canEdit() && data.combos.length ? `<div class="scx-savebar" style="margin-top:8px"><span class="scx-save-state">Changes save as you type. Press Create to put them into the ERP.</span><button type="button" class="sf-btn sf-btn--primary sf-btn--lg" onclick="clgApply()">Create in the ERP</button></div>` : ''}`);
  }

  /* Which class a student moves to at year-end. Returns null when this module has no opinion (everything works
     exactly as before), '' to mean "graduates / leaves", or a class name.
       - 1st Year -> 2nd Year (the combination, i.e. the section, stays the same);
       - 2nd Year -> leaves the college (for example to a Degree college);
       - once the Junior College structure exists, the school class just before 1st Year leaves as well,
         because joining 1st Year is a new admission into a combination, not an automatic promotion. */
  window.clgNextClass = function(cls){
    try {
      const i1 = CLASS_LEVELS.indexOf(YEARS[0]), i2 = CLASS_LEVELS.indexOf(YEARS[1]);
      if(i1 < 0 || i2 < 0 || !(classSectionOverrides[YEARS[0]] && classSectionOverrides[YEARS[0]].length)) return null;
      if(cls === YEARS[0]) return YEARS[1];
      if(cls === YEARS[1]) return '';
      if(CLASS_LEVELS.indexOf(cls) === i1 - 1) return '';
    } catch(e){}
    return null;
  };

  /* Asked just before a NEW student is saved: if the chosen combination of 1st or 2nd Year has no seat left, say so and let the
     office decide. Returns true to carry on. Never blocks a school class or a combination without a seat number. */
  window.clgSeatCheck = async function(stu){
    try {
      if(!stu || !YEARS.includes(stu.className)) return true;
      if(!loaded) await load();
      const c = data.combos.find(x => norm(x.name) === norm(stu.section));
      const seats = c ? c.seats[YEARS.indexOf(stu.className)] : 0;
      if(!c || !seats) return true;
      const used = seatUsage(stu.className, c.name);
      if(used < seats) return true;
      return await showConfirmDialog(c.name + ' in ' + stu.className + ' has ' + used + ' students for ' + seats + ' seats, so it is full. Admit this student anyway?', { title: 'No seat left in ' + c.name, okText: 'Admit anyway', cancelText: 'Cancel' });
    } catch(e){ return true; }
  };


  /* College wording. With "Junior College" chosen, the Classes menu entry and page heading read "Years & Combinations".
     Nothing else is renamed, so a school install (or a college that has not chosen yet) reads exactly as before. */
  const wordOrig = {};
  function applyWording(){
    try {
      const jc = data.institutionType === 'junior_college';
      setLook(data.look !== 'classic', data.look);
      const nav = document.getElementById('navClassesSetup');
      if(nav){
        const tn = Array.from(nav.childNodes).reverse().find(n => n.nodeType === 3 && n.textContent.trim());
        if(tn){ if(!('nav' in wordOrig)) wordOrig.nav = tn.textContent; tn.textContent = jc ? ' Years & Combinations' : wordOrig.nav; }
      }
      const view = document.getElementById('view-classessetup');
      const h1 = view && view.querySelector('.topbar h1'), p = view && view.querySelector('.topbar p');
      if(h1){ if(!('h1' in wordOrig)) wordOrig.h1 = h1.textContent; h1.textContent = jc ? 'Years & Combinations' : wordOrig.h1; }
      if(p){ if(!('p' in wordOrig)) wordOrig.p = p.textContent; p.textContent = jc ? 'Manage 1st Year, 2nd Year and the combinations (MPC, BiPC, CEC, HEC) your college teaches.' : wordOrig.p; }
    } catch(e){}
  }
  /* The college look (palette and pattern, see index.html). On for Junior College only. */
  const LOOK_FONTS = {
    portal: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
    campus: 'Inter:wght@400;500;600;700&family=Source+Serif+4:wght@600;700',
    academic: 'Newsreader:wght@500;600&family=Public+Sans:wght@400;500;600',
    minimal: 'DM+Sans:wght@400;500;700',
  };
  /* The top-bar look turns each menu section into a drop-down. Wrap every heading + its links once (harmless in the other looks). */
  function wrapSections(){
    try {
      document.querySelectorAll('.sb-nav-scroll > .sb-section-toggle').forEach(t => {
        const g = t.nextElementSibling;
        if(!g || !g.classList.contains('sb-section-group') || (t.parentNode && t.parentNode.classList.contains('sb-top-sec'))) return;
        const w = document.createElement('div'); w.className = 'sb-top-sec';
        t.parentNode.insertBefore(w, t); w.appendChild(t); w.appendChild(g);
      });
    } catch(e){}
  }
  function storedLook(){ try { const v = localStorage.getItem('clgLook'); return LOOKS.some(l => l.id === v) ? v : null; } catch(e){ return null; } }
  function setLook(on, look){ try {
      const lk = LOOKS.some(l => l.id === look) ? look : (storedLook() || 'portal');
      if(lk === 'classic') on = false;
      if(on){
        const id = 'clgFonts';
        let link = document.getElementById(id);
        if(!link){ link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = 'https://fonts.googleapis.com/css2?family=' + LOOK_FONTS[lk] + '&display=swap';
        document.documentElement.setAttribute('data-institution', 'college');
        document.documentElement.setAttribute('data-clook', lk);
        try { localStorage.setItem('clgLook', lk); } catch(e){}
        wrapSections();
      } else { document.documentElement.removeAttribute('data-institution'); document.documentElement.removeAttribute('data-clook'); try { localStorage.setItem('clgLook', lk); } catch(e){} } } catch(e){} }
  window.clgSetLook = setLook;
  window.clgApplyWording = applyWording;
  /* Load the saved choice once the user is signed in, so the menu reads right from the first screen. */
  (function early(){
    try { if(typeof fetch === 'function') fetch('/api/demo-info', { credentials: 'same-origin' }).then(r => r.json()).then(j => { if(j && j.collegePack){ const lk = storedLook() || (j.collegeLook ? 'portal' : 'classic'); setLook(lk !== 'classic', lk); } }).catch(() => {}); } catch(e){}
  })();
  (function boot(){
    if(typeof setInterval !== 'function') return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      let ready = false; try { ready = !!currentUser; } catch(e){}
      if(ready){ clearInterval(t); try { if(await packEnabled()){ if(!loaded) await load(); applyWording(); try { if(typeof window.clgRenderDash === 'function' && document.getElementById('view-dashboard') && document.getElementById('view-dashboard').children.length) window.clgRenderDash(); } catch(e){} } } catch(e){} }
      else if(tries > 90) clearInterval(t);
    }, 1000);
  })();

  /* Other college modules (practicals, scholarships) add their cards here. */
  const extras = [];
  window.clgRegisterCard = fn => { if(typeof fn === 'function') extras.push(fn); };
  window.clgRepaint = () => paint();
  window.clgLoaded = () => !!loaded;
  window.clgIsJuniorCollege = () => data.institutionType === 'junior_college';

  function paint(){
    const host = document.getElementById('collegeSetupHost');
    if(!host) return;
    applyWording();
    host.innerHTML = typeCard() + collegeCard() + (data.institutionType === 'junior_college' ? extras.map(f => { try { return f(); } catch(e){ return ''; } }).join('') : '');
  }

  async function ensureHost(body){
    if(!body) return;
    if(!(await packEnabled())) return;
    if(!loaded) await load();
    let host = document.getElementById('collegeSetupHost');
    if(!host || !body.contains(host)){
      host = document.createElement('div'); host.id = 'collegeSetupHost';
      body.insertBefore(host, body.firstChild);
    }
    paint();
  }

  /* ---- actions ---- */
  window.clgSetType = async function(t){
    if(!canEdit()) return;
    data.institutionType = t === 'junior_college' ? 'junior_college' : 'school';
    if(data.institutionType === 'junior_college' && data.look === 'classic') data.look = 'portal';
    await persist(); paint();
    showToast(data.institutionType === 'junior_college' ? 'Junior College selected. Add your combinations below.' : 'School selected.');
  };
  window.clgAddStandard = async function(){
    if(!canEdit()) return;
    const have = new Set(data.combos.map(c => norm(c.name)));
    PRESETS.forEach(p => { if(!have.has(norm(p.name))) data.combos.push({ id: 'cmb_' + p.name, stream: p.stream, name: p.name, seats: p.seats.slice(), subjects: p.subjects.slice() }); });
    await persist(); paint();
    showToast('Standard combinations added. Edit names, subjects and seats to match your college.');
  };
  window.clgAddOption = async function(name){
    if(!canEdit()) return;
    const o = OPTIONAL.find(x => x.name === name);
    if(!o || data.combos.some(c => norm(c.name) === norm(o.name))) return;
    data.combos.push({ id: 'cmb_' + o.name.replace(/\W+/g, ''), stream: o.stream, name: o.name, seats: o.seats.slice(), subjects: o.subjects.slice() });
    await persist(); paint();
    showToast(o.name + ' added. Edit its subjects and seats, then press Create in the ERP.');
  };
  window.clgAddCustom = async function(){
    if(!canEdit()) return;
    let n = 1; while(data.combos.some(c => norm(c.name) === 'combo ' + n)) n++;
    data.combos.push({ id: 'cmb_' + Date.now(), stream: 'Other', name: 'Combo ' + n, seats: [60, 60], subjects: ['English', 'Second Language'] });
    await persist(); paint();
  };
  window.clgRemove = async function(i){
    if(!canEdit() || !data.combos[i]) return;
    const c = data.combos[i];
    const used = YEARS.reduce((a, y) => a + seatUsage(y, c.name), 0);
    if(used){ showToast(c.name + ' has ' + used + ' student' + (used === 1 ? '' : 's') + ', so it cannot be removed from this list.'); return; }
    if(!await showConfirmDialog('Remove ' + c.name + ' from this list? (Classes and subjects already created in the ERP stay as they are.)')) return;
    data.combos.splice(i, 1); await persist(); paint();
  };
  window.clgField = async function(i, f, v){
    if(!canEdit() || !data.combos[i]) return;
    const c = data.combos[i];
    if(f === 'name'){
      const nm = String(v || '').trim().slice(0, 16);
      if(!nm){ showToast('A combination needs a name.'); paint(); return; }
      if(data.combos.some((x, k) => k !== i && norm(x.name) === norm(nm))){ showToast('Another combination already has that name.'); paint(); return; }
      const used = YEARS.reduce((a, y) => a + seatUsage(y, c.name), 0);
      if(used && norm(nm) !== norm(c.name)){ showToast(c.name + ' already has students, so its name is locked. Add a new combination instead.'); paint(); return; }
      c.name = nm;
    }
    else if(f === 'stream') c.stream = v;
    else if(f === 'seats0') c.seats[0] = Math.max(0, parseInt(v, 10) || 0);
    else if(f === 'seats1') c.seats[1] = Math.max(0, parseInt(v, 10) || 0);
    else if(f === 'subjects') c.subjects = String(v || '').split('\n').map(s => s.trim()).filter(Boolean);
    await persist(); paint();
  };

  /* Put the structure into the ERP. Additive only. */
  window.clgApply = async function(){
    if(!canEdit()) return;
    data = clean(data);
    if(!data.combos.length){ showToast('Add at least one combination first.'); return; }
    const newClasses = YEARS.filter(y => !CLASS_LEVELS.includes(y));
    const newSections = data.combos.map(c => c.name).filter(n => !SECTIONS.some(s => norm(s) === norm(n)));
    let addSubj = 0, extendSubj = 0;
    const plan = [];
    data.combos.forEach(c => {
      const subs = c.subjects.map(parseSubject).filter(s => s.name);
      YEARS.forEach(y => subs.forEach(s => {
        const ex = subjectsList.find(x => x.className === y && norm(x.name) === norm(s.name));
        if(!ex) addSubj++;
        else if(!(ex.sections || []).some(z => norm(z) === norm(c.name))) extendSubj++;
        plan.push([y, c, s]);
      }));
    });
    const msg = 'This will add to the ERP: '
      + (newClasses.length ? 'classes ' + newClasses.join(' and ') : 'no new classes') + '; '
      + (newSections.length ? 'sections ' + newSections.join(', ') : 'no new sections') + '; '
      + 'subjects: ' + addSubj + ' new and ' + extendSubj + ' extended to more combinations. Nothing is removed. Continue?';
    if(!await showConfirmDialog(msg, { title: 'Create the Junior College structure?', okText: 'Create' })) return;

    /* School classes that use the shared section list must keep exactly the sections they have now,
       so the new combinations never show up under Baby Class ... 10th Class. */
    const oldSections = SECTIONS.slice();
    CLASS_LEVELS.forEach(c => { if(!YEARS.includes(c) && !(classSectionOverrides[c] && classSectionOverrides[c].length)) classSectionOverrides[c] = oldSections.slice(); });
    newClasses.forEach(y => CLASS_LEVELS.push(y));
    newSections.forEach(n => SECTIONS.push(n));
    YEARS.forEach(y => {
      const cur = classSectionOverrides[y] && classSectionOverrides[y].length ? classSectionOverrides[y].slice() : [];
      data.combos.forEach(c => { if(!cur.some(s => norm(s) === norm(c.name))) cur.push(c.name); });
      classSectionOverrides[y] = cur;
    });
    let stamp = Date.now();
    plan.forEach(([y, c, s]) => {
      let ex = subjectsList.find(x => x.className === y && norm(x.name) === norm(s.name));
      if(!ex){
        subjectsList.push({ id: 'msub_' + (stamp++), name: s.name, code: '', className: y, sections: [c.name], sectionStaff: {}, staffIds: [], countable: true, elective: !!s.optional });
      } else {
        ex.sections = Array.isArray(ex.sections) ? ex.sections : [];
        if(!ex.sections.some(z => norm(z) === norm(c.name))) ex.sections.push(c.name);
        if(s.optional) ex.elective = true;
      }
    });
    try {
      await storageSet('class-levels', CLASS_LEVELS);
      await storageSet('section-levels', SECTIONS);
      await storageSet('class-section-overrides', classSectionOverrides);
      await storageSet(SUBJECTS_KEY, subjectsList);
      await persist();
    } catch(e){
      showToast('Could not save everything. Please try again.');
      return;
    }
    showToast('Done. 1st Year and 2nd Year are ready with your combinations and subjects.', 'burst');
    try { renderClassesTab(document.getElementById('classesSetupBody')); } catch(e){ paint(); }
  };

  /* Show the card on the Classes page. */
  const orig = window.renderClassesTab;
  if(typeof orig === 'function' && !orig.__clg){
    const w = function(body){
      const r = orig.apply(this, arguments);
      try { ensureHost(body); } catch(e){}
      return r;
    };
    w.__clg = true;
    window.renderClassesTab = w;
  }
  window.clgData = () => data;
})();
