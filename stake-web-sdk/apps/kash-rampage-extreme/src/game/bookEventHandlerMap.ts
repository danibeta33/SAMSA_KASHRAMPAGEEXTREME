import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';
import { triggerBoardShake } from './boardShake.svelte';

import { FREEGAME_SPIN_PAUSE_MS, FREEGAME_SPIN_PAUSE_TURBO_MS } from './constants';

import { winToRoundCostRatio } from './winRatio';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import {
	rampageHide,
	rampageUnhideAll,
	RAMPAGE_FALL_DELAY_MS,
	RAMPAGE_FALL_DUR_MS,
} from './stateRampage.svelte';
import { PADDING_REELS } from './paddingReels';
import { stateWinHighlight } from './stateWinHighlight.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';

// Música de free spins según el modo activo: RAGE tiene su propia pista
// (AU-04); Vault Crack / Smash y triggers naturales usan AU-03.
const fsMusicName = () =>
	stateBet.activeBetModeKey?.toUpperCase() === 'RAGE_MODE' ? 'bgm_freespin_rage' : 'bgm_freespin';

// Último total de free spins conocido, para calcular cuántos SUMA un
// retrigger (el book event solo trae el total nuevo, no el delta).
let lastFsTotal = 0;

// Feedback N1 #3: la pausa entre free spins arranca en el SEGUNDO reveal del
// bonus — el primero viene de transición + intro (pausa doble si se aplica).
let fsRevealSeen = false;

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	if (winLevelData?.sound?.sfx) {
		eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	}
	if (winLevelData?.sound?.bgm) {
		eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
	}
	if (winLevelData?.type === 'big') {
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_bigwin_coinloop' });
	}
};

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_bigwin_coinloop' });
	if (stateBet.activeBetModeKey === 'SUPERSPIN' || stateGame.gameType === 'freegame') {
		// check if SUPERSPIN, when finishing a bet.
		eventEmitter.broadcast({ type: 'soundMusic', name: fsMusicName() });
	} else {
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
	}
	eventEmitter.broadcastAsync({ type: 'uiShow' });
};

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({
		type: 'boardWithAnimateSymbols',
		symbolPositions: positions,
	});
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		// El dim del win-highlight se apaga en cada spin nuevo: tras animar
		// SCATTERS (trigger/retrigger) no hay tumble que lo limpie y quedaba
		// pegado — el board entero corría el bonus a alpha 0.3 ("vacío").
		stateWinHighlight.active = false;
		eventEmitter.broadcast({ type: 'tumbleWinAmountReset' });
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}

		stateGame.gameType = bookEvent.gameType;
		// Feedback N1 #3: los free spins encadenaban reveal tras reveal sin
		// respiro y el bonus se sentía acelerado. Pausa entre giros del bonus
		// (recortada con turbo), del segundo reveal en adelante.
		if (bookEvent.gameType === 'freegame') {
			if (fsRevealSeen) {
				await waitForTimeout(
					stateBet.isTurbo ? FREEGAME_SPIN_PAUSE_TURBO_MS : FREEGAME_SPIN_PAUSE_MS,
				);
			}
			fsRevealSeen = true;
			// NOTA: acá NO va preSpin — colgaba el primer reveal del bonus
			// (spin() nunca resolvía; pendiente de investigar en el engine).
			// La lluvia del FS la aporta el padding del propio fall-in.
		} else {
			fsRevealSeen = false;
		}
		// KASH RAMPAGE (feedback de dirección 26-08 "no se nota el efecto"): el reveal
		// viene YA convertido de la math (contrato N3), así que el jugador nunca
		// veía los símbolos malos. Lookahead: si a ESTE reveal le sigue un
		// kashRampage (antes del próximo reveal), presentamos el drop con los
		// símbolos VIEJOS (`from`) en las celdas convertidas — el batazo los
		// estalla y recién ahí queda el `to` real del book. Clon superficial:
		// el bookEvent original NO se muta (snapshot/replay lo re-leen).
		const nextRevealIndex =
			bookEvents.find((e) => e.type === 'reveal' && e.index > bookEvent.index)?.index ?? Infinity;
		const rampageEvent = bookEvents.find(
			(e) => e.type === 'kashRampage' && e.index > bookEvent.index && e.index < nextRevealIndex,
		) as BookEventOfType<'kashRampage'> | undefined;
		let revealEvent = bookEvent;
		if (rampageEvent) {
			const board = bookEvent.board.map((reel) => reel.map((cell) => ({ ...cell })));
			rampageEvent.conversions.forEach((c) => {
				const cell = board[c.reel]?.[c.row];
				if (cell) cell.name = c.from;
			});
			revealEvent = { ...bookEvent, board };
		}
		await stateGameDerived.enhancedBoard.spin({
			revealEvent,
			// Strips reales de la math: el spin usa paddingPositions del book
			// para que el relleno que scrollea sea el vecindario del resultado.
			paddingBoard: PADDING_REELS[bookEvent.gameType],
		});
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		const promise1 = async () => {
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_winlevel_small' });
			await animateSymbols({ positions: _.flatten(bookEvent.wins.map((win) => win.positions)) });
		};

		const promise2 = async () => {
			await eventEmitter.broadcastAsync({
				type: 'showClusterWinAmounts',
				wins: bookEvent.wins.map((win) => {
					return {
						win: win.meta.winWithoutMult,
						mult: win.meta.globalMult,
						result: win.meta.winWithoutMult * win.meta.globalMult,
						reel: win.meta.overlay.reel,
						row: win.meta.overlay.row,
					};
				}),
			});
		};

		await Promise.all([promise1(), promise2()]);
	},
	updateTumbleWin: async (bookEvent: BookEventOfType<'updateTumbleWin'>) => {
		if (bookEvent.amount > 0) {
			eventEmitter.broadcast({ type: 'tumbleWinAmountShow' });
			eventEmitter.broadcast({
				type: 'tumbleWinAmountUpdate',
				amount: bookEvent.amount,
				animate: false,
			});
		}
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		// animate scatters
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win_v2' });
		await animateSymbols({ positions: bookEvent.positions });
		stateWinHighlight.active = false;
		// show free spin intro
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_superfreespin' });
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
		eventEmitter.broadcast({ type: 'soundMusic', name: fsMusicName() });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinIntroUpdate',
			totalFreeSpins: bookEvent.totalFs,
		});
		lastFsTotal = bookEvent.totalFs;
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		eventEmitter.broadcast({ type: 'globalMultiplierShow' });
		await eventEmitter.broadcastAsync({
			type: 'globalMultiplierUpdate',
			multiplier: 1, // resets when multiplier === 1
		});
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: undefined,
			total: bookEvent.totalFs,
		});
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
		await eventEmitter.broadcastAsync({ type: 'drawerButtonShow' });
		eventEmitter.broadcast({ type: 'drawerFold' });
	},
	freeSpinRetrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		// Retrigger: mostrar cuántos spins se SUMAN (+N), no el total nuevo.
		const added = Math.max(bookEvent.totalFs - lastFsTotal, 0);
		lastFsTotal = bookEvent.totalFs;
		// animate scatters
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win_v2' });
		await animateSymbols({ positions: bookEvent.positions });
		stateWinHighlight.active = false;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_fs_respins' });
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinIntroUpdate',
			totalFreeSpins: bookEvent.totalFs,
			added,
		});
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		eventEmitter.broadcast({ type: 'globalMultiplierShow' });
		await eventEmitter.broadcastAsync({
			type: 'globalMultiplierUpdate',
			multiplier: 1, // resets when multiplier === 1
		});
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: undefined,
			total: bookEvent.totalFs,
		});
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: bookEvent.amount,
			total: bookEvent.total,
		});
	},
	updateGlobalMult: async (bookEvent: BookEventOfType<'updateGlobalMult'>) => {
		eventEmitter.broadcast({ type: 'globalMultiplierShow' });
		if (bookEvent.globalMult === 1) {
			eventEmitter.broadcast({ type: 'tumbleWinAmountReset' });
		}
		await eventEmitter.broadcastAsync({
			type: 'globalMultiplierUpdate',
			multiplier: bookEvent.globalMult, // resets when multiplier === 1
		});
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		stateGame.gameType = 'basegame';
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		eventEmitter.broadcast({ type: 'globalMultiplierHide' });
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_youwon_panel' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutroCountUp',
			amount: bookEvent.amount,
			winLevelData,
		});
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
		eventEmitter.broadcast({ type: 'globalMultiplierHide' });
		eventEmitter.broadcast({ type: 'tumbleWinAmountHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
		await eventEmitter.broadcastAsync({ type: 'drawerUnfold' });
		eventEmitter.broadcast({ type: 'drawerButtonHide' });
	},
	tumbleBoard: async (bookEvent: BookEventOfType<'tumbleBoard'>) => {
		eventEmitter.broadcast({ type: 'boardHide' });
		eventEmitter.broadcast({ type: 'tumbleBoardShow' });
		eventEmitter.broadcast({ type: 'tumbleBoardInit', addingBoard: bookEvent.newSymbols });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_explosion_b' });
		await eventEmitter.broadcastAsync({
			type: 'tumbleBoardExplode',
			explodingPositions: bookEvent.explodingSymbols,
		});
		eventEmitter.broadcast({ type: 'tumbleBoardRemoveExploded' });
		await eventEmitter.broadcastAsync({ type: 'tumbleBoardSlideDown' });
		eventEmitter.broadcast({
			type: 'boardSettle',
			board: stateGameDerived
				.tumbleBoardCombined()
				.map((tumbleReel) => tumbleReel.map((tumbleSymbol) => tumbleSymbol.rawSymbol)),
		});
		eventEmitter.broadcast({ type: 'tumbleBoardReset' });
		eventEmitter.broadcast({ type: 'tumbleBoardHide' });
		eventEmitter.broadcast({ type: 'boardShow' });
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		// Piso de celebración: por debajo de 1× el costo de la ronda (pérdida
		// neta) no hay overlay — solo el HUD. Celebrar una pérdida devalúa el
		// SMALL WIN y frena el ritmo del tumble. Ratio via winToRoundCostRatio
		// (escalas correctas: book units vs costMultiplier del modo).
		if (winToRoundCostRatio(bookEvent.amount) < 1) return;

		// The SMASH (Feedback N1 #7): todo win con celebración arranca con el
		// bateo de Kash. broadcastAsync resuelve en el frame de golpe del bate
		// (shake + AU-09 salen de Background) → la celebración entra CON el
		// impacto. En portrait (sin Kash) o con el sheet sin cargar resuelve al
		// toque. Con TURBO el swing acompaña pero NO bloquea (~1.25s al frame
		// de golpe): la celebración sale inmediata, como antes del feedback.
		if (stateBet.isTurbo) {
			eventEmitter.broadcast({ type: 'kashSwing' });
		} else {
			await eventEmitter.broadcastAsync({ type: 'kashSwing' });
		}

		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},
	updateGrid: async (bookEvent: BookEventOfType<'updateGrid'>) => {
		eventEmitter.broadcast({ type: 'multiplierGridShow' });
		eventEmitter.broadcast({ type: 'multiplierGridUpdate', grid: bookEvent.gridMultipliers });
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		eventEmitter.broadcast({ type: 'multiplierGridClear' });
		eventEmitter.broadcast({ type: 'multiplierGridHide' });
		eventEmitter.broadcast({ type: 'globalMultiplierHide' });
		eventEmitter.broadcast({ type: 'tumbleWinAmountHide' });
	},
	// customised
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		function findLastBookEvent<T>(type: T) {
			return _.findLast(bookEvents, (bookEvent) => bookEvent.type === type) as
				| BookEventOfType<T>
				| undefined;
		}

		const lastFreeSpinTriggerEvent = findLastBookEvent('freeSpinTrigger' as const);
		const lastUpdateFreeSpinEvent = findLastBookEvent('updateFreeSpin' as const);
		const lastSetTotalWinEvent = findLastBookEvent('setTotalWin' as const);
		const lastUpdateGlobalMultEvent = findLastBookEvent('updateGlobalMult' as const);

		if (lastFreeSpinTriggerEvent) await playBookEvent(lastFreeSpinTriggerEvent, { bookEvents });
		if (lastUpdateFreeSpinEvent) playBookEvent(lastUpdateFreeSpinEvent, { bookEvents });
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
		if (lastUpdateGlobalMultEvent) playBookEvent(lastUpdateGlobalMultEvent, { bookEvents });
	},
	// ACTIVE — per-tumble multiplier from math game_events.py:apply_tumble_mult_event.
	// No-op in wireframe (no per-symbol mult overlay yet); kept so the book
	// stream doesn't stall on an unhandled type.
	applyTumbleMult: async (_bookEvent: BookEventOfType<'applyTumbleMult'>) => {},
	// ACTIVE — informational marker that the round capped at max win. No
	// dedicated UI in wireframe; finalWin event drives the visible total.
	wincap: async (_bookEvent: BookEventOfType<'wincap'>) => {},
	// ─── ACTIVE — KASH RAMPAGE (mecánica de firma KRE) ─────────────────────
	// El reveal ya contiene el board convertido (contrato N3: el math muta
	// antes de serializar); este handler PRESENTA los 5 beats sobre ese
	// board. Wireframe con assets KS1 — la Fase 3 reemplaza timings/artes
	// manteniendo esta estructura:
	//   1. Windup  — bateo de Kash (kashSwing resuelve en el frame del golpe)
	//   2. Impact  — Background dispara AU-09 + shake; reforzamos el shake
	//   3. Conversion Wave — highlight de conversions izq→der (2 mitades,
	//      wireframe del stagger por reel)
	//   4. Premium Accent — pulso extra sobre las celdas premium (H4)
	//   5. Settle — respiro antes de la detección de clusters
	kashRampage: async (bookEvent: BookEventOfType<'kashRampage'>) => {
		const conversions = bookEvent.conversions;
		// source 'rampage': único kashSwing que reproduce el clip del bateo con
		// los idles KS1 apagados (prototipo batazo→conversión, ver Background).
		await eventEmitter.broadcastAsync({ type: 'kashSwing', source: 'rampage' });
		triggerBoardShake(26, 620);
		// Ola de ROTURA izq→der (feedback de dirección 26-08): el board está mostrando
		// los símbolos VIEJOS (los presentó así el lookahead del reveal). Por
		// reel, cada celda convertida estalla en fragmentos del símbolo viejo,
		// queda VACÍA un beat y el símbolo nuevo (`to` real del book) CAE desde
		// arriba del marco (RampageShatterLayer). Orden crítico por celda:
		// ocultar → swapear rawSymbol → broadcast (así el nuevo jamás flashea
		// antes de su caída).
		const EXPLOSION_SFX = [
			'sfx_multiplier_explosion_a',
			'sfx_multiplier_explosion_b',
			'sfx_multiplier_explosion_c',
		] as const;
		const byReel = _.groupBy(conversions, 'reel');
		const reelIndexes = Object.keys(byReel)
			.map(Number)
			.sort((a, b) => a - b);
		for (const [waveIndex, reelIndex] of reelIndexes.entries()) {
			byReel[reelIndex].forEach((c) => {
				const reelSymbol = stateGame.board[c.reel]?.reelState.symbols[c.row];
				if (reelSymbol) {
					rampageHide(reelSymbol);
					reelSymbol.rawSymbol = { name: c.to };
				}
				eventEmitter.broadcast({
					type: 'rampageShatter',
					reel: c.reel,
					row: c.row,
					symbol: c.from,
					to: c.to,
				});
			});
			eventEmitter.broadcast({
				type: 'soundOnce',
				name: EXPLOSION_SFX[waveIndex % EXPLOSION_SFX.length],
			});
			await waitForTimeout(stateBet.isTurbo ? 40 : 90);
		}
		// Esperar el aterrizaje de la última tanda + clear de seguridad: si la
		// capa no llegó a desocultar alguna celda (asset sin cargar, unmount),
		// acá se garantiza que ninguna quede invisible.
		await waitForTimeout(RAMPAGE_FALL_DELAY_MS + RAMPAGE_FALL_DUR_MS + 60);
		rampageUnhideAll();
		// Premium Accent (beat 4, se mantiene): pulso win sobre las celdas que
		// resolvieron a KASH, con su golpe de sonido.
		const premium = conversions.filter((c) => c.premium);
		if (premium.length) {
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_explode' });
			await animateSymbols({ positions: premium });
			// APAGAR el acento antes de que corra la detección de clusters.
			// Este es el único `animateSymbols` que presenta sobre el MISMO board
			// que después se evalúa: no hay tumble ni spin en el medio que
			// reconstruya los ReelSymbol, así que sin esto las celdas KASH se
			// quedaban en `postWinStatic` —iluminadas y con marco— sin ser
			// ganadoras, no reventaban con el cluster y dejaban al resto del board
			// atenuado. Ver el handler `boardAnimateSymbolsReset` en Board.svelte.
			// (Los otros dos casos —freeSpinTrigger/Retrigger sobre los SCATTER—
			// no lo necesitan: ahí sigue una transición y un spin nuevo, y el spin
			// crea ReelSymbol nuevos en `static`.)
			eventEmitter.broadcast({ type: 'boardAnimateSymbolsReset' });
		}
		// Settle (beat 5): respiro para leer el board nuevo antes de los clusters.
		await waitForTimeout(300);
	},
};
