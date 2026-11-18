/* @cobaia.dev · Dia 11 · landing do guia de cortes de GTA VI */
(function () {
  var CHECKOUT = 'https://pay.kiwify.com.br/c5idh4y';   // link do checkout da Kiwify (ex.: https://pay.kiwify.com.br/XXXXXXX). Vazio = botões levam à oferta.
  var D = document, W = window;
  var calm = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* checkout: mantém os parâmetros da URL (utm, src) para a Kiwify atribuir a venda */
  if (CHECKOUT) {
    var q = location.search ? location.search.slice(1) : '';
    var url = CHECKOUT + (q ? (CHECKOUT.indexOf('?') < 0 ? '?' : '&') + q : '');
    D.querySelectorAll('[data-checkout]').forEach(function (a) { a.href = url; });
  }

  /* palco do hero: a agulha escuta a live, marca os picos e solta os 5 cortes */
  var stage = D.querySelector('[data-stage]');
  if (stage) {
    var wave = stage.querySelector('[data-wave]'), needle = stage.querySelector('[data-needle]');
    var found = stage.querySelector('[data-found]'), status = stage.querySelector('[data-status]');
    var N = W.innerWidth < 520 ? 48 : 64, bars = [], seed = 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var peaks = [Math.round(N * .14), Math.round(N * .33), Math.round(N * .52), Math.round(N * .71), Math.round(N * .88)];
    for (var i = 0; i < N; i++) {
      var b = D.createElement('i'), h = 18 + rnd() * 48;
      if (peaks.indexOf(i) >= 0) h = 92 + rnd() * 8;
      b.style.setProperty('--h', h + '%'); wave.appendChild(b); bars.push(b);
    }
    var finish = function () {
      peaks.forEach(function (p) { bars[p].className = 'cut'; });
      status.textContent = '5 cortes prontos'; stage.querySelector('[data-mid]').innerHTML = '⏱ <b>14:26</b> no total';
      needle.style.setProperty('--x', '100%'); stage.classList.add('done');
    };
    if (calm) { finish(); }
    else {
      var t0 = null, dur = 2600, hit = 0;
      var run = function (t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        needle.style.setProperty('--x', (p * 100) + '%');
        var at = Math.floor(p * N);
        peaks.forEach(function (pk, k) { if (pk <= at && bars[pk].className === '') { bars[pk].className = 'pk'; hit = k + 1; found.textContent = hit; } });
        if (p < 1) requestAnimationFrame(run);
        else { status.textContent = 'cortando no vão das palavras…'; setTimeout(finish, 450); }
      };
      setTimeout(function () { requestAnimationFrame(run); }, 700);
    }
  }

  /* contador */
  var cnt = D.querySelector('[data-count]');
  var fmt = function (n) { return n.toLocaleString('pt-BR'); };

  /* revelar na rolagem + contador + passos */
  var steps = D.querySelectorAll('[data-steps] li');
  if ('IntersectionObserver' in W) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in'); io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    D.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

    if (cnt && !calm) {
      var to = +cnt.getAttribute('data-count');
      var co = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; co.disconnect();
        var s = null;
        var tick = function (t) { if (!s) s = t; var p = Math.min(1, (t - s) / 1400), e = 1 - Math.pow(1 - p, 4);
          cnt.textContent = fmt(Math.round(to * e)); if (p < 1) requestAnimationFrame(tick); };
        cnt.textContent = '0'; requestAnimationFrame(tick);
      }, { threshold: .6 });
      co.observe(cnt);
    }

    var shots = D.querySelectorAll('[data-shot]');
    if (shots.length && steps.length) {
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var k = +e.target.getAttribute('data-shot');
          steps.forEach(function (li, j) { li.classList.toggle('on', j === k); });
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      shots.forEach(function (s) { so.observe(s); });
    }
  } else {
    D.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
  }

  /* barra fixa: aparece depois do hero e some quando a oferta está na tela */
  var st = D.querySelector('.stick'), hero = D.querySelector('.hero'), offer = D.getElementById('oferta');
  if (st && hero && offer && 'IntersectionObserver' in W) {
    var pastHero = false, offerOn = false;
    var upd = function () { var on = pastHero && !offerOn; st.classList.toggle('on', on); st.setAttribute('aria-hidden', on ? 'false' : 'true'); st.querySelector('a').tabIndex = on ? 0 : -1; };
    new IntersectionObserver(function (es) { pastHero = !es[0].isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(function (es) { offerOn = es[0].isIntersecting; upd(); }).observe(offer);
  }
})();
