<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| {
				type: 'boardWithAnimateSymbols';
				symbolPositions: Position[];
		  }
		// APAGAR una presentación de `boardWithAnimateSymbols` que NO termina en
		// tumble. Ver el handler para el porqué.
		| { type: 'boardAnimateSymbolsReset' };

	// Piso de presentación del cluster: un cluster de PURO especial (SCATTER) no
	// anima nada en `playWinFlash`, y sin este mínimo la presentación pasaría de
	// largo sin leerse.
	export const WIN_HIGHLIGHT_FLOOR_MS = 250;
	// Tiempo que el cluster queda ENCENDIDO una vez terminada la cascada, antes
	// de que el tumble lo reviente. 09-09: recortado 0.6s (1500 → 900) por
	// pedido de dirección — el hold se sentía largo.
	export const WIN_HIGHLIGHT_HOLD_MS = 900;
</script>

<script lang="ts">
	import { BoardContext } from 'components-shared';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { getSymbolInfo } from '../game/utils';
	import { playWinFlash, clearWinFlash } from '../game/winFlash.svelte';
	import { stateWinHighlight } from '../game/stateWinHighlight.svelte';
	import BoardContainer from './BoardContainer.svelte';
	import BoardMask from './BoardMask.svelte';
	import BoardBase from './BoardBase.svelte';
	import RampageShatterLayer from './RampageShatterLayer.svelte';

	const context = getContext();

	let show = $state(true);

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => context.stateGameDerived.enhancedBoard.stop(),
		boardSettle: ({ board }) => {
			stateWinHighlight.active = false;
			clearWinFlash();
			context.stateGameDerived.enhancedBoard.settle(board);
		},
		boardShow: () => (show = true),
		boardHide: () => {
			stateWinHighlight.active = false;
			clearWinFlash();
			show = false;
		},
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			stateWinHighlight.active = true;
			// Wireframe mode: drive timing locally instead of waiting for
			// per-symbol oncomplete (see TumbleBoard.svelte for the rationale).
			symbolPositions.forEach((position) => {
				const reelSymbol = context.stateGame.board[position.reel]?.reelState.symbols[position.row];
				if (reelSymbol) reelSymbol.symbolState = 'win';
			});
			// Brillo + flash + boing en cascada (winFlash.svelte.ts). Los
			// especiales quedan afuera: corren su propio spritesheet.
			// Piso `WIN_HIGHLIGHT_FLOOR_MS`: un cluster de PURO especial —el caso de
			// los SCATTER— no anima nada acá y sin el piso la presentación pasaría
			// de largo sin que se lea.
			await Promise.all([
				playWinFlash({
					positions: symbolPositions,
					getSymbolInfo: (position) => {
						const reelSymbol =
							context.stateGame.board[position.reel]?.reelState.symbols[position.row];
						if (!reelSymbol) return undefined;
						return getSymbolInfo({ rawSymbol: reelSymbol.rawSymbol, state: 'win' });
					},
					// La CADENA del marco la emite la propia cascada, un eslabón
					// por símbolo y en el mismo turno en que le enciende el marco
					// (ver `playWinFlash`). El stagger fijo de 110 ms es, además,
					// el que separa un eslabón del siguiente.
				}),
				waitForTimeout(WIN_HIGHLIGHT_FLOOR_MS),
			]);
			// HOLD extra: el cluster se queda ENCENDIDO (carta `_luz` + marco de
			// victoria + dim del resto) un rato más antes de pasar a
			// `postWinStatic` y que el tumble lo reviente. Pedido de dirección
			// 09-09: +0.9s sobre lo que duraba la cascada, para que el jugador
			// alcance a leer QUÉ símbolos ganaron.
			await waitForTimeout(WIN_HIGHLIGHT_HOLD_MS);
			symbolPositions.forEach((position) => {
				const reelSymbol = context.stateGame.board[position.reel]?.reelState.symbols[position.row];
				if (reelSymbol) reelSymbol.symbolState = 'postWinStatic';
			});
		},
		// ── APAGAR EL RESALTE (fix 09-09) ───────────────────────────────────────
		// `boardWithAnimateSymbols` deja las celdas en `postWinStatic` A PROPÓSITO
		// y no las devuelve solas: en el ciclo normal de cluster lo que sigue es
		// `tumbleBoard`, que hace `boardHide` + `boardSettle`, y el settle
		// RECONSTRUYE los ReelSymbol desde cero (`createReelSymbol` los nace en
		// `initialSymbolState`). O sea: el ciclo de tumble se limpia solo.
		//
		// El problema son las presentaciones que NO terminan en tumble. Hoy hay
		// una que corre sobre el MISMO board que después evalúa clusters: el
		// **Premium Accent** del KASH RAMPAGE (`bookEventHandlerMap.kashRampage`),
		// que pulsa las celdas convertidas a KASH/H4. Sin este apagado esas celdas
		// se quedaban en `postWinStatic` hasta el siguiente settle, y como
		// `isWinning` incluye ese estado, seguían mostrando su carta `_luz` y su
		// marco de victoria SIN ser ganadoras:
		//   · no hacen boing — `playWinFlash` ya se limpió, así que no tienen
		//     celda de winFlash y `glowReplacesIcon` deja solo la carta, quieta;
		//   · no explotan — no están en `explodingSymbols` del book;
		//   · y `stateWinHighlight.active` quedaba prendido, atenuando al 30 % a
		//     todo lo que no fuera ellas.
		// Se leía como "hay X iluminadas y con marco que no revientan mientras el
		// resto sí, y después se apagan solas" — el reporte del usuario con
		// captura.
		//
		// Devolver a `static` alcanza para apagar TODO el paquete: la carta luz,
		// el dim del resto y el marco (el `$effect` de SymbolSprite rearma
		// `marcoPhase` a 'intro' en cuanto el estado sale de win/postWinStatic).
		boardAnimateSymbolsReset: () => {
			stateWinHighlight.active = false;
			clearWinFlash();
			context.stateGame.board.forEach((reel) =>
				reel.reelState.symbols.forEach((reelSymbol) => {
					if (reelSymbol.symbolState === 'win' || reelSymbol.symbolState === 'postWinStatic') {
						reelSymbol.symbolState = 'static';
					}
				}),
			);
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if show}
	<BoardContext animate={false}>
		<BoardContainer>
			<BoardMask />
			<BoardBase />
			<!-- Fragmentos del batazo RAMPAGE — montados DESPUÉS de BoardBase para
			     volar por encima de los símbolos; una sola instancia (el contexto
			     animado no la necesita: durante el rampage nada gira). -->
			<RampageShatterLayer />
		</BoardContainer>
	</BoardContext>

	<!-- La máscara va en LOS DOS contextos (port DH 25-08): con el scroll
	     continuo la tira pasa por encima/debajo del tablero y sin máscara los
	     símbolos del strip se ven fuera del marco durante el spin. -->
	<BoardContext animate={true}>
		<BoardContainer>
			<BoardMask />
			<BoardBase />
		</BoardContainer>
	</BoardContext>
{/if}
