'use strict';
// ===== Dragonhold: 10-Second Startup Loading Screen =====
// Features the victorious knight hovering over the fallen, defeated dragon.
// Runs for 10 seconds on game startup with progress bar, countdown, lore status, and animated embers.
(function () {
  const TOTAL_DURATION = 10.0; // 10 seconds
  let startTime = null;
  let finished = false;
  let animId = null;

  const LORE_STAGES = [
    { at: 0.0, text: 'The ancient Wyrm of Aurex has been confronted...' },
    { at: 1.8, text: 'Thunder and lightning crack across the mountain spires...' },
    { at: 3.6, text: 'The radiant broadsword strikes true—the dragon falls...' },
    { at: 5.4, text: 'The knight stands victorious hovering over the defeated beast...' },
    { at: 7.2, text: 'Embers scatter as the realm is cleansed of shadow...' },
    { at: 8.8, text: 'The dawn of a new legend begins...' },
    { at: 9.7, text: 'Welcome to Dragonhold.' }
  ];

  function initStartup() {
    const screen = document.getElementById('startupScreen');
    if (!screen) return;

    const bar = document.getElementById('startupBar');
    const timer = document.getElementById('startupTimer');
    const status = document.getElementById('startupStatus');
    const btnSkip = document.getElementById('btnStartupSkip');
    const fxCanvas = document.getElementById('startupFx');
    const bg = screen.querySelector('.startup-bg');

    // Setup canvas particle effects
    let fxCtx = null;
    let embers = [];
    if (fxCanvas) {
      fxCtx = fxCanvas.getContext('2d');
      function resizeFx() {
        if (!fxCanvas) return;
        fxCanvas.width = window.innerWidth;
        fxCanvas.height = window.innerHeight;
      }
      resizeFx();
      window.addEventListener('resize', resizeFx);

      // Create glowing ember particles
      for (let i = 0; i < 75; i++) {
        embers.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.4) * 1.5,
          vy: -(Math.random() * 2.2 + 0.8),
          size: Math.random() * 3 + 1,
          alpha: Math.random() * 0.8 + 0.2,
          decay: Math.random() * 0.008 + 0.004,
          color: Math.random() > 0.35 ? '#ff9a2e' : (Math.random() > 0.5 ? '#ffcc44' : '#ff4a22')
        });
      }
    }

    function endStartup() {
      if (finished) return;
      finished = true;
      if (animId) cancelAnimationFrame(animId);

      screen.classList.add('fade-out');
      setTimeout(() => {
        screen.hidden = true;
        screen.style.display = 'none';
        // Ensure main game canvas and title card are focused and ready
        const titleCard = document.getElementById('title');
        if (titleCard) titleCard.focus?.();
      }, 750);
    }

    // Skip handlers
    if (btnSkip) {
      btnSkip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        endStartup();
      };
    }

    window.addEventListener('keydown', function onKey(e) {
      if (finished) {
        window.removeEventListener('keydown', onKey);
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        endStartup();
      }
    });

    // Main animation loop for the 10-second duration
    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(1.0, elapsed / TOTAL_DURATION);
      const remaining = Math.max(0, TOTAL_DURATION - elapsed);

      // Update progress bar
      if (bar) {
        bar.style.width = (progress * 100).toFixed(1) + '%';
      }

      // Update remaining timer
      if (timer) {
        if (remaining <= 0.2) {
          timer.textContent = 'READY';
          timer.style.color = '#7bd34a';
        } else {
          timer.textContent = Math.ceil(remaining) + 's';
        }
      }

      // Update status text
      if (status) {
        let currentText = LORE_STAGES[0].text;
        for (let i = 0; i < LORE_STAGES.length; i++) {
          if (elapsed >= LORE_STAGES[i].at) {
            currentText = LORE_STAGES[i].text;
          }
        }
        status.textContent = currentText;
      }

      // Slow cinematic zoom on background image
      if (bg) {
        const scale = 1.0 + progress * 0.07;
        bg.style.transform = `scale(${scale.toFixed(4)})`;
      }

      // Render embers on canvas
      if (fxCtx && fxCanvas) {
        fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        fxCtx.save();
        for (let i = 0; i < embers.length; i++) {
          const p = embers[i];
          p.x += p.vx + Math.sin((elapsed + i) * 1.5) * 0.6;
          p.y += p.vy;
          p.alpha -= p.decay;

          if (p.alpha <= 0 || p.y < -20) {
            // Respawn near the fire breath or bottom
            p.x = Math.random() > 0.4 ? (window.innerWidth * 0.45 + (Math.random() - 0.5) * window.innerWidth * 0.4) : (Math.random() * window.innerWidth);
            p.y = Math.random() > 0.5 ? (window.innerHeight * 0.4 + Math.random() * window.innerHeight * 0.5) : window.innerHeight + 10;
            p.alpha = Math.random() * 0.85 + 0.15;
            p.vy = -(Math.random() * 2.5 + 1.0);
          }

          fxCtx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
          fxCtx.fillStyle = p.color;
          fxCtx.shadowColor = p.color;
          fxCtx.shadowBlur = p.size * 3;
          fxCtx.beginPath();
          fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          fxCtx.fill();
        }
        fxCtx.restore();
      }

      if (progress >= 1.0) {
        endStartup();
      } else if (!finished) {
        animId = requestAnimationFrame(tick);
      }
    }

    animId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStartup);
  } else {
    initStartup();
  }
})();
