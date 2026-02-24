/* DKU Tarot - Landing Page Animations */
document.addEventListener('DOMContentLoaded', () => {
  // Trigger entrance animations
  const header = document.querySelector('.landing-header');
  const cards = document.querySelectorAll('.section-card');

  // Stagger animations
  requestAnimationFrame(() => {
    if (header) header.classList.add('animate-in');
    cards.forEach((card) => card.classList.add('animate-in'));
  });

  // Init settings modal
  Config.initModal();

  // Gesture Control (optional on landing)
  const gestureVideo = document.getElementById('gesture-video');
  const gestureCanvas = document.getElementById('gesture-canvas');
  const cursorEl = document.getElementById('gesture-cursor');
  const stageEl = document.querySelector('.landing-page');
  const cardEls = Array.from(document.querySelectorAll('.section-card'));

  let hoverIndex = null;
  let fistStartTime = null;
  let smoothPalmX = 0.5;
  let smoothPalmY = 0.5;
  let focusedIndex = 0;
  let hasNavigated = false;

  function updateCursor(normX, normY, active) {
    if (!stageEl || !cursorEl) return;
    const rect = stageEl.getBoundingClientRect();
    const x = rect.width * normX;
    const y = rect.height * normY;
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
    cursorEl.classList.toggle('active', active);
  }

  function setHover(index) {
    hoverIndex = typeof index === 'number' ? index : null;
    cardEls.forEach((el, i) => {
      el.classList.toggle('is-hover', hoverIndex === i);
      if (hoverIndex !== i) {
        el.classList.remove('is-holding');
        el.removeAttribute('data-hold');
      }
    });
  }

  function triggerCard(index) {
    if (hasNavigated) return;
    const el = cardEls[index];
    if (!el) return;
    const href = el.getAttribute('href');
    if (!href) return;
    hasNavigated = true;
    window.location.href = href;
  }

  if (gestureVideo && gestureCanvas && typeof GestureEngine !== 'undefined' && cardEls.length > 0) {
    GestureEngine.init({
      videoEl: gestureVideo,
      canvasEl: gestureCanvas,
      onStatus: () => {},
      onFrame: ({ gesture, swipe, palm }) => {
        if (!stageEl) return;

        const stageRect = stageEl.getBoundingClientRect();
        const clamp01 = (v) => Math.min(1, Math.max(0, v));

        // Swipe cycles focus so users can select even without precise hovering.
        if (swipe) {
          if (swipe === 'Swipe Right') {
            focusedIndex = Math.min(focusedIndex + 1, cardEls.length - 1);
          } else {
            focusedIndex = Math.max(focusedIndex - 1, 0);
          }
          setHover(focusedIndex);
        }

        let normX = 0.5;
        let normY = 0.5;
        const isPalmActive = palm && gesture === 'Open Palm';

        if (isPalmActive) {
          const marginX = 0.12;
          const marginY = 0.12;
          const mappedX = (palm.x - marginX) / (1 - marginX * 2);
          const mappedY = (palm.y - marginY) / (1 - marginY * 2);
          normX = clamp01(mappedX);
          normY = clamp01(mappedY);

          // MVP-style smoothing to reduce jitter and avoid fast jumps.
          const smoothing = 0.18;
          smoothPalmX += (normX - smoothPalmX) * smoothing;
          smoothPalmY += (normY - smoothPalmY) * smoothing;
          smoothPalmX = Math.min(0.98, Math.max(0.02, smoothPalmX));
          smoothPalmY = Math.min(0.98, Math.max(0.02, smoothPalmY));
          normX = smoothPalmX;
          normY = smoothPalmY;

          updateCursor(normX, normY, true);

          // Hover detection
          const cursorX = stageRect.left + stageRect.width * normX;
          const cursorY = stageRect.top + stageRect.height * normY;
          let nextHover = null;
          cardEls.forEach((cardEl, index) => {
            const rect = cardEl.getBoundingClientRect();
            const isHover = cursorX >= rect.left && cursorX <= rect.right && cursorY >= rect.top && cursorY <= rect.bottom;
            if (isHover) nextHover = index;
          });
          if (nextHover !== null) {
            focusedIndex = nextHover;
            setHover(nextHover);
          }
        } else {
          updateCursor(0.5, 0.5, false);
          // Keep last focus highlight for guidance
          if (hoverIndex === null) setHover(focusedIndex);
        }

        // Fist hold to enter the hovered module
        if (!hasNavigated && gesture === 'Fist' && hoverIndex !== null) {
          const el = cardEls[hoverIndex];
          if (el) {
            if (!fistStartTime) fistStartTime = Date.now();
            const holdTime = (Date.now() - fistStartTime) / 1000;
            el.classList.add('is-holding');
            el.setAttribute('data-hold', holdTime >= 1 ? 'Selected' : `${holdTime.toFixed(1)}s`);
            if (holdTime >= 1) {
              triggerCard(hoverIndex);
              fistStartTime = null;
            }
          }
        } else {
          fistStartTime = null;
          cardEls.forEach((el) => {
            el.classList.remove('is-holding');
            el.removeAttribute('data-hold');
          });
        }
      }
    });
  }
});
