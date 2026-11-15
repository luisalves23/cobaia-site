/* @cobaia.dev · Dia 08 · landing do tablet */
(function () {
  /* ===== CONFIGURAÇÃO: preencha aqui ===== */
  var CFG = {
    guia: 'https://pay.kiwify.com.br/KjZdaDl',      // checkout Kiwify: Guia do seu tablet (R$ 27,90)
    combo: 'https://pay.kiwify.com.br/y20fMyy',     // checkout Kiwify: Guia + suporte, oferta de R$ 97,90
    upgrade: '',   // checkout Kiwify: Guia + suporte, oferta de R$ 70,00 (quem já comprou o guia)
    whatsapp: ''   // número com DDI e DDD, só dígitos. Ex.: 5511999999999
  };
  /* ======================================= */

  var D = document, H = D.documentElement, W = window;
  H.classList.add('js');
  var reduce = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) H.classList.add('smooth');
  requestAnimationFrame(function () { setTimeout(function () { H.classList.add('awake'); }, 120); });

  /* checkout */
  D.querySelectorAll('[data-checkout]').forEach(function (a) {
    var u = CFG[a.getAttribute('data-checkout')];
    if (u) { a.href = u; a.rel = 'noopener'; }
    else a.addEventListener('click', function (e) { e.preventDefault(); var t = a.textContent; a.textContent = 'Abrindo em instantes'; setTimeout(function () { a.textContent = t; }, 1600); });
  });
  D.querySelectorAll('[data-wa]').forEach(function (a) {
    if (CFG.whatsapp) { a.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(a.getAttribute('data-wa')); a.target = '_blank'; a.rel = 'noopener'; }
  });

  /* entrega média: alterna entre 20 e 24 min a cada 20 s */
  var etas = D.querySelectorAll('[data-eta]');
  if (etas.length) {
    var setEta = function (first) {
      var v = 20 + Math.floor(Math.random() * 5);
      etas.forEach(function (e) { if (!first && e.textContent !== v + ' min') { e.classList.add('tick'); setTimeout(function () { e.classList.remove('tick'); }, 900); } e.textContent = v + ' min'; });
    };
    setEta(true); setInterval(setEta, 20000);
  }

  /* vídeo de venda: prévia muda ao abrir; o play recomeça do zero com som; só pausar e tela cheia */
  var pl = D.querySelector('.player');
  if (pl) {
    var src = pl.getAttribute('data-src'), ov = pl.querySelector('.ov'), bar = pl.querySelector('.prog i'), vid = null;
    if (src) {
      vid = D.createElement('video'); vid.src = src; vid.muted = true; vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.loop = true; vid.preload = 'auto';
      vid.setAttribute('disablepictureinpicture', ''); vid.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
      pl.insertBefore(vid, pl.firstChild); var cd = pl.querySelector('.card'); if (cd) cd.style.display = 'none'; vid.poster = src.replace('.mp4', '-poster.jpg'); if (!reduce) vid.play().catch(function () {});
      vid.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    ov.addEventListener('click', function () {
      if (!vid) { ov.querySelector('span').textContent = 'O vídeo chega em instantes'; return; }
      vid.loop = false; vid.currentTime = 0; vid.muted = false; vid.play(); pl.classList.add('on');
    });
    if (vid) {
      // barra que anda rápido no começo e devagar no fim
      vid.addEventListener('timeupdate', function () { if (!pl.classList.contains('on') || !vid.duration) return; var x = vid.currentTime / vid.duration; bar.style.width = ((1 - Math.pow(1 - x, 2.2)) * 100).toFixed(2) + '%'; });
      vid.addEventListener('ended', function () { bar.style.width = '100%'; var c = D.getElementById('oferta'); if (c) c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
      // só pausar e tela cheia: sem avançar nem voltar
      var ctl = D.createElement('div'); ctl.className = 'ctl';
      ctl.innerHTML = '<button type="button" class="pp" aria-label="Pausar"></button><button type="button" class="fs" aria-label="Tela cheia"></button>';
      pl.appendChild(ctl);
      var pp = ctl.querySelector('.pp'), fs = ctl.querySelector('.fs');
      function sync() { var p = vid.paused && !vid.ended; pl.classList.toggle('paused', p); pp.setAttribute('aria-label', p ? 'Continuar' : 'Pausar'); }
      function toggle() { if (!pl.classList.contains('on')) return; if (vid.paused) vid.play().catch(function () {}); else vid.pause(); }
      pp.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      vid.style.pointerEvents = 'auto'; vid.addEventListener('click', toggle);
      vid.addEventListener('play', sync); vid.addEventListener('pause', sync);
      fs.addEventListener('click', function (e) {
        e.stopPropagation();
        var full = D.fullscreenElement || D.webkitFullscreenElement;
        if (full) { (D.exitFullscreen || D.webkitExitFullscreen).call(D); return; }
        var req = pl.requestFullscreen || pl.webkitRequestFullscreen;
        if (req) { var pr = req.call(pl); var rot = function () { try { screen.orientation.lock('landscape').catch(function () {}); } catch (x) {} }; if (pr && pr.then) pr.then(rot).catch(function () {}); else rot(); }
        else if (vid.webkitEnterFullscreen) vid.webkitEnterFullscreen();
      });
    }
  }

  /* vida: a rolagem carrega a bateria e acorda o sinal vital */
  var still = D.body.hasAttribute('data-static');
  var batt = D.querySelector('.batt'), bt = D.querySelector('[data-batt]'), beat = D.querySelector('.vital .beat');
  var W0 = 600, MID = 14;
  function vitalPath(life, t) {
    // linha reta que vira batimento conforme a vida sobe
    var amp = 2 + life * 11, n = 1 + Math.round(life * 3), seg = W0 / n, d = 'M0 ' + MID;
    for (var i = 0; i < n; i++) {
      var x = i * seg + seg * .45;
      d += ' L' + x.toFixed(1) + ' ' + MID + ' l6 ' + (-amp * .35).toFixed(1) + ' l5 ' + (amp * .35).toFixed(1) + ' l7 0 l5 ' + (-amp).toFixed(1) + ' l6 ' + (amp * 1.6).toFixed(1) + ' l6 ' + (-amp * .6).toFixed(1) + ' l8 0';
    }
    return d + ' L' + W0 + ' ' + MID;
  }

  /* seções fixadas: progresso de 0 a 1 dentro de cada uma */
  function prog(el) { var r = el.getBoundingClientRect(), span = r.height - innerHeight; return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : (r.top < innerHeight * .5 ? 1 : 0); }
  function seen(el) { var r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .9))); }

  var salto = D.querySelector('.salto'), dor = D.querySelector('.dor'), lay = D.querySelector('.layers');
  var CAP = [
    ['Eu não vendo Android novo. <span>Eu levo o seu tablet ao limite dele.</span>', 'Role e veja o seu tablet por dentro.', -1],
    ['O hardware é o mesmo de 2017.', 'E ele aguenta bem mais do que te mostram.', 0],
    ['Níveis 1 e 2: <span>ajuste fino e entranhas.</span>', 'Configurações escondidas, e os apps que a fábrica forçou arrancados com um computador e um cabo.', 1],
    ['Nível 3: <span>sistema novo.</span>', 'Se existe versão da comunidade pro seu modelo, o guia te leva até ela. Quase todo tablet a partir do Android 5 chega pelo menos ao nível 2.', 2]
  ];
  function capStep(st) {
    if (!lay) return;
    var k = lay.querySelector('[data-cap-k]'), t = lay.querySelector('[data-cap-t]');
    k.innerHTML = CAP[st][0]; t.textContent = CAP[st][1];
    lay.querySelectorAll('.steps i').forEach(function (e, j) { e.classList.toggle('on', j <= st); });
    var lys = [lay.querySelector('.l-hw'), lay.querySelector('.l-sys'), lay.querySelector('.l-ui')];
    lys.forEach(function (l, j) { l.classList.toggle('on', CAP[st][2] === j); l.classList.toggle('dim', CAP[st][2] >= 0 && CAP[st][2] !== j); });
    lay.classList.toggle('clean', st >= 2); lay.classList.toggle('new', st >= 3);
  }
  var anchorOld = D.querySelector('.anchor .old'), drawer = D.querySelector('.drawer');
  var S = [['5.0', 'parado desde 2017', 0, 250, '70%'], ['10', 'o primeiro salto', 1, 560, '96%'], ['11', 'estável, o meu hoje', 2, 820, '118%'], ['13', 'já em teste', 3, 900, '125%']];
  var sCur = -1, dCur = -1, nCur = -1;

  function frame() {
    var max = D.documentElement.scrollHeight - innerHeight, life = max > 0 ? Math.min(1, scrollY / max) : 0;
    H.style.setProperty('--life', life.toFixed(3));
    if (bt) { var pct = Math.max(1, Math.round(life * 100)); bt.textContent = pct + '%'; batt.classList.toggle('full', pct >= 99); }
    if (beat) beat.setAttribute('d', vitalPath(life));

    if (anchorOld) anchorOld.style.setProperty('--strike', Math.min(1, Math.max(0, (seen(anchorOld) - .45) / .35)).toFixed(3));
    if (drawer) drawer.style.setProperty('--pull', Math.min(1, Math.max(0, (seen(drawer) - .2) / .6)).toFixed(3));

    if (salto) {
      var i = Math.min(S.length - 1, Math.floor(prog(salto) * S.length * .999));
      if (i !== sCur) {
        sCur = i; var ver = salto.querySelector('.ver');
        ver.textContent = S[i][0]; ver.style.setProperty('--vw', S[i][3]); ver.style.setProperty('--vs', S[i][4]); ver.classList.toggle('low', i === 0);
        salto.querySelector('.lbl').textContent = S[i][1];
        salto.querySelectorAll('.rail i').forEach(function (r, j) { r.classList.toggle('on', j <= i); });
        salto.querySelectorAll('.fig .face').forEach(function (im) { im.classList.toggle('on', +im.getAttribute('data-i') === S[i][2]); });
      }
    }
    if (dor) {
      var k = Math.min(4, Math.floor(prog(dor) * 5.2));
      if (k !== dCur) { dCur = k; dor.querySelectorAll('.dlg').forEach(function (d, j) { d.classList.toggle('on', j < k); }); }
    }
    if (lay) {
      var q = prog(lay), stk = lay.querySelector('.stack');
      stk.style.setProperty('--open', Math.min(1, Math.max(0, (q - .04) / .22)).toFixed(3));
      var st = q < .26 ? 0 : q < .5 ? 1 : q < .74 ? 2 : 3;
      if (st !== nCur) { nCur = st; capStep(st); }
    }
  }
  if (reduce) {
    if (salto) { sCur = -2; }
    H.style.setProperty('--life', '1'); if (bt) bt.textContent = '100%';
    if (beat) beat.setAttribute('d', vitalPath(1));
    D.querySelectorAll('.dlg').forEach(function (e) { e.classList.add('on'); }); capStep(3);
    if (anchorOld) anchorOld.style.setProperty('--strike', 1); if (drawer) drawer.style.setProperty('--pull', 1);
    if (salto) { var ver = salto.querySelector('.ver'); ver.textContent = '11'; ver.style.setProperty('--vw', 820); ver.style.setProperty('--vs', '118%'); salto.querySelector('.lbl').textContent = 'estável, o meu hoje'; salto.querySelectorAll('.rail i').forEach(function (r, j) { r.classList.toggle('on', j <= 2); }); salto.querySelectorAll('.fig .face').forEach(function (im) { im.classList.toggle('on', im.getAttribute('data-i') === '2'); }); }
  } else if (!still) {
    var raf = 0;
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; frame(); }); }, { passive: true });
    addEventListener('resize', frame);
    frame();
  }

  /* contador da prova */
  var num = D.querySelector('[data-count]');
  if (num && 'IntersectionObserver' in W) {
    var to = +num.getAttribute('data-count'), done = false;
    num.textContent = reduce ? to.toLocaleString('pt-BR') : '0';
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || done || reduce) return; done = true;
        var t0 = null; (function step(t) { if (!t0) t0 = t; var q = Math.min(1, (t - t0) / 1800), ev = 1 - Math.pow(1 - q, 3); num.textContent = Math.round(to * ev).toLocaleString('pt-BR'); if (q < 1) requestAnimationFrame(step); })(performance.now());
      });
    }, { threshold: .5 }).observe(num);
  }

  /* barra fixa: aparece depois do topo, some na oferta e no fim */
  var st = D.querySelector('.stick'), hero = D.querySelector('.hero');
  if (st && hero && 'IntersectionObserver' in W) {
    var past = false, vis = new Set();
    var upd = function () { var on = past && vis.size === 0; st.classList.toggle('on', on); st.setAttribute('aria-hidden', on ? 'false' : 'true'); st.querySelector('a').tabIndex = on ? 0 : -1; };
    new IntersectionObserver(function (es) { es.forEach(function (e) { past = !e.isIntersecting && e.boundingClientRect.top < 0; }); upd(); }).observe(hero);
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vis.add(e.target) : vis.delete(e.target); }); upd(); });
    D.querySelectorAll('#oferta,.end').forEach(function (el) { io.observe(el); });
  }
})();
