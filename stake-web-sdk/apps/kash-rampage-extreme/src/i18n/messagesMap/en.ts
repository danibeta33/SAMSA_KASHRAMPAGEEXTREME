// Source of truth for translatable strings used by the SDK packages
// (components-ui-pixi, components-ui-html) plus this game.
// All other locales fall back to this map; never delete a key here.
export default {
	// game-specific
	HOME: 'HOME',
	BONUS: 'BONUS',

	// bet replay card (feedback N3 — Replay Support del approval checklist).
	// En social mode el MutationObserver reescribe los términos restringidos
	// (Base Bet→Base Play, Cost Multiplier→Feature Multiplier, etc.).
	REPLAY: 'REPLAY',
	'BET REPLAY': 'Bet Replay',
	MODE: 'Mode',
	'BASE BET': 'Base Bet',
	'COST MULTIPLIER': 'Cost Multiplier',
	'TOTAL BET COST': 'Total Bet Cost',
	'PAYOUT MULTIPLIER': 'Payout Multiplier',
	'TOTAL WIN': 'Total Win',
	'START REPLAY': 'Start Replay',
	'REPLAY AGAIN': 'Replay Again',
	'REPLAY DISCLAIMER': 'This is a replay of a previous bet round. No bets will be placed.',

	// components-ui-pixi (see packages/components-ui-pixi/src/i18n/i18nDerived.ts)
	AUDIO: 'AUDIO',
	BALANCE: 'BALANCE',
	WIN: 'WIN',
	BET: 'BET',
	STOP: 'STOP',
	'BUY BONUS': 'BUY BONUS',
	DISABLE: 'DISABLE',
	'FREE SPINS': 'FREE SPINS',
	'-': '-',
	'+': '+',
	MENU: 'MENU',
	TURBO: 'TURBO',
	'AUTO SPIN': 'AUTO SPIN',
	PAYTABLE: 'PAYTABLE',
	INFO: 'INFO',
	SETTINGS: 'SETTINGS',
	'SOUND ON': 'SOUND ON',
	'SOUND OFF': 'SOUND OFF',
	EXIT: 'EXIT',

	// components-ui-html (see packages/components-ui-html/src/i18n/i18nDerived.ts)
	MAX: 'MAX',
	'BET MENU': 'BET MENU',
	'SELECT YOUR BET': 'SELECT YOUR BET',
	CONFIRM: 'CONFIRM',
	CANCEL: 'CANCEL',
	'MASTER VOLUME': 'MASTER VOLUME',
	'MUSIC VOLUME': 'MUSIC VOLUME',
	'SOUND EFFECT VOLUME': 'SOUND EFFECT VOLUME',
	'AUTO SPINS': 'AUTO SPINS',
	'NUMBER OF ROUNDS': 'NUMBER OF ROUNDS',
	ADVANCED: 'ADVANCED',
	'SINGLE WIN LIMIT': 'SINGLE WIN LIMIT',
	'LOSS LIMIT': 'LOSS LIMIT',
	'START AUTOPLAY': 'START AUTOPLAY',
	NOTIFICATION: 'NOTIFICATION',
	'AUTO PLAY HAS STOPPED DUE TO': 'AUTO PLAY HAS STOPPED DUE TO',
	'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.':
		'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.',
	'LOSS LIMIT REACHED': 'LOSS LIMIT REACHED',
	'SINGLE WIN LIMIT REACHED': 'SINGLE WIN LIMIT REACHED',
};
