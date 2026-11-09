/* @cobaia.dev · comportamento compartilhado */
(function () {
  var D = document, H = D.documentElement;
  H.classList.add('js');

  /* ---------- liberação diária: 12h de Brasília (15h UTC) ---------- */
  // Dia 4 sai em 09/11/2026; um dia novo por dia a partir daí.
  function releaseOf(n) { return Date.UTC(2026, 10, 5 + n, 15, 0, 0); }
  function released(n) { return Date.now() >= releaseOf(n); }
  window.COBAIA = { releaseOf: releaseOf, released: released };

  /* página de um dia antes da hora: mostra contagem regressiva */
  var day = parseInt(H.getAttribute('data-day') || '0', 10);
  if (day && !released(day)) {
    H.classList.add('prelaunch');
    var lk = D.querySelector('.lockscreen');
    if (lk) {
      var tick = function () {
        var s = Math.max(0, Math.floor((releaseOf(day) - Date.now()) / 1000));
        if (s === 0) { location.reload(); return; }
        var p = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
        lk.querySelectorAll('.clock b').forEach(function (b, i) { b.textContent = String(p[i]).padStart(2, '0'); });
      };
      tick(); setInterval(tick, 1000);
    }
  }

  /* ---------- Liquid Glass: refração real onde o navegador permite ---------- */
  // Chrome/Edge/Android aceitam filtro SVG no backdrop-filter. Safari não: lá fica blur + reflexos.
  var canRefract = !!(navigator.userAgentData) && CSS.supports('backdrop-filter', 'url(#a)');
  if (canRefract) {
    var c = D.createElement('canvas'), N = 256; c.width = c.height = N;
    var x = c.getContext('2d'), img = x.createImageData(N, N), bez = 0.16, rad = 0.12;
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var u = (i + .5) / N, v = (j + .5) / N;
      // distância até a borda de um retângulo arredondado (0..0.5)
      var dx = Math.min(u, 1 - u), dy = Math.min(v, 1 - v);
      var cx = Math.max(0, rad - dx), cy = Math.max(0, rad - dy);
      var dist = (cx > 0 && cy > 0) ? rad - Math.hypot(cx, cy) : Math.min(dx, dy);
      var t = Math.max(0, 1 - dist / bez);            // 1 na borda, 0 no miolo
      var mag = t * t * (3 - 2 * t);                  // curva suave de lente convexa
      var nx = u < .5 ? 1 : -1, ny = v < .5 ? 1 : -1; // empurra para dentro
      var wx = dx < dy ? 1 : (cx > 0 && cy > 0 ? cx / (cx + cy) : 0);
      var wy = dy < dx ? 1 : (cx > 0 && cy > 0 ? cy / (cx + cy) : 0);
      var k = (j * N + i) * 4;
      img.data[k] = 128 + nx * wx * mag * 127;
      img.data[k + 1] = 128 + ny * wy * mag * 127;
      img.data[k + 2] = 128; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    var ns = 'http://www.w3.org/2000/svg', svg = D.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    svg.innerHTML = '<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feImage href="' + c.toDataURL() + '" preserveAspectRatio="none" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter>';
    D.body.appendChild(svg);
    H.classList.add('lg-refract');
  }

  /* ---------- modal do calendário ---------- */
  var modal = D.getElementById('cal');
  if (modal) {
    var opener = null;
    var open = function (e) { opener = e && e.currentTarget; modal.classList.add('open'); H.classList.add('noscroll'); modal.removeAttribute('aria-hidden'); var f = modal.querySelector('.x'); f && f.focus(); };
    var close = function () { modal.classList.remove('open'); H.classList.remove('noscroll'); modal.setAttribute('aria-hidden', 'true'); opener && opener.focus(); };
    D.querySelectorAll('[data-open-cal]').forEach(function (b) { b.addEventListener('click', open); });
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('.x')) close(); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
  }

  /* calendário: troca dias liberados/trancados pelo relógio */
  D.querySelectorAll('[data-cal-day]').forEach(function (el) {
    var n = +el.getAttribute('data-cal-day');
    if (!released(n)) {
      var s = D.createElement('span');
      s.className = (released(n - 1) ? 'soon' : '');
      var dt = new Date(releaseOf(n));
      s.innerHTML = '<b>' + String(n).padStart(2, '0') + '</b><small>' + String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '</small>';
      s.setAttribute('aria-label', 'Dia ' + n + ', libera em breve');
      el.replaceWith(s);
    }
  });
  /* cards e links de dias futuros */
  D.querySelectorAll('[data-lock-day]').forEach(function (el) {
    var n = +el.getAttribute('data-lock-day');
    if (!released(n)) { el.classList.add('locked', 'lockd'); el.removeAttribute('href'); var d = el.querySelector('[data-when]'); if (d) d.textContent = d.getAttribute('data-when'); }
    else { el.classList.remove('locked', 'lockd'); }
  });
  var prog = D.querySelector('[data-progress]');
  if (prog) {
    var done = 0; for (var n = 1; n <= 30; n++) if (released(n)) done = n;
    D.querySelectorAll('[data-done]').forEach(function (e) { e.textContent = done; });
    requestAnimationFrame(function () { setTimeout(function () { prog.style.width = (done / 30 * 100) + '%'; }, 200); });
  }

  /* ---------- copiar ---------- */
  D.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = D.getElementById(b.getAttribute('data-copy')); if (!t) return;
      var txt = t.innerText.trim(), lbl = b.textContent;
      var ok = function () { b.textContent = 'Copiado ✓'; b.classList.add('ok'); setTimeout(function () { b.textContent = lbl; b.classList.remove('ok'); }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, function () { sel(t); });
      else sel(t);
    });
  });
  function sel(el) { var r = D.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  /* ---------- botões de alternância (antes/depois) ---------- */
  D.querySelectorAll('.lab[data-mode]').forEach(function (lab) {
    var bs = lab.querySelectorAll('.toggle button');
    bs.forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-set');
        lab.setAttribute('data-mode', m);
        bs.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        lab.querySelectorAll('[data-a]').forEach(function (e) { e.textContent = e.getAttribute(m === 'b' ? 'data-b' : 'data-a'); });
      });
    });
  });

  /* ---------- números contando ---------- */
  function countUp(el) {
    var from = +el.getAttribute('data-from') || 0, to = +el.getAttribute('data-count'), dur = 1600, t0 = null;
    var fmt = function (v) { return Math.round(v).toLocaleString('pt-BR'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    (function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); })(performance.now());
  }

  /* ---------- entrada ao rolar ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.hasAttribute('data-count')) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  D.querySelectorAll('.rv,.glass,.menu,[data-count]').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });
})();
