<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Container } from 'pixi-svelte';
	import { getContextBoard } from 'components-shared';

	import { SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';
	// Grid X/Y stretch is applied by an ancestor Container in Game.svelte to
	// separate reel positions without touching the engine layout. We cancel the
	// stretch here so the symbol itself stays proportional — position gets
	// spread; sprite doesn't deform.
	// TODO: strip stateTweak coupling before approval; freeze final ratios in
	// stateGameDerived.boardLayout (or in getSymbolX / SYMBOL_SIZE constants).
	import { stateTweak } from '../game/stateTweak.svelte';
	import { getContext } from '../game/context';
	// gridStretch was renamed to boardStretch — same inverse-scale logic to
	// keep symbols proportional when the outer Container stretches positions.
	// In portrait the wrapper in Game.svelte collapses to identity (stretch 1),
	// so the inverse must collapse too — gate on the same aspect threshold.

	type Props = {
		x: number;
		y: number;
		animating: boolean;
		children: Snippet;
	};

	const props: Props = $props();
	const boardContext = getContextBoard();
	const context = getContext();
	const show = $derived(
		(boardContext.animate && props.animating) || (!boardContext.animate && !props.animating),
	);
	const top = 0;
	const bottom = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	const inFrame = $derived(props.y >= top && props.y <= bottom);
	const isLandscapeDecor = $derived.by(() => {
		const cs = context.stateLayoutDerived.canvasSizes();
		return cs.width / cs.height >= 1.2;
	});
	const invScale = $derived(
		isLandscapeDecor
			? { x: 1 / stateTweak.boardStretchX, y: 1 / stateTweak.boardStretchY }
			: { x: 1, y: 1 },
	);
</script>

{#if show && inFrame}
	<!-- `sortableChildren` (drop 09-09): dentro de la celda conviven el MARCO de
	     victoria (zIndex −1, al fondo) y el símbolo (zIndex 0). El marco monta
	     al ganar, o sea DESPUÉS del símbolo, y `addChild` apendea — sin orden
	     por profundidad quedaría dibujado ENCIMA del ícono en vez de detrás. -->
	<Container x={props.x} y={props.y} scale={invScale} sortableChildren={true}>
		{@render props.children()}
	</Container>
{/if}
