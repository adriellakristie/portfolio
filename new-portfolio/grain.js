/**
 * grain.js — animated film grain overlay
 * Drop this script at the bottom of your <body>:
 *   <script src="grain.js"></script>
 */

(function () {
  // ── Config ──────────────────────────────────────
  const OPACITY   = 0.05;   // 0 = invisible, 0.1 = very visible
  const SIZE      = 1;    // grain particle size in px
  const SPEED     = 90;     // ms between grain frames (lower = faster flicker)
  // ────────────────────────────────────────────────

  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '9999',
    opacity:       OPACITY,
  });

  document.body.appendChild(canvas);

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function drawGrain() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const imageData = ctx.createImageData(w, h);
    const data      = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const val = (Math.random() * 255) | 0;
      data[i]     = val; // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 255; // A
    }

    ctx.putImageData(imageData, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  // Flicker loop
  let last = 0;
  function loop(ts) {
    if (ts - last > SPEED) {
      drawGrain();
      last = ts;
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();