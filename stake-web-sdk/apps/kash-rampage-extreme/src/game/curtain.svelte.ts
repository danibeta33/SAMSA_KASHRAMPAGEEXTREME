// Cortina compartida para los overlays HTML (bonus / confirm / autospins /
// settings) — mismo lenguaje de la salida del LoadingOverlay: el menú entra
// deslizándose desde arriba y sale cayendo hacia abajo.
//
// Uso (en el script de un componente — usa $effect, requiere init context):
//   const curtain = createCurtain(() => stateModal.modal?.name === 'xKash');
//   {#if curtain.visible} <div class:x--out={curtain.closing}> ...
//
// El gate `visible` mantiene el overlay montado CURTAIN_MS después del
// close para que la animación de salida alcance a verse.

export const CURTAIN_MS = 420;

export function createCurtain(isOpen: () => boolean) {
	let closing = $state(false);
	let wasOpen = false;

	$effect(() => {
		if (isOpen()) {
			wasOpen = true;
			closing = false;
		} else if (wasOpen) {
			wasOpen = false;
			closing = true;
			const t = setTimeout(() => (closing = false), CURTAIN_MS);
			return () => clearTimeout(t);
		}
	});

	return {
		get visible() {
			return isOpen() || closing;
		},
		get closing() {
			return closing;
		},
	};
}
