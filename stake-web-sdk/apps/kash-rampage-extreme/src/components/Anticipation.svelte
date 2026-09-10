<script lang="ts">
	// Anticipación v5 (09-09): este componente YA NO DIBUJA NADA.
	//
	// Antes pintaba 3 rectángulos lima concéntricos alrededor de la columna.
	// Se fueron: el padding de 30 px invadía el 37 % de la columna vecina (con
	// 3 anticipadas contiguas los halos se fundían en un bloque amarillo) y el
	// lavado compuesto llegaba a ~56 % de alpha sobre los símbolos, camuflando
	// justo al SCATTER —barra de oro con letras amarillas— que el efecto
	// existe para anunciar. Ahora el foco lo dan los SÍMBOLOS iluminándose
	// (ver stateAnticipation.svelte.ts + SymbolSprite.svelte).
	//
	// Lo que queda —y hay que conservar— es el CONTRATO DE TIMING: al cumplirse
	// `ANTICIPATION.durationMs` se llama `oncomplete`, que es lo que apaga
	// `reel.reelState.anticipating` en Anticipations.svelte. Sin eso la
	// secuencia del spin se cuelga.
	//
	// Esa duración ya no es un número elegido a mano: sale de los tramos del
	// clip `Marco_2` (1733 ms = sus 26 frames a 15 fps), porque el pedido de
	// dirección del 10-09 es que la anticipación ESPERE a que la animación
	// termine. Antes eran 1300 ms contra un clip de 1733 y se cortaba en pleno
	// idle, así que la salida de la barra no se veía nunca.
	//
	// El reloj VISUAL no vive acá: es uno solo, compartido, y lo corre
	// Anticipations.svelte — con un driver por columna cada uno arrancaría en su
	// propio t0 y la barra quedaría desfasada de la iluminación.
	import { onMount, onDestroy } from 'svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { ANTICIPATION } from '../game/stateAnticipation.svelte';

	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();

	let doneTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		doneTimer = setTimeout(() => props.oncomplete?.(), ANTICIPATION.durationMs);
	});

	onDestroy(() => {
		if (doneTimer) clearTimeout(doneTimer);
	});
</script>
