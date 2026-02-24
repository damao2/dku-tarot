/* DKU Tarot - Reading Workspace Orchestrator */
document.addEventListener('DOMContentLoaded', () => {
  // Determine section from URL
  const params = new URLSearchParams(window.location.search);
  const section = params.get('section') || 'daily';
  const sectionData = SECTION_PROMPTS[section];

  if (!sectionData) {
    document.body.innerHTML = '<p style="color:#e8a0a0;text-align:center;padding:2rem;">Unknown section. <a href="index.html" style="color:#C5A065;">Return home</a></p>';
    return;
  }

  // Set header title
  const titleEl = document.querySelector('.section-title');
  if (titleEl) {
    titleEl.textContent = sectionData.title;
  }

  const selectionTitle = document.getElementById('selection-title');
  const selectionPrompt = document.getElementById('selection-prompt');
  const selectionCount = document.getElementById('selection-count');
  const slotRow = document.getElementById('slot-row');
  const deckStage = document.getElementById('deck-stage');
  const deckTrack = document.getElementById('deck-track');

  // Init settings modal
  Config.initModal();

  // Init Chat Engine
  ChatEngine.init({
    messagesContainer: document.getElementById('chat-messages'),
    inputTextarea: document.getElementById('chat-input'),
    sendButton: document.getElementById('chat-send'),
  });

  // Set system prompt
  ChatEngine.setSystemPrompt(sectionData.systemPrompt);

  // Show opening message from oracle
  ChatEngine.addAssistantMessage(sectionData.openingMessage);

  if (selectionTitle) selectionTitle.textContent = sectionData.title;
  if (selectionPrompt) {
    const firstLine = sectionData.openingMessage.split('\n')[0]?.replace(/\*\*/g, '') || '';
    selectionPrompt.textContent = firstLine;
  }

  const totalCards = sectionData.positions.length;
  let selectedCards = [];
  const selectedIds = new Set();
  let isFinalizing = false;

  // Layout hint: single-card draws (e.g. Daily Fortune) look better with a narrower slot.
  const selectionStage = document.getElementById('selection-stage');
  if (selectionStage) {
    selectionStage.classList.toggle('single-pick', totalCards === 1);
  }

  function updateCount() {
    if (selectionCount) {
      selectionCount.textContent = `Selected ${selectedCards.length}/${totalCards}`;
    }
  }

  function renderSlots() {
    if (!slotRow) return;
    slotRow.innerHTML = '';
    sectionData.positions.forEach((label, index) => {
      const slot = document.createElement('div');
      slot.className = 'slot-card';
      slot.dataset.index = index;
      slot.innerHTML = `
        <div class="slot-media" aria-hidden="true"></div>
        <span class="slot-label">${label}</span>
      `;
      slotRow.appendChild(slot);
    });
  }

  function fillSlot(card, index) {
    const slot = slotRow?.querySelector(`.slot-card[data-index="${index}"]`);
    if (!slot) return;
    slot.innerHTML = `
      <div class="slot-media">
        <img src="assets/tarot/pkt/${card.id}.jpg" alt="${card.name}">
      </div>
      <span class="slot-label">${sectionData.positions[index]}</span>
    `;
  }

  function animateSlotPop(slotIndex) {
    const slot = slotRow?.querySelector(`.slot-card[data-index="${slotIndex}"]`);
    if (!slot) return;
    slot.classList.remove('slot-just-filled');
    // Force reflow to restart the animation
    void slot.offsetWidth;
    slot.classList.add('slot-just-filled');
  }

  function animateCardFlyToSlot(sourceCardEl, slotIndex, card, options = {}) {
    const slot = slotRow?.querySelector(`.slot-card[data-index="${slotIndex}"]`);
    const slotMedia = slot?.querySelector('.slot-media');
    if (!sourceCardEl || !slotMedia) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion || typeof sourceCardEl.getBoundingClientRect !== 'function') {
      options.onFinish?.();
      animateSlotPop(slotIndex);
      return;
    }

    const from = sourceCardEl.getBoundingClientRect();
    const to = slotMedia.getBoundingClientRect();

    const fromCenterX = from.left + from.width / 2;
    const fromCenterY = from.top + from.height / 2;
    const toCenterX = to.left + to.width / 2;
    const toCenterY = to.top + to.height / 2;
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;

    const rawScale = Math.min(to.width / from.width, to.height / from.height);
    const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
    const imageSrc = `assets/tarot/pkt/${card.id}.jpg`;

    const fly = document.createElement('div');
    fly.className = 'card-fly';
    fly.style.left = `${from.left}px`;
    fly.style.top = `${from.top}px`;
    fly.style.width = `${from.width}px`;
    fly.style.height = `${from.height}px`;
    fly.innerHTML = `
      <div class="card-fly-inner">
        <div class="card-fly-back"></div>
        <div class="card-fly-front" style="background-image:url('${imageSrc}')"></div>
      </div>
    `;
    document.body.appendChild(fly);

    const prevSourceOpacity = sourceCardEl.style.opacity;
    sourceCardEl.style.opacity = '0.22';

    const flyAnim = fly.animate([
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
      { transform: `translate3d(${dx * 0.55}px, ${dy * 0.55}px, 0) scale(${Math.max(0.9, scale)})`, opacity: 1, offset: 0.6 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 1 }
    ], {
      duration: 720,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'forwards'
    });

    const inner = fly.querySelector('.card-fly-inner');
    inner?.animate([
      { transform: 'rotateY(0deg)' },
      { transform: 'rotateY(180deg)' }
    ], {
      duration: 520,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'forwards'
    });

    flyAnim.onfinish = () => {
      sourceCardEl.style.opacity = prevSourceOpacity;
      options.onFinish?.();
      animateSlotPop(slotIndex);

      const fade = fly.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 140,
        easing: 'ease-out',
        fill: 'forwards',
      });
      fade.onfinish = () => fly.remove();
    };
  }

  function finalizeSelection() {
    if (isFinalizing) return;
    isFinalizing = true;

    // Give the user a moment to see the final card land.
    setTimeout(() => {
      const overlay = document.getElementById('chat-overlay');
      if (overlay) overlay.classList.add('open');

      const summary = CardEngine.getCardSummary(selectedCards, sectionData.positions);
      const cardMessage = `[CARD DRAW RESULTS]\n${summary}\n[END CARD DRAW]\n\nPlease provide a reading based on these cards, connecting them to what I shared earlier.`;
      ChatEngine.addHiddenUserMessage(cardMessage);
      ChatEngine.triggerAutoResponse();
    }, 1000);
  }

  renderSlots();
  updateCount();

  if (deckTrack) {
    CardEngine.renderDeckRow(deckTrack, (card, cardEl) => {
      if (selectedIds.has(card.id) || selectedCards.length >= totalCards) return;
      selectedIds.add(card.id);
      selectedCards.push(card);
      cardEl.classList.add('selected');
      const slotIndex = selectedCards.length - 1;
      requestAnimationFrame(() => {
        animateCardFlyToSlot(cardEl, slotIndex, card, {
          onFinish: () => fillSlot(card, slotIndex),
        });
      });
      updateCount();
      if (selectedCards.length === totalCards) {
        finalizeSelection();
      }
    });

    requestAnimationFrame(() => {
      const stageRect = deckStage?.getBoundingClientRect();
      if (!stageRect) return;
      const minOffset = stageRect.width - deckTrack.scrollWidth;
      const baseOffset = minOffset / 2;
      deckTrack.dataset.offset = baseOffset;
      deckTrack.style.transform = `translateX(${baseOffset}px)`;
    });
  }

  // Gesture Control
  const gestureVideo = document.getElementById('gesture-video');
  const gestureCanvas = document.getElementById('gesture-canvas');
  const cursorEl = document.getElementById('gesture-cursor');

  let hoverIndex = null;
  let fistStartTime = null;
  let smoothPalmX = 0.5;
  let smoothPalmY = 0.5;

  function updateCursor(normX, normY, active) {
    if (!deckStage || !cursorEl) return;
    const rect = deckStage.getBoundingClientRect();
    const x = rect.width * normX;
    const y = rect.height * normY;
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
    cursorEl.classList.toggle('active', active);
  }

  if (gestureVideo && gestureCanvas) {
    GestureEngine.init({
      videoEl: gestureVideo,
      canvasEl: gestureCanvas,
      onStatus: () => {},
      onFrame: ({ gesture, swipe, palm }) => {
        const deckCards = Array.from(deckTrack?.querySelectorAll('.deck-card') || []);
        const stageRect = deckStage?.getBoundingClientRect();
        if (!stageRect) return;

        const clamp01 = (v) => Math.min(1, Math.max(0, v));
        const clampOffset = (v) => Math.max(minOffset, Math.min(maxOffset, v));

        const minOffset = stageRect.width - deckTrack.scrollWidth;
        const maxOffset = 0;
        const baseOffset = minOffset / 2;
        const currentOffset = deckTrack?.dataset.offset ? parseFloat(deckTrack.dataset.offset) : baseOffset;

        let targetOffset = currentOffset;

        // Map palm position to normalized cursor coordinates inside the deck stage
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

          // MVP-style smoothing so the deck doesn't feel too fast/jittery.
          const smoothing = 0.18;
          smoothPalmX += (normX - smoothPalmX) * smoothing;
          smoothPalmY += (normY - smoothPalmY) * smoothing;
          smoothPalmX = Math.min(0.98, Math.max(0.02, smoothPalmX));
          smoothPalmY = Math.min(0.98, Math.max(0.02, smoothPalmY));

          normX = smoothPalmX;
          normY = smoothPalmY;
          updateCursor(normX, normY, true);
        } else {
          updateCursor(0.5, 0.5, false);
        }

        // Swipe nudges the deck left/right by one card.
        if (swipe) {
          const cardWidth = deckCards[0]?.getBoundingClientRect().width || 120;
          const gap = parseFloat(getComputedStyle(deckTrack).gap) || 16;
          const step = cardWidth + gap;
          targetOffset += swipe === 'Swipe Right' ? -step : step;
        }

        // Hand position + hover drives continuous deck movement.
        if (isPalmActive) {
          const cursorX = stageRect.left + stageRect.width * normX;
          const cursorY = stageRect.top + stageRect.height * normY;

          hoverIndex = null;
          deckCards.forEach((cardEl, index) => {
            const rect = cardEl.getBoundingClientRect();
            const isHover = cursorX >= rect.left && cursorX <= rect.right && cursorY >= rect.top && cursorY <= rect.bottom;
            cardEl.classList.toggle('is-hover', isHover);
            if (isHover) hoverIndex = index;
          });

          if (hoverIndex !== null) {
            // If hovering a card, gently pull that card toward the stage center.
            const hovered = deckCards[hoverIndex];
            const rect = hovered.getBoundingClientRect();
            const cardCenter = rect.left + rect.width / 2;
            const stageCenter = stageRect.left + stageRect.width / 2;
            const delta = stageCenter - cardCenter;
            targetOffset = currentOffset + delta * 0.55;
          } else {
            // Otherwise, map hand X to deck offset across the full scroll range.
            const range = Math.max(0, deckTrack.scrollWidth - stageRect.width);
            targetOffset = baseOffset + (0.5 - normX) * range;
          }
        }

        // Apply once per frame after computing all influences.
        const nextOffset = clampOffset(currentOffset + (targetOffset - currentOffset) * 0.08);
        deckTrack.style.transform = `translateX(${nextOffset}px)`;
        deckTrack.dataset.offset = nextOffset;

        if (gesture === 'Fist' && hoverIndex !== null) {
          const cardEl = deckCards[hoverIndex];
          if (cardEl && !cardEl.classList.contains('selected') && selectedCards.length < totalCards) {
            if (!fistStartTime) fistStartTime = Date.now();
            const holdTime = (Date.now() - fistStartTime) / 1000;
            cardEl.classList.add('is-holding');
            const overlayText = cardEl.querySelector('.hold-text');
            if (overlayText) overlayText.textContent = holdTime >= 1 ? 'Selected' : `${holdTime.toFixed(1)}s`;
            if (holdTime >= 1) {
              cardEl.classList.add('selected');
              const cardId = parseInt(cardEl.dataset.cardId, 10);
              const card = MAJOR_ARCANA.find((c) => c.id === cardId);
              if (card && !selectedIds.has(card.id)) {
                selectedIds.add(card.id);
                selectedCards.push(card);
                const slotIndex = selectedCards.length - 1;
                requestAnimationFrame(() => {
                  animateCardFlyToSlot(cardEl, slotIndex, card, {
                    onFinish: () => fillSlot(card, slotIndex),
                  });
                });
                updateCount();
                if (selectedCards.length === totalCards) {
                  finalizeSelection();
                }
              }
              fistStartTime = null;
            }
          }
        } else {
          fistStartTime = null;
          deckCards.forEach((cardEl) => {
            cardEl.classList.remove('is-holding');
            if (!cardEl.classList.contains('selected')) {
              const overlayText = cardEl.querySelector('.hold-text');
              if (overlayText) overlayText.textContent = 'Hold';
            }
          });
        }
      }
    });
  }
});
