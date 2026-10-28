// Multi-branch support: one ERP, several campuses.
//
// How it works (read this before changing anything):
//  - The `branches` table lists the campuses. With only ONE row the school is single-branch and nothing in the
//    ERP behaves differently. With two or more rows "multi-branch mode" turns on.
//  - Records that belong to a campus (students, fees, attendance, marks, vouchers, enquiries, homework, the
//    Inventory/Timetable/Transport/Library/Hostel lists ...) carry a branch. Records created before branches
//    existed have no branch and count as the MAIN branch, so nothing has to be migrated.
//  - Every request has a "scope": the one branch the person is working in, or ALL branches (read only).
//      * a user tied to a branch is locked to it;
//      * a group-level Admin/Principal picks the branch in the top bar (kept on their session), default = main;
//      * a Student/Parent login follows the branch of their own student record.
//  - Shared across all branches (never filtered): fee structure and fee types, academic years, exam types and
//    grading, subjects, the staff directory and staff attendance, holidays, website content, school profile.
//  - Table records are filtered in the GET response and stamped on write; settings lists stored under
//    /api/kv/:key are kept per branch under the key "<key>@<branchId>" (the main branch keeps the plain key).
import { sql, addColumnIfMissing } from './db.js';

let ctx = { MANAGEMENT_ROLES: ['Admin', 'Principal'], PARENT_LOGIN_ROLES: ['Student', 'Parent'], auditNote() {}, sessionHash() { return null; }, getLinkedStudent: null };
export function initBranches(c) { ctx = { ...ctx, ...c }; }

// Resource -> table, and which request field names the student the record belongs to (so the record always
// follows its student's branch). `group: true` = a record with no branch is visible in every branch.
export const BRANCH_TABLES = {
  students: { table: 'students', own: true },
  payments: { table: 'payments', studentKey: 'studentId' },
  discounts: { table: 'student_discounts', studentKey: 'studentId' },
  'fee-year-history': { table: 'fee_year_history', studentKey: 'studentId' },
  'extra-fees': { table: 'student_extra_fees', studentKey: 'studentId' },
  attendance: { table: 'attendance_records', studentKey: 'studentId' },
  'exam-results': { table: 'exam_results', studentKey: 'studentId' },
  // Exam rooms are a campus's own rooms; hall-ticket numbers follow their student.
  rooms: { table: 'rooms', own: true },
  'exam-hall-tickets': { table: 'exam_hall_tickets', studentKey: 'studentId' },
  'acct-income': { table: 'acct_income', own: true },
  'acct-expenses': { table: 'acct_expenses', own: true },
  'admission-inquiries': { table: 'admission_inquiries', own: true },
  'homework-items': { table: 'homework_items', own: true },
  'comms-messages': { table: 'comms_messages', own: true, group: true },
  users: { table: 'users', own: true, users: true },
  'deletion-requests': { table: 'deletion_requests', deletion: true },
};
// Settings lists that are kept separately for each branch.
export const BRANCH_KV = new Set([
  'inventory-items', 'inventory-sales', 'inventory-returns', 'inventory-vendor-returns', 'pending-approvals',
  'timetable-entries', 'timetable-periods', 'timetable-days',
  'transport-routes', 'library-books', 'library-issues', 'library-settings', 'hostel-rooms',
  'fee-refunds', 'fee-late-waivers', 'fee-day-closings', 'class-section-overrides',
]);

const SAFE = /^[A-Za-z0-9_]+$/;
let cache = { at: 0, list: null };
export function dropBranchCache() { cache = { at: 0, list: null }; userCache.clear(); }

export async function ensureBranchSchema() {
  await sql`CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY, name VARCHAR(191) NOT NULL, code VARCHAR(32), address TEXT, phone VARCHAR(64), email VARCHAR(191),
    is_main TINYINT NOT NULL DEFAULT 0, sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  for (const t of Object.values(BRANCH_TABLES)) {
    if (!SAFE.test(t.table)) continue;
    try { await addColumnIfMissing(t.table, 'branch_id VARCHAR(64)'); } catch (e) { console.error('branch_id column on ' + t.table + ':', e.message); }
  }
  try { await addColumnIfMissing('sessions', 'active_branch VARCHAR(64)'); } catch (e) { console.error('sessions.active_branch:', e.message); }
  const have = await sql`SELECT id FROM branches LIMIT 1`;
  if (!have.length) {
    let name = 'Main Campus';
    try { const r = await sql`SELECT name FROM school_info LIMIT 1`; if (r[0] && r[0].name) name = String(r[0].name).slice(0, 190); } catch (_) {}
    await sql`INSERT INTO branches (id, name, code, is_main, sort_order) VALUES ('main', ${name}, 'MAIN', 1, 0)`;
  }
  dropBranchCache();
}

export async function getBranches(force) {
  if (!force && cache.list && Date.now() - cache.at < 15000) return cache.list;
  let rows;
  try { rows = await sql`SELECT * FROM branches ORDER BY is_main DESC, sort_order ASC, created_at ASC`; }
  catch (e) { console.error('branches table unavailable, running as a single branch:', e.message); return cache.list || []; }
  const list = rows.map(r => ({ id: r.id, name: r.name, code: r.code || '', address: r.address || '', phone: r.phone || '', email: r.email || '', isMain: !!Number(r.is_main) }));
  cache = { at: Date.now(), list };
  return list;
}

const userCache = new Map(); // userId -> { at, branchId, linkedStudent }
async function userBranchInfo(userId) {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < 10000) return hit;
  let info = { at: Date.now(), branchId: null, linked: null };
  try {
    const r = await sql.query('SELECT branch_id, linked_student_id FROM users WHERE id = $1', [userId]);
    if (r[0]) info = { at: Date.now(), branchId: r[0].branch_id || null, linked: r[0].linked_student_id || null };
  } catch (_) {}
  if (userCache.size > 500) userCache.clear();
  userCache.set(userId, info);
  return info;
}

// The branch this request works in. Result: { multi, mainId, branches, branchId, all, locked, groupLevel }.
export async function resolveScope(req) {
  if (req._branchScope) return req._branchScope;
  const branches = await getBranches();
  const mainId = (branches.find(b => b.isMain) || branches[0] || { id: 'main' }).id;
  const multi = branches.length >= 2;
  const out = { multi, mainId, branches, branchId: mainId, all: false, locked: false, groupLevel: false };
  if (multi) {
    const u = req.authUser;
    const ids = new Set(branches.map(b => b.id));
    if (!u) { out.all = true; out.branchId = null; }
    else if (u.id === 'vendor-support') { out.groupLevel = true; out.all = true; out.branchId = null; }
    else {
      const info = await userBranchInfo(u.id);
      const mgmt = ctx.MANAGEMENT_ROLES.includes(u.role);
      if (ctx.PARENT_LOGIN_ROLES.includes(u.role)) {
        out.locked = true;
        let b = null;
        try { if (info.linked) { const s = await sql.query('SELECT branch_id FROM students WHERE id = $1', [info.linked]); b = s[0] ? s[0].branch_id : null; } } catch (_) {}
        out.branchId = b && ids.has(b) ? b : mainId;
      } else if (info.branchId && ids.has(info.branchId)) {
        out.locked = true; out.branchId = info.branchId;
      } else if (mgmt) {
        out.groupLevel = true;
        const a = req.sessionActiveBranch;
        if (a === 'all') { out.all = true; out.branchId = null; }
        else out.branchId = a && ids.has(a) ? a : mainId;
      } else {
        out.branchId = mainId; // staff with no branch set behave as before: they work in the main branch
        out.locked = true;
      }
    }
  }
  req._branchScope = out;
  return out;
}

const rowBranch = (scope, raw, group) => raw || (group ? '*' : scope.mainId);
const visible = (scope, b, group) => scope.all || b === scope.branchId || (group && b === '*');

async function branchMap(table) {
  const m = new Map();
  if (!SAFE.test(table)) return m;
  const rows = await sql.query(`SELECT id, branch_id FROM ${table} WHERE branch_id IS NOT NULL`);
  rows.forEach(r => m.set(String(r.id), r.branch_id));
  return m;
}
async function studentBranchOf(scope, studentId) {
  if (!studentId) return null;
  const r = await sql.query('SELECT branch_id FROM students WHERE id = $1', [String(studentId)]);
  return r.length ? (r[0].branch_id || scope.mainId) : null;
}

// Wraps res.json so the response can be rewritten (async) before it is sent.
function hookJson(res, fn) {
  const orig = res.json.bind(res);
  res.json = function (body) {
    Promise.resolve().then(() => fn(body)).then(b => orig(b === undefined ? body : b)).catch(e => { console.error('branch hook failed:', e.message); orig(body); });
    return res;
  };
}

function err(res, status, code, error) { res.status(status).json({ error, code }); return true; }

// Called by the /api/:resource dispatcher. Returns true when it already answered the request.
export async function branchGuard(req, res, resource) {
  const def = BRANCH_TABLES[resource];
  if (!def) return false;
  const scope = await resolveScope(req);
  req.branchScope = scope;
  if (!scope.multi) return false;
  const group = !!def.group;
  const method = req.method;

  if (method === 'GET') {
    hookJson(res, async body => {
      if (!Array.isArray(body)) return body;
      if (def.deletion) {
        const sm = await branchMap('students');
        return scope.all ? body : body.filter(r => !r || r.resource !== 'students' || (sm.get(String(r.recordId)) || scope.mainId) === scope.branchId);
      }
      const m = await branchMap(def.table);
      const out = [];
      for (const r of body) {
        if (!r) continue;
        const b = rowBranch(scope, m.get(String(r.id)), group);
        // A group-level Admin manages every account, whichever branch they are working in.
        const show = def.users ? (!scope.locked || b === scope.branchId) : visible(scope, b, group);
        if (!show) continue;
        if (scope.all || def.users) r.branchId = b === '*' ? '' : (def.users && !m.get(String(r.id)) && !ctx.PARENT_LOGIN_ROLES.includes(r.role) && ctx.MANAGEMENT_ROLES.includes(r.role) ? '' : b);
        out.push(r);
      }
      return out;
    });
    return false;
  }

  const publicEnquiry = resource === 'admission-inquiries' && !req.authUser && method === 'POST';
  if (publicEnquiry) {
    // The website form can name a campus by its code; anything else lands in the main branch.
    const code = String((req.body && (req.body.branchCode || req.body.branch)) || '').trim().toLowerCase();
    const hit = code ? scope.branches.find(b => (b.code || '').toLowerCase() === code || b.id === code) : null;
    stampAfter(res, def.table, req.body && req.body.id, hit ? hit.id : null);
    return false;
  }
  if (!req.authUser) return false;

  const body = req.body || {};
  const id = body.id || (req.query && req.query.id) || null;
  const special = req.query && (req.query.action === 'delete-duplicates');

  // ---- users: a branch is part of the account, not of the scope ----
  if (def.users) {
    if (scope.locked) {
      if (method !== 'POST' && id) {
        const ex = await sql.query('SELECT branch_id FROM users WHERE id = $1', [String(id)]);
        if (ex.length && (ex[0].branch_id || scope.mainId) !== scope.branchId) return err(res, 403, 'BRANCH_MISMATCH', 'That user belongs to another branch.');
      }
      if (method === 'POST' || method === 'PUT') stampAfter(res, 'users', id, scope.branchId);
      return false;
    }
    if ((method === 'POST' || method === 'PUT') && body.branchId !== undefined) {
      const want = String(body.branchId || '');
      const valid = want === '' || want === '*' || scope.branches.some(b => b.id === want);
      if (!valid) return err(res, 400, 'BAD_BRANCH', 'Unknown branch.');
      const role = String(body.role || '');
      // Only Admin/Principal accounts can be group-level; everyone else is tied to a branch (default: main).
      const stamp = (want === '' || want === '*') ? (ctx.MANAGEMENT_ROLES.includes(role) ? '' : scope.mainId) : want;
      stampAfter(res, 'users', id, stamp === '' ? '__NULL__' : stamp);
    }
    return false;
  }

  if (method === 'GET') return false;

  if (scope.all && !(group && method === 'POST') && !special) {
    return err(res, 400, 'BRANCH_REQUIRED', 'You are viewing all branches (read only). Choose one branch in the top bar to add or change records.');
  }

  // ---- existing record: it must belong to the branch being worked in ----
  if ((method === 'PUT' || method === 'DELETE') && id && !def.deletion) {
    const ex = await sql.query(`SELECT branch_id FROM ${def.table} WHERE id = $1`, [String(id)]);
    if (ex.length) {
      const b = rowBranch(scope, ex[0].branch_id, group);
      if (!scope.all && b !== scope.branchId && !(group && b === '*')) {
        return err(res, 403, 'BRANCH_MISMATCH', 'That record belongs to another branch. Switch to that branch to change it.');
      }
    }
  }

  if (method === 'POST') {
    let stamp = scope.all ? (group ? '__NULL__' : null) : scope.branchId;
    if (def.studentKey && body[def.studentKey] && !scope.all) {
      const sb = await studentBranchOf(scope, body[def.studentKey]);
      if (sb && sb !== scope.branchId) {
        const nm = (scope.branches.find(b => b.id === sb) || {}).name || 'another branch';
        return err(res, 403, 'BRANCH_MISMATCH', 'That student belongs to ' + nm + '. Switch to that branch first.');
      }
    }
    if (stamp) stampAfter(res, def.table, id, stamp);
  }
  return false;
}

// After a successful save, write the branch onto the record, BEFORE the response goes out so the next read
// already sees it.
function stampAfter(res, table, id, branchId) {
  if (!id || !SAFE.test(table)) return;
  const orig = res.json.bind(res);
  res.json = function (body) {
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    if (!ok) return orig(body);
    const run = branchId === '__NULL__'
      ? sql.query(`UPDATE ${table} SET branch_id = NULL WHERE id = $1`, [String(id)])
      : sql.query(`UPDATE ${table} SET branch_id = $1 WHERE id = $2`, [branchId || null, String(id)]);
    run.catch(e => console.error('branch stamp failed:', e.message)).then(() => orig(body));
    return res;
  };
}
export async function stampFromStudent(table, id, studentId) {
  if (!SAFE.test(table) || !id || !studentId) return;
  try { await sql.query(`UPDATE ${table} SET branch_id = (SELECT branch_id FROM students WHERE id = $1) WHERE id = $2`, [String(studentId), String(id)]); } catch (e) { console.error('stampFromStudent failed:', e.message); }
}

// A student record may only be touched by someone working in that student's branch.
export async function canSeeStudent(req, studentId) {
  const scope = await resolveScope(req);
  if (!scope.multi || scope.all) return true;
  const b = await studentBranchOf(scope, studentId);
  return !b || b === scope.branchId;
}
// Keeps a list of rows (each with branch_id) to the branch being worked in.
export async function inScopeRow(req, rawBranch) {
  const scope = await resolveScope(req);
  if (!scope.multi || scope.all) return true;
  return (rawBranch || scope.mainId) === scope.branchId;
}

// ---- Settings lists kept per branch (/api/kv/:key) ----
export async function kvBranchRoute(req, res, key) {
  if (!BRANCH_KV.has(key)) return key;
  const scope = await resolveScope(req);
  if (!scope.multi) return key;
  if (scope.all) {
    if (req.method !== 'GET') { err(res, 400, 'BRANCH_REQUIRED', 'You are viewing all branches (read only). Choose one branch in the top bar to make changes.'); return null; }
    res.status(200).json(await mergedKv(scope, key));
    return null;
  }
  return scope.branchId === scope.mainId ? key : key + '@' + scope.branchId;
}
export async function kvBranchKeys(req, keys) {
  const scope = await resolveScope(req);
  const map = {}; const merged = [];
  for (const k of keys) {
    if (!BRANCH_KV.has(k) || !scope.multi) map[k] = k;
    else if (scope.all) merged.push(k);
    else map[k] = scope.branchId === scope.mainId ? k : k + '@' + scope.branchId;
  }
  return { map, merged, scope };
}
export async function mergedKv(scope, key) {
  const keys = scope.branches.map(b => (b.id === scope.mainId ? key : key + '@' + b.id));
  const rows = await sql.query(`SELECT \`key\` AS k, value FROM kv_store WHERE \`key\` IN (${keys.map((_, i) => '$' + (i + 1)).join(',')})`, keys);
  const by = {}; rows.forEach(r => { let v = r.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) {} } by[r.k] = v; });
  const main = by[key];
  if (main !== undefined && !Array.isArray(main) && !scope.branches.some(b => Array.isArray(by[b.id === scope.mainId ? key : key + '@' + b.id]))) return main;
  const out = [];
  scope.branches.forEach(b => {
    const v = by[b.id === scope.mainId ? key : key + '@' + b.id];
    if (Array.isArray(v)) v.forEach(x => out.push(x && typeof x === 'object' ? { ...x, branchId: x.branchId || b.id } : x));
  });
  return out;
}

// ---- Routes ----
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export function installBranchRoutes(app) {
  const authed = (req, res) => { if (!req.authUser) { res.status(401).json({ error: 'Not logged in.' }); return false; } return true; };
  const groupAdmin = async (req, res) => {
    if (!authed(req, res)) return null;
    const scope = await resolveScope(req);
    const isAdmin = req.authUser.role === 'Admin' || req.authUser.id === 'vendor-support';
    if (!isAdmin || (scope.multi && scope.locked)) { res.status(403).json({ error: 'Only the group-level Admin can manage branches.' }); return null; }
    return scope;
  };

  app.get('/api/branches', async (req, res) => {
    try {
      if (!authed(req, res)) return;
      const scope = await resolveScope(req);
      const list = scope.locked ? scope.branches.filter(b => b.id === scope.branchId) : scope.branches;
      res.json({ multi: scope.multi, mainId: scope.mainId, branches: list, scope: { branchId: scope.branchId, all: scope.all, locked: scope.locked, groupLevel: scope.groupLevel || !scope.multi } });
    } catch (e) { console.error('branches list:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });

  app.get('/api/branches/summary', async (req, res) => {
    try {
      const scope = await groupAdmin(req, res); if (!scope) return;
      const branches = await getBranches(true);
      const main = (branches.find(b => b.isMain) || branches[0]).id;
      const rows = [];
      for (const b of branches) {
        const isMain = b.id === main;
        const cond = isMain ? '(branch_id = $1 OR branch_id IS NULL)' : 'branch_id = $1';
        const st = await sql.query(`SELECT COUNT(*) AS n FROM students WHERE deleted_at IS NULL AND COALESCE(status,'Active') = 'Active' AND ${cond}`, [b.id]);
        const col = await sql.query(`SELECT COALESCE(SUM(amount - COALESCE(discount,0)),0) AS s FROM payments WHERE COALESCE(voided,0) = 0 AND ${cond}`, [b.id]).catch(() => [{ s: 0 }]);
        const us = await sql.query(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND ${cond}`, [b.id]).catch(() => [{ n: 0 }]);
        rows.push({ id: b.id, students: Number(st[0].n || 0), collected: Number(col[0].s || 0), users: Number(us[0].n || 0) });
      }
      res.json({ branches: rows });
    } catch (e) { console.error('branches summary:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });

  app.post('/api/branches', async (req, res) => {
    try {
      const scope = await groupAdmin(req, res); if (!scope) return;
      const b = req.body || {};
      const name = clean(b.name, 190);
      if (!name) return res.status(400).json({ error: 'Give the branch a name.' });
      const list = await getBranches(true);
      if (list.some(x => x.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: 'A branch with this name already exists.' });
      let code = clean(b.code, 32).toUpperCase() || slug(name).toUpperCase().slice(0, 8);
      if (list.some(x => (x.code || '').toUpperCase() === code)) code = code + (list.length + 1);
      let id = 'br-' + (slug(name).slice(0, 14) || 'branch');
      while (list.some(x => x.id === id)) id += Math.floor(Math.random() * 10);
      await sql.query('INSERT INTO branches (id, name, code, address, phone, email, is_main, sort_order) VALUES ($1,$2,$3,$4,$5,$6,0,$7)', [id, name, code, clean(b.address, 500), clean(b.phone, 60), clean(b.email, 190), list.length]);
      dropBranchCache();
      ctx.auditNote(req.authUser.name, req.authUser.role, 'POST', 'branches', id, 'added branch ' + name, null);
      res.status(201).json({ ok: true, id });
    } catch (e) { console.error('branch create:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });

  app.put('/api/branches/:id', async (req, res) => {
    try {
      const scope = await groupAdmin(req, res); if (!scope) return;
      const list = await getBranches(true);
      const cur = list.find(x => x.id === req.params.id);
      if (!cur) return res.status(404).json({ error: 'Branch not found.' });
      const b = req.body || {};
      const name = clean(b.name, 190) || cur.name;
      if (list.some(x => x.id !== cur.id && x.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ error: 'A branch with this name already exists.' });
      let code = (b.code === undefined ? cur.code : clean(b.code, 32).toUpperCase()) || cur.code;
      if (list.some(x => x.id !== cur.id && (x.code || '').toUpperCase() === code)) return res.status(409).json({ error: 'Another branch already uses this code.' });
      await sql.query('UPDATE branches SET name=$1, code=$2, address=$3, phone=$4, email=$5 WHERE id=$6',
        [name, code, b.address === undefined ? cur.address : clean(b.address, 500), b.phone === undefined ? cur.phone : clean(b.phone, 60), b.email === undefined ? cur.email : clean(b.email, 190), cur.id]);
      dropBranchCache();
      ctx.auditNote(req.authUser.name, req.authUser.role, 'PUT', 'branches', cur.id, 'edited branch ' + name, null);
      res.json({ ok: true });
    } catch (e) { console.error('branch update:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });

  app.delete('/api/branches/:id', async (req, res) => {
    try {
      const scope = await groupAdmin(req, res); if (!scope) return;
      const list = await getBranches(true);
      const cur = list.find(x => x.id === req.params.id);
      if (!cur) return res.status(404).json({ error: 'Branch not found.' });
      if (cur.isMain) return res.status(400).json({ error: 'The main branch cannot be deleted.' });
      for (const t of Object.values(BRANCH_TABLES)) {
        if (!SAFE.test(t.table) || t.deletion) continue;
        const r = await sql.query(`SELECT COUNT(*) AS n FROM ${t.table} WHERE branch_id = $1`, [cur.id]);
        if (Number(r[0].n) > 0) return res.status(409).json({ error: 'This branch still has records (' + t.table.replace(/_/g, ' ') + '). Only an empty branch can be deleted.' });
      }
      const kv = await sql.query('SELECT COUNT(*) AS n FROM kv_store WHERE `key` LIKE $1', ['%@' + cur.id]);
      if (Number(kv[0].n) > 0) await sql.query('DELETE FROM kv_store WHERE `key` LIKE $1', ['%@' + cur.id]);
      await sql.query('DELETE FROM branches WHERE id = $1', [cur.id]);
      await sql.query('UPDATE sessions SET active_branch = NULL WHERE active_branch = $1', [cur.id]).catch(() => {});
      dropBranchCache();
      ctx.auditNote(req.authUser.name, req.authUser.role, 'DELETE', 'branches', cur.id, 'deleted branch ' + cur.name, null);
      res.json({ ok: true });
    } catch (e) { console.error('branch delete:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });

  // Move students (with everything that belongs to them: fees, attendance, marks) to another branch.
  app.post('/api/branches/move-students', async (req, res) => {
    try {
      const scope = await groupAdmin(req, res); if (!scope) return;
      if (!scope.multi) return res.status(400).json({ error: 'Add a second branch first.' });
      const b = req.body || {};
      const to = String(b.toBranch || '');
      const ids = Array.isArray(b.studentIds) ? b.studentIds.map(String).filter(Boolean) : [];
      const target = scope.branches.find(x => x.id === to);
      if (!target) return res.status(400).json({ error: 'Choose the branch to move them to.' });
      if (!ids.length) return res.status(400).json({ error: 'Choose at least one student.' });
      if (ids.length > 3000) return res.status(400).json({ error: 'Move at most 3000 students at a time.' });
      let moved = 0;
      for (let i = 0; i < ids.length; i += 400) {
        const chunk = ids.slice(i, i + 400);
        const ph = chunk.map((_, k) => '$' + (k + 2)).join(',');
        const r = await sql.query(`UPDATE students SET branch_id = $1 WHERE id IN (${ph})`, [to, ...chunk]);
        moved += Number((r && (r.affectedRows ?? r.rowCount)) || 0);
        for (const t of ['payments', 'student_discounts', 'student_extra_fees', 'fee_year_history', 'attendance_records', 'exam_results']) {
          await sql.query(`UPDATE ${t} SET branch_id = $1 WHERE student_id IN (${ph})`, [to, ...chunk]);
        }
        // Hall-ticket numbers keep the student id inside the record, not in a column of its own.
        try { await sql.query(`UPDATE exam_hall_tickets SET branch_id = $1 WHERE JSON_UNQUOTE(JSON_EXTRACT(extra, '$.studentId')) IN (${ph})`, [to, ...chunk]); } catch (e) { console.error('move hall tickets:', e.message); }
      }
      ctx.auditNote(req.authUser.name, req.authUser.role, 'MOVE', 'branches', to, 'moved ' + ids.length + ' student(s) to ' + target.name, null);
      res.json({ ok: true, moved: ids.length, toName: target.name });
    } catch (e) { console.error('move students:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });

  app.post('/api/branches/switch', async (req, res) => {
    try {
      if (!authed(req, res)) return;
      const scope = await resolveScope(req);
      if (!scope.multi) return res.status(400).json({ error: 'There is only one branch.' });
      if (!scope.groupLevel) return res.status(403).json({ error: 'Your account is tied to one branch.' });
      const want = String((req.body && req.body.branchId) || '');
      if (want !== 'all' && !scope.branches.some(b => b.id === want)) return res.status(400).json({ error: 'Unknown branch.' });
      const h = ctx.sessionHash(req);
      if (h) await sql.query('UPDATE sessions SET active_branch = $1 WHERE id = $2', [want, h]);
      res.json({ ok: true, branchId: want });
    } catch (e) { console.error('branch switch:', e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
  });
}

// What /api/me tells the browser about branches.
export async function branchInfoForMe(req) {
  const scope = await resolveScope(req);
  const list = scope.locked ? scope.branches.filter(b => b.id === scope.branchId) : scope.branches;
  const cur = scope.branches.find(b => b.id === scope.branchId);
  return { multi: scope.multi, mainId: scope.mainId, branches: list, branchId: scope.branchId, branchName: scope.all ? 'All branches' : (cur ? cur.name : ''), all: scope.all, locked: scope.locked, groupLevel: scope.groupLevel || !scope.multi };
}
