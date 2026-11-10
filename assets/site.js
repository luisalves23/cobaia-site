/* @cobaia.dev · comportamento compartilhado */
(function () {
  var D = document, H = D.documentElement;
  H.classList.add('js');

  /* ---------- liberação diária: 12h de Brasília (15h UTC) ---------- */
  // Dia 4 sai em 09/11/2026; um dia novo por dia a partir daí.
  /* EARLY: dias liberados antes das 12h a pedido do Luis (dia: horário UTC) */
  var EARLY = { 5: Date.UTC(2026, 10, 10, 11, 0, 0) };
  function releaseOf(n) { return EARLY[n] || Date.UTC(2026, 10, 5 + n, 15, 0, 0); }
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

  /* ---------- Liquid Glass: refração na borda, miolo só desfocado ----------
     Cada card ganha um mapa de deslocamento do tamanho exato dele. Numa faixa fina junto
     à borda o vidro "puxa" o fundo de dentro pra fora, de um jeito que o conteúdo aparece
     espelhado (como a borda grossa de uma lupa). No miolo o deslocamento é zero: o fundo
     fica do mesmo tamanho, só desfocado. Chrome/Edge/Android aceitam isso; Safari ainda não. */
  var canRefract = !!(navigator.userAgentData) && CSS.supports('backdrop-filter', 'url(#a)');
  if (canRefract) {
    var NS = 'http://www.w3.org/2000/svg', defs = D.createElementNS(NS, 'svg'), cache = {}, uid = 0;
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    D.body.appendChild(defs);
    var MAX = 2.2; // quanto a borda "puxa" o fundo, em múltiplos da largura da borda
    var makeMap = function (w, h, r, bez) {
      var c = D.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data, c2 = D.createElement('canvas'), x2, im2, d2, hw = w / 2, hh = h / 2, off = MAX * bez;
      c2.width = w; c2.height = h; x2 = c2.getContext('2d'); im2 = x2.createImageData(w, h); d2 = im2.data;
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
        var px = i + .5 - hw, py = j + .5 - hh, ax = Math.abs(px), ay = Math.abs(py);
        var qx = ax - (hw - r), qy = ay - (hh - r);
        var ox = Math.max(qx, 0), oy = Math.max(qy, 0), ol = Math.hypot(ox, oy);
        var dist = r - (ol + Math.min(Math.max(qx, qy), 0));      // distância da borda pra dentro
        var k = (j * w + i) * 4, vx = 0, vy = 0, a = 0;
        if (dist > 0 && dist < bez) {
          var nx, ny;                                              // normal apontando pra dentro
          if (ol > 0) { nx = -ox / ol; ny = -oy / ol; } else if (qx > qy) { nx = -1; ny = 0; } else { nx = 0; ny = -1; }
          nx *= px < 0 ? -1 : 1; ny *= py < 0 ? -1 : 1;
          var t = 1 - dist / bez, m = t * t;                       // forte na quina, some no miolo
          vx = nx * m; vy = ny * m; a = Math.min(1, t * 1.6);
        }
        d[k] = 128 + vx * 127; d[k + 1] = 128 + vy * 127; d[k + 2] = 128; d[k + 3] = 255;
        d2[k] = d2[k + 1] = d2[k + 2] = 255; d2[k + 3] = a * 255;
      }
      x.putImageData(im, 0, 0); x2.putImageData(im2, 0, 0);
      return { url: c.toDataURL(), mask: c2.toDataURL(), scale: 2 * off };
    };
    var apply = function (el) {
      var b = el.getBoundingClientRect(), w = Math.round(b.width), h = Math.round(b.height);
      if (w < 8 || h < 8) return;
      var r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
      var bez = Math.max(6, Math.min(22, Math.min(w, h) * 0.22));
      var key = w + 'x' + h + 'r' + Math.round(r);
      if (!cache[key]) {
        var m = makeMap(w, h, r, bez), id = 'lg' + (uid++);
        var f = D.createElementNS(NS, 'filter');
        f.setAttribute('id', id); f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('primitiveUnits', 'userSpaceOnUse');
        f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', w); f.setAttribute('height', h);
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.innerHTML = '<feImage href="' + m.url + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="map"/>' +
          '<feImage href="' + m.mask + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="rim"/>' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="' + (h < 90 ? 6 : 3.5) + '" edgeMode="duplicate" result="soft"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + m.scale.toFixed(1) + '" xChannelSelector="R" yChannelSelector="G" result="lens"/>' +
          '<feGaussianBlur in="lens" stdDeviation="0.6" result="lens2"/>' +
          '<feComposite in="lens2" in2="rim" operator="in" result="edge"/>' +
          '<feMerge><feMergeNode in="soft"/><feMergeNode in="edge"/></feMerge>';
        defs.appendChild(f); cache[key] = id;
      }
      var v = 'url(#' + cache[key] + ') saturate(180%) brightness(1.06)';
      el.style.backdropFilter = v; el.style.webkitBackdropFilter = v;
    };
    var all = function () { D.querySelectorAll('.glass').forEach(function (el) { if (el.offsetParent !== null || el.closest('.modal')) apply(el); }); };
    H.classList.add('lg-refract');
    all();
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(all, 200); });
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(function (es) { es.forEach(function (e) { apply(e.target); }); }); D.querySelectorAll('.glass').forEach(function (el) { ro.observe(el); }); }
    D.querySelectorAll('details').forEach(function (d) { d.addEventListener('toggle', all); });
  }

  /* ---------- modal do calendário ---------- */
  var modal = D.getElementById('cal');
  if (modal) {
    var opener = null;
    var open = function (e) { opener = e && e.currentTarget; modal.classList.add('open'); H.classList.add('noscroll'); modal.removeAttribute('aria-hidden'); var f = modal.querySelector('.x'); f && f.focus(); setTimeout(function () { dispatchEvent(new Event('resize')); }, 480); };
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
