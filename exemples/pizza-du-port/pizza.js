/* Pizza du Port — site de démonstration La Balise.
   Tout est local : rien n'est envoyé, rien n'est enregistré. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ================= Données ================= */
  var MENU = {
    margherita: { name: 'Margherita', price: 9.5 },
    reine: { name: 'Reine', price: 11.5 },
    diavola: { name: 'Diavola', price: 12.5 },
    fromages: { name: 'Quatre fromages', price: 13 },
    guemene: { name: 'La Guémené', price: 13.5 },
    mouliere: { name: 'La Moulière', price: 14 },
    corsaire: { name: 'La Corsaire', price: 14.5 },
    chevre: { name: 'Chèvre & miel', price: 13 },
    automne: { name: "L'Automnale", price: 13.5 }
  };
  var STOPS = {
    suliac: { name: 'Saint-Suliac', place: 'place du Port', x: 262, y: 222 },
    pleslin: { name: 'Pleslin-Trigavou', place: 'place de la Mairie', x: 84, y: 346 },
    langrolay: { name: 'Langrolay-sur-Rance', place: 'le bourg', x: 150, y: 292 },
    ville: { name: 'La Ville-ès-Nonais', place: 'le bourg', x: 268, y: 312 }
  };
  // index = Date.getDay() (0 = dimanche)
  var SCHEDULE = [null, 'suliac', 'pleslin', null, 'langrolay', 'ville', 'suliac'];
  var DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var OPEN = 18 * 60, CLOSE = 21 * 60 + 30;

  function euros(n) { return n.toFixed(2).replace('.', ',') + ' €'; }
  function hhmm(min) { var h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m < 10 ? '0' : '') + m; }
  function nowMin(d) { return d.getHours() * 60 + d.getMinutes(); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ================= Pizzas dessinées (SVG génératif) ================= */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function blob(cx, cy, r, jitter, pts, rand) {
    var p = [];
    for (var i = 0; i < pts; i++) { var a = i / pts * Math.PI * 2, rr = r + (rand() - 0.5) * 2 * jitter; p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    var d = '';
    for (var j = 0; j < pts; j++) {
      var a0 = p[j], a1 = p[(j + 1) % pts];
      var mx = ((a0[0] + a1[0]) / 2).toFixed(2), my = ((a0[1] + a1[1]) / 2).toFixed(2);
      d += (j === 0 ? 'M' + mx + ' ' + my : ' Q' + a0[0].toFixed(2) + ' ' + a0[1].toFixed(2) + ' ' + mx + ' ' + my);
    }
    var f = p[0], m0 = [(p[pts - 1][0] + f[0]) / 2, (p[pts - 1][1] + f[1]) / 2];
    return d + ' Q' + f[0].toFixed(2) + ' ' + f[1].toFixed(2) + ' ' + m0[0].toFixed(2) + ' ' + m0[1].toFixed(2) + 'Z';
  }
  function place(n, maxR, minDist, rand, taken) {
    var out = [], tries = 0;
    while (out.length < n && tries < n * 60) {
      tries++;
      var a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * maxR, x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a), ok = true;
      for (var i = 0; i < taken.length; i++) { var dx = taken[i][0] - x, dy = taken[i][1] - y; if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; } }
      if (ok) { var pt = [x, y, rand() * 360]; out.push(pt); taken.push(pt); }
    }
    return out;
  }
  function g(x, y, rot, s, inner) { return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(0) + ')' + (s ? ' scale(' + s + ')' : '') + '">' + inner + '</g>'; }

  var TOP = {
    cheese: function (p, rand) { return '<path d="' + blob(p[0], p[1], 4.2 + rand() * 2.8, 1.2, 9, rand) + '" fill="#FBF1D6"/><circle cx="' + (p[0] + 1.2).toFixed(1) + '" cy="' + (p[1] - 1).toFixed(1) + '" r="' + (0.7 + rand()).toFixed(1) + '" fill="#E9C27C" opacity=".8"/>'; },
    basil: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M0 -5.5C4.2 -3 4 3 0 5.5C-4 3 -4.2 -3 0 -5.5Z" fill="#2F7A3A"/><path d="M0 -5V5" stroke="#1D5626" stroke-width=".5"/>'); },
    ham: function (p, rand) { return g(p[0], p[1], p[2], 1, '<path d="' + blob(0, 0, 3.6, 1.1, 7, rand) + '" fill="#EBA5A0" stroke="#D78682" stroke-width=".6" transform="scale(1.4 1)"/>'); },
    mushroom: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M-4.6 .6A4.6 4.2 0 0 1 4.6 .6L1.8 .6L2.2 4.2H-2.2L-1.8 .6Z" fill="#DCC7A2" stroke="#9E8260" stroke-width=".6"/>'); },
    salami: function (p) { return g(p[0], p[1], p[2], 1, '<circle r="5" fill="#B8321E" stroke="#8E2414" stroke-width=".9"/><circle cx="-1.6" cy="-1" r=".9" fill="#F2C9A8"/><circle cx="1.8" cy=".6" r=".7" fill="#F2C9A8"/><circle cx="-.2" cy="2.2" r=".6" fill="#F2C9A8"/><circle cx="1" cy="-2.4" r=".5" fill="#F2C9A8"/>'); },
    chili: function (p) { return g(p[0], p[1], p[2], 1, '<circle r="1.7" fill="none" stroke="#D42A1A" stroke-width="1"/><circle r=".45" fill="#F6D27A"/>'); },
    speck: function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r=".55" fill="#3F6B2E"/>'; },
    goat: function (p) { return g(p[0], p[1], p[2], 1, '<circle r="4.3" fill="#FFFFFF" stroke="#D9D2C4" stroke-width="1.1"/><circle cx="-1" cy="-1" r="1.4" fill="#F6F1E7"/>'); },
    gorgonzola: function (p, rand) { return '<path d="' + blob(p[0], p[1], 3, 1, 7, rand) + '" fill="#F1ECDD"/><circle cx="' + (p[0] - .8).toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r=".6" fill="#5F7F99"/><circle cx="' + (p[0] + 1).toFixed(1) + '" cy="' + (p[1] + .9).toFixed(1) + '" r=".45" fill="#5F7F99"/>'; },
    parmesan: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M-3.4 -.8L3 -1.4L2.6 1L-3 1.2Z" fill="#F4E3A6" stroke="#DCC580" stroke-width=".3"/>'); },
    andouille: function (p) { return g(p[0], p[1], p[2], 1, '<circle r="4.8" fill="#A07C68" stroke="#5E4436" stroke-width=".8"/><circle r="3.3" fill="none" stroke="#6E5040" stroke-width=".6"/><circle r="1.8" fill="none" stroke="#6E5040" stroke-width=".6"/><circle r=".6" fill="#5E4436"/>'); },
    apple: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M-5 0A5 5 0 0 1 5 0A5 3 0 0 0 -5 0Z" fill="#F1DE97" stroke="#C0392B" stroke-width=".8"/>'); },
    onion: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M-3.5 1.5A4 4 0 0 1 3.5 1.5" fill="none" stroke="#8A4A2C" stroke-width="1.3" stroke-linecap="round"/>'); },
    redonion: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M-3.5 1.5A4 4 0 0 1 3.5 1.5" fill="none" stroke="#8E3A6B" stroke-width="1" stroke-linecap="round"/><path d="M-2.2 1.5A2.5 2.5 0 0 1 2.2 1.5" fill="none" stroke="#C88AB0" stroke-width=".6" stroke-linecap="round"/>'); },
    mussel: function (p) { return g(p[0], p[1], p[2], 1, '<ellipse rx="3.6" ry="2.1" fill="#F0913F" stroke="#B85A1F" stroke-width=".6"/><path d="M-2.4 0H2" stroke="#C9692A" stroke-width=".5"/>'); },
    salmon: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M-5 -1.5C-2 -3.5 2 -3 5 -1.4C4 .5 4.4 2 3.8 3C1 1.6 -2 2 -4.6 2.6C-4 1 -4.4 -.3 -5 -1.5Z" fill="#F2896A" stroke="#E0694A" stroke-width=".5"/><path d="M-3 -.8C0 -2 2 -1.5 3.5 -.4M-3 1C0 0 2 .3 3.4 1.3" fill="none" stroke="#F9C0A9" stroke-width=".5"/>'); },
    caper: function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.3" fill="#6B7F2F" stroke="#4E5F20" stroke-width=".4"/>'; },
    dill: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M0 -4V4M0 -2L2 -3.5M0 0L-2.2 -1.4M0 2L2 1M0 -1L1.8 -.4M0 1L-1.7 2.2" stroke="#3E7F35" stroke-width=".45" stroke-linecap="round"/>'); },
    walnut: function (p, rand) { return '<path d="' + blob(p[0], p[1], 2.4, .8, 7, rand) + '" fill="#8A5A34" stroke="#6A4224" stroke-width=".5"/>'; },
    arugula: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M0 -6L1.6 -4L3 -3.4L1.8 -1.6L3.4 -.4L1.8 1L2.6 3L.6 3.4L0 6L-.6 3.4L-2.6 3L-1.8 1L-3.4 -.4L-1.8 -1.6L-3 -3.4L-1.6 -4Z" fill="#3D7A2E"/>'); },
    lardon: function (p) { return g(p[0], p[1], p[2], 1, '<rect x="-2.6" y="-1.6" width="5.2" height="3.2" rx=".8" fill="#C4604F"/><rect x="-2.6" y="-.3" width="5.2" height=".9" fill="#F3D5C5"/>'); },
    hazelnut: function (p) { return g(p[0], p[1], p[2], 1, '<circle r="2.1" fill="#B07A45"/><path d="M-2.1 0A2.1 2.1 0 0 0 2.1 0Z" fill="#E7C08A"/>'); },
    sage: function (p) { return g(p[0], p[1], p[2], 1, '<path d="M0 -6C2.6 -3 2.6 3 0 6C-2.6 3 -2.6 -3 0 -6Z" fill="#7E9A72"/><path d="M0 -5.5V5.5" stroke="#5C7752" stroke-width=".4"/>'); }
  };
  var BASES = {
    tomato: ['#D9492B', '#B5321C'],
    white: ['#F6EACB', '#E7D1A2'],
    pumpkin: ['#F0973A', '#D8701F']
  };
  var RECIPES = {
    margherita: { base: 'tomato', layers: [['cheese', 7, 9], ['basil', 5, 8]] },
    reine: { base: 'tomato', layers: [['cheese', 6, 8], ['ham', 6, 8], ['mushroom', 7, 7]] },
    diavola: { base: 'tomato', layers: [['cheese', 5, 8], ['salami', 8, 9], ['chili', 7, 4], ['speck', 22, 1]] },
    fromages: { base: 'white', layers: [['cheese', 7, 8], ['goat', 5, 9], ['gorgonzola', 6, 6], ['parmesan', 9, 4]] },
    guemene: { base: 'white', layers: [['cheese', 4, 9], ['andouille', 7, 9], ['apple', 6, 7], ['onion', 9, 3]] },
    mouliere: { base: 'white', layers: [['cheese', 4, 9], ['mussel', 15, 5.5], ['speck', 34, 1]] },
    corsaire: { base: 'white', layers: [['salmon', 7, 9], ['redonion', 6, 6], ['caper', 12, 3], ['dill', 9, 3]] },
    chevre: { base: 'white', layers: [['goat', 8, 8.5], ['walnut', 6, 5], ['arugula', 7, 6]], honey: true },
    automne: { base: 'pumpkin', layers: [['cheese', 4, 9], ['lardon', 11, 5], ['hazelnut', 8, 4], ['sage', 5, 7]] }
  };
  RECIPES.hero = { base: 'tomato', layers: [['cheese', 9, 8], ['basil', 7, 7], ['salami', 5, 9]] };

  var uid = 0;
  function pizzaMarkup(kind, seedKey) {
    var R = RECIPES[kind]; if (!R) return '';
    var rand = rng(hash(seedKey || kind)), id = 'pz' + (++uid), b = BASES[R.base];
    var s = '<defs>' +
      '<radialGradient id="' + id + 'c"><stop offset=".78" stop-color="#E9B066"/><stop offset=".9" stop-color="#D99A4E"/><stop offset="1" stop-color="#A9692C"/></radialGradient>' +
      '<radialGradient id="' + id + 's" cx="45%" cy="40%"><stop offset="0" stop-color="' + b[0] + '"/><stop offset="1" stop-color="' + b[1] + '"/></radialGradient>' +
      '</defs>';
    s += '<path d="' + blob(50, 50, 48.5, 0.9, 28, rand) + '" fill="url(#' + id + 'c)"/>';
    // léopardage de la croûte
    for (var i = 0; i < 16; i++) {
      var a = rand() * Math.PI * 2, r = 43.5 + rand() * 3.8;
      s += '<ellipse cx="' + (50 + r * Math.cos(a)).toFixed(1) + '" cy="' + (50 + r * Math.sin(a)).toFixed(1) + '" rx="' + (0.8 + rand() * 1.9).toFixed(1) + '" ry="' + (0.6 + rand() * 1.2).toFixed(1) + '" transform="rotate(' + (a * 57.3).toFixed(0) + ' ' + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1) + ')" fill="#3B2416" opacity="' + (0.45 + rand() * 0.45).toFixed(2) + '"/>';
    }
    s += '<path d="' + blob(50, 50, 40.5, 1.6, 22, rand) + '" fill="url(#' + id + 's)"/>';
    var taken = [];
    R.layers.forEach(function (L) {
      var fn = TOP[L[0]];
      place(L[1], 34, L[2], rand, L[2] > 2 ? taken : []).forEach(function (p) { s += fn(p, rand); });
    });
    if (R.honey) s += '<path d="M24 40C32 30 38 52 46 42S58 34 64 46S74 58 78 50" fill="none" stroke="#E9A623" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>';
    return s;
  }
  function drawPizza(svg, kind, seedKey) { svg.innerHTML = pizzaMarkup(kind, seedKey); }
  function newPizzaSvg(kind, cls) {
    var el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('viewBox', '0 0 100 100');
    el.setAttribute('aria-hidden', 'true');
    if (cls) el.setAttribute('class', cls);
    drawPizza(el, kind, kind); // même graine : même pizza que sur la carte
    return el;
  }
  $all('[data-pizza]').forEach(function (svg) { var k = svg.getAttribute('data-pizza'); drawPizza(svg, k, k); });

  /* ================= Statut du jour + tournée ================= */
  var now = new Date();
  var today = now.getDay(), tMin = nowMin(now);
  function nextServiceDay(fromDay, includeFrom) {
    for (var k = includeFrom ? 0 : 1; k < 8; k++) { var d = (fromDay + k) % 7; if (SCHEDULE[d]) return { day: d, offset: k }; }
    return null;
  }

  var live = $('[data-live]'), liveText = $('[data-live-text]');
  var todayStop = SCHEDULE[today] && STOPS[SCHEDULE[today]];
  var selDay;
  if (todayStop && tMin < CLOSE) {
    selDay = today;
    if (tMin >= OPEN) {
      live.classList.add('is-open');
      liveText.innerHTML = 'Le four est allumé à <strong>' + todayStop.name + '</strong>, ' + todayStop.place + ' · jusqu\'à 21h30';
    } else {
      live.classList.add('is-soon');
      liveText.innerHTML = 'Ce soir à <strong>' + todayStop.name + '</strong>, ' + todayStop.place + ' · dès 18h';
    }
  } else {
    var nx = nextServiceDay(today, false);
    selDay = nx.day;
    var st = STOPS[SCHEDULE[nx.day]];
    liveText.innerHTML = (todayStop ? 'Fini pour ce soir · ' : 'Relâche aujourd\'hui · ') +
      (nx.offset === 1 ? 'demain' : DAY_NAMES[nx.day]) + ' à <strong>' + st.name + '</strong> dès 18h';
  }

  $all('.day[data-stop]').forEach(function (btn) {
    var d = +btn.getAttribute('data-day'), state = $('[data-state]', btn);
    if (d === today) state.textContent = tMin < OPEN ? 'Ce soir' : tMin < CLOSE ? 'En ce moment' : 'Terminé';
    else if (d === (today + 1) % 7) state.textContent = 'Demain';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () { selectDay(d); });
  });

  var truck = $('[data-truck]'), mapNote = $('[data-map-note]');
  function selectDay(d) {
    var key = SCHEDULE[d]; if (!key) return;
    var stop = STOPS[key];
    $all('.day[data-stop]').forEach(function (b) {
      var on = +b.getAttribute('data-day') === d;
      b.classList.toggle('is-sel', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $all('[data-stop-pin]').forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-stop-pin') === key); });
    truck.style.transform = 'translate(' + stop.x + 'px, ' + stop.y + 'px)';
    var isTonight = d === today && tMin < CLOSE;
    mapNote.textContent = isTonight ? 'le camion est ici ce soir !' : DAY_NAMES[d] + ', rendez-vous à ' + stop.name + ' !';
  }
  selectDay(selDay);

  /* ================= Four : température + braises ================= */
  var temp = $('[data-temp]');
  if (temp && !reduceMotion) setInterval(function () { temp.textContent = 428 + Math.round(Math.random() * 18); }, 1700);

  var canvas = $('[data-embers]');
  if (canvas && !reduceMotion && canvas.getContext) {
    var ctx = canvas.getContext('2d'), hero = canvas.parentElement, oven = $('.oven'), parts = [], W = 0, H = 0, dpr = 1, running = false, src = { x: 0, y: 0, w: 0 };
    var resize = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var hr = hero.getBoundingClientRect(), or = oven.getBoundingClientRect();
      src = { x: or.left - hr.left + or.width * 0.3, y: or.top - hr.top + or.height * 0.62, w: or.width * 0.4 };
    };
    var max = window.innerWidth < 720 ? 26 : 60;
    var spawn = function () {
      return { x: src.x + Math.random() * src.w, y: src.y + Math.random() * 30, vx: (Math.random() - 0.5) * 0.3, vy: -(0.35 + Math.random() * 0.9), life: 0, ttl: 180 + Math.random() * 260, r: 0.7 + Math.random() * 1.8, ph: Math.random() * 6.28, hue: 22 + Math.random() * 22 };
    };
    var tick = function () {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (parts.length < max && Math.random() < 0.5) parts.push(spawn());
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life++; p.ph += 0.04;
        p.x += p.vx + Math.sin(p.ph) * 0.35; p.y += p.vy; p.vy *= 0.999;
        var k = p.life / p.ttl;
        if (k >= 1) { parts.splice(i, 1); continue; }
        var a = (k < 0.1 ? k * 10 : 1 - k) * (0.6 + 0.4 * Math.sin(p.ph * 3));
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,62%,' + (a * 0.9).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,60%,' + (a * 0.15).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    var setRunning = function (on) { if (on && !running) { running = true; requestAnimationFrame(tick); } else if (!on) running = false; };
    resize();
    window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { setRunning(e[0].isIntersecting && !document.hidden); }).observe(hero);
    else setRunning(true);
    document.addEventListener('visibilitychange', function () { setRunning(!document.hidden); });
  }

  /* ================= Filtres de la carte ================= */
  var chips = $all('[data-filter]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) { var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $all('.dish').forEach(function (d, i) {
        var show = f === 'all' || d.getAttribute('data-cat').split(' ').indexOf(f) !== -1;
        d.classList.toggle('is-hidden', !show);
        d.classList.remove('is-in');
        if (show) { void d.offsetWidth; d.style.animationDelay = (i % 9) * 40 + 'ms'; d.classList.add('is-in'); }
      });
    });
  });

  /* ================= Commande ================= */
  var cart = {};
  var countEl = $('[data-cart-count]'), cartList = $('[data-cart]'), cartEmpty = $('[data-cart-empty]'), totalEl = $('[data-total]');
  var sticky = $('[data-sticky]'), stickyText = $('[data-sticky-text]'), toast = $('[data-toast]'), toastTimer;

  function count() { var n = 0; for (var k in cart) n += cart[k]; return n; }
  function total() { var t = 0; for (var k in cart) t += cart[k] * MENU[k].price; return t; }
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 1900);
  }
  function bump() { countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }

  var orderInView = false;
  function renderCart() {
    var n = count(), t = total();
    countEl.textContent = n;
    countEl.setAttribute('aria-label', n + (n > 1 ? ' pizzas' : ' pizza') + ' dans la commande');
    totalEl.textContent = euros(t);
    cartEmpty.hidden = n > 0;
    // on ne reconstruit que les lignes qui changent : l'animation d'entrée ne rejoue pas
    Object.keys(MENU).forEach(function (k) {
      var li = cartList.querySelector('[data-line="' + k + '"]');
      if (!cart[k]) { if (li) li.remove(); return; }
      if (!li) {
        li = document.createElement('li');
        li.setAttribute('data-line', k);
        li.appendChild(newPizzaSvg(k, 'cart-mini'));
        var name = document.createElement('div');
        name.innerHTML = '<span class="cart-name"></span><span class="cart-sub"></span>';
        name.firstChild.textContent = MENU[k].name;
        li.appendChild(name);
        var q = document.createElement('div');
        q.className = 'qty';
        q.innerHTML = '<button type="button" data-q="-1">−</button><output></output><button type="button" data-q="1">+</button>';
        q.children[0].setAttribute('aria-label', 'Une de moins : ' + MENU[k].name);
        q.children[2].setAttribute('aria-label', 'Une de plus : ' + MENU[k].name);
        q.addEventListener('click', function (e) {
          var b = e.target.closest('[data-q]'); if (!b) return;
          cart[k] = Math.max(0, cart[k] + +b.getAttribute('data-q'));
          if (!cart[k]) delete cart[k];
          renderCart();
        });
        li.appendChild(q);
        cartList.appendChild(li);
      }
      li.querySelector('.cart-sub').textContent = euros(MENU[k].price * cart[k]);
      li.querySelector('output').textContent = cart[k];
    });
    stickyText.textContent = n ? 'Ma commande · ' + n + (n > 1 ? ' pizzas' : ' pizza') + ' · ' + euros(t) : 'Voir ma commande';
    sticky.hidden = !n || orderInView;
  }

  function fly(fromSvg, kind) {
    if (reduceMotion || !fromSvg.animate) return;
    var a = fromSvg.getBoundingClientRect(), b = countEl.getBoundingClientRect();
    if (!a.width) return;
    var el = newPizzaSvg(kind, 'flyer');
    el.style.left = a.left + 'px'; el.style.top = a.top + 'px';
    el.style.width = a.width + 'px'; el.style.height = a.height + 'px';
    document.body.appendChild(el);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    var s = 26 / a.width;
    el.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + dx * 0.45 + 'px,' + (dy * 0.45 - 90) + 'px) scale(' + (0.5 + s / 2) + ') rotate(200deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ') rotate(420deg)', opacity: 0.4 }
    ], { duration: 750, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = function () { el.remove(); bump(); };
  }

  $all('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dish = btn.closest('.dish'), k = dish.getAttribute('data-id');
      cart[k] = (cart[k] || 0) + 1;
      renderCart();
      fly($('.dish-pizza', dish), k);
      if (reduceMotion) bump();
      btn.classList.remove('is-added'); void btn.offsetWidth; btn.classList.add('is-added');
      showToast(MENU[k].name + ' ajoutée à la commande');
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { orderInView = e[0].isIntersecting; renderCart(); }, { threshold: 0.15 }).observe($('#commander'));
  }

  /* ---- créneaux ---- */
  var daySel = $('[data-slot-day]'), slotsBox = $('[data-slots]'), chosenSlot = null;
  var fmtDate = function (d) { return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var dayOptions = [];
  for (var k = 0; k < 8 && dayOptions.length < 5; k++) {
    var date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k), d = date.getDay();
    if (!SCHEDULE[d] || (k === 0 && tMin > CLOSE - 30)) continue;
    dayOptions.push({ date: date, stop: STOPS[SCHEDULE[d]], isToday: k === 0, saturday: d === 6 });
  }
  dayOptions.forEach(function (o, i) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = (o.isToday ? 'Aujourd’hui' : cap(fmtDate(o.date))) + ' — ' + o.stop.name;
    daySel.appendChild(opt);
  });

  function renderSlots() {
    var o = dayOptions[+daySel.value];
    slotsBox.innerHTML = '';
    chosenSlot = null;
    var times = [];
    if (o.saturday) {
      times.push('Midi, au marché');
      for (var m = 11 * 60 + 30; m <= 13 * 60; m += 15) times.push(m);
      times.push('Le soir, place du Port');
    }
    for (var m2 = OPEN; m2 <= CLOSE - 10; m2 += 10) times.push(m2);
    var seed = rng(hash(o.date.toDateString()));
    times.forEach(function (m) {
      if (typeof m === 'string') {
        var lab = document.createElement('span');
        lab.className = 'slot-group';
        lab.textContent = m;
        slotsBox.appendChild(lab);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = hhmm(m);
      var full = seed() < 0.18, past = o.isToday && m < tMin + 20;
      if (full || past) { b.disabled = true; b.setAttribute('aria-label', hhmm(m) + (past ? ', passé' : ', complet')); }
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        $all('.slot', slotsBox).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        chosenSlot = m;
      });
      slotsBox.appendChild(b);
    });
  }
  daySel.addEventListener('change', renderSlots);
  renderSlots();

  /* ---- validation + ticket ---- */
  var form = $('[data-order]'), err = $('[data-form-error]');
  var ticketWrap = $('[data-ticket-wrap]'), ticket = $('[data-ticket]');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var prenom = form.prenom.value.trim(), tel = form.tel.value.replace(/\s/g, '');
    var msg = !count() ? 'Ajoutez au moins une pizza depuis la carte.' :
      chosenSlot === null ? 'Choisissez une heure de retrait.' :
      !prenom ? 'Indiquez votre prénom : c\'est lui qu\'on appellera au camion.' :
      !/^\+?\d{9,12}$/.test(tel) ? 'Ce numéro de téléphone ne semble pas complet.' : '';
    err.textContent = msg;
    if (msg) return;

    var o = dayOptions[+daySel.value];
    var lines = $('[data-ticket-lines]');
    lines.innerHTML = '';
    Object.keys(cart).forEach(function (k) {
      var li = document.createElement('li');
      li.innerHTML = '<span></span><span></span>';
      li.children[0].textContent = cart[k] + ' × ' + MENU[k].name;
      li.children[1].textContent = euros(cart[k] * MENU[k].price);
      lines.appendChild(li);
    });
    $('[data-ticket-no]').textContent = String(100 + Math.floor(Math.random() * 900));
    $('[data-ticket-total]').textContent = euros(total());
    var when = $('[data-ticket-when]');
    when.innerHTML = '<span></span><strong></strong><span></span>';
    when.children[0].textContent = prenom + ', votre pizza sera prête à';
    when.children[1].textContent = hhmm(chosenSlot);
    when.children[2].textContent = (o.isToday ? 'aujourd’hui' : fmtDate(o.date)) + ' · ' + o.stop.name + ', ' + o.stop.place +
      (form.pay.value === 'en-ligne' ? ' · déjà réglée' : ' · à régler au camion');
    form.classList.add('is-done');
    cart = {};
    renderCart();
    ticketWrap.hidden = false;
    ticket.style.animation = 'none'; void ticket.offsetWidth; ticket.style.animation = '';
    ticket.focus({ preventScroll: true });
    ticketWrap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });
  $('[data-ticket-reset]').addEventListener('click', function () {
    cart = {};
    form.reset();
    err.textContent = '';
    form.classList.remove('is-done');
    ticketWrap.hidden = true;
    renderSlots();
    renderCart();
    document.getElementById('carte').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  renderCart();
})();
