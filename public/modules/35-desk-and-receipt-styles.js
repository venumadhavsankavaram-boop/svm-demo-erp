/* ============================================================================
   Fee counter screen styles + printed receipt styles (Admin chooses).

   Screen styles (Manage Fee > Receipt numbering card > "Fee counter screen"):
     classic  - the screen exactly as it always was (default)
     cashier  - Cashier desk: payment form on the left, receipts + today's list on the right
     modern   - Modern two-pane: receipts on the left, "Make a receipt" panel on the right
   Receipt styles ("Printed receipt style"):
     existing - the receipt exactly as it always was (default)
     formal, modern, slip (compact), thermal (80 mm roll printer)

   Only the LOOK changes. The payment form fields, validation, receipt numbering
   and saving are the same code as before. Nothing changes until Admin picks a style.
   ========================================================================== */
(function(){
  const DESKS = { classic: 'Classic (current screen)', cashier: 'Cashier desk', modern: 'Modern two-pane' };
  const RECEIPTS = { existing: 'Existing receipt (current)', formal: 'Formal (serif, bordered)', modern: 'Modern (colour header)', slip: 'Compact slip', thermal: 'Thermal roll (80 mm)' };
  window.DESK_STYLES = DESKS; window.RECEIPT_STYLES = RECEIPTS;
  const deskStyle = () => { const v = (typeof receiptSettings !== 'undefined' && receiptSettings && receiptSettings.deskStyle) || 'classic'; return DESKS[v] ? v : 'classic'; };
  const rcptStyle = () => { const v = (typeof receiptSettings !== 'undefined' && receiptSettings && receiptSettings.receiptStyle) || 'existing'; return RECEIPTS[v] ? v : 'existing'; };
  window.deskStyle = deskStyle; window.rcptStyle = rcptStyle;

  const esc = v => (typeof frcEsc === 'function' ? frcEsc(v) : String(v == null ? '' : v));
  const money = n => frcMoney(n);
  const inr0 = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  /* ------------------------------ settings ------------------------------ */
  window.styleSettingsHtml = function(canEdit){
    const dis = canEdit ? '' : 'disabled';
    const opts = (map, cur) => Object.keys(map).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${map[k]}</option>`).join('');
    return `<label class="ft-field"><span>Fee counter screen</span><select class="input" id="rsDesk" ${dis}>${opts(DESKS, deskStyle())}</select></label>
      <label class="ft-field"><span>Printed receipt style</span><select class="input" id="rsRcpt" ${dis}>${opts(RECEIPTS, rcptStyle())}</select></label>`;
  };

  /* ------------------------------ screen styles ------------------------------ */
  const css = `
  .dk-grid{display:flex;gap:24px;align-items:flex-start;margin-top:14px}
  .dk-left,.dk-right{min-width:0;display:flex;flex-direction:column;gap:16px}
  .dk-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#14213d;color:#fff;border-radius:12px;padding:10px 16px;margin:6px 0 0;font-size:13px}
  .dk-top b{font-family:ui-monospace,Consolas,monospace}
  .dk-last{margin-left:auto;background:#1f7a52;border-radius:8px;padding:6px 12px;font-weight:700}
  .dk-card{background:#fff;border:1px solid #dde3ee;border-radius:14px;padding:16px 18px}
  .dk-card h4{margin:0 0 10px;font-size:15px}
  .dk-card table{width:100%;border-collapse:collapse}
  .dk-card td{padding:8px 6px;border-bottom:1px solid #edf0f6;font-size:13px}
  .dk-mono{font-family:ui-monospace,Consolas,monospace}
  .dk-chips{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px}
  .dk-chip{border:1px solid #c9d1e0;border-radius:6px;padding:5px 11px;font:600 12px ui-monospace,Consolas,monospace;background:#fff;cursor:pointer}
  .dk-seg{display:flex;border:1px solid #c9d1e0;border-radius:8px;overflow:hidden;margin:4px 0 8px}
  .dk-seg button{flex:1;padding:10px 0;border:0;border-right:1px solid #c9d1e0;background:#fff;font-weight:600;cursor:pointer}
  .dk-seg button:last-child{border-right:0}.dk-seg button.on{background:#14213d;color:#fff}
  .dk-note{font-size:12px;color:#4a5878;text-align:center;margin-top:8px}
  body.dk-cashier .dk-left{width:540px;flex:none}
  body.dk-cashier .dk-left .sf-heads{display:flex;flex-direction:column;gap:8px}
  body.dk-cashier .dk-left .sf-paybar{display:flex;flex-direction:column;gap:12px;align-items:stretch}
  body.dk-cashier #quickPayAmt{font-size:24px;height:54px;font-weight:600}
  body.dk-cashier .dk-left .sf-paybar .sf-btn--lg,body.dk-cashier .dk-left .sf-paybar .btn-primary{width:100%;height:52px;font-size:16px;background:#1f7a52;border-color:#1f7a52}
  body.dk-modern .dk-grid{flex-direction:row}
  body.dk-modern .dk-left{flex:1}
  body.dk-modern .dk-right{width:470px;flex:none;background:#fff;border-radius:18px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(35,31,61,.08);padding:20px}
  body.dk-modern .dk-right .sf-heads{display:flex;flex-direction:column;gap:8px}
  body.dk-modern .dk-right .sf-paybar{display:flex;flex-direction:column;gap:10px;align-items:stretch}
  body.dk-modern .dk-right .sf-paybar .sf-btn--lg,body.dk-modern .dk-right .sf-paybar .btn-primary{width:100%;height:46px;border-radius:999px;background:#b0105f;border-color:#b0105f}
  .dk-left .sf-paybar,.dk-right .sf-paybar{width:100%;max-width:100%;margin:0;box-sizing:border-box;min-width:0;border:0;box-shadow:none;background:transparent;padding:0}
  .dk-left .sf-paybar>*,.dk-right .sf-paybar>*{width:100%;max-width:100%;min-width:0}
  .dk-left .sf-paybar input,.dk-left .sf-paybar select,.dk-right .sf-paybar input,.dk-right .sf-paybar select{width:100%;box-sizing:border-box}
  .dk-left .sf-paybar-total,.dk-right .sf-paybar-total{text-align:left}
  .dk-left .sf-paybar,.dk-right .sf-paybar{position:static !important;inset:auto !important;transform:none !important;margin-top:12px}
  .dk-right,.dk-left{overflow:visible}
  @media (max-width:1000px){.dk-grid{flex-direction:column}body.dk-cashier .dk-left,body.dk-modern .dk-right{width:100%}}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function lastReceiptNo(){
    let best = '';
    (payments || []).forEach(p => { if(!p.voided && p.receiptNo && String(p.receiptNo) > best) best = String(p.receiptNo); });
    return best;
  }
  function todayList(){
    const today = (typeof localISODate === 'function' ? localISODate() : new Date().toISOString().slice(0, 10));
    const by = {};
    (payments || []).forEach(p => {
      if(p.voided || p.date !== today || !p.receiptNo) return;
      const o = by[p.receiptNo] || (by[p.receiptNo] = { no: p.receiptNo, sid: p.studentId, amt: 0 });
      o.amt += Number(p.amount) || 0;
    });
    return Object.values(by).sort((a, b) => String(b.no).localeCompare(String(a.no)));
  }
  function nameOf(sid){ const s = (students || []).find(x => x.id === sid); return s ? (s.firstName + ' ' + (s.lastName || '')).trim() : '—'; }

  function addHelpers(root, style){
    const amt = root.querySelector('#quickPayAmt');
    const modeSel = root.querySelector('#ledgerPayMode');
    const bar = root.querySelector('.sf-paybar');
    if(!bar) return;
    if(amt){
      const chips = document.createElement('div'); chips.className = 'dk-chips';
      const vals = [['Full', null], ['₹3,000', 3000], ['₹2,000', 2000], ['₹1,000', 1000]];
      vals.forEach(([lab, v]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'dk-chip'; b.textContent = lab;
        b.onclick = () => {
          const full = v == null;
          const val = full ? (window.__dkDue || 0) : v;
          if(!val) return;
          amt.value = val; if(typeof onQuickPayInput === 'function') onQuickPayInput();
        };
        chips.appendChild(b);
      });
      amt.closest('label').after(chips);
    }
    if(modeSel){
      const seg = document.createElement('div'); seg.className = 'dk-seg';
      Array.from(modeSel.options).forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = o.textContent;
        if(o.selected) b.className = 'on';
        b.onclick = () => { modeSel.value = o.value; Array.from(seg.children).forEach(x => x.className = ''); b.className = 'on'; modeSel.dispatchEvent(new Event('change')); };
        seg.appendChild(b);
      });
      modeSel.closest('label').after(seg); modeSel.closest('label').style.display = 'none';
    }
    const note = document.createElement('div'); note.className = 'dk-note';
    note.textContent = 'The receipt number is given when you press Save.';
    bar.appendChild(note);
  }

  function restyle(body, style){
    const hero = body.querySelector('.sf-hero');
    const titles = Array.from(body.children).filter(el => el.classList && el.classList.contains('dash-section-title'));
    const pendTitle = titles.find(t => /Pending Fees/.test(t.textContent));
    const heads = body.querySelector('.sf-heads');
    const bar = body.querySelector('.sf-paybar');
    if(!hero || !heads || !bar || !pendTitle) return;          // nothing to pay (or family view): leave the page as it is
    const formParts = [pendTitle, heads, bar];
    const rest = Array.from(body.children).filter(el => el !== hero && !formParts.includes(el) && !(el.classList && el.classList.contains('breadcrumb')));
    // total still due for the "Full" chip
    const tot = (bar.querySelector('.sf-paybar-total small') || {}).textContent || '';
    const m = tot.match(/of\s*₹?\s*([\d,]+(?:\.\d+)?)/); window.__dkDue = m ? Number(m[1].replace(/,/g, '')) : 0;

    const top = document.createElement('div'); top.className = 'dk-top';
    const last = lastReceiptNo(); const tl = todayList();
    top.innerHTML = `<b style="font-family:inherit">Fee counter</b><span>Today: <b>${inr0(tl.reduce((a, x) => a + x.amt, 0))}</b> · ${tl.length} receipt${tl.length === 1 ? '' : 's'}</span>${last ? `<span class="dk-last">Last receipt issued: <b>${esc(last)}</b></span>` : ''}`;
    const grid = document.createElement('div'); grid.className = 'dk-grid';
    const L = document.createElement('div'); L.className = 'dk-left';
    const R = document.createElement('div'); R.className = 'dk-right';
    const formCard = document.createElement('div'); formCard.className = style === 'cashier' ? 'dk-card' : '';
    formParts.forEach(el => formCard.appendChild(el));
    const restWrap = document.createElement('div'); restWrap.style.cssText = 'display:flex;flex-direction:column;gap:16px;min-width:0';
    rest.forEach(el => restWrap.appendChild(el));
    if(style === 'cashier'){
      L.appendChild(formCard); R.appendChild(restWrap);
      const t = document.createElement('div'); t.className = 'dk-card';
      t.innerHTML = `<h4>Today at the counter <span style="font-weight:400;color:#4a5878;font-size:13px">· latest first</span></h4>` +
        (tl.length ? `<table><tbody>${tl.slice(0, 8).map(x => `<tr><td class="dk-mono"><b>${esc(String(x.no).split('-').pop())}</b></td><td>${esc(nameOf(x.sid))}</td><td class="dk-mono" style="text-align:right">${money(x.amt)}</td></tr>`).join('')}</tbody></table>` : '<div style="color:#4a5878;font-size:13px">No receipts yet today.</div>');
      R.appendChild(t);
    } else {
      L.appendChild(restWrap); R.appendChild(formCard);
    }
    grid.appendChild(L); grid.appendChild(R);
    hero.after(top); top.after(grid);
    addHelpers(formCard, style);
  }

  if(typeof renderStudentLedger === 'function'){
    const orig = renderStudentLedger;
    renderStudentLedger = function(body){
      const r = orig.apply(this, arguments);
      document.body.classList.remove('dk-cashier', 'dk-modern');
      const style = deskStyle();
      if(style !== 'classic' && body){
        try { restyle(body, style); document.body.classList.add('dk-' + style); }
        catch(e){ console.warn('Counter style skipped:', e); }
      }
      return r;
    };
    window.renderStudentLedger = renderStudentLedger;
  }

  /* ------------------------------ receipt styles ------------------------------ */
  function itemsRows(d, withInst){
    return d.recs.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(feeLabelFor(r))}</b>${r.note ? ` <small>${esc(r.note)}</small>` : ''}</td>${withInst ? `<td>${esc(frcInstalmentText(r))}</td>` : ''}<td class="a">${money(r.amount)}</td></tr>`).join('');
  }
  function ctx(d){
    const s = d.s, rel = s.fatherName ? 'Father' : (s.motherName ? 'Mother' : 'Guardian');
    return { name: (s.firstName + ' ' + (s.lastName || '')).trim(), cls: `${s.className} — ${s.section}`, rel,
      school: schoolInfo.name || 'School', addr: schoolInfo.address || '', phone: schoolInfo.phone || '',
      note: (typeof fpSettings !== 'undefined' && fpSettings && fpSettings.receiptNote) || 'Computer-generated receipt.' };
  }
  const SHARED = `
    *{box-sizing:border-box}html,body{margin:0}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#dfe1ea}
    .bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:8px 10px;background:#211A4E;color:#fff;font:13px 'Segoe UI',Arial,sans-serif}
    .bar button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:7px 14px;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}
    .bar button.on{background:#E9B949;color:#211A4E}.bar .go{background:#168a5f}
    .sheet{width:210mm;height:148mm;margin:10px auto;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.18);overflow:hidden;display:flex}
    .half{width:105mm;height:148mm;padding:4mm;overflow:hidden;flex:none}.half+.half{border-left:1.5px dashed #aaa}
    .copy{height:100%;overflow:hidden;display:flex;flex-direction:column}
    .a{text-align:right;white-space:nowrap}
    @media print{body{background:#fff}.bar{display:none}.sheet{margin:0;box-shadow:none}}`;

  const STYLES = {
    formal: {
      css: `.copy{font-family:Georgia,'Times New Roman',serif;color:#1d1a4d;border:1.5px solid #1d1a4d;padding:3mm;font-size:9px}
        .f-hd{display:flex;gap:7px;align-items:center;border-bottom:2px solid #1d1a4d;padding-bottom:4px}
        .f-hd img{width:30px;height:30px;border-radius:50%;object-fit:cover}.f-sch{font-size:12px;font-weight:700;line-height:1.15}.f-ad{font:7px Arial,sans-serif;color:#555}
        .f-t{display:flex;justify-content:space-between;align-items:flex-end;margin:5px 0 4px}.f-t b{font-size:12px;letter-spacing:1px}.f-t span{font:700 9px Arial,sans-serif}
        .f-g{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;background:#f5f4fa;padding:4px 6px;font:8px Arial,sans-serif;border-radius:3px}.f-g i{font-style:normal;color:#666}
        table{border-collapse:collapse;width:100%;margin-top:5px;font:8.5px Arial,sans-serif}th{text-align:left;font-size:6.5px;text-transform:uppercase;border-bottom:1.3px solid #1d1a4d;padding:2px 3px}
        td{padding:3.5px 3px;border-bottom:1px solid #e4e2ee}.n{width:12px;color:#888}.tot td{font-weight:700;font-size:10px;border-bottom:0;border-top:1.3px solid #1d1a4d}
        .f-w{margin-top:4px;padding:3px 5px;border:1px dashed #b9b4d4;font:7.5px Arial,sans-serif}.f-d{margin-top:3px;font:8px Arial,sans-serif}
        .f-s{margin-top:auto;display:flex;justify-content:space-between;font:7px Arial,sans-serif;color:#555;padding-top:14px}.f-s span{border-top:1px solid #333;padding-top:2px;width:34mm}`,
      copy: (lab, d, c) => `<section class="copy"><div class="f-hd">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : ''}<div><div class="f-sch">${esc(c.school)}</div><div class="f-ad">${esc(c.addr)}${c.phone ? ' · Ph: ' + esc(c.phone) : ''}</div></div></div>
        <div class="f-t"><b>FEE RECEIPT</b><span>No. ${esc(d.receiptNo)} · ${esc(lab)}</span></div>
        <div class="f-g"><div><i>Student:</i> <b>${esc(c.name)}</b></div><div><i>Date:</i> <b>${esc(d.date)}</b></div><div><i>Class:</i> <b>${esc(c.cls)}</b></div><div><i>Adm. no.:</i> <b>${esc(d.s.admissionNo)}</b></div><div><i>${c.rel}:</i> <b>${esc(d.parentName)}</b></div><div><i>Mode:</i> <b>${esc(d.mode)}</b></div></div>
        <table><thead><tr><th>#</th><th>Fee head</th><th>Period</th><th class="a">Amount (₹)</th></tr></thead><tbody>${itemsRows(d, true)}</tbody><tfoot>${d.disc > 0 ? `<tr><td colspan="3" class="a">Discount allowed</td><td class="a">${money(d.disc)}</td></tr>` : ''}<tr class="tot"><td colspan="3" class="a">Total received</td><td class="a">₹ ${money(d.netPaid)}</td></tr></tfoot></table>
        <div class="f-w">In words: <b>${esc(d.words)}</b></div><div class="f-d">Balance due after this receipt: <b>₹ ${money(d.due)}</b></div>
        <div class="f-s"><span>Parent / guardian</span><span style="text-align:right">${esc(d.signer)}</span></div><div style="font:6px Arial;color:#777;margin-top:3px">${esc(c.note)}${d.collector ? ' · Collected by ' + esc(d.collector) : ''}</div></section>`
    },
    modern: {
      css: `.copy{font-family:'Segoe UI',Arial,sans-serif;color:#231f3d;border:1px solid #d6d2e6;border-radius:8px;font-size:9px}
        .m-hd{background:#b0105f;color:#fff;padding:7px 9px;display:flex;gap:7px;align-items:center}.m-hd img{width:28px;height:28px;border-radius:50%;background:#fff;object-fit:cover}
        .m-sch{font-size:11.5px;font-weight:700;line-height:1.15}.m-ad{font-size:6.8px;opacity:.9}
        .m-b{padding:6px 9px;display:flex;flex-direction:column;flex:1;min-height:0}.m-no{display:flex;justify-content:space-between;align-items:flex-start}
        .m-no small{display:block;font-size:6.3px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#6a6685}.m-no b{font-size:13px}
        .m-who{background:#f6f2f4;border-radius:8px;padding:5px 7px;margin:5px 0;display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;font-size:8px}.m-who small{display:block;font-size:6px;color:#6a6685;font-weight:600;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;font-size:9px}td{padding:4px 0;border-bottom:1px solid #ece9f5}.n{display:none}td small{display:block;color:#6a6685;font-size:7px}
        .m-tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;padding:7px 9px;background:#231f3d;color:#fff;border-radius:8px}.m-tot b{font-size:14px}
        .m-w{margin-top:4px;font-size:8px;color:#6a6685}.m-bal{margin-top:5px;font-size:8.5px}.m-bal b{color:#b0105f}
        .m-s{margin-top:auto;display:flex;justify-content:space-between;font-size:7px;color:#6a6685;padding-top:14px}.m-s span{border-top:1px solid #231f3d;padding-top:2px;width:32mm}`,
      copy: (lab, d, c) => `<section class="copy"><div class="m-hd">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : ''}<div><div class="m-sch">${esc(c.school)}</div><div class="m-ad">${esc(c.addr)}${c.phone ? ' · Ph: ' + esc(c.phone) : ''}</div></div></div>
        <div class="m-b"><div class="m-no"><div><small>Fee receipt · ${esc(lab)}</small><b>${esc(d.receiptNo)}</b></div><div style="text-align:right"><small>Date</small><b style="font-size:10px">${esc(d.date)}</b></div></div>
        <div class="m-who"><div><small>Student</small><b>${esc(c.name)}</b></div><div><small>Class</small><b>${esc(c.cls)}</b></div><div><small>Adm. no.</small><b>${esc(d.s.admissionNo)}</b></div><div><small>Paid by</small><b>${esc(d.mode)}</b></div></div>
        <table><tbody>${d.recs.map(r => `<tr><td><b>${esc(feeLabelFor(r))}</b><small>${esc(frcInstalmentText(r))}${r.note ? ' · ' + esc(r.note) : ''}</small></td><td class="a"><b>₹${money(r.amount)}</b></td></tr>`).join('')}</tbody></table>
        <div class="m-tot"><span>Total received</span><b>₹${money(d.netPaid)}</b></div><div class="m-w">${esc(d.words)}</div><div class="m-bal">Balance due after this: <b>₹${money(d.due)}</b></div>
        <div class="m-s"><span>Parent signature</span><span style="text-align:right">${esc(d.signer)}</span></div><div style="font-size:6px;color:#777;margin-top:3px;text-align:center">${esc(c.note)}</div></div></section>`
    },
    slip: {
      css: `.copy{font-family:'Segoe UI',Arial,sans-serif;color:#14213d;border:1px solid #c9d1e0;padding:4mm;font-size:9px}
        .s-h{text-align:center;border-bottom:2px solid #14213d;padding-bottom:4px}.s-h b{font-size:11px;display:block}.s-h span{font-size:7px;color:#4a5878}
        .s-p{display:inline-block;margin-top:4px;background:#14213d;color:#fff;font-weight:700;letter-spacing:.12em;font-size:8px;padding:2px 9px;border-radius:3px}
        .s-no{text-align:center;font:600 15px ui-monospace,Consolas,monospace;margin:7px 0 1px}.s-dt{text-align:center;font-size:8px;color:#4a5878;margin-bottom:6px}
        .s-r{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #9aa6c0}.s-r span:first-child{color:#4a5878}
        .s-l{margin:7px 0 2px;font-size:7px;letter-spacing:.08em;color:#4a5878;font-weight:700}
        .s-t{display:flex;justify-content:space-between;align-items:baseline;margin-top:7px;padding:6px 8px;border:2px solid #14213d;border-radius:5px}.s-t b:last-child{font:600 15px ui-monospace,Consolas,monospace}
        .s-w{margin-top:4px;font-size:8px;color:#4a5878}.s-b{margin-top:6px;background:#eef1f7;border-radius:5px;padding:4px 8px;font-size:8.5px}
        .s-s{margin-top:auto;display:flex;justify-content:space-between;color:#4a5878;font-size:7px;padding-top:14px}.s-s span{border-top:1px solid #14213d;padding-top:2px;width:30mm}`,
      copy: (lab, d, c) => `<section class="copy"><div class="s-h"><b>${esc(c.school)}</b><span>${esc(c.addr)}${c.phone ? ' · Ph: ' + esc(c.phone) : ''}</span><br><span class="s-p">FEE RECEIPT · ${esc(lab)}</span></div>
        <div class="s-no">${esc(d.receiptNo)}</div><div class="s-dt">${esc(d.date)}</div>
        <div class="s-r"><span>Student</span><b>${esc(c.name)}</b></div><div class="s-r"><span>Class</span><b>${esc(c.cls)}</b></div><div class="s-r"><span>Adm. no.</span><b>${esc(d.s.admissionNo)}</b></div><div class="s-r"><span>Mode</span><b>${esc(d.mode)}</b></div>
        <div class="s-l">PAID FOR</div>${d.recs.map(r => `<div class="s-r"><span>${esc(feeLabelFor(r))} — ${esc(frcInstalmentText(r))}</span><span style="font-family:ui-monospace,Consolas,monospace">${money(r.amount)}</span></div>`).join('')}
        <div class="s-t"><b>TOTAL</b><b>₹${money(d.netPaid)}</b></div><div class="s-w">${esc(d.words)}</div><div class="s-b">Balance due: <b>₹${money(d.due)}</b></div>
        <div class="s-s"><span>Parent signature</span><span style="text-align:right">${esc(d.signer)}</span></div><div style="font-size:6px;color:#777;text-align:center;margin-top:3px">${esc(c.note)}</div></section>`
    }
  };

  function thermalDoc(d){
    const c = ctx(d);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(d.receiptNo)}</title>
    <style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0}body{background:#dfe1ea;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .bar{display:flex;gap:8px;justify-content:center;padding:8px;background:#211A4E}.bar button{font:700 13px Arial;border:0;border-radius:8px;padding:7px 14px;background:#168a5f;color:#fff;cursor:pointer}
    .roll{width:76mm;margin:10px auto;background:#fff;padding:4mm 3mm;font:11px 'Courier New',monospace;color:#000;box-shadow:0 4px 16px rgba(0,0,0,.2)}
    .c{text-align:center}.h{font-weight:700;font-size:13px}.hr{border-top:1px dashed #000;margin:5px 0}.r{display:flex;justify-content:space-between;gap:6px}.t{font-weight:700;font-size:14px}
    @media print{body{background:#fff}.bar{display:none}.roll{margin:0;box-shadow:none;width:76mm}}</style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Print</button></div>
    <div class="roll"><div class="c h">${esc(c.school)}</div><div class="c">${esc(c.addr)}</div>${c.phone ? `<div class="c">Ph: ${esc(c.phone)}</div>` : ''}
    <div class="hr"></div><div class="c h">FEE RECEIPT</div><div class="r"><span>No:</span><b>${esc(d.receiptNo)}</b></div><div class="r"><span>Date:</span><span>${esc(d.date)}</span></div>
    <div class="hr"></div><div>${esc(c.name)}</div><div>${esc(c.cls)} · Adm ${esc(d.s.admissionNo)}</div><div>Mode: ${esc(d.mode)}</div><div class="hr"></div>
    ${d.recs.map(r => `<div class="r"><span>${esc(feeLabelFor(r))} ${esc(frcInstalmentText(r))}</span><span>${money(r.amount)}</span></div>`).join('')}
    ${d.disc > 0 ? `<div class="r"><span>Discount</span><span>${money(d.disc)}</span></div>` : ''}
    <div class="hr"></div><div class="r t"><span>TOTAL</span><span>₹${money(d.netPaid)}</span></div><div>${esc(d.words)}</div><div class="hr"></div>
    <div class="r"><span>Balance due</span><span>₹${money(d.due)}</span></div><div class="hr"></div><div class="c">${esc(c.note)}</div>${d.collector ? `<div class="c">Collected by ${esc(d.collector)}</div>` : ''}<div class="c">Thank you</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
  }

  function styledDoc(style, d){
    if(style === 'thermal') return thermalDoc(d);
    const S = STYLES[style], c = ctx(d);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(d.receiptNo)}</title>
    <style id="frcPage">@page{size:A4;margin:0}</style><style>${SHARED}${S.css}</style></head><body data-mode="a4">
    <div class="bar"><button id="mA4" class="on" onclick="m('a4')">A4 paper · both copies on the top half</button><button id="mA5" onclick="m('a5')">Half-A4 paper (A5 landscape)</button><button class="go" onclick="window.print()">🖨 Print</button></div>
    <div class="sheet"><div class="half">${S.copy('STUDENT COPY', d, c)}</div><div class="half">${S.copy('OFFICE COPY', d, c)}</div></div>
    <script>function m(x){document.getElementById('mA4').className=x==='a4'?'on':'';document.getElementById('mA5').className=x==='a5'?'on':'';document.getElementById('frcPage').textContent=x==='a5'?'@page{size:210mm 148mm;margin:0}':'@page{size:A4;margin:0}'}
    window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
  }
  window.frcStyledDoc = styledDoc;

  if(typeof frcDocHtml === 'function'){
    const origDoc = frcDocHtml;
    frcDocHtml = function(d){
      const s = rcptStyle();
      if(s === 'existing' || !(s === 'thermal' || STYLES[s])) return origDoc.apply(this, arguments);
      try { return styledDoc(s, d); } catch(e){ console.warn('Receipt style skipped:', e); return origDoc.apply(this, arguments); }
    };
    window.frcDocHtml = frcDocHtml;
  }
})();
