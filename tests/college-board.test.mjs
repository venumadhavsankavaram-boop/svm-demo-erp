// Junior College: board hall-ticket tracker and released results.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules', '90-college-board-exams.js'), 'utf8');
function boot(role = 'Admin') {
  const store = {}, toasts = [], cards = [];
  const win = { clgRegisterCard: f => cards.push(f), clgRepaint: () => {}, clgData: () => ({ combos: [{ name: 'MPC' }, { name: 'BiPC' }] }) };
  const mk = (id, adm, sec, cls = '1st Year') => ({ id, firstName: id, lastName: 'S', admissionNo: adm, className: cls, section: sec });
  const students = [mk('a', 'A001', 'MPC'), mk('b', 'A002', 'MPC'), mk('c', 'A003', 'MPC'), mk('d', 'B001', 'BiPC'), mk('e', 'A009', 'MPC', '2nd Year')];
  const ctx = vm.createContext({ window: win, console, OBJECT_BACKED_KEYS: {}, currentUser: { role },
    storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d), storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m), scxActiveStudents: () => students, scxCard: (t, h, i) => '<section>' + i + '</section>',
    document: { getElementById: id => (id === 'cbxPaste' ? { value: ctx.__paste } : null) }, __paste: '' });
  vm.runInContext(src, ctx);
  return { ctx, win, store, toasts, cards };
}
const settle = () => new Promise(r => setTimeout(r, 20));
(async () => {
  const t = boot(); t.cards[0](); await settle();
  await t.win.cbxHt('a', ' 26-11 2345 67 ');
  test('hall ticket numbers are cleaned (letters and digits, capitals)', () => { assert.equal(t.store['college-board'].students.a.ht, '2611234567'); });
  await t.win.cbxTicket('a', 'Handed over');
  test('hall ticket status is saved', () => { assert.equal(t.store['college-board'].students.a.ticket, 'Handed over'); });
  await t.win.cbxTicket('a', 'Whatever');
  test('an unknown status is ignored', () => { assert.equal(t.store['college-board'].students.a.ticket, 'Handed over'); });
  await t.win.cbxHt('b', '2611234567');
  test('the same hall ticket on two students is flagged', () => { assert.ok(t.cards[0]().includes('Same number on another student')); });

  t.win.cbxTab('results'); t.win.cbxSel('session', 'March 2027');
  t.ctx.__paste = 'A001, 812, 1000, Pass\nA002\t300\t1000\tFail\nZZ99, 1, 2, Pass\nA003, 5, 6, Maybe';
  await t.win.cbxImport();
  const st = t.store['college-board'].students;
  test('pasted results are matched by admission number', () => {
    assert.equal(st.a.res['1st Year'].total, 812); assert.equal(st.a.res['1st Year'].result, 'Pass');
    assert.equal(st.b.res['1st Year'].result, 'Fail'); assert.equal(st.a.res['1st Year'].session, 'March 2027');
  });
  test('unknown admission numbers and bad results are skipped, and reported', () => {
    assert.equal(st.c, undefined); assert.ok(t.toasts.at(-1).includes('2 students updated') && t.toasts.at(-1).includes('3, 4'));
  });
  const html = t.cards[0]();
  test('pass percentage counts only released results (1 of 2 = 50%)', () => { assert.ok(html.includes('50%')); });
  test('the 2nd Year student is not in 1st Year results', () => { assert.equal(st.e, undefined); });
  await t.win.cbxRes('c', 'total', '2000'); await t.win.cbxRes('c', 'outOf', '1000');
  test('a total above "out of" warns', () => { assert.ok(t.toasts.some(m => /more than/.test(m))); });
  const g = boot('Teacher'); g.cards[0](); await settle(); await g.win.cbxHt('a', '123456');
  test('a Teacher login cannot change board records', () => { assert.equal(g.store['college-board'], undefined); });
  done('college-board');
})();
