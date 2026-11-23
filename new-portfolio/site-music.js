/*
 * site-music.js — the room's song, with a play/pause button in the nav on
 * every page. Include it right after the page's <header class="site-header">.
 *
 * In the room, room.js owns the song: it reports with a 'site-music:state'
 * event ({ detail: { on } }) and listens for 'site-music:toggle'.
 * Everywhere else the song carries on quietly from where the last page left
 * it (saved in sessionStorage as 'ak-music'), and pausing here is remembered
 * when you go back to the room.
 */
(function () {
  const KEY = 'ak-music';
  const LOW = 0.18;   // the quiet level it plays at away from the room
  const SONG_URL = new URL('audio/' + 'citra.m4a', document.currentScript.src).href;
  const links = document.querySelector('.site-header .site-links');
  if (!links) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'site-music';
  btn.hidden = true;
  btn.innerHTML = '<span class="site-music-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  links.appendChild(btn);
  function show(on) {
    btn.hidden = false;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
    btn.title = on ? 'Pause music' : 'Play music';
  }

  // The room: room.js plays the song; this is only its button.
  if (document.documentElement.dataset.musicHost === 'room') {
    window.addEventListener('site-music:state', (e) => show(!!e.detail.on));
    btn.addEventListener('click', () => window.dispatchEvent(new Event('site-music:toggle')));
    return;
  }

  let st = null;
  try { st = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) {}
  if (!st || !(st.on || st.t > 0)) return;   // not played yet this visit: nothing to pause

  const from = Math.max(0, st.on ? st.t + (Date.now() - st.at) / 1000 : st.t);
  // #t= starts the file at that point, so there's no blip from the beginning.
  const song = new Audio(SONG_URL + '#t=' + from.toFixed(2));
  song.loop = true;
  song.volume = 0;   // fades in (the room fades it out on the way here)
  song.preload = st.on ? 'auto' : 'none';
  window.siteMusic = { audio: song };
  let fade = 0;
  function fadeTo(to, ms) {
    const from = song.volume, t0 = performance.now(), id = ++fade;
    (function step(now) {
      if (id !== fade) return;
      const k = Math.min(1, (now - t0) / ms);
      song.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  song.addEventListener('play', () => { show(true); if (song.volume < LOW) fadeTo(LOW, 1800); });
  song.addEventListener('pause', () => show(false));
  show(false);

  let wanted = !!st.on;   // what the visitor wants (the browser may still be holding it back)
  function play() { song.play().catch(() => {}); }
  if (st.on) {
    play();
    // If the browser wanted a tap first, start on the first one (unless it's on this button).
    document.addEventListener('pointerdown', function retry(e) {
      document.removeEventListener('pointerdown', retry);
      if (!btn.contains(e.target) && wanted && song.paused) play();
    });
  }
  btn.addEventListener('click', () => { wanted = song.paused; if (wanted) play(); else song.pause(); });

  window.addEventListener('pagehide', () => {
    const t = song.currentTime > 0 ? song.currentTime : from;
    try { sessionStorage.setItem(KEY, JSON.stringify({ on: wanted, t, at: Date.now() })); } catch (e) {}
  });
})();
