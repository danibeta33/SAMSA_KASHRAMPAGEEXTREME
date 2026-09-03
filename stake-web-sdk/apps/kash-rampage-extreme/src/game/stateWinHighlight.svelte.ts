// Resalte de clusters ganadores (feedback de dirección 15-07: "el cuadro detrás
// no es suficiente"). Mientras `active`, los símbolos que NO están en win
// se atenúan (SymbolSprite) para que los del cluster salten a la vista.
// Lo enciende Board.svelte al presentar wins (boardWithAnimateSymbols) y lo
// apagan TumbleBoard (al arrancar la explosión) y los settles/hides.
export const stateWinHighlight = $state({
	active: false,
});
