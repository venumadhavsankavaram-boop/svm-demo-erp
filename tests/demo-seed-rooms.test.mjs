// The demo reset must clear exam rooms, hall tickets and room settings, or re-seeding the fixed room ids fails with "Duplicate entry".
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, done } from './helpers.mjs';
const seed = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'seed-demo.mjs'), 'utf8');
test('demo wipe list covers every table the seed re-creates with fixed ids', () => {
  const wipe = (/const tables = \[([^\]]*)\]/.exec(seed) || [])[1] || '';
  for (const t of ['rooms', 'exam_hall_tickets', 'exam_room_config']) assert.ok(wipe.includes("'" + t + "'"), t + ' is not wiped');
});
done('demo-seed-rooms');
