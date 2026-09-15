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
 * UI) y los 9 de geometría de los especiales. Eso NO bumpeó: las claves nuevas
 * son ADITIVAS y `loadOverrides` copia solo las que encuentra, así que un
 * override viejo no las trae y caen al DEFAULT vía el merge de `applyLayout`.
 *
 * v16 (09-09): SÍ bumpea. Se congelaron los 72 diales de íconos + marcos
 * aprobados en Desktop y `specialScale` pasó a ser un valor ÚNICO (1.235) en
 * los DEFAULTS, en vez de uno por bucket. Un override guardado con v15 trae el
 * `specialScale` VIEJO de su bucket (1.165…1.33) y ganaría sobre el nuevo
 * default — los especiales saldrían de otro tamaño justo en los tamaños que
 * este drop viene a emparejar. El bump descarta esos overrides y deja mandar a
 * los valores de código.
 *
 * v17 (10-09): SÍ bumpea. H4 y L4 intercambiaron ARTE (el fajo animado pasó a
 * ser KASH/H4 y el medallón bajó a L4), así que sus 12 diales de geometría
 * intercambiaron también sus valores aprobados. Un override v16 traería el
 * encuadre del medallón aplicado al fajo y viceversa — los marcos de victoria
 * saldrían corridos justo en los dos símbolos que este cambio toca.
 *
 * v18 (11-09): SÍ bumpea. Dos cambios encadenados:
 *
 *   1. Los íconos dejaron de comprimirse en X (`SYMBOL_SHEET_ASPECT` en
 *      `constants.ts` — los PNG son 1080×970 y se pintaban cuadrados), y el
 *      usuario reencuadró contra el arte ya sin deformar. La tabla nueva vive
 *      en SYMBOL_GEOM_APPROVED y vale para los 7 buckets.
 *   2. Las 7 excepciones de ícono/marco que tenía desktop en PER_BUCKET_SEED
 *      se absorbieron en esa tabla.
 *
 * Sin el bump el cambio NO llega a "todas las resoluciones", que es el pedido:
 * `saveTweak` persiste TODAS las claves del bucket activo —las 96 de símbolo
 * incluidas—, así que cualquier bucket guardado con v17 trae congelado el
 * encuadre viejo y `applyLayout` lo deja ganar sobre el default nuevo.
 *
 * ⚠ El bump descarta también los overrides de LAYOUT guardados (board, HUD,
 * título, contador FS…). Es el costo aceptado: cada bucket vuelve a su
 * PER_BUCKET_SEED de código, que es el último estado aprobado y versionado.
 */
export const LAB_STORAGE_KEY = 'kash_tweak_v18';

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
	{ id: 'freespin', label: 'CONTADOR FREE SPINS', order: 6 },
	{ id: 'antmarco', label: 'MARCO COLUMNA (anticipación)', order: 7 },
	{ id: 'intro', label: 'PANTALLA DE CARGA (INTRO)', order: 8 },
	// Una categoría POR SÍMBOLO (drop 09-09 · Paso 8) — se generan más abajo a
	// partir de `LAB_SYMBOLS`, a continuación de estas.
];

/**
 * Los 4 elementos de la PANTALLA DE CARGA (drop 14-09), en el orden en que se
 * listan en el panel. Cada uno lleva el mismo juego de 5 diales, con las
 * mismas convenciones que el resto del laboratorio:
 *
 *   · X / Y   → fracciones del VIEWPORT (0..1), como `hudX`/`titleX` lo son del
 *               canvas. La pantalla de carga es un overlay HTML a pantalla
 *               completa, así que su sistema de coordenadas es la ventana.
 *   · Scale   → multiplica el tamaño base del elemento. El tamaño base va en
 *               `min(Nvw, Mvh)` (ver `LoadingOverlay.svelte`) para que el arte
 *               no se salga ni en landscape ancho ni en portrait.
 *   · Alpha   → opacidad CSS 0..1.
 *   · Z       → capa dentro del overlay. Solo ordena estos 4 elementos entre
 *               ellos: el overlay entero va con `z-index: 200` sobre el canvas.
 *
 * Son por bucket, como todo lo demás: la misma pantalla se encuadra distinto
 * en Desktop que en Mobile portrait.
 *
 * Para ajustarlos hace falta que la pantalla esté en pantalla — y se cierra al
 * primer click. ANIM LAB (tecla A) → PANTALLA DE CARGA trae "MOSTRAR de nuevo"
 * y el toggle "no cerrar al click", que es el modo en que se tunea esto.
 */
export const LAB_INTRO_ELEMENTS = [
	{ id: 'introTitle', label: 'INTRO — TÍTULO' },
	{ id: 'introAnim', label: 'INTRO — UI (ventana animada)' },
	{ id: 'introSpin', label: 'INTRO — ÍCONO DE CARGA' },
	{ id: 'introText', label: 'INTRO — TEXTO' },
] as const;

export type IntroLabId = (typeof LAB_INTRO_ELEMENTS)[number]['id'];

export const INTRO_GEOM_PROPS = ['X', 'Y', 'Scale', 'Alpha', 'Z'] as const;

export type IntroGeomKey = `${IntroLabId}${(typeof INTRO_GEOM_PROPS)[number]}`;

/**
 * Los 12 símbolos del board, en el orden en que se listan en el panel. El `id`
 * es el `assetKey` SIN el prefijo `sym_`, y de ahí salen las claves del
 * laboratorio: `h1` → `h1X`, `h1Y`, `h1Scale`, `h1MarcoX`, `h1MarcoY`,
 * `h1MarcoScale`. `SymbolSprite` hace el camino inverso (`assetKey.slice(4)`),
 * así que no hay ningún mapa que mantener sincronizado a mano.
 *
 * Las etiquetas llevan la identidad de la MATH y el arte entre paréntesis
 * (`game_config.py`: H1=Bluff · H2=Syl · H3=Rookie · H4=KASH · L1=Drill ·
 * L2=Keycard · L3=Smoke Grenade · L4=Cash Stack), porque el nombre del archivo
 * no alcanza para saber cuál es cuál — fue justamente la confusión que dejó a
 * L4 sin arte en el Paso 7.
 *
 * ⚠ El ARTE de H4 y L4 está cruzado respecto de los nombres de archivo: KASH
 * (H4, el premium) es el FAJO animado `anim_sym_premium`, y el medallón que
 * llegó rotulado `h4.png` es L4. Decisión de dirección del 10-09.
 */
export const LAB_SYMBOLS = [
	{ id: 'h4', label: 'H4 — KASH (fajo) ✦' },
	{ id: 'h3', label: 'H3 — Rookie (RAT)' },
	{ id: 'h2', label: 'H2 — Syl (FT?)' },
	{ id: 'h1', label: 'H1 — Bluff (12)' },
	{ id: 'm1', label: 'M1 — Nitro' },
	{ id: 'm2', label: 'M2 — ACCESS' },
	{ id: 'l1', label: 'L1 — Drill (palancas)' },
	{ id: 'l2', label: 'L2 — Manopla' },
	{ id: 'l3', label: 'L3 — Molotov' },
	{ id: 'l4', label: 'L4 — Medallón X' },
	{ id: 'w', label: 'W — WILD ✦' },
	{ id: 's', label: 'S — SCATTER ✦' },
] as const;

export type SymbolLabId = (typeof LAB_SYMBOLS)[number]['id'];

/**
 * Sufijos de las 8 claves que tiene cada símbolo.
 *
 * `Scale` es el dial CONJUNTO (escala los dos ejes a la vez, es el histórico);
 * `ScaleX` / `ScaleY` multiplican ENCIMA de él, uno por eje, para corregir
 * proporción sin tocar el tamaño general. Los tres se multiplican entre sí, así
 * que con ScaleX = ScaleY = 1 el símbolo queda exactamente como antes de que
 * existieran estos dos diales.
 */
export const SYMBOL_GEOM_PROPS = [
	'X',
	'Y',
	'Scale',
	'ScaleX',
	'ScaleY',
	'MarcoX',
	'MarcoY',
	'MarcoScale',
] as const;

export type SymbolGeomKey = `${SymbolLabId}${(typeof SYMBOL_GEOM_PROPS)[number]}`;

// Las 12 categorías por símbolo, después de las globales (order 10 en adelante).
for (const [i, symbol] of LAB_SYMBOLS.entries()) {
	LAB_CATEGORIES.push({ id: `sym_${symbol.id}`, label: symbol.label, order: 10 + i });
}

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
	// ── CONTADOR DE FREE SPINS (drop 09-09 · Paso 8) ────────────────────────
	// Antes vivía dentro del wrapper del board, así que se movía y escalaba con
	// la grilla y en los tamaños grandes se iba de pantalla. Ahora es un
	// elemento suelto en coordenadas de canvas, como el HUD superior y el
	// título: X/Y son fracciones del canvas.
	{ id: 'fsX', label: 'FS X', min: 0, max: 1, step: 0.001, category: 'freespin', order: 55 },
	{ id: 'fsY', label: 'FS Y', min: 0, max: 1, step: 0.001, category: 'freespin', order: 56 },
	{ id: 'fsScale', label: 'FS size', min: 0.2, max: 3, step: 0.005, category: 'freespin', order: 57 },
	{ id: 'fsAlpha', label: 'FS opacidad', min: 0, max: 1, step: 0.01, category: 'freespin', order: 58 },
	{ id: 'fsZ', label: 'FS capa', ...LAYER, category: 'freespin', order: 59 },
	// ── MARCO DE COLUMNA de la anticipación (drop 10-09, `Marco_2`) ─────────
	// Mismas convenciones que los diales por símbolo: X/Y son FRACCIONES DE
	// CELDA (× SYMBOL_SIZE) sobre el centro de la columna, y `Scale` multiplica
	// el tamaño base — que se ata al ALTO del board, porque el arte es un
	// pilar. El rango de X/Y es ±1.5 celdas y no ±0.5 como el de los símbolos:
	// acá se encuadra un objeto de 400 px de alto contra la grilla, no se hace
	// un nudge fino dentro de una casilla.
	//
	// Para verlo mientras se ajusta: ANIM LAB (tecla A) → MARCO + LUZ →
	// "MARCO COLUMNA en bucle". Deja el clip prendido en las 7 columnas.
	{ id: 'antMarcoX', label: 'Marco col. X', min: -1.5, max: 1.5, step: 0.005, category: 'antmarco', order: 60 },
	{ id: 'antMarcoY', label: 'Marco col. Y', min: -1.5, max: 1.5, step: 0.005, category: 'antmarco', order: 61 },
	{ id: 'antMarcoScale', label: 'Marco col. tamaño', min: 0.3, max: 2.5, step: 0.005, category: 'antmarco', order: 62 },
];

// ── PANTALLA DE CARGA: 5 sliders × 4 elementos (drop 14-09) ─────────────────
// Los 4 van a la MISMA categoría (son una sola pantalla, se encuadran uno
// contra otro) y el label lleva el nombre del elemento adelante para poder
// distinguirlos dentro de la lista.
const INTRO_SLIDER_SPECS: { prop: string; label: string; min: number; max: number; step: number; decimals?: number }[] = [
	{ prop: 'X', label: 'X', min: 0, max: 1, step: 0.002 },
	{ prop: 'Y', label: 'Y', min: 0, max: 1, step: 0.002 },
	{ prop: 'Scale', label: 'Tamaño', min: 0.2, max: 2.5, step: 0.005 },
	{ prop: 'Alpha', label: 'Opacidad', min: 0, max: 1, step: 0.01 },
	{ prop: 'Z', label: 'Capa', ...LAYER },
];

for (const [i, element] of LAB_INTRO_ELEMENTS.entries()) {
	// El prefijo del label se recorta del label de la categoría del elemento
	// ("INTRO — TÍTULO" → "TÍTULO") para que el slider diga "TÍTULO · X".
	const name = element.label.replace('INTRO — ', '');
	for (const [j, spec] of INTRO_SLIDER_SPECS.entries()) {
		LAB_SLIDERS.push({
			id: `${element.id}${spec.prop}`,
			label: `${name} · ${spec.label}`,
			min: spec.min,
			max: spec.max,
			step: spec.step,
			decimals: spec.decimals,
			category: 'intro',
			order: 70 + i * 10 + j,
		});
	}
}

// ── GEOMETRÍA POR SÍMBOLO: 8 sliders × 12 símbolos (drop 09-09 · Paso 8) ────
// Antes solo los 3 animados (W / S / Cash Stack) tenían diales propios; ahora
// los 12 se ajustan individualmente, y cada uno lleva ADEMÁS los 3 del marco
// de victoria que se dibuja sobre él.
//
// Convenciones (iguales a las que ya usaban los especiales):
//   · X / Y      → fracciones de CELDA (× SYMBOL_SIZE) sobre la posición que
//                  ya le dio la grilla. ±0.5 = media celda: alcanza para
//                  reencuadrar un ícono que cuelga sin sacarlo de su casilla.
//   · Scale      → multiplica al tamaño que le da su `box`. Para los 3
//                  animados se multiplica además por el dial de grupo
//                  `specialScale` (categoría BOTONERA + ÍCONOS).
//   · ScaleX/Y   → estiran UN eje encima de `Scale`, sin tocar el otro. Son el
//                  dial de PROPORCIÓN: `Scale` cambia cuánto ocupa el ícono,
//                  estos dos cambian su forma. El tamaño nativo (el de la hoja
//                  de sprite, 1080×970) es 1/1 — no hay que compensar nada acá
//                  para que el ícono salga sin deformar.
//   · Marco*     → lo mismo, pero para el clip `Marco_Icono` que estalla
//                  SOBRE el símbolo al anotar. Van acá y no en una categoría
//                  aparte porque el encuadre del marco depende del ícono que
//                  enmarca: cada uno necesita el suyo.
const SYMBOL_SLIDER_SPECS = [
	{ prop: 'X', label: 'X', min: -0.5, max: 0.5, step: 0.005 },
	{ prop: 'Y', label: 'Y', min: -0.5, max: 0.5, step: 0.005 },
	{ prop: 'Scale', label: 'Tamaño', min: 0.3, max: 2.5, step: 0.005 },
	{ prop: 'ScaleX', label: 'Tamaño X (ancho)', min: 0.5, max: 2, step: 0.005 },
	{ prop: 'ScaleY', label: 'Tamaño Y (alto)', min: 0.5, max: 2, step: 0.005 },
	{ prop: 'MarcoX', label: 'Marco X', min: -0.5, max: 0.5, step: 0.005 },
	{ prop: 'MarcoY', label: 'Marco Y', min: -0.5, max: 0.5, step: 0.005 },
	{ prop: 'MarcoScale', label: 'Marco tamaño', min: 0.3, max: 3, step: 0.005 },
] as const;

for (const [i, symbol] of LAB_SYMBOLS.entries()) {
	for (const [j, spec] of SYMBOL_SLIDER_SPECS.entries()) {
		LAB_SLIDERS.push({
			id: `${symbol.id}${spec.prop}`,
			label: spec.label,
			min: spec.min,
			max: spec.max,
			step: spec.step,
			category: `sym_${symbol.id}`,
			order: 100 + i * 10 + j,
		});
	}
}

export type LabSliderKey = (typeof LAB_SLIDERS)[number]['id'];
