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

    var WAKE_LIFE = 1700;   // ms avant qu'un point du sillage disparaisse
    var SPREAD = 0.02;      // vitesse d'ouverture du V (unités SVG par ms)
    var RING_LIFE = 1500;
    var points = [];        // {x, y, nx, ny, t, gap}
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
        points.push({ x: p.x, y: p.y, nx: -dy / d, ny: dx / d, t: now, gap: false });
      } else {
        points.push({ x: p.x, y: p.y, nx: 0, ny: 0, t: now, gap: true });
      }
      last = p;
      if (points.length > 160) points.shift();
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

    function frame(now) {
      while (points.length && now - points[0].t > WAKE_LIFE) points.shift();
      while (rings.length && now - rings[0].t > RING_LIFE) rings.shift();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.save();
      ctx.clip(seaClip, 'evenodd'); // le sillage s'arrête net au trait de côte
      ctx.lineCap = 'round';

      // Les deux bras du V : chaque point s'écarte de la trajectoire en vieillissant.
      [-1, 1].forEach(function (side) {
        for (var i = 1; i < points.length; i++) {
          var a = points[i - 1], b = points[i];
          if (b.gap) continue;
          var ageA = now - a.t, ageB = now - b.t;
          var life = 1 - ageB / WAKE_LIFE;
          ctx.strokeStyle = 'rgba(20,107,114,' + (0.7 * life * life).toFixed(3) + ')';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(a.x + side * (a.nx || b.nx) * ageA * SPREAD, a.y + side * (a.ny || b.ny) * ageA * SPREAD);
          ctx.lineTo(b.x + side * b.nx * ageB * SPREAD, b.y + side * b.ny * ageB * SPREAD);
          ctx.stroke();
        }
      });

      // L'écume au centre du sillon, qui se referme plus vite.
      for (var j = 1; j < points.length; j++) {
        var p0 = points[j - 1], p1 = points[j];
        if (p1.gap) continue;
        var foam = 1 - (now - p1.t) / (WAKE_LIFE * 0.55);
        if (foam <= 0) continue;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * foam).toFixed(3) + ')';
        ctx.lineWidth = 3.2 * foam + 0.6;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      // Ronds dans l'eau (tap ou clic).
      rings.forEach(function (r) {
        var age = now - r.t, k = 1 - age / RING_LIFE;
        for (var n = 0; n < 2; n++) {
          var radius = age * 0.035 - n * 9;
          if (radius <= 0) continue;
          ctx.strokeStyle = 'rgba(20,107,114,' + (0.45 * k * k).toFixed(3) + ')';
          ctx.lineWidth = 1.2;
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
