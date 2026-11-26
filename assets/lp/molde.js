/* Molde das landing pages dos guias. Cada página define antes deste script:
   window.LP = { checkout: { guia: 'https://pay.kiwify.com.br/...', ... }, src: 'tablet' }
   - [data-checkout="guia"] vira o link do checkout (com src e os utm da URL, pra Kiwify atribuir a venda).
   - [data-v="caminho/sem/extensao"] ganha um <video> mudo em loop, que carrega e toca só quando aparece.
   - [data-som] reinicia o vídeo da mesma caixa com som.
   - #sticky aparece no celular depois do herói, fora da oferta. */
(function(){
  var LP = window.LP || {}, D = document;

  var q = location.search ? location.search.slice(1) : '';
  var extra = (LP.src ? 'src=' + encodeURIComponent(LP.src) : '') + (q ? (LP.src ? '&' : '') + q : '');
  D.querySelectorAll('[data-checkout]').forEach(function(a){
    var u = (LP.checkout || {})[a.getAttribute('data-checkout')];
    if (u) { a.href = u + (extra ? (u.indexOf('?') < 0 ? '?' : '&') + extra : ''); a.rel = 'noopener'; }
    else { a.setAttribute('aria-disabled','true'); a.addEventListener('click',function(e){ e.preventDefault(); a.textContent = 'Checkout abre em instantes'; }); }
  });

  D.querySelectorAll('[data-v]').forEach(function(box){
    var n = box.getAttribute('data-v'), v = D.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline',''); v.setAttribute('muted','');
    v.setAttribute('disablepictureinpicture',''); v.setAttribute('aria-hidden','true'); v.tabIndex = -1;
    v.preload = 'none'; v.poster = box.getAttribute('data-poster') || n + '.jpg'; v.dataset.src = n + '.mp4';
    box.insertBefore(v, box.firstChild);
  });
  var vs = [].slice.call(D.querySelectorAll('video[data-src]'));
  function load(v){ if (!v.src) v.src = v.dataset.src; }
  if ('IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function(es){ es.forEach(function(e){
      var v = e.target;
      if (e.isIntersecting) { load(v); var p = v.play(); if (p && p.catch) p.catch(function(){}); }
      else if (v.src) v.pause();
    }); }, { rootMargin: '200px 0px' });
    vs.forEach(function(v){ vo.observe(v); });
  } else vs.forEach(function(v){ load(v); v.autoplay = true; });

  D.querySelectorAll('[data-som]').forEach(function(b){
    b.addEventListener('click', function(){
      var v = b.parentNode.querySelector('video'); if (!v) return;
      load(v); v.loop = false; v.muted = false; v.currentTime = 0; v.controls = true;
      var p = v.play(); if (p && p.catch) p.catch(function(){});
      b.classList.add('on');
    });
  });

  var st = D.getElementById('sticky'), pl = D.getElementById('planos');
  if (st && pl) {
    var sc = function(){ var p = pl.getBoundingClientRect(); st.classList.toggle('on', scrollY > 900 && (p.top > innerHeight || p.bottom < 0)); };
    addEventListener('scroll', sc, {passive:true});
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, {rootMargin:'0px 0px -8% 0px'});
    D.querySelectorAll('section .glass').forEach(function(el){ el.classList.add('rv'); io.observe(el); });
  }
})();
