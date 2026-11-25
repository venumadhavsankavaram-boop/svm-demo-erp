// SVM EdTech - bring a school's old ERP data into this ERP.
//
//   node migration/import-data.mjs --students old-students.xlsx|.csv   [--base=http://127.0.0.1:3000] [--apply]
//   node migration/import-data.mjs --feedue   Fee_Due_List.txt         [--base=...] [--apply]
//        (Fee_Due_List.txt = the old ERP's PDF report turned into text:  pdftotext -layout report.pdf report.txt)
//
// SAFE BY DEFAULT: without --apply it only READS and REPORTS (a dry run) - nothing is saved.
// Login: env IMPORT_USER / IMPORT_PASS (an Admin login of the school's ERP). Optional: --class-map=map.json,
//        --name-order=given-first (default surname-first), --default-section=A, --report=report.json
import fs from 'node:fs';
import {
  parseCsv, tableFromRows, parseFeeDueReport, autoMapColumns, buildStudents, importable, buildOpeningDues, reconcile, normalizeClass,
} from './import-engine.mjs';

const arg = k => {
  const eq = process.argv.find(a => a.startsWith('--' + k + '='));
  if (eq) return eq.slice(k.length + 3);
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const has = k => process.argv.includes('--' + k);
const BASE = arg('base') || 'http://127.0.0.1:3000';
const APPLY = has('apply');
const classMap = arg('class-map') ? JSON.parse(fs.readFileSync(arg('class-map'), 'utf8')) : {};
const nameOrder = arg('name-order') || 'surname-first';
const defaultSection = arg('default-section') || 'A';

async function readTable(file) {
  if (/\.csv$/i.test(file)) return tableFromRows(parseCsv(fs.readFileSync(file, 'utf8')));
  if (/\.xlsx?$/i.test(file)) {
    let XLSX; try { XLSX = (await import('xlsx')).default; } catch { throw new Error('Reading Excel needs the "xlsx" package: run  npm install xlsx  once, or save the sheet as CSV.'); }
    const wb = XLSX.readFile(file); const ws = wb.Sheets[wb.SheetNames[0]];
    return tableFromRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }));
  }
  throw new Error('Give a .csv or .xlsx file (PDF reports: convert with pdftotext -layout first, then use --feedue).');
}

let cookie = '';
async function api(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
let token = '';
async function login() {
  const u = process.env.IMPORT_USER, p = process.env.IMPORT_PASS;
  if (!u || !p) throw new Error('Set IMPORT_USER and IMPORT_PASS (an Admin login of this ERP) to read existing students or to use --apply.');
  const res = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, audience: 'staff' }) });
  if (!res.ok) throw new Error('Login failed (' + res.status + ').');
  const j = await res.json().catch(() => ({})); token = j.token || '';
  cookie = (res.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
}
async function pool(items, fn, n = 4) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } })); }

function show(problems) {
  const by = { error: [], warn: [], skip: [] }; problems.forEach(p => (by[p.level] || by.warn).push(p));
  for (const [lv, label] of [['error', 'ERRORS (these rows will NOT be imported)'], ['skip', 'ALREADY IN THE ERP (skipped)'], ['warn', 'WARNINGS (imported, please review)']]) {
    if (!by[lv].length) continue;
    console.log(`\n${label}: ${by[lv].length}`);
    by[lv].slice(0, 15).forEach(p => console.log(`  line ${p.line ?? '-'}  ${p.student} ${p.admissionNo ? '(' + p.admissionNo + ')' : ''}: ${p.message}`));
    if (by[lv].length > 15) console.log(`  ... and ${by[lv].length - 15} more (full list in the report file)`);
  }
}

async function existingStudents() {
  try { await login(); return (await api('GET', '/api/students')) || []; } catch (e) { if (APPLY) throw e; console.log('(Not logged in - cannot check for students already in the ERP: ' + e.message.split('.')[0] + ')'); return []; }
}

async function doStudents(file) {
  const { headers, records } = await readTable(file);
  const m = autoMapColumns(headers);
  console.log(`Read ${records.length} rows. Column guesses:`);
  headers.forEach(h => console.log(`  ${h.padEnd(28)} -> ${m.map[h] || '(ignored)'}`));
  if (m.missing.length) throw new Error('Could not find a column for: ' + m.missing.join(', ') + '. Rename the column in the sheet and run again.');
  const existing = await existingStudents();
  const { students, problems } = buildStudents(records, { map: m.map, classMap, nameOrder, defaultSection, existing });
  const ok = importable(students, problems);
  show(problems);
  const perClass = {}; ok.forEach(s => { perClass[s.className] = (perClass[s.className] || 0) + 1; });
  console.log(`\nReady to import: ${ok.length} of ${students.length} students.`); console.log(perClass);
  if (arg('report')) fs.writeFileSync(arg('report'), JSON.stringify({ problems, perClass }, null, 1));
  if (!APPLY) return console.log('\nDRY RUN - nothing was saved. Add --apply to import.');
  await pool(ok, s => { const { _line, ...rec } = s; return api('POST', '/api/students', rec); });
  console.log(`\nImported ${ok.length} students.`);
}

async function doFeeDue(file) {
  const { rows, grand } = parseFeeDueReport(fs.readFileSync(file, 'utf8'));
  console.log(`Read ${rows.length} students from the fee report.`);
  const rc = reconcile(rows, grand);
  console.log(rc.ok === null ? rc.note : rc.ok ? 'CHECK PASSED: totals match the old report exactly.' : 'CHECK FAILED - totals differ from the old report:\n  ' + rc.diffs.join('\n  '));
  if (rc.ok === false) throw new Error('Fix the reading problem before importing dues.');
  const existing = await existingStudents();
  const byAdm = new Map(existing.map(s => [String(s.admissionNo || '').toLowerCase(), s]));
  if (!existing.length) {
    const owing = rows.filter(r => r.due > 0);
    console.log(`\nReading check only: ${owing.length} students owe a total of Rs ${owing.reduce((a, r) => a + r.due, 0).toLocaleString('en-IN')}.`);
    console.log('To match these to students in the ERP, set IMPORT_USER / IMPORT_PASS (and import the students first).');
    return;
  }
  const { entries, problems, total } = buildOpeningDues(rows, byAdm);
  show(problems);
  console.log(`\nOpening dues to add: ${entries.length} students, total Rs ${total.toLocaleString('en-IN')} (report total due: Rs ${grand?.due?.toLocaleString('en-IN')}).`);
  if (!APPLY) return console.log('\nDRY RUN - nothing was saved. Import the students first, then run this with --apply.');
  await pool(entries, e => api('POST', '/api/extra-fees', e));
  console.log(`\nAdded ${entries.length} opening balances.`);
}

try {
  if (arg('students')) await doStudents(arg('students'));
  else if (arg('feedue')) await doFeeDue(arg('feedue'));
  else console.log('Use --students <file> or --feedue <report.txt>. See the comment at the top of this file.');
} catch (e) { console.error('\nStopped: ' + e.message); process.exit(1); }
