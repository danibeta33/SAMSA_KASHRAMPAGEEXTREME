<script lang="ts">
	import { Container } from 'pixi-svelte';

	import TumbleSymbol from './TumbleSymbol.svelte';
	import { getContext } from '../game/context';

	const context = getContext();

	// (26-08) Sin capa de win-frames: el resalte del cluster es la carta LUZ
	// que dibuja SymbolSprite — el win_overlay (marco RS-37) se retiró por
	// decisión de dirección.
</script>

<!-- Símbolos -->
<Container>
	{#each context.stateGameDerived.tumbleBoardCombined() as tumbleSymbols, reelIndex (reelIndex)}
		{#each tumbleSymbols as tumbleSymbol}
			<TumbleSymbol {reelIndex} {tumbleSymbol} />
		{/each}
	{/each}
</Container>
