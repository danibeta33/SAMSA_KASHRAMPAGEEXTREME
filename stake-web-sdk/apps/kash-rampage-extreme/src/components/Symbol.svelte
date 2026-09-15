<script lang="ts">
	// Win-frame: cluster sample renders a SpineProvider (`payframe`).
	// Wireframe template replaces it with a Rectangle glow so we don't depend
	// on the anticipation Spine asset.
	import SymbolSpine from './SymbolSpine.svelte';
	import SymbolSprite from './SymbolSprite.svelte';
	import type { SymbolState, RawSymbol } from '../game/types';
	import type { WinPop } from '../game/winPop.svelte';
	import type { WinFlashCell } from '../game/winFlash.svelte';
	import { getSymbolInfo } from '../game/utils';
	import { getContext } from '../game/context';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		oncomplete?: () => void;
		loop?: boolean;
		// Pop de cluster ganador — solo lo trae el tumble board; el sprite es
		// quien lo aplica (a sí mismo, no a la celda).
		winPop?: WinPop;
		// Brillo + boing del cluster ganador — lo trae el board principal.
		winFlash?: WinFlashCell;
		// Turno de esta celda en la cascada de victoria: mientras sea `false` el
		// símbolo ya ganó pero todavía no le toca enmarcarse. `undefined` (tumble
		// board, anticipación) = sin cascada → se dibuja como siempre.
		winLit?: boolean;
		// Anticipación (v5): brillo 0→1 de la celda y alpha del spotlight. Los
		// calcula ReelSymbol; acá solo pasan de largo hasta el sprite, que es
		// quien enciende su carta/clip `_luz`.
		antGlow?: number;
		antAlpha?: number;
	};

	const props: Props = $props();
	const context = getContext();
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol: props.rawSymbol, state: props.state }));
	const isSprite = $derived(symbolInfo.type === 'sprite');
	// El win-frame del cluster se dibuja en BoardBase — una capa propia
	// DETRÁS de todos los símbolos (acá tapaba al ícono de la celda vecina
	// porque el stretch vertical solapa las celdas).
</script>

{#if isSprite}
	<SymbolSprite
		{symbolInfo}
		symbolState={props.state}
		rawSymbol={props.rawSymbol}
		x={props.x}
		y={props.y}
		oncomplete={props.oncomplete}
		winPop={props.winPop}
		winFlash={props.winFlash}
		winLit={props.winLit}
		antGlow={props.antGlow}
		antAlpha={props.antAlpha}
	/>
{:else}
	<SymbolSpine
		loop={props.loop}
		{symbolInfo}
		x={props.x}
		y={props.y}
		listener={{
			complete: props.oncomplete,
			event: (_, event) => {
				if (event.data?.name === 'wildExplode') {
					context.eventEmitter?.broadcast({ type: 'soundOnce', name: 'sfx_wild_explode' });
				}
			},
		}}
	/>
{/if}
