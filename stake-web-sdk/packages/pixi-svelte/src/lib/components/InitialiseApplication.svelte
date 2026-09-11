<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let wrap: HTMLDivElement;
	let initialised = $state(false);

	const initWithPreference = async (preference: 'webgl' | 'webgpu') => {
		const app = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
		await app.init({
			autoDensity: true,
			backgroundAlpha: 0,
			// Requisito de approval: consola sin logs — el banner de PixiJS cuenta.
			hello: false,
			multiView: false,
			antialias: true,
			clearBeforeRender: true,
			preference,
			powerPreference: 'high-performance',
			resolution: devicePixelRatio.current,
			resizeTo: window,
		});
		return app;
	};

	const initialiseApplication = async () => {
		PIXI.Assets.reset();

		await preloadFont();
		// Elección de renderer:
		// - Firefox (>=141) expone WebGPU pero su copyExternalImageToTexture
		//   no acepta HTMLVideoElement → cualquier VideoTexture revienta el
		//   render loop. WebGL ahí; WebGPU en el resto.
		// - FALLBACK OBLIGATORIO a WebGL: en el iframe del ACP de Stake la
		//   creación del contexto WebGPU FALLA ("Failed to create WebGPU
		//   Context Provider") y el autodetect de Pixi 8 NO cae solo a WebGL
		//   (intenta CanvasRenderer, no implementado) → init tira y el juego
		//   queda en canvas negro con el HUD HTML vivo. Retry explícito.
		const preferred =
			typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')
				? 'webgl'
				: 'webgpu';
		try {
			context.stateApp.pixiApplication = await initWithPreference(preferred);
		} catch (error) {
			if (preferred === 'webgl') throw error;
			// Consola de prod en CERO es requisito de approval (rechazo N2.2 de
			// KS1). En el iframe del ACP la creación del contexto WebGPU FALLA
			// siempre, así que este warn se disparaba justo en el entorno del
			// reviewer. El fallback a WebGL sigue igual; solo se silencia el log.
			if (import.meta.env.DEV)
				console.warn('WebGPU init failed — retrying with WebGL.', error);
			context.stateApp.pixiApplication = await initWithPreference('webgl');
		}

		wrap.appendChild(context.stateApp.pixiApplication.canvas);

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		context.stateApp.pixiApplication.renderer.events.autoPreventDefault = false;
		context.stateApp.pixiApplication.renderer.canvas.style.touchAction = 'auto';
	};

	onMount(async () => {
		try {
			if (!initialised) await initialiseApplication();
			initialised = true;
		} catch (error) {
			console.error(error);
		}
	});

	onDestroy(() => {
		if (context.stateApp.pixiApplication) {
			context.stateApp.pixiApplication.destroy();
		}
	});
</script>

<div bind:this={wrap}>
	{#if initialised}
		{@render props.children()}
	{/if}
</div>
