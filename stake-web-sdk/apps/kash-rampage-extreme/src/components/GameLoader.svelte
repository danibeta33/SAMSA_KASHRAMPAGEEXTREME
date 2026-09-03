<script lang="ts">
	// Loader del juego (fase post-cartel de Stake Engine, pre-carga) —
	// reemplaza al LoaderExample del template (que mostraba el placeholder
	// "Add Your Loader"). Reusa LoaderBase del SDK (overlay negro + gif del
	// wild girando centrado, static/loader.gif) y agrega el "LOADING" con el
	// look de la marca (lima, bold, tracking ancho, pulso) debajo del wild.
	import { LoaderBase } from 'components-shared';

	type Props = {
		src: string;
	};

	const props: Props = $props();

	let showText = $state(true);
</script>

<LoaderBase
	maxWidth={200}
	backgroundColor={'#000000'}
	timeout={2000}
	src={props.src}
	oncomplete={() => (showText = false)}
/>

{#if showText}
	<span class="game-loader__text">LOADING</span>
{/if}

<style>
	.game-loader__text {
		z-index: 999;
		position: absolute;
		top: 50%;
		left: 50%;
		/* el gif (≤200px) queda centrado por LoaderBase → texto debajo */
		transform: translate(-50%, 120px);
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
