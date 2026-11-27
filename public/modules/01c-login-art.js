/* Sign-in page artwork for the Junior College and Degree College installs.
   Junior College  -> "Study Lab": science and study line-icons drift up over the graph paper, with slow sine waves along the bottom.
   Degree College  -> "Campus": a classical campus (dome hall, clock tower, library) at dusk, drifting clouds, a waving flag and graduation caps being tossed.
   Pure SVG + CSS transforms (cheap on phones). Colours follow the sign-in page's own accent, so it matches any look or brand colour.
   Shown only when /api/demo-info says institutionType is junior_college / degree_college; a school never sees it.
   Everyone who has asked their device for reduced motion gets the still picture. */
(function(){
  if(typeof document === 'undefined') return;
  var KEY = 'clgIType', html = document.documentElement;
  function setType(t){ if(t === 'junior_college' || t === 'degree_college') html.setAttribute('data-itype', t); else html.removeAttribute('data-itype'); }
  try { setType(localStorage.getItem(KEY)); } catch(e){}

  var css = '\
.lart{display:none;position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}\
html[data-itype="junior_college"] .lart-jc,html[data-itype="degree_college"] .lart-dc{display:block}\
.login-overlay{overflow:hidden}\
.login-overlay .login-card{z-index:1}\
.lart svg{display:block}\
.lart-ic{position:absolute;bottom:-70px;width:46px;height:46px;color:rgba(var(--login-accent-rgb),.62);opacity:0;will-change:transform,opacity;animation:lartRise var(--d,26s) linear var(--w,0s) infinite}\
.lart-ic svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\
.lart-ic.gold{color:var(--login-accent-soft)}\
@keyframes lartRise{0%{opacity:0;transform:translate3d(0,0,0) rotate(0deg)}8%{opacity:.55}88%{opacity:.4}100%{opacity:0;transform:translate3d(var(--dx,30px),-118vh,0) rotate(var(--r,40deg))}}\
.lart-wave{position:absolute;left:0;bottom:0;width:200%;will-change:transform}\
.lart-wave path{fill:none;stroke-linecap:round}\
.lart-w1{height:120px;animation:lartSlide 34s linear infinite}\
.lart-w2{height:120px;animation:lartSlide 52s linear infinite reverse;opacity:.7}\
@keyframes lartSlide{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}\
.lart-sky{position:absolute;left:0;right:0;bottom:0;width:100%;height:auto}\
.lart-cloud{position:absolute;color:rgba(var(--login-accent-rgb),.09);will-change:transform;animation:lartDrift var(--d,90s) linear var(--w,0s) infinite}\
.lart-cloud svg{fill:currentColor}\
@keyframes lartDrift{from{transform:translate3d(-30vw,0,0)}to{transform:translate3d(130vw,0,0)}}\
.lart-cap{position:absolute;bottom:22%;width:54px;height:40px;opacity:0;color:var(--login-accent-soft);will-change:transform,opacity;animation:lartToss var(--d,9s) ease-in-out var(--w,0s) infinite}\
.lart-cap svg{width:100%;height:100%;fill:rgba(var(--login-accent-rgb),.12);stroke:currentColor;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}\
@keyframes lartToss{0%{opacity:0;transform:translate3d(0,40px,0) rotate(-10deg)}12%{opacity:.8}45%{opacity:.85;transform:translate3d(var(--dx,10px),-34vh,0) rotate(200deg)}70%{opacity:.7;transform:translate3d(calc(var(--dx,10px)*1.4),-18vh,0) rotate(330deg)}100%{opacity:0;transform:translate3d(calc(var(--dx,10px)*1.6),30px,0) rotate(400deg)}}\
.lart-flag{transform-box:fill-box;transform-origin:0 50%;animation:lartFlag 2.6s ease-in-out infinite}\
@keyframes lartFlag{0%,100%{transform:skewY(0) scaleX(1)}50%{transform:skewY(-9deg) scaleX(.86)}}\
.lart-win{animation:lartTwinkle var(--d,6s) ease-in-out var(--w,0s) infinite}\
@keyframes lartTwinkle{0%,100%{opacity:.2}50%{opacity:.8}}\
.lart-star{position:absolute;width:6px;height:6px;border-radius:50%;background:var(--login-accent-soft);opacity:0;animation:lartTwinkle2 var(--d,5s) ease-in-out var(--w,0s) infinite}\
@keyframes lartTwinkle2{0%,100%{opacity:0;transform:scale(.6)}50%{opacity:.7;transform:scale(1)}}\
@media (max-width:640px){.lart-ic.hide-sm{display:none}.lart-cap.hide-sm{display:none}}\
@media (prefers-reduced-motion: reduce){.lart *{animation:none !important}.lart-ic{opacity:.28 !important;bottom:auto}.lart-cap{opacity:.55 !important}.lart-star{opacity:.45 !important}}';

  // ---------- Junior College: Study Lab ----------
  var ICONS = {
    atom: '<ellipse cx="24" cy="24" rx="20" ry="8"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(120 24 24)"/><circle cx="24" cy="24" r="2.6" fill="currentColor"/>',
    book: '<path d="M5 11q10-4 19 2q9-6 19-2v25q-10-4-19 2q-9-6-19-2z"/><path d="M24 13v25"/>',
    flask: '<path d="M18 6h12M20 6v12L9 37a3 3 0 0 0 3 4.5h24a3 3 0 0 0 3-4.5L28 18V6"/><path d="M13 30h22"/>',
    bulb: '<path d="M24 5a12 12 0 0 0-7 22v6h14v-6A12 12 0 0 0 24 5z"/><path d="M19 38h10M21 42h6"/>',
    pencil: '<path d="M8 41l2-9L32 10l7 7L17 39z"/><path d="M29 13l7 7M10 32l7 7"/>',
    protractor: '<path d="M5 37a19 19 0 0 1 38 0z"/><path d="M24 37v-9M11 37a13 13 0 0 1 26 0M9 28l3 2M39 28l-3 2M15 20l2 3M33 20l-2 3"/>',
    sigma: '<path d="M35 9H13l12 15-12 15h22"/>',
    chart: '<path d="M7 41h34M11 41V28M19 41V19M27 41V25M35 41V12"/>',
    dna: '<path d="M14 6c0 10 20 10 20 18s-20 8-20 18M34 6c0 10-20 10-20 18s20 8 20 18M17 12h14M17 36h14M20 24h8"/>'
  };
  var ICON_SPEC = [ // [icon, left%, duration s, delay s, drift px, rotate deg, size px, gold, hide on phones]
    ['atom', 6, 30, -4, 36, 50, 54, 0, 0], ['book', 17, 38, -19, -26, -30, 46, 1, 0], ['flask', 29, 34, -9, 30, 24, 44, 0, 1],
    ['bulb', 42, 42, -26, -24, -22, 44, 1, 1], ['pencil', 55, 36, -13, 34, 60, 44, 0, 1], ['sigma', 66, 32, -22, -30, -40, 42, 1, 0],
    ['protractor', 77, 40, -6, 26, 36, 50, 0, 1], ['chart', 87, 35, -16, -22, -26, 44, 1, 0], ['dna', 94, 44, -30, 20, 30, 46, 0, 1]
  ];
  function wavePath(amp, period, yMid, phase, w){
    var d = '', x;
    for(x = 0; x <= w; x += 20){ var y = yMid + amp * Math.sin((x / period) * 2 * Math.PI + phase); d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1); }
    return d;
  }
  function junior(){
    var h = '<div class="lart lart-jc" aria-hidden="true">';
    ICON_SPEC.forEach(function(s){
      h += '<div class="lart-ic' + (s[7] ? ' gold' : '') + (s[8] ? ' hide-sm' : '') + '" style="left:' + s[1] + '%;--d:' + s[2] + 's;--w:' + s[3] + 's;--dx:' + s[4] + 'px;--r:' + s[5] + 'deg;width:' + s[6] + 'px;height:' + s[6] + 'px"><svg viewBox="0 0 48 48">' + ICONS[s[0]] + '</svg></div>';
    });
    // two waves, each is 2 identical periods side by side so sliding by 50% loops seamlessly
    var W = 1600; // one tile; element is 200% wide, viewBox spans 2 tiles
    h += '<svg class="lart-wave lart-w1" viewBox="0 0 ' + (W * 2) + ' 120" preserveAspectRatio="none"><path d="' + wavePath(16, 400, 70, 0, W * 2) + '" stroke="rgba(var(--login-accent-rgb),.22)" stroke-width="2.4"/></svg>';
    h += '<svg class="lart-wave lart-w2" viewBox="0 0 ' + (W * 2) + ' 120" preserveAspectRatio="none"><path d="' + wavePath(11, 266.67, 84, 1.4, W * 2) + '" stroke="var(--login-accent-soft)" stroke-width="2" stroke-opacity=".55"/></svg>';
    return h + '</div>';
  }

  // ---------- Degree College: Campus ----------
  function windows(x0, y0, cols, rows, gx, gy, w, h, seed){
    var o = '', i, j, n = 0;
    for(j = 0; j < rows; j++) for(i = 0; i < cols; i++){ n++; o += '<rect class="lart-win" style="--d:' + (4 + ((n * 7 + seed) % 5)) + 's;--w:' + (-((n * 3 + seed) % 6)) + 's" x="' + (x0 + i * gx) + '" y="' + (y0 + j * gy) + '" width="' + w + '" height="' + h + '" rx="1.5" fill="var(--login-accent-soft)"/>'; }
    return o;
  }
  function degree(){
    var line = 'stroke="rgba(var(--login-accent-rgb),.28)" stroke-width="1.6" stroke-linejoin="round"', fill = 'fill="rgba(var(--login-accent-rgb),.075)"';
    var cloud = '<svg viewBox="0 0 220 70" width="200" height="64"><ellipse cx="70" cy="46" rx="62" ry="20"/><ellipse cx="120" cy="34" rx="48" ry="26"/><ellipse cx="160" cy="48" rx="52" ry="18"/></svg>';
    var cap = '<svg viewBox="0 0 56 42"><path d="M4 16L28 6l24 10-24 10z"/><path d="M15 21v9q13 8 26 0v-9"/><path d="M52 16v14"/></svg>';
    var h = '<div class="lart lart-dc" aria-hidden="true">';
    [[10, 70, -10], [34, 110, -50], [62, 80, -30]].forEach(function(c, i){ h += '<div class="lart-cloud" style="top:' + c[0] + '%;--d:' + c[1] + 's;--w:' + c[2] + 's;transform:scale(' + (1 + i * .25) + ')">' + cloud + '</div>'; });
    [[8, 3.5, 0], [22, 7, 2], [38, 5.5, 1], [57, 2.5, 3], [71, 6, 0.5], [84, 4, 2.5], [93, 8, 1.5], [48, 11, 4]].forEach(function(s){ h += '<span class="lart-star" style="left:' + s[0] + '%;top:' + (8 + s[1] * 3.2) + '%;--d:' + (4 + s[2]) + 's;--w:' + (-s[2] * 1.3) + 's"></span>'; });
    [[8, 9.2, 0, 26], [16, 10.4, -3.2, -18], [83, 8.8, -5.5, 22], [91, 9.8, -1.2, -28]].forEach(function(p, i){
      h += '<div class="lart-cap' + (i % 2 ? ' hide-sm' : '') + '" style="left:' + p[0] + '%;--d:' + p[1] + 's;--w:' + p[2] + 's;--dx:' + p[3] + 'px">' + cap + '</div>';
    });
    var cols = ''; for(var c = 0; c < 7; c++) cols += '<rect x="' + (150 + c * 28) + '" y="153" width="12" height="75" rx="2" ' + fill + ' ' + line + '/>';
    h += '<svg class="lart-sky" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax meet">'
      + '<rect x="0" y="236" width="1200" height="24" ' + fill + '/>'
      // west + east wings of the main hall
      + '<rect x="24" y="172" width="108" height="64" ' + fill + ' ' + line + '/>' + windows(38, 184, 4, 2, 24, 26, 12, 14, 2)
      + '<rect x="348" y="172" width="100" height="64" ' + fill + ' ' + line + '/>' + windows(362, 184, 3, 2, 28, 26, 12, 14, 3)
      // main hall: steps, columns, pediment, dome, flag
      + '<rect x="130" y="228" width="220" height="8" ' + fill + ' ' + line + '/><rect x="140" y="146" width="200" height="7" ' + fill + ' ' + line + '/>' + cols
      + '<path d="M130 146L240 98l110 48z" ' + fill + ' ' + line + '/><path d="M196 98a44 44 0 0 1 88 0z" ' + fill + ' ' + line + '/><path d="M240 54V26" ' + line + ' fill="none"/>'
      + '<path class="lart-flag" d="M240 26h30l-8 7 8 7h-30z" fill="var(--login-accent-soft)" opacity=".9"/>'
      // library
      + '<rect x="850" y="178" width="130" height="58" ' + fill + ' ' + line + '/>' + windows(862, 190, 5, 1, 24, 0, 12, 16, 4)
      // clock tower
      + '<rect x="985" y="90" width="50" height="146" ' + fill + ' ' + line + '/><path d="M975 90l35-50 35 50z" ' + fill + ' ' + line + '/><circle cx="1010" cy="122" r="13" fill="none" ' + line + '/><path d="M1010 113v9l7 4" fill="none" ' + line + '/>'
      + windows(996, 150, 3, 3, 14, 22, 7, 12, 1)
      // east block
      + '<rect x="1045" y="170" width="130" height="66" ' + fill + ' ' + line + '/>' + windows(1058, 182, 5, 2, 23, 26, 12, 14, 5)
      // trees
      + '<circle cx="14" cy="212" r="20" ' + fill + ' ' + line + '/><circle cx="478" cy="216" r="16" ' + fill + ' ' + line + '/><circle cx="822" cy="214" r="18" ' + fill + ' ' + line + '/><circle cx="1188" cy="208" r="22" ' + fill + ' ' + line + '/>'
      + '</svg>';
    return h + '</div>';
  }

  function mount(){
    var ov = document.getElementById('loginOverlay'); if(!ov || document.getElementById('lartStyle')) return;
    var st = document.createElement('style'); st.id = 'lartStyle'; st.textContent = css; document.head.appendChild(st);
    var wrap = document.createElement('div'); wrap.innerHTML = junior() + degree();
    while(wrap.firstChild) ov.insertBefore(wrap.firstChild, ov.firstChild);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  try { fetch('/api/demo-info', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
    var t = j && j.collegePack ? j.institutionType : '';
    setType(t); try { localStorage.setItem(KEY, t || ''); } catch(e){}
  }).catch(function(){}); } catch(e){}
})();
