// Junior College structure: switch + combinations + "Create in the ERP" (adds only, safe to repeat).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules', '87-college-structure.js');
const src = fs.readFileSync(file, 'utf8');

function boot({ students = [], admin = true, pack = true } = {}) {
  const store = {};
  const toasts = [];
  const win = {};
  const ctx = vm.createContext({
    window: win, console,
    OBJECT_BACKED_KEYS: {},
    currentUser: { role: admin ? 'Admin' : 'Teacher' },
    CLASS_LEVELS: ['Baby Class', 'LKG', '10th Class'],
    SECTIONS: ['A', 'B'],
    classSectionOverrides: { '10th Class': ['A'] },
    subjectsList: [{ id: 'msub_1', name: 'English', code: '', className: '1st Year', sections: ['Old'], sectionStaff: {}, staffIds: [], countable: true, elective: false }],
    SUBJECTS_KEY: 'master-subjects',
    storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m),
    showConfirmDialog: async () => true,
    scxActiveStudents: () => students,
    renderClassesTab: () => {},
    document: { getElementById: () => null },
    fetch: async () => ({ ok: true, json: async () => ({ collegePack: pack }) }),
  });
  win.renderClassesTab = ctx.renderClassesTab;
  vm.runInContext(src, ctx);
  // the module reads/writes these through the shared global scope, like the real page
  return { ctx, win, store, toasts };
}
const run = (ctx, code) => vm.runInContext(code, ctx);

(async () => {
  const t1 = boot();
  await t1.win.clgSetType('junior_college');
  await t1.win.clgAddStandard();

  test('switching to Junior College is remembered', () => {
    assert.equal(t1.store['college-structure'].institutionType, 'junior_college');
  });
  test('standard combinations are MPC, BiPC, CEC, HEC', () => {
    assert.deepEqual(t1.store['college-structure'].combos.map(c => c.name), ['MPC', 'BiPC', 'CEC', 'HEC']);
  });

  await t1.win.clgApply();
  const cl = run(t1.ctx, 'CLASS_LEVELS'), sec = run(t1.ctx, 'SECTIONS'), ov = run(t1.ctx, 'classSectionOverrides'), subs = run(t1.ctx, 'subjectsList');

  test('1st Year and 2nd Year are added; school classes stay', () => {
    assert.ok(cl.includes('1st Year') && cl.includes('2nd Year'));
    ['Baby Class', 'LKG', '10th Class'].forEach(c => assert.ok(cl.includes(c)));
  });
  test('each combination becomes a section; existing sections stay', () => {
    ['A', 'B', 'MPC', 'BiPC', 'CEC', 'HEC'].forEach(s => assert.ok(sec.includes(s), s));
  });
  test('the two years use exactly the combinations; the school class override is untouched', () => {
    assert.deepEqual(Array.from(ov['1st Year']), ['MPC', 'BiPC', 'CEC', 'HEC']);
    assert.deepEqual(Array.from(ov['2nd Year']), ['MPC', 'BiPC', 'CEC', 'HEC']);
    assert.deepEqual(Array.from(ov['10th Class']), ['A']);
  });
  test('school classes keep only their own sections (no MPC under Baby Class)', () => {
    assert.deepEqual(Array.from(ov['Baby Class']), ['A', 'B']);
    assert.deepEqual(Array.from(ov['LKG']), ['A', 'B']);
  });
  test('Maths A belongs to MPC only; Physics to MPC and BiPC', () => {
    const m = subs.find(s => s.className === '1st Year' && s.name === 'Mathematics A');
    assert.deepEqual(Array.from(m.sections), ['MPC']);
    const p = subs.find(s => s.className === '2nd Year' && s.name === 'Physics');
    assert.deepEqual(Array.from(p.sections).sort(), ['BiPC', 'MPC']);
  });
  test('an existing subject is extended, not duplicated', () => {
    const eng = subs.filter(s => s.className === '1st Year' && s.name === 'English');
    assert.equal(eng.length, 1);
    assert.deepEqual(Array.from(eng[0].sections).sort(), ['BiPC', 'CEC', 'HEC', 'MPC', 'Old']);
  });
  test('saved to storage', () => {
    assert.ok(t1.store['class-levels'].includes('2nd Year'));
    assert.ok(t1.store['master-subjects'].length > 10);
  });

  const before = JSON.stringify([cl, sec, ov, subs]);
  await t1.win.clgApply();
  test('pressing Create a second time changes nothing', () => {
    assert.equal(JSON.stringify([run(t1.ctx, 'CLASS_LEVELS'), run(t1.ctx, 'SECTIONS'), run(t1.ctx, 'classSectionOverrides'), run(t1.ctx, 'subjectsList')]), before);
  });

  // optional subjects use the elective flag
  await t1.win.clgField(0, 'subjects', 'English\nMathematics A\nComputer Science (optional)');
  await t1.win.clgApply();
  test('"(optional)" marks the subject as an elective', () => {
    const cs = run(t1.ctx, 'subjectsList').find(s => s.name === 'Computer Science' && s.className === '1st Year');
    assert.ok(cs && cs.elective === true);
    assert.deepEqual(Array.from(cs.sections), ['MPC']);
  });

  // more groups from the usual list, and the group name can be longer now
  const t6 = boot();
  await t6.win.clgSetType('junior_college'); await t6.win.clgAddStandard();
  await t6.win.clgAddOption('MEC'); await t6.win.clgAddOption('MLT'); await t6.win.clgAddOption('MEC'); await t6.win.clgAddOption('Nope');
  test('MEC and a vocational group can be added from the usual list, once each', () => {
    assert.deepEqual(t6.store['college-structure'].combos.map(c => c.name), ['MPC', 'BiPC', 'CEC', 'HEC', 'MEC', 'MLT']);
    assert.equal(t6.store['college-structure'].combos[5].stream, 'Vocational');
  });
  await t6.win.clgField(5, 'name', 'Graphic Design Plus');
  test('a group name can be up to 16 characters', () => { assert.equal(t6.store['college-structure'].combos[5].name, 'Graphic Design P'); });
  await t6.win.clgApply();
  test('a vocational group becomes a section with its practical papers', () => {
    assert.ok(Array.from(run(t6.ctx, 'SECTIONS')).includes('Graphic Design P'));
    assert.ok(run(t6.ctx, 'subjectsList').some(s => s.className === '2nd Year' && /Practical I$/.test(s.name) && Array.from(s.sections).includes('Graphic Design P')));
  });
  const t7 = boot({ admin: false }); await t7.win.clgAddOption('MEC');
  test('a Teacher login cannot add a group', () => { assert.equal(t7.store['college-structure'], undefined); });

  // a combination with students cannot be renamed or removed
  const t2 = boot({ students: [{ className: '1st Year', section: 'MPC' }] });
  await t2.win.clgSetType('junior_college'); await t2.win.clgAddStandard();
  await t2.win.clgRemove(0);
  await t2.win.clgField(0, 'name', 'MPC-X');
  test('a combination that already has students is protected', () => {
    assert.equal(t2.store['college-structure'].combos[0].name, 'MPC');
    assert.equal(t2.store['college-structure'].combos.length, 4);
  });

  // only Admin / Principal can change anything
  const t3 = boot({ admin: false });
  await t3.win.clgSetType('junior_college');
  test('a Teacher login cannot switch the institution type', () => {
    assert.equal(t3.store['college-structure'], undefined);
  });

  // switched off by default: the screen does not appear unless the server setting is on
  for (const [pack, expect] of [[false, 0], [true, 1]]) {
    const t5 = boot({ pack });
    let inserted = 0;
    const body = { contains: () => false, insertBefore: () => { inserted++; }, firstChild: null };
    t5.ctx.document.createElement = () => ({ id: '', set innerHTML(v) {} });
    t5.ctx.document.getElementById = () => null;
    await t5.win.renderClassesTab(body);
    await new Promise(r => setTimeout(r, 30));
    test('College Pack ' + (pack ? 'on: the screen appears' : 'off: the screen does not appear'), () => { assert.equal(inserted, expect); });
  }

  // year-end path: 1st Year -> 2nd Year -> leaves; school's last class leaves instead of flowing into 1st Year
  const nx = c => run(t1.ctx, 'window.clgNextClass(' + JSON.stringify(c) + ')');
  test('1st Year promotes to 2nd Year', () => { assert.equal(nx('1st Year'), '2nd Year'); });
  test('2nd Year ends as leaving the college', () => { assert.equal(nx('2nd Year'), ''); });
  test('the school class before 1st Year leaves instead of being auto-promoted into a combination', () => { assert.equal(nx('10th Class'), ''); });
  test('other school classes are left to the normal rule', () => { assert.equal(nx('LKG'), null); });
  test('a school install without the college structure has no opinion at all', () => {
    const sch = boot();
    assert.equal(run(sch.ctx, 'window.clgNextClass("10th Class")'), null);
    assert.equal(run(sch.ctx, 'window.clgNextClass("1st Year")'), null);
  });

  // a School install that never touches the switch changes nothing
  const t4 = boot();
  test('without any action a school install is untouched', () => {
    assert.deepEqual(Array.from(run(t4.ctx, 'CLASS_LEVELS')), ['Baby Class', 'LKG', '10th Class']);
    assert.deepEqual(Array.from(run(t4.ctx, 'SECTIONS')), ['A', 'B']);
  });

  done('college-structure');
})();
