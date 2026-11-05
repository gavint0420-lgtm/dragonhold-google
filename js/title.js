'use strict';
// ===== Title screen: a knight facing Aurex the Gilded Wyrm under the moon =====
// Everything is drawn with canvas paths (no images). The sky, moon, mountains and castle are
// cached per screen size; the knight, dragon, fog and embers animate every frame.
const drawTitleScene = (function () {
  let bg = null, bgW = 0, bgH = 0;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- small geometry helpers ----------
  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  function normals(pts) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
  }
  // A limb/tail/neck: a filled band along a centre line that narrows from w0 to w1.
  // Leaves the outline as the current path so the caller can stroke a highlight.
  function band(g, pts, w0, w1, fill) {
    const ns = normals(pts), n = pts.length;
    g.beginPath();
    for (let i = 0; i < n; i++) { const w = (w0 + (w1 - w0) * i / (n - 1)) / 2; g.lineTo(pts[i][0] + ns[i][0] * w, pts[i][1] + ns[i][1] * w); }
    for (let i = n - 1; i >= 0; i--) { const w = (w0 + (w1 - w0) * i / (n - 1)) / 2; g.lineTo(pts[i][0] - ns[i][0] * w, pts[i][1] - ns[i][1] * w); }
    g.closePath();
    g.fillStyle = fill; g.fill();
    return ns;
  }
  // Spikes along one edge of a band (side = +1 or -1).
  function spikes(g, pts, ns, side, w0, w1, h0, h1, step, col) {
    g.fillStyle = col;
    for (let i = 1; i < pts.length - 1; i += step) {
      const k = i / (pts.length - 1), w = (w0 + (w1 - w0) * k) / 2, h = h0 + (h1 - h0) * k;
      const p = pts[i], q = pts[i + 1], nn = ns[i];
      const tx = q[0] - p[0], ty = q[1] - p[1], tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
      const bx = p[0] + nn[0] * w * side, by = p[1] + nn[1] * w * side;
      g.beginPath();
      g.moveTo(bx - ux * h * 0.45, by - uy * h * 0.45);
      g.lineTo(bx + nn[0] * h * side + ux * h * 0.35, by + nn[1] * h * side + uy * h * 0.35);
      g.lineTo(bx + ux * h * 0.45, by + uy * h * 0.45);
      g.closePath(); g.fill();
    }
  }
  // Belly plates: short light bars across a band on one side.
  function plates(g, pts, ns, side, w0, w1, step, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    for (let i = 1; i < pts.length - 1; i += step) {
      const k = i / (pts.length - 1), w = (w0 + (w1 - w0) * k) / 2, p = pts[i], nn = ns[i];
      g.lineWidth = Math.max(1.5, w * 0.16);
      g.beginPath();
      g.moveTo(p[0] + nn[0] * w * side * 0.15, p[1] + nn[1] * w * side * 0.15);
      g.lineTo(p[0] + nn[0] * w * side * 0.92, p[1] + nn[1] * w * side * 0.92);
      g.stroke();
    }
  }
  function lin(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  function rad(g, x, y, r0, r1, stops) {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }

  // ---------- background (cached) ----------
  function ridge(g, W, H, base, amp, col, seed, freq) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 6) {
      const n = fbm2(x * freq, seed * 0.37, seed * 31, 5);
      g.lineTo(x, base - (n - 0.35) * amp * 2.4);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
  }
  function castle(g, cx, base, k) {
    g.save(); g.translate(cx, base); g.scale(k, k);
    const dark = '#140b16';
    g.fillStyle = dark;
    const tower = (x, w, h, roof) => {
      g.fillRect(x - w / 2, -h, w, h);
      if (roof) { g.beginPath(); g.moveTo(x - w / 2 - 7, -h); g.lineTo(x, -h - w * 1.5); g.lineTo(x + w / 2 + 7, -h); g.closePath(); g.fill(); }
      else for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + i * w / 3.5, -h - 12, w / 7, 12);
    };
    g.fillRect(-270, -95, 540, 95);
    for (let x = -270; x < 270; x += 22) g.fillRect(x, -108, 13, 13);
    g.fillRect(-120, -180, 240, 180);
    for (let x = -120; x < 120; x += 20) g.fillRect(x, -194, 12, 14);
    tower(-270, 40, 170, false); tower(270, 40, 170, false);
    tower(-150, 46, 240, true); tower(150, 46, 240, true);
    tower(-62, 30, 225, true); tower(62, 30, 225, true);
    tower(0, 60, 310, true);
    g.fillRect(-2, -420, 4, 45); // banner pole
    g.fillStyle = '#5a1418'; g.beginPath(); g.moveTo(2, -418); g.lineTo(40, -410); g.lineTo(2, -398); g.closePath(); g.fill();
    // lit windows
    g.shadowColor = '#ffae42'; g.shadowBlur = 10; g.fillStyle = '#ffb347';
    const win = (x, y, w, h) => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.fill(); };
    win(-6, -250, 12, 22); win(-157, -190, 10, 18); win(147, -190, 10, 18); win(-68, -170, 8, 14); win(60, -170, 8, 14);
    win(-80, -120, 9, 15); win(-30, -130, 9, 15); win(22, -130, 9, 15); win(70, -120, 9, 15);
    g.fillStyle = '#ff9a2a'; win(-22, -70, 44, 70); // great gate glowing
    g.restore();
  }
  function buildBackground(W, H) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(W * DPR)); c.height = Math.max(1, Math.ceil(H * DPR));
    const g = c.getContext('2d'); g.scale(DPR, DPR);
    g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#07061a'], [0.3, '#191035'], [0.55, '#43203d'], [0.72, '#8c3b2a'], [0.86, '#3a1712'], [1, '#120808']]);
    g.fillRect(0, 0, W, H);
    // stars
    for (let i = 0; i < 260; i++) {
      const x = hash2(i, 3, 41) * W, y = Math.pow(hash2(i, 4, 41), 1.6) * H * 0.6, s = 0.5 + hash2(i, 5, 41) * 1.3;
      g.globalAlpha = 0.25 + hash2(i, 6, 41) * 0.7; g.fillStyle = hash2(i, 7, 41) < 0.15 ? '#ffd9a8' : '#e8ecff';
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // moon
    const mx = W * 0.36, my = H * 0.2, mr = Math.min(W, H) * 0.075;
    g.fillStyle = rad(g, mx, my, mr * 0.8, mr * 6, [[0, 'rgba(255,232,190,0.28)'], [0.35, 'rgba(255,200,160,0.08)'], [1, 'rgba(255,200,160,0)']]);
    g.fillRect(0, 0, W, H);
    g.fillStyle = rad(g, mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mr, [[0, '#fff8e6'], [0.7, '#f1dfb6'], [1, '#d9c08e']]);
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(170,140,100,0.25)';
    [[0.3, -0.2, 0.18], [-0.35, 0.25, 0.12], [0.1, 0.4, 0.1], [-0.2, -0.4, 0.08]].forEach(([a, b, r]) => { g.beginPath(); g.arc(mx + a * mr, my + b * mr, r * mr, 0, Math.PI * 2); g.fill(); });
    // long thin clouds across the moon
    g.save(); g.filter = 'blur(7px)';
    for (let i = 0; i < 6; i++) {
      const cy = H * (0.15 + i * 0.05), cx = W * (0.15 + hash2(i, 9, 3) * 0.7), cw = W * (0.14 + hash2(i, 10, 3) * 0.16);
      g.fillStyle = `rgba(36,20,46,${0.35 + hash2(i, 12, 3) * 0.25})`;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + (k - 1.5) * cw * 0.45, cy + Math.sin(k * 2 + i) * 4, cw * 0.4, H * 0.014 + hash2(i + k, 11, 3) * H * 0.012, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    // far mountains, then near hills
    ridge(g, W, H, H * 0.6, H * 0.14, '#2c1733', 2, 0.0035);
    ridge(g, W, H, H * 0.66, H * 0.1, '#20112a', 6, 0.005);
    // the castle on the horizon, lit from inside
    castle(g, W * 0.52, H * 0.7, Math.min(W / 1500, H / 900) * 0.62);
    ridge(g, W, H, H * 0.74, H * 0.06, '#150b18', 9, 0.007);
    // a hot glow from the dragon's side of the valley
    g.fillStyle = rad(g, W * 0.82, H * 0.82, 0, W * 0.45, [[0, 'rgba(255,120,40,0.28)'], [1, 'rgba(255,120,40,0)']]);
    g.fillRect(0, 0, W, H);
    return c;
  }

  // ---------- rocks the heroes stand on ----------
  function crag(g, pts, light) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = lin(g, 0, -40, 0, 420, [[0, '#3a2c38'], [0.4, '#1d1520'], [1, '#09060b']]); g.fill();
    // top-edge light
    g.strokeStyle = light; g.lineWidth = 3; g.lineJoin = 'round';
    g.beginPath(); for (let i = 0; i < pts.length; i++) { if (pts[i][1] > 60) break; i === 0 ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1]); } g.stroke();
    // cracks
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const x = pts[1][0] + (pts[pts.length - 3][0] - pts[1][0]) * (i + 0.5) / 6; g.beginPath(); g.moveTo(x, 20 + i * 7); g.lineTo(x + 14, 70 + i * 9); g.lineTo(x + 4, 130); g.stroke(); }
  }

  // ---------- the knight (faces right, origin at feet) ----------
  function steel(g, x0, y0, x1, y1) { return lin(g, x0, y0, x1, y1, [[0, '#f4f7fb'], [0.45, '#a9b3c3'], [1, '#4a5262']]); }
  function knight(g, t) {
    const w = Math.sin(t * 1.7), w2 = Math.sin(t * 2.3 + 1);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // cape streaming back in the wind
    g.beginPath(); g.moveTo(-14, -206);
    g.bezierCurveTo(-60, -196 + w * 4, -112, -158 + w * 10, -150 + w * 12, -72 + w2 * 6);
    g.quadraticCurveTo(-118 + w * 6, -46, -76, -34 + w2 * 3);
    g.quadraticCurveTo(-44, -60, -8, -122);
    g.closePath();
    g.fillStyle = lin(g, -150, -200, -20, -40, [[0, '#4a0b12'], [0.5, '#9e1f29'], [1, '#c8323a']]); g.fill();
    g.strokeStyle = 'rgba(40,0,6,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-30, -190); g.quadraticCurveTo(-80, -140 + w * 6, -110 + w * 8, -64); g.stroke();
    g.beginPath(); g.moveTo(-22, -160); g.quadraticCurveTo(-56, -110 + w * 4, -70, -44); g.stroke();
    // back leg
    let pts = bez([-8, -118], [-20, -92], [-30, -62], [-36, -10], 10);
    band(g, pts, 26, 18, steel(g, -50, -120, -10, -10));
    g.fillStyle = steel(g, -36, -78, -16, -56); g.beginPath(); g.arc(-27, -66, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d4452'; g.beginPath(); g.moveTo(-54, 0); g.lineTo(-48, -16); g.lineTo(-26, -16); g.lineTo(-18, 0); g.closePath(); g.fill();
    // back arm raising the sword
    g.save();
    pts = bez([-14, -194], [-30, -206], [-42, -222], [-38, -236], 8); band(g, pts, 20, 16, steel(g, -50, -240, -10, -190));
    pts = bez([-38, -236], [-34, -250], [-26, -262], [-18, -268], 8); band(g, pts, 16, 14, steel(g, -40, -270, -10, -230));
    // sword
    g.translate(-18, -268); g.rotate(-1.08 + Math.sin(t * 0.8) * 0.03);
    g.fillStyle = '#5a3418'; g.fillRect(-26, -4, 26, 8);
    g.fillStyle = '#e3b341'; g.beginPath(); g.arc(-30, 0, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = lin(g, 0, -20, 0, 20, [[0, '#ffe08a'], [1, '#a8781c']]);
    g.beginPath(); g.moveTo(-2, -20); g.quadraticCurveTo(4, -22, 6, -16); g.lineTo(6, 16); g.quadraticCurveTo(4, 22, -2, 20); g.closePath(); g.fill();
    g.fillStyle = lin(g, 0, -6, 0, 6, [[0, '#7d899b'], [0.45, '#ffffff'], [0.55, '#dfe6ef'], [1, '#6c7788']]);
    g.beginPath(); g.moveTo(6, -6); g.lineTo(168, -4); g.lineTo(188, 0); g.lineTo(168, 4); g.lineTo(6, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,90,110,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(10, 0); g.lineTo(150, 0); g.stroke();
    // a glint that runs up the blade, and a star at the tip
    const gx = 20 + ((t * 0.45) % 1) * 170;
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(gx, 0, 12, 2.4, 0, 0, Math.PI * 2); g.fill();
    const tw = 0.6 + 0.4 * Math.sin(t * 3);
    g.fillStyle = `rgba(255,250,230,${0.85 * tw})`;
    g.beginPath(); g.moveTo(188, -16 * tw); g.lineTo(191, -3); g.lineTo(204 * (0.95 + 0.05 * tw), 0); g.lineTo(191, 3); g.lineTo(188, 16 * tw); g.lineTo(185, 3); g.lineTo(172, 0); g.lineTo(185, -3); g.closePath(); g.fill();
    g.restore();
    // front leg
    pts = bez([12, -118], [26, -92], [34, -62], [42, -10], 10);
    band(g, pts, 26, 18, steel(g, 10, -120, 50, -10));
    g.fillStyle = steel(g, 22, -80, 44, -56); g.beginPath(); g.arc(33, -67, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4b5363'; g.beginPath(); g.moveTo(28, 0); g.lineTo(32, -16); g.lineTo(52, -16); g.lineTo(62, 0); g.closePath(); g.fill();
    // tassets
    g.fillStyle = steel(g, -24, -112, 24, -96);
    for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(-24, -114 + i * 9); g.quadraticCurveTo(0, -106 + i * 9, 24, -114 + i * 9); g.lineTo(23, -104 + i * 9); g.quadraticCurveTo(0, -96 + i * 9, -23, -104 + i * 9); g.closePath(); g.fill(); }
    // breastplate
    g.beginPath(); g.moveTo(-24, -204); g.quadraticCurveTo(0, -214, 26, -204); g.lineTo(22, -150); g.quadraticCurveTo(20, -118, 0, -114); g.quadraticCurveTo(-20, -118, -22, -150); g.closePath();
    g.fillStyle = rad(g, 10, -184, 2, 50, [[0, '#ffffff'], [0.35, '#c9d1dd'], [1, '#535c6c']]); g.fill();
    g.strokeStyle = 'rgba(255,170,90,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(26, -204); g.lineTo(22, -150); g.quadraticCurveTo(20, -118, 0, -114); g.stroke();
    // tabard with the royal crest
    g.beginPath(); g.moveTo(-18, -168); g.lineTo(18, -168); g.lineTo(22, -84); g.lineTo(8, -78); g.lineTo(0, -88); g.lineTo(-8, -78); g.lineTo(-22, -84); g.closePath();
    g.fillStyle = lin(g, -20, -168, 20, -80, [[0, '#2f56b8'], [1, '#172d6b']]); g.fill();
    g.strokeStyle = '#e3b341'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#f2c94c';
    g.beginPath(); g.moveTo(-9, -142); g.lineTo(-9, -132); g.lineTo(9, -132); g.lineTo(9, -142); g.lineTo(4.5, -137); g.lineTo(0, -146); g.lineTo(-4.5, -137); g.closePath(); g.fill(); // crown
    g.fillRect(-8, -130, 16, 3);
    // belt
    g.fillStyle = '#5a3418'; g.fillRect(-23, -122, 46, 8);
    g.fillStyle = '#e3b341'; g.fillRect(-4, -123, 8, 10); g.fillStyle = '#5a3418'; g.fillRect(-1.5, -120, 3, 4);
    // pauldrons
    g.fillStyle = steel(g, -30, -214, -4, -184);
    g.beginPath(); g.ellipse(-18, -198, 13, 10, -0.3, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = steel(g, 8, -214 + i * 7, 36, -192 + i * 7); g.beginPath(); g.ellipse(22, -202 + i * 7, 15 - i * 2, 8, 0.25, Math.PI, Math.PI * 2.05); g.fill(); }
    // great helm
    g.beginPath(); g.moveTo(-15, -212); g.lineTo(-17, -248); g.quadraticCurveTo(-14, -270, 2, -272); g.quadraticCurveTo(19, -270, 19, -248); g.lineTo(20, -214); g.quadraticCurveTo(3, -207, -15, -212); g.closePath();
    g.fillStyle = rad(g, 8, -252, 2, 30, [[0, '#ffffff'], [0.4, '#c6cfdb'], [1, '#4c5565']]); g.fill();
    g.strokeStyle = 'rgba(255,170,90,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(19, -250); g.lineTo(20, -214); g.stroke();
    g.fillStyle = '#e3b341'; g.fillRect(-16, -263, 35, 3.5);
    g.fillStyle = '#0d0f16'; g.fillRect(3, -247, 17, 3.2); g.fillRect(3, -240, 16, 2.6);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.arc(9 + i * 4, -228 + j * 5, 1, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(30,34,44,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(9, -270); g.lineTo(11, -214); g.stroke();
    // plume
    pts = bez([0, -270], [-18, -296], [-58, -292 + w * 6], [-92 + w * 8, -266 + w2 * 5], 14);
    band(g, pts, 16, 3, lin(g, -90, -290, 0, -268, [[0, '#7a0f18'], [1, '#d8323a']]));
    pts = bez([-2, -268], [-24, -284], [-50, -276 + w2 * 4], [-76 + w2 * 6, -252], 12);
    band(g, pts, 10, 2, '#b3242c');
    // front arm and shield
    pts = bez([20, -194], [30, -182], [36, -170], [42, -156], 8); band(g, pts, 18, 15, steel(g, 14, -196, 48, -150));
    g.save(); g.translate(56, -158); g.rotate(-0.08);
    g.beginPath(); g.moveTo(-30, -44); g.quadraticCurveTo(0, -50, 30, -44); g.lineTo(30, 0); g.quadraticCurveTo(28, 32, 0, 48); g.quadraticCurveTo(-28, 32, -30, 0); g.closePath();
    g.fillStyle = lin(g, -30, -44, 30, 48, [[0, '#3d68d0'], [0.6, '#1f3f96'], [1, '#132659']]); g.fill();
    g.strokeStyle = '#e3b341'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = 'rgba(255,170,90,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(31, -42); g.lineTo(31, 0); g.quadraticCurveTo(29, 33, 1, 49); g.stroke();
    // shield crest: a gold dragon-slayer sword over a chevron
    g.fillStyle = '#f2c94c';
    g.beginPath(); g.moveTo(-22, 8); g.lineTo(0, -12); g.lineTo(22, 8); g.lineTo(22, 16); g.lineTo(0, -4); g.lineTo(-22, 16); g.closePath(); g.fill();
    g.fillRect(-2, -34, 4, 62); g.fillRect(-9, -26, 18, 4);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(-26, -40); g.quadraticCurveTo(-8, -44, 4, -42); g.lineTo(-20, 20); g.quadraticCurveTo(-26, 4, -26, -40); g.fill();
    g.restore();
  }

  // ---------- the dragon (faces left, origin at its hind feet) ----------
  const GOLD = (g, x0, y0, x1, y1) => lin(g, x0, y0, x1, y1, [[0, '#ffe9a0'], [0.35, '#e8b444'], [0.75, '#a8681a'], [1, '#5e370c']]);
  function wing(g, sh, el, wr, tips, attach, memA, memB, bone) {
    g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(el[0], el[1]); g.lineTo(wr[0], wr[1]); g.lineTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) {
      const a = tips[i - 1], b = tips[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      g.quadraticCurveTo(mx + (wr[0] - mx) * 0.3, my + (wr[1] - my) * 0.3, b[0], b[1]);
    }
    const last = tips[tips.length - 1], mx = (last[0] + attach[0]) / 2, my = (last[1] + attach[1]) / 2;
    g.quadraticCurveTo(mx + (wr[0] - mx) * 0.25, my + (wr[1] - my) * 0.25, attach[0], attach[1]);
    g.closePath();
    g.fillStyle = lin(g, wr[0], wr[1], attach[0], attach[1], [[0, memA], [1, memB]]); g.fill();
    // veins and finger bones
    g.strokeStyle = bone; g.lineCap = 'round';
    g.lineWidth = 12; g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(el[0], el[1]); g.stroke();
    g.lineWidth = 9; g.beginPath(); g.moveTo(el[0], el[1]); g.lineTo(wr[0], wr[1]); g.stroke();
    for (const tp of tips) {
      g.lineWidth = 4.5; g.beginPath(); g.moveTo(wr[0], wr[1]);
      g.quadraticCurveTo((wr[0] + tp[0]) / 2 + (tp[1] - wr[1]) * 0.06, (wr[1] + tp[1]) / 2 - (tp[0] - wr[0]) * 0.06, tp[0], tp[1]); g.stroke();
    }
    g.fillStyle = '#f3ead2'; g.beginPath(); g.moveTo(wr[0] - 6, wr[1]); g.quadraticCurveTo(wr[0] - 10, wr[1] - 22, wr[0] - 24, wr[1] - 26); g.quadraticCurveTo(wr[0] - 6, wr[1] - 16, wr[0] + 5, wr[1] - 2); g.closePath(); g.fill();
  }
  function claw(g, x, y, a, len) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = lin(g, 0, 0, len, 0, [[0, '#d8ccb0'], [1, '#fffaf0']]);
    g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(len * 0.7, -6, len, 4); g.quadraticCurveTo(len * 0.6, 1, 0, 4); g.closePath(); g.fill();
    g.restore();
  }
  function dragon(g, t) {
    const b = Math.sin(t * 1.3), f = Math.sin(t * 0.9);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // far wing, in shadow
    wing(g, [20, -330], [150, -500 + f * 20], [70, -640 + f * 30],
      [[-70, -690 + f * 30], [120, -720 + f * 35], [290, -640 + f * 30], [360, -500 + f * 20], [320, -380 + f * 10]], [120, -240],
      'rgba(120,70,22,0.96)', 'rgba(50,26,8,0.96)', '#3e2409');
    // tail draped over the rock and curling up
    let pts = bez([70, -150], [230, -175], [345, -75], [292, 8], 22).concat(bez([292, 8], [252, 70], [392, 95], [432, 28], 16).slice(1));
    let ns = band(g, pts, 64, 6, GOLD(g, 60, -180, 440, 90));
    g.strokeStyle = 'rgba(255,236,180,0.35)'; g.lineWidth = 2; g.stroke();
    spikes(g, pts, ns, -1, 64, 6, 18, 5, 3, '#7a4a12');
    g.save(); g.translate(432, 28); g.rotate(-0.9);
    g.fillStyle = '#8a5214'; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, -14); g.lineTo(40, 0); g.lineTo(22, 14); g.closePath(); g.fill();
    g.restore();
    // far front arm
    pts = bez([-20, -300], [-40, -280], [-60, -262], [-80, -258], 8); band(g, pts, 34, 24, '#7a4a14');
    pts = bez([-80, -258], [-92, -266], [-100, -278], [-104, -292], 6); band(g, pts, 24, 18, '#6a3e10');
    claw(g, -104, -294, -2.2, 18); claw(g, -100, -298, -1.7, 16);
    // near wing, raised high
    wing(g, [-10, -350], [40, -560 + f * 25], [-60, -690 + f * 35],
      [[-235, -700 + f * 30], [-95, -805 + f * 40], [90, -795 + f * 40], [235, -705 + f * 30], [305, -560 + f * 20]], [60, -270],
      'rgba(214,150,52,0.97)', 'rgba(110,60,16,0.97)', '#6b4114');
    // body
    pts = bez([95, -118], [70, -220], [25, -300], [-40, -345], 16);
    ns = band(g, pts, 175, 125, GOLD(g, -90, -360, 140, -100));
    g.strokeStyle = 'rgba(255,240,200,0.4)'; g.lineWidth = 3; g.stroke();
    // scale texture over the body
    g.save(); g.clip();
    g.strokeStyle = 'rgba(90,48,8,0.32)'; g.lineWidth = 1.6;
    for (let y = -400, r = 0; y < -60; y += 13, r++) for (let x = -140 + (r % 2) * 9; x < 200; x += 18) { g.beginPath(); g.arc(x, y, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    g.restore();
    spikes(g, pts, ns, 1, 175, 125, 30, 24, 3, '#7a4a12');
    plates(g, pts, ns, -1, 175, 125, 2, 'rgba(255,236,170,0.75)');
    // chest muscle
    g.fillStyle = lin(g, -110, -320, -10, -180, [[0, '#ffe39a'], [1, '#c8902e']]);
    g.beginPath(); g.ellipse(-48, -262, 58, 84, -0.35, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(150,96,30,0.6)'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(-48, -262 + (i - 2.5) * 22, 46 - Math.abs(i - 2.5) * 6, 10, -0.35, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
    // near hind leg gripping the rock
    g.fillStyle = GOLD(g, 0, -190, 130, -20);
    g.beginPath(); g.ellipse(64, -102, 72, 88, 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 2.5; g.stroke();
    pts = bez([46, -60], [22, -40], [6, -22], [-8, -6], 8); band(g, pts, 46, 30, '#b77a26');
    claw(g, -10, -6, 2.9, 30); claw(g, -6, -2, 2.6, 26); claw(g, 2, 0, 2.2, 22);
    // neck rising in an S, then the head
    pts = bez([-30, -330], [-95, -385], [-15, -470], [-132, -505], 22);
    ns = band(g, pts, 96, 46, GOLD(g, -160, -520, 0, -320));
    g.strokeStyle = 'rgba(255,240,200,0.4)'; g.lineWidth = 2.5; g.stroke();
    spikes(g, pts, ns, 1, 96, 46, 24, 16, 2, '#7a4a12');
    plates(g, pts, ns, -1, 96, 46, 2, 'rgba(255,236,170,0.8)');
    head(g, t, b);
    // near front arm, claws raised at the knight
    pts = bez([-40, -300], [-80, -290], [-112, -272], [-128, -250], 10); band(g, pts, 46, 32, GOLD(g, -140, -310, -30, -240));
    pts = bez([-128, -250], [-146, -262], [-158, -282], [-162, -304], 8); band(g, pts, 32, 24, '#c48a30');
    claw(g, -164, -306, -2.0, 26); claw(g, -158, -310, -1.55, 24); claw(g, -150, -306, -1.15, 22);
  }
  function head(g, t, b) {
    const open = 0.2 + 0.08 * b;
    g.save(); g.translate(-138, -505); g.rotate(0.2 + b * 0.03);
    // far horn
    let pts = bez([18, -24], [52, -60], [92, -58], [112, -100], 12); band(g, pts, 14, 2, '#8a7a5e');
    // inside of the mouth, glowing with fire
    g.beginPath(); g.moveTo(12, 10); g.lineTo(-118, 6); g.lineTo(12 + (-116) * Math.cos(open), 10 + 116 * Math.sin(open)); g.lineTo(12, 26); g.closePath();
    g.fillStyle = rad(g, -50, 18, 4, 80, [[0, '#fff2a0'], [0.3, '#ff9a2a'], [0.7, '#c8321a'], [1, '#5a0c08']]); g.fill();
    // flames licking out of the jaws, and their glow
    g.save(); g.globalCompositeOperation = 'lighter';
    const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
    g.fillStyle = rad(g, -125, 16, 2, 90 * fl, [[0, 'rgba(255,190,80,0.55)'], [1, 'rgba(255,90,20,0)']]);
    g.beginPath(); g.arc(-125, 16, 90 * fl, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 3; i++) {
      const len = (34 + i * 12) * (0.7 + 0.3 * Math.sin(t * (7 + i * 2) + i)), y0 = 10 + i * 5, wob = Math.sin(t * 6 + i * 2) * 5;
      g.fillStyle = i === 0 ? 'rgba(255,240,170,0.85)' : i === 1 ? 'rgba(255,170,60,0.7)' : 'rgba(255,90,30,0.55)';
      g.beginPath(); g.moveTo(-112, y0 - 5); g.quadraticCurveTo(-112 - len * 0.6, y0 - 10 + wob, -112 - len, y0 + wob);
      g.quadraticCurveTo(-112 - len * 0.6, y0 + 8 + wob, -112, y0 + 6); g.closePath(); g.fill();
    }
    g.restore();
    // lower jaw, dropped open
    g.save(); g.translate(12, 10); g.rotate(open);
    g.beginPath(); g.moveTo(2, -2); g.lineTo(-112, 0); g.quadraticCurveTo(-124, 4, -116, 13); g.quadraticCurveTo(-60, 24, 8, 16); g.closePath();
    g.fillStyle = GOLD(g, -110, -4, 0, 20); g.fill();
    g.fillStyle = '#fffaf0';
    for (let x = -108; x < -36; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3.5, -9); g.lineTo(x + 7, 0); g.closePath(); g.fill(); }
    g.restore();
    // skull
    g.beginPath(); g.moveTo(32, -28);
    g.bezierCurveTo(6, -48, -40, -44, -72, -28);
    g.lineTo(-122, -13); g.quadraticCurveTo(-138, -6, -130, 5); g.lineTo(-60, 9); g.lineTo(10, 15);
    g.quadraticCurveTo(44, 10, 32, -28); g.closePath();
    g.fillStyle = GOLD(g, -130, -40, 30, 20); g.fill();
    g.strokeStyle = 'rgba(255,240,200,0.45)'; g.lineWidth = 2; g.stroke();
    // upper teeth
    g.fillStyle = '#fffaf0';
    for (let x = -120; x < -44; x += 11) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 3.5, 15); g.lineTo(x + 7, 7); g.closePath(); g.fill(); }
    // snout plates and nostril with smoke
    g.strokeStyle = 'rgba(120,70,16,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-70 - i * 14, -26 + i * 3.5); g.lineTo(-74 - i * 14, -14 + i * 3); g.stroke(); }
    g.fillStyle = '#3a1e06'; g.beginPath(); g.ellipse(-121, -6, 5, 3, 0.3, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.6 + i * 0.25) % 1);
      g.fillStyle = `rgba(90,80,90,${0.35 * (1 - k)})`;
      g.beginPath(); g.arc(-128 - k * 30, -14 - k * 60 + Math.sin(t + i) * 5, 5 + k * 16, 0, Math.PI * 2); g.fill();
    }
    // brow, eye
    g.fillStyle = '#7a4a12'; g.beginPath(); g.moveTo(-28, -38); g.quadraticCurveTo(-48, -42, -68, -30); g.quadraticCurveTo(-48, -34, -30, -30); g.closePath(); g.fill();
    g.shadowColor = '#ffcc33'; g.shadowBlur = 14;
    g.fillStyle = '#ffe36a'; g.beginPath(); g.ellipse(-47, -24, 10, 5.5, -0.15, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#1a0a02'; g.beginPath(); g.ellipse(-47, -24, 2, 5, 0, 0, Math.PI * 2); g.fill();
    // main horns and cheek frills
    pts = bez([6, -34], [40, -80], [96, -74], [124, -128], 14);
    band(g, pts, 20, 2, lin(g, 0, -30, 124, -128, [[0, '#d9cba8'], [1, '#fffaf0']]));
    pts = bez([24, -16], [62, -30], [92, -12], [122, -34], 10); band(g, pts, 12, 2, '#e6dcc2');
    g.fillStyle = '#9a6218';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(20, -4 + i * 8); g.lineTo(54 + i * 6, -10 + i * 12); g.lineTo(22, 4 + i * 8); g.closePath(); g.fill(); }
    g.restore();
  }

  // ---------- drifting embers and fog ----------
  function embers(g, W, H, t) {
    for (let i = 0; i < 80; i++) {
      const sp = 20 + hash2(i, 1, 5) * 45, life = H * 0.9;
      const y = H - ((t * sp + hash2(i, 2, 5) * life) % life);
      const x = W * (0.45 + hash2(i, 3, 5) * 0.55) + Math.sin(t * 0.8 + i) * 18 - (H - y) * 0.15;
      const a = Math.max(0, 1 - (H - y) / life) * (0.5 + 0.5 * Math.sin(t * 6 + i));
      g.fillStyle = `rgba(255,${140 + (i % 5) * 20},60,${a})`;
      g.beginPath(); g.arc(x, y, 1 + hash2(i, 4, 5) * 1.8, 0, Math.PI * 2); g.fill();
    }
  }
  function fog(g, W, H, t) {
    for (let i = 0; i < 3; i++) {
      const y = H * (0.8 + i * 0.06), off = ((t * (8 + i * 5)) % W);
      g.fillStyle = lin(g, 0, y - 40, 0, y + 40, [[0, 'rgba(60,30,50,0)'], [0.5, `rgba(70,36,56,${0.22 + i * 0.06})`], [1, 'rgba(60,30,50,0)']]);
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(off + k * W, y, W * 0.6, 40, 0, 0, Math.PI * 2); g.fill(); }
    }
  }

  // ---------- the whole scene ----------
  return function drawTitleScene(g, W, H, time) {
    const t = reduceMotion ? 2 : time;
    if (!bg || bgW !== W || bgH !== H) { bg = buildBackground(W, H); bgW = W; bgH = H; }
    g.drawImage(bg, 0, 0, W, H);
    const narrow = W < 860;
    const s = Math.min(H / 900, W / 1500);
    // on narrow screens the heroes stay at the edges, smaller and dimmer, so the menu stays clear
    g.globalAlpha = narrow ? 0.4 : 1;
    // dragon on its spire, right side
    g.save(); g.translate(W * (narrow ? 0.9 : 0.84), H * 0.88); g.scale(s * 0.78, s * 0.78);
    crag(g, [[-150, 14], [-70, -8], [40, -24], [150, -14], [250, 12], [330, 70], [360, 700], [-200, 700]], 'rgba(255,150,70,0.45)');
    dragon(g, t);
    g.restore();
    // knight on a crag, left side
    g.save(); g.translate(W * (narrow ? 0.1 : 0.16), H * 0.88); g.scale(s * 1.15, s * 1.15);
    crag(g, [[-160, 6], [-96, -6], [-20, -2], [60, -8], [126, 2], [176, 34], [210, 500], [-230, 500]], 'rgba(200,200,255,0.3)');
    knight(g, t);
    g.restore();
    g.globalAlpha = 1;
    fog(g, W, H, t);
    embers(g, W, H, t);
    // keep the menu readable: soft dark pool behind the centre, and a vignette
    g.fillStyle = rad(g, W / 2, H * 0.5, 0, Math.max(W, H) * 0.42, [[0, 'rgba(8,5,12,0.55)'], [0.6, 'rgba(8,5,12,0.25)'], [1, 'rgba(8,5,12,0)']]);
    g.fillRect(0, 0, W, H);
    g.fillStyle = rad(g, W / 2, H / 2, Math.min(W, H) * 0.4, Math.max(W, H) * 0.8, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]);
    g.fillRect(0, 0, W, H);
  };
})();
