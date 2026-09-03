<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<GlobalMultiplier>',
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
	name="x1"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { multiplier: 1 },
		action: async (data: { multiplier: number }) => {
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			await eventEmitter.broadcastAsync({
				type: 'globalMultiplierUpdate',
				multiplier: data.multiplier,
			});
		},
	})}
	{template}
/>

<Story
	name="x5"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { multiplier: 5 },
		action: async (data: { multiplier: number }) => {
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			await eventEmitter.broadcastAsync({
				type: 'globalMultiplierUpdate',
				multiplier: data.multiplier,
			});
		},
	})}
	{template}
/>

<Story
	name="x20"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { multiplier: 20 },
		action: async (data: { multiplier: number }) => {
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			await eventEmitter.broadcastAsync({
				type: 'globalMultiplierUpdate',
				multiplier: data.multiplier,
			});
		},
	})}
	{template}
/>

<Story
	name="x100"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { multiplier: 100 },
		action: async (data: { multiplier: number }) => {
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			await eventEmitter.broadcastAsync({
				type: 'globalMultiplierUpdate',
				multiplier: data.multiplier,
			});
		},
	})}
	{template}
/>
