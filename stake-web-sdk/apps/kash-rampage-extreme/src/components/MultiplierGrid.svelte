<script lang="ts" module>
	export type EmitterEventMultiplierGrid =
		| { type: 'multiplierGridShow' }
		| { type: 'multiplierGridHide' }
		| { type: 'multiplierGridUpdate'; grid: number[][] }
		| { type: 'multiplierGridClear' };
</script>

<script lang="ts">
	// STUB — wireframe multiplier-grid overlay (no Spine `payframe`).
	import { Container, Rectangle, Text } from 'pixi-svelte';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';

	const context = getContext();
	const DEFAULT_GRID: number[][] = [
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
	];

	let show = $state(false);
	let grid = $state<number[][]>(DEFAULT_GRID);

	context.eventEmitter.subscribeOnMount({
		multiplierGridShow: () => (show = true),
		multiplierGridHide: () => (show = false),
		multiplierGridUpdate: (emitterEvent) => (grid = emitterEvent.grid),
		multiplierGridClear: () => (grid = DEFAULT_GRID),
	});

	const badge = SYMBOL_SIZE * 0.38;
</script>

<BoardContainer>
	{#if show}
		{#each grid as reel, reelIndex}
			{#each reel as multiplier, rowIndex}
				{#if multiplier > 0}
					<Container
						x={(reelIndex + 0.5) * SYMBOL_SIZE}
						y={(rowIndex + 0.5) * SYMBOL_SIZE}
					>
						<Rectangle
							x={-badge / 2}
							y={-badge / 2}
							width={badge}
							height={badge}
							backgroundColor={0xe02330}
							alpha={0.85}
						/>
						{#if multiplier > 1}
							<Text
								text={`x${multiplier}`}
								anchor={{ x: 0.5, y: 0.5 }}
								style={{
									fill: 0xffffff,
									fontSize: SYMBOL_SIZE * 0.22,
									fontWeight: '900',
								}}
							/>
						{/if}
					</Container>
				{/if}
			{/each}
		{/each}
	{/if}
</BoardContainer>
