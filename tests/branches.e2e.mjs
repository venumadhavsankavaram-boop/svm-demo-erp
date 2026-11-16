// Multi-branch screens. Run: BASE=http://127.0.0.1:4043 node branches.e2e.mjs
import assert from 'node:assert/strict';
let chromium; try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
const B = process.env.BASE || 'http://127.0.0.1:4043';
let n = 0; const ok = m => console.log('  ok   ' + (++n) + '. ' + m);
const uid = Math.random().toString(36).slice(2, 6);
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1400, height: 1000 } }); const pg = await ctx.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
const login = async (page, u, p) => { await page.goto(B + '/'); await page.fill('#loginUsername', u); await page.fill('#loginPassword', p); await page.keyboard.press('Enter'); await page.waitForSelector('#sbUserName', { state: 'visible', timeout: 25000 }); await page.waitForFunction(() => typeof branchState === 'function' && branchState().loaded, null, { timeout: 15000 }); };
const api = (page, method, path, body) => page.evaluate(async ([m, p, b]) => { const r = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (_) {} return { s: r.status, j }; }, [method, path, body]);
try {
  await login(pg, 'demo.admin', 'Demo@123');
  assert.equal(await pg.locator('#branchBar').count(), 0); ok('One branch: no branch bar, the app looks exactly as before');
  assert.equal(await pg.evaluate(() => getComputedStyle(document.getElementById('brMenuBtn')).display !== 'none'), true); ok('Admin gets "Branches" in the account menu');
  const baseStudents = await pg.evaluate(() => students.length);
  // make a student in main to move later
  const sid = 'mv_' + uid;
  const mk = await api(pg, 'POST', '/api/students', { id: sid, firstName: 'Mover' + uid, lastName: 'Kid', className: '5th Class', section: 'A', status: 'Active', admissionNo: 'MV-' + uid });
  assert.equal(mk.s, 201);
  await pg.evaluate(() => openBranchManager()); await pg.waitForSelector('#brName');
  await pg.fill('#brName', 'North Campus ' + uid); await pg.fill('#brCode', 'N' + uid.toUpperCase()); await pg.fill('#brAddress', 'Plot 5, North Road');
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.click('#brSaveBtn')]);
  await pg.waitForSelector('#branchBar select', { timeout: 25000 });
  ok('Adding the second branch turns on multi-branch: the bar with the switcher appears');
  const opts = await pg.$$eval('#brSel option', os => os.map(o => o.textContent));
  assert.ok(opts.some(t => /North Campus/.test(t)) && opts.some(t => /All branches/.test(t))); ok('Switcher lists both branches and "All branches"');
  assert.equal(await pg.evaluate(() => students.length), baseStudents + 1); ok('Main branch still holds every existing student');
  // switch to the new branch
  const nid = await pg.evaluate(() => branchState().branches.find(b => /North Campus/.test(b.name)).id);
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.selectOption('#brSel', nid)]);
  await pg.waitForSelector('#branchBar select'); await pg.waitForFunction(() => typeof students !== 'undefined');
  assert.equal(await pg.evaluate(() => students.length), 0); ok('The new branch starts empty after switching');
  assert.equal(await pg.$eval('#brSel', s => s.selectedOptions[0].textContent.includes('North Campus')), true); ok('Switcher remembers the chosen branch after reload');
  // move a student in from main
  const mainId = await pg.evaluate(() => branchState().mainId);
  // in a single-branch view only that branch's students are loaded, so switch back to main to pick from it
  await pg.evaluate(() => closeBranchManager());
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.selectOption('#brSel', mainId)]);
  await pg.waitForSelector('#branchBar select');
  await pg.evaluate(() => openBranchManager()); await pg.waitForSelector('#mvFrom');
  await pg.fill('#mvQ', 'Mover' + uid); await pg.waitForTimeout(600);
  await pg.check('#mvList input[type=checkbox] >> nth=0');
  await pg.selectOption('#mvTo', nid);
  await pg.click('#mvGo'); await pg.waitForSelector('#confirmDialogOkBtn', { state: 'visible' });
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.click('#confirmDialogOkBtn')]);
  await pg.waitForSelector('#branchBar select'); await pg.waitForFunction(() => typeof students !== 'undefined');
  assert.equal(await pg.evaluate((id) => students.some(s => s.id === id), sid), false); ok('Moved student is gone from the main branch');
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.selectOption('#brSel', nid)]);
  await pg.waitForSelector('#branchBar select'); await pg.waitForFunction(() => typeof students !== 'undefined');
  assert.equal(await pg.evaluate((id) => students.some(s => s.id === id), sid), true); ok('...and appears in the new branch');
  // all branches
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.selectOption('#brSel', 'all')]);
  await pg.waitForSelector('#branchBar.br-all'); await pg.waitForFunction(() => typeof students !== 'undefined');
  assert.match(await pg.innerText('#branchBar'), /read only|cannot be added/i); ok('All-branches view shows a read-only notice');
  assert.equal(await pg.evaluate(() => students.length), baseStudents + 1); ok('All-branches view lists every student');
  assert.equal(await pg.evaluate((id) => branchLabelFor(students.find(s => s.id === id)), sid).then(x => /North Campus/.test(x)), true); ok('Each student is tagged with its branch');
  const rr = await api(pg, 'POST', '/api/students', { id: 'x_' + uid, firstName: 'No', lastName: 'Write', className: '5th Class', section: 'A', status: 'Active' });
  assert.equal(rr.s, 400); ok('Adding a record in the all-branches view is refused with a clear message');
  // user form shows the branch choice
  await Promise.all([pg.waitForNavigation({ timeout: 20000 }), pg.selectOption('#brSel', nid)]);
  await pg.waitForSelector('#branchBar select');
  await pg.evaluate(() => { switchView('usersroles'); }); await pg.waitForSelector('#urxURows');
  await pg.evaluate(() => openUserModal(undefined, undefined, undefined, 'staff'));
  assert.equal(await pg.isVisible('#uBranchField'), true); assert.equal(await pg.inputValue('#uBranch'), nid); ok('Add-user form offers a Branch, defaulting to the branch being worked in');
  await pg.fill('#uName', 'Branch Clerk ' + uid); await pg.fill('#uUsername', 'clerk' + uid); await pg.fill('#uPassword', 'Cl3rk#Pass' + uid); await pg.selectOption('#uRole', 'Accountant');
  await pg.click('#userForm button[type=submit]'); await pg.waitForTimeout(2000);
  const mine = await api(pg, 'GET', '/api/users'); const cu = mine.j.find(u => u.username === 'clerk' + uid);
  assert.ok(cu && cu.branchId === nid); ok('The new login is saved against the branch');
  await pg.evaluate(() => switchView('usersroles')); await pg.waitForTimeout(800);
  assert.match(await pg.innerText('#urxURows'), /North Campus/); ok('Users & Roles shows each login\'s branch');
  // the branch login
  const ctx2 = await br.newContext({ viewport: { width: 1400, height: 1000 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(String(e)));
  await login(p2, 'clerk' + uid, 'Cl3rk#Pass' + uid);
  assert.equal(await p2.locator('#branchBar select').count(), 0); assert.match(await p2.innerText('#branchBar'), /North Campus/); ok('A branch login sees its branch name, with no way to switch');
  assert.equal(await p2.evaluate(() => students.length), 1); ok('...and only that branch\'s students');
  assert.equal(await p2.evaluate(() => getComputedStyle(document.getElementById('brMenuBtn')).display === 'none'), true); ok('...and cannot open the Branches manager');
  assert.deepEqual(errs, [], errs.join('|')); ok('No page errors');
  console.log('ALL PASSED (' + n + ') NID=' + nid);
} catch (e) { console.error('FAIL', e.message); await pg.screenshot({ path: '/tmp/rv/t17/fail.png' }); process.exitCode = 1; } finally { await br.close(); }
