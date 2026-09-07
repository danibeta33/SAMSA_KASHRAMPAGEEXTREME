<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import { type Props as BaseProps } from './BaseSprite.svelte';

	export type Props = Omit<BaseProps, 'texture'> & {
		debug?: boolean;
		key: string;
	};
</script>

<script lang="ts">
	import BaseSprite from './BaseSprite.svelte';
	import { getContextApp } from '../context.svelte';
	import { resolveAssetAnchor } from '../anchorRegistry';
	import type { LoadedSprite } from '../types';

	const { debug, key, ...baseSpriteProps }: Props = $props();
	const context = getContextApp();
	const texture = $derived(
		(context.stateApp.loadedAssets?.[key] || PIXI.Texture.EMPTY) as LoadedSprite,
	);

	// Ancla por assetId: si el consumidor NO pasó `anchor`, se le pregunta al
	// resolver que el juego inyecta con `setAnchorResolver`. Un `anchor`
	// explícito siempre gana, y sin resolver (o con un id desconocido) esto
	// vale `undefined` — `propsSyncEffect` ignora las props undefined, así que
	// el default (0,0) de PixiJS queda intacto.
	const anchor = $derived(baseSpriteProps.anchor ?? resolveAssetAnchor(key));
</script>

{#if texture === PIXI.Texture.EMPTY || debug}
	{console.error(`Sprite: key "${key}" is not found in the loadedAssets`)}
	{console.log('loadedAssets', $state.snapshot(context.stateApp).loadedAssets)}
{/if}

<BaseSprite {...baseSpriteProps} {anchor} {texture} />
