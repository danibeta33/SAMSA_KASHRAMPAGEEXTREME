<script lang="ts">
	import { Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';

	import { UI_BASE_FONT_SIZE } from '../constants';

	type Props = {
		label: string;
		value: string;
		tiled?: boolean;
		stacked?: boolean;
	};

	const props: Props = $props();

	const KASH_LIME = 0xd4ff3a;
	const KASH_DARK = 0x0d0c0a;

	const labelStyle = {
		fontFamily: 'Europa',
		fontSize: UI_BASE_FONT_SIZE * 0.65,
		fontWeight: '700' as const,
		fill: 0xa8b97a,
		letterSpacing: 2,
	} as const;

	const valueStyle = {
		fontFamily: 'Europa',
		fontSize: UI_BASE_FONT_SIZE * 0.95,
		fontWeight: '900' as const,
		fill: KASH_LIME,
		letterSpacing: 0.5,
		stroke: { color: KASH_DARK, width: 2 },
	} as const;

	const context = getContextApp();
	const hasPanel = $derived(!!context.stateApp.loadedAssets?.['displayPanel']);

	// Sprite mode keeps the native 1.79:1 aspect (1024x572 displayPanel).
	// Wireframe mode is more compact so it doesn't overlap the buttons below.
	const W = $derived(hasPanel ? UI_BASE_FONT_SIZE * 8 : UI_BASE_FONT_SIZE * 5.5);
	const H = $derived(hasPanel ? W / 1.79 : W / 2.6);
</script>

{#snippet panel(x: number, y: number)}
	{#if hasPanel}
		<Sprite key="displayPanel" {x} {y} anchor={{ x: 0.5, y: 0.5 }} width={W} height={H} />
	{:else}
		<Rectangle
			anchor={0.5}
			{x}
			{y}
			width={W}
			height={H}
			borderRadius={H * 0.5}
			backgroundColor={KASH_DARK}
			backgroundAlpha={0.85}
			borderColor={KASH_LIME}
			borderWidth={2}
		/>
	{/if}
{/snippet}

{#if props.stacked}
	<Text anchor={{ x: 0.5, y: 1 }} y={-2} text={props.label} style={labelStyle} />
	{#if props.tiled}
		{@render panel(0, H * 0.5)}
	{/if}
	<Text anchor={{ x: 0.5, y: 0.5 }} y={H * 0.5} x={0} text={props.value} style={valueStyle} />
{:else}
	{#if props.tiled}
		{@render panel(W * 0.5 - 90, 0)}
	{/if}
	<Text anchor={{ x: 0, y: 0.5 }} x={-70} y={0} text={props.label} style={labelStyle} />
	<Text anchor={{ x: 1, y: 0.5 }} x={W - 110} y={0} text={props.value} style={valueStyle} />
{/if}
