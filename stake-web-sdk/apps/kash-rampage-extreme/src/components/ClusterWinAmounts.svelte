<script lang="ts" module>
	import ClusterWinAmount, { type RawWin, type Win } from './ClusterWinAmount.svelte';

	export type EmitterEventClusterWinAmounts = {
		type: 'showClusterWinAmounts';
		wins: RawWin[];
	};
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';

	const context = getContext();

	let wins: (Win & { labelX: number; labelY: number })[] = $state([]);

	context.eventEmitter.subscribeOnMount({
		showClusterWinAmounts: async (emitterEvent) => {
			// Resolución de colisiones: con 2+ clusters ganadores las anclas
			// pueden caer pegadas y las etiquetas se superponían. Cada etiqueta
			// nueva que choca con una ya colocada (solape en X e Y en unidades
			// de celda) se corre media celda hacia abajo hasta quedar libre.
			const placed: { x: number; y: number }[] = [];
			wins = emitterEvent.wins.map((rawWin) => {
				const x = rawWin.reel + 0.5;
				let y = rawWin.row - 0.5;
				let guard = 0;
				while (
					placed.some((p) => Math.abs(p.x - x) < 1.45 && Math.abs(p.y - y) < 0.5) &&
					guard++ < 10
				) {
					y += 0.55;
				}
				placed.push({ x, y });
				return { ...rawWin, labelX: x, labelY: y, oncomplete: () => {} };
			});
			const gerPromises = () =>
				wins.map(async (win, idx) => {
					await waitForResolve(
						(resolve) => (win.oncomplete = resolve),
						{ label: `ClusterWinAmounts.win[${idx}]`, timeoutMs: 2000 },
					);
				});
			await Promise.all(gerPromises());
			wins = [];
		},
	});
</script>

<BoardContainer>
	{#each wins as win}
		<ClusterWinAmount {win} labelX={win.labelX} labelY={win.labelY} />
	{/each}
</BoardContainer>
