// Draws the loading-screen logo off the main thread (see logo-scene.js).
import { createLogo } from './logo-scene.js?v=12';

let logo = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try { logo = createLogo({ ...m, onReady: () => self.postMessage({ type: 'ready' }), onLanded: () => self.postMessage({ type: 'landed' }), onError: (err) => self.postMessage({ type: 'error', message: String(err) }) }); }
    catch (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); }
  }
  else if (m.type === 'resize' && logo) logo.resize(m.width, m.height);
  else if (m.type === 'stop' && logo) { logo.stop(); self.close(); }
};
