/* Demo mode: on a showcase install (server env DEMO_MODE=true) show a "demo" ribbon and the
   demo logins on the sign-in page. On a real school's install /api/demo-info says demo:false
   and this file does nothing. */
(function(){
  fetch('/api/demo-info', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(info => {
    if(!info || !info.demo) return;
    const bar = document.createElement('div');
    bar.id = 'demoRibbon';
    const narrow = window.matchMedia && window.matchMedia('(max-width:600px)').matches;
    bar.textContent = narrow
      ? 'DEMO \u2014 sample data only \u00b7 \u00a9 SVM EdTech \u00b7 copying not permitted'
      : 'DEMO \u2014 sample data only. Nothing here is real, and no messages or payments are sent.  \u00b7  \u00a9 SVM EdTech. For evaluation only; copying not permitted.';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a2e8f;color:#fff;text-align:center;font:600 ' + (narrow ? '11' : '12') + 'px system-ui,sans-serif;padding:5px 10px;line-height:1.35;';
    document.body.appendChild(bar);
    /* Keep the ribbon from covering the app: shrink the sidebar and pad the page by its height. */
    const st = document.createElement('style');
    st.textContent = '.sidebar{height:calc(100vh - var(--demo-h,0px)) !important;height:calc(100dvh - var(--demo-h,0px)) !important}' +
      '.main{padding-bottom:calc(22px + var(--demo-h,0px)) !important}';
    document.head.appendChild(st);
    const setH = () => document.documentElement.style.setProperty('--demo-h', bar.offsetHeight + 'px');
    setH(); window.addEventListener('resize', setH);
    document.title = 'DEMO — ' + document.title;
    /* A visitor who started the demo from svmedtech.com: show how long the pass lasts, a way to switch view, and a WhatsApp link. */
    fetch('/api/demo/pass', { cache: 'no-store', credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(p => {
      if(!p || !p.ok || p.ended) return;
      const until = new Date(p.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      const wa = 'https://wa.me/917780204177?text=' + encodeURIComponent('Hello, I am trying the SVM EdTech demo' + (p.school ? ' for ' + p.school : '') + ' and have a question.');
      const a = 'color:#ffe9a8;font-weight:700;text-decoration:underline;';
      bar.innerHTML = 'DEMO \u00b7 sample data only \u00b7 open until ' + until.replace(/[<>&]/g, '') + ' \u00b7 <a href="/demo-start" style="' + a + '">Switch view</a> \u00b7 <a href="' + wa + '" target="_blank" rel="noopener" style="' + a + '">WhatsApp us</a>';
      setH();
    }).catch(() => {});
    const form = document.getElementById('loginForm');
    if(form && !document.getElementById('demoLogins') && (info.logins || []).length){
      const box = document.createElement('div');
      box.id = 'demoLogins';
      box.style.cssText = 'margin:0 0 14px;padding:10px 12px;border:1px dashed #7a2e8f;border-radius:10px;font-size:0.78rem;text-align:left;line-height:1.6;';
      box.innerHTML = '<b>Try the demo</b> — password for all: <b>' + String(info.password).replace(/[<>&]/g, '') + '</b><br>' +
        (info.logins || []).map(l => '<a href="#" data-u="' + l[0] + '" style="color:#7a2e8f;font-weight:600;">' + l[0] + '</a> <span style="opacity:.7">(' + l[1] + ')</span>').join(' · ');
      form.insertBefore(box, form.firstChild);
      box.addEventListener('click', e => {
        const a = e.target.closest('a[data-u]'); if(!a) return; e.preventDefault();
        const u = form.querySelector('input[type="text"], input[id*="sername"]'); const p = form.querySelector('input[type="password"]');
        if(u) u.value = a.dataset.u; if(p) p.value = info.password;
      });
    }
    else if(form && !document.getElementById('demoLogins') && info.showLogins === false){
      const box = document.createElement('div'); box.id = 'demoLogins';
      box.style.cssText = 'margin:0 0 14px;padding:10px 12px;border:1px dashed #7a2e8f;border-radius:10px;font-size:0.8rem;text-align:left;line-height:1.5;';
      box.innerHTML = '<b>Demo access</b><br>Sign in with the trial username and password SVM EdTech sent you.<br><a href="/demo-start" style="color:#7a2e8f;font-weight:700;">No login yet? Start the free demo &rarr;</a>';
      form.insertBefore(box, form.firstChild);
    }
  }).catch(() => {});
})();
