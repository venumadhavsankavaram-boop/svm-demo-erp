# Bringing a school's old ERP data into SVM EdTech ERP

For you (Venu) to run during setup. Schools never touch this.

## What to ask the school for (any ERP: Vidya ERP, mPencil, others)
1. **Student list** as Excel/CSV (Admission No, Name, Class, Section, Father name, Mobile, DOB).
   Every old ERP has an "Export to Excel" on the student list. This is the best route.
2. **Fee Due report** (class-wise or student-wise) as PDF. Typed PDFs work; scanned/photographed ones do not.
3. Anything else they have (staff list, marks, attendance): ask for Excel; we add these step by step.

## Steps
1. Make sure the new school's ERP is running and you have its Admin login.
2. **Students first (dry run, saves nothing):**
   `node migration/import-data.mjs --students old-students.xlsx`
   Read the column guesses and the ERRORS / WARNINGS list. Fix the sheet (or tell me) and run again until it is clean.
3. **Import them:** set the Admin login, then add `--apply`
   `IMPORT_USER=admin IMPORT_PASS=... node migration/import-data.mjs --students old-students.xlsx --apply`
4. **Fee dues:** turn the PDF into text, check, then apply
   `pdftotext -layout Fee_Due_List.pdf due.txt`
   `node migration/import-data.mjs --feedue due.txt`  (the check must say "totals match the old report exactly")
   `IMPORT_USER=admin IMPORT_PASS=... node migration/import-data.mjs --feedue due.txt --apply`
5. Open the ERP: Dashboard student count and the "Previous Dues" total should equal the old report.

## Safe by design
- Dry run is the default. Nothing is saved without `--apply`.
- Students already in the ERP (same admission number) are skipped, never duplicated.
- Rows with real problems (no name, no class, repeated admission number) are held back and listed.
- Fee dues are only added if the totals read from the PDF match the totals printed on it.

## Limits (honest)
- Opening dues are added as "Previous Dues (opening balance)". Past receipts are not re-created.
- Scanned PDFs, photos and password-protected files cannot be read automatically.
- Old marks, attendance and accounting differ in every ERP; each needs its own reader (next phases).
- Odd class names: use `--class-map=map.json` ({"Grade 4": "4th Class"}). Given-name-first sheets: `--name-order=given-first`.
