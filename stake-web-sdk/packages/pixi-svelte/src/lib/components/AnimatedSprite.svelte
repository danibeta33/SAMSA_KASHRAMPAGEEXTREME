<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import type { OverwriteCursor } from '../types';

	export type Props = OverwriteCursor<PIXI.AnimatedSpriteOptions> & {
		animationSpeed?: PIXI.AnimatedSprite['animationSpeed'];
		loop?: PIXI.AnimatedSprite['loop'];
		play?: boolean;
	};
</script>

<script lang="ts">
	import { propsSyncEffect } from '../utils.svelte';
	import { getContextParent } from '../context.svelte';

	const props: Props = $props();

	const parentContext = getContextParent();
	const animatedSprite = new PIXI.AnimatedSprite(props.textures ?? []);

	// ⚠ `textures` NO puede ir por propsSyncEffect. Ese efecto reasigna TODAS
	// las props cada vez que cambia CUALQUIERA de ellas, y el setter
	// `textures` de Pixi llama gotoAndStop() adentro: detiene la animación y
	// se da de baja del Ticker.shared. Como `play` está ignorado y su valor
	// no cambió, nadie la volvía a arrancar.
	//
	// Síntoma (reportado 24-08 en el ACP de Stake): al cambiar de resolución
	// se recalculan x/y/width/height, el efecto reasigna las texturas y TODAS
	// las animaciones quedan congeladas hasta refrescar la página — con el
	// ticker corriendo a 60fps pero con 0 listeners.
	propsSyncEffect({ props, target: animatedSprite, ignore: ['play', 'textures'] });

	// Las texturas se asignan en su PROPIO efecto y sólo cuando cambian de
	// referencia. El setter detiene el sprite, así que se restaura el estado
	// de reproducción con play() — que RETOMA donde iba, sin volver al frame
	// 0: reiniciar acá rompía las animaciones de una sola pasada (un festejo
	// del bonus se reiniciaba, su onComplete no llegaba nunca y la ronda
	// quedaba colgada — 2 hangs en el smoke del 24-08).
	$effect(() => {
		const textures = props.textures ?? [];
		if (animatedSprite.textures === textures) return;
		const wasPlaying = animatedSprite.playing;
		animatedSprite.textures = textures;
		if (wasPlaying) animatedSprite.play();
	});

	// Este efecto lee SÓLO props.play, así que se comporta igual que siempre:
	// se dispara cuando el juego pide arrancar o parar, y nunca por un
	// cambio de tamaño o de posición.
	$effect(() => {
		if (props.play) {
			animatedSprite.gotoAndPlay(0);
		} else {
			animatedSprite.gotoAndStop(0);
		}
	});

	parentContext.addToParent(animatedSprite);
</script>
