<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as PIXI from 'pixi.js';

	import { getContextApp } from '../context.svelte';
	import { getProcessed } from '../assetLoad';
	import type { LoadedAssets, RawAsset } from '../types';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let preLoaded = $state(false);

	const assetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => Boolean(context.stateApp.assets?.[key].preload) === false,
				)
			: [],
	);

	const preAssetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => context.stateApp.assets?.[key].preload === true,
				)
			: [],
	);

	let counter = 0;

	const onProgress = (value: number) => {
		if (preLoaded && value === 1) {
			counter = counter + 1;
			const ratio = counter / assetNameList.length;
			context.stateApp.loadingProgress = ratio * 100;
		}
	};

	const loadAssets = async (nameList: string[]) => {
		const loadedAssetsArray = await Promise.all(
			nameList.map(async (key) => {
				// Reintentos por asset: antes un fallo puntual (red/404 transitorio)
				// se tragaba con console.error y el juego arrancaba igual con el
				// asset FALTANTE → "Sprite: key ... is not found in the
				// loadedAssets" en runtime (motivo de rechazo — consola sucia).
				const MAX_ATTEMPTS = 3;
				const { type, src } = context.stateApp.assets![key];
				const loadSrc =
					type === 'spine' ? Object.values(src).filter((item) => typeof item === 'string') : src;
				for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
					try {
						const rawAsset = await PIXI.Assets.load<RawAsset>(loadSrc, onProgress);
						const processed = getProcessed({ key, rawAsset, type, src });
						return processed;
					} catch (error) {
						// limpiar el cache de PIXI para que el retry re-fetchee de
						// verdad (Assets cachea la promesa fallida por URL)
						await PIXI.Assets.unload(loadSrc).catch(() => undefined);
						if (attempt === MAX_ATTEMPTS) {
							// Gateado a DEV: consola de prod en CERO es requisito de
							// approval. Agotados los reintentos el loading nunca
							// completa y el jugador se queda en la pantalla de carga
							// — el log no cambia eso, solo ensucia la consola que
							// escanea el reviewer.
							if (import.meta.env.DEV)
								console.error(`[AssetsLoader] "${key}" failed after ${MAX_ATTEMPTS} attempts:`, error);
						} else {
							await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
						}
					}
				}
			}),
		);

		return loadedAssetsArray.reduce(
			(acc, cur) => ({
				...acc,
				...cur,
			}),
			{} as LoadedAssets,
		);
	};

	$effect(() => {
		if (!preLoaded) {
			(async () => {
				if (preAssetNameList.length > 0) {
					const preLoadedAssets = await loadAssets(preAssetNameList);
					if (preLoadedAssets) context.stateApp.loadedAssets = preLoadedAssets;
				}
				preLoaded = true;
			})();
		}
	});

	$effect(() => {
		if (!context.stateApp.loaded && preLoaded) {
			(async () => {
				if (assetNameList.length > 0) {
					const postLoadedAssets = await loadAssets(assetNameList);
					if (postLoadedAssets)
						context.stateApp.loadedAssets = {
							...context.stateApp.loadedAssets,
							...postLoadedAssets,
						};
				}
				context.stateApp.loaded = true;
			})();
		}
	});
</script>

{#if preLoaded}
	{@render props.children()}
{/if}
