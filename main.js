/* =====================================================================
   BETTER CALL BEN — main.js
   Lenis (inertia) + GSAP/ScrollTrigger (reveals, tracé du fil, pulse)
   ===================================================================== */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  gsap.registerPlugin(ScrollTrigger);

  /* -------------------------------------------------------------------
     1. LENIS — smooth / inertia scroll, synchronisé avec ScrollTrigger
     ------------------------------------------------------------------- */
  let lenis;
  if (!REDUCED) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ancres internes via Lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.2 });
      else el.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* -------------------------------------------------------------------
     2. SPOTLIGHT curseur — lampe de bureau chaude
     ------------------------------------------------------------------- */
  const spot = document.querySelector('.spotlight');
  if (spot && !REDUCED) {
    let tx = 50, ty = 30, cx = 50, cy = 30;
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth) * 100;
      ty = (e.clientY / window.innerHeight) * 100;
    });
    const loop = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      spot.style.setProperty('--mx', cx + '%');
      spot.style.setProperty('--my', cy + '%');
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* -------------------------------------------------------------------
     3. NAV — état "scrolled"
     ------------------------------------------------------------------- */
  const nav = document.getElementById('nav');
  ScrollTrigger.create({
    start: 'top -60',
    end: 99999,
    onUpdate: (self) => nav.classList.toggle('is-scrolled', self.scroll() > 60),
  });

  /* -------------------------------------------------------------------
     4. LE FIL — construit un tracé qui serpente entre les ancres
        de chaque section [data-connect], puis se dessine au scroll
     ------------------------------------------------------------------- */
  const wire       = document.getElementById('wire');
  const pathMain   = document.getElementById('wirePath');
  const pathGhost  = document.getElementById('wirePathGhost');
  const pathPulse  = document.getElementById('wirePulse');
  const connectorsLayer = document.getElementById('connectors');

  const buildWire = () => {
    const docH = document.documentElement.scrollHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    wire.setAttribute('viewBox', `0 0 ${W} ${docH}`);
    wire.style.height = docH + 'px';

    // points d'ancrage = centre vertical de chaque section connectée
    const nodes = [...document.querySelectorAll('[data-connect]')].map((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return { el, y: top + r.height / 2, h: r.height, id: el.dataset.connect };
    });

    // colonne du fil : centre sur mobile, légèrement à gauche sur desktop
    const mobile = W < 760;
    const colX = mobile ? W * 0.5 : Math.min(W * 0.5, 620);
    const amp = mobile ? Math.min(W * 0.18, 70) : Math.min(W * 0.16, 150);

    // départ : sous le cerveau du hero (coin bas-droite)
    const startX = mobile ? W * 0.5 : W - Math.min(W * 0.18, 200);
    const startY = Math.min(H * 0.78, nodes[0] ? nodes[0].y + nodes[0].h * 0.25 : H * 0.7);

    let d = `M ${startX.toFixed(1)} ${startY.toFixed(1)}`;
    let prevX = startX, prevY = startY;

    nodes.forEach((n, i) => {
      // alterne gauche/droite autour de la colonne pour serpenter
      const side = i % 2 === 0 ? -1 : 1;
      const x = colX + side * amp;
      const y = n.y;
      const midY = (prevY + y) / 2;
      // courbe de Bézier douce
      d += ` C ${prevX.toFixed(1)} ${midY.toFixed(1)}, ${x.toFixed(1)} ${midY.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
      n.x = x;
      prevX = x; prevY = y;
    });

    // fin : se rebranche dans la puce du footer (centre bas)
    const footer = document.getElementById('footer');
    if (footer) {
      const fr = footer.getBoundingClientRect();
      const fy = fr.top + window.scrollY + 40;
      d += ` C ${prevX.toFixed(1)} ${((prevY + fy) / 2).toFixed(1)}, ${(W / 2).toFixed(1)} ${((prevY + fy) / 2).toFixed(1)}, ${(W / 2).toFixed(1)} ${fy.toFixed(1)}`;
    }

    pathMain.setAttribute('d', d);
    pathGhost.setAttribute('d', d);
    pathPulse.setAttribute('d', d);

    // place les connecteurs (puces) sur chaque nœud — en coordonnées document (absolu)
    connectorsLayer.style.height = docH + 'px';
    connectorsLayer.innerHTML = '';
    nodes.forEach((n) => {
      const c = document.createElement('span');
      c.className = 'connector';
      c.dataset.for = n.id;
      c.style.left = n.x + 'px';
      c.style.top = n.y + 'px';
      connectorsLayer.appendChild(c);
    });
    return pathMain.getTotalLength();
  };

  let wireLen = buildWire();

  // état initial du tracé : invisible
  const setDraw = (progress) => {
    gsap.set(pathMain, { strokeDasharray: wireLen, strokeDashoffset: wireLen * (1 - progress) });
  };
  setDraw(0);

  // ScrollTrigger qui pilote le dessin du fil sur tout le document
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => setDraw(self.progress),
  });

  // Allumage des connecteurs : quand leur section entre dans le viewport
  document.querySelectorAll('[data-connect]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      onEnter: () => lightConnector(el.dataset.connect, true),
      onLeaveBack: () => lightConnector(el.dataset.connect, false),
    });
  });
  const lightConnector = (id, on) => {
    const c = connectorsLayer.querySelector(`.connector[data-for="${id}"]`);
    if (c) c.classList.toggle('is-live', on);
  };

  /* -------------------------------------------------------------------
     5. PULSE — impulsion lumineuse qui voyage le long du fil
     ------------------------------------------------------------------- */
  if (!REDUCED) {
    const seg = 0.06; // longueur relative du segment lumineux
    gsap.set(pathPulse, {
      strokeDasharray: `${wireLen * seg} ${wireLen}`,
      opacity: 0.85,
    });
    gsap.to(pathPulse, {
      strokeDashoffset: -wireLen,
      duration: 4.5,
      ease: 'none',
      repeat: -1,
    });
  }

  /* -------------------------------------------------------------------
     6. REVEALS — sections, piliers, cas, stats
     ------------------------------------------------------------------- */
  const revealItems = [
    '.hero__content > *',
    '.lede > *',
    '.section-head > *',
    '.pilier',
    '.stat',
    '.stat__node',
    '.film',
    '.gallery__item',
    '.quote > *',
    '.cta > *',
    '.footer > *',
  ];

  if (!REDUCED) {
    revealItems.forEach((sel) => {
      gsap.utils.toArray(sel).forEach((el) => el.classList.add('reveal'));
    });

    // hero : révélé d'entrée (sans scroll)
    gsap.to('.hero__content > *', {
      opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.2,
      onStart: () => document.querySelectorAll('.hero__content > *').forEach(e => e.classList.remove('reveal')),
    });

    // les autres : au scroll, en stagger par groupe
    const groups = ['.lede', '.piliers', '.stats', '.work', '.quote', '.cta', '.footer'];
    groups.forEach((g) => {
      const container = document.querySelector(g);
      if (!container) return;
      const items = container.querySelectorAll('.reveal');
      if (!items.length) return;
      gsap.to(items, {
        opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: container, start: 'top 78%' },
      });
    });
  }

  /* -------------------------------------------------------------------
     7. COMPTEURS de stats
     ------------------------------------------------------------------- */
  document.querySelectorAll('.stat__num').forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => {
        if (REDUCED) { el.textContent = prefix + target; return; }
        gsap.to(obj, {
          v: target, duration: 1.6, ease: 'power2.out',
          onUpdate: () => { el.textContent = prefix + Math.round(obj.v); },
        });
      },
    });
  });

  /* -------------------------------------------------------------------
     8. HERO — cerveau qui pulse + fil/jack qui ondule (avant scroll)
     ------------------------------------------------------------------- */
  if (!REDUCED) {
    gsap.to('.brainchip__brain', { opacity: 0.55, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.brainchip__core', { fill: 'oklch(0.92 0.18 95)', duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.fromTo('.brainchip__cord',
      { attr: { d: 'M120 60 C150 54 150 66 168 60' } },
      { attr: { d: 'M120 60 C150 66 150 54 168 60' }, duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.fromTo('.brainchip', { y: 0 }, { y: -8, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    // hero parallax léger
    gsap.to('.hero__img', {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /* -------------------------------------------------------------------
     9. FILTRES portfolio
     ------------------------------------------------------------------- */
  const chips = document.querySelectorAll('.work__filters .chip');
  const cases = document.querySelectorAll('.work__grid .film');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const f = chip.dataset.filter;
      cases.forEach((c) => {
        const show = f === 'all' || c.dataset.cat.split(' ').includes(f);
        c.classList.toggle('is-hidden', !show);
        if (show && !REDUCED) gsap.fromTo(c, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
      });
      ScrollTrigger.refresh();
    });
  });

  /* -------------------------------------------------------------------
     10. CTA — le combiné qui "sonne" au hover
     ------------------------------------------------------------------- */
  const ctaBtn = document.querySelector('.btn--ring');
  const handset = document.querySelector('.cta__handset');
  if (ctaBtn && handset && !REDUCED) {
    const ring = () => gsap.fromTo(handset,
      { rotation: -12 },
      { rotation: 12, duration: 0.08, repeat: 7, yoyo: true, ease: 'sine.inOut',
        onComplete: () => gsap.to(handset, { rotation: 0, duration: 0.15 }) });
    ctaBtn.addEventListener('mouseenter', ring);
    // sonne aussi quand la section entre à l'écran
    ScrollTrigger.create({ trigger: '.cta', start: 'top 60%', once: true, onEnter: ring });
  }

  /* -------------------------------------------------------------------
     11. Recalcul du fil sur resize
     ------------------------------------------------------------------- */
  let rt;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      wireLen = buildWire();
      if (!REDUCED) {
        gsap.set(pathPulse, { strokeDasharray: `${wireLen * 0.06} ${wireLen}` });
      }
      ScrollTrigger.refresh();
    }, 200);
  };
  window.addEventListener('resize', onResize);

  // refresh après chargement complet des images (positions correctes)
  window.addEventListener('load', () => {
    wireLen = buildWire();
    ScrollTrigger.refresh();
  });
});

/* =====================================================================
   FILMS — cartes vidéo en lecture directe, chargement différé, lightbox
   ===================================================================== */
(() => {
  const vids = document.querySelectorAll('video.lazyvid');
  if (!vids.length) return;
  const portrait = window.innerHeight > window.innerWidth;

  // choix de la source (Balagan : 9:16 sur écran vertical)
  vids.forEach((v) => {
    if (portrait && v.dataset.srcPortrait) {
      v.dataset.src = v.dataset.srcPortrait;
      if (v.dataset.posterPortrait) v.setAttribute('poster', v.dataset.posterPortrait);
    }
  });

  const load = (v) => {
    if (v.dataset.loaded) return;
    v.src = v.dataset.src; v.dataset.loaded = '1';
    v.load();
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { load(v); v.play().catch(() => {}); }
      else if (v.dataset.loaded) { v.pause(); }
    });
  }, { rootMargin: '600px 0px' });
  vids.forEach((v) => io.observe(v));

  // lightbox avec son
  const lb = document.getElementById('lightbox');
  const lbv = lb.querySelector('.lightbox__video');
  const lbt = lb.querySelector('.lightbox__title');
  const open = (v) => {
    lbv.src = v.dataset.src; lbv.muted = false; lbv.currentTime = 0;
    lbt.textContent = v.dataset.title || '';
    lb.hidden = false; document.body.style.overflow = 'hidden';
    lbv.play().catch(() => {});
    if (typeof lenis !== 'undefined' && lenis) lenis.stop();
  };
  const close = () => {
    lbv.pause(); lbv.removeAttribute('src'); lbv.load();
    lb.hidden = true; document.body.style.overflow = '';
    if (typeof lenis !== 'undefined' && lenis) lenis.start();
  };
  document.querySelectorAll('.film__open').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); open(b.parentElement.querySelector('video')); });
  });
  document.querySelectorAll('.film').forEach((f) => f.addEventListener('click', () => open(f.querySelector('video'))));
  lb.querySelector('.lightbox__close').addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) close(); });

})();
