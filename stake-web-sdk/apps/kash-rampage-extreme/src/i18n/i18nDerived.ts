import { stateI18nDerived } from 'state-shared';

import { i18nDerived as i18nDerivedUiPixi } from 'components-ui-pixi';
import { i18nDerived as i18nDerivedUiHtml } from 'components-ui-html';

export const i18nDerived = {
	...i18nDerivedUiPixi,
	...i18nDerivedUiHtml,
	home: () => stateI18nDerived.translate('HOME'),
	notTranslated: () => stateI18nDerived.translate('NOT TRANSLATED'),
	// bet replay card (feedback N3)
	replayBadge: () => stateI18nDerived.translate('REPLAY'),
	replayTitle: () => stateI18nDerived.translate('BET REPLAY'),
	replayMode: () => stateI18nDerived.translate('MODE'),
	replayBaseBet: () => stateI18nDerived.translate('BASE BET'),
	replayCostMultiplier: () => stateI18nDerived.translate('COST MULTIPLIER'),
	replayTotalBetCost: () => stateI18nDerived.translate('TOTAL BET COST'),
	replayPayoutMultiplier: () => stateI18nDerived.translate('PAYOUT MULTIPLIER'),
	replayTotalWin: () => stateI18nDerived.translate('TOTAL WIN'),
	replayStart: () => stateI18nDerived.translate('START REPLAY'),
	replayAgain: () => stateI18nDerived.translate('REPLAY AGAIN'),
	replayDisclaimer: () => stateI18nDerived.translate('REPLAY DISCLAIMER'),
};
