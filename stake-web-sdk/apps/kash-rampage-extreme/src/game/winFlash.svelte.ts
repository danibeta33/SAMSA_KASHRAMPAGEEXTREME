// ── Feedback de victoria del cluster: BRILLO + FLASH + BOING en cascada ─────
//
// Presentación del cluster ganador ANTES de que estalle (el pop de salida vive
// en winPop.svelte.ts). Corre sobre el board principal, que es el que muestra
// `boardWithAnimateSymbols` (Board.svelte) tras cada settle del tumble.
//
// Secuencia:
//   0. Instante cero, TODOS a la vez → se prende el sprite de brillo trasero
//      (la carta `_luz` del kit) con alpha 0.4. El cluster entero "se enciende"
//      apagado y queda esperando su turno.
//   1. Orden por CONEXIÓN dentro del cluster, arrancando y desempatando por
//      orden de lectura (arriba→abajo, izquierda→derecha) — ver `orderByCluster`.
//   2. Por símbolo: FLASH del brillo 0.4 → 1.0, y en paralelo el BOING del
//      sprite principal: 0.85 (anticipación) → 1.15 (impacto, backOut).
//   3. En ese mismo turno se ENCIENDE EL MARCO de esa celda (`isWinCellLit` →
//      SymbolSprite). Antes el marco salía en TODAS a la vez —`boardWithAnimate
//      Symbols` pone en `win` al cluster entero de un saque— y el cluster se
//      leía como un bloque que aparecía de golpe (feedback de dirección 15-09).
//      Ahora el marco entra con su símbolo, uno por uno.
//   4. Y con el marco, su SONIDO: la cadena (`sfx_marco_chain`), un eslabón por
//      turno, emitido desde este mismo bucle. Hasta el drop 15-09 el enmarcado
//      era mudo; entre medio el disparo vivió en SymbolSprite y volvió acá (ver
//      la nota larga en el paso 3 de `playWinFlash`).
//
// El ritmo de la cascada es SIEMPRE EL MISMO, gane 1 símbolo o gane 25:
// `staggerMs` es un paso FIJO (ver su nota). `maxSequenceMs` sigue arriba como
// techo, pero ya solo recorta los clusters enormes, que son los únicos que
// llegarían a pasarse del segundo y medio.
//
// Reparto de propiedades en PixiJS (importante, ver SymbolSprite.svelte):
//   · `glow`  → alpha del Sprite de brillo, que NO escala (si escalara con el
//               boing el halo respiraría y se comería la celda vecina).
//   · `scale` → scale de un Container propio que envuelve SOLO al sprite del
//               ícono. La celda (SymbolWrap) y el brillo quedan fuera de ese
//               Container, así que el golpe no mueve la grilla ni el halo.
//
// Los ESPECIALES (W / S / H4 con spritesheet propio, o Spine cuando entre el
// atlas) se filtran: tienen su clip y este flash se lo pisaría.

import { Tween } from 'svelte/motion';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { backOut, quadOut } from 'svelte/easing';
import { waitForTimeout } from 'utils-shared/wait';

import { eventEmitter } from './eventEmitter';
import type { Position } from './types';
import type { SymbolStateInfo } from './constants';
import { hasOwnClip, TWEEN_ABORT_GUARD_MS } from './winPop.svelte';

export const WIN_FLASH = {
	// Estado inicial del brillo para TODO el cluster (paso 0).
	glowIdle: 0.4,
	// Flash al llegarle el turno.
	glowFlash: 1,
	flashDuration: 90,
	// ── PASO FIJO entre símbolo y símbolo: 110 ms, SIEMPRE ──────────────────
	// Hasta el 15-09 esto era `MARCO_INTRO_MS` (667 ms): el siguiente símbolo
	// arrancaba recién cuando el anterior había terminado de enmarcarse. Como
	// el techo de abajo comprime el paso en los clusters grandes, la cascada
	// terminaba corriendo a DOS velocidades: un cluster de 16 enmarcaba cada
	// 110 ms —rápido, la cadena tensándose— y uno de 2 o 3 cada 667 ms, seis
	// veces más lento y con los eslabones del SFX sonando sueltos en vez de
	// apilados. Pedido de dirección: que la velocidad de los clusters grandes
	// —marco Y sonido— sea la de TODOS, gane 1 símbolo, 2 o el board entero.
	//
	// El valor es el paso que ya tenía el cluster de 16 (1650 / 15 = 110), o
	// sea el ritmo "rápido" que dirección aprobó de oído; ahora es el único.
	// Con él, un cluster de 2 enmarca en 110 ms en vez de 667 y los dos
	// eslabones se enciman igual que en una cadena larga (la polifonía de
	// `sfx_marco_chain` ya está para eso, ver SFX_POLYPHONY en sound.ts).
	//
	// Nota: los clusters de hasta 16 símbolos quedan gobernados por ESTE
	// número —el techo no los toca—, así que es el dial a mover si dirección
	// quiere la cadena más lenta o más rápida.
	staggerMs: 110,
	// ── TECHO DE LA CASCADA: 1.65 s de punta a punta ─────────────────────────
	// Tope de lo que puede durar la presentación entera. Con el paso fijo de
	// 110 ms solo entra a jugar de 16 símbolos para arriba: ahí el delay pasa
	// a ser `maxSequenceMs / (símbolos - 1)` y se comprime todavía más (el
	// board lleno, 25, enmarca cada 69 ms). De 16 para abajo manda `staggerMs`
	// y la cascada dura menos que este techo.
	//
	// Los marcos se SOLAPAN —cada entrada dura 667 ms y el siguiente arranca
	// mucho antes—, pero eso no rompe la lectura de a uno: lo que el ojo sigue
	// es el ORDEN en que aparecen, no que cada uno termine antes del próximo.
	//
	// Historial del valor, por si dirección quiere volver atrás: 2600 ms (un
	// símbolo por entrada COMPLETA de marco; se sintió eterno), 700 ms (se leía
	// como un barrido) y el 1650 de hoy, el medio de los dos.
	maxSequenceMs: 1650,
	// Boing: anticipación corta y seca, impacto con rebote.
	anticipation: { scale: 0.85, duration: 80, easing: quadOut },
	impact: { scale: 1.15, duration: 260, easing: backOut },
} as const;

type WinFlashCell = {
	/** alpha del sprite de brillo trasero (0 = apagado). */
	glow: Tween<number>;
	/** escala del sprite principal — nunca de la celda. */
	scale: Tween<number>;
};

export type { WinFlashCell };

// Las celdas van keyeadas por posición porque los símbolos del board los crea
// el engine (createReelForSpinning) y no podemos colgarles estado propio como
// en el tumble board. SvelteMap para que el `get` de SymbolSprite sea reactivo.
const cells = new SvelteMap<string, WinFlashCell>();

const keyOf = ({ reel, row }: Position) => `${reel}:${row}`;

// ── Turnos de la cascada ────────────────────────────────────────────────────
// Celdas a las que YA les llegó su turno. Es un set aparte de `cells` porque
// cubre TAMBIÉN a los especiales (W / S / KASH), que no tienen flash ni boing
// —corren su propio clip— pero sí marco y carta `_luz`, y hasta el 15-09 se
// encendían de golpe junto con el resto del cluster.
const litCells = new SvelteSet<string>();
// `active` distingue "la cascada está corriendo y esta celda todavía no entró"
// de "no hay cascada" (rampage sin premium, labPreview, board en reposo). Sin
// esa distinción, un marco fuera de la cascada no se encendería nunca.
const cascade = $state({ active: false });

/** Lo lee ReelSymbol para pasárselo al sprite (undefined = sin flash activo). */
export const getWinFlashCell = ({ reel, row }: Position) => cells.get(`${reel}:${row}`);

/**
 * ¿A esta celda ya le llegó su turno en la cascada? Lo lee SymbolSprite para
 * decidir si dibuja el marco de victoria (y, en los especiales, si prende la
 * carta `_luz` a full). Sin cascada activa devuelve `true` — el marco se
 * comporta como antes del 15-09.
 */
export const isWinCellLit = ({ reel, row }: Position) =>
	!cascade.active || litCells.has(`${reel}:${row}`);

/** Apaga el feedback: al asentar el board, al ocultarlo y antes de cada cluster. */
export const clearWinFlash = () => {
	cells.clear();
	litCells.clear();
	cascade.active = false;
};

// Vecinos ORTOGONALES en orden de lectura: arriba, izquierda, derecha, abajo.
// El orden importa — es el desempate cuando una celda toca a varias.
const ORTHOGONAL = [
	{ reel: 0, row: -1 },
	{ reel: -1, row: 0 },
	{ reel: 1, row: 0 },
	{ reel: 0, row: 1 },
] as const;

/**
 * Orden en el que se van enmarcando los símbolos.
 *
 * Dirección lo pidió "de izquierda a derecha, de arriba a abajo, o los que
 * estén conectados": las dos cosas a la vez, y el recorrido las junta. Es un
 * DFS —no un BFS— sobre el cluster: el DFS CAMINA por la forma, o sea que
 * cada símbolo que se enmarca toca al anterior, que es lo que hace que la
 * cadena se lea como una sola. Un BFS se expande en frente de onda y a la
 * segunda fila salta de la punta derecha a la izquierda.
 *
 * El orden de lectura entra dos veces: elige la celda de ARRANQUE (la más
 * arriba, y entre esas la más a la izquierda) y desempata los vecinos cuando
 * hay más de uno por dónde seguir.
 *
 * Resultado: una línea sale en orden de lectura puro; un bloque sale en
 * serpentina (izq→der en la fila de arriba, baja, der→izq en la siguiente);
 * una L o una U se recorren siguiendo el brazo.
 *
 * Si la presentación trae varios grupos INCONEXOS (dos clusters del mismo
 * símbolo, o el Premium Accent del RAMPAGE sobre celdas sueltas), cada grupo
 * arranca cuando se terminó el anterior, otra vez en orden de lectura.
 */
const orderByCluster = (targets: Position[]) => {
	const reading = [...targets].sort((a, b) => a.row - b.row || a.reel - b.reel);
	const byKey = new Map(reading.map((position) => [keyOf(position), position]));
	const visited = new Set<string>();
	const ordered: Position[] = [];

	reading.forEach((seed) => {
		if (visited.has(keyOf(seed))) return; // ya lo recorrió un grupo previo
		const stack: Position[] = [seed];
		while (stack.length) {
			const current = stack.pop() as Position;
			const key = keyOf(current);
			// Una celda puede entrar a la pila por dos vecinos distintos: se
			// descarta al SACARLA, no al apilarla, porque hasta ese momento no se
			// sabe cuál de los dos caminos va a llegar primero.
			if (visited.has(key)) continue;
			visited.add(key);
			ordered.push(current);
			// Al revés: la pila devuelve el último, así que el vecino que va
			// primero en orden de lectura tiene que apilarse último.
			for (let i = ORTHOGONAL.length - 1; i >= 0; i -= 1) {
				const delta = ORTHOGONAL[i];
				const neighbour = byKey.get(
					keyOf({ reel: current.reel + delta.reel, row: current.row + delta.row }),
				);
				if (neighbour && !visited.has(keyOf(neighbour))) stack.push(neighbour);
			}
		}
	});

	return ordered;
};

// Misma red de seguridad que el pop de salida: la promesa de un `Tween.set()`
// ABORTADO no resuelve NUNCA (ver TWEEN_ABORT_GUARD_MS en winPop.svelte.ts) y la
// presentación del cluster —que la ronda ESPERA— se quedaría colgada ahí.
const settleTween = (tween: Promise<unknown>, durationMs: number) =>
	Promise.race([tween, waitForTimeout(durationMs + TWEEN_ABORT_GUARD_MS)]);

/**
 * Paso FIJO entre símbolo y símbolo —el mismo para un cluster de 2 que para
 * uno de 16—, comprimido solo cuando el cluster es tan grande que la cascada
 * entera se pasaría de `maxSequenceMs`.
 */
const staggerFor = (count: number) =>
	count > 1 ? Math.min(WIN_FLASH.staggerMs, WIN_FLASH.maxSequenceMs / (count - 1)) : 0;

/**
 * Anima el feedback de victoria de un cluster.
 *
 * @param positions     posiciones ganadoras crudas del book (pueden venir
 *                      repetidas si un símbolo entra en dos wins).
 * @param getSymbolInfo resuelve el símbolo de cada celda — lo inyecta el caller
 *                      (Board.svelte) para no acoplar este módulo a game/utils.
 * @returns las posiciones del cluster, en el orden en que se enmarcaron.
 */
export const playWinFlash = async ({
	positions,
	getSymbolInfo,
}: {
	positions: Position[];
	getSymbolInfo: (position: Position) => SymbolStateInfo | undefined;
}) => {
	clearWinFlash();

	// ── 1. Filtro: sin duplicados ────────────────────────────────────────────
	// `targets` son TODAS las celdas ganadoras, ESPECIALES INCLUIDOS: la cascada
	// es el orden en el que se van ENMARCANDO, y el marco lo lleva todo el que
	// anota. Lo que los especiales se saltean es la celda de flash/boing (su
	// clip propio se lo pisaría) — de ahí que `cells` se llene solo para el
	// resto y `getWinFlashCell` siga devolviendo `undefined` en ellos.
	const targets: Position[] = [];
	const seen = new Set<string>();
	positions.forEach((position) => {
		const key = keyOf(position);
		if (seen.has(key)) return;
		const symbolInfo = getSymbolInfo(position);
		if (!symbolInfo) return;
		seen.add(key);
		targets.push(position);
		if (hasOwnClip({ symbolInfo })) return; // ← especial: sin flash ni boing
		// ── Seteo SIMULTÁNEO (instante cero): brillo prendido al 40% ────────
		cells.set(keyOf(position), {
			glow: new Tween(WIN_FLASH.glowIdle),
			scale: new Tween(1),
		});
	});

	if (targets.length === 0) return [];

	// ── 2. Orden: por conexión, arrancando y desempatando por orden de lectura
	const sequence = orderByCluster(targets);

	// ── 3. Cascada: cada ítem espera su delay y enciende marco + flash + boing
	const stagger = staggerFor(sequence.length);
	cascade.active = true;

	await Promise.all(
		sequence.map(async (position, index) => {
			await waitForTimeout(index * stagger);

			// TURNO de esta celda: se enciende su MARCO (y, en los especiales,
			// su carta `_luz`). Lo lee SymbolSprite vía `isWinCellLit`.
			litCells.add(keyOf(position));
			// ── Y SU ESLABÓN DE CADENA, en el mismo turno ────────────────────
			// El disparo vuelve ACÁ después de haber vivido un tiempo en
			// SymbolSprite, colgado de un `$effect` sobre `marcoOn`. La idea allá
			// era que imagen y sonido no pudieran separarse; en la práctica pasó
			// al revés — el efecto dependía de TRES señales (`marcoOn`,
			// `marcoPhase`, `symbolState`) más un latch que solo se rearmaba si
			// el efecto llegaba a correr con el marco apagado, así que bastaba
			// que dos de esos cambios cayeran en el MISMO flush de Svelte para
			// que la celda se enmarcara muda. Reporte del usuario: "a veces, en
			// spins normales, se marcan objetos y no suena".
			//
			// Este bucle no tiene esa fragilidad: es el único lugar del juego que
			// decide "a ESTA celda le toca AHORA", corre exactamente una vez por
			// símbolo y no puede batchearse — cada vuelta está separada por su
			// propio `waitForTimeout`. Un símbolo marcado = un eslabón.
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_marco_chain' });

			const cell = cells.get(keyOf(position));
			if (!cell) return; // especial: su propio clip ES toda la animación

			// El flash del brillo y el boing del ícono arrancan juntos: el
			// destello acompaña al golpe, no lo precede.
			const flash = cell.glow.set(WIN_FLASH.glowFlash, {
				duration: WIN_FLASH.flashDuration,
				easing: quadOut,
			});

			const boing = (async () => {
				// Anticipación: -15%.
				await settleTween(
					cell.scale.set(WIN_FLASH.anticipation.scale, {
						duration: WIN_FLASH.anticipation.duration,
						easing: WIN_FLASH.anticipation.easing,
					}),
					WIN_FLASH.anticipation.duration,
				);
				// Impacto: +15% con rebote elástico.
				await settleTween(
					cell.scale.set(WIN_FLASH.impact.scale, {
						duration: WIN_FLASH.impact.duration,
						easing: WIN_FLASH.impact.easing,
					}),
					WIN_FLASH.impact.duration,
				);
			})();

			await Promise.all([settleTween(flash, WIN_FLASH.flashDuration), boing]);
		}),
	);

	return sequence;
};
