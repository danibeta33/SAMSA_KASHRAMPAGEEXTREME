// Anticipación v6 (10-09): la iluminación va DIRIGIDA POR LOS FRAMES de
// `Marco_2` (el clip de columna), no por un barrido con reloj propio.
//
// La v5 tenía un frente de luz que bajaba con su propio período (620 ms) y por
// debajo, aparte, el marco animando a 15 fps. Eran dos relojes distintos sobre
// el mismo objeto: la barra crecía por un lado y la luz bajaba por otro, así
// que nunca se leía la relación entre las dos cosas — el "no se capta bien" del
// feedback. Ahora hay UN solo reloj: el frame del clip. La barra llega a un
// objeto y ESE objeto se enciende, porque la tabla de abajo dice exactamente eso.
//
// Contra el resalte de VICTORIA (stateWinHighlight + winFlash) esto sigue
// siendo un sistema aparte y no se pisan: `dimmed` de win exige symbolState
// 'static' y durante la anticipación los símbolos están en 'spin'.
import { SYMBOL_SIZE, BOARD_DIMENSIONS } from './constants';
import { stateGame } from './stateGame.svelte';

// ── EL CLIP ─────────────────────────────────────────────────────────────────
/** `Marco_2` / animación `Marco_Columna`: 26 frames. */
export const MARCO_FRAME_COUNT = 26;
/** Pedido de dirección 10-09. */
export const MARCO_FPS = 15;
const FRAME_MS = 1000 / MARCO_FPS;

// Tramos del clip, en índice de TEXTURA (0..25). Dirección los numeró desde 1,
// así que acá van sus números MENOS UNO — los comentarios de la tabla usan SU
// numeración, para poder cotejarla contra lo que pidió sin traducir nada.
const INTRO_LAST = 4; // frames 1..5   · la barra crece hacia abajo
const IDLE_FIRST = 5; // frames 6..17  · idle, la barra ya está entera
const IDLE_LAST = 16;
const OUTRO_FIRST = 17; // frames 18..26 · la barra se vacía DESDE ARRIBA

const IDLE_LENGTH = IDLE_LAST - IDLE_FIRST + 1;

const INTRO_MS = (INTRO_LAST + 1) * FRAME_MS; // 333 ms
const OUTRO_MS = (MARCO_FRAME_COUNT - OUTRO_FIRST) * FRAME_MS; // 600 ms
/**
 * Cuánto se queda en el IDLE. Una vuelta = 800 ms. Es el ÚNICO número que hay
 * que tocar para alargar o acortar la anticipación: subirlo en múltiplos de
 * `IDLE_LENGTH * FRAME_MS` mantiene el bucle entero, así que la animación nunca
 * queda cortada a mitad de camino.
 */
const HOLD_MS = IDLE_LENGTH * FRAME_MS; // 800 ms

// ── TABLA DE ILUMINACIÓN ────────────────────────────────────────────────────
// Qué OBJETOS de la columna están encendidos en cada frame. El índice del array
// es el frame en la numeración de dirección MENOS UNO; los valores son los
// objetos 1..5 contando DESDE ARRIBA, también como los nombró dirección.
//
// Está escrita a mano y no derivada del arte a propósito: es una decisión de
// presentación, no una medición. Se toca acá, frame por frame, sin tener que
// entender nada más del archivo.
//
// ⚠ Cotejada contra el arte (bbox por frame del .json). La ENTRADA calza bien:
// al frame 3 la barra llega a la fila 2.7, al 4 a la 3.5 y al 5 a la 4.4 — o
// sea que el borde de la barra va pasando por cada objeto justo cuando la tabla
// lo prende. La SALIDA en cambio va MÁS RÁPIDO que el arte: la tabla apaga todo
// en el frame 20, pero la barra recién empieza a vaciarse ahí (al 20 liberó
// 0.85 filas) y en el último frame todavía ocupa de la fila 2.6 a la 3.8 —
// nunca se vacía del todo. Es lo que pidió dirección y se lee como que la luz
// se apaga y el marco se retira después; si se quiere que la luz siga al borde
// REAL de la barra, hay que estirar los frames 18..20 hasta el 24.
const ALL_OBJECTS = [1, 2, 3, 4, 5];
const LIT_BY_FRAME: readonly (readonly number[])[] = [
	[], //  1 · solo se oscurece el resto de la grilla
	[], //  2 · igual
	[1, 2, 3], //  3 · se encienden los objetos 1, 2 y 3
	[1, 2, 3, 4], //  4 · entra el 4
	ALL_OBJECTS, //  5 · entra el 5: la columna queda entera
	ALL_OBJECTS, //  6 ┐
	ALL_OBJECTS, //  7 │
	ALL_OBJECTS, //  8 │
	ALL_OBJECTS, //  9 │
	ALL_OBJECTS, // 10 │
	ALL_OBJECTS, // 11 │ idle: la columna se sostiene encendida
	ALL_OBJECTS, // 12 │
	ALL_OBJECTS, // 13 │
	ALL_OBJECTS, // 14 │
	ALL_OBJECTS, // 15 │
	ALL_OBJECTS, // 16 │
	ALL_OBJECTS, // 17 ┘
	[2, 3, 4, 5], // 18 · se apaga el 1
	[4, 5], // 19 · se apagan el 2 y el 3
	[], // 20 · se apagan el 4 y el 5
	[], // 21 ┐
	[], // 22 │
	[], // 23 │ la barra termina de retirarse sola; en el 23 la grilla
	[], // 24 │ ya volvió a su color normal
	[], // 25 │
	[], // 26 ┘
];

/** Precalculado a booleanos por fila (0..4): un símbolo no busca en un array. */
const LIT_ROWS: readonly (readonly boolean[])[] = LIT_BY_FRAME.map((objects) =>
	Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => objects.includes(row + 1)),
);

// ── ATENUACIÓN DEL RESTO DE LA GRILLA ───────────────────────────────────────
// Mismos índices que la tabla (frame de dirección menos uno). Entra en los dos
// primeros frames y sale a tiempo para que en el frame 23 la grilla ya esté en
// su color normal, como se pidió.
const DIM_IN_LAST = 1; // frame 2  · atenuación completa
const DIM_OUT_FIRST = 19; // frame 20 · empieza a volver
const DIM_OUT_LAST = 22; // frame 23 · grilla normal

export const ANTICIPATION = {
	/**
	 * Duración del efecto = CONTRATO DE TIMING del spin: al cumplirse,
	 * `Anticipation.svelte` llama `oncomplete` y eso apaga `anticipating`.
	 *
	 * Ya NO es un número suelto — sale de los tramos del clip, porque el pedido
	 * de dirección es justamente que la anticipación ESPERE a que `Marco_2`
	 * termine. Antes eran 1300 ms contra un clip de 1733: se cortaba en pleno
	 * idle y la salida de la barra no se veía nunca.
	 */
	durationMs: INTRO_MS + HOLD_MS + OUTRO_MS, // 1733 ms = los 26 frames
	/** Alpha al que caen las columnas que NO están en anticipación. */
	dimAlpha: 0.16,
	/** Peso del brillo ADITIVO que va ENCIMA del ícono (los 10 regulares). */
	addMult: 0.6,
	/** Ídem para los especiales (W / S / KASH), sobre su clip `_luz`. */
	specialAddMult: 0.7,
} as const;

export const BOARD_HEIGHT = SYMBOL_SIZE * BOARD_DIMENSIONS.y;

/**
 * Reloj ÚNICO del efecto: el frame del clip. Lo escribe Anticipations.svelte.
 * De acá salen las tres cosas que antes iban por caminos separados —el frame
 * que dibuja el marco, qué objetos se iluminan y cuánto se atenúa el resto—, y
 * eso es lo que las mantiene en lockstep.
 */
export const stateAnticipation = $state({
	/** Índice de textura, 0..25. −1 = en reposo, sin anticipación. */
	frame: -1,
});

/** Frame del clip para un tiempo dado: entrada → idle en bucle → salida. */
export const marcoFrameAt = (elapsedMs: number) => {
	if (elapsedMs < INTRO_MS) {
		return Math.min(Math.floor(elapsedMs / FRAME_MS), INTRO_LAST);
	}
	const afterIntro = elapsedMs - INTRO_MS;
	if (afterIntro < HOLD_MS) {
		return IDLE_FIRST + (Math.floor(afterIntro / FRAME_MS) % IDLE_LENGTH);
	}
	const afterHold = afterIntro - HOLD_MS;
	return Math.min(OUTRO_FIRST + Math.floor(afterHold / FRAME_MS), MARCO_FRAME_COUNT - 1);
};

// Las columnas en anticipación se LEEN en vivo del board en vez de mantener una
// copia sincronizada: `anticipating` es la fuente de verdad (la pone el engine y
// la apaga el `oncomplete` de Anticipation.svelte), así que no hay ninguna lista
// que pueda quedar desfasada un frame ni sobrevivir al final de la ronda.
export const isAnticipatingReel = (reelIndex: number) =>
	!!stateGame.board[reelIndex]?.reelState.anticipating;

export const hasAnticipation = () => stateGame.board.some((reel) => reel.reelState.anticipating);

const litAtRow = (frame: number, row: number) => {
	const rows = LIT_ROWS[frame];
	if (!rows) return 0;
	return row >= 0 && row < rows.length && rows[row] ? 1 : 0;
};

/**
 * Brillo 0→1 de UN símbolo. 0 = sin efecto (no hay anticipación, su columna no
 * está en ella, o a su objeto todavía no le tocó).
 *
 * Se resuelve por POSICIÓN y no por símbolo porque durante la anticipación la
 * columna está girando: "el objeto 1" es lo que esté pasando por la fila de
 * arriba en ese momento, no una carta en particular.
 *
 * La interpolación entre filas vecinas no es un adorno: sin ella un símbolo a
 * mitad de camino entre dos filas saltaría de golpe entre encendido y apagado
 * mientras scrollea, y se leería como parpadeo.
 */
export const getAnticipationGlow = ({ reelIndex, y }: { reelIndex: number; y: number }) => {
	const frame = stateAnticipation.frame;
	if (frame < 0 || !isAnticipatingReel(reelIndex)) return 0;
	// getSymbolY(row) = (row + 0.5) * SYMBOL_SIZE → la inversa da la fila real.
	const rowFloat = y / SYMBOL_SIZE - 0.5;
	const row = Math.floor(rowFloat);
	const t = rowFloat - row;
	return litAtRow(frame, row) * (1 - t) + litAtRow(frame, row + 1) * t;
};

/** 0 = sin atenuar · 1 = atenuación completa. Sigue al frame, como todo acá. */
const dimAmountAt = (frame: number) => {
	if (frame < 0) return 0;
	if (frame <= DIM_IN_LAST) return (frame + 1) / (DIM_IN_LAST + 1);
	if (frame < DIM_OUT_FIRST) return 1;
	if (frame >= DIM_OUT_LAST) return 0;
	return 1 - (frame - DIM_OUT_FIRST) / (DIM_OUT_LAST - DIM_OUT_FIRST);
};

/** Alpha del símbolo. Solo baja en las columnas que NO están en anticipación. */
export const getAnticipationAlpha = ({ reelIndex }: { reelIndex: number }) => {
	if (isAnticipatingReel(reelIndex) || !hasAnticipation()) return 1;
	return 1 - (1 - ANTICIPATION.dimAlpha) * dimAmountAt(stateAnticipation.frame);
};

/** Deja el reloj en reposo. Lo llama el cleanup del OnMount de Anticipations. */
export const resetAnticipation = () => {
	stateAnticipation.frame = -1;
};
