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
      { selector: '.step', stagger: 110 },
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
