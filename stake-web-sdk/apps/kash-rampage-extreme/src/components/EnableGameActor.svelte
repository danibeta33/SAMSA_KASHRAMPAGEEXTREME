<script lang="ts">
	import { onMount } from 'svelte';

	import { Text } from 'pixi-svelte';
	import { stateModal, stateBet } from 'state-shared';

	import { gameActor } from '../game/actor';
	import { getContext } from '../game/context';
	import { stateGame } from '../game/stateGame.svelte';

	type Props = {
		debug?: boolean;
	};

	const props: Props = $props();
	const context = getContext();

	onMount(() => {
		const { unsubscribe } = gameActor.subscribe((snapshot) => {
			context.stateXstate.value = snapshot.value;
			// const childActor = snapshot.children[snapshot.value];
		});

		gameActor.start();
		gameActor.send({ type: 'RENDERED' });

		// QA hooks (SOLO DEV — no van al build del ACP): exponen actor + emitter
		// para que qa_smoke.py dispare spins determinísticos y lea estado vivo.
		if (import.meta.env.DEV) {
			(window as any).__gameActor = gameActor;
			(window as any).__eventEmitter = context.eventEmitter;
			(window as any).__getXstate = () => context.stateXstate.value;
			(window as any).__stateModal = stateModal;
			(window as any).__stateBet = stateBet;
			// gameType ('basegame'/'freegame') — el QA de autoplay lo usa para no
			// marcar falso hang mientras corre un bonus (el counter se congela ahí).
			(window as any).__stateGame = stateGame;
		}

		return () => {
			// Equivalent to onDestroy(); Leave this comment for searching.
			unsubscribe();
			gameActor.stop();
		};
	});

	context.eventEmitter.subscribeOnMount({
		// Connect every actor with app.eventEmitter to avoid call actor directly
		bet: () => gameActor.send({ type: 'BET' }),
		autoBet: () => gameActor.send({ type: 'AUTO_BET' }),
		resumeBet: () => gameActor.send({ type: 'RESUME_BET' }),
	});
</script>

{#if props.debug}
	<Text
		x={context.stateLayoutDerived.canvasSizes().width}
		anchor={{ x: 1, y: 0 }}
		style={{ fill: 0xffffff }}
		text={JSON.stringify(context.stateXstate.value, undefined, 2)}
	/>
{/if}
