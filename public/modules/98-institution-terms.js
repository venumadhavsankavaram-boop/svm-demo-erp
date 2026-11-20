/* Copyright (c) 2026 SVM EdTech. All rights reserved. Proprietary and confidential.
   Unauthorised copying, modification or distribution of this file is prohibited. See LICENSE. */
/* ============================================================================
   Institution wording (College Pack).
   One list of words per institution type, applied to what is on screen:
     School          Teachers      (nothing is changed)
     Junior College  Lecturers
     Degree College  Faculty       (Professor is a rank, so "Faculty" is the umbrella word)
   The ERP code and the saved data keep using the role name "Teacher" internally; only the
   words people read change. School installs are never touched. Names typed by the school
   (staff names, the school's own name) are left alone, because only fixed UI phrases match.
   ========================================================================== */
(function(){
  'use strict';
  const sameCase = (m, to) => m === m.toUpperCase() && m.length > 1 ? to.toUpperCase() : (m[0] === m[0].toLowerCase() ? to[0].toLowerCase() + to.slice(1) : to);
  const word = (re, to) => ({ re, fn: m => sameCase(m, to) });
  const R = {
    junior_college: [
      word(/\bClass Teachers?\b/gi, 'Class In-charge'),
      word(/\bTeachers\b/gi, 'Lecturers'), word(/\bTeacher\b/gi, 'Lecturer'),
    ],
    degree_college: [
      word(/\bClass Teachers?\b/gi, 'Class Mentor'),
      { re: /\b(a|an) teacher\b/gi, fn: m => m[0] === 'A' ? 'A faculty member' : 'a faculty member' },
      word(/\bTeachers\b/gi, 'Faculty'), word(/\bTeacher\b/gi, 'Faculty'),
      word(/\bHomework\b/gi, 'Assignments'),
    ],
  };
  /* "school" becomes "college" only in fixed phrases, never inside a name such as "Sunrise Public School". */
  const COLLEGE_PHRASES = [
    { re: /\bSchool (Setup|Profile|Name|Logo|Address|Details|Calendar|Info|Information|Code|Timings|Hours|Holidays|Year|Settings)\b/g, fn: (m, a) => 'College ' + a },
    { re: /\b(the|your|this|our|whole|entire|every|each) school\b/gi, fn: (m, a) => a + ' college' },
  ];
  const TYPES = ['school', 'junior_college', 'degree_college'];

  /* Pure: the text as it should read for this institution type. */
  function convert(text, type){
    if(typeof text !== 'string' || !text || !R[type]) return text;
    let t = text;
    R[type].forEach(r => { t = t.replace(r.re, r.fn); });
    COLLEGE_PHRASES.forEach(r => { t = t.replace(r.re, r.fn); });
    return t;
  }
  /* The words themselves, for the pages and tooltips that need them. */
  const NAMES = {
    school:         { staff: 'Teachers',  staffOne: 'Teacher',  head: 'Principal', institution: 'School' },
    junior_college: { staff: 'Lecturers', staffOne: 'Lecturer', head: 'Principal', institution: 'Junior College' },
    degree_college: { staff: 'Faculty',   staffOne: 'Faculty member', head: 'Principal', institution: 'Degree College' },
  };
  window.instTerms = { convert, NAMES, TYPES };
  window.instNames = type => NAMES[type] || NAMES.school;

  /* ---- the live page ---- */
  if(typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  let type = 'school', fetched = null;
  const origText = new WeakMap(), lastText = new WeakMap(), origAttr = new WeakMap();
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT']);
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function skipped(el){ for(let e = el; e && e.nodeType === 1; e = e.parentNode){ if(SKIP.has(e.tagName) || e.isContentEditable || e.hasAttribute('data-no-terms')) return true; } return false; }
  function sweepText(root){
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; const batch = [];
    while((n = w.nextNode())) batch.push(n);
    batch.forEach(n => {
      const par = n.parentNode; if(!par || skipped(par)) return;
      const cur = n.nodeValue;
      const orig = (lastText.has(n) && lastText.get(n) === cur) ? origText.get(n) : cur;
      const next = convert(orig, type);
      if(next !== cur){ origText.set(n, orig); lastText.set(n, next); n.nodeValue = next; }
      else if(lastText.has(n) && orig === cur){ origText.set(n, cur); lastText.set(n, cur); }
    });
  }
  function sweepAttrs(root){
    const els = root.nodeType === 1 ? [root].concat(Array.from(root.querySelectorAll('[placeholder],[title],[aria-label]'))) : Array.from(root.querySelectorAll('[placeholder],[title],[aria-label]'));
    els.forEach(el => { if(skipped(el)) return; ATTRS.forEach(a => {
      if(!el.hasAttribute(a)) return;
      const rec = origAttr.get(el) || {}; const cur = el.getAttribute(a);
      const orig = (rec[a] && rec[a].last === cur) ? rec[a].orig : cur;
      const next = convert(orig, type);
      if(next !== cur){ rec[a] = { orig, last: next }; origAttr.set(el, rec); el.setAttribute(a, next); }
    }); });
  }
  let timer = null, busy = false;
  function sweepAll(){ if(busy) return; busy = true; try { const b = document.body; if(b){ sweepText(b); sweepAttrs(b); } if(document.title) document.title = convert(document.title, type); } catch(e){} busy = false; }
  function schedule(){ if(timer) return; timer = setTimeout(() => { timer = null; sweepAll(); }, 60); }
  function setType(t){
    if(TYPES.indexOf(t) < 0) t = 'school';
    if(t === type) return;
    type = t; document.documentElement.setAttribute('data-terms', t);
    sweepAll();
  }
  window.instSetType = setType;
  window.instCurrentType = () => type;
  function detect(){
    /* Once the college settings have loaded they decide (so switching back to School works); until then, the server's answer. */
    let t = fetched || 'school';
    try { if(typeof window.clgLoaded === 'function' && window.clgLoaded()) t = (window.clgIsDegreeCollege() ? 'degree_college' : window.clgIsJuniorCollege() ? 'junior_college' : 'school'); } catch(e){}
    setType(t);
  }
  function start(){
    try { fetch('/api/demo-info', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if(j && j.collegePack && TYPES.indexOf(j.institutionType) >= 0){ fetched = j.institutionType; detect(); } }).catch(() => {}); } catch(e){}
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    setInterval(detect, 1500);
    sweepAll();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
