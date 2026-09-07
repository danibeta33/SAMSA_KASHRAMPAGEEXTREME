<script lang="ts" module>
	import { type Props as BaseProps } from './AnimatedSprite.svelte';

	export type Props = Omit<BaseProps, 'textures'> & { key: string };
</script>

<script lang="ts">
	import AnimatedSprite from './AnimatedSprite.svelte';
	import { getContextApp } from '../context.svelte';
	import { resolveAssetAnchor } from '../anchorRegistry';
	import type { LoadedSpriteSheet } from '../types';

	const context = getContextApp();

	const { key, ...animateSpriteProps }: Props = $props();
	const textures = $derived(context.stateApp.loadedAssets?.[key] as LoadedSpriteSheet);
	const isValid = $derived(textures && 'length' in textures);

	// Mismo contrato que en Sprite.svelte: el ancla del registro solo rellena
	// cuando el consumidor no pasó una. Acá es donde de verdad importa — es el
	// componente que instancia el PIXI.AnimatedSprite de un clip, y el que
	// producía el salto al intercambiar animaciones de distinto bounding box.
	const anchor = $derived(animateSpriteProps.anchor ?? resolveAssetAnchor(key));
</script>

{#if !isValid}
	{console.error(`SpriteSheet: key "${key}" is not found in loadedAssets`)}
	{console.log('loadedAssets', $state.snapshot(context).stateApp.loadedAssets)}
{/if}

<AnimatedSprite {...animateSpriteProps} {anchor} textures={isValid ? textures : []} />
