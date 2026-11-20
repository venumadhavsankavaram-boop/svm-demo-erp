// Per-institution wording: School unchanged, Junior College "Lecturers", Degree College "Faculty".
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules');
const win = {};
const ctx = vm.createContext({ window: win, console });
vm.runInContext(fs.readFileSync(path.join(dir, '98-institution-terms.js'), 'utf8'), ctx);
const c = (t, ty) => win.instTerms.convert(t, ty);
test('school text is never changed', () => { for (const s of ['Add Teacher', 'Teachers', 'School Setup', 'your school']) assert.equal(c(s, 'school'), s); });
test('junior college says Lecturer(s)', () => {
  assert.equal(c('Add Teacher', 'junior_college'), 'Add Lecturer');
  assert.equal(c('All teachers present', 'junior_college'), 'All lecturers present');
  assert.equal(c('TEACHER PORTAL', 'junior_college'), 'LECTURER PORTAL');
  assert.equal(c('Class Teacher', 'junior_college'), 'Class In-charge');
});
test('degree college says Faculty', () => {
  assert.equal(c('Teachers', 'degree_college'), 'Faculty');
  assert.equal(c('Teacher login', 'degree_college'), 'Faculty login');
  assert.equal(c('Ask a teacher', 'degree_college'), 'Ask a faculty member');
  assert.equal(c('Class Teacher', 'degree_college'), 'Class Mentor');
  assert.equal(c('Homework', 'degree_college'), 'Assignments');
});
test('school becomes college only in fixed phrases, never in names', () => {
  assert.equal(c('School Setup', 'degree_college'), 'College Setup');
  assert.equal(c('Welcome to your school', 'junior_college'), 'Welcome to your college');
  assert.equal(c('Sunrise Public School', 'degree_college'), 'Sunrise Public School');
});
test('unknown type and non-text are returned as they are', () => { assert.equal(c('Teacher', 'x'), 'Teacher'); assert.equal(c(null, 'degree_college'), null); });
test('word list for the three types', () => { assert.equal(win.instNames('junior_college').staff, 'Lecturers'); assert.equal(win.instNames('degree_college').staff, 'Faculty'); assert.equal(win.instNames('school').staff, 'Teachers'); });
done();
