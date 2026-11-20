// Junior College: programmes, test ranks and the seat-full warning.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const mk = (id, adm, sec, cls = '1st Year') => ({ id, firstName: id, lastName: 'S', admissionNo: adm, className: cls, section: sec });

function boot(role = 'Admin') {
  const store = {}, toasts = [], cards = [], confirms = [];
  const win = { clgRegisterCard: f => cards.push(f), clgRepaint: () => {}, clgData: () => ({ combos: [{ name: 'MPC' }, { name: 'BiPC' }] }) };
  const students = [mk('a', 'A1', 'MPC'), mk('b', 'A2', 'MPC'), mk('c', 'A3', 'BiPC'), mk('d', 'A4', 'BiPC'), mk('e', 'A5', 'MPC'), mk('f', 'A6', 'MPC', '2nd Year')];
  const ctx = vm.createContext({ window: win, console, OBJECT_BACKED_KEYS: {}, currentUser: { role },
    storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d), storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m), showConfirmDialog: async m => { confirms.push(m); return true; },
    scxActiveStudents: () => students, scxCard: (t, h, i) => '<section>' + t + i + '</section>',
    examDefs: [{ id: 'x1', name: 'Weekly Test 1' }],
    getExamSubjects: () => [{ name: 'Physics', maxMarks: 50, countable: true }, { name: 'Maths', maxMarks: 50, countable: true }, { name: 'Moral', maxMarks: 10, countable: false }],
    examResults: [], document: { getElementById: id => ctx.__els[id] || null }, __els: {} });
  const put = (sid, p, m) => ctx.examResults.push({ examId: 'x1', studentId: sid, subject: 'Physics', marks: p }, { examId: 'x1', studentId: sid, subject: 'Maths', marks: m });
  put('a', 40, 45); put('b', 40, 45); put('c', 30, 30); put('d', 50, 50); // e has nothing
  vm.runInContext(read('91-college-programmes.js'), ctx);
  return { ctx, win, store, toasts, cards, confirms, students };
}
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  const t = boot(); t.cards[0](); await settle();
  const rows = t.win.clpRankList(t.ctx.examDefs[0], t.students.filter(s => s.className === '1st Year'));
  test('students with no marks are left out (4 of 5 ranked)', () => { assert.equal(rows.length, 4); });
  test('highest percentage is rank 1', () => { assert.equal(rows[0].s.id, 'd'); assert.equal(rows[0].rank, 1); });
  test('tied students share a rank and the next rank skips (1,2,2,4)', () => { assert.deepEqual(Array.from(rows.map(r => r.rank)), [1, 2, 2, 4]); });
  test('uncountable subjects do not add to the total (max is 100, not 110)', () => { assert.equal(rows[0].max, 100); });
  test('ranks run across combinations, not just inside one', () => { assert.equal(new Set(rows.map(r => r.s.section)).size, 2); });

  await t.win.cpgSet('a', 'IIT-JEE');
  test('a student can be tagged with a programme', () => { assert.equal(t.store['college-programmes'].by.a, 'IIT-JEE'); });
  await t.win.cpgSet('a', 'Not a programme');
  test('an unknown programme is ignored', () => { assert.equal(t.store['college-programmes'].by.a, 'IIT-JEE'); });
  t.ctx.__els.cpgNew = { value: 'Olympiad' }; await t.win.cpgAdd();
  test('a new programme can be added', () => { assert.ok(t.store['college-programmes'].list.includes('Olympiad')); });
  t.ctx.__els.cpgNew = { value: 'olympiad' }; await t.win.cpgAdd();
  test('the same programme cannot be added twice', () => { assert.equal(t.store['college-programmes'].list.filter(x => /olympiad/i.test(x)).length, 1); });
  await t.win.cpgDrop('IIT-JEE');
  test('a programme that students use cannot be removed', () => { assert.ok(t.store['college-programmes'].list.includes('IIT-JEE')); });
  await t.win.cpgDrop('Regular');
  test('the default programme cannot be removed', () => { assert.ok(t.store['college-programmes'].list.includes('Regular')); });
  t.win.cpgSel('year', '1st Year'); t.win.cpgSel('combo', 'MPC'); t.ctx.__els.cpgAll = { value: 'NEET' }; await t.win.cpgAll();
  test('"set everyone" tags the whole combination in that year only', () => {
    const by = t.store['college-programmes'].by; assert.equal(by.a, 'NEET'); assert.equal(by.b, 'NEET'); assert.equal(by.e, 'NEET'); assert.equal(by.f, undefined);
  });
  t.win.cpgSel('scope', 'prog'); t.win.cpgSel('scopeVal', 'NEET');
  test('the rank card for a programme lists only that programme', () => { const h = t.cards[0](); assert.ok(h.includes('Test ranks') && h.includes('2 students ranked')); });
  const g = boot('Teacher'); g.cards[0](); await settle(); await g.win.cpgSet('a', 'NEET');
  test('a Teacher cannot tag programmes', () => { assert.equal(g.store['college-programmes'], undefined); });

  // seat-full check (module 87)
  function boot87(seats, used) {
    const store = { 'college-structure': { institutionType: 'junior_college', combos: [{ id: 'c', stream: 'Science', name: 'MPC', seats: [seats, 60], subjects: [] }] } };
    const confirms = []; let answer = true;
    const studs = Array.from({ length: used }, (_, i) => mk('u' + i, 'U' + i, 'MPC'));
    const win = {};
    const ctx = vm.createContext({ window: win, console, OBJECT_BACKED_KEYS: {}, currentUser: { role: 'Admin' },
      CLASS_LEVELS: [], SECTIONS: [], classSectionOverrides: {}, subjectsList: [],
      storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d), storageSet: async () => {},
      showToast() {}, showConfirmDialog: async m => { confirms.push(m); return answer; }, scxActiveStudents: () => studs,
      renderClassesTab() {}, document: { getElementById: () => null }, fetch: async () => ({ ok: true, json: async () => ({}) }) });
    win.renderClassesTab = ctx.renderClassesTab; vm.runInContext(read('87-college-structure.js'), ctx);
    return { win, confirms, set: v => { answer = v; } };
  }
  const s1 = boot87(2, 1);
  const r1 = await s1.win.clgSeatCheck(mk('n', 'N1', 'MPC'));
  test('a seat is free: admission goes ahead without a question', () => { assert.equal(r1, true); assert.equal(s1.confirms.length, 0); });
  const s2 = boot87(2, 2);
  const r2 = await s2.win.clgSeatCheck(mk('n', 'N1', 'MPC'));
  test('seats full: the office is asked, and can admit anyway', () => { assert.equal(r2, true); assert.equal(s2.confirms.length, 1); assert.ok(/full/.test(s2.confirms[0])); });
  s2.set(false);
  const r3 = await s2.win.clgSeatCheck(mk('n2', 'N2', 'MPC'));
  test('seats full and the office says no: admission is stopped', () => { assert.equal(r3, false); });
  const s3 = boot87(2, 5);
  const r4 = await s3.win.clgSeatCheck(mk('n', 'N1', 'A', '9th Class'));
  test('a school class is never checked', () => { assert.equal(r4, true); assert.equal(s3.confirms.length, 0); });
  const s4 = boot87(0, 50);
  const r5 = await s4.win.clgSeatCheck(mk('n', 'N1', 'MPC'));
  test('a combination with no seat number is never blocked', () => { assert.equal(r5, true); assert.equal(s4.confirms.length, 0); });
  await new Promise(r => setTimeout(r, 50));
  done('college-programmes');
})();
