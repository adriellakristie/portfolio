/*
 * work.js — the "Work" screen shown inside the TV. room.js flies the camera
 * up to the TV, then calls open(): the screen is black, switches on like a
 * CRT (a bright line that opens out), and shows the collection of work.
 * close() switches it off again before room.js flies back out.
 *
 * Two tabs: Projects (PROJECTS below, as cards) and Playground (PLAYGROUND
 * below: a list with a light-bulb marker on the selected piece and a preview
 * beside it). The Playground view is index.html#playground, so it can be
 * linked to and the browser's back button returns to Projects.
 */

const PROJECTS = [
    { title: 'OnTheWay', img: 'images/otw-card.jpg?v=2', href: 'projects/ontheway.html' },
    // Same as the Thunk case study's hero: the home screen on the Thunk gradient.
    { title: 'Thunk', img: 'media/homescreen.png', href: 'projects/thunk.html',
      fit: 'auto 88%', bg: 'linear-gradient(160deg, #eceb8c 0%, #9fd8c8 45%, #45c8e0 100%)' },
    { title: 'Merangkai', img: 'images/merangkai-card.png', href: 'projects/merangkai.html' },
    { title: 'EcoBite', img: 'images/ecobite-card.jpg', href: 'projects/ecobite.html' },
];

// Each piece lists its media in order: { embed, w, h } (a p5.js sketch page,
// shown live; w x h is the size it was made for), { video } (a motion piece)
// or { image }. The first one
// leads the preview; the rest follow under the description. Images and videos
// are never cropped. thumb is the list thumbnail. year is optional.
const PG = 'media/';
const PLAYGROUND = [
  { title: 'Barong', tags: ['p5.js', 'interactive'], thumb: 'media/labc1.png',
    media: [{ embed: PG + 'sketch2/index.html', w: 1280, h: 720 }],
    desc: 'Meet Wayan, a playful take on Barong, the lion-like guardian spirit from Balinese folklore. Play with a kaleidoscope using your mouse and get a sticker at the end. Sound on!' },
  { title: 'Ondel Ondel', tags: ['p5.js', 'performance'], thumb: 'media/labc3.png',
    media: [{ embed: PG + 'sketches/index.html', w: 1280, h: 720 }],
    desc: 'An interactive performance piece inspired by the Ondel-Ondel. The scenes slowly shift from ordinary to eerie, with a small interactive moment along the way. Contains flashing lights.' },
  { title: 'She (Her)', tags: ['p5.js', 'interactive'], thumb: 'media/labc4.png',
    media: [{ embed: PG + 'sketch3/index.html', w: 800, h: 800 }],
    desc: 'An avatar you can restyle: keys 1–6 change her colours, Q W E R change her hair. Her eyes follow your cursor, and a click switches her to a silly mood.' },
  { title: 'Java Patterns', tags: ['processing', 'java'], thumb: 'media/labc2.png',
    media: ['batik1.PNG', 'batik2.PNG', 'batik3.PNG', 'batik4.PNG', 'batikcombo.PNG'].map((f) => ({ image: 'media/' + f })),
    desc: 'Batik comes from Java, and this one was drawn in Java. Every ellipse is placed by hand in Processing, and the same composition is explored across different colourways.' },
  { title: 'JADE Jakarta', year: '2026', tags: ['visual + motion', 'freelance'], thumb: 'media/jade.JPG',
    media: [
      { video: PG + 'jade/story.mp4' }, { image: PG + 'jade/stotypic.png' }, { image: PG + 'jade/elements.png' },
      { video: PG + 'jade/website.mp4' }, { image: PG + 'jade/cover.png' },
    ],
    desc: 'Illustrated visuals and animations for Jade Boutique’s Eid al-Fitr campaign, made in Procreate, Illustrator and Premiere Pro.' },
  { title: 'Slow Move Bazaar', year: '2024', tags: ['visual + print', 'internship'], thumb: 'media/smb.JPG',
    media: [
      { video: PG + 'smb/smb1.mp4' }, { image: PG + 'smb/smb2.png' }, { image: PG + 'smb/smb3.png' }, { video: PG + 'smb/smb4.MP4' },
      ...['smb5.JPG', 'smb6.JPG', 'smb7.JPG', 'smb8.png', 'smb9.PNG'].map((f) => ({ image: PG + 'smb/' + f })),
    ],
    desc: 'Branding, promotional graphics and set design for the 8th volume of Indonesia’s first and largest sustainable bazaar.' },
];
const TABS = ['Projects', 'Playground'];
const PG_HASH = '#playground';

const ON_MS = 650;    // CRT switch-on
const OFF_MS = 380;   // CRT switch-off

export function createWorkTV({ onBack, onPlayToggle, songTitle }) {
  const root = document.getElementById('workTV');
  const tabsEl = root.querySelector('.tv-tabs');
  const gridEl = root.querySelector('.tv-grid');
  const pgEl = root.querySelector('.pg-panel');
  const pgList = root.querySelector('.pg-list');
  const pgView = root.querySelector('.pg-view');
  const mobile = window.matchMedia('(max-width: 860px)');
  const scroller = root.querySelector('.tv-inner');   // the TV screen's scrolling area
  const navRoom = document.getElementById('navRoom');   // "Room" in the site navigation (room.js handles the click)
  const navWork = document.getElementById('navWork');
  const playBtn = root.querySelector('[data-play]');
  if (songTitle) root.querySelector('.tv-song').textContent = songTitle;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tab = TABS[0];
  let current = 0;     // selected Playground piece
  let isOpen = false;
  let lastFocus = null;

  function tabButtons(el, names, selected, pick) {
    el.innerHTML = '';
    for (const name of names) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tv-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(name === selected));
      b.textContent = name;
      b.addEventListener('click', () => pick(name));
      el.appendChild(b);
    }
  }

  // Playground goes to #playground (a new history entry, so Back returns to
  // Projects); Projects swaps it back to #work in place.
  function pickTab(name) {
    if (name === 'Playground') { if (location.hash !== PG_HASH) location.hash = 'playground'; else route(); }
    else {
      if (location.hash === PG_HASH) history.replaceState(null, '', location.pathname + location.search + '#work');
      route();
    }
  }

  // Show the view the URL asks for.
  function route() {
    tab = location.hash === PG_HASH ? 'Playground' : 'Projects';
    renderTabs();
    const pg = tab === 'Playground';
    gridEl.hidden = pg;
    pgEl.hidden = !pg;
    if (pg) renderPlayground(); else clearPlayground();
    scroller.scrollTop = 0;
  }

  function renderTabs() {
    tabButtons(tabsEl, TABS, tab, pickTab);
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    for (const item of PROJECTS) {
      const el = document.createElement('a');
      el.className = 'tv-card';
      el.href = item.href;
      el.innerHTML = `<span class="tv-card-img"></span><span class="tv-card-title"></span>`;
      const img = el.querySelector('.tv-card-img');
      // fit: a background-size for the picture (default: fill the card).
      // bg: something drawn behind it, e.g. a gradient.
      img.style.backgroundImage = `url("${encodeURI(item.img)}")` + (item.bg ? `, ${item.bg}` : '');
      if (item.fit) img.style.backgroundSize = `${item.fit}, cover`;
      el.querySelector('.tv-card-title').textContent = item.title;
      gridEl.appendChild(el);
    }
  }

  // ── Playground ──
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // One piece of media. Images and videos keep their own shape (never cropped);
  // a sketch runs live in a 4:3 frame. Videos play while on screen (see watchVideos).
  function mediaHTML(p, m, k) {
    const n = p.media.length > 1 ? ` (${k + 1} of ${p.media.length})` : '';
    if (m.embed) {
      const w = m.w || 1280, h = m.h || 720;
      return `<div class="pg-media" data-w="${w}" style="--ar:${(w / h).toFixed(4)}"><iframe src="${esc(m.embed)}" title="${esc(p.title)}: live p5.js sketch" allow="autoplay" style="width:${w}px;height:${h}px"></iframe></div>`;
    }
    if (m.video) return `<video class="pg-shot" src="${esc(m.video)}" muted loop playsinline preload="${k ? 'none' : 'auto'}"${reduceMotion ? ' controls' : ''} aria-label="${esc(p.title + n)}"></video>`;
    return `<img class="pg-shot" src="${esc(m.image)}" alt="${esc(p.title + n)}"${k ? ' loading="lazy"' : ''}>`;
  }

  function detailHTML(p, withTitle) {
    const [first, ...rest] = p.media;
    return `
      ${mediaHTML(p, first, 0)}
      <div class="pg-info">
        <div>${withTitle ? `<h3>${esc(p.title)}</h3>` : ''}<p>${esc(p.desc)}</p></div>
        <div class="pg-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      </div>
      ${rest.length ? `<div class="pg-more">${rest.map((m, k) => mediaHTML(p, m, k + 1)).join('')}</div>` : ''}`;
  }

  // Videos play (muted, looping) while they're on screen and pause when not.
  const videoWatch = 'IntersectionObserver' in window && !reduceMotion
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.preload = 'auto'; e.target.play().catch(() => {}); } else e.target.pause();
    }), { threshold: 0.35 })
    : null;
  function watchVideos() {
    if (!videoWatch) return;
    videoWatch.disconnect();
    root.querySelectorAll('video.pg-shot').forEach((v) => videoWatch.observe(v));
  }

  const BULB = '<svg class="pg-bulb" viewBox="0 0 24 24" aria-hidden="true"><path class="glass" d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.7.5 1.1 1.3 1.1 2.1v.7h5.6v-.7c0-.8.4-1.6 1.1-2.1A6.5 6.5 0 0 0 12 2.5z"/><path class="base" d="M9.4 18.6h5.2M9.9 20.6h4.2M10.9 22.4h2.2"/></svg>';

  function renderPlayground() {
    pgList.innerHTML = PLAYGROUND.map((p, i) => `
      <li class="pg-item${i === current ? ' on' : ''}" data-i="${i}">
        ${BULB}
        <button type="button" class="pg-btn" aria-expanded="${i === current}">
          <div class="pg-title">${esc(p.title)}</div>
          <div class="pg-meta">${esc([p.tags[0], p.year].filter(Boolean).join(' · '))}</div>
        </button>
        ${mobile.matches && i === current ? `<div class="pg-inline pg-fade">${detailHTML(p, false)}</div>` : ''}
      </li>`).join('');
    pgView.innerHTML = mobile.matches ? '' : `<div class="pg-fade">${detailHTML(PLAYGROUND[current], true)}</div>`;
    fitPreview();
    sketches.clear();
    root.querySelectorAll('.pg-media iframe').forEach(lighten);
    scaleFrames();
    watchVideos();
  }

  // Scale each sketch from the size it was made for down to its frame.
  const frameWatch = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => scaleFrame(e.target))) : null;
  function scaleFrame(box) {
    const f = box.querySelector('iframe');
    if (f && box.clientWidth) f.style.transform = `scale(${box.clientWidth / +box.dataset.w})`;
  }
  function scaleFrames() {
    root.querySelectorAll('.pg-media[data-w]').forEach((box) => { scaleFrame(box); if (frameWatch) frameWatch.observe(box); });
  }

  function fitPreview() { if (scroller.clientHeight) pgEl.style.setProperty('--fit-h', scroller.clientHeight + 'px'); }

  // Keep sketches light. Each one draws at 1x pixel density: it's scaled down
  // to about half size anyway, so it stays sharp, and a high-resolution
  // screen no longer redraws a canvas four times the size every frame.
  // (Scrolling over a sketch passes to the page on its own, smoothly.)
  const sketches = new Set();   // p5 instances of the sketches on show
  function lighten(frame) {
    frame.addEventListener('load', () => {
      let tries = 0;
      const wait = () => {
        let p5i = null;
        try { p5i = frame.contentWindow.p5 && frame.contentWindow.p5.instance; } catch (err) { return; }   // another site's page
        if (!p5i || !p5i._setupDone) { if (++tries < 60) setTimeout(wait, 50); return; }
        sketches.add(p5i);
        if (p5i.pixelDensity() > 1) {
          p5i.pixelDensity(1);
          if (!p5i.isLooping()) p5i.redraw();   // e.g. waiting behind its warning screen
        }
      };
      wait();
    });
  }

  // While the page scrolls, sketches hold still (they pick up again right
  // after), so scrolling stays smooth. Sketches that stopped themselves stay stopped.
  const held = new Set();
  let resumeTimer = 0;
  function holdSketches() {
    for (const p5i of sketches) {
      try { if (p5i.isLooping()) { p5i.noLoop(); held.add(p5i); } } catch (err) { sketches.delete(p5i); }
    }
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { held.forEach((p5i) => { try { p5i.loop(); } catch (err) {} }); held.clear(); }, 160);
  }
  scroller.addEventListener('scroll', holdSketches, { passive: true });
  pgView.addEventListener('scroll', holdSketches, { passive: true });

  // After picking a piece, move the TV up so all of it can be seen: on a
  // computer the whole panel (the preview starts at its top), on a phone the
  // piece under its name.
  function revealSelected() {
    const target = mobile.matches ? pgList.querySelector('.pg-item.on') : pgEl;
    if (!target) return;
    const by = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
    if (Math.abs(by) > 2) scroller.scrollBy({ top: by, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // Emptied when the Playground isn't showing, so sketches and videos stop.
  function clearPlayground() { sketches.clear(); held.clear(); if (videoWatch) videoWatch.disconnect(); if (frameWatch) frameWatch.disconnect(); pgList.innerHTML = ''; pgView.innerHTML = ''; }

  function select(i) {
    if (i !== current || mobile.matches) {
      current = i;
      renderPlayground();
      pgView.scrollTop = 0;
    }
    revealSelected();
    // An image still loading has no height yet: line up again once it has one.
    const lead = (mobile.matches ? pgList.querySelector('.pg-item.on') : pgView)?.querySelector('.pg-shot');
    if (lead && !(lead.complete || lead.readyState >= 1)) {
      lead.addEventListener(lead.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', revealSelected, { once: true });
    }
  }

  pgList.addEventListener('click', (e) => {
    const li = e.target.closest('.pg-item');
    if (li && e.target.closest('.pg-btn')) select(+li.dataset.i);
  });
  pgList.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const n = (current + (e.key === 'ArrowDown' ? 1 : -1) + PLAYGROUND.length) % PLAYGROUND.length;
    select(n);
    pgList.querySelectorAll('.pg-btn')[n].focus({ preventScroll: true });
  });
  mobile.addEventListener('change', () => { if (isOpen && tab === 'Playground') renderPlayground(); });
  window.addEventListener('resize', () => { if (isOpen) fitPreview(); });
  window.addEventListener('hashchange', () => { if (isOpen) route(); });

  // instant: show it straight away, without the CRT switch-on (coming back
  // from a case study's "All work"). "Room" in the navigation or Esc closes it.
  function open(instant = false) {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    renderGrid();
    route();
    root.hidden = false;
    fitPreview();   // measured now that the screen is showing
    document.body.classList.add('tv-open');
    navWork?.setAttribute('aria-current', 'page');
    navRoom?.removeAttribute('aria-current');
    root.classList.remove('off', 'on');
    if (!instant) {
      void root.offsetWidth;   // restart the animation
      root.classList.add('on');
    }
    setTimeout(() => tabsEl.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }), reduceMotion || instant ? 0 : ON_MS);
  }

  function close(done) {
    if (!isOpen) { if (done) done(); return; }
    isOpen = false;
    clearPlayground();
    root.classList.remove('on');
    root.classList.add('off');
    document.body.classList.remove('tv-open');
    navWork?.removeAttribute('aria-current');
    navRoom?.setAttribute('aria-current', 'page');
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('off');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      if (done) done();
    }, reduceMotion ? 0 : OFF_MS);
  }

  // While the TV is open: Esc goes back, and Tab cycles through the site
  // navigation and the TV screen only (not the room behind it).
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); onBack(); }
    if (e.key === 'Tab') {
      const f = [...document.querySelectorAll('.site-header a[href], .site-header .site-links button'), ...root.querySelectorAll('a[href], button:not([disabled])')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  // The song player: play / pause also spins the record player in the room.
  function setPlaying(playing) {
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }
  playBtn.addEventListener('click', () => {
    const playing = playBtn.getAttribute('aria-pressed') !== 'true';
    setPlaying(playing);
    if (onPlayToggle) onPlayToggle(playing);
  });

  return { open, close, setPlaying, get isOpen() { return isOpen; } };
}
