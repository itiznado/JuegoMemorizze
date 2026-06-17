// ============================================================
// JUEGO DE MEMORIA — Sección 1: Estado + Render
// ============================================================

// ------------------------------------------------------------
// DATOS: emojis que se usarán como contenido de las cartas
// Hay 18 símbolos para cubrir el nivel de dificultad máximo.
// ------------------------------------------------------------
const SYMBOLS = [
  '🐶','🐱','🐭','🐹','🐰','🦊',
  '🐻','🐼','🦁','🐮','🐷','🐸',
  '🐵','🐔','🐧','🐦','🦆','🦉',
];

// ------------------------------------------------------------
// CONSTANTES DE LAYOUT: cuántas columnas usar según la cantidad
// de cartas. Esto se aplica como variable CSS al tablero.
// ------------------------------------------------------------
const COLS_BY_PAIR_COUNT = {
  8:  4,   // 16 cartas → 4 columnas
  12: 6,   // 24 cartas → 6 columnas
  18: 6,   // 36 cartas → 6 columnas
};

// ------------------------------------------------------------
// ESTADO: fuente única de verdad.
// Toda la información del juego vive aquí.
// La UI NO guarda estado propio; solo refleja este objeto.
// ------------------------------------------------------------
const state = {
  cards: [],         // Array de objetos carta: { id, symbol, isFlipped, isMatched }
  flipped: [],       // IDs de las cartas volteadas en el turno actual (máx 2)
  locked: false,     // true mientras se resuelve un par (bloquea interacción)
  moves: 0,          // Contador de movimientos
  matchedPairs: 0,   // Parejas encontradas
  totalPairs: 8,     // Depende de la dificultad elegida
  timerSeconds: 0,   // Segundos transcurridos
  timerRunning: false,
  bestScore: null,   // { moves, seconds } — se persiste en localStorage (sección 4)
};

// ------------------------------------------------------------
// REFERENCIAS AL DOM
// Las guardamos una sola vez para no buscarlas en cada render.
// ------------------------------------------------------------
const boardEl       = document.getElementById('board');
const moveCountEl   = document.getElementById('move-count');
const timerEl       = document.getElementById('timer');
const bestScoreEl   = document.getElementById('best-score');
const victoryMsgEl  = document.getElementById('victory-msg');
const victoryDetails= document.getElementById('victory-details');
const restartBtn    = document.getElementById('restart-btn');
const difficultyEl  = document.getElementById('difficulty-select');

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------

/**
 * Baraja un array IN PLACE usando Fisher-Yates.
 * Por qué Fisher-Yates: es el único algoritmo que garantiza
 * distribución uniforme. Array.sort(random) tiene sesgo
 * porque el motor de JS asume un comparador estable/transitivo.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];  // destructuring swap
  }
  return arr;
}

/**
 * Genera el array de cartas para el estado inicial.
 * Toma los primeros `pairCount` símbolos, los duplica y los baraja.
 * Cada carta tiene un ID único para poder identificarla sin depender
 * de índices de DOM (que pueden cambiar si re-renderizamos).
 */
function generateCards(pairCount) {
  const symbols = SYMBOLS.slice(0, pairCount);
  // Duplicamos para crear las parejas
  const pairs = [...symbols, ...symbols];
  shuffle(pairs);

  return pairs.map((symbol, index) => ({
    id: index,           // ID estable dentro de esta partida
    symbol,
    isFlipped: false,
    isMatched: false,
  }));
}

// ------------------------------------------------------------
// MUTACIONES DE ESTADO
// Son las únicas funciones que modifican `state`.
// Siempre llaman a render() al final para sincronizar la UI.
// ------------------------------------------------------------

/**
 * Inicializa (o reinicia) el juego con el número de parejas dado.
 * Resetea todo el estado a sus valores iniciales.
 */
function initGame(pairCount) {
  // Detenemos el cronómetro anterior si existía
  stopTimer();

  state.cards        = generateCards(pairCount);
  state.flipped      = [];
  state.locked       = false;
  state.moves        = 0;
  state.matchedPairs = 0;
  state.totalPairs   = pairCount;
  state.timerSeconds = 0;
  state.timerRunning = false;

  // El mensaje de victoria queda oculto hasta que se necesite
  victoryMsgEl.classList.add('hidden');

  render();
}

// ------------------------------------------------------------
// RENDER: dibuja la UI desde el estado
// Esta función es el "único camino" del estado al DOM.
// No recibe parámetros: siempre lee de `state`.
// ------------------------------------------------------------

/**
 * Construye y monta las cartas en el tablero.
 * Usa createElement para crear nodos explícitamente (no innerHTML).
 *
 * Estructura de cada carta:
 *   <article class="card [flipped] [matched]" data-id="N">
 *     <div class="card-inner">
 *       <div class="card-face card-back">?</div>
 *       <div class="card-face card-front">emoji</div>
 *     </div>
 *   </article>
 *
 * Por qué data-id: el listener de click está en el tablero (delegación),
 * así que necesitamos saber qué carta fue clickeada sin tener un listener
 * por carta. data-id es el puente entre DOM y estado.
 */
function renderBoard() {
  // Vaciamos el tablero antes de redibujar.
  // Con replaceChildren() no necesitamos innerHTML = ''.
  boardEl.replaceChildren();

  // Ajustamos las columnas del grid via CSS custom property
  const cols = COLS_BY_PAIR_COUNT[state.totalPairs] ?? 4;
  boardEl.style.setProperty('--cols', cols);

  // Construimos una carta por cada objeto en state.cards
  state.cards.forEach((card) => {
    // Elemento contenedor de la carta
    const article = document.createElement('article');
    article.className = 'card';
    article.dataset.id = card.id;   // El puente DOM → estado
    article.setAttribute('role', 'button');
    article.setAttribute('aria-label', card.isMatched || card.isFlipped
      ? `Carta: ${card.symbol}`
      : 'Carta oculta'
    );

    // Aplicamos clases según el estado de la carta
    if (card.isFlipped || card.isMatched) article.classList.add('flipped');
    if (card.isMatched)                   article.classList.add('matched');

    // Contenedor interno para el efecto 3D
    const inner = document.createElement('div');
    inner.className = 'card-inner';

    // Cara trasera (visible por defecto)
    const back = document.createElement('div');
    back.className = 'card-face card-back';
    back.textContent = '?';

    // Cara delantera (visible al voltear)
    const front = document.createElement('div');
    front.className = 'card-face card-front';
    front.textContent = card.symbol;

    // Montamos el árbol: article > inner > back + front
    inner.appendChild(back);
    inner.appendChild(front);
    article.appendChild(inner);
    boardEl.appendChild(article);
  });

  // Bloqueamos el tablero a nivel visual si el estado lo pide
  if (state.locked) {
    boardEl.classList.add('locked');
  } else {
    boardEl.classList.remove('locked');
  }
}

/**
 * Actualiza los marcadores de texto (movimientos, tiempo, mejor puntaje).
 * Separado de renderBoard para poder llamarlo de forma independiente
 * (el cronómetro lo llama cada segundo sin re-renderizar las cartas).
 */
function renderScoreboard() {
  moveCountEl.textContent = state.moves;
  timerEl.textContent     = `${state.timerSeconds}s`;

  if (state.bestScore) {
    bestScoreEl.textContent = `${state.bestScore.moves} mov / ${state.bestScore.seconds}s`;
  } else {
    bestScoreEl.textContent = '--';
  }
}

/**
 * Función principal de render: llama a los sub-renders.
 * Esta es la que llamamos después de cada mutación de estado.
 */
function render() {
  renderBoard();
  renderScoreboard();
}

// ------------------------------------------------------------
// CRONÓMETRO (stubs — se completa en sección 3)
// Definimos las funciones aquí para que initGame() pueda llamarlas.
// Por ahora son vacías; las implementaremos en la siguiente sección.
// ------------------------------------------------------------
let timerInterval = null;

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ------------------------------------------------------------
// ARRANQUE
// ------------------------------------------------------------

// Leemos la dificultad inicial desde el select y arrancamos
initGame(Number(difficultyEl.value));
