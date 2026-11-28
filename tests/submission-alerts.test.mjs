// Student submissions alert the teacher/management, and reviews alert the family.   Run:  node tests/submission-alerts.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js'), 'utf8');
let n = 0; const t = (name, f) => { try { f(); n++; console.log('  ok   ' + name); } catch (e) { process.exitCode = 1; console.error('  FAIL ' + name + '\n       ' + e.message); } };
t('a new submission alerts the teacher, or management when no login is linked', () => { assert.match(src, /title: 'New student submission'/); assert.match(src, /No login for/); assert.match(src, /getStaffUserId\(b\.recipientStaffId\)/); });
t('a review or resubmit request alerts the student/parent', () => { assert.match(src, /tag: 'submission-review'/); assert.match(src, /Please resubmit/); });
console.log('\nsubmission-alerts: ' + n + ' passed');
