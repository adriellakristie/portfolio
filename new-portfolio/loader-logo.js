/*
 * loader-logo.js — starts the couch logo on the loading screen (logo-scene.js).
 * It draws in a worker when the browser can hand the canvas over, so the room
 * loading on this thread can't make the jump stutter; otherwise it draws here.
 * Stops once the loading screen has gone.
 *
 * ?logoT=1.2 freezes the jump at that time; ?logoView=az,el sets the camera angle.
 */
const canvas = document.getElementById('loaderLogo');
const loaderEl = document.getElementById('loader');

if (canvas && !document.documentElement.classList.contains('returning')) start();

async function start() {
  const params = new URLSearchParams(location.search);
  const opts = {
    width: canvas.clientWidth || 1,
    height: canvas.clientHeight || 1,
    dpr: window.devicePixelRatio || 1,
    modelUrl: new URL('models/couchlogo.glb', location.href).href,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    freezeAt: params.has('logoT') ? Number(params.get('logoT')) : null,
    view: params.has('logoView') ? params.get('logoView').split(',').map(Number) : null,
  };
  let el = canvas;
  let logo = null;
  let shown = false;
  const ready = () => { shown = true; el.classList.add('ready'); if (params.has('logoTiming')) console.log('[logo] first frame at', Math.round(performance.now()), 'ms'); };
  // room.js waits for this before leaving the loading screen, so the jump is seen.
  const landed = () => { window.__logoLanded = true; window.dispatchEvent(new Event('logo:landed')); };

  // On this thread: the fallback, and for browsers without OffscreenCanvas.
  async function here() {
    try {
      const { createLogo } = await import('./logo-scene.js?v=12');
      logo = createLogo({ canvas: el, ...opts, onReady: ready, onLanded: landed });
    } catch (err) { console.error('[logo]', err); }
  }

  if (canvas.transferControlToOffscreen && typeof Worker !== 'undefined') {
    let worker;
    // Some browsers hand the canvas over but can't draw WebGL in a worker
    // (and say nothing). If it fails or hasn't drawn in time, swap in a fresh
    // canvas and draw it here instead.
    const fallBack = (why) => {
      if (shown || !worker) return;
      console.warn('[logo] drawing on the main thread:', why);
      worker.terminate();
      worker = null;
      const fresh = canvas.cloneNode(false);
      fresh.classList.remove('ready');
      el.replaceWith(fresh);
      el = fresh;
      here();
    };
    try {
      worker = new Worker(new URL('logo-worker.js?v=12', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      worker.onmessage = (e) => { if (e.data.type === 'ready') ready(); else if (e.data.type === 'landed') landed(); else if (e.data.type === 'error') fallBack(e.data.message); };
      worker.onerror = (e) => { e.preventDefault?.(); fallBack(e.message || 'worker error'); };
      worker.postMessage({ type: 'init', canvas: offscreen, ...opts }, [offscreen]);
      setTimeout(() => fallBack('no frame from the worker in time'), 4000);
      logo = {
        resize: (w, h) => worker && worker.postMessage({ type: 'resize', width: w, height: h }),
        stop: () => worker && worker.postMessage({ type: 'stop' }),
      };
    } catch (err) {
      worker = { terminate() {} };
      fallBack(err.message);
    }
  } else {
    await here();
  }

  window.addEventListener('resize', () => logo && logo.resize(el.clientWidth || 1, el.clientHeight || 1));
  if (loaderEl) {
    new MutationObserver((_, obs) => {
      if (loaderEl.classList.contains('done')) { obs.disconnect(); setTimeout(() => logo && logo.stop(), 1600); }
    }).observe(loaderEl, { attributes: true, attributeFilter: ['class'] });
  }
}
