// Junior College: college exam types, and FA / SA offered to school classes only.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules', '93-college-exams.js'), 'utf8');
function boot({ role = 'Admin', jc = true, types } = {}) {
  const store = {}, toasts = [], cards = [];
  const win = { clgRegisterCard: f => cards.push(f), clgRepaint: () => {}, clgIsJuniorCollege: () => jc };
  const ctx = vm.createContext({ window: win, console, currentUser: { role },
    CLASS_LEVELS: ['LKG', '10th Class', '1st Year', '2nd Year'],
    examTypes: types || [
      { id: 'e1', name: 'Formative Assessment', group: 'formative', scopeClasses: [] },
      { id: 'e2', name: 'Summative Assessment 1', group: 'summative', scopeClasses: [] },
      { id: 'e3', name: 'Prefinals', group: 'internal', scopeClasses: ['10th Class'] },
      { id: 'e4', name: 'FA - PRIMARY', group: 'formative', scopeClasses: ['LKG'] },
      { id: 'e5', name: 'FA - MIXED', group: 'formative', scopeClasses: ['10th Class', '1st Year'] }],
    storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m), scxCard: (t, h, i) => '<section>' + i + '</section>',
    quickSetupExamTypes: async function(){ ctx.examTypes.push({ id: 'q1', name: 'Summative Assessment 2 (Annual)', group: 'summative', scopeClasses: [] }); } });
  vm.runInContext(src, ctx);
  return { ctx, win, store, toasts, cards };
}
const types = t => Array.from(vm.runInContext('examTypes', t.ctx));
(async () => {
  const t = boot();
  await t.win.clexApply();
  const ty = types(t), by = n => ty.find(x => x.name === n);
  test('FA and SA are limited to the school classes', () => {
    assert.deepEqual(Array.from(by('Formative Assessment').scopeClasses), ['LKG', '10th Class']);
    assert.deepEqual(Array.from(by('Summative Assessment 1').scopeClasses), ['LKG', '10th Class']);
  });
  test('an FA type already limited to some school classes keeps exactly those', () => { assert.deepEqual(Array.from(by('FA - PRIMARY').scopeClasses), ['LKG']); });
  test('a college year is removed from an FA type that included it', () => { assert.deepEqual(Array.from(by('FA - MIXED').scopeClasses), ['10th Class']); });
  test('other school types such as Prefinals are left alone', () => { assert.deepEqual(Array.from(by('Prefinals').scopeClasses), ['10th Class']); });
  test('the eight college exam types are added for 1st and 2nd Year', () => {
    ['Unit Test', 'Weekly Test', 'Grand Test (Mock)', 'Quarterly Exam', 'Half-Yearly Exam', 'Annual Exam', 'Pre-final Exam', 'Practical (Internal)'].forEach(n => assert.ok(by(n), n));
    assert.deepEqual(Array.from(by('Unit Test').scopeClasses), ['1st Year', '2nd Year']);
  });
  test('Annual is for 1st Year only and Pre-final for 2nd Year only', () => {
    assert.deepEqual(Array.from(by('Annual Exam').scopeClasses), ['1st Year']);
    assert.deepEqual(Array.from(by('Pre-final Exam').scopeClasses), ['2nd Year']);
  });
  test('saved to storage', () => { assert.equal(t.store['exam-types'].length, ty.length); });
  const before = JSON.stringify(types(t));
  await t.win.clexApply();
  test('pressing it again changes nothing', () => { assert.equal(JSON.stringify(types(t)), before); });
  test('the card says Done afterwards', () => { assert.ok(/Done/.test(t.cards[0]())); });

  const quick = boot(); await quick.win.quickSetupExamTypes();
  test('the school Quick setup does not offer FA / SA to the college years', () => {
    assert.deepEqual(Array.from(types(quick).find(x => x.id === 'q1').scopeClasses), ['LKG', '10th Class']);
  });
  const sch = boot({ jc: false });
  test('a school install shows no card and the pack never touches it', () => { assert.equal(sch.cards[0](), ''); });
  const tch = boot({ role: 'Teacher' }); await tch.win.clexApply();
  test('a Teacher login cannot change exam types', () => { assert.equal(tch.store['exam-types'], undefined); });
  done('college-exams');
})();
