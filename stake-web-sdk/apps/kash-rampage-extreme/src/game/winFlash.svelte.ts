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
//   1. Orden de lectura (arriba→abajo, izquierda→derecha) + delay progresivo.
//   2. Por símbolo: FLASH del brillo 0.4 → 1.0, y en paralelo el BOING del
//      sprite principal: 0.85 (anticipación) → 1.15 (impacto, backOut).
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
import { SvelteMap } from 'svelte/reactivity';
import { backOut, quadOut } from 'svelte/easing';
import { waitForTimeout } from 'utils-shared/wait';

import type { Position } from './types';
import type { SymbolStateInfo } from './constants';
import { hasOwnClip, TWEEN_ABORT_GUARD_MS } from './winPop.svelte';

export const WIN_FLASH = {
	// Estado inicial del brillo para TODO el cluster (paso 0).
	glowIdle: 0.4,
	// Flash al llegarle el turno.
	glowFlash: 1,
	flashDuration: 90,
	// Delay entre símbolo y símbolo. Se comprime en clusters grandes (ver
	// `staggerFor`) para que un cluster de 25 no se coma 2.5s de ronda.
	staggerMs: 90,
	maxSequenceMs: 700,
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

/** Lo lee ReelSymbol para pasárselo al sprite (undefined = sin flash activo). */
export const getWinFlashCell = ({ reel, row }: Position) => cells.get(`${reel}:${row}`);

/** Apaga el feedback: al asentar el board, al ocultarlo y antes de cada cluster. */
export const clearWinFlash = () => cells.clear();

// Misma red de seguridad que el pop de salida: la promesa de un `Tween.set()`
// ABORTADO no resuelve NUNCA (ver TWEEN_ABORT_GUARD_MS en winPop.svelte.ts) y la
// presentación del cluster —que la ronda ESPERA— se quedaría colgada ahí.
const settleTween = (tween: Promise<unknown>, durationMs: number) =>
	Promise.race([tween, waitForTimeout(durationMs + TWEEN_ABORT_GUARD_MS)]);

/**
 * Reparte los símbolos del cluster en el tiempo sin estirar la ronda: el
 * stagger nominal se comprime cuando el cluster es grande.
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
 * @returns las posiciones que efectivamente se animaron.
 */
export const playWinFlash = async ({
	positions,
	getSymbolInfo,
}: {
	positions: Position[];
	getSymbolInfo: (position: Position) => SymbolStateInfo | undefined;
}) => {
	clearWinFlash();

	// ── 1. Filtro: sin duplicados y sin ESPECIALES (ya tienen animación) ─────
	const targets: Position[] = [];
	const seen = new Set<string>();
	positions.forEach((position) => {
		const key = keyOf(position);
		if (seen.has(key)) return;
		const symbolInfo = getSymbolInfo(position);
		if (!symbolInfo) return;
		if (hasOwnClip({ symbolInfo })) return; // ← especial: se lo salta
		seen.add(key);
		targets.push(position);
	});

	if (targets.length === 0) return [];

	// ── 2. Seteo SIMULTÁNEO (instante cero): brillo prendido al 40% ─────────
	targets.forEach((position) => {
		cells.set(keyOf(position), {
			glow: new Tween(WIN_FLASH.glowIdle),
			scale: new Tween(1),
		});
	});

	// ── 3. Orden de lectura: arriba→abajo, izquierda→derecha ────────────────
	//     (`row` es la fila del board, `reel` la columna).
	const sequence = [...targets].sort((a, b) => a.row - b.row || a.reel - b.reel);

	// ── 4. Cascada: cada ítem espera su delay y dispara flash + boing ───────
	const stagger = staggerFor(sequence.length);

	await Promise.all(
		sequence.map(async (position, index) => {
			const cell = cells.get(keyOf(position));
			if (!cell) return;

			await waitForTimeout(index * stagger);

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
