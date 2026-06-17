// ============================================================
// JUEGO DE MEMORIA — Secciones 1 y 2: Estado + Render + Interacción
// ============================================================

// ------------------------------------------------------------
// DATOS: emojis que se usarán como contenido de las cartas.
// Hay 18 símbolos para cubrir el nivel de dificultad máximo.
// ------------------------------------------------------------
const SYMBOLS = [
  '🐶','🐱','🐭','🐹','🐰','🦊',
  '🐻','🐼','🦁','🐮','🐷','🐸',
  '🐵','🐔','🐧','🐦','🦆','🦉',
];

// ------------------------------------------------------------
// CONSTANTES DE LAYOUT: cuántas columnas usar según el número
// de parejas. Se aplica al tablero como una variable CSS.
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
  moves: 0,          // Contador de movimientos (cada par de cartas = 1 movimiento)
  matchedPairs: 0,   // Parejas encontradas hasta ahora
  totalPairs: 8,     // Total de parejas; depende de la dificultad
  timerSeconds: 0,   // Segundos transcurridos desde que empezó la partida
  timerRunning: false,
  bestScore: null,   // { moves, seconds } — se persiste en localStorage (sección 4)
};

// ------------------------------------------------------------
// REFERENCIAS AL DOM
// Las guardamos una sola vez al cargar el script.
// Buscar un elemento con getElementById cada vez que se necesita
// es ineficiente; mejor buscarlo una sola vez y reutilizar
// la referencia guardada en estas constantes.
// ------------------------------------------------------------
const boardEl        = document.getElementById('board');
const moveCountEl    = document.getElementById('move-count');
const timerEl        = document.getElementById('timer');
const bestScoreEl    = document.getElementById('best-score');
const victoryMsgEl   = document.getElementById('victory-msg');
const victoryDetails = document.getElementById('victory-details');
const restartBtn     = document.getElementById('restart-btn');
const difficultyEl   = document.getElementById('difficulty-select');

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------

/**
 * Baraja un array EN EL LUGAR usando el algoritmo Fisher-Yates.
 *
 * ¿Por qué no usamos arr.sort(() => Math.random() - 0.5)?
 * Porque sort() asume que el comparador es consistente (si A > B
 * hoy, mañana también). Un comparador aleatorio viola esa regla
 * y produce distribuciones sesgadas. Fisher-Yates garantiza que
 * cada permutación es igualmente probable.
 *
 * El algoritmo: recorre el array de atrás hacia adelante.
 * En cada posición i, elige un índice aleatorio j entre 0 e i,
 * y los intercambia. Como j puede ser igual a i, un elemento
 * puede "quedarse en su lugar", lo cual es correcto.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap con destructuring: intercambia arr[i] y arr[j]
    // sin necesidad de una variable temporal
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Genera el array inicial de cartas barajadas.
 *
 * slice(0, pairCount): toma los primeros N símbolos del array SYMBOLS.
 * [...symbols, ...symbols]: el spread operator (...) "esparce" los
 *   elementos de un array dentro de otro. Aquí duplicamos el array
 *   para crear las dos copias de cada símbolo (las parejas).
 * map(): transforma cada símbolo en un objeto carta con su metadata.
 */
function generateCards(pairCount) {
  const symbols = SYMBOLS.slice(0, pairCount);
  const pairs   = [...symbols, ...symbols];
  shuffle(pairs);

  return pairs.map((symbol, index) => ({
    id: index,        // Identificador único y estable dentro de la partida
    symbol,           // El emoji que muestra la cara delantera
    isFlipped: false, // ¿Está actualmente volteada?
    isMatched: false, // ¿Fue encontrada como parte de una pareja?
  }));
}

// ------------------------------------------------------------
// MUTACIONES DE ESTADO
// Son las ÚNICAS funciones que modifican state directamente.
// Tras cada mutación llaman a render() para que la UI refleje
// el nuevo estado. Esto evita que la UI y el estado se desincronicen.
// ------------------------------------------------------------

/**
 * Inicializa (o reinicia) el juego completo.
 * Resetea todo state a sus valores de partida.
 */
function initGame(pairCount) {
  stopTimer();

  state.cards        = generateCards(pairCount);
  state.flipped      = [];
  state.locked       = false;
  state.moves        = 0;
  state.matchedPairs = 0;
  state.totalPairs   = pairCount;
  state.timerSeconds = 0;
  state.timerRunning = false;

  victoryMsgEl.classList.add('hidden');

  render();
}

/**
 * Voltea una carta: la marca como isFlipped en el estado
 * y la agrega a state.flipped (las del turno actual).
 *
 * ¿Por qué recibe el ID y no el objeto carta directamente?
 * Porque el evento de click solo nos da el ID (desde data-id en el DOM).
 * Buscamos el objeto correspondiente con find() para modificarlo.
 *
 * Array.find(): recorre el array y devuelve el PRIMER elemento
 * que hace que la función de prueba retorne true.
 * c => c.id === cardId  es una "arrow function": una función
 * corta que recibe c (cada carta) y retorna si su id coincide.
 */
function flipCard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  card.isFlipped = true;
  state.flipped.push(cardId);
  render();
}

/**
 * Marca ambas cartas del turno como encontradas (matched).
 * Incrementa el contador de parejas y desbloquea el tablero.
 */
function resolveMatch() {
  const [id1, id2] = state.flipped; // Destructuring: saca los dos IDs del array

  state.cards.find(c => c.id === id1).isMatched = true;
  state.cards.find(c => c.id === id2).isMatched = true;

  state.matchedPairs += 1;
  state.flipped  = [];
  state.locked   = false;

  render();
}

/**
 * Oculta las dos cartas del turno que no formaron pareja.
 * Las "desvoltea" en el estado y desbloquea el tablero.
 */
function resolveMismatch() {
  const [id1, id2] = state.flipped;

  state.cards.find(c => c.id === id1).isFlipped = false;
  state.cards.find(c => c.id === id2).isFlipped = false;

  state.flipped = [];
  state.locked  = false;

  render();
}

// ------------------------------------------------------------
// LÓGICA DEL TURNO
// Coordina las mutaciones de estado según las reglas del juego.
// Esta función decide qué hacer; las mutaciones saben cómo hacerlo.
// Separar el "qué" del "cómo" hace el código más fácil de leer.
// ------------------------------------------------------------

/**
 * Procesa el intento de voltear una carta.
 * Es llamada desde el manejador de eventos con el ID de la carta.
 *
 * Flujo:
 *  1. Si el tablero está bloqueado o la carta no se puede voltear → ignorar.
 *  2. Voltear la carta.
 *  3. Si es la primera del turno → esperar la segunda.
 *  4. Si es la segunda → bloquear, comparar, resolver con o sin retardo.
 */
function handleCardFlip(cardId) {
  // Guarda de entrada: si está bloqueado, salimos inmediatamente.
  // Aunque CSS ya bloquea clics visualmente con pointer-events: none,
  // la comprobación en JS es la barrera real de seguridad.
  if (state.locked) return;

  const card = state.cards.find(c => c.id === cardId);

  // Ignorar si la carta ya está volteada o ya fue encontrada
  if (!card || card.isFlipped || card.isMatched) return;

  // Primera carta del turno
  if (state.flipped.length === 0) {
    flipCard(cardId);
    return;
  }

  // Segunda carta del turno: voltear, contar movimiento y evaluar
  flipCard(cardId);
  state.moves += 1;

  // Bloqueamos el tablero ANTES de la comparación asíncrona.
  // Si no lo hiciéramos, el usuario podría hacer clic en una
  // tercera carta durante el setTimeout.
  state.locked = true;
  render(); // Actualizar el contador de movimientos ya

  const [firstId] = state.flipped; // El ID de la primera carta del turno
  const firstCard  = state.cards.find(c => c.id === firstId);

  if (firstCard.symbol === card.symbol) {
    // PAREJA ENCONTRADA: no necesitamos retardo, resolvemos directo.
    // Un pequeño timeout de 400ms da tiempo a que la animación de
    // volteo termine antes de cambiar el color a "matched".
    setTimeout(resolveMatch, 400);
  } else {
    // NO COINCIDEN: esperamos 1 segundo para que el usuario vea
    // ambas cartas antes de ocultarlas de nuevo.
    setTimeout(resolveMismatch, 1000);
  }
}

// ------------------------------------------------------------
// RENDER: transforma el estado en DOM visible
// No modifica state; solo lee de él.
// ------------------------------------------------------------

/**
 * Reconstruye todas las cartas del tablero desde state.cards.
 *
 * ¿Por qué reconstruimos todas y no solo las que cambiaron?
 * En un juego pequeño como este, el costo de re-renderizar 16-36
 * elementos es insignificante. La alternativa (actualizar solo
 * los nodos afectados) es más eficiente pero más compleja.
 * Este enfoque es más simple y su comportamiento es predecible.
 *
 * replaceChildren() sin argumentos vacía el elemento de forma
 * segura. Es la alternativa moderna a innerHTML = ''.
 */
function renderBoard() {
  boardEl.replaceChildren();

  const cols = COLS_BY_PAIR_COUNT[state.totalPairs] ?? 4;
  boardEl.style.setProperty('--cols', cols);

  state.cards.forEach((card) => {
    const article = document.createElement('article');
    article.className = 'card';
    article.dataset.id = card.id;
    article.setAttribute('role', 'button');
    article.setAttribute('aria-label',
      card.isMatched || card.isFlipped ? `Carta: ${card.symbol}` : 'Carta oculta'
    );

    if (card.isFlipped || card.isMatched) article.classList.add('flipped');
    if (card.isMatched)                   article.classList.add('matched');

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const back = document.createElement('div');
    back.className = 'card-face card-back';
    back.textContent = '?';

    const front = document.createElement('div');
    front.className = 'card-face card-front';
    front.textContent = card.symbol;

    inner.appendChild(back);
    inner.appendChild(front);
    article.appendChild(inner);
    boardEl.appendChild(article);
  });

  // Aplica o quita la clase que bloquea los clics a nivel CSS
  boardEl.classList.toggle('locked', state.locked);
}

/**
 * Actualiza solo los marcadores de texto.
 * Se llama independientemente desde el cronómetro cada segundo,
 * sin necesidad de reconstruir todo el tablero.
 *
 * Template literal: la sintaxis `${variable}` dentro de backticks
 * permite incrustar expresiones JavaScript en un string.
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
 * Punto de entrada del render: llama a los sub-renders.
 * Toda mutación de estado termina llamando a esta función.
 */
function render() {
  renderBoard();
  renderScoreboard();
}

// ------------------------------------------------------------
// CRONÓMETRO (stub — se implementa en sección 3)
// ------------------------------------------------------------
let timerInterval = null;

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ------------------------------------------------------------
// MANEJADORES DE EVENTOS
// Un solo listener en el tablero (delegación de eventos).
// Listeners separados para el botón de reinicio.
// Los listeners de dificultad (change) y teclado (keydown)
// se agregan en la sección 4.
// ------------------------------------------------------------

/**
 * DELEGACIÓN DE EVENTOS en el tablero.
 *
 * ¿Por qué un solo listener en el tablero y no uno por carta?
 * - Con 36 cartas tendríamos 36 listeners activos en memoria.
 * - Cuando initGame() reconstruye el tablero, habría que
 *   remover los 36 antiguos y agregar 36 nuevos.
 * - Con delegación, el listener vive en el padre (boardEl) y
 *   nunca se remueve ni se recrea. Solo el HTML interno cambia.
 *
 * ¿Cómo funciona la delegación?
 * Todos los eventos de clic "burbujean" (bubble) hacia arriba
 * en el árbol del DOM. Un clic en una carta hija llega hasta
 * el boardEl padre. Ahí lo capturamos y preguntamos:
 * "¿de cuál carta vino este evento?"
 *
 * event.target: el elemento exacto donde ocurrió el clic
 *   (puede ser el emoji dentro del div dentro del article).
 * closest('.card'): sube por los ancestros del target hasta
 *   encontrar el elemento con clase 'card'. Si el clic fue
 *   en el espacio vacío del tablero, retorna null.
 */
boardEl.addEventListener('click', (event) => {
  // Subimos desde el elemento exactamente clickeado hasta la carta
  const cardEl = event.target.closest('.card');

  // Si el clic no fue dentro de una carta, ignoramos el evento
  if (!cardEl) return;

  // dataset.id es un string; lo convertimos a número con Number()
  // para que coincida con los IDs numéricos en state.cards
  const cardId = Number(cardEl.dataset.id);

  handleCardFlip(cardId);
});

/**
 * Listener del botón de reinicio.
 * Lee la dificultad actual del select y reinicia el juego.
 */
restartBtn.addEventListener('click', () => {
  initGame(Number(difficultyEl.value));
});

// ------------------------------------------------------------
// ARRANQUE
// ------------------------------------------------------------
initGame(Number(difficultyEl.value));
