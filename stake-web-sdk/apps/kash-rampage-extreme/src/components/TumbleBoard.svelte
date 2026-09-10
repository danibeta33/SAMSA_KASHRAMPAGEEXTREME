<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	type AddingBoard = RawSymbol[][];
	type ExplodingPositions = Position[];

	export type EmitterEventTumbleBoard =
		| { type: 'tumbleBoardShow' }
		| { type: 'tumbleBoardHide' }
		| { type: 'tumbleBoardInit'; addingBoard: AddingBoard }
		| { type: 'tumbleBoardReset' }
		| { type: 'tumbleBoardExplode'; explodingPositions: ExplodingPositions }
		| { type: 'tumbleBoardRemoveExploded' }
		| { type: 'tumbleBoardSlideDown' };
</script>

<script lang="ts">
	import _ from 'lodash';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { BoardContext } from 'components-shared';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';

	import TumbleBoardBase from './TumbleBoardBase.svelte';
	import BoardContainer from './BoardContainer.svelte';
	import BoardMask from './BoardMask.svelte';
	import { getSymbolY, getSymbolInfo } from '../game/utils';
	import { createWinPop, TWEEN_ABORT_GUARD_MS } from '../game/winPop.svelte';
	import { getContext } from '../game/context';
	import { stateWinHighlight } from '../game/stateWinHighlight.svelte';

	const context = getContext();

	let show = $state(false);

	const createTumbleSymbol = ({ initY, rawSymbol }: { initY: number; rawSymbol: RawSymbol }) => {
		const symbolY = new Tween(initY);
		const oncomplete = () => {};

		const tumbleSymbol = $state({
			symbolY,
			rawSymbol,
			symbolState: 'static' as const,
			oncomplete,
			winPop: createWinPop(),
		});

		return tumbleSymbol;
	};

	const initTumbleBoardAdding = ({ addingBoard }: { addingBoard: AddingBoard }) => {
		return context.stateGameDerived.boardRaw().map((_, reelIndex) => {
			const addingReel = addingBoard[reelIndex] ?? [];

			const tumbleReelAdding = addingReel.map((rawSymbol, symbolIndex) => {
				const initY = getSymbolY(symbolIndex - 1 - addingReel.length);
				return createTumbleSymbol({ initY, rawSymbol });
			});

			return tumbleReelAdding;
		});
	};

	const initTumbleBoardBase = () => {
		return context.stateGameDerived.boardRaw().map((rawSymbolReel) => {
			const tumbleReelBase = rawSymbolReel.map((rawSymbol, symbolIndex) => {
				const initY = getSymbolY(symbolIndex - 1);
				return createTumbleSymbol({ initY, rawSymbol });
			});

			return tumbleReelBase;
		});
	};

	context.eventEmitter.subscribeOnMount({
		tumbleBoardShow: () => (show = true),
		tumbleBoardHide: () => (show = false),
		tumbleBoardInit: ({ addingBoard }) => {
			context.stateGame.tumbleBoardAdding = initTumbleBoardAdding({ addingBoard });
			context.stateGame.tumbleBoardBase = initTumbleBoardBase();
		},
		tumbleBoardReset: () => {
			context.stateGame.tumbleBoardAdding = [];
			context.stateGame.tumbleBoardBase = [];
		},
		tumbleBoardExplode: async ({ explodingPositions }) => {
			// Wireframe mode: drive the timing here directly with a local timeout
			// instead of waiting for the per-symbol `oncomplete` callback.
			// The SymbolSprite-based oncomplete is unreliable when several
			// state changes hit the same cell within one frame (cluster grande
			// + tumble cycle). For real assets, swap the `explosion` state to
			// a Spine with a `listener.complete` callback and restore the
			// `waitForResolve(oncomplete)` pattern.
			// Fin del resalte de cluster: al explotar, el resto del board
			// vuelve a alpha pleno (ver stateWinHighlight).
			stateWinHighlight.active = false;
			// DEDUPE obligatorio: el book puede mandar la MISMA celda dos veces
			// cuando el símbolo entra en dos clusters (el wild, típicamente) —
			// `playWinFlash` documenta y deduplica exactamente lo mismo del lado
			// del board principal. Sin esto se llamaba `winPop.play()` dos veces
			// sobre el mismo símbolo y la segunda abortaba los tweens de la
			// primera, dejando su promesa colgada: el cluster reventaba, no bajaba
			// nada y el spin quedaba clavado. `play()` ahora también se defiende,
			// pero deduplicar acá evita el doble `symbolState = explosion` y deja
			// el conteo de pops igual al de celdas.
			const seen = new Set<string>();
			const uniquePositions = explodingPositions.filter((position) => {
				const key = `${position.reel}:${position.row}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
			const pops = uniquePositions.map((position) => {
				const tumbleSymbol = context.stateGame.tumbleBoardBase[position.reel]?.[position.row];
				if (!tumbleSymbol) return Promise.resolve(false);
				tumbleSymbol.symbolState = 'explosion';
				// El pop corre sobre el sprite ganador (SymbolSprite lee los
				// tweens). Desde el 10-09 lo hacen TODOS, especiales incluidos:
				// los tres animados popean con el paso 2 estirado 200ms y su
				// clip sigue corriendo por dentro (ver winPop.svelte.ts).
				return tumbleSymbol.winPop.play({
					symbolInfo: getSymbolInfo({ rawSymbol: tumbleSymbol.rawSymbol, state: 'explosion' }),
				});
			});
			// Piso de 220ms: sobra ahora que los especiales también popean (el pop
			// más corto ya dura ~980ms), pero se mantiene como red de seguridad
			// para el caso de un `explodingPositions` vacío o con celdas que ya
			// no existen — ahí `pops` resuelve de inmediato y el ciclo pasaría de
			// largo sin leerse.
			await Promise.all([
				...pops,
				new Promise<void>((resolve) => setTimeout(resolve, 220)),
			]);
		},
		tumbleBoardRemoveExploded: () => {
			context.stateGame.tumbleBoardBase.forEach((tumbleReel, reelIndex) => {
				context.stateGame.tumbleBoardBase[reelIndex] = tumbleReel.filter(
					(tumbleSymbol) => tumbleSymbol.symbolState !== 'explosion',
				);
			});
		},
		tumbleBoardSlideDown: async () => {
			const getPromises = () =>
				_.flatten(
					context.stateGameDerived.tumbleBoardCombined().map((tumbleReel) => {
						return tumbleReel.map(async (tumbleSymbol, symbolIndex) => {
							const targetY = getSymbolY(symbolIndex - 1); // Refer to initTumbleBoardBase
							if (targetY !== tumbleSymbol.symbolY.current) {
								const bounceDuration = 200;

								// Mismo blindaje que el pop: si el tween se aborta su promesa
								// no resuelve NUNCA (ver TWEEN_ABORT_GUARD_MS en winPop) y la
								// caída entera se queda esperando. El timer garantiza avance.
								await Promise.race([
									tumbleSymbol.symbolY.set(targetY, {
										duration: bounceDuration,
										easing: backOut,
									}),
									waitForTimeout(bounceDuration + TWEEN_ABORT_GUARD_MS),
								]);
								// Si ganó el timer, la celda podría haber quedado a mitad de
								// camino: se la clava en su lugar para que la grilla quede
								// bien igual (no-op en el 99.9% de los casos).
								if (tumbleSymbol.symbolY.current !== targetY) {
									tumbleSymbol.symbolY.set(targetY, { duration: 0 });
								}

								if (symbolIndex > 0 && symbolIndex < tumbleReel.length - 1) {
									tumbleSymbol.symbolState = 'land';
									context.stateGameDerived.onSymbolLand({ rawSymbol: tumbleSymbol.rawSymbol });
									await waitForResolve(
										(resolve) => {
											tumbleSymbol.oncomplete = () => {
												tumbleSymbol.symbolState = 'static';
												resolve();
											};
										},
										{ label: `TumbleBoard.slideDown.land symbolIndex=${symbolIndex}`, timeoutMs: 2000 },
									);
								}
							}
						});
					}),
				);

			await Promise.all(getPromises());
		},
	});
</script>

{#if show}
	<BoardContext animate={false}>
		<BoardContainer>
			<BoardMask />
			<TumbleBoardBase />
		</BoardContainer>
	</BoardContext>

	<BoardContext animate={true}>
		<BoardContainer>
			<TumbleBoardBase />
		</BoardContainer>
	</BoardContext>
{/if}
