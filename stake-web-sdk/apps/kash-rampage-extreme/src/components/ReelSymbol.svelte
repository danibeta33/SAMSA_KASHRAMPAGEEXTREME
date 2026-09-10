<script lang="ts">
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { stateRampage } from '../game/stateRampage.svelte';
	import { getWinFlashCell } from '../game/winFlash.svelte';
	import { getAnticipationGlow, getAnticipationAlpha } from '../game/stateAnticipation.svelte';
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
	// Anticipación (v5): el foco lo dan los símbolos, no un rectángulo.
	//  · antGlow  → brillo 0→1 de ESTA celda. Sigue al frente de luz que baja
	//    por la columna, así que sale de la Y EN VIVO del símbolo y no de su
	//    índice: durante la anticipación la columna está girando y las celdas
	//    se mueven bajo el barrido.
	//  · antAlpha → atenuación de las columnas ya frenadas (spotlight).
	const antGlow = $derived(
		getAnticipationGlow({ reelIndex: props.reelIndex, y: props.reelSymbol.symbolY() }),
	);
	const antAlpha = $derived(getAnticipationAlpha({ reelIndex: props.reelIndex }));
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
		{antGlow}
		{antAlpha}
		oncomplete={() => {
			if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
			if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
		}}
	/>
	</SymbolWrap>
{/if}
