import type { BetType } from 'rgs-requests';

import type { SymbolName, RawSymbol, GameType, Position } from './types';

type BookEventReveal = {
	index: number;
	type: 'reveal';
	board: RawSymbol[][];
	paddingPositions: number[];
	anticipation: number[];
	gameType: GameType;
};

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: {
		symbol: SymbolName;
		win: number;
		positions: Position[];
		meta: {
			globalMult: number;
			clusterMult: number;
			winWithoutMult: number;
			overlay: Position;
		};
	}[];
};

type BookEventSetTumbleWin = {
	index: number;
	type: 'updateTumbleWin';
	amount: number;
};

type BookEventSetTotalWin = {
	index: number;
	type: 'setTotalWin';
	amount: number;
};

type BookEventFreeSpinTrigger = {
	index: number;
	type: 'freeSpinTrigger';
	totalFs: number;
	positions: Position[];
};

type BookEventUpdateFreeSpin = {
	index: number;
	type: 'updateFreeSpin';
	amount: number;
	total: number;
};

type BookEventUpdateGlobalMult = {
	index: number;
	type: 'updateGlobalMult';
	globalMult: number;
};

type BookEventFreeSpinEnd = {
	index: number;
	type: 'freeSpinEnd';
	amount: number;
	winLevel: number;
};

type BookEventTumbleBoard = {
	index: number;
	type: 'tumbleBoard';
	explodingSymbols: Position[];
	newSymbols: RawSymbol[][];
};

type BookEventFinalWin = {
	index: number;
	type: 'finalWin';
	amount: number;
};

type BookEventSetWin = {
	index: number;
	type: 'setWin';
	amount: number;
	winLevel: number;
};

// new
type BookEventUpdateGrid = {
	index: number;
	type: 'updateGrid';
	gridMultipliers: number[][];
};

type BookEventFreeSpinRetrigger = {
	index: number;
	type: 'freeSpinRetrigger';
	totalFs: number;
	positions: Position[];
};

// customised
type BookEventCreateBonusSnapshot = {
	index: number;
	type: 'createBonusSnapshot';
	bookEvents: BookEvent[];
};

// ACTIVE — applied by math game_events.py:apply_tumble_mult_event whenever a
// tumble cycle bumps the per-spin tumble multiplier. Payload uses the camelCased
// `tumbleMult` field emitted by the Python side. No UI in wireframe.
type BookEventApplyTumbleMult = {
	index: number;
	type: 'applyTumbleMult';
	tumbleMult: number;
};

// ACTIVE — emitted by math when the round hits the max win cap. Informational;
// no UI required beyond letting the round settle.
type BookEventWincap = {
	index: number;
	type: 'wincap';
	amount?: number;
};

// ACTIVE — KASH RAMPAGE (mecánica de firma KRE): el math convierte TODAS
// las celdas L/M del drop inicial a High (85%, H1-H3 ponderado) o Premium
// (15%, H4). El reveal YA contiene el board convertido (contrato N3);
// posiciones row-padded como winInfo, ordenadas reel→row para la Conversion
// Wave. `premium` marca las celdas para el beat Premium Accent.
// `globalSymbol` solo con scope global_symbol (toda la grilla al mismo High).
type BookEventKashRampage = {
	index: number;
	type: 'kashRampage';
	conversions: (Position & { from: SymbolName; to: SymbolName; premium: boolean })[];
	globalSymbol: SymbolName | null;
};

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventSetTumbleWin
	| BookEventSetTotalWin
	| BookEventFreeSpinTrigger
	| BookEventUpdateFreeSpin
	| BookEventUpdateGlobalMult
	| BookEventTumbleBoard
	| BookEventCreateBonusSnapshot
	| BookEventFinalWin
	| BookEventSetWin
	| BookEventFreeSpinEnd
	// new
	| BookEventUpdateGrid
	| BookEventFreeSpinRetrigger
	// customised
	| BookEventCreateBonusSnapshot
	// Per-tumble multiplier applied to symbols and the win cap signal.
	| BookEventApplyTumbleMult
	| BookEventWincap
	// KASH RAMPAGE — mecánica de firma KRE (base + buys).
	| BookEventKashRampage;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
