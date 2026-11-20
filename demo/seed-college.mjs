// Demo JUNIOR COLLEGE sample data  —  node demo/seed-college.mjs [--base=http://127.0.0.1:3000]
//
// Used only when the server runs with DEMO_MODE=true AND COLLEGE_PACK=true (the separate college demo).
// Fills a DEMO database with a fictional junior college ("Demo Junior College"): 1st and 2nd Year,
// MPC / BiPC / CEC / HEC, lecturers, students, fees, attendance (with a few students absent several days),
// unit tests / quarterly / grand test with marks and ranks, programme tags, scholarships, board hall tickets and
// released results, practical batches, notices and one login per role.
// It saves through the ERP's own API (same validation, same record formats as the app).
//
// SAFETY: this script WIPES the database it is pointed at. It refuses to run unless
//   1. env DEMO_MODE=true, and
//   2. the database is empty, or already holds a demo (this college, or "Demo School").
// A real school's database can therefore never be wiped by mistake.
import bcrypt from 'bcryptjs';
import { sql, closePool } from '../db.js';

const DEMO_NAME = 'Demo Junior College';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123';
const BASE = (process.argv.find(a => a.startsWith('--base=')) || '').slice(7) || `http://127.0.0.1:${process.env.PORT || 3000}`;
const SEED_USER = 'zz_demo_seeder';

let _s = 20260702;
const rnd = () => { _s = (_s * 1664525 + 1013904223) % 4294967296; return _s / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

const MALE = ['Aarav','Vihaan','Arjun','Sai','Krishna','Rohan','Aditya','Ishaan','Karthik','Rahul','Varun','Pranav','Harsha','Manoj','Nikhil','Charan','Teja','Ravi','Sandeep','Ajay'];
const FEMALE = ['Ananya','Diya','Sneha','Priya','Lakshmi','Meera','Kavya','Navya','Pooja','Harini','Divya','Sahana','Tanvi','Bhavana','Swathi','Anika','Ishita','Mounika','Sravani','Keerthi'];
const SURNAMES = ['Reddy','Rao','Naidu','Sharma','Kumar','Varma','Patel','Singh','Chowdary','Raju','Prasad','Goud','Yadav','Das','Menon'];
const FATHERS = ['Ramesh','Suresh','Venkatesh','Srinivas','Mahesh','Naresh','Ganesh','Prakash','Anil','Satish','Vijay','Kiran'];
const MOTHERS = ['Sita','Latha','Padma','Radha','Sunitha','Anitha','Vani','Jyothi','Rekha','Usha','Swapna','Geetha'];

const YEARS = ['1st Year', '2nd Year'];
const COMBOS = [
  { id: 'cmb_MPC', stream: 'Science', name: 'MPC', seats: [40, 40], count: [37, 34], subjects: ['English', 'Second Language', 'Mathematics A', 'Mathematics B', 'Physics', 'Chemistry', 'Physics Practical', 'Chemistry Practical'] },
  { id: 'cmb_BiPC', stream: 'Science', name: 'BiPC', seats: [40, 40], count: [32, 30], subjects: ['English', 'Second Language', 'Botany', 'Zoology', 'Physics', 'Chemistry', 'Botany Practical', 'Zoology Practical', 'Physics Practical', 'Chemistry Practical'] },
  { id: 'cmb_CEC', stream: 'Commerce', name: 'CEC', seats: [30, 30], count: [20, 18], subjects: ['English', 'Second Language', 'Civics', 'Economics', 'Commerce'] },
  { id: 'cmb_HEC', stream: 'Arts', name: 'HEC', seats: [20, 20], count: [12, 10], subjects: ['English', 'Second Language', 'History', 'Economics', 'Civics'] },
];
const FEE = { '1st Year': 30000, '2nd Year': 28000 }, ADMISSION = 2000;
const isPractical = n => /practical/i.test(n);

const EXAM_TYPES = [
  ['Unit Test', 'formative', YEARS], ['Weekly Test', 'formative', YEARS], ['Grand Test (Mock)', 'internal', YEARS],
  ['Quarterly Exam', 'summative', YEARS], ['Half-Yearly Exam', 'summative', YEARS], ['Annual Exam', 'summative', ['1st Year']],
  ['Pre-final Exam', 'internal', ['2nd Year']], ['Practical (Internal)', 'internal', YEARS],
].map(([name, group, scopeClasses], i) => ({ id: 'etype_clg_' + i, name, group, scopeClasses }));

const today = new Date();
const isoDay = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
const daysAhead = n => daysAgo(-n);

const doFetch = globalThis.__demoFetch || fetch;
let cookie = '';
async function api(method, path, body, { allow = [] } = {}) {
  const res = await doFetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Actor-Name': 'Demo%20Seeder', 'X-Actor-Role': 'Admin' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok && !allow.includes(res.status)) { const t = await res.text().catch(() => ''); throw new Error(`${method} ${path} -> ${res.status} ${t.slice(0, 160)}`); }
  return res;
}
async function pool(items, fn, width = 8) {
  let i = 0, failed = 0, firstErr = null;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; try { await fn(it); } catch (e) { failed++; if (!firstErr) firstErr = e; } }
  }));
  if (failed) console.warn(`  ! ${failed} of ${items.length} failed — first error: ${firstErr.message}`);
  return failed;
}

async function safetyCheckAndWipe() {
  if (process.env.DEMO_MODE !== 'true') throw new Error('Refusing to run: DEMO_MODE is not "true".');
  const info = await sql`SELECT data FROM school_info WHERE id = 1`;
  const nStudents = (await sql`SELECT COUNT(*) AS n FROM students`)[0].n;
  let name = '';
  if (info.length) { try { name = (typeof info[0].data === 'string' ? JSON.parse(info[0].data) : info[0].data).name || ''; } catch (e) {} }
  const isDemo = [DEMO_NAME, 'Demo School', 'Sunrise Public School'].includes(name);
  if (!isDemo && Number(nStudents) > 0) throw new Error(`Refusing to wipe: this database holds "${name || 'a school'}" with ${nStudents} students, not a demo.`);
  console.log('Wiping demo tables…');
  const tables = ['students','staff','staff_payroll','payments','student_discounts','student_extra_fees','attendance_records','holidays','exam_results','staff_attendance_records','acct_income','acct_expenses','comms_messages','subjects','exam_defs','admission_inquiries','website_gallery','user_notifications','notification_events','audit_log','deletion_requests','sessions','doc_counters','kv_store'];
  for (const t of tables) { try { await sql.query(`DELETE FROM ${t}`); } catch (e) { console.warn(`  (skip ${t}: ${e.message.slice(0, 60)})`); } }
  try { await sql.query('DELETE FROM users'); } catch (e) {}
  try { await sql.query('DELETE FROM fee_structure'); } catch (e) {}
  try { await sql.query('DELETE FROM school_info'); } catch (e) {}
}

async function createLogins(students) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mk = (id, name, username, role, linked = '') => sql`
    INSERT INTO users (id, name, username, password, role, linked_student_id, recovery_code)
    VALUES (${id}, ${name}, ${username}, ${hash}, ${role}, ${linked}, ${'DEMO' + id.slice(-4).toUpperCase()})`;
  await sql`INSERT INTO users (id, name, username, password, role, linked_student_id, recovery_code)
    VALUES ('u_seeder', 'Demo Seeder', ${SEED_USER}, ${await bcrypt.hash('seed-' + Math.random(), 10)}, 'Admin', '', 'SEEDER')`;
  await mk('u_demo_admin', 'Demo Admin', 'demo.admin', 'Admin');
  await mk('u_demo_principal', 'Demo Principal', 'demo.principal', 'Principal');
  await mk('u_demo_accountant', 'Demo Accountant', 'demo.accountant', 'Accountant');
  await mk('u_demo_office', 'Demo Office', 'demo.office', 'Office Assistant');
  await mk('u_demo_teacher', 'Demo Lecturer', 'demo.teacher', 'Teacher');
  const s = students.find(x => x.className === '1st Year' && x.section === 'MPC') || students[0];
  await mk('u_demo_parent', `Parent of ${s.firstName}`, 'demo.parent', 'Parent', s.id);
  await mk('u_demo_student', s.name, 'demo.student', 'Student', s.id);
}
async function loginAsSeeder() {
  const pw = 'seed-' + Math.random().toString(36).slice(2) + 'Aa1';
  await sql`UPDATE users SET password = ${await bcrypt.hash(pw, 10)} WHERE id = 'u_seeder'`;
  const res = await doFetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: SEED_USER, password: pw, audience: 'staff' }) });
  if (!res.ok) throw new Error('Seeder login failed: ' + res.status + ' ' + (await res.text()).slice(0, 120));
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  cookie = set.map(c => c.split(';')[0]).join('; ');
}

function buildStudents() {
  const out = []; let n = 0;
  YEARS.forEach((year, yi) => COMBOS.forEach(cb => {
    for (let k = 0; k < cb.count[yi]; k++) {
      n++;
      const male = rnd() < 0.5, first = pick(male ? MALE : FEMALE), last = pick(SURNAMES), father = pick(FATHERS), mother = pick(MOTHERS);
      const dob = new Date(today.getFullYear() - (16 + yi), int(0, 11), int(1, 28));
      const phone = '9' + String(int(100000000, 999999999));
      out.push({
        id: `stu_clg_${pad(n, 4)}`, admissionNo: `JC${pad(26 - yi, 2)}-${pad(n, 3)}`, firstName: first, lastName: last, name: `${first} ${last}`,
        className: year, section: cb.name, status: 'Active', gender: male ? 'Male' : 'Female', dob: isoDay(dob),
        blood: pick(['A+','B+','O+','AB+','O-']), caste: pick(['OC','BC-A','BC-B','SC']), religion: 'Hindu',
        fatherName: `${father} ${last}`, motherName: `${mother} ${last}`, parent: `${father} ${last}`,
        fatherPhone: phone, motherPhone: '9' + String(int(100000000, 999999999)), contact: phone,
        email: `${first}.${last}${n}@example.com`.toLowerCase(), fatherAddress: `${int(1, 99)}-${int(1, 99)}, Main Road, Demo Nagar`,
        admDate: `${2026 - yi}-06-${pad(int(1, 20))}`, needsTransport: 'No',
      });
    }
  }));
  return out;
}
function buildStaff() {
  const rows = [];
  const mk = (i, first, last, gender, dept, desig, jobTypes, salary, extra = {}) => rows.push({
    id: `stf_clg_${pad(i)}`, staffId: `STF2026-${pad(i, 3)}`, firstName: first, lastName: last, gender, department: dept, designation: desig,
    jobTypes, status: 'Active', dob: `${1972 + int(0, 18)}-0${int(1, 9)}-1${int(0, 9)}`, doj: `${2010 + int(0, 14)}-06-01`,
    phone: '9' + String(int(100000000, 999999999)), email: `${first}.${last}@example.com`.toLowerCase(), qualification: pick(['M.Sc, B.Ed','M.A, B.Ed','M.Com','M.Sc','M.Sc, M.Phil']),
    experience: String(int(2, 20)), salary: String(salary), paidLeavesPerMonth: '1', address: `${int(1, 99)}-${int(1, 99)}, Market Street`,
    epfEnabled: false, esiEnabled: false, otherMonthlyDeduction: 0, ...extra,
  });
  mk(1, 'Sunitha', 'Rao', 'Female', 'Administration', 'Principal', ['Administration'], 60000);
  mk(2, 'Ramesh', 'Babu', 'Male', 'Administration', 'Office Assistant', ['Administration'], 20000);
  mk(3, 'Padma', 'Kumari', 'Female', 'Accounts', 'Accountant', ['Administration'], 28000);
  const L = [['Lakshmi','Devi','Female'],['Srinivas','Reddy','Male'],['Anitha','Varma','Female'],['Mahesh','Naidu','Male'],['Jyothi','Sharma','Female'],['Kiran','Kumar','Male'],['Vani','Patel','Female'],['Suresh','Goud','Male'],['Radha','Krishna','Female'],['Naresh','Yadav','Male'],['Swapna','Menon','Female'],['Prakash','Das','Male']];
  L.forEach((n, k) => mk(4 + k, n[0], n[1], n[2], 'Teaching', k < 6 ? 'Junior Lecturer' : 'Senior Lecturer', ['Teaching'], int(30, 55) * 1000));
  mk(20, 'Savitri', 'Bai', 'Female', 'Support', 'Attender', ['Support'], 10000);
  return rows;
}

async function main() {
  await safetyCheckAndWipe();
  const students = buildStudents(), staff = buildStaff();
  await createLogins(students);
  await loginAsSeeder();
  console.log(`Seeding ${students.length} students, ${staff.length} staff via ${BASE}`);

  await api('PUT', '/api/school-info', {
    name: DEMO_NAME, tagline: 'Where careers begin', udise: '', schoolCode: 'DJC001', receiptCode: 'DJC', regNumber: 'DEMO/JC/2026/001',
    recognition: 'Demo junior college — sample data only', email: 'office@demo-college.example.com', phone: '08412345678', whatsapp: '9876500000',
    website: 'www.demo-college.example.com', state: 'Andhra Pradesh', district: 'Demo District', pin: '500001', address: '1-2-3, Demo Nagar, Demo City',
    workingDays: 220, principalName: 'Mrs. Sunitha Rao', logo: '', principalSignature: '', leadership: [],
  });

  // College structure: classes, sections (the combinations), each year's combinations, and the setup card's own settings
  await api('PUT', '/api/kv/class-levels', YEARS);
  await api('PUT', '/api/kv/section-levels', COMBOS.map(c => c.name));
  await api('PUT', '/api/kv/class-section-overrides', { '1st Year': COMBOS.map(c => c.name), '2nd Year': COMBOS.map(c => c.name) });
  await api('PUT', '/api/kv/college-structure', { institutionType: 'junior_college', combos: COMBOS.map(c => ({ id: c.id, stream: c.stream, name: c.name, seats: c.seats, subjects: c.subjects })) });
  const fs = {}; YEARS.forEach(y => { fs[y] = { admission: ADMISSION, fee: FEE[y], bus: 0, stock: 0 }; });
  await api('PUT', '/api/fee-structure', fs);
  await api('PUT', '/api/kv/receipt-settings', { startNumber: 1 });
  await api('PUT', '/api/kv/fee-schedule', { '2026-27': { bus: { due: '', mode: 'yearly' }, fee: { due: '2026-10-31', mode: 'yearly' }, stock: { due: '', mode: 'yearly' }, hostel: { due: '', mode: 'yearly' } } });
  await api('PUT', '/api/kv/exam-types', EXAM_TYPES);

  console.log('Students…'); await pool(students, s => api('POST', '/api/students', s));
  console.log('Staff…'); await pool(staff, s => api('POST', '/api/staff', s));

  // Subjects: one row per year per subject, offered to the combinations that study it
  const lecturers = staff.filter(s => s.department === 'Teaching');
  const subjNames = [...new Set(COMBOS.flatMap(c => c.subjects))];
  const teacherOf = Object.fromEntries(subjNames.map((nm, i) => [nm, lecturers[i % lecturers.length]]));
  const subjectRows = [];
  YEARS.forEach((y, yi) => subjNames.forEach((nm, k) => {
    const sections = COMBOS.filter(c => c.subjects.includes(nm)).map(c => c.name);
    const t = teacherOf[nm];
    subjectRows.push({ id: `msub_clg_${yi}_${k}`, className: y, name: nm, code: nm.slice(0, 3).toUpperCase(), countable: isPractical(nm) ? 0 : 1, elective: 0, sections, staffIds: [t.id], sectionStaff: Object.fromEntries(sections.map(s => [s, [t.id]])) });
  }));
  await pool(subjectRows, s => api('POST', '/api/subjects', s));

  // Exams with marks: Unit Test 1 (both years), Quarterly (both years), Grand Test (2nd Year, for ranks)
  console.log('Exams & marks…');
  const mkExam = (id, name, type, years, startBack, maxMarks) => {
    const classSubjects = {};
    years.forEach(y => COMBOS.forEach(cb => {
      classSubjects[`${y}||${cb.name}`] = cb.subjects.filter(nm => !isPractical(nm)).map((nm, k) => ({ code: nm.slice(0, 3).toUpperCase(), name: nm, maxMarks, internalMax: 0, countable: true, elective: false, date: isoDay(daysAgo(startBack - k)), staffIds: [teacherOf[nm].id] }));
    }));
    return { id, name, examType: type, startDate: isoDay(daysAgo(startBack)), endDate: isoDay(daysAgo(startBack - 5)), classSubjects, years, maxMarks };
  };
  const exams = [mkExam('exam_clg_ut1', 'Unit Test 1', 'Unit Test', YEARS, 60, 50), mkExam('exam_clg_q', 'Quarterly Exam', 'Quarterly Exam', YEARS, 25, 100), mkExam('exam_clg_gt1', 'Grand Test 1', 'Grand Test (Mock)', ['2nd Year'], 10, 100)];
  for (const ex of exams) await api('POST', '/api/exam-defs', { id: ex.id, name: ex.name, examType: ex.examType, startDate: ex.startDate, endDate: ex.endDate, classSubjects: ex.classSubjects });
  const strength = {}; students.forEach(s => { strength[s.id] = 0.4 + rnd() * 0.55; });
  const results = [];
  exams.forEach(ex => students.filter(s => ex.years.includes(s.className)).forEach(s => {
    const cb = COMBOS.find(c => c.name === s.section);
    cb.subjects.filter(nm => !isPractical(nm)).forEach(nm => {
      const m = Math.max(0, Math.min(ex.maxMarks, Math.round(ex.maxMarks * Math.min(1, strength[s.id] + (rnd() - 0.5) * 0.3))));
      results.push({ id: `res_${ex.id}_${s.id}_${nm}`, examId: ex.id, studentId: s.id, subject: nm, marks: m, written: m, internal: 0, absent: false });
    });
  }));
  await pool(results, r => api('POST', '/api/exam-results', r), 12);

  // Fees: admission + a mix of paid in full, part paid, unpaid
  console.log('Fee receipts…');
  const payments = [], modes = ['Cash', 'UPI', 'Cash', 'Bank Transfer'];
  students.forEach((s, i) => {
    const fee = FEE[s.className], r = rnd();
    const mk = (cat, amount, back) => payments.push({ id: `pay_clg_${pad(i, 4)}_${cat}`, receiptNo: '', studentId: s.id, studentName: s.name, category: cat, mode: pick(modes), amount, discount: 0, instalment: '', date: isoDay(daysAgo(back)), note: '', classAtPayment: s.className });
    if (r < 0.92) mk('admission', ADMISSION, int(60, 120));
    if (r < 0.5) mk('fee', fee, int(20, 100)); else if (r < 0.82) mk('fee', Math.round(fee * (0.3 + rnd() * 0.4) / 100) * 100, int(20, 100));
  });
  payments.sort((a, b) => a.date.localeCompare(b.date));
  payments.forEach((p, k) => { p.receiptNo = `DJC-26-${pad(k + 1, 6)}`; });
  await pool(payments, p => api('POST', '/api/payments', p), 4);

  // Attendance: last 15 college days; three 1st Year students absent for the latest 4 days (shows the "absent several days" alert)
  console.log('Attendance…');
  const streakIds = new Set(students.filter(s => s.className === '1st Year').slice(5, 8).map(s => s.id));
  const att = []; let counted = 0;
  for (let back = 1; counted < 15 && back < 40; back++) {
    const d = daysAgo(back); if (d.getDay() === 0) continue; counted++;
    const ds = isoDay(d);
    students.forEach(s => att.push({ id: `att_${s.id}_${ds}_Morning`, studentId: s.id, date: ds, session: 'Morning', status: streakIds.has(s.id) && counted <= 4 ? 'Absent' : (rnd() < 0.94 ? 'Present' : (rnd() < 0.7 ? 'Absent' : 'Leave')) }));
  }
  await pool(att, a => api('POST', '/api/attendance', a), 12);
  const sAtt = [];
  for (let back = 1; back <= 10; back++) { const d = daysAgo(back); if (d.getDay() === 0) continue; const ds = isoDay(d);
    staff.forEach(s => sAtt.push({ id: `satt_${s.id}_${ds}`, staffId: s.id, date: ds, session: 'Morning', status: rnd() < 0.95 ? 'Present' : 'Leave' })); }
  await pool(sAtt, a => api('POST', '/api/staff-attendance', a), 12);

  // College pack data
  console.log('College pack data…');
  const mpc = students.filter(s => s.section === 'MPC'), bipc = students.filter(s => s.section === 'BiPC');
  const by = {};
  students.forEach(s => { by[s.id] = 'Regular'; });
  mpc.forEach((s, k) => { by[s.id] = k % 5 < 2 ? 'IIT-JEE' : (k % 5 === 2 ? 'Foundation' : 'Regular'); });
  bipc.forEach((s, k) => { by[s.id] = k % 2 === 0 ? 'NEET' : (k % 5 === 1 ? 'Foundation' : 'Regular'); });
  await api('PUT', '/api/kv/college-programmes', { list: ['Regular', 'IIT-JEE', 'NEET', 'Foundation'], by });

  const schemes = ['Fee reimbursement (government)', 'Post-matric scholarship', 'Minority scholarship', 'Merit scholarship', 'Management concession'];
  const stat = ['Eligible', 'Applied', 'Approved', 'Received', 'Rejected'];
  const records = students.filter((s, i) => i % 7 === 0).map((s, k) => {
    const status = stat[k % 5], claimed = status === 'Eligible' ? 0 : int(10, 30) * 1000;
    return { id: `sch_clg_${k}`, studentId: s.id, scheme: schemes[k % schemes.length], status, claimed, received: status === 'Received' ? claimed : 0, appliedOn: '', receivedOn: '', note: '' };
  });
  await api('PUT', '/api/kv/college-scholarships', { records });

  const bstudents = {};
  students.forEach((s, i) => {
    const second = s.className === '2nd Year';
    const rec = { ht: '', ticket: 'Pending', res: {} };
    if (second) {
      rec.ht = '2620' + String(100000 + i * 7).slice(-6);
      rec.ticket = ['Downloaded', 'Handed over', 'Handed over', 'Pending', 'Held'][i % 5];
      const outOf = 500, total = Math.round(outOf * Math.min(0.98, strength[s.id] + 0.08));
      rec.res['1st Year'] = { session: 'March 2026', total, outOf, result: total >= 175 ? 'Pass' : 'Fail', backlogs: total >= 175 ? '' : 'Mathematics A' };
    }
    bstudents[s.id] = rec;
  });
  await api('PUT', '/api/kv/college-board', { students: bstudents });

  const batchOf = list => list.map((sid, i) => sid);
  const sec2 = n => students.filter(s => s.className === '2nd Year' && s.section === n).map(s => s.id);
  const batches = []; let bn = 0;
  [['MPC', 'Physics Practical'], ['MPC', 'Chemistry Practical'], ['BiPC', 'Zoology Practical']].forEach(([cb, sub]) => {
    const ids = sec2(cb), size = 20, count = Math.ceil(ids.length / size);
    for (let i = 0; i < count; i++) batches.push({ id: `pb_clg_${bn++}`, year: '2nd Year', combo: cb, subject: sub, name: 'Batch ' + (i + 1), date: isoDay(daysAhead(18 + i)), time: i % 2 ? '2:00 PM' : '9:30 AM', lab: sub.split(' ')[0] + ' Lab', centre: 'Demo Junior College', studentIds: batchOf(ids.slice(i * size, (i + 1) * size)) });
  });
  await api('PUT', '/api/kv/college-practicals', { batches });
  await api('PUT', '/api/kv/college-absence', { days: 3 });

  console.log('Notices…');
  const notices = [
    ['Welcome to the Demo Junior College ERP', 'This is a demonstration system with sample data. Nothing here is real.'],
    ['Quarterly exam results published', 'Quarterly exam results are available in the parent portal.'],
    ['2nd Year practical batches', 'Practical batch lists for Physics, Chemistry and Zoology are ready. Please check your batch and date.'],
    ['Fee reminder', 'Please clear the pending fee before 31 October.'],
  ];
  await pool(notices.map((n, k) => ({ id: `msg_clg_${k}`, title: n[0], body: n[1], type: 'Announcement', channels: ['In-App'], audienceLabel: 'Public website', link: '', sentBy: 'Demo Admin', sentDate: isoDay(daysAgo(k * 3)) })), m => api('POST', '/api/comms-messages', m));

  await sql`DELETE FROM sessions WHERE user_id = 'u_seeder'`;
  await sql`DELETE FROM users WHERE id = 'u_seeder'`;
  console.log('\nDone. Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  ['demo.admin', 'demo.principal', 'demo.accountant', 'demo.office', 'demo.teacher', 'demo.parent', 'demo.student'].forEach(u => console.log('  ' + u));
}

const _run = main();
export const finished = globalThis.__demoFetch
  ? _run
  : _run.then(() => closePool()).catch(async e => { console.error('SEED FAILED:', e.message, e.cause ? '(cause: ' + (e.cause.code || e.cause.message || e.cause) + ')' : ''); try { await closePool(); } catch (x) {} process.exitCode = 1; });
