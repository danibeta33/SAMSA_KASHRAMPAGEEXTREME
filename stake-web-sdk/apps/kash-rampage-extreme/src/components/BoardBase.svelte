<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container } from 'pixi-svelte';

	import ReelSymbol from './ReelSymbol.svelte';
	import { getContext } from '../game/context';

	const context = getContext();

	// Motion blur SUTIL por columna mientras gira (port DH 25-08): un
	// BlurFilter vertical POR REEL, montado solo con la columna en movimiento
	// (en idle filters=null → costo cero). strengthY 3 / quality 4 — los
	// valores afinados en dead-heat (más blur empastaba el arte);
	// strengthX/strengthY y no blurX/blurY: los alias viejos disparan el
	// deprecation warning de Pixi en la consola de PROD.
	const blurFilters = context.stateGame.board.map(() => {
		const filter = new PIXI.BlurFilter({ strength: 0, quality: 4 });
		filter.strengthX = 0;
		filter.strengthY = 3;
		return filter;
	});

	// (26-08) Sin capa de win-frames: el resalte del cluster es la carta LUZ
	// que dibuja SymbolSprite — el win_overlay (marco RS-37) se retiró por
	// decisión de dirección.
</script>

<!-- Símbolos (blur vertical por columna solo mientras gira) -->
<Container>
	{#each context.stateGame.board as reel, reelIndex (reelIndex)}
		<Container filters={reel.reelState.motion !== 'stopped' ? [blurFilters[reelIndex]] : null}>
			{#each reel.reelState.symbols as reelSymbol}
				<ReelSymbol {reelIndex} {reelSymbol} />
			{/each}
		</Container>
	{/each}
</Container>
