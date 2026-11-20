// Junior College: absent several days in a row.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules', '92-college-absence.js'), 'utf8');
const calls = [];
function boot(role = 'Admin') {
  const store = {}, toasts = [], cards = [];
  const win = { clgRegisterCard: f => cards.push(f), clgRepaint: () => {} };
  const mk = (id, cls = '1st Year') => ({ id, firstName: id, lastName: 'S', admissionNo: id, className: cls, section: 'MPC', fatherPhone: '9000000000' });
  const students = [mk('a'), mk('b'), mk('c'), mk('d'), mk('e', '2nd Year')];
  const ctx = vm.createContext({ window: win, console, OBJECT_BACKED_KEYS: {}, currentUser: { role },
    storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d), storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m), showConfirmDialog: async () => true, scxActiveStudents: () => students, scxCard: (t, h, i) => '<section>' + i + '</section>',
    attendanceRecords: [], fetch: async (u, o) => { calls.push({ u, body: JSON.parse(o.body) }); return { ok: true, json: async () => ({ sent: o.__sent ?? 1, skipped: 0 }) }; } });
  vm.runInContext(src, ctx);
  return { ctx, win, store, toasts, cards, students };
}
const R = (studentId, date, status = 'Absent', session = 'Morning') => ({ id: studentId + date + session, studentId, date, status, session });
(async () => {
  const t = boot(); const S = t.students;
  // attendance days: 06,07,08,09 (Mon-Thu) and 12 (Mon). 10-11 not taken (weekend).
  const days = ['2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-12'];
  const recs = [];
  days.forEach(d => { recs.push(R('d', d, 'Present')); });                       // d always present, keeps all days "taken"
  ['2027-01-08', '2027-01-09', '2027-01-12'].forEach(d => recs.push(R('a', d)));   // a: absent last 3 attendance days (weekend skipped)
  days.slice(0, 2).forEach(d => recs.push(R('a', d, 'Present')));
  days.forEach(d => recs.push(R('b', d)));                                         // b: absent all 5
  recs.push(R('c', '2027-01-09')); recs.push(R('c', '2027-01-12')); recs.push(R('c', '2027-01-12', 'Present', 'Afternoon')); // c: present in the afternoon of the last day
  const out = t.win.clabStreaks(recs, S, 3);
  const byId = Object.fromEntries(out.map(x => [x.student.id, x]));
  test('a student absent 3 attendance days in a row (weekend skipped) is listed', () => { assert.equal(byId.a.days, 3); assert.equal(byId.a.lastDate, '2027-01-12'); });
  test('a longer streak is counted fully and sorted first', () => { assert.equal(byId.b.days, 5); assert.equal(out[0].student.id, 'b'); });
  test('a Present mark on the latest day clears the streak', () => { assert.equal(byId.c, undefined); });
  test('a student who is always present is not listed', () => { assert.equal(byId.d, undefined); });
  test('a student with no marks is not listed', () => { assert.equal(byId.e, undefined); });
  test('a higher threshold removes shorter streaks', () => { assert.deepEqual(Array.from(t.win.clabStreaks(recs, S, 4).map(x => x.student.id)), ['b']); });
  test('a day with no mark for the student ends the streak', () => {
    const r2 = [R('d', '2027-01-07', 'Present'), R('d', '2027-01-08', 'Present'), R('a', '2027-01-08')];
    assert.equal(t.win.clabStreaks(r2, S, 1).find(x => x.student.id === 'a').days, 1);
  });

  t.ctx.attendanceRecords = recs; await new Promise(r => setTimeout(r, 20)); t.cards[0](); await new Promise(r => setTimeout(r, 20));
  const html = t.cards[0]();
  test('the card lists the students and the parent phone', () => { assert.ok(html.includes('Tell all 2 parents') && html.includes('9000000000')); });
  await t.win.clabTellAll();
  test('"Tell all" sends one notice per listed student to the server', () => {
    assert.equal(calls.length, 1); assert.equal(calls[0].u, '/api/college/absence-notice');
    assert.deepEqual(calls[0].body.notices.map(n => [n.studentId, n.days, n.lastDate]), [['b', 5, '2027-01-12'], ['a', 3, '2027-01-12']]);
  });
  await t.win.clabDays('1'); await t.win.clabDays('99');
  test('the day count is kept between 2 and 30', () => { assert.equal(t.store['college-absence'].days, 3); });
  await t.win.clabDays('5');
  test('the college can change the day count', () => { assert.equal(t.store['college-absence'].days, 5); });
  const g = boot('Teacher'); g.cards[0](); await new Promise(r => setTimeout(r, 20)); await g.win.clabDays('4');
  test('a Teacher cannot change it', () => { assert.equal(g.store['college-absence'], undefined); });
  done('college-absence');
})();
