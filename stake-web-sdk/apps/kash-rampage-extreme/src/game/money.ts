import { stateBet, stateI18n } from 'state-shared';
import { numberToCurrencyString, bookEventAmountToNormalisedAmount } from 'utils-shared/amount';

// Duplicado de utils-shared/amount.ts (no exportado ahí; regla del studio:
// los fixes de app no tocan packages compartidos).
const NO_LOCALISATION_CURRENCY_MAP: Record<string, string> = {
	XGC: 'GC',
	XSC: 'SC',
	XEC: 'SC',
};

// Feedback N3: el win se muestra con precisión decimal completa (sub-cent
// payouts), balance y bet siguen en 2 decimales vía money(). Techo de 8:
// book amounts son enteros y los bets tienen ≤2 decimales, así que el
// producto real nunca pasa de ~6 — el toFixed(8) además absorbe float noise.
const WIN_MAX_DECIMALS = 8;

// Formatea montos en la moneda REAL de la sesión (stateBet.currency vía el
// formatter shared) — requisito de approval: el juego se testea con varias
// currencies y el HUD no puede hardcodear "$".
//
// Fallback: los overlays HTML (TopBar/BottomBar/Buy*) montan FUERA de
// LoadI18n, así que en el primer paint stateI18n puede no estar hidratado y
// numberToCurrencyString tiraría — en ese caso formato neutro con "$"
// (el mock usa separador de miles con apóstrofe: de-CH). En cuanto i18n
// hidrata, los $derived re-renderizan con la moneda real.
export const money = (n: number) => {
	// Leer `ready` crea la dependencia reactiva: lingui muta su instancia al
	// hidratar (sin reasignar stateI18n.i18n), y sin esto los $derived que
	// cayeron al fallback pre-hidratación quedaban pegados en "$" para
	// siempre (bug real: EUR/JPY mostraban "$" en todo el HUD).
	if (stateI18n.ready) {
		try {
			return numberToCurrencyString(n);
		} catch {
			// sigue al fallback de abajo
		}
	}
	return `$ ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Para montos que vienen en book units (100 = 1× la apuesta wagered).
export const moneyFromBookAmount = (n: number) => money(bookEventAmountToNormalisedAmount(n));

// Variante para montos de WIN: min 2 / max 8 decimales, sin trailing zeros
// más allá de 2 (0.1 → "0.10", 0.1234 → "0.1234"). Mismas tres ramas que
// money(): social coins (GC/SC sin Intl), Intl con currency, y fallback
// pre-hidratación.
export const moneyWin = (n: number) => {
	const clean = Number(n.toFixed(WIN_MAX_DECIMALS));
	if (stateI18n.ready) {
		try {
			if (stateBet.currency in NO_LOCALISATION_CURRENCY_MAP) {
				// toFixed evita la notación exponencial de `${n}`; el replace
				// recorta trailing zeros dejando mínimo 2 decimales.
				const formatted = clean
					.toFixed(WIN_MAX_DECIMALS)
					.replace(/(\.\d\d\d*?)0+$/, '$1');
				return `${NO_LOCALISATION_CURRENCY_MAP[stateBet.currency]} ${formatted}`;
			}
			return stateI18n.i18n.number(clean, {
				minimumFractionDigits: 2,
				maximumFractionDigits: WIN_MAX_DECIMALS,
				style: 'currency',
				currency: stateBet.currency,
			});
		} catch {
			// sigue al fallback de abajo
		}
	}
	return `$ ${clean.toLocaleString('de-CH', {
		minimumFractionDigits: 2,
		maximumFractionDigits: WIN_MAX_DECIMALS,
	})}`;
};

// Win en book units con precisión completa.
export const moneyWinFromBookAmount = (n: number) => moneyWin(bookEventAmountToNormalisedAmount(n));
