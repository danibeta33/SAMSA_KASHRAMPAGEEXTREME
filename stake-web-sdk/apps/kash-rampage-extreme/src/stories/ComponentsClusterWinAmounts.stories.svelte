<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<ClusterWinAmounts>',
	});
</script>

<script lang="ts">
	import { StoryGameTemplate, StoryLocale, type TemplateArgs, templateArgs } from 'components-storybook';

	import type { RawWin } from '../components/ClusterWinAmount.svelte';
	import Game from '../components/Game.svelte';
	import { setContext, getContext } from '../game/context';

	setContext();
	const { eventEmitter } = getContext();

	// ClusterWinAmount labels auto-hide after ~800ms. To make the story useful as
	// a playground, we re-broadcast in a loop so the labels stay visible while
	// the story is open.
	const loopBroadcast = async (wins: RawWin[]) => {
		for (let i = 0; i < 1000; i += 1) {
			await eventEmitter.broadcastAsync({ type: 'showClusterWinAmounts', wins });
		}
	};

	const ONE_CLUSTER: RawWin[] = [
		{ win: 20_000_000, mult: 1, result: 20_000_000, reel: 2, row: 3 },
	];

	const THREE_CLUSTERS: RawWin[] = [
		{ win: 20_000_000, mult: 1, result: 20_000_000, reel: 0, row: 2 },
		{ win: 50_000_000, mult: 2, result: 100_000_000, reel: 3, row: 4 },
		{ win: 75_000_000, mult: 1, result: 75_000_000, reel: 5, row: 1 },
	];

	const FIVE_CLUSTERS: RawWin[] = [
		{ win: 30_000_000, mult: 1, result: 30_000_000, reel: 1, row: 2 },
		{ win: 60_000_000, mult: 3, result: 180_000_000, reel: 2, row: 3 },
		{ win: 90_000_000, mult: 5, result: 450_000_000, reel: 3, row: 3 },
		{ win: 40_000_000, mult: 2, result: 80_000_000, reel: 2, row: 4 },
		{ win: 25_000_000, mult: 1, result: 25_000_000, reel: 4, row: 3 },
	];
</script>

{#snippet template(args: TemplateArgs<any>)}
	<StoryGameTemplate
		skipLoadingScreen={args.skipLoadingScreen}
		action={async () => {
			await args.action?.(args.data);
		}}
	>
		<StoryLocale lang="en">
			<Game />
		</StoryLocale>
	</StoryGameTemplate>
{/snippet}

<Story
	name="one cluster"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { wins: ONE_CLUSTER },
		action: async (data: { wins: RawWin[] }) => {
			await loopBroadcast(data.wins);
		},
	})}
	{template}
/>

<Story
	name="three clusters dispersed"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { wins: THREE_CLUSTERS },
		action: async (data: { wins: RawWin[] }) => {
			await loopBroadcast(data.wins);
		},
	})}
	{template}
/>

<Story
	name="five clusters overlapping"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { wins: FIVE_CLUSTERS },
		action: async (data: { wins: RawWin[] }) => {
			await loopBroadcast(data.wins);
		},
	})}
	{template}
/>
