// ── "Game juice" del cluster ganador: POP / BOING de salida ─────────────────
//
// Efecto de feedback explosivo que corre sobre el SÍMBOLO GANADOR — el sprite
// en sí (Container interno de SymbolSprite), NUNCA sobre SymbolWrap ni sobre
// el contenedor de la celda: esos llevan la posición del board (getSymbolX /
// symbolY del tumble) y el inverse-scale del boardStretch, así que escalarlos
// movería la grilla entera en vez de al ícono.
//
// Secuencia (3 pasos encadenados, en este orden exacto):
//   1. Anticipación → rota ~-12° y encoge a 0.75 (se "agacha" antes del salto)
//   2. Boing        → estira a 1.50 con backOut (rebote elástico, jugoso)
//   3. Desaparición → escala a 0 con cubicIn (acelera y limpia el tablero)
//
// Los símbolos ESPECIALES (W / S / H4 animados por spritesheet, y cualquier
// estado de tipo Spine cuando entre el atlas) TAMBIÉN hacen este pop desde el
// 10-09 (pedido de dirección: "no tienen la animación de boing final que el
// resto"). Antes quedaban afuera por `hasOwnClip` para no pisarles el clip;
// hoy conviven — el clip sigue corriendo en loop y el pop solo transforma el
// Container que lo envuelve, así que no hay nada que pisar.
//
// Lo que sí los diferencia es el TIEMPO: su paso 2 dura
// `WIN_POP_SPECIAL_EXTRA_MS` (200 ms) más que el de los regulares, de modo que
// el W / S / KASH "cuelga" en el aire un instante más largo y se lee como el
// símbolo importante del cluster. `hasOwnClip` sigue siendo el filtro de
// winFlash (la cascada de brillo, que ellos resuelven con su clip `_luz`).

import { Tween } from 'svelte/motion';
import { backOut, cubicIn, quadOut } from 'svelte/easing';

import { waitForTimeout } from 'utils-shared/wait';

import type { SymbolStateInfo } from './constants';

// Iconos con clip propio (spritesheet de llamas del kit 04-09). Debe espejar
// las claves de ANIM_SPECIAL en SymbolSprite.svelte — ese mapa está tipado
// contra `SelfAnimatedAssetKey`, así que agregar/quitar acá rompe la compilación
// allá si se desincronizan.
// ⚠ IDA Y VUELTA: `sym_h4` → `sym_l4` el 09-09 (se leyó el nombre del arte —
// "fajo de billetes" = Cash Stack = L4) y de vuelta a `sym_h4` el 10-09 por
// decisión de dirección: el FAJO **es** KASH, el símbolo premium. El tercer
// especial es entonces el premium de la math, y el medallón `h4.png` —que no es
// KASH— pasó a ser el arte estático de L4. La math no cambió: H4 paga
// 13.5…4900×, L4 1.4…120×; lo que se movió es qué arte dibuja cada identidad.
export const SELF_ANIMATED_ASSET_KEYS = ['sym_w', 'sym_s', 'sym_h4'] as const;
export type SelfAnimatedAssetKey = (typeof SELF_ANIMATED_ASSET_KEYS)[number];

const SELF_ANIMATED = new Set<string>(SELF_ANIMATED_ASSET_KEYS);

/** ¿El símbolo trae su propia animación (spritesheet o Spine)? */
export const hasOwnClip = ({ symbolInfo }: { symbolInfo: SymbolStateInfo }) =>
	symbolInfo.type === 'spine' || SELF_ANIMATED.has(symbolInfo.assetKey);

const DEG = Math.PI / 180;

// Tiempos y curvas de cada paso. Total ≈ 980ms — el boing lleva +500ms de
// "cuelgue" sobre los 220ms originales por pedido de dirección, así que el ciclo
// win → tumble respira más que el rebote del slide-down (200ms).
export const WIN_POP_STEPS = {
	// Paso 1 — anticipación: contra-rotación + encoje.
	anticipation: { duration: 110, easing: quadOut, scale: 0.75, rotation: -12 * DEG },
	// Paso 2 — impacto: +50% con rebote. `elasticOut` (svelte/easing) es el
	// swap directo si se quiere el gesto más cartoon.
	boing: { duration: 720, easing: backOut, scale: 1.5, rotation: 0 },
	// Paso 3 — desaparición: acelera hacia 0 y sale del board.
	vanish: { duration: 150, easing: cubicIn, scale: 0 },
} as const;

// Los especiales cuelgan 0.2s más en el paso 2 (ver la nota de arriba).
export const WIN_POP_SPECIAL_EXTRA_MS = 200;

export const WIN_POP_TOTAL_MS =
	WIN_POP_STEPS.anticipation.duration + WIN_POP_STEPS.boing.duration + WIN_POP_STEPS.vanish.duration;

// ── RED DE SEGURIDAD CONTRA TWEENS ABORTADOS ────────────────────────────────
// `Tween.set()` devuelve una promesa que NUNCA resuelve si el tween se ABORTA:
// Svelte saca la task del loop de rAF sin cumplirla (svelte/internal/client/
// loop.js → `abort()` es un `tasks.delete()` a secas, sin `fulfill()`). Y el
// ciclo del tumble AVANZA esperando estas promesas, así que UN solo abort
// congela la ronda entera: el cluster revienta, no baja ningún símbolo nuevo y
// el spin queda clavado. Margen sobre la duración nominal del paso para que el
// timer nunca le gane a un tween que sí está corriendo bien.
export const TWEEN_ABORT_GUARD_MS = 150;

/** Duración total del pop para ESTE símbolo (los especiales suman el extra). */
export const getWinPopTotalMs = ({ symbolInfo }: { symbolInfo: SymbolStateInfo }) =>
	WIN_POP_TOTAL_MS + (hasOwnClip({ symbolInfo }) ? WIN_POP_SPECIAL_EXTRA_MS : 0);

/**
 * Crea el par de tweens (escala + rotación) que consume SymbolSprite y la
 * función `play` que dispara la secuencia. Uno por símbolo del tumble board
 * (ver `createTumbleSymbol` en TumbleBoard.svelte).
 */
export const createWinPop = () => {
	const scale = new Tween(1);
	const rotation = new Tween(0);

	const reset = () => {
		scale.set(1, { duration: 0 });
		rotation.set(0, { duration: 0 });
	};

	// Corre un paso del pop contra un timer del mismo largo: si los tweens se
	// abortan (ver TWEEN_ABORT_GUARD_MS) el paso igual avanza y la ronda sigue.
	const settleStep = (tweens: Promise<unknown>[], durationMs: number) =>
		Promise.race([Promise.all(tweens), waitForTimeout(durationMs + TWEEN_ABORT_GUARD_MS)]);

	const run = async ({ symbolInfo }: { symbolInfo: SymbolStateInfo }) => {
		// Los especiales corren el MISMO gesto, con el paso 2 estirado.
		const boingDuration =
			WIN_POP_STEPS.boing.duration + (hasOwnClip({ symbolInfo }) ? WIN_POP_SPECIAL_EXTRA_MS : 0);

		reset();

		// Paso 1 — anticipación (rotación y escala en paralelo, mismo tiempo).
		const { anticipation, boing, vanish } = WIN_POP_STEPS;
		await settleStep(
			[
				scale.set(anticipation.scale, {
					duration: anticipation.duration,
					easing: anticipation.easing,
				}),
				rotation.set(anticipation.rotation, {
					duration: anticipation.duration,
					easing: anticipation.easing,
				}),
			],
			anticipation.duration,
		);

		// Paso 2 — boing: crece un 50% y vuelve a la vertical con backOut.
		await settleStep(
			[
				scale.set(boing.scale, { duration: boingDuration, easing: boing.easing }),
				rotation.set(boing.rotation, { duration: boingDuration, easing: boing.easing }),
			],
			boingDuration,
		);

		// Paso 3 — desaparición.
		await settleStep(
			[scale.set(vanish.scale, { duration: vanish.duration, easing: vanish.easing })],
			vanish.duration,
		);

		return true;
	};

	let inFlight: Promise<boolean> | null = null;

	/**
	 * Reproduce el pop sobre el símbolo ganador — regulares y especiales.
	 * Resuelve cuando terminó el paso 3, así quien lo llama puede encadenar el
	 * `removeExploded` del tumble.
	 *
	 * REENTRANTE a propósito: una segunda llamada mientras el pop está en vuelo
	 * devuelve la promesa QUE YA ESTÁ corriendo en vez de rearrancar. Rearrancar
	 * llamaría a `reset()`, que aborta los tweens de la primera pasada y deja SU
	 * promesa colgada para siempre — y como `tumbleBoardExplode` espera esa
	 * promesa para seguir, la ronda se congela con el cluster ya reventado y sin
	 * símbolos nuevos bajando. Pasa de verdad: las posiciones del book pueden
	 * venir REPETIDAS cuando un símbolo entra en dos clusters (el wild es el caso
	 * típico) — `playWinFlash` documenta y deduplica lo mismo del lado del board.
	 *
	 * @returns `true` (siempre anima; el boolean se mantiene por los llamadores).
	 */
	const play = ({ symbolInfo }: { symbolInfo: SymbolStateInfo }) => {
		if (inFlight) return inFlight;
		inFlight = run({ symbolInfo }).finally(() => {
			inFlight = null;
		});
		return inFlight;
	};

	return { scale, rotation, play, reset };
};

export type WinPop = ReturnType<typeof createWinPop>;
