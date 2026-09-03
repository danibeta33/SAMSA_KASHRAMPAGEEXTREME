import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBetDerived } from 'state-shared';

// Ratio ganancia / costo de la ronda, ambos en múltiplos de la apuesta.
//
// Escalas (fuente de dos bugs distintos — no volver a mezclarlas):
// - `amount` de un book event viene en unidades de book: 100 = 1× la apuesta
//   wagered (BOOK_AMOUNT_MULTIPLIER), NO en dólares.
// - `stateBetDerived.betCost()` está en dólares y además solo multiplica el
//   costMultiplier de modos type 'activate' — los buys (VAULT_CRACK 100×,
//   SMASH_MODE 250×, RAGE_MODE 500×) son type 'buy' y betCost() los ignora.
//
// Por eso acá: win en múltiplos = amount / BOOK_AMOUNT_MULTIPLIER, y costo en
// múltiplos = costMultiplier del modo activo sea del tipo que sea (1 en BASE).
export const winToRoundCostRatio = (bookEventAmount: number) => {
	const mode = stateBetDerived.activeBetMode() as { costMultiplier?: number } | undefined;
	const costMultiplier = mode?.costMultiplier || 1;
	return bookEventAmount / BOOK_AMOUNT_MULTIPLIER / costMultiplier;
};

// Win cap del juego en múltiplos de la APUESTA (no del costo de la ronda) —
// 5000× en los 4 modos (config.ts / math). MAX WIN solo puede mostrarse acá.
export const WINCAP_BET_MULTIPLIER = 5000;

// ¿El win es el cap real? Compara contra la apuesta en book units (100 = 1×).
// Review N2: la celebración/label "MAX WIN" en wins grandes no-cap es
// engañosa — solo el cap real la muestra. Margen de 1 book unit por redondeo.
export const isWinCap = (bookEventAmount: number) =>
	bookEventAmount / BOOK_AMOUNT_MULTIPLIER >= WINCAP_BET_MULTIPLIER - 0.01;
