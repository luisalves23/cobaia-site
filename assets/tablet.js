/* @cobaia.dev · página do tablet (Dia 08) e página de obrigado */
(function () {
  /* ===== CONFIGURAÇÃO: preencha aqui ===== */
  var CFG = {
    guia: '',      // checkout Kiwify: Guia do seu tablet (R$ 27,90)
    combo: '',     // checkout Kiwify: Guia + suporte, oferta de R$ 97,90
    upgrade: '',   // checkout Kiwify: Guia + suporte, oferta de R$ 70,00 (quem já comprou o guia)
    whatsapp: ''   // número com DDI e DDD, só dígitos. Ex.: 5511999999999
  };
  /* ======================================= */

  var D = document, K = 'cobaia-tablet-modelo', KN = 'cobaia-tablet-nome';
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* modelo do tablet: lembra e personaliza a página */
  var ins = D.querySelectorAll('[data-model-in]'), outs = D.querySelectorAll('[data-model-out]'), ok = D.querySelector('[data-model-ok]');
  function paint(v) {
    v = (v || '').trim();
    outs.forEach(function (o) { o.textContent = v || 'seu tablet'; });
    if (ok) ok.hidden = !v;
    paintWa();
  }
  ins.forEach(function (i) {
    i.value = get(K);
    i.addEventListener('input', function () { set(K, i.value.trim()); paint(i.value); });
  });
  var nm = D.querySelector('[data-name-in]');
  if (nm) { nm.value = get(KN); nm.addEventListener('input', function () { set(KN, nm.value.trim()); paintWa(); }); }

  /* checkout */
  D.querySelectorAll('[data-checkout]').forEach(function (a) {
    var u = CFG[a.getAttribute('data-checkout')];
    if (u) { a.href = u; a.rel = 'noopener'; }
    else a.addEventListener('click', function (e) { e.preventDefault(); alertOff(a); });
  });
  function alertOff(a) { var t = a.textContent; a.textContent = 'Abrindo em instantes'; setTimeout(function () { a.textContent = t; }, 1600); }

  /* WhatsApp com modelo e nome já escritos */
  function paintWa() {
    D.querySelectorAll('[data-wa]').forEach(function (a) {
      var m = get(K) || '(meu modelo)', n = get(KN) || '(meu nome)';
      var msg = 'Oi! Comprei o guia do tablet. Meu modelo é ' + m + ' e o nome da compra é ' + n + '.';
      a.href = CFG.whatsapp ? 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg) : '#';
      a.target = '_blank'; a.rel = 'noopener';
    });
  }
  paint(get(K));

  /* barra fixa no celular: aparece depois da escolha, some na oferta */
  var st = D.querySelector('[data-stick]'), ch = D.querySelector('.choose'), of = D.getElementById('oferta'), end = D.querySelector('.lp-end');
  if (st && ch && 'IntersectionObserver' in window) {
    var past = false, inOffer = false;
    var upd = function () { var on = past && !inOffer; st.classList.toggle('on', on); st.setAttribute('aria-hidden', on ? 'false' : 'true'); };
    new IntersectionObserver(function (es) { es.forEach(function (e) { past = !e.isIntersecting && e.boundingClientRect.top < 0; }); upd(); }).observe(ch);
    var vis = new Set();
    var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vis.add(e.target) : vis.delete(e.target); }); inOffer = vis.size > 0; upd(); });
    if (of) io2.observe(of); if (end) io2.observe(end);
  }

  /* o salto: o número do Android sobe conforme você rola */
  var sec = D.getElementById('salto');
  if (sec) {
    var N = sec.querySelector('[data-salto-n]'), L = sec.querySelector('[data-salto-l]'),
        dots = sec.querySelectorAll('.salto-steps i'), imgs = sec.querySelectorAll('[data-salto-img]');
    var S = [
      ['5.0', 'Android · parado desde 2017', 0],
      ['10', 'o primeiro salto', 1],
      ['11', 'estável · o meu hoje', 1],
      ['13', 'já em teste', 2]
    ];
    var cur = -1;
    var show = function (i) {
      if (i === cur) return; cur = i;
      N.textContent = S[i][0]; L.textContent = S[i][1];
      N.parentNode.classList.remove('pop'); void N.offsetWidth; N.parentNode.classList.add('pop');
      dots.forEach(function (d, j) { d.classList.toggle('on', j <= i); });
      imgs.forEach(function (im) { im.classList.toggle('on', +im.getAttribute('data-salto-img') === S[i][2]); });
    };
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { sec.classList.add('static'); show(2); }
    else {
      var tick = function () {
        var r = sec.getBoundingClientRect(), span = r.height - innerHeight;
        var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
        show(Math.min(S.length - 1, Math.floor(p * S.length * 0.999)));
      };
      var raf = 0; addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; tick(); }); }, { passive: true });
      tick();
    }
  }
})();
