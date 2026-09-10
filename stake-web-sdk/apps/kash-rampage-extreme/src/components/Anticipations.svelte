<script lang="ts">
	// Anticipación v6 (10-09): sin `Rectangle` y sin barrido propio. Este
	// componente es el ORQUESTADOR: sonido, marco de columna, y el ÚNICO reloj
	// del efecto — que ahora es EL FRAME DEL CLIP `Marco_2`. De ese único número
	// salen el frame que dibuja el marco, qué objetos se iluminan y cuánto se
	// atenúa el resto de la grilla, así que las tres cosas van en lockstep.
	import { OnMount } from 'components-shared';
	import { SECOND } from 'constants-shared/time';

	import { getContext } from '../game/context';
	import {
		marcoFrameAt,
		stateAnticipation,
		resetAnticipation,
	} from '../game/stateAnticipation.svelte';
	import { labPreview } from '../game/stateTweak.svelte';
	import Anticipation from './Anticipation.svelte';
	import AnticipationColumnFrame from './AnticipationColumnFrame.svelte';
	import BoardContainer from './BoardContainer.svelte';

	const context = getContext();
	const hasAnticipation = $derived(
		context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);
	// Preview del ANIM LAB: prende el marco de columna en TODAS las columnas y
	// lo deja en bucle, sin sonido ni rampa, para encuadrarlo con los sliders
	// del UI LAB sin tener que provocar una anticipación real.
	const previewColumnFrame = $derived(!!labPreview.marcoColumna);
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

			// Reloj ÚNICO del efecto: el frame del clip. Se publica ya el 0 antes
			// del primer tick — si no, el primer frame de la anticipación saldría
			// con el reloj todavía en −1 (grilla sin atenuar) y se vería un salto.
			const t0 = performance.now();
			stateAnticipation.frame = marcoFrameAt(0);
			// A 16 ms y no a los 66.7 del clip: el intervalo MUESTREA el reloj,
			// no lo marca. Alineado al frame se acumularía el drift del timer y
			// la barra iría perdiendo frames contra la iluminación, que es
			// justamente lo que este rediseño viene a evitar.
			const id = setInterval(() => {
				stateAnticipation.frame = marcoFrameAt(performance.now() - t0);
			}, 16);

			return () => {
				clearInterval(id);
				// Deja el reloj en reposo: sin esto quedarían símbolos brillando o
				// atenuados después del reveal.
				resetAnticipation();
				context.eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
				context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_anticipation' });
			};
		}}
	/>
{/if}

<!-- MARCO DE COLUMNA (`Marco_2`, drop 10-09). UN clip por reel anticipado,
     colgado del BOARD y no del reel: la columna gira debajo y este nodo ni se
     entera, así que la animación corre entera en vez de rearrancar con cada
     celda que entra. Ver AnticipationColumnFrame.svelte. -->
{#if hasAnticipation || previewColumnFrame}
	<BoardContainer>
		{#each context.stateGame.board as reel, reelIndex (reelIndex)}
			{#if reel.reelState.anticipating || previewColumnFrame}
				<AnticipationColumnFrame {reelIndex} preview={previewColumnFrame} />
			{/if}
		{/each}
	</BoardContainer>
{/if}

{#each context.stateGame.board as reel}
	{#if reel.reelState.anticipating}
		<!-- No renderiza nada: es el temporizador que apaga el flag al terminar. -->
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
