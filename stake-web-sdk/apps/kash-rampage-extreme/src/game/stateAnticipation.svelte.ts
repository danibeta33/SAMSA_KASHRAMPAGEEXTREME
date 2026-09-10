// Anticipación v5 (09-09): SIN rectángulos. El near-miss se lee ILUMINANDO los
// símbolos de las columnas que siguen girando —con su propia carta/clip `_luz`—
// en un barrido que baja de ARRIBA HACIA ABAJO, mientras el resto del board se
// atenúa. El spotlight nace del contraste entre símbolos, no de cajas.
//
// Reemplaza a los 3 halos lima concéntricos + el scrim negro de la v4, que
// invadían 30 px (37 %) de la columna vecina, se fusionaban en un bloque
// amarillo cuando había 3 columnas contiguas y lavaban al SCATTER —la barra de
// oro— justo con el color con el que se lo quería anunciar.
//
// Contra el resalte de VICTORIA (stateWinHighlight + winFlash) esto se
// distingue por el MOVIMIENTO: acá la luz VIAJA por la columna en bucle y los
// símbolos están girando; el win ilumina celdas quietas, en cascada de lectura
// y una sola vez, con su marco. Son dos sistemas independientes y ninguno pisa
// al otro (`dimmed` de win exige symbolState 'static'; en anticipación los
// símbolos están en 'spin').
import { SYMBOL_SIZE, BOARD_DIMENSIONS } from './constants';
import { stateGame } from './stateGame.svelte';

export const ANTICIPATION = {
	/**
	 * Duración del efecto = CONTRATO DE TIMING del spin. A los 900 ms
	 * Anticipation.svelte llama `oncomplete`, que apaga `anticipating`.
	 * Tocar este número mueve la secuencia entera del spin, no solo el brillo.
	 */
	// 09-09 (pedido de dirección): 900 → 1300 ms. Los 900 alcanzaban para el
	// near-miss pero NO para leer el efecto — el barrido apenas llegaba a
	// recorrer la columna una vez y media antes del reveal. Los +400 ms son
	// para percibir la columna encendida y cómo la luz baja por ella.
	// OJO: esto alarga la ronda. Con 2-3 columnas anticipadas son +0.8/1.2 s.
	durationMs: 1300,
	/**
	 * Entrada del brillo. Es CORTA a propósito: con la rampa vieja (0→1 en los
	 * 900 ms completos) el efecto recién llegaba a plena intensidad justo
	 * cuando ya estaba por apagarse, así que en pantalla "apenas se veía".
	 * Ahora entra suave pero rápido y DESPUÉS sigue engordando hacia el reveal
	 * (ver `swell` en Anticipations.svelte).
	 */
	riseMs: 280,
	/**
	 * Período del barrido de luz que baja por la columna. Subido junto con la
	 * duración: con 460 ms sobre 1300 el frente pasaba casi 3 veces y se leía
	 * como parpadeo. A 620 son ~2 pasadas, cada una seguible con el ojo.
	 */
	sweepMs: 620,
	/** Alto del frente de luz, en px de board. Más ancho = barrido más blando. */
	band: SYMBOL_SIZE * 1.6,
	/**
	 * Brillo de piso de una columna anticipada (fuera del frente de luz).
	 * Alto a propósito: la columna entera tiene que leerse ENCENDIDA, y el
	 * barrido es el acento que la recorre — no el único momento en que se ve.
	 */
	floor: 0.6,
	/** Alpha al que caen las columnas que NO están en anticipación. */
	dimAlpha: 0.16,
	/** Peso del brillo ADITIVO que va ENCIMA del ícono (los 10 regulares). */
	addMult: 0.6,
	/** Ídem para los especiales (W / S / KASH), sobre su clip `_luz`. */
	specialAddMult: 0.7,
} as const;

export const BOARD_HEIGHT = SYMBOL_SIZE * BOARD_DIMENSIONS.y;

/** Reloj compartido del efecto. Lo escribe Anticipations.svelte (uno solo). */
export const stateAnticipation = $state({
	/** 0 → 1 hacia el reveal. */
	intensity: 0,
	/** Respiración suave (no parpadeo). */
	breath: 1,
	/** Y del frente de luz, en px de board. Baja en bucle. */
	sweepY: 0,
	/**
	 * Milisegundos desde que arrancó la anticipación. Es el reloj del MARCO.
	 *
	 * Tiene que ser COMPARTIDO y no uno por celda: durante la anticipación la
	 * columna está GIRANDO, así que cada celda vive ~133 ms en pantalla
	 * (400 px de board a 3 px/ms) y se desmonta. Un marco que arrancara su
	 * propia entrada al montar solo llegaría a ~5 de sus 21 frames antes de
	 * irse — nunca se formaría, y la columna se vería como una lluvia de
	 * marcos a medio dibujar.
	 *
	 * Con un reloj único todas las celdas muestran el MISMO frame a la vez:
	 * la que entra por arriba aparece con el marco ya armado, y la animación
	 * se lee como una sola que corre en la columna entera.
	 */
	elapsedMs: 0,
});

// Las columnas en anticipación se LEEN en vivo del board en vez de mantener una
// copia sincronizada: `anticipating` es la fuente de verdad (la pone el engine y
// la apaga el `oncomplete` de Anticipation.svelte), así que no hay ninguna lista
// que pueda quedar desfasada un frame ni sobrevivir al final de la ronda.
export const isAnticipatingReel = (reelIndex: number) =>
	!!stateGame.board[reelIndex]?.reelState.anticipating;

export const hasAnticipation = () =>
	stateGame.board.some((reel) => reel.reelState.anticipating);

/**
 * Brillo 0→1 de UN símbolo. 0 = sin efecto (no hay anticipación, o su columna
 * no está en ella). El pico sigue al frente de luz que baja; el piso mantiene
 * la columna entera algo más viva que en reposo para que se lea como pilar.
 */
export const getAnticipationGlow = ({ reelIndex, y }: { reelIndex: number; y: number }) => {
	if (!isAnticipatingReel(reelIndex)) return 0;
	const head = Math.max(0, 1 - Math.abs(y - stateAnticipation.sweepY) / ANTICIPATION.band);
	// Cuadrático: el frente queda marcado sin que el resto de la columna se
	// apague — lineal daba una rampa demasiado plana.
	const level = ANTICIPATION.floor + (1 - ANTICIPATION.floor) * head * head;
	return Math.min(1, level * stateAnticipation.intensity * stateAnticipation.breath);
};

/**
 * Alpha del símbolo. Las columnas ya frenadas se atenúan, y lo hacen con la
 * MISMA rampa que el brillo: el spotlight entra suave, no de golpe.
 */
export const getAnticipationAlpha = ({ reelIndex }: { reelIndex: number }) => {
	if (isAnticipatingReel(reelIndex) || !hasAnticipation()) return 1;
	return 1 - (1 - ANTICIPATION.dimAlpha) * stateAnticipation.intensity;
};

/** Deja el reloj en reposo. Lo llama el cleanup del OnMount de Anticipations. */
export const resetAnticipation = () => {
	stateAnticipation.intensity = 0;
	stateAnticipation.breath = 1;
	stateAnticipation.sweepY = 0;
	stateAnticipation.elapsedMs = 0;
};
