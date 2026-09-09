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
 * v15 (08-09): se congelaron en PER_BUCKET_SEED los 7 buckets aprobados con
 * el HUD superior + título + especiales. El bump invalida los overrides
 * viejos de localStorage para que los valores nuevos manden.
 * Subir el número invalida los overrides guardados con buckets viejos.
 *
 * 09-09: se agregan los 12 diales de opacidad + capa (uno por elemento de la
 * UI) y los 9 de geometría de los especiales. NO se bumpea a propósito — las
 * claves nuevas son ADITIVAS y `loadOverrides` copia solo las que encuentra,
 * así que un override viejo simplemente no las trae y caen al DEFAULT vía el
 * merge de `applyBucket`. Bumpear acá tiraría los ajustes locales del usuario
 * sin ganar nada.
 */
export const LAB_STORAGE_KEY = 'kash_tweak_v15';

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
	// Geometría INDEPENDIENTE de W / S / H4 — el slider de grupo
	// (`specialScale`) sigue viviendo en `hud`, junto al resto de los íconos.
	{ id: 'specials', label: 'ESPECIALES', order: 6 },
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

/**
 * Rango común de los sliders de CAPA (drop 09-09). Cada elemento de la UI trae
 * su propio par opacidad + capa, y todos los de capa comparten esta forma.
 *
 * `decimals: 0` no es cosmético: tanto el `zIndex` de PIXI como el `z-index`
 * de CSS son enteros, y sin esto el paso fino (− / +) del inspector redondea a
 * 4 decimales y guardaría `3.0000` en vez de `3`.
 *
 * El rango −20..40 encierra a las dos constantes que acotan el espacio de
 * capas del CANVAS: el fondo está clavado en −5 y las celebraciones en +20
 * (ver `Background.svelte` y `Game.svelte`). Los dos elementos HTML —botonera
 * e íconos— usan el mismo rango pero se ordenan solo entre ellos: su overlay
 * (`.bb`, `z-index: 90`) va siempre por encima del canvas.
 */
const LAYER = { min: -20, max: 40, step: 1, decimals: 0 } as const;

export const LAB_SLIDERS: (InspectorSliderConfig & { id: string })[] = [
	{ id: 'boardH', label: 'Grilla', min: 0.6, max: 1.6, step: 0.002, category: 'board', order: 10 },
	{ id: 'boardX', label: 'Grilla X', min: 0.15, max: 0.85, step: 0.001, category: 'board', order: 11 },
	{ id: 'boardY', label: 'Grilla Y', min: 0.15, max: 0.85, step: 0.001, category: 'board', order: 12 },
	{ id: 'boardAlpha', label: 'Grilla opacidad', min: 0, max: 1, step: 0.01, category: 'board', order: 13 },
	{ id: 'boardZ', label: 'Grilla capa', ...LAYER, category: 'board', order: 14 },
	{ id: 'stackScale', label: 'Botonera', min: 0.5, max: 1.5, step: 0.005, category: 'hud', order: 20 },
	{ id: 'stackRight', label: 'Botonera X', min: -40, max: 400, step: 1, category: 'hud', order: 21 },
	{ id: 'stackBottom', label: 'Botonera Y', min: -40, max: 400, step: 1, category: 'hud', order: 22 },
	{ id: 'stackAlpha', label: 'Botonera opacidad', min: 0, max: 1, step: 0.01, category: 'hud', order: 23 },
	{ id: 'stackZ', label: 'Botonera capa (HTML)', ...LAYER, category: 'hud', order: 24 },
	{ id: 'iconScale', label: 'Config+Bonus', min: 0.4, max: 2, step: 0.005, category: 'hud', order: 25 },
	{ id: 'iconX', label: 'Config X', min: -40, max: 400, step: 1, category: 'hud', order: 26 },
	{ id: 'iconY', label: 'Config Y', min: -40, max: 400, step: 1, category: 'hud', order: 27 },
	{ id: 'iconAlpha', label: 'Config opacidad', min: 0, max: 1, step: 0.01, category: 'hud', order: 28 },
	{ id: 'iconZ', label: 'Config capa (HTML)', ...LAYER, category: 'hud', order: 29 },
	{ id: 'specialScale', label: 'Especiales (W/S/H4)', min: 0.6, max: 2.5, step: 0.005, category: 'hud', order: 30 },
	{ id: 'kashH', label: 'Kash size', min: 0.3, max: 1.2, step: 0.002, category: 'kash', order: 31 },
	{ id: 'kashX', label: 'Kash X', min: -0.1, max: 0.5, step: 0.001, category: 'kash', order: 32 },
	{ id: 'kashY', label: 'Kash Y', min: 0.2, max: 0.9, step: 0.001, category: 'kash', order: 33 },
	{ id: 'kashAlpha', label: 'Kash opacidad', min: 0, max: 1, step: 0.01, category: 'kash', order: 34 },
	{ id: 'kashZ', label: 'Kash capa', ...LAYER, category: 'kash', order: 35 },
	{ id: 'hudX', label: 'HUD X', min: 0, max: 1, step: 0.001, category: 'tophud', order: 40 },
	{ id: 'hudY', label: 'HUD Y', min: 0, max: 1, step: 0.001, category: 'tophud', order: 41 },
	{ id: 'hudScale', label: 'HUD size', min: 0.3, max: 2.5, step: 0.005, category: 'tophud', order: 42 },
	{ id: 'hudGap', label: 'Separación', min: -40, max: 120, step: 1, category: 'tophud', order: 43 },
	{ id: 'hudAlpha', label: 'HUD opacidad', min: 0, max: 1, step: 0.01, category: 'tophud', order: 45 },
	{ id: 'hudZ', label: 'HUD capa', ...LAYER, category: 'tophud', order: 46 },
	{ id: 'titleX', label: 'Título X', min: 0, max: 1, step: 0.001, category: 'title', order: 50 },
	{ id: 'titleY', label: 'Título Y', min: 0, max: 1, step: 0.001, category: 'title', order: 51 },
	{ id: 'titleScale', label: 'Título size', min: 0.2, max: 3, step: 0.005, category: 'title', order: 52 },
	{ id: 'titleAlpha', label: 'Título opacidad', min: 0, max: 1, step: 0.01, category: 'title', order: 53 },
	{ id: 'titleZ', label: 'Título capa', ...LAYER, category: 'title', order: 54 },
	// ── ESPECIALES: 3 diales por ícono (drop 09-09) ─────────────────────────
	// X/Y son fracciones de CELDA (× SYMBOL_SIZE) sobre la posición que ya le
	// dio la grilla — ±0.5 es media celda, suficiente para reencuadrar un clip
	// que cuelga sin sacarlo de su casilla. La escala multiplica al dial de
	// grupo `specialScale` (categoría BOTONERA + ÍCONOS).
	{ id: 'wildX', label: 'Wild X', min: -0.5, max: 0.5, step: 0.005, category: 'specials', order: 60 },
	{ id: 'wildY', label: 'Wild Y', min: -0.5, max: 0.5, step: 0.005, category: 'specials', order: 61 },
	{ id: 'wildScale', label: 'Wild size', min: 0.3, max: 2.5, step: 0.005, category: 'specials', order: 62 },
	{ id: 'scatterX', label: 'Scatter X', min: -0.5, max: 0.5, step: 0.005, category: 'specials', order: 63 },
	{ id: 'scatterY', label: 'Scatter Y', min: -0.5, max: 0.5, step: 0.005, category: 'specials', order: 64 },
	{ id: 'scatterScale', label: 'Scatter size', min: 0.3, max: 2.5, step: 0.005, category: 'specials', order: 65 },
	{ id: 'premiumX', label: 'Premium X', min: -0.5, max: 0.5, step: 0.005, category: 'specials', order: 66 },
	{ id: 'premiumY', label: 'Premium Y', min: -0.5, max: 0.5, step: 0.005, category: 'specials', order: 67 },
	{ id: 'premiumScale', label: 'Premium size', min: 0.3, max: 2.5, step: 0.005, category: 'specials', order: 68 },
];

export type LabSliderKey = (typeof LAB_SLIDERS)[number]['id'];
