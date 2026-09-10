<script lang="ts">
	// Anticipación v5 (09-09): sin `Rectangle` — ni el scrim negro que oscurecía
	// las columnas frenadas ni los halos lima de Anticipation.svelte. Este
	// componente queda como ORQUESTADOR: sonido, pulso del marco, y el ÚNICO
	// reloj del efecto (intensity / breath / barrido de luz), que los símbolos
	// leen desde stateAnticipation para iluminarse ellos mismos.
	import { OnMount } from 'components-shared';
	import { SECOND } from 'constants-shared/time';

	import { getContext } from '../game/context';
	import {
		ANTICIPATION,
		BOARD_HEIGHT,
		stateAnticipation,
		resetAnticipation,
	} from '../game/stateAnticipation.svelte';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
	const hasAnticipation = $derived(
		context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);
</script>

{#if hasAnticipation}
	<OnMount
		onmount={() => {
			context.eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
			context.eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_anticipation' });
			context.eventEmitter.broadcast({
				type: 'soundFade',
				name: 'sfx_anticipation',
				from: 0,
				to: 1,
				duration: SECOND,
			});

			// Reloj ÚNICO del efecto. A 16 ms porque el barrido se mueve: a los
			// 30 ms del scrim viejo (que solo subía un alpha) el frente de luz
			// se veía escalonado.
			const t0 = performance.now();
			// El frente entra por encima del board y sale por debajo, así que el
			// recorrido incluye una banda de margen a cada lado: si no, la luz
			// "aparecía" ya dentro del board en vez de bajar hacia él.
			const span = BOARD_HEIGHT + ANTICIPATION.band * 2;
			const id = setInterval(() => {
				const t = performance.now() - t0;
				// Reloj crudo del marco (ver `elapsedMs`). Va aparte de `intensity`
				// porque el marco necesita el TIEMPO, no una rampa normalizada.
				stateAnticipation.elapsedMs = t;
				// Dos tiempos, y por eso no es una sola rampa:
				//  · rise  → entrada, 0→1 en 280 ms. Corta, para que el efecto se
				//    LEA desde el arranque (con la rampa vieja de 900 ms recién
				//    llegaba a full cuando ya se estaba apagando).
				//  · swell → sigue engordando 0.75→1 hasta el reveal, que es el
				//    crescendo que pide la anticipación.
				const rise = Math.min(t / ANTICIPATION.riseMs, 1);
				const swell = 0.75 + 0.25 * Math.min(t / ANTICIPATION.durationMs, 1);
				stateAnticipation.intensity = rise * swell;
				// Respiración MÁS CHICA que antes (0.93 ± 0.07 contra 0.9 ± 0.1):
				// el latido no puede comerse el brillo que se acaba de subir.
				stateAnticipation.breath = 0.93 + Math.sin(t / 200) * 0.07;
				stateAnticipation.sweepY =
					((t % ANTICIPATION.sweepMs) / ANTICIPATION.sweepMs) * span - ANTICIPATION.band;
			}, 16);

			return () => {
				clearInterval(id);
				// Deja el reloj en 0: sin esto quedarían símbolos brillando o
				// atenuados después del reveal.
				resetAnticipation();
				context.eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
				context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_anticipation' });
			};
		}}
	/>
{/if}

{#each context.stateGame.board as reel}
	{#if reel.reelState.anticipating}
		<!-- No renderiza nada: es el temporizador de 900 ms que apaga el flag. -->
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
