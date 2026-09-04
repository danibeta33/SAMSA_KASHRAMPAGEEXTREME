<script lang="ts">
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { stateRampage } from '../game/stateRampage.svelte';
	import { getWinFlashCell } from '../game/winFlash.svelte';
	import type { ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		// Índice en reelState.symbols = `row` de las Position del book (así las
		// indexa Board.svelte), o sea la key de la celda en winFlash.
		symbolIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const symbolInfo = $derived(
		getSymbolInfo({ rawSymbol: props.reelSymbol.rawSymbol, state: props.reelSymbol.symbolState }),
	);
	// Celda "vacía" del rampage: el símbolo viejo ya estalló y el nuevo todavía
	// está cayendo (lo dibuja RampageShatterLayer). No renderizar el del engine.
	const rampageHidden = $derived(stateRampage.hiddenSymbols.includes(props.reelSymbol));
	// Feedback de cluster ganador en cascada (undefined = esta celda no está
	// en el cluster o la secuencia ya terminó).
	const winFlash = $derived(
		getWinFlashCell({ reel: props.reelIndex, row: props.symbolIndex }),
	);
</script>

{#if rampageHidden}
	<!-- nada: la celda queda vacía hasta que aterrice el símbolo nuevo -->
{:else}
	<SymbolWrap
	x={getSymbolX(props.reelIndex)}
	y={props.reelSymbol.symbolY()}
	animating={symbolInfo.type === 'spine' &&
		(props.reelSymbol.symbolState === 'land' || props.reelSymbol.symbolState === 'win')}
>
	<Symbol
		state={props.reelSymbol.symbolState}
		rawSymbol={props.reelSymbol.rawSymbol}
		{winFlash}
		oncomplete={() => {
			if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
			if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
		}}
	/>
	</SymbolWrap>
{/if}
