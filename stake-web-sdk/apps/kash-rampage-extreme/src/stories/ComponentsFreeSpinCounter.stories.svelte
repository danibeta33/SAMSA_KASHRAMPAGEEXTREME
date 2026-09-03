<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<FreeSpinCounter>',
	});
</script>

<script lang="ts">
	import { StoryGameTemplate, StoryLocale, type TemplateArgs, templateArgs } from 'components-storybook';

	import Game from '../components/Game.svelte';
	import { setContext, getContext } from '../game/context';

	setContext();
	const { eventEmitter } = getContext();
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
	name="count 0 of 10"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { current: 0, total: 10 },
		action: async (data: { current: number; total: number }) => {
			eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
			eventEmitter.broadcast({
				type: 'freeSpinCounterUpdate',
				current: data.current,
				total: data.total,
			});
		},
	})}
	{template}
/>

<Story
	name="count 5 of 10"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { current: 5, total: 10 },
		action: async (data: { current: number; total: number }) => {
			eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
			eventEmitter.broadcast({
				type: 'freeSpinCounterUpdate',
				current: data.current,
				total: data.total,
			});
		},
	})}
	{template}
/>

<Story
	name="count 10 of 10"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { current: 10, total: 10 },
		action: async (data: { current: number; total: number }) => {
			eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
			eventEmitter.broadcast({
				type: 'freeSpinCounterUpdate',
				current: data.current,
				total: data.total,
			});
		},
	})}
	{template}
/>
