// Demo trial logins (demo install only).   Run:  node tests/demo-trials.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, done } from './helpers.mjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const server = rd('server.js');
test('every trial route is owner-only and does nothing outside demo mode', () => {
  const g = server.indexOf('const demoOwnerOnly'); assert.ok(g > 0);
  const body = server.slice(g, g + 600);
  assert.ok(body.includes('!DEMO_MODE') && body.includes('404') && body.includes("role !== 'Admin'") && body.includes('demoIsTrial') && body.includes('impersonatedBy'));
  for (const r of ["app.get('/api/demo/trials'", "app.post('/api/demo/trials'", "'/api/demo/trials/:id/extend'", "'/api/demo/trials/:id/revoke'", "'/api/demo/trials/:id/password'", "app.delete('/api/demo/trials/:id'", "'/api/demo/public-logins'"]) { const i = server.indexOf(r); assert.ok(i > 0, r); assert.ok(server.slice(i, i + 200).includes('demoOwnerOnly'), r); }
});
test('trial routes sit before the page catch-all so they are reachable', () => {
  assert.ok(server.indexOf("app.get('/api/demo/trials'") < server.indexOf('app.get(/.*/, (req, res) => {'));
});
test('an ended or switched-off trial cannot sign in and is signed out on its next request', () => {
  assert.ok(/demoTrialEnded\(user\.id\)/.test(server) && /demoTrialEnded\(session\.user_id\)/.test(server));
  assert.ok(/function demoTrialEnded[\s\S]{0,200}t\.revoked \|\| t\.exp < Date\.now\(\)/.test(server));
});
test('trial logins cannot delete users or change passwords of the shared demo accounts', () => {
  const i = server.indexOf('demoIsTrial(session.user_id)'); assert.ok(i > 0);
  const b = server.slice(i, i + 1600);
  assert.ok(b.includes("req.method !== 'GET'") && /password\|reset/.test(b) && b.includes('403') && b.includes('audit-log'));
  assert.ok(b.includes("u_demo_owner") && b.includes('DEMO_OWNER_USERNAME'), 'the owner login must be hidden from trial users');
});
test('trials survive the nightly reload and keep their own table', () => {
  assert.ok(server.includes('CREATE TABLE IF NOT EXISTS demo_trials'));
  assert.ok(/await markSeeded\(\);\s*await demoTrialsRestore\(\);/.test(server));
  assert.ok(!/DELETE FROM demo_trials/.test(rd('demo/seed-demo.mjs')));
});
test('passwords are stored only as hashes and offered for every role, with an All-roles option', () => {
  assert.ok(server.includes('pass_hash') && !/password VARCHAR|plain/i.test(server.slice(server.indexOf('CREATE TABLE IF NOT EXISTS demo_trials'), server.indexOf('CREATE TABLE IF NOT EXISTS demo_trials') + 700)));
  assert.ok(server.includes("'Office Assistant': 'demo.office'") && /DEMO_TRIAL_TEMPLATES = \{[^}]*'Teacher': 'demo.teacher'[^}]*'Student': 'demo.student'/.test(server));
  assert.ok(server.includes("role === 'All'") && server.includes('DEMO_ROLE_SLUG'));
});
test('a trial can be limited to chosen modules, enforced on the server, and can have no end date', () => {
  assert.ok(server.includes('function planAccessFor') && /checkPlanModuleAccess[\s\S]{0,400}planAccessFor\(req\.authUser\)/.test(server), 'the module gate must read the per-login plan');
  assert.ok((server.match(/shaped\.moduleAccess = planAccessFor\(/g) || []).length === 2, 'sign-in and /api/me must both send the per-login plan');
  assert.ok(server.includes('ADD COLUMN modules') && server.includes("'/api/demo/trials/:id/modules'") && server.slice(server.indexOf("'/api/demo/trials/:id/modules'"), server.indexOf("'/api/demo/trials/:id/modules'") + 200).includes('demoOwnerOnly'));
  const k = server.match(/DEMO_MODULE_BUCKETS = \{([^}]*)\}/)[1]; const v = rd('vendor-reporting.js').match(/PLAN_MODULE_TO_ERP_KEYS = \{([\s\S]*?)\n\};/)[1];
  const names = x => Array.from(x.matchAll(/(\w+):\s*\[([^\]]*)\]/g)).map(m => m[1] + ':' + m[2].replace(/\s/g, '')).filter(x => !x.startsWith('transport_library')).sort().join('|');
  assert.equal(names(k), names(v), 'the trial module groups must match the plan groups used for real schools');
  assert.ok(server.includes('DEMO_NO_EXPIRY') && /noExpiry: ms >= Date\.UTC\(2099/.test(server));
});
test('Demo Trials screen offers module tick boxes and an open-ended option', () => {
  const ui = rd('public/modules/78-demo-trials.js');
  assert.ok(ui.includes('class="dtMod"') && ui.includes('modules: Array.from') && ui.includes('No end date') && ui.includes("data-a=\"mods\""));
});
test('parent fees page does not say online payment is missing when UPI is on', () => {
  const f = rd('public/modules/25-student-parent-portal-intro.js');
  assert.ok(f.includes('upiAvailable') && f.includes('(!onlinePaymentAvailable && !upiAvailable)'));
});
done('demo-trials');
