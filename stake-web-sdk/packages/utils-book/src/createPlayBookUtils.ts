import { sequence } from 'utils-shared/sequence';

import type { BookEventHandlerMap, GetBookEventFromMap, GetBookEventContextFromMap } from './types';

export function createPlayBookUtils<TBookEventHandlerMap extends BookEventHandlerMap<any, any>>({
	bookEventHandlerMap,
	debug,
}: {
	bookEventHandlerMap: TBookEventHandlerMap;
	debug?: boolean;
}) {
	type TBookEvent = GetBookEventFromMap<TBookEventHandlerMap>;
	type BookEventContextFromMap = GetBookEventContextFromMap<TBookEventHandlerMap>;
	type BookEventContextFromMapWithoutBookEvents = Omit<BookEventContextFromMap, 'bookEvents'>;
	type BookEventContextOfBookEvents = { bookEvents: TBookEvent[] };
	type TBookEventContext = BookEventContextFromMapWithoutBookEvents & BookEventContextOfBookEvents;

	const playBookEvent = async (bookEvent: TBookEvent, bookEventContext: TBookEventContext) => {
		const bookEventHandler = bookEventHandlerMap?.[bookEvent.type];
		if (bookEventHandler) {
			if (debug) console.log(bookEvent);
			await bookEventHandler(bookEvent, bookEventContext);
		} else {
			// Gateado a DEV: consola de prod en CERO es requisito de approval.
			// Un handler faltante se ve igual en pantalla (el evento no se
			// anima) y ahí es donde hay que atacarlo, no en el log de prod.
			if (import.meta.env.DEV)
				console.error('Missing bookEventHandler in "bookEventHandlerMap" for: ', bookEvent);
		}
	};

	const playBookEvents = async (
		bookEvents: TBookEvent[],
		bookEventContext?: BookEventContextFromMapWithoutBookEvents,
	) => {
		const finalBookEventContext =
			bookEventContext || ({} as BookEventContextFromMapWithoutBookEvents);

		await sequence(bookEvents, async (bookEvent) => {
			await playBookEvent(bookEvent, { ...finalBookEventContext, bookEvents });
		});
	};

	return {
		playBookEvent,
		playBookEvents,
	};
}
