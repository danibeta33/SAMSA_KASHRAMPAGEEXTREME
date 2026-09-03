<script lang="ts" module>
	export type EmitterEventTransition = { type: 'transition' };
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';

	import TransitionAnimation from './TransitionAnimation.svelte';
	import { getContext } from '../game/context';
	import { enterCelebration, exitCelebration } from '../game/celebration.svelte';

	const context = getContext();

	let transitioning = $state(false);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		transition: async () => {
			transitioning = true;
			enterCelebration();
			await waitForResolve(
				(resolve) => (oncomplete = resolve),
				{ label: 'Transition', timeoutMs: 1500 },
			);
		},
	});
</script>

{#if transitioning}
	<TransitionAnimation
		oncomplete={() => {
			oncomplete();
			transitioning = false;
			exitCelebration();
		}}
	/>
{/if}
