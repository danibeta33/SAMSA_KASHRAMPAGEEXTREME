<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<MultiplierGrid>',
	});
</script>

<script lang="ts">
	import { StoryGameTemplate, StoryLocale, type TemplateArgs, templateArgs } from 'components-storybook';

	import Game from '../components/Game.svelte';
	import { setContext, getContext } from '../game/context';

	setContext();
	const { eventEmitter } = getContext();

	const EMPTY_GRID: number[][] = [
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0],
	];

	const SPARSE_GRID: number[][] = [
		[0, 0, 0, 1, 0, 0, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 1, 1, 1, 1, 1, 0],
		[1, 1, 1, 2, 1, 1, 1],
		[0, 1, 1, 1, 1, 1, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 0, 0, 0],
	];

	const FULL_GRID: number[][] = [
		[2, 3, 5, 2, 3, 5, 2],
		[3, 5, 10, 3, 5, 10, 3],
		[5, 10, 25, 5, 10, 25, 5],
		[10, 25, 50, 100, 50, 25, 10],
		[5, 10, 25, 50, 25, 10, 5],
		[3, 5, 10, 25, 10, 5, 3],
		[2, 3, 5, 10, 5, 3, 2],
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
	name="empty grid"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { grid: EMPTY_GRID },
		action: async (data: { grid: number[][] }) => {
			eventEmitter.broadcast({ type: 'multiplierGridShow' });
			eventEmitter.broadcast({ type: 'multiplierGridUpdate', grid: data.grid });
		},
	})}
	{template}
/>

<Story
	name="sparse grid"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { grid: SPARSE_GRID },
		action: async (data: { grid: number[][] }) => {
			eventEmitter.broadcast({ type: 'multiplierGridShow' });
			eventEmitter.broadcast({ type: 'multiplierGridUpdate', grid: data.grid });
		},
	})}
	{template}
/>

<Story
	name="full grid"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { grid: FULL_GRID },
		action: async (data: { grid: number[][] }) => {
			eventEmitter.broadcast({ type: 'multiplierGridShow' });
			eventEmitter.broadcast({ type: 'multiplierGridUpdate', grid: data.grid });
		},
	})}
	{template}
/>
