/* La Maison des Hautes-Eaux — site de démonstration La Balise.
   Tout est local : rien n'est envoyé, rien n'est enregistré. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ================= Données ================= */
  // rates : [semaine, vendredi-samedi, juillet-août]
  var ROOMS = {
    estran: { name: "L'Estran", cap: 2, rates: [95, 110, 125] },
    hortensias: { name: 'Les Hortensias', cap: 2, rates: [85, 99, 110] },
    vigie: { name: 'La Vigie', cap: 4, rates: [140, 155, 175] }
  };
  var DIRECT_DISCOUNT = 0.10;
  var TAX_PER_ADULT_NIGHT = 1; // exemple : dépend de la commune
  var MIN_NIGHTS = 2, MONTHS_AHEAD = 6;

  var DAY = 86400000;
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function key(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function nightsBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }
  function euros(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
  function fmt(d, opts) { return d.toLocaleDateString('fr-FR', opts); }
  function short(d) { return fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function long(d) { return fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }); }
  function rate(room, d) {
    var r = ROOMS[room].rates, m = d.getMonth(), w = d.getDay();
    return m === 6 || m === 7 ? r[2] : (w === 5 || w === 6 ? r[1] : r[0]);
  }

  var today = startOfDay(new Date());
  var lastDay = new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD, 0);

  /* ---- occupation simulée, stable pour une journée donnée ---- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var TAKEN = {};
  Object.keys(ROOMS).forEach(function (room) {
    var r = rng(hash(room + key(today))), set = {};
    for (var d = today; d <= lastDay;) {
      var w = d.getDay(), summer = d.getMonth() === 6 || d.getMonth() === 7;
      var p = summer ? 0.5 : (w === 5 || w === 6 ? 0.28 : 0.1);
      if (r() < p) {
        var len = 2 + Math.floor(r() * 4);
        for (var i = 0; i < len; i++) set[key(addDays(d, i))] = true;
        d = addDays(d, len + 1);
      } else d = addDays(d, 1);
    }
    TAKEN[room] = set;
  });
  function isTaken(room, d) { return !!TAKEN[room][key(d)]; }
  function rangeFree(room, a, b) { for (var d = a; d < b; d = addDays(d, 1)) if (isTaken(room, d)) return false; return true; }

  /* ================= En-tête, parallaxe, apparitions ================= */
  var top = $('[data-top]');
  var layers = $all('.layer').map(function (el) { return { el: el, depth: +el.getAttribute('data-depth') }; });
  var hero = $('.hero'), ticking = false;
  function onScroll() {
    var y = window.scrollY;
    top.classList.toggle('is-scrolled', y > 10);
    if (!reduceMotion && y < hero.offsetHeight + 200) {
      layers.forEach(function (l) { l.el.style.transform = 'translateY(' + (y * l.depth).toFixed(1) + 'px)'; });
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (i * 90) + 'ms';
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    $all('.reveal').forEach(function (el) { io.observe(el); });

    var sticky = $('[data-sticky]'), inHero = true, inBooking = false;
    var upd = function () { sticky.classList.toggle('is-away', inHero || inBooking); };
    new IntersectionObserver(function (e) { inHero = e[0].isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(function (e) { inBooking = e[0].isIntersecting; upd(); }, { threshold: 0.05 }).observe($('#disponibilites'));
  } else {
    $all('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
  }

  $('[data-sync-min]').textContent = 3 + (hash(key(today)) % 40);

  /* ================= Calendrier ================= */
  var state = { room: 'estran', offset: 0, start: null, end: null };
  var calEl = $('[data-cal]'), hint = $('[data-cal-hint]');
  var prevBtn = $('[data-cal-prev]'), nextBtn = $('[data-cal-next]');
  var DOW = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

  function canEnd(d) {
    return state.start && !state.end && d > state.start &&
      nightsBetween(state.start, d) >= MIN_NIGHTS && rangeFree(state.room, state.start, d);
  }

  function renderCal() {
    calEl.innerHTML = '';
    for (var m = 0; m < 2; m++) {
      var first = new Date(today.getFullYear(), today.getMonth() + state.offset + m, 1);
      var box = document.createElement('div');
      box.className = 'cal-month';
      var h = document.createElement('h4');
      h.textContent = fmt(first, { month: 'long', year: 'numeric' });
      box.appendChild(h);
      var grid = document.createElement('div');
      grid.className = 'cal-grid';
      DOW.forEach(function (n) { var s = document.createElement('span'); s.className = 'cal-dow'; s.textContent = n; grid.appendChild(s); });
      var lead = (first.getDay() + 6) % 7;
      for (var i = 0; i < lead; i++) grid.appendChild(document.createElement('span'));
      var days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      for (var n = 1; n <= days; n++) grid.appendChild(dayButton(new Date(first.getFullYear(), first.getMonth(), n)));
      box.appendChild(grid);
      calEl.appendChild(box);
    }
    prevBtn.disabled = state.offset === 0;
    nextBtn.disabled = state.offset >= MONTHS_AHEAD - 2;
    hint.textContent = !state.start ? 'Choisissez votre date d’arrivée' :
      !state.end ? 'Arrivée le ' + short(state.start) + ' · choisissez le départ' :
      nightsBetween(state.start, state.end) + ' nuits, du ' + short(state.start) + ' au ' + short(state.end);
  }

  function dayButton(d) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.textContent = d.getDate();
    b.setAttribute('data-date', key(d));
    var past = d < today || d > lastDay, taken = isTaken(state.room, d);
    var selectingEnd = state.start && !state.end;
    var status = taken ? 'réservé' : 'libre';
    if (taken) b.classList.add('is-taken');
    if (+d === +today) b.classList.add('is-today');
    // un jour réservé peut servir de jour de départ (la chambre se libère le matin)
    if (past || (taken && !(selectingEnd && canEnd(d)))) b.disabled = true;
    if (state.start && +d === +state.start) b.classList.add('is-start');
    if (state.end && +d === +state.end) b.classList.add('is-end');
    if (state.start && state.end && d > state.start && d < state.end) b.classList.add('is-in');
    var sel = b.classList.contains('is-start') || b.classList.contains('is-end');
    b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    b.setAttribute('aria-label', long(d) + ', ' + (past ? 'indisponible' : status) + (sel ? ', sélectionné' : ''));
    b.addEventListener('click', function () { pick(d); });
    b.addEventListener('mouseenter', function () { preview(d); });
    return b;
  }

  function preview(d) {
    if (!state.start || state.end) return;
    var ok = canEnd(d);
    $all('.day', calEl).forEach(function (b) {
      var p = b.getAttribute('data-date').split('-'), x = new Date(+p[0], +p[1] - 1, +p[2]);
      b.classList.toggle('is-hover', ok && x > state.start && x <= d);
    });
  }

  function pick(d) {
    if (!state.start || state.end || d <= state.start) {
      if (isTaken(state.room, d)) return;
      state.start = d; state.end = null;
    } else if (canEnd(d)) {
      state.end = d;
    } else if (nightsBetween(state.start, d) < MIN_NIGHTS) {
      hint.textContent = 'Deux nuits minimum : choisissez un départ plus tard';
      return;
    } else {
      if (isTaken(state.room, d)) return;
      state.start = d; state.end = null;
    }
    renderCal();
    renderSummary();
  }

  prevBtn.addEventListener('click', function () { if (state.offset > 0) { state.offset--; renderCal(); } });
  nextBtn.addEventListener('click', function () { if (state.offset < MONTHS_AHEAD - 2) { state.offset++; renderCal(); } });
  calEl.addEventListener('mouseleave', function () { $all('.is-hover', calEl).forEach(function (b) { b.classList.remove('is-hover'); }); });

  /* ================= Chambre sélectionnée ================= */
  var tabs = $all('[data-tab]');
  function setRoom(room, keepDates) {
    state.room = room;
    tabs.forEach(function (t) { t.setAttribute('aria-pressed', t.getAttribute('data-tab') === room ? 'true' : 'false'); });
    if (!keepDates && state.start && state.end && !rangeFree(room, state.start, state.end)) {
      state.start = state.end = null;
    } else if (!keepDates && state.start && !state.end && isTaken(room, state.start)) {
      state.start = null;
    }
    renderCal();
    renderSummary();
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { setRoom(t.getAttribute('data-tab')); }); });
  $all('[data-pick-room]').forEach(function (b) {
    b.addEventListener('click', function () {
      setRoom(b.getAttribute('data-pick-room'));
      $('#disponibilites').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ================= Récapitulatif ================= */
  var sum = {
    room: $('[data-sum-room]'), dates: $('[data-sum-dates]'), cap: $('[data-sum-cap]'),
    lines: $('[data-sum-lines]'), platform: $('[data-sum-platform]'), direct: $('[data-sum-direct]'),
    tax: $('[data-sum-tax]'), total: $('[data-sum-total]'), save: $('[data-sum-save]'), go: $('[data-sum-go]')
  };
  var adultsSel = $('[data-adults]'), childrenSel = $('[data-children]');
  function quote() {
    if (!state.start || !state.end) return null;
    var n = nightsBetween(state.start, state.end), direct = 0;
    for (var d = state.start; d < state.end; d = addDays(d, 1)) direct += rate(state.room, d);
    var platform = Math.round(direct / (1 - DIRECT_DISCOUNT));
    var tax = +adultsSel.value * n * TAX_PER_ADULT_NIGHT;
    return { nights: n, direct: direct, platform: platform, tax: tax, total: direct + tax, save: platform - direct };
  }
  function renderSummary() {
    var room = ROOMS[state.room], q = quote();
    sum.room.textContent = room.name;
    var guests = +adultsSel.value + +childrenSel.value;
    var over = guests > room.cap;
    sum.cap.textContent = over ? room.name + ' accueille ' + room.cap + ' personnes au maximum.' + (state.room === 'vigie' ? '' : ' La Vigie accueille jusqu’à 4.') : '';
    if (!q) {
      sum.dates.textContent = state.start ? 'Arrivée le ' + long(state.start) + '. Choisissez maintenant le départ.' : 'Aucune date choisie pour l’instant.';
      sum.lines.hidden = true; sum.save.hidden = true; sum.go.disabled = true;
      return;
    }
    sum.dates.innerHTML = 'Du <strong></strong> au <strong></strong> · ' + q.nights + ' nuits';
    sum.dates.children[0].textContent = short(state.start);
    sum.dates.children[1].textContent = short(state.end);
    sum.platform.textContent = euros(q.platform);
    sum.direct.textContent = euros(q.direct);
    sum.tax.textContent = euros(q.tax);
    sum.total.textContent = euros(q.total);
    sum.save.textContent = 'Vous économisez ' + euros(q.save) + ' en réservant ici';
    sum.lines.hidden = false;
    if (sum.save.hidden) { sum.save.hidden = false; }
    sum.go.disabled = over;
  }
  adultsSel.addEventListener('change', renderSummary);
  childrenSel.addEventListener('change', renderSummary);

  /* ================= Demande de réservation ================= */
  var request = $('[data-request]'), recap = $('[data-request-recap]'), reqErr = $('[data-request-error]');
  var sent = $('[data-sent]');
  function recapText() {
    var q = quote(), g = +adultsSel.value, c = +childrenSel.value;
    return ROOMS[state.room].name + ' · du ' + long(state.start) + ' au ' + long(state.end) + ' · ' +
      g + (g > 1 ? ' adultes' : ' adulte') + (c ? ', ' + c + (c > 1 ? ' enfants' : ' enfant') : '') + ' · ' + euros(q.total);
  }
  sum.go.addEventListener('click', function () {
    recap.textContent = recapText();
    request.hidden = false;
    sent.hidden = true;
    request.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { request.nom.focus({ preventScroll: true }); }, reduceMotion ? 0 : 500);
  });
  $('[data-request-back]').addEventListener('click', function () {
    request.hidden = true;
    $('#disponibilites').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  request.addEventListener('submit', function (e) {
    e.preventDefault();
    var nom = request.nom.value.trim(), email = request.email.value.trim();
    var msg = !nom ? 'Indiquez votre nom.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'Cette adresse e-mail ne semble pas complète.' : '';
    reqErr.textContent = msg;
    if (msg) return;
    var q = quote();
    $('[data-sent-name]').textContent = nom.split(' ')[0];
    $('[data-sent-text]').textContent = 'Anne vous répond sous 24 h à ' + email + ' pour confirmer ' + ROOMS[state.room].name +
      ' du ' + long(state.start) + ' au ' + long(state.end) + '. Un acompte de 30 % (' + euros(q.total * 0.3) + ') vous sera demandé pour bloquer les dates.';
    request.hidden = true;
    sent.hidden = false;
    sent.focus({ preventScroll: true });
    sent.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });
  $('[data-sent-reset]').addEventListener('click', function () {
    request.reset();
    reqErr.textContent = '';
    sent.hidden = true;
    state.start = state.end = null;
    renderCal();
    renderSummary();
    $('#disponibilites').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ================= Recherche rapide ================= */
  var qArr = $('[data-q-arrival]'), qNights = $('[data-q-nights]'), qGuests = $('[data-q-guests]'), qRes = $('[data-q-result]');
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var nextFri = addDays(today, ((5 - today.getDay() + 7) % 7) || 7);
  qArr.value = iso(nextFri);
  qArr.min = iso(today);
  qArr.max = iso(addDays(lastDay, -MIN_NIGHTS));

  $('[data-quick]').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = qArr.value.split('-');
    if (p.length !== 3) { qRes.textContent = 'Choisissez une date d’arrivée.'; return; }
    var a = new Date(+p[0], +p[1] - 1, +p[2]), n = +qNights.value, g = +qGuests.value, b = addDays(a, n);
    if (a < today || b > lastDay) { qRes.textContent = 'Nous prenons les réservations jusqu’au ' + long(lastDay) + '.'; return; }
    var free = [];
    Object.keys(ROOMS).forEach(function (room) {
      var badge = $('[data-avail="' + room + '"]'), card = badge.closest('.room');
      var fits = ROOMS[room].cap >= g, ok = fits && rangeFree(room, a, b);
      badge.hidden = false;
      badge.className = 'room-avail ' + (ok ? 'is-free' : 'is-full');
      badge.textContent = ok ? 'Libre à ces dates' : fits ? 'Déjà réservée' : 'Pour ' + ROOMS[room].cap + ' personnes';
      card.classList.toggle('is-dim', !ok);
      if (ok) free.push(room);
    });
    var when = 'du ' + short(a) + ' au ' + short(b), dot = /\.$/.test(when) ? '' : '.';
    qRes.textContent = free.length ? (free.length > 1 ? free.length + ' chambres libres ' : 'Une chambre libre ') + when + dot + ' Les dates sont déjà cochées dans le calendrier.' :
      'Aucune chambre libre ' + when + ' pour ' + g + (g > 1 ? ' personnes' : ' personne') + '. Essayez d’autres dates.';
    if (free.length) {
      state.start = a; state.end = b;
      state.offset = Math.min(MONTHS_AHEAD - 2, (a.getFullYear() - today.getFullYear()) * 12 + a.getMonth() - today.getMonth());
      adultsSel.value = String(Math.min(g, 4));
      childrenSel.value = '0';
      setRoom(free[0], true);
      document.getElementById('chambres').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  renderCal();
  renderSummary();
})();
