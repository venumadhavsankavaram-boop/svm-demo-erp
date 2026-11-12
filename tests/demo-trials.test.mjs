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
  const b = server.slice(i, i + 400); assert.ok(b.includes("'DELETE'") && /password\|reset/.test(b) && b.includes('403'));
});
test('trials survive the nightly reload and keep their own table', () => {
  assert.ok(server.includes('CREATE TABLE IF NOT EXISTS demo_trials'));
  assert.ok(/await markSeeded\(\);\s*await demoTrialsRestore\(\);/.test(server));
  assert.ok(!/DELETE FROM demo_trials/.test(rd('demo/seed-demo.mjs')));
});
test('passwords are stored only as hashes and only offered Admin, Principal, Accountant, Office Assistant and Parent', () => {
  assert.ok(server.includes('pass_hash') && !/password VARCHAR|plain/i.test(server.slice(server.indexOf('CREATE TABLE IF NOT EXISTS demo_trials'), server.indexOf('CREATE TABLE IF NOT EXISTS demo_trials') + 700)));
  assert.ok(server.includes("'Office Assistant': 'demo.office'") && !/DEMO_TRIAL_TEMPLATES = \{[^}]*Teacher/.test(server));
});
done('demo-trials');
