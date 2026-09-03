// Definición de los sliders del UI LAB — compartida entre UiLab.svelte (panel
// in-game, tecla T) y /sizes (panel del padre, fuera del iframe del juego).
export const LAB_SLIDERS = [
	{ key: 'boardH', label: 'Grilla', min: 0.6, max: 1.6, step: 0.002 },
	{ key: 'boardX', label: 'Grilla X', min: 0.15, max: 0.85, step: 0.001 },
	{ key: 'boardY', label: 'Grilla Y', min: 0.15, max: 0.85, step: 0.001 },
	{ key: 'stackScale', label: 'Botonera', min: 0.5, max: 1.5, step: 0.005 },
	{ key: 'stackRight', label: 'Botonera X', min: -40, max: 400, step: 1 },
	{ key: 'stackBottom', label: 'Botonera Y', min: -40, max: 400, step: 1 },
	{ key: 'iconScale', label: 'Config+Bonus', min: 0.4, max: 2, step: 0.005 },
	{ key: 'iconX', label: 'Config X', min: -40, max: 400, step: 1 },
	{ key: 'iconY', label: 'Config Y', min: -40, max: 400, step: 1 },
	{ key: 'kashH', label: 'Kash size', min: 0.3, max: 1.2, step: 0.002 },
	{ key: 'kashX', label: 'Kash X', min: -0.1, max: 0.5, step: 0.001 },
	{ key: 'kashY', label: 'Kash Y', min: 0.2, max: 0.9, step: 0.001 },
] as const;

export type LabSliderKey = (typeof LAB_SLIDERS)[number]['key'];
