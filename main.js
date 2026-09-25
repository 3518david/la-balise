// La Balise — scripts de la page d'accueil. Fichier externe (et non inline)
// pour permettre une Content-Security-Policy stricte : script-src 'self'.
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal orchestré au scroll : chaque section apparaît une fois, avec un
  // décalage progressif entre ses éléments internes (l'ordre suit la lecture
  // naturelle de chaque bloc). Rien n'est masqué sans JS ni en mouvement réduit.
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    var revealGroups = [
      { selector: '.probleme-item', stagger: 90 },
      { selector: '.waypoint', stagger: 110 },
      { selector: '.engagements-list li', stagger: 90 },
      { selector: '.price-block', stagger: 0 },
      { selector: '.exemple .browser-frame', stagger: 0 },
      { selector: '.faq-list details', stagger: 60 },
      { selector: '.contact-grid > *', stagger: 100 }
    ];

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealGroups.forEach(function (group) {
      document.querySelectorAll(group.selector).forEach(function (el, i) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(16px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        el.style.transitionDelay = (i * group.stagger) + 'ms';
        observer.observe(el);
      });
    });
  }

  // Comparateur avant/après : le range pilote la variable CSS --pos.
  document.querySelectorAll('[data-ba]').forEach(function (ba) {
    var range = ba.querySelector('.ba-range');
    if (!range) return;
    var update = function () { ba.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', update);
    update();
  });

  // Carte du hero : la marée (animation CSS) est mise en pause hors écran,
  // et la souris trace un sillage sur la mer (canvas par-dessus le SVG).
  var heroChart = document.querySelector('[data-hero-chart]');
  if (heroChart && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      heroChart.classList.toggle('is-paused', !entries[0].isIntersecting);
    }).observe(heroChart);
  }
  if (heroChart && !prefersReducedMotion) initWake(heroChart);

  function initWake(chart) {
    var sea = chart.querySelector('[data-sea]');
    var canvas = chart.querySelector('[data-wake]');
    var landEl = chart.querySelector('[data-land]');
    var ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!sea || !ctx || !landEl || typeof Path2D === 'undefined') return;

    // Tout est dessiné dans le repère du SVG (viewBox 560 × 600).
    var VB_W = 560, VB_H = 600;
    var land = new Path2D(landEl.getAttribute('d'));
    var seaClip = new Path2D();
    seaClip.rect(0, 0, VB_W, VB_H);
    seaClip.addPath(land);

    var WAKE_LIFE = 2400;   // ms avant qu'un point du sillage disparaisse
    var SPREAD = 0.03;      // vitesse d'ouverture du V (unités SVG par ms)
    var RING_LIFE = 1800;
    var points = [];        // {x, y, nx, ny, t, gap, seed}
    var rings = [];         // {x, y, t}
    var last = null;
    var scale = 1, dpr = 1, running = false;

    function resize() {
      var rect = sea.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      scale = rect.width / VB_W;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(sea);
    else window.addEventListener('resize', resize);

    function toChart(event) {
      var rect = sea.getBoundingClientRect();
      return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
    }
    function onWater(p) {
      // isPointInPath applique la transformation courante au tracé :
      // on la remet à l'identité pour tester en unités SVG.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return !ctx.isPointInPath(land, p.x, p.y);
    }

    sea.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch') return; // au doigt : ronds dans l'eau (pointerdown)
      var p = toChart(event);
      if (!onWater(p)) { last = null; return; }
      var now = performance.now();
      if (last) {
        var dx = p.x - last.x, dy = p.y - last.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 4) return;
        points.push({ x: p.x, y: p.y, nx: -dy / d, ny: dx / d, t: now, gap: false, seed: Math.random() * 6.28 });
      } else {
        points.push({ x: p.x, y: p.y, nx: 0, ny: 0, t: now, gap: true, seed: 0 });
      }
      last = p;
      if (points.length > 200) points.shift();
      start();
    });
    sea.addEventListener('pointerleave', function () { last = null; });
    sea.addEventListener('pointerdown', function (event) {
      var p = toChart(event);
      if (!onWater(p)) return;
      rings.push({ x: p.x, y: p.y, t: performance.now() });
      start();
    });

    function start() {
      if (!running) { running = true; requestAnimationFrame(frame); }
    }

    // Position d'un point sur un bras du V : il s'écarte de la trajectoire en
    // vieillissant, avec une légère ondulation pour que la ligne « vive ».
    function armPoint(p, ref, side, age, shift) {
      var nx = p.nx || ref.nx, ny = p.ny || ref.ny;
      var off = side * (age * SPREAD + Math.sin(age * 0.006 + p.seed) * 1.6) + side * shift;
      return [p.x + nx * off, p.y + ny * off];
    }

    function strokeSeg(a, b, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    function frame(now) {
      while (points.length && now - points[0].t > WAKE_LIFE) points.shift();
      while (rings.length && now - rings[0].t > RING_LIFE) rings.shift();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.save();
      ctx.clip(seaClip, 'evenodd'); // le sillage s'arrête net au trait de côte
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1], b = points[i];
        if (b.gap) continue;
        var ageA = now - a.t, ageB = now - b.t;
        var life = 1 - ageB / WAKE_LIFE;         // 1 → 0
        var fade = life * life;

        // Bras du V en relief : un creux sombre côté extérieur, une crête claire.
        for (var side = -1; side <= 1; side += 2) {
          strokeSeg(armPoint(a, b, side, ageA, 2.2), armPoint(b, b, side, ageB, 2.2),
            'rgba(20,90,98,' + (0.3 * fade).toFixed(3) + ')', 3.4);
          strokeSeg(armPoint(a, b, side, ageA, 0), armPoint(b, b, side, ageB, 0),
            'rgba(255,255,255,' + (0.75 * fade).toFixed(3) + ')', 2.6);
        }

        // Traînée d'écume : large et diffuse, elle s'élargit et se dissipe.
        var spread = 3 + ageB * 0.006;
        strokeSeg([a.x, a.y], [b.x, b.y], 'rgba(255,255,255,' + (0.24 * fade).toFixed(3) + ')', spread * 1.5);
        var core = 1 - ageB / (WAKE_LIFE * 0.5);
        if (core > 0) {
          strokeSeg([a.x, a.y], [b.x, b.y], 'rgba(255,255,255,' + (0.75 * core * core).toFixed(3) + ')', 2 + 2.5 * core);
        }
      }

      // Ronds dans l'eau (tap ou clic) : trois vaguelettes qui s'élargissent.
      rings.forEach(function (r) {
        var age = now - r.t, k = 1 - age / RING_LIFE;
        for (var n = 0; n < 3; n++) {
          var radius = age * 0.03 - n * 8;
          if (radius <= 0) continue;
          var alpha = k * k * (1 - n * 0.25);
          ctx.strokeStyle = 'rgba(20,90,98,' + (0.25 * alpha).toFixed(3) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y + 1.5, radius, radius * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * alpha).toFixed(3) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, radius, radius * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.restore();

      // Plus rien à dessiner : on arrête la boucle (aucun coût au repos).
      if (points.length || rings.length) requestAnimationFrame(frame);
      else { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
  }

  // Envoi du formulaire de contact via Web3Forms (pas de backend à maintenir).
  var contactForm = document.getElementById('contact-form');
  if (!contactForm) return;

  var statusEl = document.getElementById('form-status');
  var submitBtn = contactForm.querySelector('button[type="submit"]');
  var siteInput = contactForm.querySelector('#site');
  var contactInput = contactForm.querySelector('#contact-info');
  var ERROR_MESSAGE = 'L\'envoi n\'a pas abouti. Réessayez, ou contactez-moi directement au 06 01 74 23 38 ou à contact@labalise-html.fr.';

  function setStatus(kind, message) {
    statusEl.className = 'form-status is-' + kind;
    statusEl.textContent = message;
  }

  // « Email ou téléphone » : on accepte les deux, mais pas n'importe quoi.
  function looksLikeContact(value) {
    var digits = value.replace(/[^\d]/g, '');
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || digits.length >= 9;
  }

  contactInput.addEventListener('input', function () { contactInput.setCustomValidity(''); });

  contactForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var contactValue = contactInput.value.trim();
    if (contactValue && !looksLikeContact(contactValue)) {
      contactInput.setCustomValidity('Indiquez une adresse email ou un numéro de téléphone.');
      contactInput.reportValidity();
      return;
    }

    // Le champ « site » accepte « www.monsite.fr » : on complète le schéma
    // plutôt que de laisser le navigateur refuser la saisie.
    var siteValue = siteInput.value.trim();
    if (siteValue && !/^https?:\/\//i.test(siteValue)) {
      siteInput.value = 'https://' + siteValue;
    }

    submitBtn.disabled = true;
    setStatus('pending', 'Envoi en cours…');

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(contactForm)
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (result.success) {
          setStatus('success', 'Merci, c\'est bien reçu ! Je vous recontacte sous 48h pour mieux connaître votre activité, puis vous recevez votre maquette sous 7 jours ouvrés.');
          contactForm.reset();
        } else {
          setStatus('error', ERROR_MESSAGE);
        }
      })
      .catch(function () { setStatus('error', ERROR_MESSAGE); })
      .finally(function () { submitBtn.disabled = false; });
  });
})();
