/*
 * work.js — the "Work" screen shown inside the TV. room.js flies the camera
 * up to the TV, then calls open(): the screen is black, switches on like a
 * CRT (a bright line that opens out), and shows the collection of work.
 * close() switches it off again before room.js flies back out.
 *
 * Edit WORK below to change what is listed. Each tab shows its projects as
 * cards; empty slots (up to SLOTS per tab) show as placeholder holders.
 */

const WORK = {
  'Web Applications': [
    { title: 'OnTheWay', img: '../pages/otw-img1.png', href: '../pages/ontheway.html' },
    { title: 'EcoBite', img: '../pages/ecobite-img1.png', href: '../pages/ecobite.html' },
    { title: 'Merangkai', img: '../pages/merangkai-hero.png', href: '../pages/merangkai.html' },
  ],
  'Mobile Applications': [
    { title: 'Thunk', img: '../pages/thunk-button.png', href: '../pages/thunk.html' },
  ],
  'Other Work': [
    { title: 'Generative Batik', img: '../labc1.png', href: '../pages/lab-barong.html' },
    { title: 'Ondel Ondel', img: '../labc2.png', href: '../pages/lab-generative-art.html' },
    { title: 'L-System Tree', img: '../labc4.png', href: '../pages/lab-she.html' },
    { title: 'Jade', img: '../jade.JPG', href: '../pages/lab-jade.html' },
    { title: 'SMB', img: '../smb.JPG', href: '../pages/lab-smb.html' },
  ],
};
const SLOTS = 6;   // cards per tab; the rest are placeholder holders

const ON_MS = 650;    // CRT switch-on
const OFF_MS = 380;   // CRT switch-off

export function createWorkTV({ onBack, onPlayToggle, songTitle }) {
  const root = document.getElementById('workTV');
  const tabsEl = root.querySelector('.tv-tabs');
  const gridEl = root.querySelector('.tv-grid');
  const backBtn = root.querySelector('.tv-back');
  const playBtn = root.querySelector('[data-play]');
  if (songTitle) root.querySelector('.tv-song').textContent = songTitle;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tab = Object.keys(WORK)[0];
  let isOpen = false;
  let lastFocus = null;

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const name of Object.keys(WORK)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tv-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(name === tab));
      b.textContent = name;
      b.addEventListener('click', () => { tab = name; renderTabs(); renderGrid(); });
      tabsEl.appendChild(b);
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    const items = WORK[tab];
    const count = Math.max(SLOTS, items.length);
    for (let i = 0; i < count; i++) {
      const item = items[i];
      const el = document.createElement(item ? 'a' : 'div');
      el.className = 'tv-card' + (item ? '' : ' is-empty');
      if (item) {
        el.href = item.href;
        el.innerHTML = `<span class="tv-card-img"></span><span class="tv-card-title"></span>`;
        el.querySelector('.tv-card-img').style.backgroundImage = `url("${encodeURI(item.img)}")`;
        el.querySelector('.tv-card-title').textContent = item.title;
      } else {
        el.setAttribute('aria-hidden', 'true');
      }
      gridEl.appendChild(el);
    }
    gridEl.parentElement.scrollTop = 0;
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    renderTabs();
    renderGrid();
    root.hidden = false;
    document.body.classList.add('tv-open');
    document.getElementById('navWork')?.setAttribute('aria-current', 'page');
    root.classList.remove('off', 'on');
    void root.offsetWidth;   // restart the animation
    root.classList.add('on');
    setTimeout(() => backBtn.focus({ preventScroll: true }), reduceMotion ? 0 : ON_MS);
  }

  function close(done) {
    if (!isOpen) { if (done) done(); return; }
    isOpen = false;
    root.classList.remove('on');
    root.classList.add('off');
    document.body.classList.remove('tv-open');
    document.getElementById('navWork')?.removeAttribute('aria-current');
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('off');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      if (done) done();
    }, reduceMotion ? 0 : OFF_MS);
  }

  backBtn.addEventListener('click', () => onBack());
  // While the TV is open: Esc goes back, and Tab cycles through the site
  // navigation and the TV screen only (not the room behind it).
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); onBack(); }
    if (e.key === 'Tab') {
      const f = [...document.querySelectorAll('.nav a[href], .nav button'), ...root.querySelectorAll('a[href], button:not([disabled])')];
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
