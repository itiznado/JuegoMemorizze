// ============================================================
// JUEGO DE MEMORIA — Secciones 1, 2 y 3
// Estado + Render + Interacción + Cronómetro + Victoria
// ============================================================

// ------------------------------------------------------------
// DATOS: emojis que se usarán como contenido de las cartas.
// Hay 18 símbolos para cubrir el nivel de dificultad máximo.
// ------------------------------------------------------------
const SYMBOLS = [
  'Pares/Par1.jpg','Pares/Par2.jpg','Pares/Par3.jpg','Pares/Par4.jpg','Pares/Par5.jpg','Pares/Par6.jpg',
  'Pares/Par7.jpg','Pares/Par8.jpg','Pares/Par9.jpg','Pares/Par10.jpg','Pares/Par11.jpg','Pares/Par12.jpg',
  'Pares/Par13.jpg','Pares/Par14.jpg','Pares/Par15.jpg','Pares/Par16.jpg','Pares/Par17.jpg','Pares/Par18.jpg',
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
const soundMatch     = new Audio('Assets/ParEncontrado.mp3');
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
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
 * Incrementa el contador de parejas, desbloquea el tablero
 * y comprueba si el jugador ganó la partida.
 *
 * ¿Por qué la comprobación de victoria va aquí y no en render()?
 * render() solo debe leer el estado y dibujarlo. Si pusieramos
 * lógica de juego ahí, render() tendría efectos secundarios
 * (detener el cronómetro, mostrar un mensaje) que serían difíciles
 * de predecir y depurar. Las reglas del juego van en las mutaciones.
 */
function resolveMatch() {
  const [id1, id2] = state.flipped;

  // REPRODUCIR SONIDO
  soundMatch.currentTime = 0;
  soundMatch.play().catch(error => console.log(error));

  // LANZAR CONFETI: Calculamos el centro de la pantalla para una explosión sutil
  const cardEl1 = boardEl.querySelector(`.card[data-id="${id1}"]`);
  const cardEl2 = boardEl.querySelector(`.card[data-id="${id2}"]`);

  if (cardEl1 && cardEl2) {
    // Obtener la posición y tamaño de la primera carta en la pantalla
    const rect1 = cardEl1.getBoundingClientRect();
    // Calcular su centro (X e Y con respecto a la ventana del navegador)
    const x1 = rect1.left + rect1.width / 2;
    const y1 = rect1.top + rect1.height / 2;

    // Obtener la posición y tamaño de la segunda carta
    const rect2 = cardEl2.getBoundingClientRect();
    const x2 = rect2.left + rect2.width / 2;
    const y2 = rect2.top + rect2.height / 2;

    // Disparar una pequeña explosión en el centro de cada una
    triggerConfetti(x1, y1);
    triggerConfetti(x2, y2);
  }

  soundMatch.currentTime = 0;
  soundMatch.play().catch((error) => {
    console.log('No se pudo reproducir el sonido de pareja encontrada:', error);
  });

  state.cards.find(c => c.id === id1).isMatched = true;
  state.cards.find(c => c.id === id2).isMatched = true;

  state.matchedPairs += 1;
  state.flipped  = [];
  state.locked   = false;

  render();

  // La victoria se comprueba DESPUÉS de render() para que el jugador
  // vea la última pareja encontrada (con su color verde) antes de
  // que aparezca el mensaje de victoria.
  if (state.matchedPairs === state.totalPairs) {
    handleVictory();
  }
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

  // Primera carta del turno: también arrancamos el cronómetro.
  // Lo arrancamos aquí (y no en initGame) para que el tiempo solo
  // corra cuando el jugador ya tomó una decisión, no mientras mira
  // el tablero. timerRunning evita que se inicie dos veces.
  if (state.flipped.length === 0) {
    flipCard(cardId);
    startTimer();
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

    const img = document.createElement('img');
    img.src = card.symbol;
    img.alt = `Imagen de Juego de Memoria`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    front.appendChild(img);

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
/**CONFETI*/
function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let particles = [];

// ------------------------------------------------------------
// CRONÓMETRO
// ------------------------------------------------------------

// timerInterval guarda el ID que devuelve setInterval.
// Necesitamos ese ID para poder cancelar el intervalo con clearInterval.
// Vive fuera de las funciones porque tanto startTimer como stopTimer
// necesitan leer y escribir el mismo valor.
let timerInterval = null;

/**
 * Arranca el cronómetro si no está ya corriendo.
 *
 * setInterval(fn, 1000) ejecuta fn cada 1000ms (1 segundo) y devuelve
 * un ID numérico. Lo guardamos en timerInterval para poder cancelarlo.
 *
 * Dentro de la función incrementamos timerSeconds en el estado y
 * llamamos solo a renderScoreboard() (no a render() completo) porque
 * no hay razón para reconstruir todo el tablero de cartas cada segundo.
 */
function startTimer() {
  if (state.timerRunning) return; // Guardia: no iniciar si ya corre
  state.timerRunning = true;

  timerInterval = setInterval(() => {
    state.timerSeconds += 1;
    renderScoreboard(); // Solo actualiza los números, no el tablero
  }, 1000);
}

/**
 * Detiene el cronómetro.
 * clearInterval con el ID guardado cancela el intervalo.
 * Ponemos timerInterval en null como señal de "no hay intervalo activo".
 */
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  state.timerRunning = false;
}

// ------------------------------------------------------------
// VICTORIA
// ------------------------------------------------------------

/**
 * Se llama cuando matchedPairs === totalPairs.
 * Detiene el cronómetro y muestra el mensaje con los resultados.
 *
 * ¿Por qué mostramos el mensaje con un pequeño retardo (600ms)?
 * Para que la animación de la última carta termine de voltear antes
 * de que aparezca el overlay de victoria. Sin el retardo, el mensaje
 * aparece mientras la carta todavía está girando, lo cual es abrupto.
 *
 * victoryDetails.textContent: modificamos directamente el texto
 * del párrafo dentro del mensaje de victoria. No usamos innerHTML
 * porque el contenido es solo texto, no HTML. textContent es más
 * seguro y semánticamente correcto para texto plano.
 */
function handleVictory() {
  stopTimer();

  setTimeout(() => {
    victoryDetails.textContent =
      `Tiempo: ${state.timerSeconds}s · Movimientos: ${state.moves}`;
    victoryMsgEl.classList.remove('hidden');
  }, 600);
}

/**
 * Crea una pequeña explosión de confeti en una posición x, y en la pantalla.
 */
function triggerConfetti(x, y) {
  const colors = ['#ff5733', '#33ff57', '#3357ff', '#f3ff33', '#ff33f3', '#33fff0'];
  
  // Creamos solo 30 partículas para que no sea una explosión gigante
  for (let i = 0; i < 90; i++) {
    particles.push({
      x: x,
      y: y,
      size: Math.random() * 6 + 4, // Tamaño entre 4px y 10px
      color: colors[Math.floor(Math.random() * colors.length)],
      // Velocidad y dirección (ángulo aleatorio en 360 grados)
      speedX: (Math.random() - 0.5) * 8, 
      speedY: (Math.random() - 0.5) * 8 - 3, // Ligera fuerza inicial hacia arriba
      gravity: 0.2,
      opacity: 1
    });
  }
  
  // Si es la primera partícula, iniciamos el bucle de animación
  if (particles.length === 90) {
    animateConfetti();
  }
}

/**
 * Bucle de animación encargado de dibujar y mover el confeti.
 */
function animateConfetti() {
  if (particles.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((p, index) => {
    p.x += p.speedX;
    p.y += p.speedY;
    p.speedY += p.gravity; // Aplica gravedad
    p.opacity -= 0.015;    // Desvanecimiento gradual

    // Dibujar el papelito (un rectángulo rotando ligeramente)
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();

    // Eliminar partículas invisibles o fuera de la pantalla
    if (p.opacity <= 0 || p.y > canvas.height) {
      particles.splice(index, 1);
    }
  });

  requestAnimationFrame(animateConfetti);
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