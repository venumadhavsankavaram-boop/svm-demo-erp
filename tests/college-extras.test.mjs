// Junior College practical batches and scholarship tracking.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

function boot(role = 'Admin') {
  const store = {}, toasts = [], cards = [];
  const win = { clgRegisterCard: f => cards.push(f), clgRepaint: () => {}, clgData: () => ({ combos: [{ name: 'MPC' }, { name: 'BiPC' }] }) };
  const students = [];
  for (let i = 1; i <= 45; i++) students.push({ id: 's' + i, firstName: 'Stu' + i, lastName: 'X', admissionNo: 'A' + String(i).padStart(3, '0'), className: '1st Year', section: 'MPC' });
  students.push({ id: 'b1', firstName: 'Bi', lastName: 'Pc', admissionNo: 'B001', className: '1st Year', section: 'BiPC' });
  const ctx = vm.createContext({
    window: win, console, OBJECT_BACKED_KEYS: {}, currentUser: { role },
    storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m), showConfirmDialog: async () => true,
    scxActiveStudents: () => students, schoolInfo: { name: 'Test College' },
    subjectsList: [
      { className: '1st Year', name: 'Physics Practical', sections: ['MPC', 'BiPC'] },
      { className: '1st Year', name: 'Botany Practical', sections: ['BiPC'] },
      { className: '1st Year', name: 'English', sections: ['MPC'] },
    ],
    scxCard: (t, h, inner) => '<section>' + t + inner + '</section>',
    document: { getElementById: () => null, createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    URL: { createObjectURL: () => 'blob:x' }, Blob: class {},
  });
  return { ctx, win, store, toasts, cards };
}
const run = (c, code) => vm.runInContext(code, c);
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  // ---- practicals
  const p = boot();
  vm.runInContext(read('88-college-practicals.js'), p.ctx);
  p.cards[0](); await settle();
  const html = p.cards[0]();
  test('only practical subjects of that combination are offered', () => {
    assert.ok(html.includes('Physics Practical'));
    assert.ok(!html.includes('Botany Practical'));
    assert.ok(!html.includes('<option selected>English'));
  });
  p.win.clpSel('size', 20);
  await p.win.clpMake();
  const b = p.store['college-practicals'].batches;
  test('45 students at 20 per batch make 3 batches (20, 20, 5)', () => {
    assert.deepEqual(b.map(x => x.studentIds.length), [20, 20, 5]);
  });
  test('students are split in admission-number order and never repeated', () => {
    assert.equal(b[0].studentIds[0], 's1'); assert.equal(b[2].studentIds.at(-1), 's45');
    assert.equal(new Set(b.flatMap(x => x.studentIds)).size, 45);
  });
  test('the BiPC student is not in an MPC batch', () => { assert.ok(!b.some(x => x.studentIds.includes('b1'))); });
  await p.win.clpSet(b[0].id, 'date', '2027-02-10'); await p.win.clpSet(b[0].id, 'centre', 'Govt Junior College');
  await p.win.clpSet(b[0].id, 'date', 'not-a-date');
  test('date and exam centre save; a bad date is dropped', () => {
    assert.equal(p.store['college-practicals'].batches[0].centre, 'Govt Junior College');
    assert.equal(p.store['college-practicals'].batches[0].date, '');
  });
  await p.win.clpMake();
  test('making batches again replaces them, not doubles them', () => { assert.equal(p.store['college-practicals'].batches.length, 3); });
  const t = boot('Teacher'); vm.runInContext(read('88-college-practicals.js'), t.ctx); t.cards[0](); await settle();
  t.win.clpSel('size', 20); await t.win.clpMake();
  test('a Teacher cannot make batches', () => { assert.equal(t.store['college-practicals'], undefined); });

  // ---- scholarships
  const s = boot('Accountant');
  vm.runInContext(read('89-college-scholarships.js'), s.ctx);
  s.cards[0](); await settle();
  s.ctx.document.getElementById = id => ({ clsStudent: { value: 's1' }, clsScheme: { value: 'Fee reimbursement (government)' }, clsClaimed: { value: '12000' } }[id] || null);
  await s.win.clsAdd();
  const r = () => s.store['college-scholarships'].records;
  test('a scholarship line is added as Applied when an amount is claimed', () => {
    assert.equal(r().length, 1); assert.equal(r()[0].status, 'Applied'); assert.equal(r()[0].claimed, 12000);
  });
  await s.win.clsAdd();
  test('the same student and scheme cannot be added twice', () => { assert.equal(r().length, 1); });
  await s.win.clsSet(r()[0].id, 'received', '5000');
  test('pending is claimed minus received while Applied/Approved', () => {
    const out = s.cards[0]();
    assert.ok(out.includes('7,000'));
  });
  await s.win.clsSet(r()[0].id, 'status', 'Received');
  test('marking Received fills the rest of the amount', () => { assert.equal(r()[0].received, 12000); });
  await s.win.clsSet(r()[0].id, 'claimed', '-5');
  test('negative amounts become zero', () => { assert.equal(r()[0].claimed, 0); });
  await s.win.clsDel(r()[0].id);
  test('a line can be deleted', () => { assert.equal(r().length, 0); });
  const tt = boot('Teacher'); vm.runInContext(read('89-college-scholarships.js'), tt.ctx); tt.cards[0](); await settle();
  tt.ctx.document.getElementById = id => ({ clsStudent: { value: 's1' }, clsScheme: { value: 'X' }, clsClaimed: { value: '1' } }[id] || null);
  await tt.win.clsAdd();
  test('a Teacher cannot add scholarships', () => { assert.equal(tt.store['college-scholarships'], undefined); });
  done('college-extras');
})();
