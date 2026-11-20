// Junior College: the numbers on the "College at a glance" panel.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules', '95-college-dashboard.js'), 'utf8');
const win = {};
const ctx = vm.createContext({ window: win, console, document: { getElementById: () => null }, renderDashboard: async () => {} });
vm.runInContext(src, ctx);
const st = (id, cls, sec) => ({ id, className: cls, section: sec });
const students = [st('a', '1st Year', 'MPC'), st('b', '1st Year', 'MPC'), st('c', '1st Year', 'BiPC'), st('d', '2nd Year', 'MPC'), st('e', '2nd Year', 'MPC'), st('f', '2nd Year', 'BiPC'), st('x', '10th Class', 'A')];
const combos = [{ name: 'MPC', stream: 'Science', seats: [2, 40] }, { name: 'BiPC', stream: 'Science', seats: [40, 40] }];
const board = { students: {
  d: { ticket: 'Handed over', res: { '1st Year': { result: 'Pass' } } },
  e: { ticket: 'Pending', res: { '1st Year': { result: 'Fail' } } },
  f: { ticket: 'Downloaded', res: { '1st Year': { result: 'Pass' } } } } };
const schol = { records: [{ claimed: 10000, received: 4000, status: 'Approved' }, { claimed: 5000, received: 0, status: 'Rejected' }, { claimed: 8000, received: 8000, status: 'Received' }] };
const sm = win.cldSummarize({ students, combos, board, schol, absentDays: 3, streaks: [{}, {}] });
test('school classes are not counted as college students', () => { assert.equal(sm.total, 6); assert.equal(sm.y1, 3); assert.equal(sm.y2, 3); });
test('each combination shows students per year with its seats', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(sm.perCombo[0])), { name: 'MPC', stream: 'Science', y1: 2, y2: 2, s1: 2, s2: 40 });
  assert.equal(sm.perCombo[1].y1, 1);
});
test('hall tickets: only "Handed over" counts as done', () => { assert.equal(sm.ticketsPending, 2); });
test('1st Year board pass rate is from released results only', () => { assert.equal(sm.passPct, 67); assert.equal(sm.passOf, 3); });
test('scholarship money still to come ignores rejected claims', () => { assert.equal(sm.scholPending, 6000); });
test('absent count comes from the streak list', () => { assert.equal(sm.absent, 2); });
const none = win.cldSummarize({ students: [], combos: [], board: null, schol: null, absentDays: 3, streaks: null });
test('an empty college shows zeros and no pass rate', () => { assert.equal(none.total, 0); assert.equal(none.passPct, null); assert.equal(none.scholPending, 0); assert.equal(none.absent, 0); });
done('college-dashboard');
