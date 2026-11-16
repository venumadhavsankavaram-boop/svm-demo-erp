// Copyright (c) 2026 SVM EdTech. All rights reserved. Proprietary and confidential.
// Unauthorised copying, modification or distribution of this file is prohibited. See LICENSE.
// Exam rooms and hall tickets per branch. Usage: BASE=http://localhost:4044 node branches2.api.mjs
const BASE = process.env.BASE || 'http://localhost:4044';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
async function login(username, password) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const m = /sid=[^;]+/.exec(r.headers.get('set-cookie') || '');
  if (!m) throw new Error('login failed');
  return m[0];
}
const call = async (ck, method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie: ck }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { s: r.status, j };
};
const uid = Math.random().toString(36).slice(2, 7);
const ADM = await login('demo.admin', 'Demo@123');
let bl = await call(ADM, 'GET', '/api/branches');
if (!bl.j.multi) { const nb = await call(ADM, 'POST', '/api/branches', { name: 'Test North ' + uid, code: 'TN' + uid.toUpperCase() }); bl = await call(ADM, 'GET', '/api/branches'); }
const MAIN = bl.j.mainId, NID = bl.j.branches.find(b => b.id !== MAIN).id;
const sw = id => call(ADM, 'POST', '/api/branches/switch', { branchId: id });
const ids = (r) => (r.j || []).map(x => x.id);

console.log('exam rooms');
await sw(MAIN);
const rm = 'examroom_m_' + uid, rn = 'examroom_n_' + uid;
ok((await call(ADM, 'POST', '/api/rooms', { id: rm, name: 'Main Hall ' + uid, capacity: 40 })).s < 300, 'main branch can add an exam room');
await sw(NID);
ok(!ids(await call(ADM, 'GET', '/api/rooms')).includes(rm), 'North does not see the main branch room');
ok((await call(ADM, 'POST', '/api/rooms', { id: rn, name: 'North Hall ' + uid, capacity: 30 })).s < 300, 'North can add its own exam room');
const put = await call(ADM, 'PUT', '/api/rooms?id=' + rm, { id: rm, name: 'Hacked', capacity: 1 });
ok(put.s === 403 && put.j.code === 'BRANCH_MISMATCH', 'North cannot change a main-branch room');
ok((await call(ADM, 'DELETE', '/api/rooms?id=' + rm)).s === 403, 'North cannot delete a main-branch room');
await sw(MAIN);
ok(ids(await call(ADM, 'GET', '/api/rooms')).includes(rm) && !ids(await call(ADM, 'GET', '/api/rooms')).includes(rn), 'main sees only its own room');
await sw('all');
const allRooms = await call(ADM, 'GET', '/api/rooms');
const rr = (allRooms.j || []).find(x => x.id === rn);
ok(ids(allRooms).includes(rm) && ids(allRooms).includes(rn) && rr && rr.branchId === NID, 'All branches shows both rooms, tagged with their branch');
ok((await call(ADM, 'POST', '/api/rooms', { id: 'examroom_x_' + uid, name: 'x', capacity: 1 })).s === 400, 'All branches view is read only for rooms');

console.log('hall tickets follow the student');
await sw(NID);
let nStud = (await call(ADM, 'GET', '/api/students')).j;
if (!nStud.length) { await sw(MAIN); const some = (await call(ADM, 'GET', '/api/students')).j.slice(0, 3).map(x => x.id); await call(ADM, 'POST', '/api/branches/move-students', { studentIds: some, toBranch: NID }); await sw(NID); nStud = (await call(ADM, 'GET', '/api/students')).j; }
ok(nStud.length > 0, 'North has students (' + nStud.length + ')');
const ns = nStud[0].id;
const ht1 = 'ht_t_' + uid;
ok((await call(ADM, 'POST', '/api/exam-hall-tickets', { id: ht1, examId: 'ex_' + uid, studentId: ns, htNumber: 'N-0001' })).s < 300, 'ticket for a North student saved in North');
await sw(MAIN);
ok(!ids(await call(ADM, 'GET', '/api/exam-hall-tickets')).includes(ht1), 'main does not see North tickets');
const bad = await call(ADM, 'POST', '/api/exam-hall-tickets', { id: 'ht_bad_' + uid, examId: 'ex_' + uid, studentId: ns, htNumber: 'X' });
ok(bad.s === 403 && bad.j.code === 'BRANCH_MISMATCH', 'main cannot create a ticket for a North student');
await sw(NID);
ok(ids(await call(ADM, 'GET', '/api/exam-hall-tickets')).includes(ht1), 'North sees its ticket');

console.log('moving a student takes the hall ticket along');
await sw(MAIN);
const sid = 'mv_' + uid, htm = 'ht_mv_' + uid;
ok((await call(ADM, 'POST', '/api/students', { id: sid, firstName: 'Mv' + uid, lastName: 'T', className: '5th Class', section: 'A', status: 'Active', admissionNo: 'MVX-' + uid })).s === 201, 'student created in main');
ok((await call(ADM, 'POST', '/api/exam-hall-tickets', { id: htm, examId: 'ex_' + uid, studentId: sid, htNumber: 'M-1' })).s < 300, 'ticket created in main');
ok((await call(ADM, 'POST', '/api/branches/move-students', { studentIds: [sid], toBranch: NID })).s === 200, 'student moved to North');
ok(!ids(await call(ADM, 'GET', '/api/exam-hall-tickets')).includes(htm), 'ticket left main');
await sw(NID);
ok(ids(await call(ADM, 'GET', '/api/exam-hall-tickets')).includes(htm), 'ticket now in North');

await sw(MAIN);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
