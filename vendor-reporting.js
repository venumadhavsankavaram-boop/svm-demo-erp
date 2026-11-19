// Vendor Fleet Reporting Client — a small, optional, fail-silent module a
// school's own ERP server can load to report its status to your Vendor
// Fleet Dashboard (see ../vendor-dashboard). It sends a periodic heartbeat
// and reports unhandled errors. It is entirely opt-in per deployment:
//
//   - If the three env vars below aren't set, this does absolutely
//     nothing — no crash, no log noise, no network calls. A school you
//     haven't wired up to the dashboard yet is completely unaffected.
//   - Every network call is wrapped in try/catch with a short timeout and
//     never throws or blocks — the dashboard being slow, asleep, or
//     unreachable can never cause a problem for the school's own ERP.
//   - It never sends anything about the school's actual data (no student
//     records, no attendance, no fees) — only operational signals: "I'm
//     alive", and "here's an error message and stack trace".
//
// ---------------------------------------------------------------------
// HOW TO ADD THIS TO A SCHOOL'S server.js
// ---------------------------------------------------------------------
// 1. Copy this file into that school's project (e.g. alongside server.js).
// 2. Near the top of server.js, after the other imports, add:
//
//      import { startVendorReporting, reportVendorError } from './vendor-reporting.js';
//      startVendorReporting();
//
// 3. To also catch errors from within a specific route handler's catch
//    block (recommended for your main resource handler), call:
//
//      reportVendorError(err, { route: req.path });
//
//    in a catch block, alongside your existing console.error(...) — this
//    is additive, not a replacement for the school's own error logging.
//
// 3b. (Optional) If you want this school's own "Contact Support" /
//     "Report an Issue" screen to land directly in the vendor dashboard's
//     Support tab instead of (or in addition to) email/phone, call:
//
//      import { reportVendorQuery } from './vendor-reporting.js';
//      reportVendorQuery('Cannot generate report cards', 'Getting a blank page for Class 10.', 'high');
//
//     Same opt-in behavior as everything else here: a no-op if the three
//     env vars below aren't set.
//
// 4. In that school's Render service, set three environment variables:
//      VENDOR_DASHBOARD_URL   e.g. https://your-vendor-dashboard.onrender.com
//      VENDOR_SCHOOL_ID       from the dashboard's "Add School" / "Edit School" screen
//      VENDOR_API_KEY         from the same screen (regenerate any time if it leaks)
//
// That's it — nothing else in server.js needs to change, and leaving these
// env vars unset (e.g. for a school you don't want reporting) is fully
// supported and silent.
// ---------------------------------------------------------------------

const DASHBOARD_URL = process.env.VENDOR_DASHBOARD_URL;
const SCHOOL_ID = process.env.VENDOR_SCHOOL_ID;
const API_KEY = process.env.VENDOR_API_KEY;
const ENABLED = Boolean(DASHBOARD_URL && SCHOOL_ID && API_KEY);

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
// A free-tier Render service (the vendor dashboard itself, most likely)
// spins down after ~15 minutes idle and can take 30-50+ seconds to cold-start
// on its next request. An 8-second timeout aborted that very first heartbeat
// after every idle period, every time — not a real failure, just too
// impatient for the hosting tier this was built against.
const FETCH_TIMEOUT_MS = 45000;
const ERROR_DEDUPE_WINDOW_MS = 5 * 60 * 1000; // don't spam the same error repeatedly

let lastErrorSignatures = new Map(); // message -> last-sent timestamp

// A manual, vendor-triggered access cutoff for non-payment — see the Vendor
// Dashboard's Schools tab ("Suspend Access" / "Restore Access"). This is
// NEVER set locally and never inferred from anything in this file; it only
// ever reflects the last value the dashboard's own heartbeat response
// confirmed. Starts (and, if reporting is disabled, stays) un-suspended —
// this must fail OPEN: a school you haven't wired to the dashboard, or a
// dashboard that's temporarily unreachable, must never lock its own users
// out as a side effect. It only changes once a real heartbeat response says
// so, and keeps the last confirmed value across failed heartbeats in
// between (a blip in reaching the dashboard doesn't silently lift, or
// silently impose, a suspension).
let accessStatus = { suspended: false, reason: null };

/** Read by server.js's login route. Safe to call even if reporting is disabled. */
export function isAccessSuspended() {
  return accessStatus;
}

// The vendor dashboard's "Plan" picker (Schools tab → edit a school → Plan)
// bills at 4 module buckets — fees, attendance, exams, and a combined
// transport+library — but this ERP's own Roles & Permissions system already
// has finer-grained module keys (managefee, attendance, exams, result,
// transport, library — see RESOURCE_TO_MODULE/SERVER_ROLE_VIEWS in
// server.js). This maps one to the other so server.js never needs to know
// the dashboard's own bucket names.
const PLAN_MODULE_TO_ERP_KEYS = {
  fees: ['managefee'],
  attendance: ['attendance'],
  exams: ['exams', 'result'],
  transport_library: ['transport', 'library'], // older plans (Transport + Library together) keep working
  // Finer choices (added so a school can buy only what it needs):
  accounting: ['accounting'],
  staff_basic: ['staff'],            // staff directory, departments, ID cards, staff attendance (Core and above)
  staff_payroll: ['staff', 'staffpay'], // + payroll and salary posting (Complete)
  inventory: ['inventory'],
  hostel: ['hostel'],
  transport: ['transport'],
  library: ['library'],
  timetable_homework: ['timetable', 'syllabus'],
  communications: ['announcements', 'inbox', 'noticeboard'],
};

// Mirrors accessStatus above in every way that matters: never set locally,
// never inferred, only ever updated from a real successful heartbeat
// response, and must fail OPEN — `restricted: false` (every module
// available) is both the starting value and what a school with no Plan set,
// an "All Modules" Plan, or an unreachable/not-yet-configured dashboard
// gets. Only "ERP — Selected Modules" ever produces `restricted: true`.
const OPEN_FEATURES = { parentLogin: true, teacherLogin: true, parentApp: true };
let moduleAccess = { restricted: false, enabledKeys: [], website: true, features: OPEN_FEATURES };

// The plan this school was SOLD, set at launch time in the school's own
// secrets as SCHOOL_PLAN so it still applies before the first heartbeat and
// when the dashboard is unreachable (the dashboard alone fails open):
//   SCHOOL_PLAN=all_website                    ERP, every module, plus the public website
//   SCHOOL_PLAN=all                            ERP only, every module (no website screens)
//   SCHOOL_PLAN=selected:fees,attendance       ERP only, just these buckets
//        buckets: fees, attendance, exams, accounting, staff_payroll, inventory, hostel,
//                 transport, library, timetable_homework, communications (transport_library = old combined one)
// Unset = no local plan (every module, website screens shown) - exactly the
// behaviour of every school launched before this existed.
// A plan the dashboard confirms by heartbeat always wins over this; this is
// only what applies until then, or when the dashboard has no plan for the school.
// The five per-student plans (svmedtech.com price list) and the module buckets each one switches on.
// The vendor dashboard sends the same list in planModules at every heartbeat and that always wins;
// this table is only what applies until the first heartbeat, or when the dashboard is unreachable.
const TIER_BUCKETS = {
  starter: ['fees', 'attendance', 'communications'],
  basic: ['fees', 'attendance', 'exams', 'communications'],
  core: ['fees', 'attendance', 'exams', 'communications', 'timetable_homework', 'staff_basic'],
  complete: ['fees', 'attendance', 'exams', 'accounting', 'staff_basic', 'staff_payroll', 'inventory', 'hostel', 'transport', 'library', 'timetable_homework', 'communications'],
  complete_website: ['fees', 'attendance', 'exams', 'accounting', 'staff_basic', 'staff_payroll', 'inventory', 'hostel', 'transport', 'library', 'timetable_homework', 'communications'],
};
// Which logins and apps each current plan includes (standard: a role not in the plan gets no login, and its
// connected screens, such as the Inbox, disappear). The dashboard sends the same table as planFeatures.
const TIER_FEATURES = {
  starter:          { parentLogin: false, teacherLogin: false, parentApp: false },
  basic:            { parentLogin: true,  teacherLogin: false, parentApp: false },
  core:             { parentLogin: true,  teacherLogin: true,  parentApp: false },
  complete:         { parentLogin: true,  teacherLogin: true,  parentApp: true },
  complete_website: { parentLogin: true,  teacherLogin: true,  parentApp: true },
};
function accessForBuckets(buckets, website, features) {
  const f = Object.assign({}, OPEN_FEATURES, features || {});
  let enabledKeys = [];
  (Array.isArray(buckets) ? buckets : []).forEach(b => { if (PLAN_MODULE_TO_ERP_KEYS[b]) enabledKeys.push(...PLAN_MODULE_TO_ERP_KEYS[b]); });
  // The Inbox is for messages with teachers: without the Teacher login it has no purpose, so it goes too.
  if (!f.teacherLogin) enabledKeys = enabledKeys.filter(k => k !== 'inbox');
  return { restricted: true, enabledKeys, website: !!website, features: f };
}
// Is this role allowed to sign in under the school's plan? Office and admin roles are never blocked.
export function planBlocksRole(role) {
  const f = (moduleAccess && moduleAccess.features) || OPEN_FEATURES;
  if (role === 'Student' || role === 'Parent') return f.parentLogin === false ? 'Parent and student logins are not included in your school\'s plan.' : null;
  if (role === 'Teacher') return f.teacherLogin === false ? 'Teacher logins are not included in your school\'s plan.' : null;
  return null;
}
//   SCHOOL_PLAN=starter | basic | core | complete | complete_website   (the five current plans)
function localPlanFromEnv() {
  const raw = String(process.env.SCHOOL_PLAN || '').trim().toLowerCase();
  if (!raw) return null;
  if (TIER_BUCKETS[raw]) return accessForBuckets(TIER_BUCKETS[raw], raw === 'complete_website', TIER_FEATURES[raw]);
  if (raw === 'all_website' || raw === 'erp_all_modules_website') return { restricted: false, enabledKeys: [], website: true };
  if (raw === 'all' || raw === 'erp_all_modules') return { restricted: false, enabledKeys: [], website: false };
  const m = raw.match(/^(?:selected|erp_selected_modules)\s*:\s*(.*)$/);
  if (m) {
    const enabledKeys = [];
    m[1].split(',').map(x => x.trim()).filter(Boolean).forEach(b => { if (PLAN_MODULE_TO_ERP_KEYS[b]) enabledKeys.push(...PLAN_MODULE_TO_ERP_KEYS[b]); });
    return { restricted: true, enabledKeys, website: false };
  }
  return null; // not understood: stay open rather than lock a school out by a typo
}
const LOCAL_PLAN = localPlanFromEnv();
if (LOCAL_PLAN) moduleAccess = LOCAL_PLAN;

/**
 * Read by server.js (to gate the API) and forwarded to the client (to hide
 * the corresponding nav items) via the login/session response. Safe to call
 * even if reporting is disabled — returns the always-unrestricted default.
 */
export function getModuleAccess() {
  return moduleAccess;
}

async function postToDashboard(path, body) {
  if (!ENABLED) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DASHBOARD_URL.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ schoolId: SCHOOL_ID, apiKey: API_KEY }, body)),
      signal: controller.signal,
    });
    try { return await res.json(); } catch (e) { return null; }
  } catch (e) {
    // Deliberately silent — the vendor dashboard being unreachable must
    // never affect this school's own server. Nothing to log here that
    // the dashboard's own "offline" status won't already show you.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// server.js registers a function that returns how many students are active right now; it is sent with every
// heartbeat so the vendor dashboard can bill a per-student plan from the real number. Fail-silent like everything here.
let studentCounter = null;
export function setStudentCounter(fn) { studentCounter = typeof fn === 'function' ? fn : null; }

async function sendHeartbeat() {
  let activeStudents;
  try { if (studentCounter) { const n = Number(await studentCounter()); if (Number.isFinite(n) && n >= 0) activeStudents = Math.round(n); } } catch (e) { /* not ready yet: skip this time */ }
  const result = await postToDashboard('/api/ingest/heartbeat', {
    meta: {
      activeStudents,
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      reportedAt: new Date().toISOString(),
    },
  });
  // Only ever updated from a real, successful response — see accessStatus's
  // own comment above for why a failed/missing response leaves it as-is.
  if (result && typeof result.accessSuspended === 'boolean') {
    accessStatus = { suspended: result.accessSuspended, reason: result.accessSuspendedReason || null };
  }
  // Same rule for the Plan/Modules gate — see moduleAccess's own comment.
  if (result && 'planType' in result) {
    if (TIER_BUCKETS[result.planType]) {
      // Current plans: the dashboard's module list decides (so a plan change or a one-off extra module applies at the next heartbeat).
      const list = Array.isArray(result.planModules) && result.planModules.length ? result.planModules : TIER_BUCKETS[result.planType];
      moduleAccess = accessForBuckets(list, result.planType === 'complete_website', Object.assign({}, TIER_FEATURES[result.planType], result.planFeatures || {}));
    } else if (result.planType === 'erp_selected_modules') {
      const enabledKeys = [];
      (Array.isArray(result.planModules) ? result.planModules : []).forEach(m => {
        if (PLAN_MODULE_TO_ERP_KEYS[m]) enabledKeys.push(...PLAN_MODULE_TO_ERP_KEYS[m]);
      });
      moduleAccess = { restricted: true, enabledKeys, website: false };
    } else if (result.planType === 'erp_all_modules') {
      moduleAccess = { restricted: false, enabledKeys: [], website: false };
    } else if (result.planType === 'erp_all_modules_website') {
      moduleAccess = { restricted: false, enabledKeys: [], website: true };
    } else {
      // null: the dashboard has no plan for this school yet. Keep what the
      // school's own SCHOOL_PLAN says, or open if none is set.
      moduleAccess = LOCAL_PLAN || { restricted: false, enabledKeys: [], website: true };
    }
  }
}

/** Call once, near the top of server.js, after the other imports. */
export function startVendorReporting() {
  if (!ENABLED) return;
  sendHeartbeat();
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS).unref();

  // Best-effort net for anything that slips past the app's own error
  // handling — catches truly unhandled cases without changing how they're
  // otherwise handled (Node still logs/exits per its own default behavior).
  process.on('uncaughtException', err => reportVendorError(err, { source: 'uncaughtException' }));
  process.on('unhandledRejection', reason => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    reportVendorError(err, { source: 'unhandledRejection' });
  });
}

/**
 * Call from a catch block to report an error, e.g.:
 *   catch (err) { console.error('save error:', err); reportVendorError(err, { route: req.path }); }
 * Safe to call even when reporting is disabled (env vars unset) — it's a no-op.
 */
export function reportVendorError(err, meta) {
  if (!ENABLED || !err) return;
  const message = String((err && err.message) || err).slice(0, 500);
  const now = Date.now();
  const lastSent = lastErrorSignatures.get(message);
  if (lastSent && now - lastSent < ERROR_DEDUPE_WINDOW_MS) return; // same error recently reported — skip
  lastErrorSignatures.set(message, now);
  // Keep the dedupe map from growing unbounded over a long-running process.
  if (lastErrorSignatures.size > 200) {
    const cutoff = now - ERROR_DEDUPE_WINDOW_MS;
    for (const [k, t] of lastErrorSignatures) if (t < cutoff) lastErrorSignatures.delete(k);
  }
  postToDashboard('/api/ingest/error', {
    message,
    stack: err && err.stack ? String(err.stack).slice(0, 4000) : undefined,
    meta,
  });
}

/**
 * Submit a support query directly into the vendor's Support tab — for a
 * school's own "Contact Support" screen, or a support-related error path,
 * to reach the vendor without email/phone. Safe to call even when
 * reporting is disabled (env vars unset) — it's a no-op.
 */
export function reportVendorQuery(subject, message, priority) {
  if (!ENABLED || !subject) return;
  postToDashboard('/api/ingest/query', {
    subject: String(subject).slice(0, 300),
    message: message ? String(message).slice(0, 4000) : undefined,
    priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
  });
}

/**
 * Demo install only: tells the vendor dashboard that a visitor started the demo, so the person shows up
 * in its Leads tab. Fire-and-forget; a no-op when reporting is disabled.
 */
export function reportDemoLead(lead) {
  if (!ENABLED || !lead) return;
  postToDashboard('/api/ingest/demo-lead', {
    name: String(lead.name || '').slice(0, 200), school: String(lead.school || '').slice(0, 200),
    phone: String(lead.phone || '').slice(0, 40), message: String(lead.message || '').slice(0, 1000),
  });
}
