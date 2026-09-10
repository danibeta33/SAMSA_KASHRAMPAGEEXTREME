<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { Container } from 'pixi-svelte';

	import ReelSymbol from './ReelSymbol.svelte';
	import { isTopLayerSymbol } from '../game/utils';
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

<!-- Símbolos (blur vertical por columna solo mientras gira).

     ── CAPA SUPERIOR DE LOS ESPECIALES (drop 10-09) ──────────────────────────
     Pedido de dirección: WILD, SCATTER y KASH (con su marco) SIEMPRE por
     encima de los símbolos normales. En PIXI el zIndex solo ordena entre
     HERMANOS, y acá hay dos niveles — la columna y la celda — así que hacen
     falta los dos:
       · celda   → el zIndex que trae cada `SymbolWrap` (ver ReelSymbol), que
                   ordena al especial contra los normales de SU columna;
       · columna → el zIndex de acá, que sube la columna ENTERA cuando tiene
                   algún especial, para que ese especial también gane contra
                   los normales de las otras columnas.
     La columna no se puede aplanar en el contenedor de arriba: el BlurFilter
     del spin es por columna y necesita su propio Container. -->
<Container sortableChildren={true}>
	{#each context.stateGame.board as reel, reelIndex (reelIndex)}
		{@const hasTopLayer = reel.reelState.symbols.some((reelSymbol) =>
			isTopLayerSymbol({ rawSymbol: reelSymbol.rawSymbol }),
		)}
		<Container
			zIndex={hasTopLayer ? 1 : 0}
			filters={reel.reelState.motion !== 'stopped' ? [blurFilters[reelIndex]] : null}
		>
			{#each reel.reelState.symbols as reelSymbol, symbolIndex}
				<ReelSymbol {reelIndex} {symbolIndex} {reelSymbol} />
			{/each}
		</Container>
	{/each}
</Container>
