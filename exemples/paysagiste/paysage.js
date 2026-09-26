/* Fougère & Galet — site de démonstration La Balise.
   Tout est local : rien n'est envoyé, rien n'est enregistré. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function euros(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
  function num(n) { return Math.round(n).toLocaleString('fr-FR'); }
  function smooth() { return reduceMotion ? 'auto' : 'smooth'; }

  /* ================= En-tête ================= */
  var top = $('[data-top]');
  window.addEventListener('scroll', function () { top.classList.toggle('is-scrolled', window.scrollY > 10); }, { passive: true });

  /* ================= Avant / après ================= */
  var ba = $('[data-ba]'), range = $('.ba-range', ba), touched = false;
  function setPos(v) { ba.style.setProperty('--pos', v + '%'); }
  range.addEventListener('input', function () { touched = true; setPos(range.value); });
  ba.addEventListener('pointerdown', function () { touched = true; ba.classList.add('is-drag'); });
  window.addEventListener('pointerup', function () { ba.classList.remove('is-drag'); });
  setPos(range.value);
  // Petite démonstration du geste au premier affichage, tant que personne n'a touché le curseur
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var hinted = false;
    new IntersectionObserver(function (e, obs) {
      if (!e[0].isIntersecting || hinted) return;
      hinted = true; obs.disconnect();
      var keys = [[0, 50], [700, 78], [1500, 26], [2200, 50]], t0 = null;
      var step = function (t) {
        if (touched) return;
        if (t0 === null) t0 = t;
        var dt = t - t0, i = 0;
        while (i < keys.length - 2 && dt > keys[i + 1][0]) i++;
        var a = keys[i], b = keys[i + 1], k = Math.min(1, (dt - a[0]) / (b[0] - a[0]));
        k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var v = a[1] + (b[1] - a[1]) * k;
        setPos(v); range.value = Math.round(v);
        if (dt < keys[keys.length - 1][0]) requestAnimationFrame(step);
      };
      setTimeout(function () { requestAnimationFrame(step); }, 600);
    }, { threshold: 0.6 }).observe(ba);
  }

  /* ================= Plans de jardin (SVG génératif) ================= */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function blob(cx, cy, rx, ry, jit, n, r) {
    var p = [];
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, k = 1 + (r() - .5) * 2 * jit; p.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]); }
    var d = '';
    for (var j = 0; j < n; j++) {
      var a0 = p[j], a1 = p[(j + 1) % n], mx = (a0[0] + a1[0]) / 2, my = (a0[1] + a1[1]) / 2;
      d += (j ? ' Q' + a0[0].toFixed(1) + ' ' + a0[1].toFixed(1) + ' ' : 'M') + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var f = p[0], l = p[n - 1];
    return d + ' Q' + f[0].toFixed(1) + ' ' + f[1].toFixed(1) + ' ' + ((f[0] + l[0]) / 2).toFixed(1) + ' ' + ((f[1] + l[1]) / 2).toFixed(1) + 'Z';
  }
  function scallop(cx, cy, r, n) {
    var d = '';
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (!i) { d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1); continue; }
      d += ' A' + (r * Math.PI / n * 1.05).toFixed(1) + ' ' + (r * Math.PI / n * 1.05).toFixed(1) + ' 0 0 1 ' + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + 'Z';
  }
  var INK = '#2F3A33';
  var DRAW = ' pathLength="1" class="draw"';

  function planSvg(p, big) {
    var r = rng(hash(p.id)), id = 'pl' + Math.floor(r() * 1e9).toString(36) + (big ? 'b' : '');
    var s = '<defs><pattern id="' + id + 'h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9A9489" stroke-width="1.4"/></pattern></defs>';
    s += '<rect x="0" y="0" width="400" height="280" fill="#F7F5EE"/>';
    var labels = '';
    p.plan.forEach(function (op) {
      var t = op[0];
      if (t === 'plot') s += '<rect x="14" y="14" width="372" height="252" rx="4" fill="none" stroke="' + INK + '" stroke-width="1.6"' + DRAW + '/>';
      if (t === 'house') s += '<rect class="fill-in" x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] + '" height="' + op[4] + '" fill="url(#' + id + 'h)"/><rect x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] + '" height="' + op[4] + '" fill="none" stroke="' + INK + '" stroke-width="2"' + DRAW + '/>' +
        '<text class="plan-label" x="' + (op[1] + op[3] / 2) + '" y="' + (op[2] + op[4] / 2 + 4) + '" text-anchor="middle">maison</text>';
      if (t === 'lawn') s += '<path class="fill-in" d="' + blob(op[1], op[2], op[3], op[4], .08, 14, r) + '" fill="#D3E4B8"/><path d="' + blob(op[1], op[2], op[3], op[4], .08, 14, rng(hash(p.id + t))) + '" fill="none" stroke="#7FA35A" stroke-width="1.4"' + DRAW + '/>';
      if (t === 'prairie') {
        s += '<path class="fill-in" d="' + blob(op[1], op[2], op[3], op[4], .12, 14, r) + '" fill="#E3E9C6"/>';
        var g = '<g class="fill-in">';
        for (var i = 0; i < 70; i++) { var a = r() * 6.283, k = Math.sqrt(r()) * .9; g += '<circle cx="' + (op[1] + op[3] * k * Math.cos(a)).toFixed(1) + '" cy="' + (op[2] + op[4] * k * Math.sin(a)).toFixed(1) + '" r="1.3" fill="' + ['#E58FA8', '#E8B04A', '#8E7CC3', '#FFFFFF'][i % 4] + '"/>'; }
        s += g + '</g>';
      }
      if (t === 'terrace') {
        var bois = op[5] === 'bois';
        s += '<rect class="fill-in" x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] + '" height="' + op[4] + '" fill="' + (bois ? '#E3C49A' : '#DAD5C8') + '"/>';
        var lines = '<g class="fill-in" stroke="' + (bois ? '#B98E5E' : '#A9A396') + '" stroke-width=".9">';
        if (bois) for (var x = op[1] + 8; x < op[1] + op[3]; x += 8) lines += '<line x1="' + x + '" y1="' + op[2] + '" x2="' + x + '" y2="' + (op[2] + op[4]) + '"/>';
        else for (var yy = op[2] + 12; yy < op[2] + op[4]; yy += 12) { lines += '<line x1="' + op[1] + '" y1="' + yy + '" x2="' + (op[1] + op[3]) + '" y2="' + yy + '"/>'; for (var xx = op[1] + (yy % 24 ? 10 : 20); xx < op[1] + op[3]; xx += 20) lines += '<line x1="' + xx + '" y1="' + (yy - 12) + '" x2="' + xx + '" y2="' + yy + '"/>'; }
        s += lines + '</g><rect x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] + '" height="' + op[4] + '" fill="none" stroke="' + INK + '" stroke-width="1.6"' + DRAW + '/>';
      }
      if (t === 'stones') op[1].forEach(function (pt) { s += '<ellipse class="fill-in" cx="' + pt[0] + '" cy="' + pt[1] + '" rx="7" ry="5" fill="#CFC9BC" stroke="' + INK + '" stroke-width="1" transform="rotate(' + Math.round(r() * 60 - 30) + ' ' + pt[0] + ' ' + pt[1] + ')"/>'; });
      if (t === 'path') s += '<path d="' + op[1] + '" fill="none" stroke="#E6DCC4" stroke-width="' + (op[2] || 12) + '" stroke-linecap="round" class="fill-in"/><path d="' + op[1] + '" fill="none" stroke="#B9AD92" stroke-width="1" stroke-dasharray="3 4" class="fill-in"/>';
      if (t === 'bed') {
        s += '<path class="fill-in" d="' + blob(op[1], op[2], op[3], op[4], .15, 12, r) + '" fill="#EADFC8"/>';
        var dots = '<g class="fill-in">', cols = op[5] || ['#8E7CC3', '#E58FA8', '#7FA35A'];
        for (var j = 0; j < Math.round(op[3] * op[4] / 22); j++) { var a2 = r() * 6.283, k2 = Math.sqrt(r()) * .8; dots += '<circle cx="' + (op[1] + op[3] * k2 * Math.cos(a2)).toFixed(1) + '" cy="' + (op[2] + op[4] * k2 * Math.sin(a2)).toFixed(1) + '" r="' + (1.6 + r() * 1.8).toFixed(1) + '" fill="' + cols[j % cols.length] + '"/>'; }
        s += dots + '</g><path d="' + blob(op[1], op[2], op[3], op[4], .15, 12, rng(hash(p.id + op[1]))) + '" fill="none" stroke="#8E7B5A" stroke-width="1.2"' + DRAW + '/>';
      }
      if (t === 'tree') {
        var col = op[4] || '#5E8A4A';
        s += '<path class="fill-in" d="' + scallop(op[1], op[2], op[3], Math.max(8, Math.round(op[3] / 3))) + '" fill="' + col + '" fill-opacity=".28"/>' +
          '<path d="' + scallop(op[1], op[2], op[3], Math.max(8, Math.round(op[3] / 3))) + '" fill="none" stroke="' + col + '" stroke-width="1.5"' + DRAW + '/>' +
          '<circle cx="' + op[1] + '" cy="' + op[2] + '" r="2" fill="' + INK + '"/>';
      }
      if (t === 'hedge') {
        var x1 = op[1], y1 = op[2], x2 = op[3], y2 = op[4], rr = op[5] || 7, len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / (rr * 1.5));
        var hcols = op[6] || ['#7FA35A'];
        for (var h = 0; h <= n; h++) { var cx = x1 + (x2 - x1) * h / n, cy = y1 + (y2 - y1) * h / n, c = hcols[h % hcols.length]; s += '<path class="fill-in" d="' + scallop(cx, cy, rr, 7) + '" fill="' + c + '" fill-opacity=".55" stroke="' + c + '" stroke-width="1"/>'; }
      }
      if (t === 'fence') s += '<path d="M' + op[1] + ' ' + op[2] + ' L' + op[3] + ' ' + op[4] + '" stroke="#8C6B4B" stroke-width="3"' + DRAW + '/>';
      if (t === 'wall') s += '<path d="M' + op[1] + ' ' + op[2] + ' L' + op[3] + ' ' + op[4] + '" stroke="#8A857B" stroke-width="6" stroke-linecap="round"' + DRAW + '/>';
      if (t === 'stairs') { s += '<g class="fill-in" stroke="' + INK + '" stroke-width="1">'; for (var st = 0; st <= op[5]; st++) { var sy = op[2] + op[4] * st / op[5]; s += '<line x1="' + op[1] + '" y1="' + sy + '" x2="' + (op[1] + op[3]) + '" y2="' + sy + '"/>'; } s += '</g>'; }
      if (t === 'raised') s += '<rect class="fill-in" x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] + '" height="' + op[4] + '" fill="#C9A77A"/><g class="fill-in" stroke="#628F45" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"><line x1="' + (op[1] + 6) + '" y1="' + (op[2] + op[4] * .33) + '" x2="' + (op[1] + op[3] - 6) + '" y2="' + (op[2] + op[4] * .33) + '"/><line x1="' + (op[1] + 6) + '" y1="' + (op[2] + op[4] * .66) + '" x2="' + (op[1] + op[3] - 6) + '" y2="' + (op[2] + op[4] * .66) + '"/></g><rect x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] + '" height="' + op[4] + '" fill="none" stroke="#7A5A3A" stroke-width="1.6"' + DRAW + '/>';
      if (t === 'tank') s += '<circle class="fill-in" cx="' + op[1] + '" cy="' + op[2] + '" r="' + op[3] + '" fill="#BFD6DE" stroke="' + INK + '" stroke-width="1.2"/>';
      if (t === 'water') s += '<g class="fill-in" stroke="#6FA1B4" stroke-width="1.6" fill="none" stroke-linecap="round">' + op[1].map(function (y) { return '<path d="M20 ' + y + ' q12 -6 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"/>'; }).join('') + '</g>';
      if (t === 'waterV') s += '<g class="fill-in" stroke="#6FA1B4" stroke-width="1.6" fill="none" stroke-linecap="round">' + op[1].map(function (x) { return '<path d="M' + x + ' 20 q-6 12 0 24 t0 24 t0 24 t0 24 t0 24 t0 24 t0 24 t0 24 t0 24 t0 24"/>'; }).join('') + '</g>';
      if (t === 'label') labels += '<path d="M' + op[4] + ' ' + op[5] + ' Q' + ((op[1] + op[4]) / 2) + ' ' + (op[5] - 6) + ' ' + op[1] + ' ' + (op[2] + 3) + '" fill="none" stroke="' + INK + '" stroke-width=".9" class="fill-in"/><circle class="fill-in" cx="' + op[4] + '" cy="' + op[5] + '" r="1.8" fill="' + INK + '"/><text class="plan-label fill-in" x="' + op[1] + '" y="' + op[2] + '" text-anchor="' + (op[6] || 'middle') + '">' + op[3] + '</text>';
    });
    s += labels;
    // nord et échelle
    s += '<g class="fill-in"><path d="M366 250 L372 236 L378 250 L372 246Z" fill="' + INK + '"/><text class="plan-north" x="372" y="232" text-anchor="middle">N</text>' +
      '<path d="M26 256 H66 M26 252 V260 M46 254 V258 M66 252 V260" stroke="' + INK + '" stroke-width="1.2" fill="none"/><text class="plan-label plan-label-sm" x="72" y="260">' + (p.scale || '5 m') + '</text></g>';
    return '<svg class="plan-svg" viewBox="0 0 400 280" role="img" aria-label="Plan du jardin : ' + p.title + '">' + s + '</svg>';
  }

  var WORKS = [
    { id: 'jardin-ville', cat: 'creation', town: 'Dinan', title: 'Un jardin de ville en trois semaines', area: '140 m²', time: '3 semaines', budget: '≈ 11 000 €',
      want: 'Un coin de verdure sans entretien lourd, une terrasse pour dîner dehors, et ne plus voir le mur du voisin.',
      did: 'Terrasse en pin traité de 18 m², pas japonais en granit, massifs de vivaces et de graminées, un érable du Japon devant le mur, clôture ajourée. C’est le jardin de l’avant/après en haut de page.',
      plan: [['plot'], ['house', 14, 14, 372, 56], ['lawn', 230, 170, 120, 70], ['terrace', 30, 70, 150, 60, 'bois'], ['stones', [[190, 138], [210, 156], [232, 170], [256, 186], [280, 200], [304, 214]]],
        ['bed', 330, 110, 44, 34], ['bed', 90, 220, 70, 30], ['bed', 330, 236, 46, 20], ['tree', 330, 108, 28, '#C4532E'], ['fence', 14, 266, 386, 266],
        ['label', 104, 150, 'terrasse bois 18 m²', 104, 112], ['label', 236, 96, 'érable du Japon', 306, 104], ['label', 214, 250, 'pas japonais', 280, 202], ['label', 96, 186, 'vivaces & graminées', 96, 214]] },
    { id: 'terrasse-rance', cat: 'terrasse', town: 'Plouër-sur-Rance', title: 'Une terrasse en pierre face à la Rance', area: '45 m²', time: '2 semaines', budget: '≈ 9 500 €',
      want: 'Profiter de la vue sur la Rance depuis un terrain en pente, sans que la terrasse écrase le jardin.',
      did: 'Terrasse en dalles de granit sur deux niveaux, escalier de cinq marches, muret en pierre sèche, massif de plantes de bord de mer.',
      plan: [['plot'], ['house', 30, 14, 170, 70], ['terrace', 30, 84, 220, 56, 'pierre'], ['terrace', 90, 150, 200, 44, 'pierre'], ['stairs', 250, 100, 30, 40, 5], ['wall', 30, 146, 250, 146],
        ['bed', 330, 110, 40, 60, ['#8FA2DD', '#E8B04A', '#7FA35A']], ['lawn', 200, 222, 150, 22], ['water', [252, 262]],
        ['label', 150, 76, '', 150, 76], ['label', 300, 40, 'escalier 5 marches', 266, 104], ['label', 84, 176, 'niveau bas', 100, 172, 'end'], ['label', 170, 132, 'dalles de granit', 170, 116], ['label', 352, 196, 'la Rance', 352, 254]] },
    { id: 'bord-de-mer', cat: 'creation', town: 'Saint-Briac-sur-Mer', title: 'Un jardin qui résiste aux embruns', area: '400 m²', time: '4 semaines', budget: '≈ 16 000 €',
      want: 'Un jardin qui tienne face au vent et au sel, sans arrosage l’été.',
      did: 'Brise-vent de tamaris et d’élaeagnus côté ouest, prairie fleurie à la place du gazon, massifs d’agapanthes, d’euphorbes et de graminées, allée en sable stabilisé.',
      plan: [['plot'], ['house', 140, 30, 130, 60], ['hedge', 24, 24, 24, 256, 9, ['#8FB07A', '#6E9A5A', '#A3B98A']], ['hedge', 24, 24, 380, 24, 8, ['#8FB07A', '#6E9A5A']],
        ['prairie', 200, 186, 130, 58], ['path', 'M205 90 C200 130 250 150 260 190 S300 240 330 262', 12], ['bed', 330, 120, 38, 40, ['#8FA2DD', '#E8B04A', '#B9A860']], ['bed', 90, 120, 44, 34, ['#8FA2DD', '#B9A860', '#7FA35A']],
        ['label', 40, 184, 'brise-vent tamaris', 30, 200, 'start'], ['label', 200, 150, 'prairie fleurie', 190, 176], ['label', 330, 206, 'sable stabilisé', 292, 232], ['label', 330, 80, 'agapanthes', 334, 110]], scale: '10 m' },
    { id: 'haie-bocagere', cat: 'cloture', town: 'Pleslin-Trigavou', title: 'Une haie bocagère de 80 mètres', area: '80 m linéaires', time: '3 jours', budget: '≈ 3 200 €',
      want: 'Se protéger du vent et des regards, avec une haie qui accueille les oiseaux plutôt qu’un mur de thuyas.',
      did: 'Plantation à racines nues en novembre : charme, noisetier, cornouiller et viorne, sur paillage biodégradable. Clôture bois et portillon à l’entrée.',
      plan: [['plot'], ['lawn', 200, 170, 150, 70], ['house', 150, 90, 100, 60], ['hedge', 26, 26, 26, 254, 8, ['#7FA35A', '#C4532E', '#6E9A5A', '#B9A860']], ['hedge', 26, 254, 300, 254, 8, ['#6E9A5A', '#7FA35A', '#B9A860', '#C4532E']],
        ['fence', 320, 266, 386, 266], ['path', 'M200 150 C220 200 300 230 350 262', 10],
        ['label', 110, 50, 'charme · noisetier', 34, 60, 'start'], ['label', 170, 234, 'cornouiller · viorne', 170, 250], ['label', 352, 228, 'portillon', 352, 262]], scale: '10 m' },
    { id: 'potager', cat: 'creation', town: 'Dinard', title: 'Un potager surélevé pour une famille', area: '30 m²', time: '1 semaine', budget: '≈ 4 800 €',
      want: 'Faire pousser des légumes avec les enfants, sans se casser le dos.',
      did: 'Six carrés surélevés en douglas, allées en copeaux de bois, récupérateur d’eau de pluie, petit verger de trois pommiers.',
      plan: [['plot'], ['house', 14, 14, 160, 60], ['path', 'M60 120 H300 M60 190 H300', 14], ['raised', 60, 92, 60, 44], ['raised', 150, 92, 60, 44], ['raised', 240, 92, 60, 44], ['raised', 60, 160, 60, 44], ['raised', 150, 160, 60, 44], ['raised', 240, 160, 60, 44],
        ['tank', 196, 50, 14], ['tree', 340, 70, 22, '#6E9A5A'], ['tree', 348, 150, 22, '#6E9A5A'], ['tree', 340, 226, 22, '#6E9A5A'],
        ['label', 110, 240, 'carrés en douglas', 90, 204], ['label', 250, 40, 'eau de pluie', 212, 50], ['label', 290, 262, 'trois pommiers', 330, 238]], scale: '2 m' },
    { id: 'entretien-parc', cat: 'entretien', town: 'Saint-Malo', title: 'L’entretien d’un parc de 1 200 m²', area: '1 200 m²', time: '16 passages / an', budget: '≈ 4 000 € / an',
      want: 'Un grand jardin de famille que les propriétaires n’arrivaient plus à suivre.',
      did: 'Contrat « Régulier » : tonte, taille des haies deux fois par an, massifs désherbés à la main, feuilles ramassées à l’automne. Environ 2 000 € par an une fois le crédit d’impôt déduit.',
      plan: [['plot'], ['house', 150, 24, 110, 52], ['lawn', 200, 170, 160, 80], ['hedge', 380, 24, 380, 256, 7], ['hedge', 24, 256, 380, 256, 7], ['tree', 70, 70, 34, '#5E8A4A'], ['tree', 80, 180, 28, '#C4532E'], ['tree', 320, 90, 26, '#5E8A4A'], ['tree', 250, 200, 18, '#E8B04A'],
        ['bed', 150, 110, 40, 16], ['label', 200, 140, 'tonte 16×/an', 200, 170], ['label', 300, 238, 'taille 2×/an', 360, 250], ['label', 104, 132, 'massifs', 118, 112, 'end']], scale: '10 m' }
  ];
  // le libellé vide sert seulement de repère de mise en page
  WORKS.forEach(function (w) { w.plan = w.plan.filter(function (op) { return !(op[0] === 'label' && !op[3]); }); });

  var grid = $('[data-works]');
  var drawObs = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-drawn'); drawObs.unobserve(e.target); } });
  }, { threshold: 0.35 }) : null;
  function watchDraw(svg) { if (drawObs && !reduceMotion) drawObs.observe(svg); else svg.classList.add('is-drawn'); }

  WORKS.forEach(function (w) {
    var li = document.createElement('li');
    li.className = 'work';
    li.setAttribute('data-cat', w.cat);
    li.innerHTML = '<button type="button" class="work-btn"><div class="work-plan">' + planSvg(w) + '</div><div class="work-body"><p class="work-town"></p><h3 class="work-title"></h3><p class="work-meta"><span></span><span></span></p><span class="work-more">Voir le projet →</span></div></button>';
    $('.work-town', li).textContent = w.town;
    $('.work-title', li).textContent = w.title;
    var m = $all('.work-meta span', li); m[0].textContent = w.area; m[1].textContent = w.time;
    $('.work-btn', li).addEventListener('click', function () { openWork(w); });
    grid.appendChild(li);
    watchDraw($('.plan-svg', li));
  });

  var chips = $all('[data-filter]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) { var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $all('.work', grid).forEach(function (li, i) {
        var show = f === 'all' || li.getAttribute('data-cat') === f;
        li.classList.toggle('is-hidden', !show);
        li.classList.remove('is-in');
        if (show) { void li.offsetWidth; li.style.animationDelay = (i % 6) * 50 + 'ms'; li.classList.add('is-in'); }
      });
    });
  });

  /* ---- fiche projet ---- */
  var dlg = $('[data-dialog]'), lastFocus = null;
  function openWork(w) {
    lastFocus = document.activeElement;
    $('[data-dlg-plan]').innerHTML = planSvg(w, true);
    $('[data-dlg-town]').textContent = w.town;
    $('[data-dlg-title]').textContent = w.title;
    var facts = $('[data-dlg-facts]');
    facts.innerHTML = '';
    [['Surface', w.area], ['Durée', w.time], ['Budget', w.budget]].forEach(function (f) {
      var d = document.createElement('div');
      d.innerHTML = '<dt></dt><dd></dd>';
      d.children[0].textContent = f[0]; d.children[1].textContent = f[1];
      facts.appendChild(d);
    });
    $('[data-dlg-want]').textContent = w.want;
    $('[data-dlg-did]').textContent = w.did;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var svg = $('.plan-svg', dlg);
    requestAnimationFrame(function () { requestAnimationFrame(function () { svg.classList.add('is-drawn'); }); });
  }
  function closeDlg() { if (dlg.open) { dlg.close(); if (lastFocus) lastFocus.focus({ preventScroll: true }); } }
  $all('[data-dialog-close]', dlg).forEach(function (b) { b.addEventListener('click', closeDlg); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDlg(); });

  /* ================= Estimateur : création ================= */
  var PRICES = {
    gazon: { unit: 'm²', label: 'Gazon', opts: { seme: [8, 14], rouleau: [16, 26] } },
    massifs: { unit: 'm²', label: 'Massifs', range: [45, 85] },
    terrasse: { unit: 'm²', label: 'Terrasse', opts: { bois: [150, 230], pierre: [120, 200] } },
    cloture: { unit: 'm', label: 'Haie ou clôture', opts: { haie: [30, 60], bois: [70, 130] } },
    arrosage: { label: 'Arrosage', flat: [1200, 2500] }
  };
  var items = $all('[data-item]');
  var minEl = $('[data-min]'), maxEl = $('[data-max]'), bar = $('[data-bar]'), legend = $('[data-legend]');
  var shown = { min: 0, max: 0 }, anim = null;

  function itemState(el) {
    var key = el.getAttribute('data-item'), on = $('[data-toggle]', el).checked;
    var qty = $('[data-qty]', el), opt = $('.seg [aria-pressed="true"]', el);
    return { key: key, on: on, qty: qty ? +qty.value : 1, opt: opt ? opt.getAttribute('data-opt') : null };
  }
  function lines() {
    return items.map(itemState).filter(function (s) { return s.on; }).map(function (s) {
      var P = PRICES[s.key], r = P.flat || (P.opts ? P.opts[s.opt] : P.range);
      var q = P.flat ? 1 : s.qty;
      return { key: s.key, label: P.label, min: r[0] * q, max: r[1] * q, s: s };
    });
  }
  function round100(n) { return Math.round(n / 100) * 100; }
  function tween(toMin, toMax) {
    cancelAnimationFrame(anim);
    var from = { min: shown.min, max: shown.max }, t0 = null, D = reduceMotion ? 0 : 450;
    var step = function (t) {
      if (t0 === null) t0 = t;
      var k = D ? Math.min(1, (t - t0) / D) : 1; k = 1 - Math.pow(1 - k, 3);
      shown.min = from.min + (toMin - from.min) * k; shown.max = from.max + (toMax - from.max) * k;
      minEl.textContent = num(round100(shown.min)); maxEl.textContent = num(round100(shown.max));
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function renderEstimate() {
    var L = lines(), tmin = 0, tmax = 0;
    L.forEach(function (l) { tmin += l.min; tmax += l.max; });
    tween(round100(tmin), round100(tmax));
    bar.innerHTML = ''; legend.innerHTML = '';
    L.forEach(function (l) {
      var sp = document.createElement('span');
      sp.className = 'c-' + l.key;
      sp.style.flexGrow = String((l.min + l.max) / 2);
      bar.appendChild(sp);
      var li = document.createElement('li');
      li.innerHTML = '<i class="c-' + l.key + '"></i><span></span><b></b>';
      li.children[1].textContent = l.label;
      li.children[2].textContent = num(round100(l.min)) + ' – ' + num(round100(l.max)) + ' €';
      legend.appendChild(li);
    });
    if (!L.length) legend.innerHTML = '<li>Activez au moins un élément.</li>';
  }
  items.forEach(function (el) {
    var tog = $('[data-toggle]', el), qty = $('[data-qty]', el), out = $('[data-out]', el), P = PRICES[el.getAttribute('data-item')];
    tog.addEventListener('change', function () { el.classList.toggle('is-on', tog.checked); renderEstimate(); });
    if (qty) qty.addEventListener('input', function () { out.textContent = qty.value + ' ' + P.unit; renderEstimate(); });
    $all('.seg button', el).forEach(function (b) {
      b.addEventListener('click', function () {
        $all('.seg button', el).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        renderEstimate();
      });
    });
  });
  renderEstimate();

  function estimateSummary() {
    var L = lines(), tmin = 0, tmax = 0;
    var parts = L.map(function (l) {
      tmin += l.min; tmax += l.max;
      var s = l.s, opt = s.opt ? ' ' + ({ seme: 'semé', rouleau: 'en rouleau', bois: 'bois', pierre: 'pierre', haie: '' })[s.opt] : '';
      return l.label.toLowerCase() + opt.replace(/\s+$/, '') + (PRICES[l.key].flat ? '' : ' ' + s.qty + ' ' + PRICES[l.key].unit);
    });
    return 'Estimation en ligne : ' + parts.join(', ') + ' → ' + num(round100(tmin)) + ' – ' + num(round100(tmax)) + ' €.';
  }

  /* ================= Estimateur : entretien ================= */
  var HOURLY = 42, CAP = 5000;
  var mSurf = $('[data-m-surface]'), mOut = $('[data-m-out]');
  function mCalc() {
    var surf = +mSurf.value, freq = +$('input[name="freq"]:checked').value;
    var hours = Math.max(1.5, Math.round((surf / 250 + 1) * 2) / 2);
    var year = hours * HOURLY * freq, credit = Math.min(year, CAP) / 2, net = year - credit;
    return { surf: surf, freq: freq, year: year, credit: credit, net: net };
  }
  function renderMaint() {
    var c = mCalc();
    mOut.textContent = num(c.surf) + ' m²';
    $('[data-m-year]').textContent = euros(c.year);
    $('[data-m-credit]').textContent = '− ' + euros(c.credit);
    $('[data-m-net]').textContent = num(c.net);
    $('[data-m-month]').textContent = euros(c.net / 12);
  }
  mSurf.addEventListener('input', renderMaint);
  $all('input[name="freq"]').forEach(function (r) { r.addEventListener('change', renderMaint); });
  renderMaint();

  /* ---- onglets (clavier : flèches gauche/droite) ---- */
  var tabs = $all('[role="tab"]');
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(n); n.focus();
    });
  });

  /* ================= Ce mois-ci au jardin ================= */
  var MONTHS = [
    [['Tailler les fruitiers hors période de gel', 'Planter les haies à racines nues si le sol n’est pas gelé', 'Nettoyer et affûter les outils'], 'Un sol détrempé se tasse : on attend qu’il ressuie avant de marcher dans les massifs.'],
    [['Tailler les rosiers en fin de mois', 'Apporter du compost au pied des massifs', 'Semer les premiers légumes sous abri'], 'Février est le dernier bon mois pour planter à racines nues.'],
    [['Scarifier et regarnir le gazon', 'Diviser les vivaces d’été', 'Planter les arbustes en conteneur'], 'Première tonte dès que l’herbe dépasse 8 cm, lame réglée haut.'],
    [['Semer le gazon et la prairie fleurie', 'Pailler les massifs avant les premières chaleurs', 'Surveiller les gelées tardives'], 'Évitez de tailler les haies du 15 mars à fin juillet : les oiseaux y nichent.'],
    [['Planter les annuelles et les tomates', 'Tondre chaque semaine, sans raser', 'Installer l’arrosage goutte-à-goutte'], 'Attendez la mi-mai pour sortir les plantes frileuses.'],
    [['Arroser tôt le matin ou le soir', 'Remonter la hauteur de tonte', 'Récupérer l’eau de pluie'], 'Une pelouse tondue haut garde mieux l’humidité.'],
    [['Arroser au pied, jamais en plein soleil', 'Rabattre les vivaces défleuries', 'Laisser la pelouse jaunir : elle repartira'], 'Un gazon jaune en juillet n’est pas mort, il dort.'],
    [['Tailler les haies après la nidification', 'Bouturer lavandes et hortensias', 'Préparer les plantations d’automne'], 'C’est le moment de demander un devis pour planter en novembre.'],
    [['Semer ou regarnir le gazon, la terre est encore chaude', 'Diviser et replanter les vivaces', 'Commander les haies à racines nues pour novembre'], 'Le meilleur moment de l’année pour créer une pelouse : moins d’arrosage qu’au printemps.'],
    [['Planter arbres et arbustes en conteneur', 'Ramasser les feuilles pour le compost', 'Planter les bulbes de printemps'], 'Les feuilles mortes font un excellent paillis pour les massifs.'],
    [['Planter haies et fruitiers à racines nues', 'Pailler les massifs pour l’hiver', 'Dernière tonte, lame haute'], '« À la Sainte-Catherine, tout bois prend racine » : autour du 25 novembre, c’est le moment de planter.'],
    [['Protéger les plantes fragiles du gel', 'Tailler les haies de feuillus', 'Préparer les projets du printemps'], 'L’hiver est la saison calme : idéale pour dessiner votre futur jardin.']
  ];
  var monthsBox = $('[data-months]'), list = $('[data-season-list]'), proverb = $('[data-season-proverb]'), monthTitle = $('[data-season-month]');
  var nowMonth = new Date().getMonth();
  var monthName = function (m) { return new Date(2026, m, 1).toLocaleDateString('fr-FR', { month: 'long' }); };
  function showMonth(m) {
    $all('.month', monthsBox).forEach(function (b, i) { b.setAttribute('aria-pressed', i === m ? 'true' : 'false'); });
    monthTitle.textContent = m === nowMonth ? 'au jardin' : 'en ' + monthName(m);
    $('#season-title').firstChild.textContent = m === nowMonth ? 'Ce mois-ci, ' : 'Au jardin, ';
    list.innerHTML = '';
    MONTHS[m][0].forEach(function (t) { var li = document.createElement('li'); li.textContent = t; list.appendChild(li); });
    proverb.textContent = MONTHS[m][1];
  }
  for (var m = 0; m < 12; m++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'month' + (m === nowMonth ? ' is-now' : '');
    b.textContent = monthName(m).slice(0, 4).replace(/\.$/, '');
    b.setAttribute('aria-label', monthName(m) + (m === nowMonth ? ' (ce mois-ci)' : ''));
    b.addEventListener('click', (function (mm) { return function () { showMonth(mm); }; })(m));
    monthsBox.appendChild(b);
  }
  showMonth(nowMonth);

  /* ================= Demande de visite ================= */
  var form = $('[data-visit]'), vErr = $('[data-visit-error]'), done = $('[data-visit-done]'), msg = $('[data-visit-msg]');
  $('[data-est-go]').addEventListener('click', function () {
    msg.value = estimateSummary();
    form.projet.value = lines().some(function (l) { return l.key === 'terrasse'; }) ? 'Terrasse ou allée' : 'Création de jardin';
  });
  $('[data-m-go]').addEventListener('click', function () {
    var c = mCalc();
    msg.value = 'Estimation en ligne : entretien de ' + num(c.surf) + ' m², ' + c.freq + ' passages par an → ' + euros(c.year) + ' par an, ' + euros(c.net) + ' après crédit d’impôt.';
    form.projet.value = "Entretien à l'année"; // même apostrophe que l'<option>

  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nom = form.nom.value.trim(), tel = form.tel.value.replace(/[\s.]/g, '');
    var err = !nom ? 'Indiquez votre nom.' : !/^\+?\d{9,12}$/.test(tel) ? 'Ce numéro de téléphone ne semble pas complet.' : '';
    vErr.textContent = err;
    if (err) return;
    $('[data-done-name]').textContent = nom.split(' ')[0];
    $('[data-done-text]').textContent = 'On vous rappelle sous 48 h pour fixer la visite à ' + form.commune.value.replace('Autre commune', 'votre domicile') + '. Le devis suivra sous huit jours, avec un croquis de votre jardin.';
    form.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
    done.scrollIntoView({ behavior: smooth(), block: 'center' });
  });
  $('[data-done-reset]').addEventListener('click', function () {
    form.reset(); vErr.textContent = '';
    done.hidden = true; form.hidden = false;
  });

  /* ================= Apparitions + barre mobile ================= */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (i * 80) + 'ms';
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    $all('.service').forEach(function (el) { el.classList.add('reveal'); io.observe(el); });

    var sticky = $('[data-sticky]'), inHero = true, inVisit = false;
    var upd = function () { sticky.classList.toggle('is-away', inHero || inVisit); };
    new IntersectionObserver(function (e) { inHero = e[0].isIntersecting; upd(); }).observe($('.hero'));
    new IntersectionObserver(function (e) { inVisit = e[0].isIntersecting; upd(); }, { threshold: 0.05 }).observe($('#visite'));
  }
})();
