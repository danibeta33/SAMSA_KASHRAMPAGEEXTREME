<script lang="ts" module>
	// `Marco_2` — 26 frames (`Marco_Columna_00000..00025`) de un marco que
	// envuelve la COLUMNA entera. Reemplaza al recuadro amarillo de la
	// anticipación y también al intento anterior de poner el `Marco_Icono` de
	// victoria en cada símbolo.
	//
	// Por qué UNO POR REEL y no uno por celda: durante la anticipación la
	// columna GIRA, así que cada celda vive ~133 ms en pantalla (400 px de
	// board a 3 px/ms) y se desmonta. Un clip montado por celda solo llegaba a
	// ~5 de sus frames antes de irse — nunca se formaba. Este nodo cuelga del
	// BOARD, no del reel, así que no se entera del scroll.
	//
	// Todos los frames comparten `sourceSize` 644×1426 (medido del .json), así
	// que el aspect es constante y el clip no "respira" de ancho al animar.
	const FRAME_ASPECT = 644 / 1426;
</script>

<script lang="ts">
	import type * as PIXI from 'pixi.js';
	import { BaseSprite, Container, getContextApp } from 'pixi-svelte';

	import { SYMBOL_SIZE } from '../game/constants';
	import { getSymbolX } from '../game/utils';
	import {
		BOARD_HEIGHT,
		MARCO_FPS,
		MARCO_FRAME_COUNT,
		stateAnticipation,
	} from '../game/stateAnticipation.svelte';
	import { stateTweak } from '../game/stateTweak.svelte';

	type Props = {
		reelIndex: number;
		/** Preview del AnimLab: bucle propio, para encuadrar con el board quieto. */
		preview?: boolean;
	};

	const props: Props = $props();
	const appContext = getContextApp();

	// El clip va SIN preload (3.2 MB, ver assets.ts). Si todavía no bajó, la
	// anticipación corre con el brillo de los símbolos y nada más.
	const textures = $derived(
		(appContext.stateApp.loadedAssets?.anim_marco_columna as unknown as
			| PIXI.Texture[]
			| undefined) ?? [],
	);
	const ready = $derived(textures.length >= MARCO_FRAME_COUNT);

	// ── El frame ────────────────────────────────────────────────────────────
	// En JUEGO se dibuja EXACTAMENTE el frame que publica `stateAnticipation`,
	// que es el mismo del que sale la iluminación de los símbolos. Esa es toda
	// la idea del rediseño: un `SpriteSheet` con `play` corriendo por su cuenta
	// tenía su propio reloj y la barra terminaba desfasada de la luz.
	let previewFrame = $state(0);
	$effect(() => {
		if (!props.preview) return;
		const t0 = performance.now();
		const id = setInterval(() => {
			const elapsedFrames = Math.floor(((performance.now() - t0) / 1000) * MARCO_FPS);
			previewFrame = elapsedFrames % MARCO_FRAME_COUNT;
		}, 16);
		return () => clearInterval(id);
	});
	const frame = $derived(props.preview ? previewFrame : stateAnticipation.frame);
	const texture = $derived(textures[frame]);

	// ── Geometría ───────────────────────────────────────────────────────────
	// Centro de la columna en coordenadas de BOARD. `getSymbolX` es la misma
	// función con la que se posicionan los símbolos, así que el marco no puede
	// desalinearse de la grilla.
	//
	// El tamaño se ata al ALTO del board (no al ancho de la celda): el arte es
	// un pilar y lo que tiene que calzar es su largo. El ancho sale del aspect,
	// y a escala 1 da ~181 px contra los 80 de la celda — el arte trae glow y
	// sangrado alrededor del hueco. Los 3 diales del UI LAB (categoría MARCO
	// COLUMNA) son los que terminan de encuadrarlo contra la grilla real.
	//
	// El tamaño del sprite es CONSTANTE y la escala va en el Container que lo
	// envuelve: bindear el tamaño de un sprite a un valor que cambia es el bug
	// que dejó a wild/scatter congelados (ver la rama de especiales en
	// SymbolSprite.svelte), y acá el valor cambia de verdad mientras se
	// arrastra el slider del UI LAB.
	const BASE_HEIGHT = BOARD_HEIGHT;
	const BASE_WIDTH = BOARD_HEIGHT * FRAME_ASPECT;
	const scale = $derived(stateTweak.antMarcoScale);
	// X/Y en FRACCIONES DE CELDA sobre el centro de la columna, igual que los
	// diales por símbolo.
	const x = $derived(getSymbolX(props.reelIndex) + stateTweak.antMarcoX * SYMBOL_SIZE);
	const y = $derived(BOARD_HEIGHT / 2 + stateTweak.antMarcoY * SYMBOL_SIZE);
</script>

{#if ready && texture}
	<Container {x} {y} {scale}>
		<BaseSprite anchor={0.5} {texture} width={BASE_WIDTH} height={BASE_HEIGHT} />
	</Container>
{/if}
