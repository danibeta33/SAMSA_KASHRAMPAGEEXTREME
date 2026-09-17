<script lang="ts">
	import { stateBet, stateModal, stateUrlDerived } from 'state-shared';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';
	import { replayState } from '../game/replay.svelte';
	import type { Bet } from '../game/typesBookEvent';

	const context = getContext();

	onMount(() => {
		if (stateBet.betToResume?.active && stateBet.betToResume.mode) {
			stateBet.activeBetModeKey = stateBet.betToResume.mode;
		}
		// Bet replay (requisito de approval): la ronda queda cargada pero la
		// reproducción espera el PLAY del jugador — la dispara ReplayOverlay.
		if (stateUrlDerived.replay()) {
			replayState.savedBet = stateBet.betToResume as Bet | null;
			// state vacío = ronda inexistente o respuesta de error normalizada:
			// sin este check aparecía la card en 0.00 con un playback de nada.
			if (replayState.savedBet && replayState.savedBet.state?.length) {
				replayState.phase = 'ready';
			} else {
				// requestReplay falló/round inexistente: sin esto quedaba un
				// PLAY visible pero muerto. Error visible y sin botón.
				stateModal.modal = {
					name: 'error',
					// `userMessage` es lo que ModalError muestra en PROD. Es el
					// único canal: desde el feedback 16-09 el modal ya no
					// imprime `message` ni `error` (podían traer el stack o la
					// respuesta cruda del RGS), solo un genérico — salvo que el
					// emisor marque explícitamente un texto apto para el
					// jugador, como acá.
					error: {
						error: 'REPLAY_NOT_FOUND',
						message: 'Replay round could not be loaded.',
						userMessage: 'Replay round could not be loaded. Please reload the game.',
					},
				};
			}
			return;
		}
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	});
</script>
