<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<TumbleWinAmount>',
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
	name="small win"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { amount: 5_000_000 },
		action: async (data: { amount: number }) => {
			eventEmitter.broadcast({ type: 'tumbleWinAmountReset' });
			eventEmitter.broadcast({ type: 'tumbleWinAmountShow' });
			eventEmitter.broadcast({
				type: 'tumbleWinAmountUpdate',
				amount: data.amount,
				animate: false,
			});
		},
	})}
	{template}
/>

<Story
	name="medium win"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { amount: 500_000_000 },
		action: async (data: { amount: number }) => {
			eventEmitter.broadcast({ type: 'tumbleWinAmountReset' });
			eventEmitter.broadcast({ type: 'tumbleWinAmountShow' });
			eventEmitter.broadcast({
				type: 'tumbleWinAmountUpdate',
				amount: data.amount,
				animate: false,
			});
		},
	})}
	{template}
/>

<Story
	name="big win"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { amount: 50_000_000_000 },
		action: async (data: { amount: number }) => {
			eventEmitter.broadcast({ type: 'tumbleWinAmountReset' });
			eventEmitter.broadcast({ type: 'tumbleWinAmountShow' });
			eventEmitter.broadcast({
				type: 'tumbleWinAmountUpdate',
				amount: data.amount,
				animate: false,
			});
		},
	})}
	{template}
/>
