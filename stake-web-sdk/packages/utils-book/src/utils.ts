import { PUBLIC_CHROMATIC } from 'envs';
import { stateUrlDerived } from 'state-shared';
import { requestEndEvent } from 'rgs-requests';

import type { BaseBookEvent } from './types';

export function recordBookEvent<TBookEvent extends BaseBookEvent>({
	bookEvent,
}: {
	bookEvent: TBookEvent;
}) {
	if (PUBLIC_CHROMATIC || stateUrlDerived.replay()) {
		// En replay no se settlea nada contra el RGS. El log es solo para dev:
		// en prod ensuciaba la consola en cada reveal del replay (rechazo N2.2
		// fue por consola sucia — el reviewer mira los replays con consola abierta).
		if (import.meta.env.DEV) {
			console.log('mock request end-event:', { index: bookEvent.index, type: bookEvent.type });
		}
		return;
	}

	// requestEndEvent es async: un try/catch síncrono no agarra el rechazo de
	// la promesa — un fallo de red durante el bonus dejaba una unhandled
	// rejection en la consola de prod. El .catch la absorbe (el end-event es
	// tracking best-effort, la ronda sigue igual).
	try {
		void Promise.resolve(
			requestEndEvent({
				eventIndex: bookEvent.index,
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
			}),
		).catch((error) => {
			if (import.meta.env.DEV) console.error(error);
		});
	} catch (error) {
		if (import.meta.env.DEV) console.error(error);
	}
}

export function checkIsMultipleRevealEvents<TBookEvent extends BaseBookEvent>({
	bookEvents,
}: {
	bookEvents: TBookEvent[];
}) {
	const revealEventCount = bookEvents.filter((bookEvent) => bookEvent.type === 'reveal').length;
	const isMultipleReveals = revealEventCount > 1;
	return isMultipleReveals;
}
