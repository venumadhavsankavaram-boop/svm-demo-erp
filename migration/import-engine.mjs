// SVM EdTech - Data Migration engine (pure functions, no network, no database).
// Reads what another ERP gave a school (CSV, Excel, or a typed PDF report converted to text),
// guesses which column is which, cleans and checks every row, and produces an import PLAN.
// Nothing here saves anything; import-data.mjs sends the plan to the ERP only after a dry-run is approved.

// ---------- 1. reading files ----------
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = String(text).replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

// rows (array of arrays) -> { headers, records[] }. The header row is the first row that looks like one.
export function tableFromRows(rows) {
  let h = rows.findIndex(r => r.filter(x => String(x).trim()).length >= 3 && r.some(x => /name|admission|adm|roll|class|student/i.test(String(x))));
  if (h < 0) h = 0;
  const headers = rows[h].map(x => String(x ?? '').trim());
  const records = rows.slice(h + 1).map(r => Object.fromEntries(headers.map((k, i) => [k, String(r[i] ?? '').trim()]))).filter(o => Object.values(o).some(Boolean));
  return { headers, records };
}

// ---------- 2. typed PDF report from an old ERP ("Fee Paid, Payable and Due Report", Crystal Reports layout) ----------
// Input is the text from `pdftotext -layout`. Each student row starts with a serial number and a Student ID;
// a long name may wrap onto the next line; "Class : X" lines name the class for the rows below.
export function parseFeeDueReport(text) {
  const out = []; let cls = '', last = null; let grand = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\f/g, '');
    const c = line.match(/^\s*Class\s*:\s*(.+?)\s*$/i);
    if (c) { cls = c[1]; last = null; continue; }
    const g = line.match(/Grand\s*Total:\s*([\d,\s]+)$/i);
    if (g) { const n = g[1].trim().split(/\s+/).map(x => Number(x.replace(/,/g, ''))); grand = { total: n[0], concession: n[1], payable: n[2], paid: n[3], due: n[4] }; continue; }
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(\S+)\s+(.+?)\s+(\d{10})?\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s*$/);
    if (m && /\d/.test(m[2])) {
      last = { serial: Number(m[1]), studentId: m[2], rollNo: m[3], name: m[4].trim().replace(/\s+/g, ' '), contact: m[5] || '',
        totalFee: Number(m[6]), concession: Number(m[7]), payable: Number(m[8]), paid: Number(m[9]), due: Number(m[10]), className: cls };
      out.push(last); continue;
    }
    // wrapped name: a short indented line with letters only, right after a student row
    if (last && /^\s{20,}[A-Za-z .'-]+$/.test(line) && !/Total|Report|Class/i.test(line)) { last.name += ' ' + line.trim().replace(/\s+/g, ' '); continue; }
  }
  return { rows: out, grand };
}

// ---------- 3. guessing columns ----------
// Our field -> words that old ERPs use for it. Matching ignores case, spaces and punctuation.
export const FIELD_SYNONYMS = {
  admissionNo: ['admissionno', 'admno', 'admissionnumber', 'admissionid', 'studentid', 'regno', 'registrationno', 'idno', 'enrollmentno', 'enrolmentno'],
  rollNo: ['rollno', 'rollnumber', 'roll'],
  name: ['name', 'studentname', 'nameofstudent', 'nameofthestudent', 'fullname', 'pupilname'],
  firstName: ['firstname', 'givenname'],
  lastName: ['lastname', 'surname', 'familyname'],
  className: ['class', 'classname', 'std', 'standard', 'grade', 'course', 'classstudying'],
  section: ['section', 'sec', 'division', 'div'],
  gender: ['gender', 'sex'],
  dob: ['dob', 'dateofbirth', 'birthdate', 'birthday'],
  fatherName: ['fathername', 'father', 'nameoffather', 'fathersname'],
  motherName: ['mothername', 'mother', 'nameofmother', 'mothersname'],
  contact: ['contact', 'contactno', 'mobile', 'mobileno', 'phone', 'phoneno', 'parentmobile', 'parentcontact', 'fathermobile', 'whatsapp'],
  email: ['email', 'emailid', 'mail'],
  address: ['address', 'residentialaddress', 'permanentaddress', 'fatheraddress'],
  admDate: ['admissiondate', 'dateofadmission', 'doa', 'admdate', 'dateofjoining'],
  caste: ['caste', 'category', 'castecategory'],
  religion: ['religion'],
  aadhaar: ['aadhaar', 'aadhar', 'aadhaarno', 'aadharno', 'uid'],
  totalFee: ['totalfee', 'totalfees', 'feetotal', 'annualfee'],
  paid: ['paid', 'paidfee', 'feepaid', 'amountpaid', 'received'],
  due: ['due', 'dueamount', 'balance', 'pending', 'outstanding', 'balancefee', 'feedue'],
};
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Returns { map: {header: field|null}, confidence: {header: 0..1}, missing: [required fields not found] }
export function autoMapColumns(headers, required = ['name', 'className']) {
  const map = {}, confidence = {}, used = new Set();
  for (const h of headers) {
    const n = norm(h); let best = null, score = 0;
    for (const [field, words] of Object.entries(FIELD_SYNONYMS)) {
      if (used.has(field)) continue;
      for (const w of words) {
        const s = n === w ? 1 : (n.length > 3 && (n.includes(w) || w.includes(n)) && Math.min(n.length, w.length) / Math.max(n.length, w.length) > 0.6 ? 0.7 : 0);
        if (s > score) { score = s; best = field; }
      }
    }
    if (best && score >= 0.7) { map[h] = best; confidence[h] = score; used.add(best); } else { map[h] = null; confidence[h] = 0; }
  }
  const got = new Set(Object.values(map).filter(Boolean));
  const missing = required.filter(f => !got.has(f) && !(f === 'name' && got.has('firstName')));
  return { map, confidence, missing };
}

// ---------- 4. cleaning ----------
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const ORD = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
// Turns "I STD", "1", "Class 1", "1st", "BABY" into our class names ("1st Class", "Baby Class").
export function normalizeClass(raw, classMap = {}) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (classMap[s]) return classMap[s];
  const t = s.toLowerCase().replace(/\b(std|standard|class|grade)\b/g, '').replace(/[^a-z0-9]/g, ' ').trim();
  if (/^(baby|nursery|pre ?kg|play ?group|pp ?1)$/.test(t)) return 'Baby Class';
  if (/^(lkg|l ?k ?g|pp ?2|junior ?kg)$/.test(t)) return 'LKG';
  if (/^(ukg|u ?k ?g|pp ?3|senior ?kg)$/.test(t)) return 'UKG';
  const d = t.match(/^(\d{1,2})(st|nd|rd|th)?$/);
  if (d && +d[1] >= 1 && +d[1] <= 12) return ORD(+d[1]) + ' Class';
  if (ROMAN[t]) return ORD(ROMAN[t]) + ' Class';
  return s; // unknown: left as given, flagged by validate()
}
export const KNOWN_CLASSES = new Set(['Baby Class', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => ORD(i + 1) + ' Class')]);

export function cleanPhone(p) {
  const d = String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
export function cleanDate(v) {
  const s = String(v || '').trim(); if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); // Indian order: day first
  if (m) { let y = +m[3]; if (y < 100) y += y > 30 ? 1900 : 2000; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
  return '';
}
const titleCase = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
// order: 'surname-first' (RAO SITA -> last "Rao", first "Sita") or 'given-first'. A single word is a first name.
export function splitName(full, order = 'surname-first') {
  const parts = titleCase(String(full || '').trim().replace(/\s+/g, ' ')).split(' ').filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return order === 'surname-first' ? { lastName: parts[0], firstName: parts.slice(1).join(' ') } : { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

// ---------- 5. rows -> student records + problem list ----------
// opts: { map, classMap, nameOrder, defaultSection, existing: [{admissionNo,...}], idPrefix }
export function buildStudents(records, opts = {}) {
  const { map, classMap = {}, nameOrder = 'surname-first', defaultSection = 'A', existing = [], idPrefix = 'stu_mig_' } = opts;
  const inv = {}; for (const [h, f] of Object.entries(map)) if (f) inv[f] = h;
  const get = (r, f) => (inv[f] ? String(r[inv[f]] ?? '').trim() : '');
  const students = [], problems = [];
  const seen = new Map(); const have = new Set(existing.map(e => String(e.admissionNo || '').toLowerCase()).filter(Boolean));
  records.forEach((r, i) => {
    const line = i + 1;
    const nm = get(r, 'name') ? splitName(get(r, 'name'), nameOrder) : { firstName: titleCase(get(r, 'firstName')), lastName: titleCase(get(r, 'lastName')) };
    const className = normalizeClass(get(r, 'className'), classMap);
    const admissionNo = get(r, 'admissionNo');
    const s = {
      id: idPrefix + String(Date.now()).slice(-6) + '_' + String(line).padStart(4, '0'),
      admissionNo, firstName: nm.firstName, lastName: nm.lastName, name: [nm.firstName, nm.lastName].filter(Boolean).join(' '),
      className, section: get(r, 'section').toUpperCase() || defaultSection, status: 'Active',
      gender: /^f/i.test(get(r, 'gender')) ? 'Female' : /^m/i.test(get(r, 'gender')) ? 'Male' : '',
      dob: cleanDate(get(r, 'dob')), rollNo: get(r, 'rollNo'),
      fatherName: titleCase(get(r, 'fatherName')), motherName: titleCase(get(r, 'motherName')),
      contact: cleanPhone(get(r, 'contact')), email: get(r, 'email').toLowerCase(), fatherAddress: get(r, 'address'),
      admDate: cleanDate(get(r, 'admDate')), caste: get(r, 'caste'), religion: get(r, 'religion'), aadhaar: get(r, 'aadhaar').replace(/\D/g, ''),
    };
    s.parent = s.fatherName; s.fatherPhone = s.contact;
    const bad = (level, msg) => problems.push({ line, level, student: s.name || '(no name)', admissionNo, message: msg });
    if (!s.firstName) bad('error', 'No student name.');
    if (!className) bad('error', 'No class.'); else if (!KNOWN_CLASSES.has(className)) bad('warn', `Class "${className}" is not one of the standard class names - add it to the class map or fix after import.`);
    if (!admissionNo) bad('warn', 'No admission number - one will be needed to match fees later.');
    if (get(r, 'contact') && !s.contact) bad('warn', `Phone "${get(r, 'contact')}" is not a valid 10-digit mobile number; left blank.`);
    if (get(r, 'dob') && !s.dob) bad('warn', `Date of birth "${get(r, 'dob')}" not understood; left blank.`);
    if (admissionNo) {
      const k = admissionNo.toLowerCase();
      if (seen.has(k)) bad('error', `Admission number ${admissionNo} is repeated (also on line ${seen.get(k)}).`);
      else seen.set(k, line);
      if (have.has(k)) bad('skip', `Admission number ${admissionNo} already exists in the ERP - skipped, not duplicated.`);
    }
    s._line = line; students.push(s);
  });
  return { students, problems };
}

// Which students can really be imported (no errors, not already present).
export function importable(students, problems) {
  const blocked = new Set(problems.filter(p => p.level === 'error' || p.level === 'skip').map(p => p.line));
  return students.filter(s => !blocked.has(s._line));
}

// ---------- 6. opening fee balances ----------
// feeRows: [{studentId (admission no), name, className, due, paid, totalFee}] -> ERP "Previous Dues (opening balance)" entries.
export function buildOpeningDues(feeRows, studentsByAdmission, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const entries = [], problems = []; let total = 0;
  for (const f of feeRows) {
    if (!(f.due > 0)) continue;
    const st = studentsByAdmission.get(String(f.studentId || '').toLowerCase());
    if (!st) { problems.push({ level: 'error', student: f.name, admissionNo: f.studentId, message: 'No student with this admission number - dues not imported.' }); continue; }
    entries.push({ id: 'sef_ob_mig_' + st.id, studentId: st.id, name: 'Previous Dues (opening balance)', amount: Math.round(f.due), paid: false, date, kind: 'opening', addedBy: 'Data migration' });
    total += Math.round(f.due);
  }
  return { entries, problems, total };
}

// Compares what we read with the totals printed on the old report, so a missed page or row is caught.
export function reconcile(feeRows, grand) {
  if (!grand) return { ok: null, note: 'The report has no grand total to compare with.' };
  const sum = k => feeRows.reduce((a, r) => a + (r[k] || 0), 0);
  const mine = { total: sum('totalFee'), concession: sum('concession'), payable: sum('payable'), paid: sum('paid'), due: sum('due') };
  const diffs = Object.keys(mine).filter(k => mine[k] !== grand[k]).map(k => `${k}: read ${mine[k]}, report says ${grand[k]}`);
  return { ok: diffs.length === 0, mine, grand, diffs };
}
