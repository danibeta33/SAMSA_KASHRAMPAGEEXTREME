<script lang="ts">
	// Pantalla de carga / click-to-continue — HTML overlay componible
	// (assets del pack Downloads/loading): fondo exterior "KASH" + panel
	// interior vault + logo + loader del wild girando (sin cards de bonus —
	// Feedback N1 #1). Click/tap en cualquier lado entra al juego (mismo
	// estado que consumía la LoadingScreen Pixi).
	import { onMount } from 'svelte';
	import { getContextApp } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { htmlAssets } from '../game/htmlAssets.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const context = getContext();
	const appContext = getContextApp();

	// Assets listos: hasta entonces se muestra el spinner del bate girando y NO
	// se permite entrar (el board estaría a medio cargar). `stateApp.loaded`
	// pasa a true cuando terminan TODOS los assets (incl. los sin preload).
	// SIN fallback por tiempo: entrar con assets a medio cargar hace que Pixi
	// loguee "Sprite: key sym_* is not found in the loadedAssets" — motivo de
	// rechazo del review N2 (consola debe quedar limpia). Si una carga cuelga,
	// el jugador recarga — jamás entrar con el board a medias.
	// htmlAssets: las imágenes HTML del HUD/overlays (cards del buy, botones)
	// también deben estar en cache — si no, el buy menu abre con pop-in.
	const ready = $derived(appContext.stateApp.loaded && htmlAssets.loaded);

	// Salida animada tipo TELÓN: al click el juego se monta inmediatamente
	// detrás (showLoadingScreen=false) y el overlay completo se desliza hacia
	// abajo fuera de pantalla (650ms), revelando el board desde arriba.
	let closing = $state(false);
	const dismiss = () => {
		if (closing || !ready) return;
		closing = true;
		context.stateLayout.showLoadingScreen = false;
		setTimeout(() => (closing = false), 680);
	};

	// Touch (mobile/tablet) → TAP; puntero fino (desktop) → CLICK.
	const continueLabel =
		typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
			? 'TAP TO CONTINUE'
			: 'CLICK TO CONTINUE';

	let pulse = $state(true);
	onMount(() => {
		const id = setInterval(() => (pulse = !pulse), 600);
		return () => clearInterval(id);
	});
</script>

{#if context.stateLayout.showLoadingScreen || closing}
	<button class="load" class:load--out={closing} onclick={dismiss} aria-label={continueLabel} style="background-image: url('assets/loading/bg_outer.jpg')">
		<div class="load__panel" style="background-image: url('assets/loading/bg_inner.jpg')">
			<!-- Sin cards de bonus (Feedback N1 #1): la intro no debe anticipar
			     los modos de compra — solo logo + loader del bate (wild) girando. -->
			<!-- TODO-KRE Fase 3: logo.png sigue siendo el de KS1 (placeholder) -->
			<img class="load__logo" src="assets/loading/logo.png" alt="KASH RAMPAGE EXTREME" />
			<div class="load__foot">
				<!-- El loader del wild vive en GameLoader (fase post-cartel de
				     Stake Engine). Acá solo se muestra si los assets del juego
				     siguen cargando; con todo listo, CLICK/TAP TO CONTINUE pelado. -->
				{#if !ready}
					<LoadingSpinner />
					<span class="load__tap load__tap--load">LOADING</span>
				{:else}
					<span class="load__tap" style="opacity: {pulse ? 1 : 0.35}">{continueLabel}</span>
				{/if}
			</div>
		</div>
	</button>
{/if}

<style>
	.load {
		position: fixed;
		inset: 0;
		z-index: 200;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		/* imagen via style inline (ruta relativa al documento — CDN subpath) */
		background: #0d0c0a center / cover no-repeat;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
		/* telón: el overlay entero baja fuera de pantalla */
		transition: transform 0.65s cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
	}
	.load--out {
		transform: translateY(102%);
		pointer-events: none;
		box-shadow: 0 -18px 40px rgba(0, 0, 0, 0.55);
	}
	.load__panel {
		position: relative;
		width: min(96vw, 170vh);
		height: min(92vh, 60vw);
		border-radius: 18px;
		background: center / cover no-repeat;
		box-shadow: 0 0 40px rgba(0, 0, 0, 0.65);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 2vmin 3vmin 3.5vmin;
	}
	.load__logo {
		height: clamp(90px, 34vmin, 280px);
		width: auto;
		margin: auto 0; /* centrado vertical en el espacio libre (sin cards) */
		filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
	}
	.load__foot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4vmin;
		min-height: clamp(28px, 6vmin, 56px);
		justify-content: flex-end;
	}
	.load__tap {
		color: #f6ef1b;
		font-size: clamp(12px, 2.4vmin, 20px);
		font-weight: 900;
		letter-spacing: 5px;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
		transition: opacity 0.3s ease;
	}
	.load__tap--load {
		letter-spacing: 8px;
		animation: load-pulse 1s ease-in-out infinite;
	}
	@keyframes load-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	/* El bate girando (Cargador_Bate) vive en LoadingSpinner.svelte: el sheet
	   nuevo trae los 6 frames RECORTADOS en una columna y con altos distintos,
	   así que ya no se puede animar con un steps() sobre background-position.
	   Acá solo queda el encuadre. */

	/* Portrait — panel a lo alto */
	@media (max-aspect-ratio: 1/1) {
		.load__panel {
			width: 94vw;
			height: 90vh;
		}
	}
</style>
