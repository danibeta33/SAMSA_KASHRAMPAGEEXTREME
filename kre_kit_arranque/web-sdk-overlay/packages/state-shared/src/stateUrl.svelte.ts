import { locales } from 'config-lingui';
import { page } from '$app/state';

export type Language = (typeof locales)[number];

export type Key =
	// keys for play
	| 'sessionID'
	| 'rgs_url'
	| 'lang'
	| 'currency'
	| 'device'
	| 'social'
	| 'demo'
	// keys for replay 
	| 'replay'
	| 'amount'
	| 'game'
	| 'mode'
	| 'version'
	| 'event'
	;

const getUrlSearchParam = (key: Key) => page.url.searchParams.get(key) as string;

// params for play
const social = () => getUrlSearchParam('social') === 'true';
// Social mode (stake.us) siempre corre en inglés con los term-swaps aplicados,
// sin importar el `lang` de la sesión (docs: /docs/reference/social-mode).
const lang = () => {
	if (social()) return 'en';
	return getUrlSearchParam('lang') === 'br' ? 'pt' : (getUrlSearchParam('lang') as Language) || 'en';
};
const sessionID = () => getUrlSearchParam('sessionID') || '';
const rgsUrl = () => getUrlSearchParam('rgs_url') || '';
const currency = () => getUrlSearchParam('currency') || '';

// params for replay
const replay = () => getUrlSearchParam('replay') === 'true';
const amount = () => Number(getUrlSearchParam('amount')) || 0;
const game = () => getUrlSearchParam('game') || '';
const version = () => getUrlSearchParam('version') || '';
const mode = () => getUrlSearchParam('mode') || '';
const event = () => getUrlSearchParam('event') || '';

export const stateUrlDerived = {
	// states for play
	lang,
	sessionID,
	rgsUrl,
	social,
	currency,
	// states for replay
	replay,
	amount,
	game,
	mode,
	version,
	event,
};
