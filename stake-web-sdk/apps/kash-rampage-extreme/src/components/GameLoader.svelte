<script lang="ts">
	// Loader del juego (fase post-cartel de Stake Engine, pre-carga) —
	// reemplaza al LoaderExample del template (que mostraba el placeholder
	// "Add Your Loader"). Overlay negro a pantalla completa + el bate girando
	// (Cargador_Bate) centrado, con el "LOADING" de la marca debajo.
	//
	// Ya NO usa `LoaderBase` del SDK ni `static/loader.gif`: LoaderBase dibuja
	// un <img> y el loader nuevo es un SPRITESHEET (spinner.webp + .json), que
	// se anima capa a capa en `LoadingSpinner.svelte`. Lo que hacía LoaderBase
	// —wrap negro fijo, fade de salida, esperar a que el arte esté decodificado
	// y recién ahí arrancar el timeout— se reproduce acá tal cual, para que el
	// loader y el spinner de la pantalla de CLICK TO CONTINUE sean la misma
	// animación.
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import LoadingSpinner, { SPINNER_SRC } from './LoadingSpinner.svelte';

	type Props = {
		/** ms que el loader queda en pantalla una vez decodificado el sheet. */
		timeout?: number;
	};

	const { timeout = 2000 }: Props = $props();

	let loading = $state(true);

	onMount(() => {
		let done = false;
		let timer: ReturnType<typeof setTimeout>;
		// Igual que LoaderBase: el timeout arranca cuando el arte YA está
		// decodificado, no al montar. Si el sheet fallara, `onerror` corre el
		// mismo camino — un loader que no se va deja el juego inalcanzable.
		const start = () => {
			if (done) return;
			done = true;
			timer = setTimeout(() => (loading = false), timeout);
		};
		const img = new Image();
		img.onload = start;
		img.onerror = start;
		img.src = SPINNER_SRC;
		return () => clearTimeout(timer);
	});
</script>

{#if loading}
	<div class="game-loader" transition:fade>
		<!-- 254px de caja ≈ 200px de bate: el mismo tamaño que tenía el gif
		     (LoaderBase iba con maxWidth 200). -->
		<LoadingSpinner size="clamp(120px, 28vmin, 254px)" />
		<span class="game-loader__text">LOADING</span>
	</div>
{/if}

<style>
	.game-loader {
		position: absolute;
		inset: 0;
		z-index: 999;
		background-color: #000000;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 24px;
	}
	.game-loader__text {
		color: #f6ef1b;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		font-size: 15px;
		font-weight: 900;
		letter-spacing: 8px;
		text-indent: 8px; /* compensa el tracking del último caracter al centrar */
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
		animation: game-loader-pulse 1s ease-in-out infinite;
	}
	@keyframes game-loader-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
</style>
