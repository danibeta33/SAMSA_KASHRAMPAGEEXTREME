// Estado del KASH RAMPAGE (prototipo 26-08). `hiddenSymbols` guarda las REFS
// de los ReelSymbol cuyas celdas están "vacías" entre el estallido del símbolo
// viejo y el aterrizaje del nuevo: ReelSymbol.svelte no los renderiza mientras
// estén acá. Los agrega el handler kashRampage (antes de swapear rawSymbol),
// los saca RampageShatterLayer cuando su copia en caída aterriza, y el handler
// hace un clear final de seguridad para que jamás quede una celda invisible.
export const stateRampage = $state({
	hiddenSymbols: [] as object[],
});

// Timings de la caída del símbolo nuevo (los usa RampageShatterLayer para
// animar y el handler kashRampage para esperar antes del Premium Accent).
export const RAMPAGE_FALL_DELAY_MS = 130;
export const RAMPAGE_FALL_DUR_MS = 240;

export const rampageHide = (symbol: object) => {
	if (!stateRampage.hiddenSymbols.includes(symbol)) stateRampage.hiddenSymbols.push(symbol);
};

export const rampageUnhide = (symbol: object) => {
	stateRampage.hiddenSymbols = stateRampage.hiddenSymbols.filter((s) => s !== symbol);
};

export const rampageUnhideAll = () => {
	if (stateRampage.hiddenSymbols.length) stateRampage.hiddenSymbols = [];
};
