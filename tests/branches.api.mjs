// API-level checks for multi-branch. Usage: BASE=http://localhost:4043 node branches.api.mjs
const BASE = process.env.BASE || 'http://localhost:4043';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
async function login(username, password) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const set = r.headers.get('set-cookie') || '';
  const m = /sid=[^;]+/.exec(set);
  if (!m) throw new Error('login failed for ' + username + ': ' + (await r.text()).slice(0, 120));
  return m[0];
}
const call = async (ck, method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie: ck }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { s: r.status, j };
};
const uid = Math.random().toString(36).slice(2, 7);
const ADM = await login('demo.admin', 'Demo@123');

console.log('single-branch mode');
let b = await call(ADM, 'GET', '/api/branches');
ok(b.s === 200 && b.j.branches.length >= 1, 'branches endpoint answers');
const startedMulti = b.j.multi;
const baseStudents = (await call(ADM, 'GET', '/api/students')).j.length;
const basePay = (await call(ADM, 'GET', '/api/payments')).j.length;

console.log('create a branch');
const nb = await call(ADM, 'POST', '/api/branches', { name: 'North Campus ' + uid, code: 'N' + uid.toUpperCase(), address: 'Road 1' });
ok(nb.s === 201, 'branch created');
const NID = nb.j.id;
b = await call(ADM, 'GET', '/api/branches');
ok(b.j.multi === true && b.j.scope.branchId === b.j.mainId, 'two branches -> multi mode, default scope = main');
ok((await call(ADM, 'POST', '/api/branches', { name: 'North Campus ' + uid })).s === 409, 'duplicate branch name refused');
ok((await call(ADM, 'GET', '/api/students')).j.length === baseStudents, 'main branch still sees all existing students');
ok((await call(ADM, 'GET', '/api/payments')).j.length === basePay, 'main branch still sees all existing payments');

console.log('work inside the new branch');
ok((await call(ADM, 'POST', '/api/branches/switch', { branchId: NID })).s === 200, 'switch to new branch');
ok((await call(ADM, 'GET', '/api/students')).j.length === 0, 'new branch starts empty');
const sid = 'tb_' + uid;
const mk = (id, cls) => ({ id, firstName: 'Branch' + id, lastName: 'Tester', className: cls || '5th Class', section: 'A', status: 'Active', admissionNo: 'BR-' + id });
let r = await call(ADM, 'POST', '/api/students', mk(sid));
ok(r.s === 201, 'student created in new branch');
let list = (await call(ADM, 'GET', '/api/students')).j;
ok(list.length === 1 && list[0].id === sid, 'only that student visible in the new branch');
r = await call(ADM, 'POST', '/api/students', { ...mk('tb2_' + uid), admissionNo: 'BR-' + sid });
ok(r.s === 409, 'admission number is unique inside the branch');
const payId = 'tp_' + uid;
r = await call(ADM, 'POST', '/api/payments', { id: payId, receiptNo: 'TB-' + uid, studentId: sid, studentName: 'x', category: 'fee', mode: 'Cash', amount: 100, discount: 0, date: '2026-10-28' });
ok(r.s === 201, 'payment taken for the branch student');
ok((await call(ADM, 'GET', '/api/payments')).j.length === 1, 'branch sees only its own payment');
ok((await call(ADM, 'POST', '/api/acct-income', { id: 'ti_' + uid, voucherNo: 'TI-' + uid, date: '2026-10-28', category: 'x', amount: 5, mode: 'Cash', voided: false })).s === 201, 'voucher saved in branch');
ok((await call(ADM, 'GET', '/api/acct-income')).j.length === 1, 'branch sees only its own vouchers');

console.log('settings lists are per branch');
ok((await call(ADM, 'PUT', '/api/kv/inventory-items', [{ id: 'it_' + uid, name: 'North Pen', qty: 3 }])).s === 200, 'inventory saved in branch');
let kv = (await call(ADM, 'GET', '/api/kv/inventory-items')).j;
ok(Array.isArray(kv) && kv.length === 1 && kv[0].name === 'North Pen', 'branch reads its own inventory');
const batch = (await call(ADM, 'GET', '/api/kv-batch?keys=inventory-items,fee-types')).j;
ok(Array.isArray(batch['inventory-items']) && batch['inventory-items'].length === 1, 'kv-batch is branch aware');
ok((await call(ADM, 'PUT', '/api/kv/fee-types', (await call(ADM, 'GET', '/api/kv/fee-types')).j)).s === 200, 'shared settings (fee types) still saved');

console.log('main branch is unaffected');
const MAIN = b.j.mainId;
await call(ADM, 'POST', '/api/branches/switch', { branchId: MAIN });
ok((await call(ADM, 'GET', '/api/students')).j.length === baseStudents, 'main students unchanged');
ok(!(await call(ADM, 'GET', '/api/students')).j.some(s => s.id === sid), 'new-branch student not in main');
ok((await call(ADM, 'GET', '/api/payments')).j.length === basePay, 'main payments unchanged');
kv = (await call(ADM, 'GET', '/api/kv/inventory-items')).j;
ok(!(Array.isArray(kv) && kv.some(x => x.id === 'it_' + uid)), 'main inventory does not contain branch stock');
r = await call(ADM, 'POST', '/api/payments', { id: 'tpx_' + uid, receiptNo: 'TX-' + uid, studentId: sid, studentName: 'x', category: 'fee', mode: 'Cash', amount: 1, discount: 0, date: '2026-10-28' });
ok(r.s === 403 && r.j.code === 'BRANCH_MISMATCH', 'cannot take a payment for another branch\'s student');
r = await call(ADM, 'PUT', '/api/students', { ...mk(sid), firstName: 'Hacked' });
ok(r.s === 403, 'cannot edit another branch\'s student');

console.log('all-branches view');
ok((await call(ADM, 'POST', '/api/branches/switch', { branchId: 'all' })).s === 200, 'switch to all');
list = (await call(ADM, 'GET', '/api/students')).j;
ok(list.length === baseStudents + 1 && list.some(s => s.id === sid && s.branchId === NID), 'all view lists every branch and tags each student');
ok((await call(ADM, 'GET', '/api/payments')).j.length === basePay + 1, 'all view lists every payment');
kv = (await call(ADM, 'GET', '/api/kv/inventory-items')).j;
ok(Array.isArray(kv) && kv.some(x => x.id === 'it_' + uid && x.branchId === NID), 'all view merges per-branch lists');
r = await call(ADM, 'POST', '/api/students', mk('tb3_' + uid));
ok(r.s === 400 && r.j.code === 'BRANCH_REQUIRED', 'cannot add records while viewing all branches');
ok((await call(ADM, 'PUT', '/api/kv/inventory-items', [])).s === 400, 'cannot save branch lists in all view');
ok((await call(ADM, 'GET', '/api/branches/summary')).j.branches.some(x => x.id === NID && x.students === 1), 'summary counts per branch');
const me = (await call(ADM, 'GET', '/api/me')).j;
ok(me.branch && me.branch.all === true && me.branch.groupLevel === true, '/api/me describes the scope');

console.log('a user tied to a branch');
const uname = 'br.acc' + uid;
const uid2 = 'u_' + uid;
await call(ADM, 'POST', '/api/branches/switch', { branchId: NID });
r = await call(ADM, 'POST', '/api/users', { id: uid2, name: 'Branch Accountant', username: uname, password: 'Br@nch#' + uid + '9', role: 'Accountant', branchId: NID });
ok(r.s === 201, 'user created for the branch');
const us = (await call(ADM, 'GET', '/api/users')).j.find(u => u.id === uid2);
ok(us && us.branchId === NID, 'user carries its branch');
const ACC = await login(uname, 'Br@nch#' + uid + '9').catch(e => null);
ok(!!ACC, 'branch user can sign in');
if (ACC) {
  list = (await call(ACC, 'GET', '/api/students')).j;
  ok(list.length === 1 && list[0].id === sid, 'branch user sees only their branch');
  ok((await call(ACC, 'GET', '/api/payments')).j.length === 1, 'branch user sees only their payments');
  ok((await call(ACC, 'POST', '/api/branches/switch', { branchId: MAIN })).s === 403, 'branch user cannot switch branch');
  ok((await call(ACC, 'POST', '/api/branches', { name: 'Evil ' + uid })).s === 403, 'branch user cannot create branches');
  const mm = (await call(ACC, 'GET', '/api/me')).j;
  ok(mm.branch && mm.branch.locked === true && mm.branch.branchId === NID, 'branch user /api/me shows locked scope');
  const bl = (await call(ACC, 'GET', '/api/branches')).j;
  ok(bl.branches.length === 1, 'branch user sees only their own branch in the list');
}

console.log('deleting branches');
r = await call(ADM, 'DELETE', '/api/branches/' + NID);
ok(r.s === 409, 'a branch with records cannot be deleted');
ok((await call(ADM, 'DELETE', '/api/branches/' + MAIN)).s === 400, 'main branch cannot be deleted');

console.log(`\n${pass} passed, ${fail} failed`);
console.log('CLEANUP_ID=' + NID + ' STARTED_MULTI=' + startedMulti);
process.exit(fail ? 1 : 0);
