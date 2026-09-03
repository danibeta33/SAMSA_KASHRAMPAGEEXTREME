<script lang="ts">
	// Anticipación v4 (pedido de dirección 15-07): SOLO un glow — nada de marcos
	// estroboscópicos ni rieles. Halo lima suave alrededor de la columna,
	// respirando y subiendo de intensidad hacia el reveal. El spotlight que
	// oscurece las demás columnas vive en Anticipations.svelte (queda igual).
	// El halo se construye con capas concéntricas de alpha decreciente
	// (Pixi sin filtros externos). `oncomplete` mantiene el timing del spin.
	import { onMount, onDestroy } from 'svelte';
	import { Container, Rectangle } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS, REEL_PADDING } from '../game/constants';
	import BoardContainer from './BoardContainer.svelte';

	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	const TOTAL_DURATION_MS = 900;
	const LIME = 0xf6ef1b;

	// intensity: 0→1 hacia el reveal. breath: respiración suave (no parpadeo).
	let intensity = $state(0);
	let breath = $state(1);

	let tick: ReturnType<typeof setInterval> | undefined;
	let doneTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		const t0 = performance.now();
		tick = setInterval(() => {
			const t = performance.now() - t0;
			intensity = Math.min(t / TOTAL_DURATION_MS, 1);
			breath = 0.85 + Math.sin(t / 180) * 0.15;
		}, 30);
		doneTimer = setTimeout(() => props.oncomplete?.(), TOTAL_DURATION_MS);
	});

	onDestroy(() => {
		if (tick) clearInterval(tick);
		if (doneTimer) clearTimeout(doneTimer);
	});

	const reelIndex = $derived(context.stateGame.board.indexOf(props.reel));
	const reelHeight = SYMBOL_SIZE * BOARD_DIMENSIONS.y;
	const reelWidth = SYMBOL_SIZE;
	const reelX = $derived(SYMBOL_SIZE * (reelIndex + REEL_PADDING - 0.5));
	const cx = $derived(reelX + reelWidth / 2);

	// Halo: capas concéntricas, la interna más brillante. Alpha total sube
	// con la carga y respira con `breath`.
	const glow = $derived((0.16 + intensity * 0.22) * breath);
	const LAYERS = [
		{ pad: 6, mult: 1 },
		{ pad: 16, mult: 0.55 },
		{ pad: 30, mult: 0.28 },
	];
</script>

{#if reelIndex >= 0}
	<BoardContainer>
		<Container x={cx} y={reelHeight / 2}>
			{#each LAYERS as layer}
				<Rectangle
					x={-reelWidth / 2 - layer.pad}
					y={-reelHeight / 2 - layer.pad}
					width={reelWidth + layer.pad * 2}
					height={reelHeight + layer.pad * 2}
					backgroundColor={LIME}
					alpha={glow * layer.mult}
				/>
			{/each}
		</Container>
	</BoardContainer>
{/if}
