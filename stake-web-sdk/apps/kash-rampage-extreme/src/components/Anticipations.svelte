<script lang="ts">
	import { OnMount } from 'components-shared';
	import { SECOND } from 'constants-shared/time';
	import { Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS, REEL_PADDING } from '../game/constants';
	import BoardContainer from './BoardContainer.svelte';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
	const hasAnticipation = $derived(
		context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);

	const boardH = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	// Columnas que NO están en anticipación → se oscurecen (spotlight sobre
	// las que sí). Índices en vivo del board.
	const dimReels = $derived(
		context.stateGame.board
			.map((reel, i) => (reel.reelState.anticipating ? -1 : i))
			.filter((i) => i >= 0),
	);

	// Scrim que sube 0→0.42 para hacer "spotlight": el board se oscurece y las
	// columnas energizadas (Anticipation, encima) resaltan. El frame pulsa
	// rosa (boardFrameGlow) para reforzar la tensión.
	let scrim = $state(0);
</script>

{#if hasAnticipation}
	<OnMount
		onmount={() => {
			context.eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
			context.eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_anticipation' });
			context.eventEmitter.broadcast({
				type: 'soundFade',
				name: 'sfx_anticipation',
				from: 0,
				to: 1,
				duration: SECOND,
			});
			const t0 = performance.now();
			const id = setInterval(() => {
				scrim = Math.min(((performance.now() - t0) / 300) * 0.55, 0.55);
			}, 30);

			return () => {
				clearInterval(id);
				scrim = 0;
				context.eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
				context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_anticipation' });
			};
		}}
	/>

	<!-- Spotlight: oscurece solo las columnas SIN anticipación -->
	<BoardContainer>
		{#each dimReels as ri}
			<Rectangle
				x={SYMBOL_SIZE * (ri + REEL_PADDING - 0.5)}
				y={0}
				width={SYMBOL_SIZE}
				height={boardH}
				backgroundColor={0x05050a}
				alpha={scrim}
			/>
		{/each}
	</BoardContainer>
{/if}

{#each context.stateGame.board as reel}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
