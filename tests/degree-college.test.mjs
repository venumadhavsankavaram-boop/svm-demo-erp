// Degree College pack: course parsing, grading, SGPA/CGPA, attendance, reimbursement, structure creation.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules');
const src = fs.readFileSync(path.join(dir, '96-degree-college.js'), 'utf8');

function boot(role = 'Admin', extraStudents = []) {
  const store = {}, toasts = [], cards = [];
  const win = { clgRegisterDegreeCard: f => cards.push(f), clgRepaint: () => {} };
  const students = extraStudents;
  const ctx = vm.createContext({
    window: win, console, OBJECT_BACKED_KEYS: {}, currentUser: { role },
    storageGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    storageSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
    showToast: m => toasts.push(m), showConfirmDialog: async () => true,
    scxActiveStudents: () => students, schoolInfo: { name: 'Test Degree College' },
    CLASS_LEVELS: ['1', '2'], SECTIONS: ['A', 'B'], classSectionOverrides: {}, subjectsList: [], SUBJECTS_KEY: 'subjects',
    attendanceRecords: [], renderClassesTab() {}, document: { getElementById: () => null },
    scxCard: (t, h, inner) => '<section>' + t + inner + '</section>',
  });
  vm.runInContext(src, ctx);
  return { ctx, win, store, toasts, cards };
}
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  const b = boot(); const w = b.win;
  const cs = w.dgParseCourses('1 | Major | Programming | 4\n2 | minor | Minor A | 4 | 20 | 80\nbad line\n9 | Major | X | 3\n1 | Major | Programming | 4\n3 | Zzz | Y | 1');
  test('parses valid lines, drops bad semester/type/duplicates', () => { assert.equal(cs.length, 2); assert.equal(cs[1].type, 'Minor'); assert.equal(cs[1].internalMax, 20); });
  test('courses round-trip through text', () => { assert.equal(w.dgParseCourses(w.dgCoursesText(cs)).length, 2); });
  const g = w.dgCleanGrading({});
  test('default grade scale', () => { assert.equal(w.dgGradeFor(92, g.scale).grade, 'O'); assert.equal(w.dgGradeFor(40, g.scale).points, 5); assert.equal(w.dgGradeFor(39, g.scale).grade, 'F'); });
  const c = { id: 'c1', credits: 4 };
  const r1 = w.dgCourseResult({ i: 20, e: 60 }, c, g);
  test('course result totals and grade', () => { assert.equal(r1.total, 80); assert.equal(r1.max, 100); assert.equal(r1.grade, 'A+'); assert.equal(r1.passed, true); });
  test('blank external gives incomplete', () => { assert.equal(w.dgCourseResult({ i: 20 }, c, g).complete, false); assert.equal(w.dgCourseResult({}, c, g).entered, false); });
  test('below pass mark fails with F', () => { const r = w.dgCourseResult({ i: 5, e: 20 }, c, g); assert.equal(r.passed, false); assert.equal(r.grade, 'F'); assert.equal(r.points, 0); });
  const courses = [{ id: 'a', credits: 4 }, { id: 'b', credits: 2 }];
  const sem = w.dgSemesterResult(courses, { a: { i: 20, e: 60 }, b: { i: 5, e: 20 } }, g);
  test('SGPA is credit weighted and backlog counted', () => { assert.equal(sem.sgpa, (4 * 9 + 0) / 6); assert.equal(sem.backlogs, 1); assert.equal(sem.earned, 4); assert.equal(sem.complete, true); });
  test('CGPA across semesters', () => { assert.equal(w.dgCgpa([{ credits: 4, gp: 36 }, { credits: 4, gp: 32 }]), 8.5); assert.equal(w.dgCgpa([]), null); });
  const recs = [];
  for (let d = 1; d <= 10; d++) recs.push({ studentId: 's', date: '2026-08-' + String(d).padStart(2, '0'), status: d <= 7 ? 'Present' : 'Absent' });
  test('attendance percentage', () => { const a = w.dgAttendancePct(recs, 's'); assert.equal(Math.round(a.pct), 70); assert.equal(w.dgAttendancePct(recs, 'zz'), null); });
  test('reimbursement blockers', () => {
    assert.equal(w.dgReimStatus({}, null, 75).applying, false);
    const s = w.dgReimStatus({ applying: true, incomeNo: '1', casteNo: '2', rationNo: '3', bank: 'Yes', bio: 'Yes' }, { pct: 80 }, 75);
    assert.equal(s.ready, true);
    const t = w.dgReimStatus({ applying: true, bank: 'No' }, { pct: 60 }, 75);
    assert.equal(t.blockers.length, 6);
  });

  // structure creation
  const a = boot(); a.cards[0](); await settle();
  await a.win.dgAddStarter('B.Com (General)');
  await a.win.dgApply();
  test('apply adds Honours years, programme section and subjects', () => {
    assert.ok(a.ctx.CLASS_LEVELS.includes('Honours Year 4'));
    assert.ok(a.ctx.SECTIONS.includes('B.COM (GENERAL)'));
    assert.ok(a.ctx.subjectsList.some(s => s.className === 'Honours Year 2' && s.name === 'Cost Accounting'));
    assert.equal(JSON.stringify(a.ctx.classSectionOverrides['1']), '["A","B"]');
    assert.equal(JSON.stringify(a.ctx.classSectionOverrides['Honours Year 1']), '["B.COM (GENERAL)"]');
  });
  const n1 = a.ctx.subjectsList.length; await a.win.dgApply();
  test('applying twice adds nothing new', () => { assert.equal(a.ctx.subjectsList.length, n1); assert.equal(a.ctx.CLASS_LEVELS.filter(x => x === 'Honours Year 1').length, 1); });

  // marks validation and permissions
  const st = [{ id: 's1', firstName: 'A', lastName: 'B', admissionNo: '1', className: 'Honours Year 1', section: 'B.Com (General)' }];
  const m = boot('Admin', st); m.cards[0](); await settle(); await m.win.dgAddStarter('B.Com (General)');
  const prog = m.win.dgData().S.programmes[0], cid = prog.courses[0].id;
  await m.win.dgMark('s1', cid, 'i', '10'); await m.win.dgMark('s1', cid, 'e', '999');
  test('mark above max is rejected', () => { assert.equal(m.win.dgData().R.marks.s1[cid].i, 10); assert.equal(m.win.dgData().R.marks.s1[cid].e, undefined); });
  await m.win.dgMark('s1', cid, 'i', '');
  test('clearing a mark removes the record', () => { assert.equal(m.win.dgData().R.marks.s1, undefined); });
  const t = boot('Teacher'); t.cards[0](); await settle();
  await t.win.dgAddStarter('B.A. (HEP)');
  test('Teacher cannot change programmes', () => { assert.equal(t.win.dgData().S.programmes.length, 0); });
  done('degree-college');
})();
