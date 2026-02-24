/* DKU Tarot - Card Engine */
const CardEngine = (() => {
  let selectedCards = [];
  let flippedCount = 0;
  let totalCards = 0;
  let onAllFlipped = null;

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function drawCards(count) {
    const shuffled = shuffle(MAJOR_ARCANA);
    selectedCards = shuffled.slice(0, count);
    return selectedCards;
  }

  function getSelectedCards() {
    return selectedCards;
  }

  function createCardElement(card, index) {
    const imagePath = card.image || `assets/tarot/pkt/${card.id}.jpg`;

    const cardEl = document.createElement('div');
    cardEl.className = 'tarot-card';
    cardEl.dataset.index = index;
    cardEl.dataset.cardId = card.id;

    cardEl.innerHTML = `
      <div class="card-hold-overlay"><span class="hold-text">Hold</span></div>
      <div class="tarot-card-inner">
        <div class="tarot-card-back">
          <div class="star-motif"></div>
        </div>
        <div class="tarot-card-front">
          <div class="card-numeral">${card.numeral}</div>
          <div class="card-image">
            <img src="${imagePath}" alt="${card.name}">
          </div>
          <div class="card-name">${card.name}</div>
          <div class="card-keywords">${card.keywords}</div>
        </div>
      </div>
    `;

    return cardEl;
  }

  function renderSpread(container, positions, cards) {
    totalCards = positions.length;
    flippedCount = 0;

    const gridClass = totalCards === 1 ? 'single-card' : 'three-cards';
    const grid = document.createElement('div');
    grid.className = `card-grid ${gridClass}`;

    cards.forEach((card, index) => {
      const slot = document.createElement('div');
      slot.className = 'card-slot';

      const label = document.createElement('div');
      label.className = 'position-label';
      label.textContent = positions[index];

      const cardEl = createCardElement(card, index);
      cardEl.addEventListener('click', () => flipCard(cardEl));

      slot.appendChild(cardEl);
      slot.appendChild(label);
      grid.appendChild(slot);
    });

    container.appendChild(grid);

    const hint = container.querySelector('.flip-hint');
    if (hint) {
      setTimeout(() => hint.classList.add('visible'), 800);
    }
  }

  function renderCards(container, positions) {
    const cards = drawCards(positions.length);
    renderSpread(container, positions, cards);
  }

  function renderSelectableDeck(container, positions) {
    totalCards = positions.length;
    flippedCount = 0;
    selectedCards = [];

    const deckGrid = document.createElement('div');
    deckGrid.className = 'card-grid deck-grid';

    MAJOR_ARCANA.forEach((card, index) => {
      const cardEl = createCardElement(card, index);
      cardEl.classList.add('deck-card');
      cardEl.addEventListener('click', () => {
        if (cardEl.classList.contains('selected')) return;
        cardEl.classList.add('selected', 'flipped');
        selectedCards.push(card);

        if (selectedCards.length === totalCards) {
          container.innerHTML = '';
          renderSpread(container, positions, selectedCards);
        }
      });
      deckGrid.appendChild(cardEl);
    });

    container.appendChild(deckGrid);
  }

  function renderDeckRow(container, onSelect) {
    container.innerHTML = '';
    MAJOR_ARCANA.forEach((card, index) => {
      const cardEl = createCardElement(card, index);
      cardEl.classList.add('deck-card');
      cardEl.addEventListener('click', () => onSelect(card, cardEl));
      container.appendChild(cardEl);
    });
  }

  function flipCard(cardEl) {
    if (cardEl.classList.contains('flipped')) return;

    cardEl.classList.add('flipped');
    flippedCount++;

    if (flippedCount === totalCards && onAllFlipped) {
      // Short delay to let the last flip animation complete
      setTimeout(() => {
        const hint = document.querySelector('.flip-hint');
        if (hint) hint.classList.remove('visible');
        onAllFlipped(selectedCards);
      }, 900);
    }
  }

  function setOnAllFlipped(callback) {
    onAllFlipped = callback;
  }

  function flipCardByIndex(index) {
    const cardEl = document.querySelector(`.tarot-card[data-index="${index}"]`);
    if (cardEl) flipCard(cardEl);
  }

  function getCardSummary(cards, positions) {
    return cards.map((card, i) => {
      return `Position: ${positions[i]}\nCard: ${card.numeral} - ${card.name}\nKeywords: ${card.keywords}\nMeaning: ${card.meaning}`;
    }).join('\n\n');
  }

  return {
    renderCards,
    renderSelectableDeck,
    renderDeckRow,
    setOnAllFlipped,
    getSelectedCards,
    getCardSummary,
    flipCardByIndex
  };
})();
