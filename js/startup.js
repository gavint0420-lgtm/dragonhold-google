'use strict';
// ===== Dragonhold: a 5-second live opening =====
// Painted and animated in real time on a canvas (no video or image files):
//   0.0s  a storm breaks; lightning shows a dragon perched on a crag and a knight below a far castle
//   0.9s  the dragon rears back and draws breath: a glow climbs its throat, smoke curls from its nostrils
//   1.6s  it pours a river of fire onto the knight, who braces behind his shield; the flames splash off
//         the shield, set the ground alight and light the whole scene orange, and the camera shakes
//   3.8s  the fire dies away into smoke and embers. The knight still stands.
// The flames are hundreds of glowing particles. Skip with the button, Space, Enter or Esc.
(function () {
  const DURATION = 5;
  const W = 1600, H = 900, GROUND = 724;               // the scene is painted on a 1600x900 stage, scaled to cover the screen
  const T_INHALE = 0.9, T_BREATH = 1.6, T_BREATH_END = 3.8;
  const LORE = [
    {at:0.0, text:'A storm breaks over Dragonhold...'},
    {at:0.9, text:'The wyrm draws a burning breath...'},
    {at:1.6, text:'Dragonfire pours down on the last knight...'},
    {at:3.8, text:'Steel holds. The knight still stands.'},
    {at:4.6, text:'Welcome to Dragonhold.'}];
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const seg = (t, a, b) => ease((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // a soft round glow: [r,g,b] at full strength in the middle, fading to nothing
  function glowSprite(rgb, size, core) {
    const c = mk(size, size), g = c.getContext('2d'), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(core || 0.3, `rgba(${rgb},0.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
  }

  function init() {
    const screen = document.getElementById('startupScreen');
    if (!screen) return;
    const canvas = document.getElementById('startupFx');
    const bar = document.getElementById('startupBar'), timer = document.getElementById('startupTimer'), status = document.getElementById('startupStatus');
    const skip = document.getElementById('btnStartupSkip');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const off = mk(1, 1), octx = off.getContext('2d'); // for lighting the dragon and knight by the fire
    let DPR = 1, S = 1, OX = 0, OY = 0;
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(innerWidth * DPR); canvas.height = Math.round(innerHeight * DPR);
      off.width = canvas.width; off.height = canvas.height;
      S = Math.max(canvas.width / W, canvas.height / H); // cover the screen
      OX = (canvas.width - W * S) / 2; OY = (canvas.height - H * S) / 2;
    }
    resize(); window.addEventListener('resize', resize);

    // ---------- things painted once ----------
    const R = rng(1337);
    const SPR = {
      white: glowSprite('255,250,225', 64, 0.35), yellow: glowSprite('255,214,90', 64), orange: glowSprite('255,130,30', 64),
      red: glowSprite('210,50,12', 64), smoke: glowSprite('34,28,30', 64, 0.5), ember: glowSprite('255,190,80', 16, 0.2)};
    const backdrop = paintBackdrop(), clouds = paintClouds(), grain = paintGrain();

    function paintBackdrop() {
      const c = mk(W, H), g = c.getContext('2d'), r = rng(7);
      // storm sky, with a sick orange glow low on the horizon behind the castle
      let gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#07060d'); gr.addColorStop(0.42, '#1d1426'); gr.addColorStop(0.62, '#3c1e22'); gr.addColorStop(0.78, '#6a2c1c'); gr.addColorStop(1, '#1a0f0c');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createRadialGradient(1360, 560, 10, 1360, 560, 520);
      gr.addColorStop(0, 'rgba(255,120,40,0.35)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // far mountains, then nearer hills
      const ridge = (base, amp, f, col, seed) => {
        const rr = rng(seed); const ph = [rr() * 6, rr() * 6, rr() * 6];
        g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, base - amp * (0.55 * Math.sin(x * f + ph[0]) + 0.3 * Math.sin(x * f * 2.3 + ph[1]) + 0.15 * Math.sin(x * f * 5.1 + ph[2])) - amp * 0.4 * Math.abs(Math.sin(x * f * 0.7)));
        g.lineTo(W, H); g.closePath(); g.fill();
      };
      ridge(560, 120, 0.004, '#22161f', 3);
      ridge(610, 70, 0.007, '#1a1018', 5);
      // the castle on its hill, far to the right
      g.fillStyle = '#120a10';
      g.beginPath(); g.moveTo(1180, 640); g.quadraticCurveTo(1360, 520, 1560, 600); g.lineTo(1560, 700); g.lineTo(1180, 700); g.closePath(); g.fill();
      const tower = (x, y, w, h, spire) => {
        g.fillRect(x, y, w, h);
        for (let k = 0; k < w; k += 8) g.fillRect(x + k, y - 6, 5, 6);
        if (spire) { g.beginPath(); g.moveTo(x - 3, y - 6); g.lineTo(x + w / 2, y - 6 - spire); g.lineTo(x + w + 3, y - 6); g.closePath(); g.fill(); }
      };
      tower(1290, 470, 34, 120, 46); tower(1340, 500, 90, 90, 0); tower(1430, 455, 30, 135, 54); tower(1462, 505, 50, 85, 0); tower(1380, 430, 26, 80, 60);
      // ground: dark, rocky, rising slightly toward the knight
      gr = g.createLinearGradient(0, 640, 0, H);
      gr.addColorStop(0, '#2a1d17'); gr.addColorStop(0.35, '#1b130f'); gr.addColorStop(1, '#0b0807');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 700);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, GROUND - 6 + Math.sin(x * 0.013) * 5 + (x > 900 ? 0 : 0) + r() * 4);
      g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      for (let i = 0; i < 260; i++) { // pebbles and rocks with a lit top
        const x = r() * W, y = GROUND + 4 + Math.pow(r(), 0.6) * (H - GROUND), s = 2 + r() * 7 * ((y - GROUND) / (H - GROUND) + 0.3);
        g.fillStyle = `rgba(10,7,6,${0.5 + r() * 0.4})`; g.beginPath(); g.ellipse(x, y, s * 1.4, s * 0.7, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(110,80,60,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(x - s * 0.2, y - s * 0.25, s * 0.9, s * 0.3, 0, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 60; i++) { // dry grass tufts
        const x = 700 + r() * 900, y = GROUND - 2 + r() * 8; g.strokeStyle = `rgba(90,70,40,${0.4 + r() * 0.4})`; g.lineWidth = 1.2;
        g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(x + k * 2, y); g.lineTo(x + k * 2 + (r() - 0.3) * 6, y - 6 - r() * 10); } g.stroke();
      }
      // the dragon's crag: a broken spur of rock on the left
      const crag = new Path2D();
      crag.moveTo(-20, 560); crag.lineTo(80, 572); crag.lineTo(170, 586); crag.lineTo(260, 584); crag.lineTo(360, 592); crag.lineTo(470, 588); crag.lineTo(560, 598); crag.lineTo(610, 612);
      crag.lineTo(650, 650); crag.lineTo(700, 700); crag.lineTo(760, GROUND + 4); crag.lineTo(760, H); crag.lineTo(-20, H); crag.closePath();
      gr = g.createLinearGradient(0, 560, 300, 900);
      gr.addColorStop(0, '#3a2c25'); gr.addColorStop(0.4, '#221914'); gr.addColorStop(1, '#0c0908');
      g.fillStyle = gr; g.fill(crag);
      g.save(); g.clip(crag);
      for (let i = 0; i < 40; i++) { // strata and cracks
        const y = 600 + i * 8 + r() * 6; g.strokeStyle = `rgba(0,0,0,${0.25 + r() * 0.25})`; g.lineWidth = 1 + r() * 2;
        g.beginPath(); g.moveTo(-20, y); for (let x = 0; x < 780; x += 40) g.lineTo(x, y + (r() - 0.5) * 14); g.stroke();
      }
      for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; let x = r() * 650, y = 590 + r() * 40; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += 12 + r() * 16; g.lineTo(x, y); } g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(160,120,90,0.35)'; g.lineWidth = 2; // lit top edge
      g.beginPath(); g.moveTo(-20, 560); g.lineTo(80, 572); g.lineTo(170, 586); g.lineTo(260, 584); g.lineTo(360, 592); g.lineTo(470, 588); g.lineTo(560, 598); g.lineTo(610, 612); g.stroke();
      return c;
    }
    function paintClouds() {
      const c = mk(2600, 520), g = c.getContext('2d'), r = rng(99);
      for (let i = 0; i < 140; i++) {
        const x = r() * 2600, y = 40 + Math.pow(r(), 1.4) * 380, s = 60 + r() * 170, dark = r() < 0.7;
        const gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, dark ? 'rgba(20,14,24,0.55)' : 'rgba(70,46,58,0.4)'); gr.addColorStop(1, 'rgba(20,14,24,0)');
        g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
      }
      return c;
    }
    function paintGrain() {
      const c = mk(256, 256), g = c.getContext('2d'), img = g.createImageData(256, 256), r = rng(5);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0); return c;
    }

    // ---------- the dragon ----------
    const N0 = {x:452, y:452};                                  // where the neck leaves the chest
    function pose(t) {
      // pull: 1 = reared back to draw breath, negative = head thrust forward to breathe
      let pull = 0;
      if (t < T_INHALE) pull = 0.15 * seg(t, 0.2, 0.8);
      else if (t < T_BREATH) pull = lerp(0.15, 1, seg(t, T_INHALE, T_BREATH - 0.1));
      else if (t < T_BREATH + 0.25) pull = lerp(1, -0.75, seg(t, T_BREATH, T_BREATH + 0.25));
      else if (t < T_BREATH_END) pull = -0.75 + Math.sin(t * 9) * 0.03;
      else pull = lerp(-0.75, -0.1, seg(t, T_BREATH_END, T_BREATH_END + 0.9));
      const jaw = t < T_BREATH - 0.1 ? 0.12 + 0.05 * Math.sin(t * 3) : t < T_BREATH_END ? 1 + Math.sin(t * 23) * 0.05 : lerp(1, 0.2, seg(t, T_BREATH_END, T_BREATH_END + 0.5));
      const glow = t < T_INHALE ? 0 : t < T_BREATH ? seg(t, T_INHALE, T_BREATH) : t < T_BREATH_END ? 1 : 1 - seg(t, T_BREATH_END, T_BREATH_END + 0.6);
      const climb = seg(t, T_INHALE, T_BREATH);                 // the glow travels up the throat while it inhales
      const wing = Math.sin(t * 2.6) * 0.08 + (t > T_INHALE && t < T_BREATH ? -0.18 * seg(t, T_INHALE, T_BREATH) : t >= T_BREATH && t < T_BREATH_END ? -0.12 : 0);
      const hx = 590 - pull * 70, hy = 330 - pull * 50, a = 0.48 - pull * 0.34;
      return {pull, jaw, glow, climb, wing, hx, hy, a};
    }
    function neckPts(P) {
      const c1x = 505, c1y = 330, c2x = P.hx - Math.cos(P.a) * 100 - 14, c2y = P.hy - Math.sin(P.a) * 100 - 26, pts = [];
      for (let i = 0; i <= 26; i++) {
        const u = i / 26, v = 1 - u;
        pts.push({x:v * v * v * N0.x + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * P.hx, y:v * v * v * N0.y + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * P.hy, u});
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        pts[i].nx = -dy / d; pts[i].ny = dx / d; pts[i].w = 64 - 30 * pts[i].u;
      }
      return pts;
    }
    const mouthOf = P => ({x:P.hx + Math.cos(P.a) * 84 - Math.sin(P.a) * 8, y:P.hy + Math.sin(P.a) * 84 + Math.cos(P.a) * 8});
    const D = {dark:'#200b08', base:'#3e140e', mid:'#6a2216', lite:'#a5452a', belly:'#b0784a', bellyD:'#6e4228', bone:'#d8ccb0', horn:'#2a1c16'};
    function scales(g, x0, y0, x1, y1, s, col) { // rows of overlapping scale arcs (call inside a clip)
      g.strokeStyle = col; g.lineWidth = 1.1;
      for (let y = y0, row = 0; y < y1; y += s * 0.55, row++) {
        g.beginPath();
        for (let x = x0 + (row % 2) * s * 0.5; x < x1; x += s) { g.moveTo(x - s * 0.5, y); g.arc(x, y, s * 0.5, Math.PI, 0, true); }
        g.stroke();
      }
    }
    function wing(g, P, far) {
      const sx = far ? 368 : 336, sy = far ? 384 : 404, flap = P.wing + (far ? -0.05 : 0);
      const rot = (x, y) => { const c = Math.cos(flap), s = Math.sin(flap); return {x:sx + (x * c - y * s), y:sy + (x * s + y * c)}; };
      const wr = rot(-70, -215);                                  // the wrist, high above the back
      const tips = [rot(-330, -150), rot(-360, -20), rot(-300, 90), rot(-190, 130)];
      const back = {x:far ? 230 : 190, y:far ? 400 : 420};
      // membrane, scalloped between the finger bones, glowing a little where light shines through
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(wr.x, wr.y); g.lineTo(tips[0].x, tips[0].y);
      let prev = tips[0];
      for (let i = 1; i < tips.length; i++) { const tp = tips[i], mx = (prev.x + tp.x) / 2, my = (prev.y + tp.y) / 2; g.quadraticCurveTo(lerp(mx, wr.x, 0.32), lerp(my, wr.y, 0.32), tp.x, tp.y); prev = tp; }
      g.quadraticCurveTo(lerp((prev.x + back.x) / 2, wr.x, 0.25), lerp((prev.y + back.y) / 2, wr.y, 0.25), back.x, back.y); g.closePath();
      const gr = g.createLinearGradient(wr.x, wr.y, back.x, back.y + 80);
      gr.addColorStop(0, far ? '#24100c' : '#3a1610'); gr.addColorStop(0.6, far ? '#3a160e' : '#5a2014'); gr.addColorStop(1, far ? '#1c0a08' : '#2c0e0a');
      g.fillStyle = gr; g.fill();
      g.save(); g.clip(); g.strokeStyle = far ? 'rgba(90,30,20,0.4)' : 'rgba(130,50,30,0.45)'; g.lineWidth = 1;
      for (const tp of tips) for (let k = 1; k <= 3; k++) { g.beginPath(); g.moveTo(lerp(wr.x, tp.x, 0.2 * k), lerp(wr.y, tp.y, 0.2 * k)); g.quadraticCurveTo(lerp(wr.x, back.x, 0.5), lerp(wr.y, back.y, 0.5) + 30, back.x + k * 12, back.y + 10); g.stroke(); } // veins
      g.restore();
      // bones: arm, then the long fingers with a claw at the wrist
      g.strokeStyle = far ? '#1a0907' : '#2a0e0a'; g.lineCap = 'round';
      g.lineWidth = 13; g.beginPath(); g.moveTo(sx, sy); g.lineTo(wr.x, wr.y); g.stroke();
      for (let i = 0; i < tips.length; i++) { g.lineWidth = 6 - i; g.beginPath(); g.moveTo(wr.x, wr.y); g.lineTo(tips[i].x, tips[i].y); g.stroke(); }
      g.lineCap = 'butt';
      g.fillStyle = D.bone; g.beginPath(); g.moveTo(wr.x - 4, wr.y); g.lineTo(wr.x + 6, wr.y - 24); g.lineTo(wr.x + 6, wr.y + 2); g.closePath(); g.fill();
    }
    function drawDragon(g, t, P) {
      wing(g, P, true);
      // tail: curls down off the edge of the crag, spiked
      const tail = [{x:150, y:470}, {x:60, y:500}, {x:0, y:560}, {x:-60, y:640}];
      g.fillStyle = D.base; g.beginPath(); g.moveTo(tail[0].x, tail[0].y - 26);
      g.bezierCurveTo(70, 470, 20, 520, -60, 630); g.lineTo(-56, 650); g.bezierCurveTo(30, 560, 90, 520, 160, 516); g.closePath(); g.fill();
      for (let k = 0; k < 6; k++) { const u = k / 6, x = lerp(140, -40, u), y = lerp(445, 600, u * u); g.fillStyle = D.dark; g.beginPath(); g.moveTo(x - 6, y + 4); g.lineTo(x - 16, y - 16 + u * 6); g.lineTo(x + 6, y); g.closePath(); g.fill(); }
      // back leg, haunch bunched, claws dug into the rock
      g.fillStyle = D.mid; g.beginPath(); g.ellipse(212, 520, 66, 46, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = D.base; g.beginPath(); g.moveTo(186, 540); g.lineTo(232, 548); g.lineTo(214, 584); g.lineTo(166, 588); g.closePath(); g.fill();
      for (let k = 0; k < 3; k++) { g.fillStyle = D.bone; g.beginPath(); g.moveTo(170 + k * 14, 584); g.lineTo(162 + k * 14, 594); g.lineTo(178 + k * 14, 586); g.closePath(); g.fill(); }
      // body: barrel chest, ridged back, plated belly. It swells as it draws breath.
      const swell = 1 + P.glow * 0.05 * (t < T_BREATH ? 1 : 0.4);
      g.save(); g.translate(330, 480); g.scale(swell, swell); g.translate(-330, -480);
      const body = new Path2D();
      body.moveTo(480, 470); body.bezierCurveTo(482, 396, 392, 362, 300, 380); body.bezierCurveTo(226, 392, 158, 408, 124, 456);
      body.bezierCurveTo(104, 500, 150, 562, 236, 566); body.bezierCurveTo(330, 584, 446, 560, 480, 470);
      let gr = g.createLinearGradient(0, 370, 0, 570); gr.addColorStop(0, D.mid); gr.addColorStop(0.5, D.base); gr.addColorStop(1, D.dark);
      g.fillStyle = gr; g.fill(body);
      g.save(); g.clip(body);
      scales(g, 110, 380, 490, 560, 15, 'rgba(10,3,2,0.35)');
      g.fillStyle = D.belly; g.beginPath(); g.moveTo(476, 488); g.bezierCurveTo(440, 560, 330, 584, 230, 570); g.lineTo(240, 548); g.bezierCurveTo(330, 556, 420, 540, 456, 476); g.closePath(); g.fill();
      g.strokeStyle = D.bellyD; g.lineWidth = 2; for (let k = 0; k < 9; k++) { const u = k / 9, x = lerp(456, 250, u), y = lerp(486, 562, Math.sqrt(u)); g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 8, y + 12); g.stroke(); }
      g.restore();
      for (let k = 0; k < 9; k++) { const u = k / 8, x = lerp(150, 430, u), y = lerp(430, 384, Math.sin(u * 1.4)) - 8; g.fillStyle = D.dark; g.beginPath(); g.moveTo(x - 9, y + 6); g.lineTo(x - 2, y - 20 - Math.sin(u * 3) * 6); g.lineTo(x + 9, y + 6); g.closePath(); g.fill(); }
      g.restore();
      wing(g, P, false);
      // front leg: a thick forearm braced on the crag edge
      g.fillStyle = D.mid; g.beginPath(); g.moveTo(436, 486); g.quadraticCurveTo(486, 520, 474, 560); g.lineTo(500, 590); g.lineTo(448, 592); g.quadraticCurveTo(430, 540, 404, 520); g.closePath(); g.fill();
      for (let k = 0; k < 4; k++) { g.fillStyle = D.bone; g.beginPath(); g.moveTo(452 + k * 13, 590); g.quadraticCurveTo(460 + k * 13, 598, 470 + k * 13, 604); g.lineTo(462 + k * 13, 590); g.closePath(); g.fill(); }
      // neck: thick and scaled, plated underneath, a ridge of spines along the top
      const pts = neckPts(P);
      const neck = new Path2D();
      neck.moveTo(pts[0].x + pts[0].nx * pts[0].w / 2, pts[0].y + pts[0].ny * pts[0].w / 2);
      for (const q of pts) neck.lineTo(q.x + q.nx * q.w / 2, q.y + q.ny * q.w / 2);
      for (let i = pts.length - 1; i >= 0; i--) neck.lineTo(pts[i].x - pts[i].nx * pts[i].w / 2, pts[i].y - pts[i].ny * pts[i].w / 2);
      neck.closePath();
      gr = g.createLinearGradient(440, 280, 560, 420); gr.addColorStop(0, D.mid); gr.addColorStop(1, D.base);
      g.fillStyle = gr; g.fill(neck);
      g.save(); g.clip(neck); scales(g, 400, 250, 640, 470, 12, 'rgba(10,3,2,0.35)'); g.restore();
      g.strokeStyle = D.bellyD; g.lineWidth = 3;
      for (let i = 1; i < pts.length - 2; i += 2) { const q = pts[i], w = q.w / 2; g.strokeStyle = D.belly; g.beginPath(); g.moveTo(q.x + q.nx * w * 0.95, q.y + q.ny * w * 0.95); g.lineTo(q.x + q.nx * w * 0.45, q.y + q.ny * w * 0.45); g.stroke(); }
      for (let i = 1; i < pts.length - 1; i += 2) { const q = pts[i], w = q.w / 2; g.fillStyle = D.dark; g.beginPath(); g.moveTo(q.x - q.nx * w + q.ny * 6, q.y - q.ny * w - q.nx * 6); g.lineTo(q.x - q.nx * (w + 16 - q.u * 8), q.y - q.ny * (w + 16 - q.u * 8)); g.lineTo(q.x - q.nx * w - q.ny * 6, q.y - q.ny * w + q.nx * 6); g.closePath(); g.fill(); }
      // fire glowing through the throat as it draws breath (climbs from the chest to the jaw)
      if (P.glow > 0) {
        g.save(); g.clip(neck); g.globalCompositeOperation = 'lighter';
        const idx = Math.round(P.climb * (pts.length - 1));
        for (let i = 0; i <= idx; i++) { const q = pts[i], k = (1 - (idx - i) / (pts.length)) * P.glow; const sr = q.w * 1.05; g.globalAlpha = 0.34 * k; g.drawImage(SPR.orange, q.x + q.nx * q.w * 0.2 - sr, q.y + q.ny * q.w * 0.2 - sr, sr * 2, sr * 2); }
        g.restore(); g.globalAlpha = 1;
      }
      drawHead(g, t, P);
    }
    function drawHead(g, t, P) {
      g.save(); g.translate(P.hx, P.hy); g.rotate(P.a);
      // horns and frill swept back
      g.fillStyle = D.horn;
      g.beginPath(); g.moveTo(-34, -22); g.quadraticCurveTo(-80, -64, -132, -58); g.quadraticCurveTo(-88, -48, -50, -6); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-40, -6); g.quadraticCurveTo(-90, -22, -122, -6); g.quadraticCurveTo(-86, -4, -48, 8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(160,120,90,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-40, -26); g.quadraticCurveTo(-82, -62, -128, -58); g.stroke();
      for (let k = 0; k < 4; k++) { g.fillStyle = D.dark; g.beginPath(); g.moveTo(-30 - k * 9, 14); g.lineTo(-44 - k * 11, 30 + k * 2); g.lineTo(-24 - k * 9, 18); g.closePath(); g.fill(); } // jaw spines
      const jawA = P.jaw * 0.6;
      // inside of the mouth: dark, then blazing while it breathes
      g.save(); g.translate(-28, 6); g.rotate(jawA * 0.5);
      g.fillStyle = '#1a0606'; g.beginPath(); g.moveTo(0, 0); g.lineTo(96, -8); g.lineTo(96, 14 + jawA * 30); g.closePath(); g.fill();
      if (P.glow > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = P.glow; g.drawImage(SPR.yellow, 10, -30, 90, 70); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      g.restore();
      // lower jaw, hinged at the back, with teeth
      g.save(); g.translate(-30, 8); g.rotate(jawA);
      g.fillStyle = D.base; g.beginPath(); g.moveTo(-8, -4); g.lineTo(96, 2); g.lineTo(92, 10); g.quadraticCurveTo(40, 22, -6, 16); g.closePath(); g.fill();
      g.fillStyle = D.belly; g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(40, 18, 88, 8); g.lineTo(90, 11); g.quadraticCurveTo(40, 22, -2, 16); g.closePath(); g.fill();
      g.fillStyle = D.bone; for (let x = 18; x < 92; x += 9) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x + 3, -8 + (x % 2)); g.lineTo(x + 6, 2); g.closePath(); g.fill(); }
      g.restore();
      // the skull: long and wedge-shaped, with a heavy brow
      const skull = new Path2D();
      skull.moveTo(-48, -18); skull.quadraticCurveTo(-24, -36, 4, -30); skull.quadraticCurveTo(40, -22, 86, -8); skull.lineTo(88, 2); skull.lineTo(60, 6); skull.lineTo(-20, 8); skull.quadraticCurveTo(-46, 10, -48, -18); skull.closePath();
      const gr = g.createLinearGradient(0, -34, 0, 8); gr.addColorStop(0, D.mid); gr.addColorStop(1, D.base);
      g.fillStyle = gr; g.fill(skull);
      g.save(); g.clip(skull); scales(g, -50, -40, 90, 10, 9, 'rgba(10,3,2,0.35)'); g.restore();
      g.fillStyle = D.bone; for (let x = 14; x < 86; x += 9) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 3, 15 - (x % 3)); g.lineTo(x + 6, 4); g.closePath(); g.fill(); } // upper fangs
      g.fillStyle = D.dark; g.beginPath(); g.moveTo(-22, -26); g.quadraticCurveTo(-2, -36, 18, -24); g.lineTo(14, -20); g.quadraticCurveTo(-2, -28, -18, -20); g.closePath(); g.fill(); // brow ridge
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-14 + k * 10, -30); g.lineTo(-26 + k * 10, -46 + k * 4); g.lineTo(-6 + k * 10, -30); g.closePath(); g.fill(); }
      // the eye: molten amber with a slit pupil, glowing
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.drawImage(SPR.orange, -16, -36, 28, 28); g.restore();
      g.fillStyle = '#ffb83a'; g.beginPath(); g.ellipse(-2, -21, 7, 4, -0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff0b0'; g.beginPath(); g.ellipse(-3, -22, 3, 1.6, -0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#140500'; g.beginPath(); g.ellipse(-1, -21, 1.2, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a0302'; g.beginPath(); g.ellipse(76, -6, 4, 2, 0.2, 0, Math.PI * 2); g.fill(); // nostril
      g.restore();
    }

    // ---------- the knight ----------
    const KX = 1150, KS = 1.32;                               // feet position and size
    const SHIELD = {x:KX - 62 * KS, y:GROUND - 92 * KS, r:58 * KS};
    function drawKnight(g, t, brace, heat) {
      const crouch = brace * 12, lean = -brace * 0.08, push = brace * Math.sin(t * 40) * 1.5;
      g.save(); g.translate(KX + push, GROUND); g.scale(KS, KS);
      const steel = (y0, y1) => { const gr = g.createLinearGradient(-30, y0, 30, y1); gr.addColorStop(0, '#9ea8b6'); gr.addColorStop(0.45, '#5a6270'); gr.addColorStop(1, '#262a32'); return gr; };
      // cape billowing back in the blast
      const flap = Math.sin(t * 9) * (4 + brace * 10);
      g.fillStyle = '#5a0f12';
      g.beginPath(); g.moveTo(-6, -124 + crouch); g.quadraticCurveTo(40, -110 + flap, 70 + brace * 30, -70 + flap * 1.4); g.quadraticCurveTo(60, -30, 80 + brace * 26, -6 + flap * 0.6); g.lineTo(30, -10); g.quadraticCurveTo(14, -60, 8, -118 + crouch); g.closePath(); g.fill();
      g.fillStyle = '#7a1a1c'; g.beginPath(); g.moveTo(-2, -122 + crouch); g.quadraticCurveTo(30, -104 + flap, 48 + brace * 20, -66 + flap); g.lineTo(20, -60); g.closePath(); g.fill();
      g.rotate(lean);
      // legs in a braced stance: front leg forward and bent, back leg pushing
      g.fillStyle = steel(-60, 0);
      g.beginPath(); g.moveTo(-14, -62 + crouch); g.lineTo(-2, -60 + crouch); g.lineTo(-24, -26 + crouch * 0.5); g.lineTo(-30, -2); g.lineTo(-42, -2); g.lineTo(-36, -30 + crouch * 0.4); g.closePath(); g.fill();   // front leg
      g.beginPath(); g.moveTo(4, -62 + crouch); g.lineTo(18, -60 + crouch); g.lineTo(30, -26); g.lineTo(42, -2); g.lineTo(28, -2); g.lineTo(14, -28); g.closePath(); g.fill();                                        // back leg
      g.fillStyle = '#1e2128'; g.fillRect(-46, -6, 18, 6); g.fillRect(26, -6, 20, 6);                                                                                                                         // sabatons
      g.fillStyle = '#c8d0da'; g.fillRect(-33, -30 + crouch * 0.4, 8, 3); g.fillRect(16, -32, 8, 3);                                                                                                          // knee cops
      // torso: breastplate with a ridge, belt and tassets
      g.fillStyle = steel(-128, -60);
      g.beginPath(); g.moveTo(-16, -124 + crouch); g.lineTo(18, -124 + crouch); g.lineTo(20, -84 + crouch); g.lineTo(14, -62 + crouch); g.lineTo(-12, -62 + crouch); g.lineTo(-20, -86 + crouch); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(220,230,240,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-4, -122 + crouch); g.lineTo(-6, -70 + crouch); g.stroke();
      g.fillStyle = '#3a2416'; g.fillRect(-16, -70 + crouch, 32, 6); g.fillStyle = '#d4a840'; g.fillRect(-3, -70 + crouch, 6, 6);
      g.fillStyle = steel(-64, -48); g.fillRect(-16, -64 + crouch, 14, 12); g.fillRect(2, -64 + crouch, 14, 12);
      // sword arm, blade held low and back, gleaming
      g.save(); g.translate(14, -112 + crouch); g.rotate(0.9 - brace * 0.25);
      g.fillStyle = steel(0, 30); g.fillRect(-5, 0, 10, 34);
      g.fillStyle = '#3a2416'; g.fillRect(-3, 32, 6, 12);
      g.fillStyle = '#d4a840'; g.fillRect(-11, 42, 22, 4);
      const bl = g.createLinearGradient(-3, 46, 3, 46); bl.addColorStop(0, '#e8eef6'); bl.addColorStop(0.5, '#9aa4b2'); bl.addColorStop(1, '#5a6270');
      g.fillStyle = bl; g.beginPath(); g.moveTo(-3.5, 46); g.lineTo(3.5, 46); g.lineTo(2, 120); g.lineTo(0, 128); g.lineTo(-2, 120); g.closePath(); g.fill();
      g.restore();
      // helm: a great helm with a visor slit and a crest plume streaming back
      const hy = -150 + crouch;
      g.fillStyle = '#b01e22';
      g.beginPath(); g.moveTo(-4, hy - 4); g.quadraticCurveTo(30, hy - 30 + flap * 0.3, 70 + brace * 20, hy - 10 + flap * 0.6); g.quadraticCurveTo(36, hy - 8, 4, hy + 6); g.closePath(); g.fill();
      g.fillStyle = steel(hy, hy + 30); g.beginPath(); g.moveTo(-14, hy + 28); g.lineTo(-14, hy + 6); g.quadraticCurveTo(-12, hy - 6, 2, hy - 8); g.quadraticCurveTo(16, hy - 6, 16, hy + 6); g.lineTo(16, hy + 28); g.closePath(); g.fill();
      g.fillStyle = '#0a0b0e'; g.fillRect(-14, hy + 10, 18, 3); g.fillRect(-12, hy + 15, 3, 9);
      g.fillStyle = 'rgba(230,236,244,0.6)'; g.fillRect(-12, hy + 2, 2, 22);
      // shield arm and the shield itself, raised against the fire
      g.fillStyle = steel(-120, -90); g.save(); g.translate(-10, -116 + crouch); g.rotate(-0.9); g.fillRect(-5, 0, 10, 40); g.restore();
      g.save(); g.translate(-62, -92 + crouch * 0.6); g.rotate(-0.1);
      const shield = new Path2D(); shield.moveTo(-40, -56); shield.lineTo(40, -56); shield.quadraticCurveTo(44, 10, 0, 62); shield.quadraticCurveTo(-44, 10, -40, -56); shield.closePath();
      const sg = g.createLinearGradient(-40, -56, 40, 60); sg.addColorStop(0, '#c8d0dc'); sg.addColorStop(0.5, '#6a7482'); sg.addColorStop(1, '#2a2e36');
      g.fillStyle = sg; g.fill(shield);
      if (heat > 0) { // the steel glows red-hot where the fire hits
        g.save(); g.clip(shield); const hg = g.createRadialGradient(-10, -10, 0, -10, -10, 70);
        hg.addColorStop(0, `rgba(255,170,60,${0.8 * heat})`); hg.addColorStop(0.5, `rgba(220,60,10,${0.55 * heat})`); hg.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = hg; g.fillRect(-50, -60, 100, 130); g.restore();
      }
      g.strokeStyle = '#d4a840'; g.lineWidth = 5; g.stroke(shield);
      g.fillStyle = '#d4a840'; g.fillRect(-4, -44, 8, 84); g.fillRect(-26, -16, 52, 8); // a gold cross
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-34, -50); g.lineTo(-30, 0); g.stroke();
      g.restore();
      g.restore();
    }

    // ---------- fire, smoke and embers ----------
    const flames = [], smoke = [], embers = [], burns = [];
    let emitAcc = 0;
    function emit(dt, t, P) {
      const m = mouthOf(P);
      const aim = Math.atan2(SHIELD.y - 10 - m.y, SHIELD.x - m.x) + Math.sin(t * 6) * 0.05;
      emitAcc += dt * (reduceMotion ? 500 : 1150);
      while (emitAcc >= 1) {
        emitAcc--;
        const a = aim + (Math.random() - 0.5) * 0.2, sp = 700 + Math.random() * 340;
        flames.push({x:m.x + (Math.random() - 0.5) * 8, y:m.y + (Math.random() - 0.5) * 8, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, age:0, life:0.5 + Math.random() * 0.4,
          s:7 + Math.random() * 9, hit:false, ph:Math.random() * 6.3, tw:160 + Math.random() * 260, nx:-Math.sin(a), ny:Math.cos(a)});
      }
    }
    function step(dt, t, P) {
      if (t >= T_BREATH && t < T_BREATH_END) emit(dt, t, P);
      else if (t > T_INHALE - 0.3 && t < T_BREATH && Math.random() < dt * 14) { // smoke curling from the nostrils as it inhales
        const n = {x:P.hx + Math.cos(P.a) * 76 - Math.sin(P.a) * -6, y:P.hy + Math.sin(P.a) * 76 + Math.cos(P.a) * -6};
        smoke.push({x:n.x, y:n.y, vx:20 + Math.random() * 30, vy:-30 - Math.random() * 30, age:0, life:1.2, s:10});
      }
      const drag = Math.pow(0.18, dt);
      for (const f of flames) {
        f.age += dt; f.vx *= drag; f.vy = f.vy * drag - 140 * dt;
        // turbulence: each flame swirls side to side across the stream, more as it slows
        const sw = Math.sin(f.age * 22 + f.ph) * f.tw * (0.3 + f.age * 2) * dt;
        f.x += f.vx * dt + f.nx * sw; f.y += f.vy * dt + f.ny * sw;
        // the shield: flames splash off it and roll up and around the edges
        const dx = f.x - SHIELD.x, dy = f.y - SHIELD.y, d = Math.hypot(dx, dy);
        if (d < SHIELD.r && !f.hit) {
          f.hit = true; const nx = dx / d, ny = dy / d, dot = f.vx * nx + f.vy * ny;
          f.vx = (f.vx - 1.7 * dot * nx) * 0.42 + (Math.random() - 0.5) * 160; f.vy = (f.vy - 1.7 * dot * ny) * 0.42 - 120 - Math.random() * 120;
          f.x = SHIELD.x + nx * SHIELD.r; f.y = SHIELD.y + ny * SHIELD.r; f.life = Math.max(f.life, f.age + 0.45); f.s *= 1.3;
          // flames curl over and under the rim of the shield and wash past the knight
          if (Math.random() < 0.5) { const up = Math.random() < 0.6 ? -1 : 1; flames.push({x:f.x, y:f.y + up * SHIELD.r * 0.6, vx:80 + Math.random() * 160, vy:up * (160 + Math.random() * 160), age:f.age, life:f.age + 0.4 + Math.random() * 0.3, s:f.s * 0.9, hit:true, ph:Math.random() * 6, tw:200, nx:0, ny:1}); }
          if (Math.random() < 0.12) embers.push({x:f.x, y:f.y, vx:(Math.random() - 0.7) * 260, vy:-80 - Math.random() * 260, age:0, life:1 + Math.random() * 1.4});
        }
        if (f.y > GROUND - 6) { f.y = GROUND - 6; f.vy *= -0.15; f.vx *= 0.6; if (Math.random() < 0.02 && burns.length < 70) burns.push({x:f.x, y:GROUND - 2, age:0, s:16 + Math.random() * 22, seed:Math.random() * 10}); }
        if (f.age > f.life && Math.random() < 0.35) smoke.push({x:f.x, y:f.y, vx:f.vx * 0.2, vy:-40 - Math.random() * 40, age:0, life:1.4 + Math.random() * 1.2, s:f.s * 2});
      }
      for (let i = flames.length - 1; i >= 0; i--) if (flames[i].age > flames[i].life) flames.splice(i, 1);
      for (const s of smoke) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy -= 10 * dt; s.vx += 12 * dt; }
      for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].age > smoke[i].life) smoke.splice(i, 1);
      for (const e of embers) { e.age += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vy -= 30 * dt; e.vx += Math.sin(t * 3 + e.life * 9) * 40 * dt; }
      for (let i = embers.length - 1; i >= 0; i--) if (embers[i].age > embers[i].life) embers.splice(i, 1);
      for (const b of burns) b.age += dt;
      if (smoke.length > 500) smoke.splice(0, smoke.length - 500);
    }
    function drawFire(g, t) {
      g.globalCompositeOperation = 'source-over';
      for (const s of smoke) { const k = s.age / s.life, r = s.s * (1 + k * 2.5); g.globalAlpha = 0.5 * (1 - k); g.drawImage(SPR.smoke, s.x - r, s.y - r, r * 2, r * 2); }
      g.globalCompositeOperation = 'lighter';
      for (const b of burns) { const fade = 1 - seg(t, 4.2, 5), fl = 0.6 + 0.4 * Math.sin(t * 17 + b.seed * 5); const r = b.s * fl; g.globalAlpha = 0.5 * fade * Math.min(1, b.age * 3); g.drawImage(SPR.orange, b.x - r, b.y - r * 1.6, r * 2, r * 2); g.globalAlpha = 0.6 * fade * Math.min(1, b.age * 3); g.drawImage(SPR.yellow, b.x - r * 0.5, b.y - r * 1.1, r, r); }
      // dark smoke-red edges first, so the stream has body, then the glowing flames over it
      g.globalCompositeOperation = 'source-over';
      for (const f of flames) { const k = f.age / f.life; if (k < 0.45) continue; const r = f.s * (0.8 + k * 3.2); g.globalAlpha = 0.22 * (1 - k); g.drawImage(SPR.smoke, f.x - r, f.y - r * 1.2, r * 2, r * 2); }
      g.globalCompositeOperation = 'lighter';
      for (const f of flames) {
        const k = f.age / f.life, r = f.s * (0.5 + k * 3);
        const spr = k < 0.05 ? SPR.white : k < 0.3 ? SPR.yellow : k < 0.62 ? SPR.orange : SPR.red;
        g.globalAlpha = (k < 0.62 ? 0.42 : 0.42 * (1 - (k - 0.62) / 0.38)) * (k < 0.05 ? 0.6 : 1);
        g.drawImage(spr, f.x - r, f.y - r, r * 2, r * 2);
      }
      for (const e of embers) { const k = e.age / e.life; g.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(t * 30 + e.life * 50)); g.drawImage(SPR.ember, e.x - 4, e.y - 4, 8, 8); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }

    // ---------- one frame ----------
    let bolt = null;
    function lightning(t) { // big flash at the start, a smaller one late
      const flash = Math.max(0, 1 - Math.abs(t - 0.28) / 0.08) * 0.9 + Math.max(0, 1 - Math.abs(t - 0.46) / 0.05) * 0.5 + Math.max(0, 1 - Math.abs(t - 4.35) / 0.06) * 0.35;
      if (!bolt) { const r = rng(42); bolt = [[1010, -10]]; let x = 1010, y = -10; while (y < 560) { x += (r() - 0.5) * 70; y += 30 + r() * 40; bolt.push([x, y]); } }
      return flash;
    }
    function render(t, dt) {
      const P = pose(t);
      const fireI = seg(t, T_BREATH, T_BREATH + 0.15) * (1 - seg(t, T_BREATH_END, T_BREATH_END + 0.7));
      const flick = 0.82 + 0.18 * Math.sin(t * 31) * Math.sin(t * 17.3);
      const flash = lightning(t);
      const brace = seg(t, 1.0, 1.5) * (1 - seg(t, T_BREATH_END + 0.2, T_BREATH_END + 1.0) * 0.7);
      // camera: a slow push in, and a rumble while the fire pours
      const zoom = 1 + 0.06 * seg(t, 0, DURATION), shake = reduceMotion ? 0 : fireI * 5 + (t < 0.4 ? flash * 3 : 0);
      const camX = (Math.random() - 0.5) * shake, camY = (Math.random() - 0.5) * shake;
      const setStage = g => g.setTransform(S * zoom, 0, 0, S * zoom, OX - (W * S * (zoom - 1)) / 2 + camX * S, OY - (H * S * (zoom - 1)) / 2 + camY * S);
      setStage(ctx);
      ctx.drawImage(backdrop, 0, 0);
      // drifting storm clouds
      const cx = -((t * 26) % 1000);
      ctx.globalAlpha = 0.9; ctx.drawImage(clouds, cx - 200, -30); ctx.globalAlpha = 1;
      // lightning bolt
      if (flash > 0.05 && bolt) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(200,210,255,${flash})`; ctx.lineWidth = 3; ctx.shadowColor = '#b8c8ff'; ctx.shadowBlur = 25;
        ctx.beginPath(); bolt.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
      }
      // castle windows flickering
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[1300, 500], [1312, 540], [1366, 530], [1400, 520], [1440, 490], [1444, 540], [1480, 530], [1388, 460]]) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 7 + x); ctx.drawImage(SPR.orange, x - 7, y - 7, 14, 14); }
      ctx.restore();
      // the dragon and the knight, each lit by the fire (drawn on their own layer, then tinted)
      const litLayer = (draw, lights) => {
        octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, off.width, off.height); setStage(octx);
        draw(octx);
        octx.globalCompositeOperation = 'source-atop';
        for (const L of lights) { if (L.a <= 0.01) continue; const gr = octx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r); gr.addColorStop(0, `rgba(${L.c},${L.a})`); gr.addColorStop(1, `rgba(${L.c},0)`); octx.fillStyle = gr; octx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2); }
        octx.globalCompositeOperation = 'source-over';
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); setStage(ctx);
      };
      const m = mouthOf(P);
      // shadow on the far sides first (for a rounded, solid look), then the fire light on the near sides
      litLayer(g => drawDragon(g, t, P), [
        {x:150, y:560, r:330, c:'5,2,2', a:0.6},
        {x:300, y:250, r:260, c:'5,2,2', a:0.35},
        {x:m.x + 60, y:m.y + 30, r:230, c:'255,140,40', a:0.45 * fireI * flick + 0.25 * P.glow},
        {x:m.x + 260, y:m.y + 140, r:520, c:'255,120,40', a:0.2 * fireI * flick},
        {x:900, y:-100, r:900, c:'190,200,255', a:0.35 * flash}]);
      litLayer(g => drawKnight(g, t, brace, fireI * flick), [
        {x:KX + 60, y:GROUND - 120, r:170, c:'5,4,6', a:0.55},
        {x:SHIELD.x - 30, y:SHIELD.y, r:150, c:'255,150,50', a:0.45 * fireI * flick},
        {x:KX, y:GROUND - 230, r:160, c:'255,130,40', a:0.25 * fireI * flick},
        {x:900, y:-100, r:1100, c:'190,200,255', a:0.3 * flash}]);
      drawFire(ctx, t);
      // the fire lights up the whole scene
      if (fireI > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const glow = (x, y, r, c, a) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
        glow(SHIELD.x, SHIELD.y, 460, '255,100,25', 0.2 * fireI * flick);
        glow((m.x + SHIELD.x) / 2, (m.y + SHIELD.y) / 2, 380, '255,120,40', 0.1 * fireI * flick);
        glow(SHIELD.x + 40, GROUND, 320, '255,90,20', 0.18 * fireI * flick);
        ctx.restore();
      }
      if (P.glow > 0 && t < T_BREATH) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * P.glow; ctx.drawImage(SPR.orange, m.x - 70, m.y - 70, 140, 140); ctx.restore(); }
      // screen-wide: lightning flash, film grain, fade in and out
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (flash > 0.02) { ctx.fillStyle = `rgba(200,210,255,${flash * 0.35})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
      const gx = Math.floor(Math.random() * 256), gy = Math.floor(Math.random() * 256);
      for (let y = -gy; y < canvas.height; y += 256) for (let x = -gx; x < canvas.width; x += 256) ctx.drawImage(grain, x, y);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const fade = Math.max(1 - t / 0.35, seg(t, DURATION - 0.35, DURATION));
      if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }

    // ---------- running it ----------
    let finished = false, animId = 0, start = null, lastT = 0;
    function end() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(animId);
      screen.classList.add('fade-out');
      setTimeout(() => {
        screen.hidden = true; screen.style.display = 'none';
        window.removeEventListener('resize', resize);
        const titleCard = document.getElementById('title'); if (titleCard && titleCard.focus) titleCard.focus();
      }, 750);
    }
    if (skip) skip.onclick = e => { e.preventDefault(); e.stopPropagation(); end(); };
    window.addEventListener('keydown', function onKey(e) {
      if (finished) { window.removeEventListener('keydown', onKey); return; }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); end(); }
    });
    function tick(ts) {
      if (finished) return;
      if (start == null) start = ts;
      const t = Math.min(DURATION, (ts - start) / 1000), dt = Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      try { step(dt, t, pose(t)); render(t, dt); } catch (err) { console.error(err); end(); return; }
      if (bar) bar.style.width = (t / DURATION * 100).toFixed(1) + '%';
      if (timer) { const left = DURATION - t; timer.textContent = left <= 0.2 ? 'READY' : Math.ceil(left) + 's'; if (left <= 0.2) timer.style.color = '#7bd34a'; }
      if (status) { let line = LORE[0].text; for (const l of LORE) if (t >= l.at) line = l.text; if (status.textContent !== line) status.textContent = line; }
      if (t >= DURATION) { end(); return; }
      animId = requestAnimationFrame(tick);
    }
    // for testing: draw any moment of the opening (window.dragonholdIntro.frame(2.4))
    window.dragonholdIntro = {frame(t) { flames.length = smoke.length = embers.length = burns.length = 0; let tt = 0; while (tt < t) { const d = Math.min(1 / 60, t - tt); tt += d; step(d, tt, pose(tt)); } render(t, 0); }, end, pause() { finished = true; cancelAnimationFrame(animId); }};
    animId = requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
