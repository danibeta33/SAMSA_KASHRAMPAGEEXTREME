<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| {
				type: 'boardWithAnimateSymbols';
				symbolPositions: Position[];
		  };
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
			// Piso de 250ms (el hold que había antes): un cluster de PURO especial
			// —el caso de los SCATTER— no anima nada acá y sin el piso la
			// presentación pasaría de largo sin que se lea.
			await Promise.all([
				playWinFlash({
					positions: symbolPositions,
					getSymbolInfo: (position) => {
						const reelSymbol =
							context.stateGame.board[position.reel]?.reelState.symbols[position.row];
						if (!reelSymbol) return undefined;
						return getSymbolInfo({ rawSymbol: reelSymbol.rawSymbol, state: 'win' });
					},
				}),
				waitForTimeout(250),
			]);
			symbolPositions.forEach((position) => {
				const reelSymbol = context.stateGame.board[position.reel]?.reelState.symbols[position.row];
				if (reelSymbol) reelSymbol.symbolState = 'postWinStatic';
			});
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
