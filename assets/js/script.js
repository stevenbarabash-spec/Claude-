/* ═══════════════════════════════════════════════════════════════
   COMPLETE FIXED script.js
   Replace your ENTIRE script.js file with this one.
   ═══════════════════════════════════════════════════════════════ */


// ─── NAVBAR SCROLL + TOGGLE ───
const navBar     = document.querySelector('.nav-bar');
const navToggle  = document.getElementById('navToggle');
const navLinks   = document.querySelector('.nav-links');
const navOverlay = document.getElementById('navOverlay');

if (navBar) {
  window.addEventListener('scroll', () => {
    navBar.classList.toggle('scrolled', window.scrollY > 20);
  });
}

function toggleMenu(open) {
  if (navToggle)  navToggle.classList.toggle('active', open);
  if (navLinks)   navLinks.classList.toggle('active', open);
  if (navOverlay) navOverlay.classList.toggle('active', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks && navLinks.classList.contains('active');
    toggleMenu(!isOpen);
  });
}

if (navOverlay) {
  navOverlay.addEventListener('click', () => toggleMenu(false));
}

if (navLinks) {
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggleMenu(false));
  });
}

// ─── SMOOTH SCROLL (Lenis) — synced with GSAP ScrollTrigger ───
let lenis = null;
function initSmoothScroll() {
  if (typeof Lenis === 'undefined') return;        // CDN failed — fall back to native

  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth ease-out
    smoothWheel: true,
    smoothTouch: false,   // keep native touch scroll on mobile (pinned sections rely on it)
    touchMultiplier: 1.5
  });

  // Keep ScrollTrigger in sync on every Lenis scroll frame
  lenis.on('scroll', ScrollTrigger.update);

  // Drive Lenis from GSAP's ticker (single RAF loop, no jank)
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Route in-page anchor links through Lenis (offset for fixed nav)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -64 });
    });
  });
}



// ─── WILL-CHANGE: Pre-promote animated elements to GPU layers ───
function initWillChange() {
  const gpuEls = [
    '.chapter-photo', '.local-success-sticky', '.ls-photo',
    '.rtv-photo', '.reality-tv-sticky', '.sc-slide img',
    '.sc-track', '.dj-card', '.t-card', '.emp-panel',
    '.tour-row', '#empHorizontalTrack'
  ];
  gpuEls.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.willChange = 'transform';
    });
  });
}

// ─── CURSOR — runs immediately, independent of GSAP/CDN availability ───
initCursor();

// ─── SERVICE CARDS reveal-on-scroll — plain IntersectionObserver, no GSAP needed ───
(function () {
  const cards = document.querySelectorAll('[data-emp-card]');
  if (!cards.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    // No IO support: just show them, no animation.
    cards.forEach(c => c.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(c => io.observe(c));
})();

// ─── SINGLE LOAD LISTENER — ALL GSAP ───
window.addEventListener('load', () => {
  // If GSAP/ScrollTrigger failed to load (CDN blocked, slow network, etc.),
  // bail out here instead of throwing. Content stays visible by default —
  // CSS only hides it once .gsap-active is added below, so a failed CDN
  // just means no scroll animations, never invisible content.
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return;
  }
  document.body.classList.add('gsap-active');
  gsap.registerPlugin(ScrollTrigger);

// ─── GLOBAL GSAP PERFORMANCE CONFIG ───
gsap.config({ force3D: true });
ScrollTrigger.config({
  limitCallbacks: true,
  ignoreMobileResize: true,
  syncInterval: 40
});
  initSmoothScroll();       // ← Lenis smooth scrolling (synced w/ ScrollTrigger)
  initWillChange();
initGrain();
  initAbout();
  initChapters();
  initTour();
  initMusic();
  initFooterSocials();
  initFooterGSAP();
  initTestimonials();
  initTestimonialsCarousel();
  initDJSection();

  // Refresh all ScrollTriggers after everything is registered
  setTimeout(() => ScrollTrigger.refresh(true), 800);
});

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh(true);
  }, 500);
});


// ─── GRAIN ───
function initGrain() {
  const canvas = document.getElementById('grain');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  (function draw() {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 18;
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(draw);
  })();
}


// ─── CURSOR ───
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  (function lerp() {
    rx += (mx - rx) * 0.08; ry += (my - ry) * 0.08;
    dot.style.left  = mx + 'px'; dot.style.top  = my + 'px';
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(lerp);
  })();
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
  });
}


// ─── ABOUT ───
function initAbout() {
  const el = document.querySelector('#about');
  if (!el) return;
  gsap.set(el, { opacity: 0, y: 30 });
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' });
    }
  }, { threshold: 0.2 }).observe(el);
}


// ─── ALL CHAPTERS ───
function initChapters() {
  const mm = gsap.matchMedia();

  document.querySelectorAll('.chapter-heading, .section-heading, .sc-title, .t-title').forEach(h => {
    const l1 = h.querySelector('.line-1');
    const l2 = h.querySelector('.line-2');
    if (!l1 || !l2) return;
    const st = { trigger: h, start: 'top 85%', end: 'top 25%', scrub: 1.2 };
    mm.add('(min-width: 768px)', () => {
      gsap.fromTo(l1, { x: -150, opacity: 0 }, { x: 78,  opacity: 1, ease: 'none', scrollTrigger: st });
      gsap.fromTo(l2, { x: 500,  opacity: 0 }, { x: 186, opacity: 1, ease: 'none', scrollTrigger: st });
    });
    mm.add('(max-width: 767px)', () => {
      gsap.fromTo(l1, { x: -80, opacity: 0 }, { x: 0, opacity: 1, ease: 'none', scrollTrigger: st });
      gsap.fromTo(l2, { x: 200, opacity: 0 }, { x: 0, opacity: 1, ease: 'none', scrollTrigger: st });
    });
  });

  document.querySelectorAll('.chapter-text').forEach(el => {
    gsap.fromTo(el, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 75%', end: 'top 45%', toggleActions: 'play none none none' }
    });
  });

  // Chapter 1
  const c1i1 = document.querySelector('#ch1-img1');
  const c1i2 = document.querySelector('#ch1-img2');
  if (c1i1) gsap.fromTo(c1i1, { x: -80, opacity: 0, rotation: -2 }, { x: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: c1i1, start: 'top 80%', end: 'bottom 50%', scrub: 1.5 } });
  if (c1i2) gsap.fromTo(c1i2, { x:  80, opacity: 0, rotation:  2 }, { x: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: c1i2, start: 'top 75%', end: 'bottom 50%', scrub: 1.5 } });

  // Chapter 2 — Local Success card deck
  const lsTrack = document.querySelector('.local-success-track');
  if (lsTrack) {
    gsap.set('#ls-img1', { rotation: 3 });
    gsap.set('#ls-img2', { rotation: 0 });
    gsap.set('#ls-img3', { rotation: 0 });
    gsap.set('#ls-img4', { rotation: 9 });
    const lsExit = window.innerWidth < 768 ? -500 : -852;
    [
      { id: '#ls-img1', start: '15% top', end: '32% top' },
      { id: '#ls-img2', start: '32% top', end: '52% top' },
      { id: '#ls-img3', start: '52% top', end: '72% top' },
      { id: '#ls-img4', start: '72% top', end: '90% top' },
    ].forEach(({ id, start, end }) => {
      if (document.querySelector(id)) {
        gsap.to(id, { y: lsExit, ease: 'none', scrollTrigger: { trigger: '.local-success-track', start, end, scrub: 1.2 } });
      }
    });
  }

  // Chapter 3 — Reality TV
  const rtvTrack = document.querySelector('.reality-tv-track');
  if (rtvTrack) {
    const rtvY = window.innerWidth < 768 ? 700 : 852;
    gsap.set('#rtv-img1', { rotation: -12, y: rtvY });
    gsap.set('#rtv-img2', { rotation:   6, y: rtvY });
    gsap.set('#rtv-img3', { rotation:  -6, y: rtvY });
    gsap.set('#rtv-img4', { rotation:  -6, y: rtvY });
    gsap.set('#rtv-img5', { rotation:  10, y: rtvY });
    [
      { id: '#rtv-img1', start: '10% top', end: '35% top' },
      { id: '#rtv-img2', start: '30% top', end: '55% top' },
      { id: '#rtv-img3', start: '55% top', end: '70% top' },
      { id: '#rtv-img4', start: '65% top', end: '80% top' },
      { id: '#rtv-img5', start: '78% top', end: '95% top' },
    ].forEach(({ id, start, end }) => {
      if (document.querySelector(id)) {
        gsap.to(id, { y: 0, ease: 'none', scrollTrigger: { trigger: '.reality-tv-track', start, end, scrub: 1.2 } });
      }
    });
  }

  // Chapter 4 — Summertime
  const c4i1 = document.querySelector('#ch4-img1');
  const c4i2 = document.querySelector('#ch4-img2');
  const c4i3 = document.querySelector('#ch4-img3');
  if (c4i1) gsap.fromTo(c4i1, { y: 60, opacity: 0, rotation: -2 }, { y: -40, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#chapter-4', start: 'top 80%', end: 'bottom top',  scrub: 1.5 } });
  if (c4i2) gsap.fromTo(c4i2, { x: -60, opacity: 0 },               { x:   0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#chapter-4', start: 'top 80%', end: 'center top', scrub: 1   } });
  if (c4i3) gsap.fromTo(c4i3, { x:  60, opacity: 0, rotation: 3  }, { x:   0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#chapter-4', start: 'top 75%', end: 'center top', scrub: 1   } });

  // Chapter 5 — Sinner
  const c5i1 = document.querySelector('#ch5-img1');
  const c5i2 = document.querySelector('#ch5-img2');
  if (c5i1) gsap.fromTo(c5i1, { y: 80, opacity: 0, rotation: -3 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#chapter-5', start: 'top 80%', end: 'center top', scrub: 1 } });
  if (c5i2) gsap.fromTo(c5i2, { scale: 0.85, opacity: 0 },          { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#chapter-5', start: 'top 75%', end: 'center top', scrub: 1 } });
}


// ─── TOUR ───
function initTour() {
  const rows = document.querySelectorAll('.tour-row');
  if (!rows.length) return;
  gsap.fromTo(rows, { x: -60, opacity: 0 }, {
    x: 0, opacity: 1, stagger: 0.04, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '#tour', start: 'top 85%', toggleActions: 'play none none none' }
  });
}


// ─── MUSIC ───
function initMusic() {
  document.querySelectorAll('.album-card').forEach((card, i) => {
    gsap.fromTo(card, { y: 60, opacity: 0, scale: 0.95 }, {
      y: 0, opacity: 1, scale: 1, duration: 0.8, delay: i * 0.15, ease: 'power2.out',
      scrollTrigger: { trigger: card, start: 'top 80%', toggleActions: 'play none none reverse' }
    });
  });
}


// ─── FOOTER SOCIALS ───
function initFooterSocials() {
  const socials = document.querySelectorAll('.social-links a');
  if (!socials.length) return;
  gsap.fromTo(socials, { opacity: 0, y: 20 }, {
    opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out',
    scrollTrigger: { trigger: '.social-links', start: 'top 90%', toggleActions: 'play none none reverse' }
  });
}


// ─── FOOTER GSAP (ef footer) ───
function initFooterGSAP() {
  const ef = document.getElementById('ef');
  if (!ef) return;

  gsap.set('#ef-logo',              { opacity: 0, scale: 0.88 });
  gsap.set('#ef-tagline',           { opacity: 0, y: 28 });
  gsap.set('#ef-info .ef-info-row', { opacity: 0, x: -28 });
  gsap.set('#ef-soc-head',          { opacity: 0 });
  gsap.set('.ef-soc-btn',           { opacity: 0, y: 14 });
  gsap.set('#ef-fhead',             { opacity: 0, y: 28 });
  gsap.set('#ef-form-anim',         { opacity: 0, y: 20 });
  gsap.set('#ef-rule',              { scaleX: 0, opacity: 0 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: '#ef', start: 'top 88%', once: true }
  });

  tl
    .to('#ef-logo',              { opacity: 1, scale: 1, duration: 1, ease: 'expo.out' })
    .to('#ef-tagline',           { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5')
    .to('#ef-info .ef-info-row', { opacity: 1, x: 0, stagger: 0.09, duration: 0.7, ease: 'power3.out' }, '-=0.5')
    .to('#ef-soc-head',          { opacity: 1, duration: 0.4 }, '-=0.2')
    .to('.ef-soc-btn',           { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'back.out(1.4)' }, '-=0.1')
    .to('#ef-fhead',             { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, '-=1.0')
    .to('#ef-form-anim',         { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.5')
    .to('#ef-rule',              { scaleX: 1, opacity: 1, duration: 1.4, ease: 'power3.out', transformOrigin: 'left center' }, '-=0.4');

  gsap.to('.ef-bg-word', {
    y: -80, ease: 'none',
    scrollTrigger: { trigger: '#ef', start: 'top bottom', end: 'bottom top', scrub: 2 }
  });
}


// ─── TESTIMONIALS ───
function initTestimonials() {
  const section = document.getElementById('testimonials');
  if (!section) return;

  document.querySelectorAll('.t-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width  * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - rect.top)  / rect.height * 100) + '%');
    });
  });

  function animateCounter(el, target, duration) {
    if (!el) return;
    let start = 0;
    const step = timestamp => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      el.textContent = Math.floor(progress * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + '+';
    };
    requestAnimationFrame(step);
  }

  const tl = gsap.timeline({
    scrollTrigger: { trigger: '#testimonials', start: 'top 72%', once: true }
  });

  tl.to('#tChapterTag', { opacity: 1, x: 0,  duration: 0.6, ease: 'power2.out' })
    .to('#tEyebrow',    { opacity: 1,         duration: 0.5, ease: 'power2.out' }, '-=0.3')
    .to('#tTicker',     { opacity: 1,         duration: 0.5 }, '-=0.2');

  gsap.utils.toArray('[data-tcard]').forEach((card, i) => {
    gsap.to(card, {
      opacity: 1, y: 0,
      duration: 0.8, ease: 'power3.out', delay: i * 0.08,
      scrollTrigger: {
        trigger: card, start: 'top 82%', once: true,
        onEnter: () => {
          if (i === 1) animateCounter(document.getElementById('tCounterEvents'), 200, 1500);
        }
      }
    });
  });

  gsap.to('#tBottomBar', {
    opacity: 1, y: 0, duration: 0.9,
    scrollTrigger: { trigger: '#tBottomBar', start: 'top 90%', once: true }
  });

  gsap.utils.toArray('.t-quote-mark').forEach(el => {
    gsap.to(el, {
      y: -30, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  });
}

// ─── TESTIMONIALS: mobile-only swipe carousel (desktop grid untouched) ───
function initTestimonialsCarousel() {
  const grid = document.querySelector('#testimonials .t-grid');
  if (!grid) return;

  const mq = window.matchMedia('(max-width: 768px)');
  let active = false;      // carousel currently mounted?
  let teardown = null;     // unmount fn

  function mount() {
    const cards = Array.from(grid.querySelectorAll('.t-card'));
    if (!cards.length) return;
    let index = 0;

    // CSS handles flex/translate; ensure clean starting transform
    grid.style.transition = 'transform .45s ease';
    grid.style.transform = 'translateX(0%)';
    grid.style.willChange = 'transform';

    // Build arrows + dots
    const prevBtn = document.createElement('button');
    prevBtn.className = 't-cara-prev'; prevBtn.type = 'button';
    prevBtn.setAttribute('aria-label', 'Previous testimonial');
    prevBtn.innerHTML = '&#8249;';
    const nextBtn = document.createElement('button');
    nextBtn.className = 't-cara-next'; nextBtn.type = 'button';
    nextBtn.setAttribute('aria-label', 'Next testimonial');
    nextBtn.innerHTML = '&#8250;';

    const dotsWrap = document.createElement('div');
    dotsWrap.className = 't-cara-dots';
    const dots = cards.map((_, i) => {
      const d = document.createElement('button');
      d.className = 't-cara-dot' + (i === 0 ? ' t-cara-dot--active' : '');
      d.type = 'button';
      d.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
      d.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(d);
      return d;
    });

    // Inject into the section container (grid's parent) so they position over the row
    const host = grid.parentElement;
    host.style.position = host.style.position || 'relative';
    host.appendChild(prevBtn);
    host.appendChild(nextBtn);
    host.appendChild(dotsWrap);

    function render() {
      grid.style.transform = 'translateX(' + (-index * 100) + '%)';
      dots.forEach((d, i) => d.classList.toggle('t-cara-dot--active', i === index));
      prevBtn.classList.toggle('t-cara-disabled', index === 0);
      nextBtn.classList.toggle('t-cara-disabled', index === cards.length - 1);
    }
    function goTo(i) {
      index = Math.max(0, Math.min(cards.length - 1, i));
      render();
    }
    const onPrev = () => goTo(index - 1);
    const onNext = () => goTo(index + 1);
    prevBtn.addEventListener('click', onPrev);
    nextBtn.addEventListener('click', onNext);

    // Pointer swipe (threshold 40px)
    let startX = 0, dragging = false;
    const SWIPE = 40;
    const down = e => { dragging = true; startX = e.clientX; };
    const up = e => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > SWIPE) { dx < 0 ? onNext() : onPrev(); }
    };
    grid.addEventListener('pointerdown', down);
    grid.addEventListener('pointerup', up);
    grid.addEventListener('pointercancel', up);

    render();

    teardown = function () {
      prevBtn.remove(); nextBtn.remove(); dotsWrap.remove();
      grid.removeEventListener('pointerdown', down);
      grid.removeEventListener('pointerup', up);
      grid.removeEventListener('pointercancel', up);
      grid.style.removeProperty('transition');
      grid.style.removeProperty('transform');   // clear inline transform → desktop grid
      grid.style.removeProperty('will-change');
      teardown = null;
    };
  }

  function apply() {
    const wantCarousel = mq.matches;
    if (wantCarousel && !active) { mount(); active = true; }
    else if (!wantCarousel && active) { teardown && teardown(); active = false; }
  }

  apply();

  let rt;
  function onResize() { clearTimeout(rt); rt = setTimeout(apply, 200); }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}


// ─── DJ SECTION ───
function initDJSection() {
  const card1 = document.getElementById('djCard1');
  const card2 = document.getElementById('djCard2');
  if (!card1 && !card2) return;

  if (card1) {
    gsap.fromTo(card1, { opacity: 0, x: -80 },
      { opacity: 1, x: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: card1, start: 'top 80%', once: true } });

    const tagLines = card1.querySelectorAll('.dj-tagline span');
    if (tagLines.length) {
      gsap.fromTo(tagLines, { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.15, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: card1, start: 'top 70%', once: true } });
    }

    const para1 = card1.querySelector('.dj-para');
    if (para1) {
      gsap.fromTo(para1, { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: card1, start: 'top 65%', once: true } });
    }

    const img1 = card1.querySelector('.dj-img-wrap img');
    if (img1) {
      gsap.fromTo(img1, { scale: 1.08 },
        { scale: 1, ease: 'none',
          scrollTrigger: { trigger: card1, start: 'top bottom', end: 'bottom top', scrub: 2 } });
    }
  }

  if (card2) {
    gsap.fromTo(card2, { opacity: 0, x: 80 },
      { opacity: 1, x: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: card2, start: 'top 80%', once: true } });

    const tagLines2 = card2.querySelectorAll('.dj-tagline span');
    if (tagLines2.length) {
      gsap.fromTo(tagLines2, { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.15, duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: card2, start: 'top 70%', once: true } });
    }

    const para2 = card2.querySelector('.dj-para');
    if (para2) {
      gsap.fromTo(para2, { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: card2, start: 'top 65%', once: true } });
    }

    const img2 = card2.querySelector('.dj-img-wrap img');
    if (img2) {
      gsap.fromTo(img2, { scale: 1.08 },
        { scale: 1, ease: 'none',
          scrollTrigger: { trigger: card2, start: 'top bottom', end: 'bottom top', scrub: 2 } });
    }
  }

  document.querySelectorAll('.dj-gold-line').forEach(line => {
    gsap.fromTo(line, { width: 0, opacity: 0 },
      { width: 48, opacity: 0.7, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: line, start: 'top 85%', once: true } });
  });
}




// ─── HERO PARALLAX ───
(function () {
  const sinner        = document.querySelector('.sinner-scroll');
  const mandy         = document.querySelector('.mandy-scroll');
  const overlay       = document.querySelector('.overlay');
  const heroContent   = document.querySelector('.hero-content');
  const scrollContainer = document.querySelector('.scroll-container');
  if (!sinner || !mandy || !overlay || !heroContent || !scrollContainer) return;

  function updateParallax() {
    const scrollY   = window.scrollY;
    const maxScroll = scrollContainer.offsetHeight - window.innerHeight;
    const ratio     = Math.min(scrollY / maxScroll, 1);
    sinner.style.transform    = 'translate3d(0px,' + (scrollY * -0.451) + 'px,0px)';
    mandy.style.transform     = 'translate3d(0px,' + (scrollY *  0.447) + 'px,0px)';
    overlay.style.opacity     = Math.min(ratio * 1.1, 0.95);
    heroContent.style.opacity = Math.max(1 - ratio * 1.15, 0);
  }

  let _ticking = false;
  window.addEventListener('scroll', () => {
    if (!_ticking) {
      requestAnimationFrame(() => { updateParallax(); _ticking = false; });
      _ticking = true;
    }
  }, { passive: true });
  window.addEventListener('load', updateParallax);
})();


// ─── TYPING EFFECT ───
(function () {
  const el = document.getElementById('typing');
  if (!el) return;

  const words = ['ENGAGING.', 'ENERGIZING.', 'EXTRAORDINARY'];
  let wordIndex = 0, charIndex = 0, isDeleting = false, speed = 80;

  function typeEffect() {
    const currentWord = words[wordIndex];
    if (!isDeleting) {
      el.innerHTML = currentWord.substring(0, charIndex++);
      if (charIndex > currentWord.length) { isDeleting = true; speed = 1000; }
    } else {
      el.innerHTML = currentWord.substring(0, charIndex--);
      if (charIndex === 0) { isDeleting = false; wordIndex = (wordIndex + 1) % words.length; speed = 200; }
    }
    setTimeout(typeEffect, isDeleting ? 50 : speed);
  }

  typeEffect();
})();


// ─── GALLERY / SHOWCASE ───
(function () {
  const scLine1 = document.getElementById('scLine1');
  if (!scLine1) return;

  // GSAP may fail to load (CDN blocked, slow network). Guard every direct
  // call so a failure only skips the animation flourish, never breaks the
  // slider's core interactivity (arrows, dots, autoplay, keyboard, swipe).
  const hasGsap = typeof gsap !== 'undefined';

  function splitChars(el, text) {
    if (!el) return;
    el.innerHTML = '';
    [...text].forEach(c => {
      const s = document.createElement('span');
      s.className = c === ' ' ? 'sp' : 'ch';
      if (c !== ' ') s.textContent = c;
      el.appendChild(s);
    });
  }

  function onVisible(el, cb, threshold = 0.2) {
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { cb(); io.disconnect(); } });
    }, { threshold });
    io.observe(el);
  }

  const scHead = document.querySelector('.sc-head');
  if (scHead && hasGsap) {
    onVisible(scHead, () => {
      const htl = gsap.timeline();
      htl
        .to('#scChap', { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' })
        .to('#scSub',  { opacity: 1, y: 0, duration: 0.6,  ease: 'power2.out' }, '-=0.3')
        .from('#scControls', { opacity: 0, y: 16, duration: 0.5, ease: 'power2.out' }, '-=0.3');
    });
  }

  const slides    = Array.from(document.querySelectorAll('.sc-slide'));
  const track     = document.getElementById('scTrack');
  const film      = document.getElementById('scFilm');
  const progFill  = document.getElementById('scProgFill');
  const curNum    = document.getElementById('scCurNum');
  const totNum    = document.getElementById('scTotNum');
  const scPrev    = document.getElementById('scPrev');
  const scNext    = document.getElementById('scNext');
  const autoBtn   = document.getElementById('scAutoBtn');
  const stage     = document.getElementById('scStage');

  if (!slides.length || !track || !film || !progFill || !curNum || !totNum || !scPrev || !scNext || !autoBtn || !stage) return;

  const total = slides.length;
  let current = 0, animating = false, autoTimer = null, isPlaying = true;

  totNum.textContent = String(total).padStart(2, '0');

  slides.forEach((sl, i) => {
    const src = sl.querySelector('img').src;
    const th  = document.createElement('div');
    th.className = 'sc-thumb' + (i === 0 ? ' active' : '');
    th.innerHTML = `<img src="${src}" alt="">`;
    th.addEventListener('click', () => goTo(i));
    film.appendChild(th);
  });

  const thumbs = Array.from(document.querySelectorAll('.sc-thumb'));

  function getOffset(idx) {
    let offset = 0;
    slides.forEach((sl, i) => { if (i < idx) offset += sl.offsetWidth; });
    const stageW  = track.parentElement.offsetWidth;
    const activeW = slides[idx].offsetWidth;
    offset -= (stageW - activeW) / 2;
    return -offset;
  }

  function goTo(idx, instant = false) {
    if (animating && !instant) return;
    animating = true;
    const prev = current;
    current = ((idx % total) + total) % total;
    slides[prev].classList.remove('active');
    slides[current].classList.add('active');
    thumbs[prev].classList.remove('active');
    thumbs[current].classList.add('active');
    // Scroll only the filmstrip horizontally — never let the page jump
    const filmEl = thumbs[current].parentElement;
    if (filmEl) {
      const thumbRect = thumbs[current].getBoundingClientRect();
      const filmRect = filmEl.getBoundingClientRect();
      const delta = (thumbRect.left + thumbRect.width / 2) - (filmRect.left + filmRect.width / 2);
      filmEl.scrollBy({ left: delta, behavior: 'smooth' });
    }
    if (hasGsap) {
      gsap.to(track, {
        x: getOffset(current),
        duration: instant ? 0 : 0.85,
        ease: 'power3.inOut',
        overwrite: 'auto',
        onComplete:  () => { animating = false; },
        onInterrupt: () => { animating = false; }   // resize/overwrite must not leave it stuck
      });
    } else {
      track.style.transform = 'translateX(' + getOffset(current) + 'px)';
      animating = false;
    }
    progFill.style.width = ((current + 1) / total * 100) + '%';
    curNum.textContent = String(current + 1).padStart(2, '0');
  }

  function init() {
    slides[0].classList.add('active');
    if (hasGsap) {
      gsap.set(track, { x: getOffset(0) });
    } else {
      track.style.transform = 'translateX(' + getOffset(0) + 'px)';
    }
  }
  init();

  window.addEventListener('resize', () => {
    if (animating) return;                       // don't clobber an in-flight slide tween
    if (hasGsap) {
      gsap.set(track, { x: getOffset(current) });
    } else {
      track.style.transform = 'translateX(' + getOffset(current) + 'px)';
    }
  });

  scPrev.addEventListener('click', () => goTo(current - 1));
  scNext.addEventListener('click', () => goTo(current + 1));

  slides.forEach((sl, i) => {
    sl.addEventListener('click', () => { if (!sl.classList.contains('active')) goTo(i); });
    const sideArrow = sl.querySelector('.sc-side-arrow');
    if (sideArrow) {
      sideArrow.addEventListener('click', e => {
        e.stopPropagation();   // don't double-fire the slide's own click
        goTo(current + 1);
      });
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') goTo(current + 1);
    if (e.key === 'ArrowLeft')  goTo(current - 1);
  });

  let touchX = 0;
  stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  });

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => goTo(current + 1), 4000);
    isPlaying = true;
    autoBtn.classList.add('playing');
  }
  function stopAuto() {
    clearInterval(autoTimer);
    isPlaying = false;
    autoBtn.classList.remove('playing');
  }

  autoBtn.addEventListener('click', () => isPlaying ? stopAuto() : startAuto());
  startAuto();

  stage.addEventListener('mouseenter', () => { if (isPlaying) clearInterval(autoTimer); });
  stage.addEventListener('mouseleave', () => { if (isPlaying) startAuto(); });

  if (hasGsap) {
    gsap.to('.sc-blob.b1', { x: 70, y: -40, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.sc-blob.b2', { x: -80, y: 50, duration: 15, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }
})();