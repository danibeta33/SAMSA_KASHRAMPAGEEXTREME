<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<FreeSpinOutro>',
	});
</script>

<script lang="ts">
	import { StoryGameTemplate, StoryLocale, type TemplateArgs, templateArgs } from 'components-storybook';

	import Game from '../components/Game.svelte';
	import { setContext, getContext } from '../game/context';
	import { winLevelMap } from '../game/winLevelMap';

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
		data: { amount: 50_000_000, winLevelData: winLevelMap[3] },
		action: async (data: { amount: number; winLevelData: typeof winLevelMap[3] }) => {
			eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinOutroCountUp',
				amount: data.amount,
				winLevelData: data.winLevelData,
			});
			eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		},
	})}
	{template}
/>

<Story
	name="big win"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { amount: 750_000_000, winLevelData: winLevelMap[6] },
		action: async (data: { amount: number; winLevelData: typeof winLevelMap[6] }) => {
			eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinOutroCountUp',
				amount: data.amount,
				winLevelData: data.winLevelData,
			});
			eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		},
	})}
	{template}
/>

<Story
	name="mega win"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { amount: 5_000_000_000, winLevelData: winLevelMap[8] },
		action: async (data: { amount: number; winLevelData: typeof winLevelMap[8] }) => {
			eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinOutroCountUp',
				amount: data.amount,
				winLevelData: data.winLevelData,
			});
			eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		},
	})}
	{template}
/>
