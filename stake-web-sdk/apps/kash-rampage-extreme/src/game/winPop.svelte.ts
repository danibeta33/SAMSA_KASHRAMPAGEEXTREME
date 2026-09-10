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
// estado de tipo Spine cuando entre el atlas) quedan afuera: tienen clip
// propio y este pop les pisaría la animación. Ver `hasOwnClip`.

import { Tween } from 'svelte/motion';
import { backOut, cubicIn, quadOut } from 'svelte/easing';

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

export const WIN_POP_TOTAL_MS =
	WIN_POP_STEPS.anticipation.duration + WIN_POP_STEPS.boing.duration + WIN_POP_STEPS.vanish.duration;

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

	/**
	 * Reproduce el pop sobre el símbolo ganador.
	 * Resuelve cuando terminó el paso 3 (o de inmediato si es especial), así
	 * quien lo llama puede encadenar el `removeExploded` del tumble.
	 *
	 * @returns `true` si animó, `false` si se saltó por tener clip propio.
	 */
	const play = async ({ symbolInfo }: { symbolInfo: SymbolStateInfo }) => {
		// ⚠ Guard obligatorio: los especiales NO reciben este pop.
		if (hasOwnClip({ symbolInfo })) return false;

		reset();

		// Paso 1 — anticipación (rotación y escala en paralelo, mismo tiempo).
		const { anticipation, boing, vanish } = WIN_POP_STEPS;
		await Promise.all([
			scale.set(anticipation.scale, {
				duration: anticipation.duration,
				easing: anticipation.easing,
			}),
			rotation.set(anticipation.rotation, {
				duration: anticipation.duration,
				easing: anticipation.easing,
			}),
		]);

		// Paso 2 — boing: crece un 50% y vuelve a la vertical con backOut.
		await Promise.all([
			scale.set(boing.scale, { duration: boing.duration, easing: boing.easing }),
			rotation.set(boing.rotation, { duration: boing.duration, easing: boing.easing }),
		]);

		// Paso 3 — desaparición.
		await scale.set(vanish.scale, { duration: vanish.duration, easing: vanish.easing });

		return true;
	};

	return { scale, rotation, play, reset };
};

export type WinPop = ReturnType<typeof createWinPop>;
