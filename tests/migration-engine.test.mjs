// node tests/migration-engine.test.mjs
import assert from 'node:assert/strict';
import { parseCsv, tableFromRows, autoMapColumns, buildStudents, importable, normalizeClass, cleanPhone, cleanDate, splitName, parseFeeDueReport, buildOpeningDues, reconcile, normStatusWord, cleanAcademicYear } from '../migration/import-engine.mjs';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('class names from other ERPs become ours', () => {
  const cases = { 'I STD': '1st Class', 'X STD': '10th Class', '3': '3rd Class', 'Class 12': '12th Class', 'BABY': 'Baby Class', 'Nursery': 'Baby Class', 'LKG': 'LKG', 'U.K.G': 'UKG', '2nd': '2nd Class', 'XI': '11th Class' };
  for (const [a, b] of Object.entries(cases)) assert.equal(normalizeClass(a), b, a);
  assert.equal(normalizeClass('Pre-Primary X'), 'Pre-Primary X');
  assert.equal(normalizeClass('Grade 4', { 'Grade 4': '4th Class' }), '4th Class');
});
t('phones, dates, names', () => {
  assert.equal(cleanPhone('+91 98765 43210'), '9876543210'); assert.equal(cleanPhone('12345'), '');
  assert.equal(cleanDate('05/07/2014'), '2014-07-05'); assert.equal(cleanDate('2014-7-5'), '2014-07-05'); assert.equal(cleanDate('rubbish'), '');
  assert.deepEqual(splitName('REDDY VARSHITHA E'), { lastName: 'Reddy', firstName: 'Varshitha E' });
  assert.deepEqual(splitName('VIVAN'), { firstName: 'Vivan', lastName: '' });
  assert.deepEqual(splitName('Sita Rao', 'given-first'), { firstName: 'Sita', lastName: 'Rao' });
});
t('columns are guessed from different ERP spellings', () => {
  const m = autoMapColumns(['S.No', 'Adm No', 'Student Name', 'Std', 'Sec', 'Father Name', 'Mobile No', 'D.O.B', 'Remarks']);
  assert.equal(m.map['Adm No'], 'admissionNo'); assert.equal(m.map['Student Name'], 'name'); assert.equal(m.map['Std'], 'className');
  assert.equal(m.map['Mobile No'], 'contact'); assert.equal(m.map['D.O.B'], 'dob'); assert.equal(m.map['Remarks'], null);
  assert.deepEqual(m.missing, []);
  assert.deepEqual(autoMapColumns(['Adm No', 'Phone']).missing, ['name', 'className']);
});
t('students are cleaned, duplicates and existing ones are caught', () => {
  const csv = 'Admission No,Name,Class,Section,Mobile,DOB\n101,RAO SITA,I STD,a,98765 43210,05/07/2014\n102,KUMAR RAVI,II STD,,12345,\n101,DUP PERSON,I STD,A,9876543211,\n103,OLD KID,III STD,A,9876543212,\n104,,I STD,A,,\n';
  const { headers, records } = tableFromRows(parseCsv(csv));
  const m = autoMapColumns(headers);
  const { students, problems } = buildStudents(records, { map: m.map, existing: [{ admissionNo: '103' }] });
  const ok = importable(students, problems);
  assert.deepEqual(ok.map(s => s.admissionNo), ['101', '102']);
  assert.equal(students[0].className, '1st Class'); assert.equal(students[0].section, 'A'); assert.equal(students[0].contact, '9876543210'); assert.equal(students[0].dob, '2014-07-05');
  const lv = x => problems.filter(p => p.level === x).length;
  assert.equal(lv('error'), 2); assert.equal(lv('skip'), 1); assert.ok(problems.some(p => /not a valid 10-digit/.test(p.message)));
  assert.equal(new Set(students.map(s => s.id)).size, students.length);
});
t('Crystal-style fee due report: rows, wrapped names, reconcile', () => {
  const txt = [
    'Class : I STD',
    '1       25-X-0001   01   REDDY VARSHITHA E       7702055260 22800    0    22800   17500   5300',
    '2       25-X-0002   02   HIMANYA REDDY MIDDI     8496033791 21800    0    21800   14800   7000',
    '                         VENAKA',
    '                                    Total:    44600  0  44600  32300  12300',
    'Class : BABY',
    '3       26-X-0003   1    VIVAN                   8179929909 10000    0    10000   1000    9000',
    '                    Grand Total:      54600    0    54600    33300    21300',
  ].join('\n');
  const { rows, grand } = parseFeeDueReport(txt);
  assert.equal(rows.length, 3); assert.equal(rows[1].name, 'HIMANYA REDDY MIDDI VENAKA'); assert.equal(rows[2].className, 'BABY');
  assert.equal(reconcile(rows, grand).ok, true);
  rows[0].due += 1; assert.equal(reconcile(rows, grand).ok, false);
  rows[0].due -= 1;
  const by = new Map([['25-x-0001', { id: 's1' }], ['25-x-0002', { id: 's2' }]]);
  const r = buildOpeningDues(rows, by, { date: '2026-11-25' });
  assert.equal(r.entries.length, 2); assert.equal(r.total, 12300); assert.equal(r.problems.length, 1);
  assert.deepEqual([r.entries[0].kind, r.entries[0].name, r.entries[0].paid], ['opening', 'Previous Dues (opening balance)', false]);
});
t('past students: status, year left and joined class are read', () => {
  assert.deepEqual(['Passed out', 'TC issued', 'Left', 'Studying', 'banana'].map(normStatusWord), ['Passed Out', 'Transferred', 'Inactive', 'Active', '']);
  assert.deepEqual(['2025-26', '2025-2026', '2025/26', '2026', '2025-27', 'abc'].map(cleanAcademicYear), ['2025-26', '2025-26', '2025-26', '2025-26', '', '']);
  const csv = 'Adm No,Name,Std,Status,Year Left,Class Joined\n1,RAO SITA,X STD,Passed Out,2025-26,LKG\n2,KUMAR RAVI,VII STD,TC,,\n3,NEW KID,II STD,,,\n4,ODD ONE,V STD,Weird,2025-27,';
  const { headers, records } = tableFromRows(parseCsv(csv)); const m = autoMapColumns(headers);
  assert.equal(m.map['Status'], 'status'); assert.equal(m.map['Year Left'], 'passedOutYear'); assert.equal(m.map['Class Joined'], 'joinedClass');
  const { students, problems } = buildStudents(records, { map: m.map });
  assert.deepEqual(students.map(x => x.status), ['Passed Out', 'Transferred', 'Active', 'Active']);
  assert.equal(students[0].passedOutYear, '2025-26'); assert.equal(students[0].joinedClass, 'LKG'); assert.equal(students[0].admissionClass, 'LKG');
  assert.equal(students[2].passedOutYear, undefined);
  const msgs = problems.map(p => p.message).join(' | ');
  assert.match(msgs, /Transferred student has no "year left"/); assert.match(msgs, /Status "Weird" not understood/); assert.match(msgs, /Year left "2025-27" not understood/);
  assert.equal(importable(students, problems).length, 4);
});
t('current-only skips past students', () => {
  const csv = 'Adm No,Name,Std,Status\n1,RAO SITA,X STD,Passed Out\n2,KUMAR RAVI,VII STD,Active\n3,NEW KID,II STD,';
  const { headers, records } = tableFromRows(parseCsv(csv)); const m = autoMapColumns(headers);
  const { students, problems } = buildStudents(records, { map: m.map, currentOnly: true });
  assert.deepEqual(importable(students, problems).map(x => x.admissionNo), ['2', '3']);
  assert.match(problems.map(p => p.message).join('|'), /Past student \(Passed Out\) - skipped/);
});
console.log(`\n${n} migration tests passed`);
