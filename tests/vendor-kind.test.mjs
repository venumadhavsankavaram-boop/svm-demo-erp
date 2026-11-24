// The ERP tells the vendor dashboard what kind of institute it is (school, junior_college, degree_college) with every heartbeat.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, done } from './helpers.mjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vr = fs.readFileSync(path.join(root, 'vendor-reporting.js'), 'utf8'), srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
test('the heartbeat carries the kind, only ever one of the three known values', () => {
  assert.ok(/export function setKindReporter/.test(vr));
  assert.ok(/\['school', 'junior_college', 'degree_college'\]\.includes\(k\)/.test(vr));
  assert.ok(/meta: \{\s*activeStudents,\s*kind,/.test(vr));
});
test('server.js reports school unless the College Pack is on, then junior or degree college', () => {
  assert.ok(/setKindReporter\(async \(\) => \{\s*if \(process\.env\.COLLEGE_PACK !== 'true'\) return 'school';/.test(srv));
  assert.ok(/junior_college\|degree_college/.test(srv));
});
done('vendor-kind');
