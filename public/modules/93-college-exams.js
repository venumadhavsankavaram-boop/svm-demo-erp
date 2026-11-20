/* =========================================================================
   Junior College: the exams a junior college actually holds, and keeping FA / SA for schools only.
   FA (Formative) and SA (Summative) are the school pattern. A junior college runs Unit Tests, Weekly Tests,
   Grand Tests, Quarterly, Half-Yearly, Annual (1st Year), Pre-final (2nd Year) and internal Practicals.
   The public Intermediate exams and the government practicals are not run here (see Board exams).
   One button adds the college exam types, offered to 1st Year and 2nd Year only, and limits any FA / SA
   types to the school classes. It only adds or limits; it never deletes an exam or a result. Safe to repeat.
   ========================================================================= */
(function(){
  'use strict';
  const YEARS = ['1st Year', '2nd Year'];
  /* name, kind, offered to */
  const COLLEGE_TYPES = [
    ['Unit Test', 'formative', YEARS],
    ['Weekly Test', 'formative', YEARS],
    ['Grand Test (Mock)', 'internal', YEARS],
    ['Quarterly Exam', 'summative', YEARS],
    ['Half-Yearly Exam', 'summative', YEARS],
    ['Annual Exam', 'summative', ['1st Year']],
    ['Pre-final Exam', 'internal', ['2nd Year']],
    ['Practical (Internal)', 'internal', YEARS],
  ];
  const canEdit = () => { try { return !!currentUser && ['Admin', 'Principal'].includes(currentUser.role); } catch(e){ return false; } };
  const isJC = () => { try { return typeof window.clgIsJuniorCollege === 'function' && window.clgIsJuniorCollege(); } catch(e){ return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const schoolClasses = () => { try { return CLASS_LEVELS.filter(c => !YEARS.includes(c)); } catch(e){ return []; } };
  const isFaSa = t => t && typeof t === 'object' && (t.group === 'formative' || t.group === 'summative') && /formative|summative|\bFA\b|\bSA\b/i.test(t.name || '') && !COLLEGE_TYPES.some(x => x[0] === t.name);
  /* Open to every class (no list), or the list includes a college year. A list of school classes only is already right. */
  const needsLimit = t => { const sc = t.scopeClasses || []; return !sc.length || sc.some(c => YEARS.includes(c)); };
  const limitedScope = (t, schoolCls) => { const keep = (t.scopeClasses || []).filter(c => !YEARS.includes(c)); return keep.length ? keep : schoolCls.slice(); };
  const list = () => { try { return Array.isArray(examTypes) ? examTypes : []; } catch(e){ return []; } };

  /* Pure: work out what the button would change on a list of exam types. */
  function plan(types, schoolCls){
    const out = { limit: [], add: [] };
    types.forEach(t => { if(isFaSa(t) && schoolCls.length && needsLimit(t)) out.limit.push(t); });
    COLLEGE_TYPES.forEach(([n]) => { if(!types.some(t => t && typeof t === 'object' && (t.name || '').toLowerCase() === n.toLowerCase())) out.add.push(n); });
    return out;
  }
  window.clexPlan = (types, schoolCls) => plan(types, schoolCls);

  async function apply(silent){
    const types = list(), sc = schoolClasses(), p = plan(types, sc);
    if(!p.limit.length && !p.add.length) return false;
    p.limit.forEach(t => { t.scopeClasses = limitedScope(t, sc); });
    p.add.forEach(n => {
      const d = COLLEGE_TYPES.find(x => x[0] === n);
      types.push({ id: 'etype_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name: n, group: d[1], scopeClasses: d[2].slice() });
    });
    try { examTypes = types; } catch(e){}
    await storageSet('exam-types', types);
    return { limited: p.limit.length, added: p.add.length };
  }

  function card(){
    if(!isJC()) return '';
    const p = plan(list(), schoolClasses());
    const done = !p.limit.length && !p.add.length;
    const chips = COLLEGE_TYPES.map(([n, , sc]) => `<span class="pill" title="Offered to ${esc(sc.join(' and '))}">${esc(n)}${p.add.includes(n) ? '' : ' &#10003;'}</span>`).join(' ');
    return scxCard('Exams for a junior college',
      'FA and SA are the school pattern. A junior college holds unit tests, weekly and grand tests, quarterly, half-yearly, annual (1st Year) and pre-final (2nd Year) exams, plus internal practicals. The government Intermediate public exams and practicals are not run here; use Board exams for those.',
      `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chips}</div>
       <p class="scx-note">${done ? 'Done. These exam types exist, and any FA / SA types are offered to the school classes only.' : (p.add.length ? 'Missing: ' + esc(p.add.join(', ')) + '. ' : '') + (p.limit.length ? 'FA / SA types still open to every class: ' + esc(p.limit.map(t => t.name).join(', ')) + '.' : '')}</p>
       ${canEdit() && !done ? '<button type="button" class="sf-btn sf-btn--primary" onclick="clexApply()">Set up junior college exams</button>' : ''}`);
  }
  window.clexApply = async () => {
    if(!canEdit()) return;
    const r = await apply();
    if(r) showToast('Added ' + r.added + ' exam type' + (r.added === 1 ? '' : 's') + (r.limited ? ' and limited ' + r.limited + ' FA / SA type' + (r.limited === 1 ? '' : 's') + ' to school classes' : '') + '.', 'burst');
    if(typeof window.clgRepaint === 'function') window.clgRepaint();
  };

  /* The school "Quick setup" button must not offer FA / SA to the college years. */
  const origQuick = (typeof quickSetupExamTypes === 'function') ? quickSetupExamTypes : null;
  if(origQuick){
    window.quickSetupExamTypes = async function(){
      const r = await origQuick.apply(this, arguments);
      if(isJC()){ try { const sc = schoolClasses(); list().forEach(t => { if(isFaSa(t) && sc.length && !(t.scopeClasses || []).length) t.scopeClasses = sc.slice(); }); await storageSet('exam-types', list()); } catch(e){} }
      return r;
    };
  }
  if(typeof window.clgRegisterCard === 'function') window.clgRegisterCard(card);
})();
