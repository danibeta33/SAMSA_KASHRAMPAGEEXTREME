<script lang="ts" module>
	import { Rectangle, Sprite, type RectangleProps } from 'pixi-svelte';

	export type Props = RectangleProps & {
		spriteKey?: string;
	};
</script>

<script lang="ts">
	const props: Props = $props();
</script>

<!-- If a spriteKey is provided AND found in loadedAssets, render a Sprite.
     Otherwise fall back to the Rectangle (Kash dark + lime border default). -->
{#if props.spriteKey}
	<Sprite
		key={props.spriteKey}
		x={props.x}
		y={props.y}
		anchor={props.anchor}
		width={props.width}
		height={props.height}
	/>
{:else}
	<Rectangle
		borderRadius={20}
		borderWidth={2}
		borderColor={0xd4ff3a}
		backgroundColor={0x0d0c0a}
		{...props}
	/>
{/if}
