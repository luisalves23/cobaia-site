/* @cobaia.dev · telas de Android desenhadas em código (5, 10, 11 e 13).
   Ícones próprios no estilo de cada época; nenhum ícone, logo ou papel de parede oficial. */
(function () {
  var G = {
    phone: '<path d="M7 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5L16 11.5l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 5a2 2 0 0 1 2-2z"/>',
    msg: '<path d="M4 5h16v11H8l-4 3z"/>',
    cam: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.4" class="k"/>',
    web: '<circle cx="12" cy="12" r="8"/><path class="k" d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    pic: '<path d="M4 5h16v14H4z"/><path class="k" d="M6 17l4-5 3 3 2-2 3 4z"/>',
    gear: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.8" class="k"/>',
    mail: '<path d="M3 6h18v12H3z"/><path class="k" d="M3 6l9 7 9-7"/>',
    play: '<circle cx="12" cy="12" r="8"/><path class="k" d="M10 8.5v7l6-3.5z"/>',
    cal: '<path d="M4 6h16v14H4z"/><path class="k" d="M4 10h16M8 4v4M16 4v4"/>',
    pin: '<path d="M12 3a6 6 0 0 1 6 6c0 5-6 12-6 12S6 14 6 9a6 6 0 0 1 6-6z"/><circle cx="12" cy="9" r="2.2" class="k"/>',
    files: '<path d="M3 6h7l2 2h9v11H3z"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path class="k" d="M8 8h7M8 11h7"/>',
    note: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
    store: '<path d="M5 8h14l-1 12H6z"/><path class="k" d="M9 8a3 3 0 0 1 6 0"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path class="k" d="M12 7v5l3 2"/>',
    calc: '<path d="M6 3h12v18H6z"/><path class="k" d="M9 7h6M9 12h1M14 12h1M9 16h1M14 16h1"/>'
  };
  function ico(name, cls, bg, fg) {
    return '<span class="ai ' + (cls || '') + '" style="--bg:' + (bg || '#ccc') + ';--fg:' + (fg || '#fff') + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + G[name] + '</svg></span>';
  }
  var SB = function (t, c) { return '<div class="sb ' + (c || '') + '"><span class="t">' + t + '</span><span class="si"><i class="wf"></i><i class="bt"></i></span></div>'; };

  var make = {
    5: function () {
      var grid = [['web', '#e8eaf0', '#4a7bd8'], ['mail', '#e45a3e'], ['pic', '#2fa6a0'], ['note', '#f29a2e'], ['cal', '#3b6fd8'], ['files', '#7b8794'], ['gear', '#5b6770'], ['store', '#46a35a']];
      var dock = [['phone', '#2f9e5a'], ['msg', '#3a7be0'], null, ['cam', '#555c66'], ['web', '#e8eaf0', '#4a7bd8']];
      return '<div class="scr v5">' + SB('14:32', 'right') +
        '<div class="v5-search"><span>Pesquisar</span><i class="mic"></i></div>' +
        '<div class="grid">' + grid.map(function (g) { return '<div class="app">' + ico(g[0], 'round', g[1], g[2]) + '</div>'; }).join('') + '</div>' +
        '<div class="dock">' + dock.map(function (g) { return g ? ico(g[0], 'round', g[1], g[2]) : '<span class="drawer"><i></i><i></i><i></i><i></i><i></i><i></i></span>'; }).join('') + '</div>' +
        '<div class="nav"><i class="back"></i><i class="home"></i><i class="rec"></i></div>' +
        '<div class="anr"><b>O app não está respondendo</b><span>Deseja fechá-lo?</span><em>AGUARDAR&nbsp;&nbsp;&nbsp;OK</em></div></div>';
    },
    10: function () {
      var grid = [['web', '#ffffff', '#3f7be8'], ['pic', '#ffffff', '#e2574c'], ['play', '#ffffff', '#e2574c'], ['files', '#ffffff', '#3f7be8'], ['book', '#ffffff', '#2f9e5a'], ['cal', '#ffffff', '#3f7be8'], ['pin', '#ffffff', '#2f9e5a'], ['gear', '#ffffff', '#5f6368']];
      var dock = [['phone', '#ffffff', '#2f9e5a'], ['msg', '#ffffff', '#3f7be8'], ['cam', '#ffffff', '#5f6368'], ['mail', '#ffffff', '#e2574c'], ['store', '#ffffff', '#2f9e5a']];
      return '<div class="scr v10">' + SB('14:32') +
        '<div class="glance"><b>sexta, 14 de nov.</b><span>28 °C</span></div>' +
        '<div class="grid">' + grid.map(function (g) { return '<div class="app">' + ico(g[0], 'circle', g[1], g[2]) + '</div>'; }).join('') + '</div>' +
        '<div class="dock">' + dock.map(function (g) { return ico(g[0], 'circle', g[1], g[2]); }).join('') + '</div>' +
        '<div class="pill-s"><i class="g"></i><span></span><i class="mic"></i></div><div class="gest"></div></div>';
    },
    11: function () {
      var sug = [['play', '#ffffff', '#e2574c'], ['book', '#ffffff', '#2f9e5a'], ['web', '#ffffff', '#3f7be8'], ['note', '#ffffff', '#f29a2e'], ['files', '#ffffff', '#3f7be8']];
      var dock = [['phone', '#ffffff', '#2f9e5a'], ['msg', '#ffffff', '#3f7be8'], ['cam', '#ffffff', '#5f6368'], ['mail', '#ffffff', '#e2574c'], ['gear', '#ffffff', '#5f6368']];
      return '<div class="scr v11">' + SB('14:32') +
        '<div class="glance"><b>sexta, 14 de nov.</b><span>28 °C, ensolarado</span></div>' +
        '<div class="media"><i class="art"></i><div><b>Aula 4: Cálculo II</b><span>Portal acadêmico</span><div class="mbar"><i></i></div></div><i class="mp"></i></div>' +
        '<div class="sugg"><small>Sugestões de apps</small><div>' + sug.map(function (g) { return ico(g[0], 'circle', g[1], g[2]); }).join('') + '</div></div>' +
        '<div class="dock">' + dock.map(function (g) { return ico(g[0], 'circle', g[1], g[2]); }).join('') + '</div>' +
        '<div class="pill-s"><i class="g"></i><span></span><i class="mic"></i></div><div class="gest"></div></div>';
    },
    13: function () {
      var grid = ['web', 'pic', 'play', 'files', 'book', 'cal', 'note', 'pin', 'calc', 'clock'];
      var dock = ['phone', 'msg', 'cam', 'mail', 'gear'];
      return '<div class="scr v13">' + SB('14:32') +
        '<div class="v13-top"><div class="bigclock"><b>14</b><i>:</i><b>32</b></div><div class="v13-date"><span>sex., 14 nov.</span><span class="wx">28°</span></div></div>' +
        '<div class="grid">' + grid.map(function (g) { return '<div class="app">' + ico(g, 'themed') + '</div>'; }).join('') + '</div>' +
        '<div class="dock">' + dock.map(function (g) { return ico(g, 'themed'); }).join('') + '</div>' +
        '<div class="pill-s m3"><i class="g"></i><span>Pesquisar</span><i class="mic"></i></div><div class="gest"></div></div>';
    }
  };
  document.querySelectorAll('[data-screen]').forEach(function (el) { el.innerHTML = make[el.getAttribute('data-screen')](); });
})();
