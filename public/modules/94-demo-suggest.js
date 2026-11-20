/* =========================================================================
   Demo only: a small "Suggest a change" button on every screen. A visitor trying the demo types one line about
   what they would like changed or added, from the screen they are looking at, and it goes to the owner.
   Appears only when the server says it is a demo install (/api/demo-info), so a real school never sees it.
   ========================================================================= */
(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* The name of the screen in front of the visitor: the visible view's heading. */
  function screenName(){
    try {
      const views = Array.from(document.querySelectorAll('[id^="view-"]')).filter(v => v.offsetParent !== null || (v.style && v.style.display !== 'none' && v.style.display !== ''));
      for(const v of views){ const h = v.querySelector('h1, .topbar h1'); if(h && h.textContent.trim()) return h.textContent.trim().slice(0, 100); }
    } catch(e){}
    return '';
  }
  function close(){ const m = document.getElementById('dsgModal'); if(m) m.remove(); }
  function open(){
    close();
    const screen = screenName();
    const m = document.createElement('div');
    m.id = 'dsgModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(20,16,40,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    m.innerHTML = `<div style="background:#fff;color:#1c1840;border-radius:16px;max-width:460px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:inherit" role="dialog" aria-label="Suggest a change">
      <div style="font-weight:800;font-size:1.05rem;margin-bottom:4px">Suggest a change</div>
      <div style="font-size:.85rem;color:#5b6784;margin-bottom:10px">Tell us what you would like changed or added${screen ? ' on <b>' + esc(screen) + '</b>' : ''}. One line is enough. We read every note.</div>
      <textarea id="dsgText" maxlength="600" rows="4" placeholder="For example: add a column for hostel fee, or rename Combination to Group" style="width:100%;box-sizing:border-box;border:1px solid #cfd4e4;border-radius:10px;padding:10px;font:inherit;resize:vertical"></textarea>
      <div id="dsgMsg" style="min-height:1.2em;font-size:.82rem;color:#b3261e;margin-top:6px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button type="button" id="dsgCancel" style="border:1px solid #cfd4e4;background:#fff;color:#1c1840;border-radius:10px;padding:8px 14px;font:inherit;cursor:pointer">Cancel</button>
        <button type="button" id="dsgSend" style="border:0;background:#1c1840;color:#fff;border-radius:10px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer">Send</button>
      </div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if(e.target === m) close(); });
    document.getElementById('dsgCancel').onclick = close;
    const txt = document.getElementById('dsgText'); txt.focus();
    document.getElementById('dsgSend').onclick = async () => {
      const message = txt.value.trim(), msg = document.getElementById('dsgMsg'), btn = document.getElementById('dsgSend');
      if(message.length < 3){ msg.textContent = 'Please write a few words first.'; return; }
      btn.disabled = true; msg.textContent = '';
      try {
        const res = await fetch('/api/demo/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ message, screen }) });
        const j = await res.json().catch(() => ({}));
        if(!res.ok){ msg.textContent = j.error || 'Could not send. Please try again.'; btn.disabled = false; return; }
        close();
        if(typeof showToast === 'function') showToast('Thank you! Your suggestion has been sent.', 'burst');
      } catch(e){ msg.textContent = 'No connection. Please try again.'; btn.disabled = false; }
    };
  }
  function addButton(){
    if(document.getElementById('dsgBtn')) return;
    const b = document.createElement('button');
    b.id = 'dsgBtn'; b.type = 'button';
    b.textContent = '💡 Suggest a change';
    b.style.cssText = 'position:fixed;right:16px;bottom:44px;z-index:9999;border:0;border-radius:999px;background:#1c1840;color:#fff;font:inherit;font-weight:700;font-size:.85rem;padding:10px 16px;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer';
    b.onclick = open;
    document.body.appendChild(b);
  }
  if(typeof setInterval !== 'function') return;
  let tries = 0;
  const t = setInterval(async () => {
    tries++;
    let ready = false; try { ready = !!currentUser; } catch(e){}
    if(ready){
      clearInterval(t);
      try { const r = await fetch('/api/demo-info', { credentials: 'same-origin' }); const j = await r.json(); if(j && j.demo) addButton(); } catch(e){}
    } else if(tries > 120) clearInterval(t);
  }, 1000);
  window.dsgOpen = open; window.dsgScreenName = screenName;
})();
