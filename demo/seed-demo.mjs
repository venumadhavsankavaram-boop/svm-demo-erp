// Demo school sample data  —  node demo/seed-demo.mjs [--base=http://127.0.0.1:3000]
//
// Fills a DEMO database with a fictional school ("Sunrise Public School"): students, staff,
// fees + receipts, accounting vouchers, attendance, exams, notices, transport, hostel, timetable,
// library, inventory and one login per role.
// It saves through the ERP's own API (same validation, same record formats as the app).
//
// SAFETY: this script WIPES the database it is pointed at. It refuses to run unless
//   1. env DEMO_MODE=true, and
//   2. the database is empty, or already holds the demo school ("Sunrise Public School").
// A real school's database can therefore never be wiped by mistake.
import bcrypt from 'bcryptjs';
import { sql, closePool } from '../db.js';

const DEMO_NAME = 'Sunrise Public School';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123';
const BASE = (process.argv.find(a => a.startsWith('--base=')) || '').slice(7) || `http://127.0.0.1:${process.env.PORT || 3000}`;
const SEED_USER = 'zz_demo_seeder';

// ---------- deterministic random so every nightly reset looks the same ----------
let _s = 20260601;
const rnd = () => { _s = (_s * 1664525 + 1013904223) % 4294967296; return _s / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

const MALE = ['Aarav','Vihaan','Arjun','Sai','Krishna','Rohan','Aditya','Ishaan','Karthik','Rahul','Varun','Pranav','Harsha','Manoj','Nikhil','Charan','Teja','Ravi','Sandeep','Ajay'];
const FEMALE = ['Ananya','Diya','Sneha','Priya','Lakshmi','Meera','Kavya','Navya','Pooja','Harini','Divya','Sahana','Tanvi','Bhavana','Swathi','Anika','Ishita','Mounika','Sravani','Keerthi'];
const SURNAMES = ['Reddy','Rao','Naidu','Sharma','Kumar','Varma','Patel','Singh','Chowdary','Raju','Prasad','Goud','Yadav','Das','Menon'];
const FATHERS = ['Ramesh','Suresh','Venkatesh','Srinivas','Mahesh','Naresh','Ganesh','Prakash','Anil','Satish','Vijay','Kiran'];
const MOTHERS = ['Sita','Latha','Padma','Radha','Sunitha','Anitha','Vani','Jyothi','Rekha','Usha','Swapna','Geetha'];
const CLASSES = ['Baby Class','LKG','UKG','1st Class','2nd Class','3rd Class','4th Class','5th Class','6th Class','7th Class','8th Class','9th Class','10th Class'];
const TWO_SECTIONS = new Set(['1st Class','2nd Class','3rd Class','4th Class','5th Class']);
const FEES = { 'Baby Class':9000,'LKG':10000,'UKG':11000,'1st Class':12000,'2nd Class':13000,'3rd Class':14000,'4th Class':15000,'5th Class':16000,'6th Class':19000,'7th Class':20000,'8th Class':21000,'9th Class':22000,'10th Class':25000 };
const ADMISSION = c => (['6th Class','7th Class','8th Class','9th Class','10th Class'].includes(c) ? 1500 : 1000);
const SUBJECTS_LOW = ['TELUGU','ENGLISH','MATHS','EVS','HINDI','COMPUTERS'];
const SUBJECTS_HIGH = ['TELUGU','HINDI','ENGLISH','MATHS','SCIENCE','SOCIAL'];


// ---------- facilities: fixed ids so students can point at them ----------
const ROUTES = [
  { id: 'route_demo_1', name: 'Route 1 - Market Road', busNumber: 'TS 09 UA 1234', driverName: 'Mohan Lal', driverPhone: '9876500101',
    stops: [{ id: 'stop_demo_1a', name: 'Market Road', fare: 6000 }, { id: 'stop_demo_1b', name: 'Temple Circle', fare: 6500 }, { id: 'stop_demo_1c', name: 'Bus Stand', fare: 7000 }] },
  { id: 'route_demo_2', name: 'Route 2 - Green Park', busNumber: 'TS 09 UB 5678', driverName: 'Shankar Das', driverPhone: '9876500102',
    stops: [{ id: 'stop_demo_2a', name: 'Green Park', fare: 5500 }, { id: 'stop_demo_2b', name: 'City Hospital', fare: 6000 }, { id: 'stop_demo_2c', name: 'Lake View', fare: 6500 }] },
  { id: 'route_demo_3', name: 'Route 3 - Railway Colony', busNumber: 'TS 09 UC 9012', driverName: 'Ravi Teja', driverPhone: '9876500103',
    stops: [{ id: 'stop_demo_3a', name: 'Railway Colony', fare: 7500 }, { id: 'stop_demo_3b', name: 'Old Town', fare: 8000 }] },
];
const HOSTEL_ROOMS = [
  { id: 'room_demo_a1', blockName: 'Boys Block A', roomNumber: 'A-101', roomType: 'Shared', capacity: 4, fee: 30000, wardenName: 'Mr. Satish Kumar', wardenPhone: '9876500201' },
  { id: 'room_demo_a2', blockName: 'Boys Block A', roomNumber: 'A-102', roomType: 'Shared', capacity: 4, fee: 30000, wardenName: 'Mr. Satish Kumar', wardenPhone: '9876500201' },
  { id: 'room_demo_a3', blockName: 'Boys Block A', roomNumber: 'A-103', roomType: 'Double', capacity: 2, fee: 38000, wardenName: 'Mr. Satish Kumar', wardenPhone: '9876500201' },
  { id: 'room_demo_b1', blockName: 'Girls Block B', roomNumber: 'B-101', roomType: 'Shared', capacity: 4, fee: 30000, wardenName: 'Mrs. Radha Devi', wardenPhone: '9876500202' },
  { id: 'room_demo_b2', blockName: 'Girls Block B', roomNumber: 'B-102', roomType: 'Shared', capacity: 4, fee: 30000, wardenName: 'Mrs. Radha Devi', wardenPhone: '9876500202' },
  { id: 'room_demo_b3', blockName: 'Girls Block B', roomNumber: 'B-103', roomType: 'Double', capacity: 2, fee: 38000, wardenName: 'Mrs. Radha Devi', wardenPhone: '9876500202' },
];

const today = new Date();
const isoDay = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };

// ---------- HTTP helper (signed in as the temporary seeder account) ----------
// Hosted demo: GoDaddy blocks the app from opening a connection to itself, so the server
// hands this script an in-process fetch (globalThis.__demoFetch). Standalone runs use real HTTP.
const doFetch = globalThis.__demoFetch || fetch;
let cookie = '';
async function api(method, path, body, { allow = [] } = {}) {
  const res = await doFetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Actor-Name': 'Demo%20Seeder', 'X-Actor-Role': 'Admin' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && !allow.includes(res.status)) {
    const t = await res.text().catch(() => '');
    throw new Error(`${method} ${path} -> ${res.status} ${t.slice(0, 160)}`);
  }
  return res;
}
async function pool(items, fn, width = 8) {
  let i = 0, failed = 0, firstErr = null;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (i < items.length) {
      const it = items[i++];
      try { await fn(it); } catch (e) { failed++; if (!firstErr) firstErr = e; }
    }
  }));
  if (failed) console.warn(`  ! ${failed} of ${items.length} failed — first error: ${firstErr.message}`);
  return failed;
}

// ---------- 1. safety check + wipe ----------
async function safetyCheckAndWipe() {
  if (process.env.DEMO_MODE !== 'true') throw new Error('Refusing to run: DEMO_MODE is not "true".');
  const info = await sql`SELECT data FROM school_info WHERE id = 1`;
  const nStudents = (await sql`SELECT COUNT(*) AS n FROM students`)[0].n;
  let name = '';
  if (info.length) { try { name = (typeof info[0].data === 'string' ? JSON.parse(info[0].data) : info[0].data).name || ''; } catch (e) {} }
  const isDemo = name === DEMO_NAME;
  if (!isDemo && Number(nStudents) > 0) {
    throw new Error(`Refusing to wipe: this database holds "${name || 'a school'}" with ${nStudents} students, not the demo school.`);
  }
  console.log('Wiping demo tables…');
  const tables = ['students','staff','staff_payroll','payments','student_discounts','student_extra_fees','attendance_records','holidays','exam_results','staff_attendance_records','acct_income','acct_expenses','comms_messages','subjects','exam_defs','admission_inquiries','website_gallery','user_notifications','notification_events','audit_log','deletion_requests','sessions','doc_counters','kv_store'];
  for (const t of tables) { try { await sql.query(`DELETE FROM ${t}`); } catch (e) { console.warn(`  (skip ${t}: ${e.message.slice(0, 60)})`); } }
  try { await sql.query('DELETE FROM users'); } catch (e) { console.warn('  (skip users)'); }
  try { await sql.query('DELETE FROM fee_structure'); } catch (e) {}
  try { await sql.query('DELETE FROM school_info'); } catch (e) {}
}

// ---------- 2. logins ----------
async function createLogins(students, staff) {
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
  await mk('u_demo_teacher', 'Demo Teacher', 'demo.teacher', 'Teacher');
  const s = students.find(x => x.className === '5th Class') || students[0];
  await mk('u_demo_parent', `Parent of ${s.firstName}`, 'demo.parent', 'Parent', s.id);
  await mk('u_demo_student', s.name, 'demo.student', 'Student', s.id);
}
async function loginAsSeeder() {
  // The seeder's password is random and never stored in plaintext: set a known one just for this run.
  const pw = 'seed-' + Math.random().toString(36).slice(2) + 'Aa1';
  await sql`UPDATE users SET password = ${await bcrypt.hash(pw, 10)} WHERE id = 'u_seeder'`;
  const res = await doFetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: SEED_USER, password: pw, audience: 'staff' }) });
  if (!res.ok) throw new Error('Seeder login failed: ' + res.status + ' ' + (await res.text()).slice(0, 120));
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  cookie = set.map(c => c.split(';')[0]).join('; ');
}

// ---------- 3. data builders ----------
function buildStudents() {
  const out = []; let n = 0;
  for (const cls of CLASSES) {
    const sections = TWO_SECTIONS.has(cls) ? ['A', 'B'] : ['A'];
    for (const sec of sections) {
      const count = int(11, 15);
      for (let k = 0; k < count; k++) {
        n++;
        const male = rnd() < 0.5;
        const first = pick(male ? MALE : FEMALE), last = pick(SURNAMES);
        const father = pick(FATHERS), mother = pick(MOTHERS);
        const idx = CLASSES.indexOf(cls);
        const age = 3 + idx;
        const dob = new Date(today.getFullYear() - age, int(0, 11), int(1, 28));
        const phone = '9' + String(int(100000000, 999999999));
        out.push({
          id: `stu_demo_${pad(n, 4)}`, admissionNo: `2026-${pad(n, 3)}`, firstName: first, lastName: last, name: `${first} ${last}`,
          className: cls, section: sec, status: 'Active', gender: male ? 'Male' : 'Female', dob: isoDay(dob),
          blood: pick(['A+','B+','O+','AB+','O-']), caste: pick(['OC','BC-A','BC-B','SC']), religion: 'Hindu',
          fatherName: `${father} ${last}`, motherName: `${mother} ${last}`, parent: `${father} ${last}`,
          fatherPhone: phone, motherPhone: '9' + String(int(100000000, 999999999)), contact: phone,
          email: `${first}.${last}${n}@example.com`.toLowerCase(), fatherAddress: `${int(1, 99)}-${int(1, 99)}, Main Road, Sunrise Nagar`,
          admDate: `${2026 - Math.min(idx, 6)}-06-${pad(int(1, 20))}`, needsTransport: rnd() < 0.3 ? 'Yes' : 'No',
        });
      }
    }
  }
  // Bus riders: spread over the routes/stops. Boarders (6th class and above): fill the hostel rooms by gender.
  let ti = 0;
  out.forEach(st => {
    if (st.needsTransport === 'Yes') { const r = ROUTES[ti % ROUTES.length]; st.transportRouteId = r.id; st.transportStopId = r.stops[Math.floor(ti / ROUTES.length) % r.stops.length].id; ti++; }
  });
  const fill = {}; HOSTEL_ROOMS.forEach(r => { fill[r.id] = 0; });
  out.filter(st => CLASSES.indexOf(st.className) >= 8).forEach(st => {
    const rooms = HOSTEL_ROOMS.filter(r => (st.gender === 'Male') === r.blockName.startsWith('Boys') && fill[r.id] < r.capacity - (r.capacity > 2 ? 1 : 0));
    if (!rooms.length || rnd() > 0.28) return;
    const r = rooms[0]; fill[r.id]++;
    st.isBoarder = 'Yes'; st.hostelRoomId = r.id; st.needsTransport = 'No'; delete st.transportRouteId; delete st.transportStopId;
  });
  return out;
}
function buildStaff() {
  const rows = [];
  const mk = (i, first, last, gender, dept, desig, jobTypes, salary, extra = {}) => rows.push({
    id: `stf_demo_${pad(i)}`, staffId: `STF2026-${pad(i, 3)}`, firstName: first, lastName: last, gender, department: dept, designation: desig,
    jobTypes, status: 'Active', dob: `${1975 + int(0, 18)}-0${int(1, 9)}-1${int(0, 9)}`, doj: `${2012 + int(0, 12)}-06-01`,
    phone: '9' + String(int(100000000, 999999999)), email: `${first}.${last}@example.com`.toLowerCase(), qualification: pick(['M.Sc, B.Ed','M.A, B.Ed','B.Com','M.Sc','B.Sc, B.Ed']),
    experience: String(int(2, 18)), salary: String(salary), paidLeavesPerMonth: '1', address: `${int(1, 99)}-${int(1, 99)}, Market Street`,
    epfEnabled: false, esiEnabled: false, otherMonthlyDeduction: 0, ...extra,
  });
  mk(1, 'Sunitha', 'Rao', 'Female', 'Administration', 'Principal', ['Administration'], 45000);
  mk(2, 'Ramesh', 'Babu', 'Male', 'Administration', 'Office Assistant', ['Administration'], 18000);
  mk(3, 'Padma', 'Kumari', 'Female', 'Accounts', 'Accountant', ['Administration'], 25000);
  const names = [['Lakshmi','Devi','Female'],['Srinivas','Reddy','Male'],['Anitha','Varma','Female'],['Mahesh','Naidu','Male'],['Jyothi','Sharma','Female'],['Kiran','Kumar','Male'],['Vani','Patel','Female'],['Suresh','Goud','Male'],['Radha','Singh','Female'],['Venkat','Chowdary','Male'],['Geetha','Raju','Female'],['Prakash','Yadav','Male'],['Usha','Das','Female'],['Naresh','Menon','Male'],['Swapna','Prasad','Female'],['Anil','Rao','Male']];
  names.forEach((n, k) => {
    const cls = CLASSES[Math.min(k + 2, 12)];
    mk(4 + k, n[0], n[1], n[2], 'Teaching', k < 8 ? 'Primary Teacher' : 'Subject Teacher', ['Teaching'], int(18, 32) * 1000, { classTeacherClass: cls, classTeacherSection: 'A' });
  });
  mk(20, 'Mohan', 'Lal', 'Male', 'Transport', 'Driver', ['Transport'], 14000);
  mk(21, 'Shankar', 'Das', 'Male', 'Transport', 'Driver', ['Transport'], 14000);
  mk(22, 'Savitri', 'Bai', 'Female', 'Support', 'Attender', ['Support'], 9000);
  return rows;
}

async function main() {
  await safetyCheckAndWipe();
  const students = buildStudents();
  const staff = buildStaff();
  await createLogins(students, staff);
  await loginAsSeeder();
  console.log(`Seeding ${students.length} students, ${staff.length} staff via ${BASE}`);

  await api('PUT', '/api/school-info', {
    name: DEMO_NAME, tagline: 'Learning that lights the way', udise: '', schoolCode: 'SPS001', receiptCode: 'SPS', regNumber: 'DEMO/2026/001',
    recognition: 'Demo school — sample data only', email: 'office@sunrise-demo.example.com', phone: '08412345678', whatsapp: '9876500000',
    website: 'www.sunrise-demo.example.com', state: 'Telangana', district: 'Demo District', pin: '500001', address: '1-2-3, Sunrise Nagar, Demo City',
    workingDays: 220, principalName: 'Mrs. Sunitha Rao', logo: '', principalSignature: '', leadership: [],
  });
  const fs = {}; CLASSES.forEach(c => { fs[c] = { admission: ADMISSION(c), fee: FEES[c], bus: 0, stock: 0 }; });
  await api('PUT', '/api/fee-structure', fs);
  await api('PUT', '/api/kv/receipt-settings', { startNumber: 1 });
  await api('PUT', '/api/kv/fee-schedule', { '2026-27': { bus: { due: '2026-07-31', mode: 'yearly' }, fee: { due: '2026-10-31', mode: 'yearly' }, stock: { due: '', mode: 'yearly' }, hostel: { due: '', mode: 'yearly' } } });
  await api('PUT', '/api/kv/exam-types', [
    { id: 'etype_demo_pri', name: 'FA - PRIMARY', group: 'formative', scopeClasses: CLASSES.slice(3, 8) },
    { id: 'etype_demo_high', name: 'FA - HIGH SCHOOL', group: 'formative', scopeClasses: CLASSES.slice(8) },
  ]);

  console.log('Students…');   await pool(students, s => api('POST', '/api/students', s));
  console.log('Staff…');      await pool(staff, s => api('POST', '/api/staff', s));

  // Subjects + one exam with marks for classes 6–10
  const teachers = staff.filter(s => s.department === 'Teaching');
  console.log('Subjects & exam…');
  const subjectRows = []; const classSubjects = {};
  CLASSES.slice(3).forEach((cls, ci) => {
    const list = ci >= 3 ? SUBJECTS_HIGH : SUBJECTS_LOW;
    const t = teachers[ci % teachers.length];
    const sections = TWO_SECTIONS.has(cls) ? ['A', 'B'] : ['A'];
    list.forEach((nm, k) => {
      subjectRows.push({ id: `msub_demo_${ci}_${k}`, className: cls, name: nm, code: `${cls.split(' ')[0].replace(/\D/g, '') || cls[0]}-${nm.slice(0, 3)}`, countable: 1, elective: 0,
        sections, staffIds: [t.id], sectionStaff: Object.fromEntries(sections.map(s => [s, [t.id]])) });
    });
    if (ci >= 3) {
      sections.forEach(sec => { classSubjects[`${cls}||${sec}`] = list.map((nm, k) => ({ code: `${cls[0]}-${nm.slice(0, 3)}`, name: nm, maxMarks: 50, internalMax: 10, countable: true, elective: false, date: isoDay(daysAgo(20 - k)), staffIds: [t.id] })); });
    }
  });
  await pool(subjectRows, s => api('POST', '/api/subjects', s));
  const examId = 'exam_demo_fa1';
  await api('POST', '/api/exam-defs', { id: examId, name: 'FA1-HIGH', examType: 'FA - HIGH SCHOOL', startDate: isoDay(daysAgo(21)), endDate: isoDay(daysAgo(15)), classSubjects });
  const results = [];
  students.filter(s => CLASSES.indexOf(s.className) >= 8).forEach(s => {
    const strength = 0.45 + rnd() * 0.5;
    SUBJECTS_HIGH.forEach(nm => {
      const written = Math.max(0, Math.min(40, Math.round(40 * Math.min(1, strength + (rnd() - 0.5) * 0.3))));
      const internal = Math.max(0, Math.min(10, Math.round(10 * Math.min(1, strength + (rnd() - 0.5) * 0.2))));
      results.push({ id: `res_${examId}_${s.id}_${nm}`, examId, studentId: s.id, subject: nm, marks: written + internal, written, internal, absent: false });
    });
  });
  await pool(results, r => api('POST', '/api/exam-results', r));

  // Fees + receipts. SPS-26-000001 upward. A mix: paid in full, part paid, unpaid.
  console.log('Fee receipts…');
  const payments = []; let rc = 0;
  const modes = ['Cash', 'UPI', 'Cash', 'Bank Transfer'];
  students.forEach((s, i) => {
    const fee = FEES[s.className], adm = ADMISSION(s.className);
    const r = rnd();
    const mkPay = (cat, amount, daysBack) => payments.push({
      id: `pay_demo_${pad(i, 4)}_${cat}`, receiptNo: `SPS-26-${pad(++rc, 6)}`, studentId: s.id, studentName: s.name, category: cat, mode: pick(modes),
      amount, discount: 0, instalment: '', date: isoDay(daysAgo(daysBack)), note: '', classAtPayment: s.className,
    });
    if (r < 0.9) mkPay('admission', adm, int(60, 120));
    if (r < 0.45) mkPay('fee', fee, int(20, 100));
    else if (r < 0.8) mkPay('fee', Math.round(fee * (0.3 + rnd() * 0.4) / 100) * 100, int(20, 100));
  });
  payments.sort((a, b) => a.date.localeCompare(b.date));
  payments.forEach((p, k) => { p.receiptNo = `SPS-26-${pad(k + 1, 6)}`; });
  await pool(payments, p => api('POST', '/api/payments', p), 4);

  // Accounting vouchers (numbers from the same atomic counter the app uses)
  console.log('Vouchers…');
  const incomeCats = ['Donations', 'Canteen', 'Rent', 'Miscellaneous'], expCats = ['Salaries', 'Utilities (Electricity/Water)', 'Maintenance & Repairs', 'Stationery & Supplies', 'Transport Fuel', 'Miscellaneous'];
  const vouchers = [];
  for (let k = 0; k < 18; k++) vouchers.push({ kind: 'income', cat: pick(incomeCats), amt: int(5, 60) * 500, back: int(1, 90), party: pick(['Parents Association', 'Alumni', 'Canteen contractor', 'Local donor']) });
  for (let k = 0; k < 45; k++) vouchers.push({ kind: 'expense', cat: pick(expCats), amt: int(4, 90) * 500, back: int(1, 90), party: pick(['City Electricity', 'Stationers', 'Fuel Station', 'Repair Works', 'Staff payroll']) });
  vouchers.sort((a, b) => b.back - a.back);
  for (let k = 0; k < vouchers.length; k++) {
    const v = vouchers[k];
    const series = v.kind === 'income' ? 'income_voucher' : 'payment_voucher';
    const num = (await (await api('POST', '/api/next-doc-number', { series })).json()).docNumber;
    const rec = { id: `${v.kind === 'income' ? 'inc' : 'exp'}_demo_${k}`, voucherNo: num, date: isoDay(daysAgo(v.back)), category: v.cat, costCenter: '', amount: v.amt, party: v.party,
      mode: pick(['Cash', 'Bank Transfer', 'UPI']), referenceNo: `REF${1000 + k}`, description: `${v.cat} — sample entry ${k + 1}`, addedBy: 'Demo Accountant', voided: false };
    await api('POST', v.kind === 'income' ? '/api/acct-income' : '/api/acct-expenses', rec);
  }

  // Attendance: last 15 school days for every student (Mon–Sat), ~93% present
  console.log('Attendance…');
  const att = []; let counted = 0;
  for (let back = 1; counted < 15 && back < 40; back++) {
    const d = daysAgo(back); if (d.getDay() === 0) continue; counted++;
    const ds = isoDay(d);
    students.forEach(s => att.push({ id: `att_${s.id}_${ds}_Morning`, studentId: s.id, date: ds, session: 'Morning', status: rnd() < 0.93 ? 'Present' : (rnd() < 0.7 ? 'Absent' : 'Leave') }));
  }
  await pool(att, a => api('POST', '/api/attendance', a), 12);
  const sAtt = [];
  for (let back = 1; back <= 10; back++) { const d = daysAgo(back); if (d.getDay() === 0) continue; const ds = isoDay(d);
    staff.forEach(s => sAtt.push({ id: `satt_${s.id}_${ds}`, staffId: s.id, date: ds, session: 'Morning', status: rnd() < 0.95 ? 'Present' : 'Leave' })); }
  await pool(sAtt, a => api('POST', '/api/staff-attendance', a), 12);

  // Notices
  console.log('Notices…');
  const notices = [
    ['Welcome to Sunrise Public School ERP demo', 'This is a demonstration system with sample data. Nothing here is real.'],
    ['Parent–Teacher meeting', 'The parent–teacher meeting is on the first Saturday of next month at 10 AM.'],
    ['FA1 results published', 'FA1 results are available in the parent portal.'],
    ['Fee reminder', 'Please clear the pending fee before 31 October to avoid a late fee.'],
  ];
  await pool(notices.map((n, k) => ({ id: `msg_demo_${k}`, title: n[0], body: n[1], type: 'Announcement', channels: ['In-App'], audienceLabel: 'Public website', link: '', sentBy: 'Demo Admin', sentDate: isoDay(daysAgo(k * 3)) })),
    m => api('POST', '/api/comms-messages', m));


  // ---------- Facilities: transport, hostel, timetable, library, inventory ----------
  console.log('Transport & hostel…');
  await api('PUT', '/api/kv/transport-routes', ROUTES);
  await api('PUT', '/api/kv/hostel-rooms', HOSTEL_ROOMS);

  console.log('Timetable…');
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const PERIODS = [
    { id: 'p1', label: 'Period 1', start: '09:00', end: '09:45', isBreak: false }, { id: 'p2', label: 'Period 2', start: '09:45', end: '10:30', isBreak: false },
    { id: 'p3', label: 'Period 3', start: '10:30', end: '11:15', isBreak: false }, { id: 'b1', label: 'Short Break', start: '11:15', end: '11:30', isBreak: true },
    { id: 'p4', label: 'Period 4', start: '11:30', end: '12:15', isBreak: false }, { id: 'p5', label: 'Period 5', start: '12:15', end: '13:00', isBreak: false },
    { id: 'lunch', label: 'Lunch', start: '13:00', end: '13:40', isBreak: true }, { id: 'p6', label: 'Period 6', start: '13:40', end: '14:25', isBreak: false },
    { id: 'p7', label: 'Period 7', start: '14:25', end: '15:10', isBreak: false }, { id: 'p8', label: 'Period 8', start: '15:10', end: '15:55', isBreak: false },
  ];
  const classPeriods = PERIODS.filter(x => !x.isBreak);
  const busy = new Set(); const tt = [];
  const sectionsOf = cls => (TWO_SECTIONS.has(cls) ? ['A', 'B'] : ['A']);
  let rot = 0;
  DAYS.forEach((day, di) => {
    classPeriods.forEach((per, pi) => {
      CLASSES.forEach((cls, ci) => {
        const list = ci >= 3 ? SUBJECTS_HIGH : SUBJECTS_LOW;
        sectionsOf(cls).forEach((sec, si) => {
          const subj = list[(pi + di + ci + si) % list.length];
          for (let tries = 0; tries < teachers.length; tries++) {
            const t = teachers[(ci + si + rot + tries) % teachers.length];
            const key = `${day}|${per.id}|${t.id}`;
            if (busy.has(key)) continue;
            busy.add(key);
            tt.push({ id: `tt_demo_${tt.length}`, className: cls, section: sec, day, period: per.id, subject: subj, staffId: t.id });
            break;
          }
          rot++;
        });
      });
    });
  });
  await api('PUT', '/api/kv/timetable-periods', PERIODS);
  await api('PUT', '/api/kv/timetable-days', DAYS);
  await api('PUT', '/api/kv/timetable-entries', tt);

  console.log('Library…');
  const BOOKS = [
    ['Panchatantra Stories', 'Vishnu Sharma', 'Story'], ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography'], ['Malgudi Days', 'R. K. Narayan', 'Story'],
    ['The Jungle Book', 'Rudyard Kipling', 'Story'], ['Discovery of India', 'Jawaharlal Nehru', 'History'], ['Gitanjali', 'Rabindranath Tagore', 'Poetry'],
    ['Oxford Student Dictionary', 'Oxford Press', 'Reference'], ['Concise Atlas of India', 'Survey Dept.', 'Reference'], ['Science Experiments for Kids', 'M. Rao', 'Science'],
    ['The Story of the Earth', 'S. Kumar', 'Science'], ['Famous Scientists', 'P. Iyer', 'Biography'], ['Mathematics Magic', 'Shakuntala Devi', 'Maths'],
    ['Puzzles to Puzzle You', 'Shakuntala Devi', 'Maths'], ['Tales of Tenali Rama', 'Anant Pai', 'Story'], ['Mahabharata for Children', 'C. Rajagopalachari', 'Epic'],
    ['Ramayana for Children', 'C. Rajagopalachari', 'Epic'], ['Telugu Vyakaranam', 'B. Rao', 'Language'], ['Hindi Vyakaran', 'K. Sharma', 'Language'],
    ['English Grammar in Use', 'R. Murphy', 'Language'], ['Our Environment', 'NCERT', 'Science'], ['General Knowledge 2026', 'Manorama', 'Reference'],
    ['Stories of Great Indians', 'L. Devi', 'Biography'], ['Birbal the Wise', 'Anant Pai', 'Story'], ['Computer Basics', 'T. Reddy', 'Computers'],
    ['Sports Heroes of India', 'V. Naidu', 'Biography'], ['Trees of India', 'N. Menon', 'Science'], ['Moral Stories', 'A. Prasad', 'Story'],
    ['Space Exploration', 'D. Singh', 'Science'], ['Poems for Little Ones', 'S. Varma', 'Poetry'], ['The Water Cycle', 'NCERT', 'Science'],
  ];
  const libBooks = BOOKS.map((b, k) => ({ id: `book_demo_${k}`, title: b[0], author: b[1], category: b[2], isbn: `978-81-${pad(1000 + k * 7, 4)}-${pad(k, 3)}-0`, publisher: 'Demo Publishers',
    shelfLocation: `Shelf ${String.fromCharCode(65 + (k % 5))}-${1 + (k % 4)}`, totalCopies: int(2, 6), availableCopies: 0, addedDate: isoDay(daysAgo(int(30, 300))) }));
  libBooks.forEach(b => { b.availableCopies = b.totalCopies; });
  const libIssues = [];
  const borrowers = students.filter(x => CLASSES.indexOf(x.className) >= 3).slice(0, 14);
  borrowers.forEach((st, k) => {
    const book = libBooks[(k * 3 + 1) % libBooks.length];
    const back = int(2, 30), returned = k % 4 === 3;
    const issueDate = isoDay(daysAgo(back)), dueDate = isoDay(daysAgo(back - 14));
    libIssues.push({ id: `issue_demo_${k}`, bookId: book.id, bookTitle: book.title, borrowerType: 'Student', borrowerId: st.id, borrowerName: st.name, issueDate, dueDate,
      returnDate: returned ? isoDay(daysAgo(Math.max(0, back - int(5, 13)))) : '', status: returned ? 'Returned' : 'Issued', fineAmount: 0 });
    if (!returned) book.availableCopies = Math.max(0, book.availableCopies - 1);
  });
  [['stf_demo_004', 'Lakshmi Devi'], ['stf_demo_005', 'Srinivas Reddy']].forEach((t, k) => {
    const book = libBooks[(k * 5 + 2) % libBooks.length];
    libIssues.push({ id: `issue_demo_t${k}`, bookId: book.id, bookTitle: book.title, borrowerType: 'Staff', borrowerId: t[0], borrowerName: t[1], issueDate: isoDay(daysAgo(6 + k)), dueDate: isoDay(daysAgo(-8 + k)), returnDate: '', status: 'Issued', fineAmount: 0 });
    book.availableCopies = Math.max(0, book.availableCopies - 1);
  });
  await api('PUT', '/api/kv/library-settings', { loanPeriodDays: 14, finePerDay: 2 });
  await api('PUT', '/api/kv/library-books', libBooks);
  await api('PUT', '/api/kv/library-issues', libIssues);

  console.log('Inventory…');
  const ITEMS = [
    ['School Bag', 'Student Supplies', 'Bag', 'Piece', 320, 450, 40, 8], ['Water Bottle', 'Student Supplies', 'Water Bottle', 'Piece', 90, 150, 60, 15],
    ['Lunch Box', 'Student Supplies', 'Lunch Box', 'Piece', 110, 180, 50, 10], ['Uniform Shirt', 'Uniforms', 'Shirt', 'Piece', 280, 400, 120, 25],
    ['Uniform Trousers', 'Uniforms', 'Trousers', 'Piece', 330, 480, 100, 25], ['Uniform Skirt', 'Uniforms', 'Skirt', 'Piece', 300, 430, 70, 20],
    ['School Tie', 'Uniforms', 'Tie', 'Piece', 45, 80, 150, 30], ['School Belt', 'Uniforms', 'Belt', 'Piece', 55, 90, 110, 30],
    ['Sports Shoes', 'Uniforms', 'Shoes', 'Pair', 380, 520, 6, 15], ['Telugu Textbook', 'Books', 'Textbook', 'Piece', 120, 160, 130, 20],
    ['English Textbook', 'Books', 'Textbook', 'Piece', 140, 190, 125, 20], ['Maths Textbook', 'Books', 'Textbook', 'Piece', 150, 200, 120, 20],
    ['Long Notebook (200 pages)', 'Books', 'Notebook', 'Piece', 38, 55, 400, 100], ['Student Diary', 'Books', 'Diary', 'Piece', 30, 50, 180, 40],
    ['Geometry Box', 'Stationery', 'Geometry Box', 'Box', 85, 130, 70, 15], ['Pen Pack (10)', 'Stationery', 'Pen', 'Packet', 60, 95, 90, 20],
    ['Football', 'Sports', 'Ball', 'Piece', 450, 650, 4, 5], ['Cricket Kit', 'Sports', 'Kit', 'Set', 1800, 2500, 8, 3],
  ];
  const invItems = ITEMS.map((x, k) => ({ id: `item_demo_${k}`, name: x[0], type: 'Sellable', category: x[1], subCategory: x[2], quantity: x[6], threshold: x[7], costPrice: x[4], sellingPrice: x[5],
    unit: x[3], size: '', applicableClass: '', taxRate: 0, hsnCode: '', description: '', active: true, createdBy: 'Demo Admin' }));
  const invSales = [];
  students.slice(0, 40).forEach((st, k) => {
    const lines = 1 + (k % 3);
    for (let l = 0; l < lines; l++) {
      const it = invItems[(k * 2 + l * 5) % invItems.length]; const qty = 1 + ((k + l) % 3);
      if (it.quantity < qty) continue;
      const unit = it.sellingPrice, total = unit * qty, paid = (k + l) % 7 === 0 ? Math.round(total / 2) : total;
      it.quantity -= qty;
      invSales.push({ id: `isale_demo_${k}_${l}`, itemId: it.id, itemName: it.name, buyerType: 'Student', studentId: st.id, buyerName: st.name, qty, unitPrice: unit, unitCost: it.costPrice, discount: 0,
        totalAmount: total, totalCost: it.costPrice * qty, paidAmount: paid, mode: pick(['Cash', 'UPI', 'Cash']), notes: '', date: isoDay(daysAgo(int(1, 60))), soldBy: 'Demo Accountant', sefId: '' });
    }
  });
  await api('PUT', '/api/kv/inventory-items', invItems);
  await api('PUT', '/api/kv/inventory-sales', invSales);
  console.log(`  ${ROUTES.length} routes, ${HOSTEL_ROOMS.length} hostel rooms, ${tt.length} timetable slots, ${libBooks.length} books, ${invItems.length} products, ${invSales.length} sales`);

  // Public-website content (Website Gallery > Website Content) so a demo website shows every section
  await api('PUT', '/api/kv/website-extras', {
    alumni: [
      { id: 'wa1', show: true, name: 'Anitha Rao', batch: '2012', now: 'Doctor, District Hospital', quote: 'The teachers here believed in me before I did.' },
      { id: 'wa2', show: true, name: 'Rahul Verma', batch: '2014', now: 'Software Engineer', quote: 'Strong basics from school made college easy.' },
      { id: 'wa3', show: true, name: 'Meena Joshi', batch: '2016', now: 'Teacher', quote: '' }
    ],
    achievements: [
      { id: 'wc1', show: true, title: 'District Kabaddi Champions', year: '2025', category: 'Sports', detail: 'Our under-16 team won the district final.' },
      { id: 'wc2', show: true, title: '100% result in Class 10', year: '2025', category: 'Academics', detail: 'Every student passed, 18 with distinction.' },
      { id: 'wc3', show: true, title: 'Inter-school Drawing Prize', year: '2026', category: 'Arts', detail: 'First prize in the zonal drawing competition.' }
    ],
    safety: [], downloads: [],
    transport: { gps: true },
    recognition: { board: 'State Board', medium: 'English', recognition: 'Recognised school', timings: '9:00 AM – 4:00 PM' },
    admission: { open: true, heading: 'Admissions open for 2026-27', lastDate: 'Last date 30 April', hours: 'Mon–Sat, 9:00 AM – 4:00 PM' },
    results: { label: 'Class 10 — 2025', pass: '100%' },
    visible: {}, academics: {}, ratio: {}
  });

  // Remove the temporary seeder login
  await sql`DELETE FROM sessions WHERE user_id = 'u_seeder'`;
  await sql`DELETE FROM users WHERE id = 'u_seeder'`;
  console.log('\nDone. Demo logins (password for all: ' + DEMO_PASSWORD + '):');
  ['demo.admin', 'demo.principal', 'demo.accountant', 'demo.office', 'demo.teacher', 'demo.parent', 'demo.student'].forEach(u => console.log('  ' + u));
}

const _run = main();
export const finished = globalThis.__demoFetch
  ? _run
  : _run.then(() => closePool()).catch(async e => { console.error('SEED FAILED:', e.message, e.cause ? '(cause: ' + (e.cause.code || e.cause.message || e.cause) + ')' : ''); try { await closePool(); } catch (x) {} process.exit(1); });
