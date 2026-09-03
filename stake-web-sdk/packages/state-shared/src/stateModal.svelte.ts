type ModalEmpty = null;

type ModalError = {
	name: 'error';
	error: any;
};

type ModalBetMenu = {
	name: 'betAmountMenu';
};

type ModalBuyBonus = {
	name: 'buyBonus';
};

type ModalBuyBonusConfirm = {
	name: 'buyBonusConfirm';
};

type ModalAutoSpin = {
	name: 'autoSpin';
};

type ModalAutoSpinMessage = {
	name: 'autoSpinMessage';
	message: 'insufficientFunds' | 'lossLimitReached' | 'singleWinLimitReached';
};

type ModalPayTable = {
	name: 'payTable';
};

type ModalGameRules = {
	name: 'gameRules';
};

type ModalSettings = {
	name: 'settings';
};

// Modales custom por juego (fork del estudio): las apps montan sus propios
// overlays con nombres sufijados 'Kash' (p.ej. 'buyBonusKash',
// 'buyBonusConfirmKash'). El template literal es disjunto de los literales
// del SDK, así el narrowing por nombre (ModalError/ModalAutoSpinMessage)
// sigue funcionando.
type ModalCustomGame = {
	name: `${string}Kash`;
};

type Modal =
	| ModalEmpty
	| ModalError
	| ModalBetMenu
	| ModalBuyBonus
	| ModalBuyBonusConfirm
	| ModalAutoSpin
	| ModalAutoSpinMessage
	| ModalPayTable
	| ModalGameRules
	| ModalSettings
	| ModalCustomGame;

export const stateModal = $state({
	modal: null as Modal,
});
