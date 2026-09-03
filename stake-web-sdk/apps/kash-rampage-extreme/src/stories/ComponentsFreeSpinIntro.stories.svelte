<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<FreeSpinIntro>',
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
	name="totalFs 8"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { totalFreeSpins: 8 },
		action: async (data: { totalFreeSpins: number }) => {
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: data.totalFreeSpins,
			});
			eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		},
	})}
	{template}
/>

<Story
	name="totalFs 15"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { totalFreeSpins: 15 },
		action: async (data: { totalFreeSpins: number }) => {
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: data.totalFreeSpins,
			});
			eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		},
	})}
	{template}
/>

<Story
	name="totalFs 20"
	args={templateArgs({
		skipLoadingScreen: true,
		data: { totalFreeSpins: 20 },
		action: async (data: { totalFreeSpins: number }) => {
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: data.totalFreeSpins,
			});
			eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		},
	})}
	{template}
/>
