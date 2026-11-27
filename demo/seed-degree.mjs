// Demo DEGREE COLLEGE sample data  —  node demo/seed-degree.mjs [--base=http://127.0.0.1:3000]
//
// Used only when the server runs with DEMO_MODE=true AND COLLEGE_PACK=true (the separate degree college demo).
// Fills a DEMO database with a fictional degree college ("Demo Degree College"): B.Com, B.Sc Computer Science and
// B.A. (HEP) on the 4-year Honours pattern, Years 1 to 4 with semester courses, lecturers, students, fees, attendance
// (some students below 75%), internal and external marks with SGPA / CGPA, fee reimbursement files, internship
// progress, notices and one login per role.
// It saves through the ERP's own API (same validation, same record formats as the app).
//
// SAFETY: this script WIPES the database it is pointed at. It refuses to run unless
//   1. env DEMO_MODE=true, and
//   2. the database is empty, or already holds a demo (this college, or "Demo School").
// A real school's database can therefore never be wiped by mistake.
import bcrypt from 'bcryptjs';
import { sql, closePool } from '../db.js';

const DEMO_NAME = 'Demo Degree College';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123';
const BASE = (process.argv.find(a => a.startsWith('--base=')) || '').slice(7) || `http://127.0.0.1:${process.env.PORT || 3000}`;
const SEED_USER = 'zz_demo_seeder';

let _s = 20260802;
const rnd = () => { _s = (_s * 1664525 + 1013904223) % 4294967296; return _s / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

const MALE = ['Aarav','Vihaan','Arjun','Sai','Krishna','Rohan','Aditya','Ishaan','Karthik','Rahul','Varun','Pranav','Harsha','Manoj','Nikhil','Charan','Teja','Ravi','Sandeep','Ajay'];
const FEMALE = ['Ananya','Diya','Sneha','Priya','Lakshmi','Meera','Kavya','Navya','Pooja','Harini','Divya','Sahana','Tanvi','Bhavana','Swathi','Anika','Ishita','Mounika','Sravani','Keerthi'];
const SURNAMES = ['Reddy','Rao','Naidu','Sharma','Kumar','Varma','Patel','Singh','Chowdary','Raju','Prasad','Goud','Yadav','Das','Menon'];
const FATHERS = ['Ramesh','Suresh','Venkatesh','Srinivas','Mahesh','Naresh','Ganesh','Prakash','Anil','Satish','Vijay','Kiran'];
const MOTHERS = ['Sita','Latha','Padma','Radha','Sunitha','Anitha','Vani','Jyothi','Rekha','Usha','Swapna','Geetha'];


const YEARS = ['Honours Year 1', 'Honours Year 2', 'Honours Year 3', 'Honours Year 4'];
const GRADING = { internalMax: 25, externalMax: 75, passPct: 40, attendanceMin: 75, scale: [
  { min: 90, grade: 'O', points: 10 }, { min: 80, grade: 'A+', points: 9 }, { min: 70, grade: 'A', points: 8 },
  { min: 60, grade: 'B+', points: 7 }, { min: 50, grade: 'B', points: 6 }, { min: 40, grade: 'C', points: 5 }] };
const COMMON = [[1, 'AEC', 'English I', 3], [1, 'AEC', 'Second Language I', 3], [2, 'AEC', 'English II', 3], [2, 'AEC', 'Second Language II', 3], [2, 'VAC', 'Environmental Studies', 2]];
const PROGS = [
  { id: 'prg_bcomgeneral', name: 'B.COM (GENERAL)', full: 'Bachelor of Commerce (General)', stream: 'Commerce', seats: [40, 40, 40, 30], count: [34, 31, 28, 16], lines: COMMON.concat([
    [1, 'Major', 'Financial Accounting', 4], [1, 'Major', 'Business Organisation', 4], [1, 'MDC', 'Computer Fundamentals', 3],
    [2, 'Major', 'Corporate Accounting', 4], [2, 'Major', 'Business Economics', 4], [2, 'SEC', 'Spreadsheet Skills', 2],
    [3, 'Major', 'Cost Accounting', 4], [3, 'Major', 'Business Law', 4], [3, 'Minor', 'Minor Course I', 4],
    [4, 'Major', 'Income Tax', 4], [4, 'Major', 'Auditing', 4], [4, 'Minor', 'Minor Course II', 4],
    [5, 'Major', 'Banking and Insurance', 4], [5, 'Major', 'Financial Management', 4], [5, 'Elective', 'Elective I', 4],
    [6, 'Major', 'Marketing Management', 4], [6, 'Major', 'Entrepreneurship', 4], [6, 'Internship', 'Semester Internship', 4],
    [7, 'Major', 'Advanced Accounting', 4], [7, 'Major', 'Research Methods', 4], [7, 'Elective', 'Elective II', 4],
    [8, 'Major', 'Strategic Management', 4], [8, 'Project', 'Honours Project', 6]]) },
  { id: 'prg_bsccomputersci', name: 'B.SC (COMPUTER SCI)', full: 'Bachelor of Science (Computer Science)', stream: 'Computer', seats: [40, 40, 40, 30], count: [32, 29, 26, 14], lines: COMMON.concat([
    [1, 'Major', 'Programming Fundamentals', 4], [1, 'Practical', 'Programming Lab', 2], [1, 'MDC', 'Digital Literacy', 3],
    [2, 'Major', 'Data Structures', 4], [2, 'Practical', 'Data Structures Lab', 2], [2, 'SEC', 'Web Basics', 2],
    [3, 'Major', 'Database Systems', 4], [3, 'Practical', 'Database Lab', 2], [3, 'Minor', 'Minor Course I', 4],
    [4, 'Major', 'Operating Systems', 4], [4, 'Major', 'Computer Networks', 4], [4, 'Minor', 'Minor Course II', 4],
    [5, 'Major', 'Software Engineering', 4], [5, 'Major', 'Web Technologies', 4], [5, 'Elective', 'Elective I', 4],
    [6, 'Major', 'Data Analytics', 4], [6, 'Major', 'Cloud Computing', 4], [6, 'Internship', 'Semester Internship', 4],
    [7, 'Major', 'Machine Learning Basics', 4], [7, 'Major', 'Research Methods', 4], [7, 'Elective', 'Elective II', 4],
    [8, 'Major', 'Information Security', 4], [8, 'Project', 'Honours Project', 6]]) },
  { id: 'prg_bahep', name: 'B.A. (HEP)', full: 'Bachelor of Arts (History, Economics, Politics)', stream: 'Arts', seats: [40, 40, 40, 30], count: [26, 22, 20, 10], lines: COMMON.concat([
    [1, 'Major', 'History Paper I', 4], [1, 'Major', 'Economics Paper I', 4], [1, 'MDC', 'Digital Literacy', 3],
    [2, 'Major', 'History Paper II', 4], [2, 'Major', 'Economics Paper II', 4], [2, 'SEC', 'Communication Skills', 2],
    [3, 'Major', 'Political Science Paper I', 4], [3, 'Major', 'Indian Economy', 4], [3, 'Minor', 'Minor Course I', 4],
    [4, 'Major', 'Political Science Paper II', 4], [4, 'Major', 'Public Administration', 4], [4, 'Minor', 'Minor Course II', 4],
    [5, 'Major', 'Modern India', 4], [5, 'Major', 'Development Economics', 4], [5, 'Elective', 'Elective I', 4],
    [6, 'Major', 'World Politics', 4], [6, 'Major', 'Social History of Andhra', 4], [6, 'Internship', 'Semester Internship', 4],
    [7, 'Major', 'Public Policy', 4], [7, 'Major', 'Research Methods', 4], [7, 'Elective', 'Elective II', 4],
    [8, 'Major', 'Contemporary Debates', 4], [8, 'Project', 'Honours Project', 6]]) },
];
// Same ids as the app's own course parser (crs_<semester>_<position in the programme>), so the marks line up.
PROGS.forEach(p => { p.courses = p.lines.map((l, i) => ({ id: 'crs_' + l[0] + '_' + (i + 1), sem: l[0], type: l[1], title: l[2], credits: l[3] })); });
const FEE = { 'Honours Year 1': 24000, 'Honours Year 2': 22000, 'Honours Year 3': 22000, 'Honours Year 4': 20000 }, ADMISSION = 2000;
const yearOfSem = sem => Math.ceil(sem / 2);
const ELECTIVE = t => t === 'Minor' || t === 'Elective';

const EXAM_TYPES = [
  ['Internal Assessment', 'internal', YEARS], ['Mid-Semester Exam', 'summative', YEARS], ['Semester End Exam', 'summative', YEARS], ['Practical (Internal)', 'internal', YEARS],
].map(([name, group, scopeClasses], i) => ({ id: 'etype_dgc_' + i, name, group, scopeClasses }));

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
  const isDemo = [DEMO_NAME, 'Demo Junior College', 'Demo School', 'Sunrise Public School'].includes(name);
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
  const s = students.find(x => x.className === 'Honours Year 1') || students[0];
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
  YEARS.forEach((year, yi) => PROGS.forEach(pr => {
    for (let k = 0; k < pr.count[yi]; k++) {
      n++;
      const male = rnd() < 0.5, first = pick(male ? MALE : FEMALE), last = pick(SURNAMES), father = pick(FATHERS), mother = pick(MOTHERS);
      const dob = new Date(today.getFullYear() - (18 + yi), int(0, 11), int(1, 28));
      const phone = '9' + String(int(100000000, 999999999));
      out.push({
        id: `stu_dgc_${pad(n, 4)}`, admissionNo: `DC${pad(26 - yi, 2)}-${pad(n, 3)}`, firstName: first, lastName: last, name: `${first} ${last}`,
        className: year, section: pr.name, status: 'Active', gender: male ? 'Male' : 'Female', dob: isoDay(dob),
        blood: pick(['A+','B+','O+','AB+','O-']), caste: pick(['OC','BC-A','BC-B','SC']), religion: 'Hindu',
        fatherName: `${father} ${last}`, motherName: `${mother} ${last}`, parent: `${father} ${last}`,
        fatherPhone: phone, motherPhone: '9' + String(int(100000000, 999999999)), contact: phone,
        email: `${first}.${last}${n}@example.com`.toLowerCase(), fatherAddress: `${int(1, 99)}-${int(1, 99)}, Main Road, Demo Nagar`,
        admDate: `${2026 - yi}-07-${pad(int(1, 20))}`, needsTransport: 'No',
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
  L.forEach((n, k) => mk(4 + k, n[0], n[1], n[2], 'Teaching', k < 6 ? 'Assistant Professor' : 'Associate Professor', ['Teaching'], int(30, 55) * 1000, k === 0 ? { classTeacherClass: 'Honours Year 1', classTeacherSection: 'B.COM (GENERAL)', linkedUserId: 'u_demo_teacher', loginUsername: 'demo.teacher' } : {}));
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
    name: DEMO_NAME, tagline: 'Learn. Grow. Lead.', udise: '', schoolCode: 'DDC001', receiptCode: 'DDC', regNumber: 'DEMO/DC/2026/001',
    recognition: 'Demo degree college — sample data only', email: 'office@demo-degree.example.com', phone: '08412345678', whatsapp: '9876500000',
    website: 'www.demo-degree.example.com', state: 'Andhra Pradesh', district: 'Demo District', pin: '500001', address: '1-2-3, Demo Nagar, Demo City',
    workingDays: 220, principalName: 'Dr. Sunitha Rao', logo: '', principalSignature: '', leadership: [],
  });

  // Structure: Honours Year 1-4 as classes, each programme as a section, the pack's own settings and courses
  await api('PUT', '/api/kv/class-levels', YEARS);
  await api('PUT', '/api/kv/section-levels', PROGS.map(p => p.name));
  const ovr = {}; YEARS.forEach(y => { ovr[y] = PROGS.map(p => p.name); });
  await api('PUT', '/api/kv/class-section-overrides', ovr);
  await api('PUT', '/api/kv/college-structure', { institutionType: 'degree_college', look: 'portal', combos: [] });
  await api('PUT', '/api/kv/degree-structure', { grading: GRADING, programmes: PROGS.map(p => ({ id: p.id, name: p.name, full: p.full, pattern: 'honours4', stream: p.stream, seats: p.seats, courses: p.courses })) });
  const fs = {}; YEARS.forEach(y => { fs[y] = { admission: ADMISSION, fee: FEE[y], bus: 0, stock: 0 }; });
  await api('PUT', '/api/fee-structure', fs);
  await api('PUT', '/api/kv/receipt-settings', { startNumber: 1 });
  await api('PUT', '/api/kv/fee-schedule', { '2026-27': { bus: { due: '', mode: 'yearly' }, fee: { due: '2026-12-15', mode: 'yearly' }, stock: { due: '', mode: 'yearly' }, hostel: { due: '', mode: 'yearly' } } });
  await api('PUT', '/api/kv/exam-types', EXAM_TYPES);

  console.log('Students…'); await pool(students, s => api('POST', '/api/students', s));
  console.log('Staff…'); await pool(staff, s => api('POST', '/api/staff', s));

  // Subjects: one row per course per year; shared courses (English I ...) are offered to every programme that has them
  const lecturers = staff.filter(s => s.department === 'Teaching');
  const subj = {};
  PROGS.forEach(p => p.courses.forEach(c => {
    const cls = YEARS[yearOfSem(c.sem) - 1], key = cls + '||' + c.title.toLowerCase();
    const r = subj[key] = subj[key] || { className: cls, name: c.title, code: c.type.slice(0, 3).toUpperCase(), countable: c.type === 'Practical' ? 0 : 1, elective: 0, sections: [] };
    if (ELECTIVE(c.type)) r.elective = 1;
    if (!r.sections.includes(p.name)) r.sections.push(p.name);
  }));
  const subjectRows = Object.values(subj).map((r, i) => {
    const t = lecturers[i % lecturers.length];
    return { id: `msub_dgc_${i}`, ...r, staffIds: [t.id], sectionStaff: Object.fromEntries(r.sections.map(s => [s, [t.id]])) };
  });
  await pool(subjectRows, s => api('POST', '/api/subjects', s));

  // Marks: finished semesters have internal + external for every course (some weak students fail a course or two);
  // the semester in progress has internal marks only, so it shows as "marks incomplete".
  console.log('Marks…');
  const strength = {}; students.forEach(s => { strength[s.id] = rnd() < 0.08 ? 0.3 + rnd() * 0.15 : 0.55 + rnd() * 0.42; });
  const marks = {};
  const clampN = (v, hi) => Math.max(0, Math.min(hi, Math.round(v)));
  students.forEach(s => {
    const pr = PROGS.find(p => p.name === s.section), yi = YEARS.indexOf(s.className) + 1, m = {};
    pr.courses.forEach(c => {
      if(yearOfSem(c.sem) > yi) return;
      const done = c.sem <= 2 * (yi - 1), cur = c.sem === 2 * yi - 1;
      if(!done && !cur) return;
      const q = Math.min(1, Math.max(0.05, strength[s.id] + (rnd() - 0.5) * 0.35));
      const cell = { i: clampN(25 * Math.min(1, q + 0.08), 25) };
      if(done) cell.e = clampN(75 * q, 75);
      m[c.id] = cell;
    });
    if(Object.keys(m).length) marks[s.id] = m;
  });
  await api('PUT', '/api/kv/degree-results', { marks });

  // One released exam (Mid-Semester Exam, current semester courses) so the Enter Marks, Results and parent Marks screens
  // have something to show. The semester-wise Internal/External marks above stay as the main degree results.
  console.log('Mid-Semester exam…');
  const midId = 'exam_dgc_mid1', midMax = 30, midSubj = {};
  YEARS.forEach((y, yi0) => PROGS.forEach(p => {
    const cur = p.courses.filter(c => c.sem === 2 * (yi0 + 1) - 1 && c.type !== 'Internship' && c.type !== 'Project');
    midSubj[`${y}||${p.name}`] = cur.map((c, k) => ({ code: c.type.slice(0, 3).toUpperCase(), name: c.title, maxMarks: midMax, internalMax: 0, countable: true, elective: false, date: isoDay(daysAgo(14 - k)), staffIds: [lecturers[(yi0 + k) % lecturers.length].id] }));
  }));
  await api('POST', '/api/exam-defs', { id: midId, name: 'Mid-Semester Exam', examType: 'Mid-Semester Exam', startDate: isoDay(daysAgo(14)), endDate: isoDay(daysAgo(9)), classSubjects: midSubj });
  const midRes = [];
  students.forEach(s => (midSubj[`${s.className}||${s.section}`] || []).forEach(sb => {
    const m = clampN(midMax * Math.min(1, Math.max(0.1, strength[s.id] + (rnd() - 0.5) * 0.3)), midMax);
    midRes.push({ id: `res_${midId}_${s.id}_${sb.name}`.replace(/\s+/g, '_'), examId: midId, studentId: s.id, subject: sb.name, marks: m, written: m, internal: 0, absent: false });
  }));
  await pool(midRes, r => api('POST', '/api/exam-results', r), 12);
  const released = {}; YEARS.forEach(y => { released[`${midId}|${y}`] = { at: new Date().toISOString(), by: 'Demo Principal' }; });
  await api('PUT', '/api/kv/exam-releases', { legacy: [], released, revised: {} });

  // Fees: admission + a mix of paid in full, part paid, unpaid
  console.log('Fee receipts…');
  const payments = [], modes = ['Cash', 'UPI', 'Cash', 'Bank Transfer'];
  students.forEach((s, i) => {
    const fee = FEE[s.className], r = rnd();
    const mk = (cat, amount, back) => payments.push({ id: `pay_dgc_${pad(i, 4)}_${cat}`, receiptNo: '', studentId: s.id, studentName: s.name, category: cat, mode: pick(modes), amount, discount: 0, instalment: '', date: isoDay(daysAgo(back)), note: '', classAtPayment: s.className });
    if (r < 0.92) mk('admission', ADMISSION, int(60, 120));
    if (r < 0.5) mk('fee', fee, int(20, 100)); else if (r < 0.82) mk('fee', Math.round(fee * (0.3 + rnd() * 0.4) / 100) * 100, int(20, 100));
  });
  payments.sort((a, b) => a.date.localeCompare(b.date));
  payments.forEach((p, k) => { p.receiptNo = `DDC-26-${pad(k + 1, 6)}`; });
  await pool(payments, p => api('POST', '/api/payments', p), 4);

  // Attendance: last 15 college days; about one student in 14 attends well under 75%
  console.log('Attendance…');
  const lowIds = new Set(students.filter((s, i) => i % 14 === 3).map(s => s.id));
  const att = []; let counted = 0;
  for (let back = 1; counted < 15 && back < 40; back++) {
    const d = daysAgo(back); if (d.getDay() === 0) continue; counted++;
    const ds = isoDay(d);
    students.forEach(s => att.push({ id: `att_${s.id}_${ds}_Morning`, studentId: s.id, date: ds, session: 'Morning', status: lowIds.has(s.id) ? (rnd() < 0.62 ? 'Present' : 'Absent') : (rnd() < 0.94 ? 'Present' : (rnd() < 0.7 ? 'Absent' : 'Leave')) }));
  }
  await pool(att, a => api('POST', '/api/attendance', a), 12);
  const sAtt = [];
  for (let back = 1; back <= 10; back++) { const d = daysAgo(back); if (d.getDay() === 0) continue; const ds = isoDay(d);
    staff.forEach(s => sAtt.push({ id: `satt_${s.id}_${ds}`, staffId: s.id, date: ds, session: 'Morning', status: rnd() < 0.95 ? 'Present' : 'Leave' })); }
  await pool(sAtt, a => api('POST', '/api/staff-attendance', a), 12);

  // Degree pack extras: fee reimbursement files (all numbers below are made up) and internship progress
  console.log('Degree pack data…');
  const reim = {}, intern = {};
  students.forEach((s, i) => {
    if(i % 3 === 0){
      const full = i % 6 !== 3;
      reim[s.id] = { applying: true, incomeNo: i % 27 === 0 ? '' : 'INC' + (100000 + i * 13), casteNo: i % 36 === 0 ? '' : 'CST' + (200000 + i * 17), rationNo: i % 45 === 0 ? '' : 'RC' + (300000 + i * 19),
        bank: full ? 'Yes' : (i % 4 === 0 ? 'No' : 'Yes'), bio: full ? 'Yes' : (i % 5 === 0 ? 'No' : 'Yes') };
    }
    const yi = YEARS.indexOf(s.className) + 1, r = {};
    r.community = { status: yi >= 2 ? 'Completed' : (i % 2 ? 'In progress' : 'Not started') };
    r.short = { status: yi >= 3 ? 'Completed' : (yi === 2 ? 'In progress' : 'Not started') };
    r.semester = { status: yi === 4 ? (i % 2 ? 'In progress' : 'Completed') : 'Not started' };
    if(yi >= 3 && i % 4 === 0) r.note = ['Local bank branch', 'Software firm, Hyderabad', 'District office', 'NGO, Demo City'][i % 4 === 0 ? (i / 4) % 4 : 0];
    intern[s.id] = r;
  });
  await api('PUT', '/api/kv/degree-extras', { reim, intern, release: {} });

  console.log('Notices…');
  const notices = [
    ['Welcome to the Demo Degree College ERP', 'This is a demonstration system with sample data. Nothing here is real.'],
    ['Semester marks entered', 'Internal and external marks for the completed semesters are entered. Results are in Programmes & Years.'],
    ['Attendance reminder', 'Students below 75% attendance will be held back from hall tickets. Please check the list.'],
    ['Fee reimbursement documents', 'Students applying for fee reimbursement must submit income, caste and ration card numbers and complete biometric.'],
  ];
  await pool(notices.map((n, k) => ({ id: `msg_dgc_${k}`, title: n[0], body: n[1], type: 'Announcement', channels: ['In-App'], audienceLabel: 'Public website', link: '', sentBy: 'Demo Admin', sentDate: isoDay(daysAgo(k * 3)) })), m => api('POST', '/api/comms-messages', m));

  await sql`DELETE FROM sessions WHERE user_id = 'u_seeder'`;
  await sql`DELETE FROM users WHERE id = 'u_seeder'`;
  console.log('\nDone. Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  ['demo.admin', 'demo.principal', 'demo.accountant', 'demo.office', 'demo.teacher', 'demo.parent', 'demo.student'].forEach(u => console.log('  ' + u));
}

const _run = main();
export const finished = globalThis.__demoFetch
  ? _run
  : _run.then(() => closePool()).catch(async e => { console.error('SEED FAILED:', e.message, e.cause ? '(cause: ' + (e.cause.code || e.cause.message || e.cause) + ')' : ''); try { await closePool(); } catch (x) {} process.exitCode = 1; });
