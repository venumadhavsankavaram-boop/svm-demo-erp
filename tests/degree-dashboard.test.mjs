// Degree College dashboard numbers.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, done } from './helpers.mjs';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'modules');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const win = { clgIsDegreeCollege: () => true };
const ctx = vm.createContext({ window: win, console, OBJECT_BACKED_KEYS: {}, document: { getElementById: () => null }, storageGet: async (k, d) => d, storageSet: async () => {}, scxActiveStudents: () => [], attendanceRecords: [] });
vm.runInContext(read('96-degree-college.js'), ctx);
vm.runInContext(read('97-degree-college-dashboard.js'), ctx);
const st = (id, cls, sec) => ({ id, className: cls, section: sec });
const students = [st('a', 'Honours Year 1', 'BCom'), st('b', 'Honours Year 1', 'BCom'), st('c', 'Honours Year 2', 'BCom'), st('x', '1st Year', 'MPC')];
const recs = []; for (let d = 1; d <= 10; d++) { recs.push({ studentId: 'a', date: '2026-08-' + String(d).padStart(2, '0'), status: d <= 5 ? 'Present' : 'Absent' }); recs.push({ studentId: 'b', date: '2026-08-' + String(d).padStart(2, '0'), status: 'Present' }); }
const dg = { S: { grading: { attendanceMin: 75 }, programmes: [{ name: 'BCom', stream: 'Commerce', pattern: 'honours4', seats: [40, 40, 40, 40], courses: [{ id: 'k1', sem: 1, type: 'Major', title: 'T', credits: 4 }] }] },
  R: { marks: { b: { k1: { i: 5, e: 20 } } } }, X: { reim: { a: { applying: true } , b: { applying: true, incomeNo: '1', casteNo: '1', rationNo: '1', bank: 'Yes', bio: 'Yes' } }, intern: { b: { community: { status: 'Completed' }, short: { status: 'Completed' } } } } };
const sm = win.dgdSummarize({ students, dg, records: recs });
test('counts only degree students, per year', () => { assert.equal(sm.total, 3); assert.equal(sm.perYear[0], 2); assert.equal(sm.perYear[1], 1); });
test('programme counts against seats', () => { assert.equal(sm.progs[0].counts[0], 2); assert.equal(sm.progs[0].seats[0], 40); });
test('low attendance and reimbursement files to fix', () => { assert.equal(sm.low, 1); assert.equal(sm.reimFix, 1); });
test('backlog student counted', () => { assert.equal(sm.backlogStudents, 1); });
test('open internships', () => { assert.equal(sm.openIntern, 2); });
done('degree-dashboard');
