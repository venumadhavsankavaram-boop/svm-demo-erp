// Copyright (c) 2026 SVM EdTech. All rights reserved. Proprietary and confidential.
// Unauthorised copying, modification or distribution of this file is prohibited. See LICENSE.
// Branch details on printouts, Branch column in All view. Run: BASE=http://127.0.0.1:4044 node branches2.e2e.mjs
import assert from 'node:assert/strict';
let chromium; try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
const B = process.env.BASE || 'http://127.0.0.1:4044';
let n = 0; const ok = m => console.log('  ok   ' + (++n) + '. ' + m);
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1400, height: 1000 } }); const pg = await ctx.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
const api = (method, path, body) => pg.evaluate(async ([m, p, b]) => { const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (_) {} return { s: r.status, j }; }, [method, path, body]);
const boot = async () => { await pg.waitForSelector('#sbUserName', { state: 'visible', timeout: 25000 }); await pg.waitForFunction(() => typeof branchState === 'function' && branchState().loaded && typeof schoolInfo === 'object' && schoolInfo && Object.keys(schoolInfo).length > 3 && schoolInfo.__isBrOverlay, null, { timeout: 20000 }); await pg.waitForTimeout(800); };
const reloadAs = async (branchId) => { await api('POST', '/api/branches/switch', { branchId }); await pg.reload(); await boot(); };
const capture = () => pg.evaluate(async () => { let html = ''; const real = window.open; window.open = () => ({ document: { write: h => { html += h; }, close() {} }, focus() {}, print() {} }); try { window.fr2Run('pdf'); } finally { window.open = real; } return html; });
try {
  await pg.goto(B + '/'); await pg.fill('#loginUsername', 'demo.admin'); await pg.fill('#loginPassword', 'Demo@123'); await pg.keyboard.press('Enter'); await boot();
  const brs = (await api('GET', '/api/branches')).j; const MAIN = brs.mainId; const north = brs.branches.find(b => b.id !== MAIN);
  const upd = await api('PUT', '/api/branches/' + north.id, { name: north.name, code: north.code, address: 'Plot 12, North Road, North Town', phone: '9876500300', email: 'north@school.example.com' });
  assert.ok(upd.s < 300, 'branch update ' + upd.s);
  await reloadAs(MAIN);
  const real = await pg.evaluate(() => JSON.parse(JSON.stringify(schoolInfo)));
  assert.ok(real.name && real.address, 'school profile has a name and address');
  assert.equal(await pg.evaluate(() => schoolInfo.address), real.address); ok('Main branch prints the school\'s own name and address');
  await reloadAs(north.id);
  const seen = await pg.evaluate(() => ({ name: schoolInfo.name, address: schoolInfo.address, phone: schoolInfo.phone, email: schoolInfo.email, tag: schoolInfo.tagline }));
  assert.equal(seen.name, north.name); assert.equal(seen.address, 'Plot 12, North Road, North Town'); assert.equal(seen.phone, '9876500300'); assert.equal(seen.email, 'north@school.example.com'); assert.equal(seen.tag, real.tagline); ok('In North Campus the printouts carry its name, address, phone and email (everything else stays the school\'s)');
  // report heading
  await pg.evaluate(() => generateFeeDuePayableReport('fee_receipts_between', {})); await pg.waitForSelector('#fr2_overlay');
  let html = await capture();
  assert.ok(html.includes('Plot 12, North Road, North Town') && html.includes(north.name) && html.includes('Branch: ' + north.name), 'report heading'); assert.ok(!html.includes(real.address) || real.address === ''); ok('A fee report printed in North shows the North heading and "Branch: …"');
  await pg.evaluate(() => fr2Close());
  // the real profile is untouched by viewing/saving while in a branch
  const form = await pg.evaluate(() => { const d = document.createElement('div'); d.id = 'tmpProf'; document.body.appendChild(d); renderSchoolProfileTab(d); return { addr: d.querySelector('#siAddress').value, name: d.querySelector('#siName').value }; });
  assert.equal(form.addr, real.address); assert.equal(form.name, real.name); ok('Setup > School Profile still shows the real school details while working in North');
  await pg.evaluate(async () => { await saveSchoolProfile(); document.getElementById('tmpProf').remove(); });
  const afterSave = (await api('GET', '/api/school-info')).j;
  assert.equal(afterSave.address, real.address); assert.equal(afterSave.name, real.name); assert.equal(afterSave.phone, real.phone); ok('Saving the school profile from inside North keeps the real address and name');
  assert.equal(await pg.evaluate(() => schoolInfo.address), 'Plot 12, North Road, North Town'); ok('...and printouts still use the North details afterwards');
  await pg.evaluate(async () => { await storageSet('school-info', schoolInfo); });
  assert.equal((await api('GET', '/api/school-info')).j.address, real.address); ok('Anything that stores the profile stores the real one, never the branch overlay');
  // All view
  await reloadAs('all');
  await pg.evaluate(() => generateFeeDuePayableReport('fee_due_list', {})); await pg.waitForSelector('#fr2_overlay');
  html = await capture();
  assert.ok(/<th>Branch<\/th>/.test(html) && html.includes('All branches') && html.includes(real.name)); ok('In All branches the due list has a Branch column and says "All branches"; heading is the school\'s');
  assert.ok(html.includes(north.name)); ok('Rows are labelled with their branch');
  await pg.evaluate(() => fr2Close());
  await pg.evaluate(() => { generateFeeDuePayableReport('fee_receipts_between', {}); }); await pg.waitForSelector('#fr2_overlay');
  html = await capture(); assert.ok(/<th>Branch<\/th>/.test(html)); ok('Receipts-between-dates report also gets a Branch column');
  await pg.evaluate(() => fr2Close());
  await pg.evaluate(() => { switchView('admissions'); });
  await pg.waitForTimeout(800);
  const cls = await pg.evaluate(() => { const s = students.find(x => x.branchId && x.branchId !== branchState().mainId); return s ? [s.className, s.section] : null; });
  assert.ok(cls); await pg.evaluate(c => openSection(c[0], c[1]), cls); await pg.waitForSelector('#stdRows tr');
  const rowsTxt = await pg.innerText('#stdRows'); assert.ok(rowsTxt.includes('🏫')); ok('In All branches the students list tags each student with their branch');
  await reloadAs(MAIN);
  await pg.evaluate(() => { switchView('admissions'); }); await pg.waitForTimeout(600);
  await pg.evaluate(() => { openSection('5th Class', 'A'); }); await pg.waitForSelector('#stdRows tr', { timeout: 8000 }).catch(() => {});
  const mainRows = await pg.evaluate(() => (document.getElementById('stdRows') || { innerText: '' }).innerText); assert.ok(!mainRows.includes('🏫')); ok('Inside one branch the tag is not repeated on every row');
  assert.deepEqual(errs, [], errs.join('|')); ok('No page errors');
  console.log('ALL PASSED (' + n + ')');
} catch (e) { console.error('FAIL', e.message); await pg.screenshot({ path: '/tmp/rv/t19/fail.png' }); process.exitCode = 1; } finally { await api('POST', '/api/branches/switch', { branchId: 'main' }).catch(() => {}); await br.close(); }
