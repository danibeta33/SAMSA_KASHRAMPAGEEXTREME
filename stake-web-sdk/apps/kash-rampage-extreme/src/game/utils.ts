import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';
import { createGetEmptyPaddedBoard } from 'utils-slots';

import { SYMBOL_SIZE, REEL_PADDING, SYMBOL_INFO_MAP, BOARD_DIMENSIONS } from './constants';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { hasOwnClip } from './winPop.svelte';
import type { RawSymbol, SymbolState } from './types';

// general utils
export const { getEmptyBoard } = createGetEmptyPaddedBoard({ reelsDimensions: BOARD_DIMENSIONS });
export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });
export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

// resume bet
const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = [
	'updateGlobalMult',
	'freeSpinTrigger',
	'updateFreeSpin',
	'setTotalWin',
];

export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	const bookEventsBeforeResume = betToResume.state.filter(
		(_, eventIndex) => eventIndex < resumingIndex,
	);
	const bookEventsAfterResume = betToResume.state.filter(
		(_, eventIndex) => eventIndex >= resumingIndex,
	);

	const bookEventToCreateSnapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: bookEventsBeforeResume.filter((bookEvent) =>
			BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(bookEvent.type),
		),
	};

	const stateToResume = [bookEventToCreateSnapshot, ...bookEventsAfterResume];

	return { ...betToResume, state: stateToResume };
};

// other utils
export const getSymbolX = (reelIndex: number) => SYMBOL_SIZE * (reelIndex + REEL_PADDING);
export const getSymbolY = (symbolIndexOfBoard: number) => (symbolIndexOfBoard + 0.5) * SYMBOL_SIZE;

const FALLBACK_KEY = Object.keys(SYMBOL_INFO_MAP)[0] as keyof typeof SYMBOL_INFO_MAP;

export const getSymbolKey = ({ rawSymbol }: { rawSymbol?: RawSymbol }) => {
	if (!rawSymbol) return FALLBACK_KEY;
	if (rawSymbol.multiplier !== undefined) {
		return `${rawSymbol.name}_${rawSymbol.multiplier}` as keyof typeof SYMBOL_INFO_MAP;
	}
	return rawSymbol.name as keyof typeof SYMBOL_INFO_MAP;
};

export const getSymbolInfo = ({
	rawSymbol,
	state,
}: {
	rawSymbol?: RawSymbol;
	state: SymbolState;
}) => {
	const symbolKey = getSymbolKey({ rawSymbol });
	const entry = SYMBOL_INFO_MAP[symbolKey] ?? SYMBOL_INFO_MAP[FALLBACK_KEY];
	return entry[state];
};

// ── CAPA SUPERIOR DEL BOARD (drop 10-09) ────────────────────────────────────
// ¿Esta celda va dibujada POR ENCIMA de las demás? Pedido de dirección: los
// especiales (WILD, SCATTER y KASH/fajo) con su marco tienen que quedar
// siempre arriba de los símbolos normales, no depender del orden de montaje.
// Importa porque se solapan de verdad: el `Marco_Icono` mide 1.12 celdas y el
// boing de salida los estira hasta 1.5×, así que invaden a los cuatro vecinos.
//
// Es el MISMO conjunto que `hasOwnClip` (W / S / H4 + cualquier Spine), leído
// con `state: 'static'` porque el assetKey no cambia entre estados — la capa
// es una propiedad del SÍMBOLO, no de en qué momento de la ronda está.
export const isTopLayerSymbol = ({ rawSymbol }: { rawSymbol?: RawSymbol }) =>
	hasOwnClip({ symbolInfo: getSymbolInfo({ rawSymbol, state: 'static' }) });
