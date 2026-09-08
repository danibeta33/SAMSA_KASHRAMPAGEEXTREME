// MANIFIESTO DEL INSPECTOR — datos DEL JUEGO (Kash Rampage Extreme).
//
// Antes este archivo era el catálogo que los paneles importaban directamente
// (UiLab.svelte y /sizes hacían `import { LAB_SLIDERS }`). Ahora es solo un
// manifiesto de datos: `labInspector.svelte.ts` lo INYECTA en el registro
// genérico del paquete `components-inspector` y los paneles lo descubren en
// runtime desde ahí. El paquete compartido nunca importa este archivo.
//
// Sin imports en runtime a propósito: `stateTweak.svelte.ts` lee de acá la
// clave de persistencia y no puede haber ciclo.

import type {
	InspectorCategoryConfig,
	InspectorSliderConfig,
	InspectorToggleConfig,
} from 'components-inspector';

/**
 * Clave de localStorage del laboratorio. Es del JUEGO, no del inspector: el
 * panel genérico la recibe vía `inspector.configure({ storageKey })` y
 * `stateTweak.svelte.ts` la usa para leer/escribir sus overrides por bucket.
 *
 * v14: buckets alineados 1:1 con los tamaños del selector del ACP de Stake.
 * Subir el número invalida los overrides guardados con buckets viejos.
 */
export const LAB_STORAGE_KEY = 'kash_tweak_v14';

export const LAB_TITLE = 'UI LAB';

export const LAB_NOTE =
	'Los sliders guardan SOLO para este bucket — redimensioná la ventana para ajustar otro.';

export const LAB_CATEGORIES: (InspectorCategoryConfig & { id: string })[] = [
	{ id: 'global', label: 'GLOBAL', order: 0 },
	{ id: 'board', label: 'GRILLA', order: 1 },
	{ id: 'hud', label: 'BOTONERA + ÍCONOS', order: 2 },
	{ id: 'kash', label: 'KASH', order: 3 },
	{ id: 'tophud', label: 'HUD SUPERIOR', order: 4 },
	{ id: 'title', label: 'TÍTULO', order: 5 },
];

export const LAB_TOGGLES: (InspectorToggleConfig & { id: string })[] = [
	{
		id: 'freeScale',
		label: 'LIBRE — sin límites anti-solape (los sliders mandan)',
		category: 'global',
		order: 0,
		on: 1,
		off: 0,
		default: 0,
	},
	// El alternador fila/columna del HUD superior va como TOGGLE y no como
	// acción a propósito: UiLab.svelte (tecla T) renderiza `group.controls` e
	// IGNORA `group.actions` — las acciones las dibuja AnimLab (tecla A). Como
	// toggle queda junto a sus sliders, persiste por bucket como el resto, y
	// encaja con que el host del inspector solo maneja números.
	{
		id: 'hudVertical',
		label: 'COLUMNA (off = fila)',
		category: 'tophud',
		order: 44,
		on: 1,
		off: 0,
		default: 1,
	},
];

export const LAB_SLIDERS: (InspectorSliderConfig & { id: string })[] = [
	{ id: 'boardH', label: 'Grilla', min: 0.6, max: 1.6, step: 0.002, category: 'board', order: 10 },
	{ id: 'boardX', label: 'Grilla X', min: 0.15, max: 0.85, step: 0.001, category: 'board', order: 11 },
	{ id: 'boardY', label: 'Grilla Y', min: 0.15, max: 0.85, step: 0.001, category: 'board', order: 12 },
	{ id: 'stackScale', label: 'Botonera', min: 0.5, max: 1.5, step: 0.005, category: 'hud', order: 20 },
	{ id: 'stackRight', label: 'Botonera X', min: -40, max: 400, step: 1, category: 'hud', order: 21 },
	{ id: 'stackBottom', label: 'Botonera Y', min: -40, max: 400, step: 1, category: 'hud', order: 22 },
	{ id: 'iconScale', label: 'Config+Bonus', min: 0.4, max: 2, step: 0.005, category: 'hud', order: 23 },
	{ id: 'iconX', label: 'Config X', min: -40, max: 400, step: 1, category: 'hud', order: 24 },
	{ id: 'iconY', label: 'Config Y', min: -40, max: 400, step: 1, category: 'hud', order: 25 },
	{ id: 'specialScale', label: 'Especiales (W/S/H4)', min: 0.6, max: 2.5, step: 0.005, category: 'hud', order: 26 },
	{ id: 'kashH', label: 'Kash size', min: 0.3, max: 1.2, step: 0.002, category: 'kash', order: 30 },
	{ id: 'kashX', label: 'Kash X', min: -0.1, max: 0.5, step: 0.001, category: 'kash', order: 31 },
	{ id: 'kashY', label: 'Kash Y', min: 0.2, max: 0.9, step: 0.001, category: 'kash', order: 32 },
	{ id: 'hudX', label: 'HUD X', min: 0, max: 1, step: 0.001, category: 'tophud', order: 40 },
	{ id: 'hudY', label: 'HUD Y', min: 0, max: 1, step: 0.001, category: 'tophud', order: 41 },
	{ id: 'hudScale', label: 'HUD size', min: 0.3, max: 2.5, step: 0.005, category: 'tophud', order: 42 },
	{ id: 'hudGap', label: 'Separación', min: -40, max: 120, step: 1, category: 'tophud', order: 43 },
	{ id: 'titleX', label: 'Título X', min: 0, max: 1, step: 0.001, category: 'title', order: 50 },
	{ id: 'titleY', label: 'Título Y', min: 0, max: 1, step: 0.001, category: 'title', order: 51 },
	{ id: 'titleScale', label: 'Título size', min: 0.2, max: 3, step: 0.005, category: 'title', order: 52 },
];

export type LabSliderKey = (typeof LAB_SLIDERS)[number]['id'];
