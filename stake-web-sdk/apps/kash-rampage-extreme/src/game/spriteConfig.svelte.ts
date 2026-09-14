// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE ANCLAJES / GEOMETRÍA DE SPRITES (Paso 3 — anclajes por código)
//
// PROBLEMA QUE RESUELVE
// PixiJS 8 crea todo sprite con anchor (0,0): la esquina superior izquierda del
// bounding box queda clavada en (x,y). Con clips que NO comparten bounding box
// (el swing de Kash viene de un canvas 1080², los idles de un recorte 384×460)
// eso hace que el personaje SALTE al intercambiar animación: cambia el box,
// cambia el punto anclado, y los pies se van de sitio.
//
// La corrección es anclar por SEMÁNTICA, no por defecto de la librería:
//   · personajes   → centro inferior (0.5, 1) — los PIES quedan clavados
//   · símbolos     → centro (0.5, 0.5) — el pop/rotación giran en su eje
//   · letterings   → centro (0.5, 0.5)
//   · escenografía → centro (0.5, 0.5) — cover fit
//
// PRIORIDAD DE RESOLUCIÓN (la primera que matchea, gana):
//   1. override reactivo en vivo   (spritePlacementOverrides — el UiLab/AnimLab)
//   2. entrada explícita por assetId (SPRITE_PLACEMENTS)
//   3. regla por TAG derivado del patrón del id (TAG_PATTERNS + PLACEMENT_BY_TAG)
//   4. fallback (centro)
//
// NOTA SOBRE EL FALLBACK: `getSpritePlacement()` siempre devuelve algo usable y
// nunca (0,0). Pero el resolver que se inyecta en `pixi-svelte`
// (`resolveAutoAnchor`) devuelve `undefined` para los ids que NO clasifica, para
// no re-anclar assets ajenos al juego que sí quieren el (0,0) de PixiJS (los
// progress bars de los loading screens del SDK, por ejemplo).
// ─────────────────────────────────────────────────────────────────────────────

/** Ancla normalizada de PixiJS: 0 = borde inicial, 1 = borde final. */
export type SpriteAnchor = { anchorX: number; anchorY: number };

/**
 * Geometría declarada de un asset. Son TRES conceptos y ninguno es un "offset
 * mágico": dónde pivotea, qué forma tiene y cuánto mide su cuerpo.
 *
 * Los offsets en X/Y que antes vivían sueltos en `Background.svelte` NO están
 * acá: se plegaron dentro del ancla, que es su equivalente exacto —
 * desplazar el sprite `d` píxeles es lo mismo que mover el pivot `d / ancho`
 * en unidades normalizadas. Un offset y un ancla son la misma cosa escrita de
 * dos maneras; el ancla es la que PixiJS entiende nativamente.
 */
export type SpritePlacement = SpriteAnchor & {
	/** Relación ancho/alto del frame recortado — deriva el width desde el height. */
	aspect?: number;
	/**
	 * Escala del alto mostrado. NO es un ajuste a ojo: es la proporción del crop
	 * que ocupa el cuerpo del personaje. Dos clips recortados con distinto zoom
	 * necesitan escalas distintas para que el cuerpo mida lo mismo en pantalla.
	 */
	scale?: number;
	/** Frames por segundo del clip (los sheets no lo traen en su JSON). */
	fps?: number;
	/** El clip se dibuja por delante del board (el SMASH), no detrás. */
	foreground?: boolean;
};

/** De dónde salió el placement resuelto — lo consume el inspector (Paso 4). */
export type SpritePlacementSource = 'override' | 'asset' | `tag:${string}` | 'fallback';

export type SpritePlacementInfo = SpritePlacement & {
	assetId: string;
	source: SpritePlacementSource;
	tag: SpriteTag | null;
};

// ── Tags: clasificación por patrón de id ────────────────────────────────────
// El orden importa: se evalúa de arriba abajo y gana el primer patrón que
// matchea. `anim_sym_*` tiene que caer en `symbol` y no en `character`, por eso
// los prefijos son explícitos y no se solapan.
export type SpriteTag = 'character' | 'symbol' | 'lettering' | 'scene';

export const TAG_PATTERNS: { tag: SpriteTag; patterns: RegExp[] }[] = [
	// Kash: todos los clips del personaje + el PNG estático de fallback.
	{ tag: 'character', patterns: [/^anim_kash_/, /^kash_side$/] },
	// Íconos del board: estáticos, iluminados y animados.
	{ tag: 'symbol', patterns: [/^sym_/, /^anim_sym_/] },
	// Carteles de celebración, paneles de free spins y logo.
	{ tag: 'lettering', patterns: [/^anim_win_/, /^fs_/, /^kash_logo$/] },
	// Fondo (estático y animado) y marco del board.
	{ tag: 'scene', patterns: [/^bg_/, /^board_/, /^anim_fondo$/] },
];

/** Ancla por defecto de cada familia. La regla por patrón vive acá. */
export const PLACEMENT_BY_TAG: Record<SpriteTag, SpritePlacement> = {
	// PIES clavados: el actor se planta y solo cambia lo que hace.
	character: { anchorX: 0.5, anchorY: 1 },
	symbol: { anchorX: 0.5, anchorY: 0.5 },
	lettering: { anchorX: 0.5, anchorY: 0.5 },
	scene: { anchorX: 0.5, anchorY: 0.5 },
};

/**
 * Fallback para un id sin tag. Centro y NUNCA (0,0): el default de PixiJS es
 * justamente el que produce el salto que este módulo viene a eliminar.
 */
export const FALLBACK_PLACEMENT: SpritePlacement = { anchorX: 0.5, anchorY: 0.5 };

// ── Placements explícitos por assetId ───────────────────────────────────────
// Solo lo que NO se deduce del tag: la geometría propia de cada clip.
//
// Los 6 idles del equipo comparten recorte (384×460) y velocidad → misma
// entrada para todos. El swing (Kash_Batea) viene de un canvas distinto y con
// el cuerpo desplazándose, así que declara su propia geometría.
const IDLE: SpritePlacement = {
	anchorX: 0.5,
	anchorY: 1,
	aspect: 384 / 460,
	fps: 10,
	foreground: false,
};

const KASH_IDLE_IDS = [
	'anim_kash_idle_stand1',
	'anim_kash_idle_glasses1',
	'anim_kash_idle_scratch1',
	'anim_kash_idle_nose1',
	'anim_kash_idle_bat1',
	'anim_kash_idle_bat2',
] as const;

// ── Geometría del swing, y de dónde sale su ancla ───────────────────────────
// El swing está PLANTADO (cada frame recortado centrado en los pies, ver
// swing_planted.py), pero su crop no coincide con el de los idles: el cuerpo
// ocupa ~84.7% del alto del crop, así que necesita su propia `scale` para que
// el cuerpo mida lo mismo en pantalla que el standby.
//
// Encima de eso, la alineación fina la ajustó el usuario en el AnimLab contra
// el ghost del idle. Ese ajuste estaba escrito como dos offsets en píxeles de
// canvas (dxFrac / dyFrac, en fracción del alto de Kash). Un offset es un ancla
// disfrazada, así que acá se PLIEGA dentro del pivot y desaparece como concepto:
//
//   x = X + H·dxFrac   con anchorX 0.5   ≡   x = X   con anchorX = 0.5 − dxFrac/(scale·aspect)
//   y = Y + H·dyFrac   con anchorY 1     ≡   y = Y   con anchorY = 1   − dyFrac/scale
//
// (H se cancela en ambas: por eso la alineación aguanta en cualquier resolución
// sin necesidad de fracciones ni de recalcular nada por bucket.)
// `dwide` del AnimLab: estira el clip SOLO de los lados — el alto y la línea de
// pies no se tocan— para que el bateo no se vea más angosto que los idles. Va
// dentro del aspect (y no de la escala) por eso mismo, y el anchorX lo usa YA
// multiplicado: la alineación en píxeles se pliega contra el ancho FINAL.
const SWING_CROP_ASPECT = 423 / 460;
const SWING_WIDE = 1.1; // horneado del AnimLab (11-09) — "swing ancho (×aspect)"
const SWING_ASPECT = SWING_CROP_ASPECT * SWING_WIDE; // ≈1.0115
const SWING_SCALE = 1.09 * 0.99 * 1.02; // ≈1.1007 — cuerpo del swing = cuerpo del standby
// Cada sumando es un nudge del AnimLab en px de canvas sobre el alto de Kash de
// esa sesión (por eso la fracción): así la alineación aguanta en cualquier
// resolución. El último par (/474) es el ajuste del 11-09, hecho en Desktop
// contra el ghost del idle junto con el ensanche de arriba.
const SWING_DX_FRAC = 37 / 563 - 26 / 650 + 39 / 650 + 7 / 474; // ≈ 0.1005
const SWING_DY_FRAC = -4 / 563 - 18 / 650 + 7 / 650 + 2 / 474; // ≈ −0.0198

export const SPRITE_PLACEMENTS: Record<string, SpritePlacement> = {
	...Object.fromEntries(KASH_IDLE_IDS.map((id) => [id, IDLE])),
	anim_kash_swing: {
		anchorX: 0.5 - SWING_DX_FRAC / (SWING_SCALE * SWING_ASPECT), // ≈0.4097
		anchorY: 1 - SWING_DY_FRAC / SWING_SCALE, // ≈1.0180 (>1 es válido en PixiJS)
		aspect: SWING_ASPECT,
		scale: SWING_SCALE,
		fps: 24,
		// El SMASH pasa por delante del board; los idles viven detrás.
		foreground: true,
	},
	// PNG estático mientras cargan los sheets — misma línea de pies, aspect del
	// arte original (528×1200).
	kash_side: { anchorX: 0.5, anchorY: 1, aspect: 528 / 1200 },
	// Fondo animado. Escenografía → pivot al centro (cover fit desde el centro
	// del canvas, igual que el JPG al que reemplaza). El aspect es el del frame
	// SIN recortar del sheet (1728×972 = 16:9 exacto); el fps es el único dato
	// del clip que no sale del .json (TexturePacker no lo exporta) — 16 frames
	// a 12fps = loop ambiente de 1.33s.
	anim_fondo: { anchorX: 0.5, anchorY: 0.5, aspect: 1728 / 972, fps: 12 },
};

// ── Overrides EN VIVO (Paso 4: los escribe el Inspector Genérico) ───────────
// `$state` para que un cambio desde el panel repinte los sprites sin remount:
// los componentes leen el placement dentro de expresiones reactivas, así que
// tocar este objeto propaga solo.
export const spritePlacementOverrides = $state<Record<string, SpritePlacement>>({});

// ── Resolución ──────────────────────────────────────────────────────────────

/** Tag de un assetId, o `null` si no matchea ningún patrón conocido. */
export const tagOf = (assetId: string): SpriteTag | null =>
	TAG_PATTERNS.find((entry) => entry.patterns.some((p) => p.test(assetId)))?.tag ?? null;

/**
 * Geometría efectiva de un asset + de dónde salió.
 *
 * Es LA función del registro: recibe un id, evalúa la cascada y devuelve
 * `{ anchorX, anchorY, … }`. Todo lo demás son atajos sobre ella.
 */
export const getSpritePlacement = (assetId: string): SpritePlacementInfo => {
	const tag = tagOf(assetId);
	const override = spritePlacementOverrides[assetId];
	if (override) return { assetId, source: 'override', tag, ...override };
	const explicit = SPRITE_PLACEMENTS[assetId];
	if (explicit) return { assetId, source: 'asset', tag, ...explicit };
	if (tag) return { assetId, source: `tag:${tag}`, tag, ...PLACEMENT_BY_TAG[tag] };
	return { assetId, source: 'fallback', tag: null, ...FALLBACK_PLACEMENT };
};

/** Solo el ancla, en la forma que consume PixiJS (`anchor.set(x, y)`). */
export const getSpriteAnchor = (assetId: string): { x: number; y: number } => {
	const { anchorX, anchorY } = getSpritePlacement(assetId);
	return { x: anchorX, y: anchorY };
};

/**
 * Resolver que se le inyecta a `pixi-svelte` con `setAnchorResolver`.
 *
 * Devuelve `undefined` cuando el id no está clasificado, para que el paquete
 * deje intacto el default de PixiJS en assets que no son de este registro
 * (los progress bars del loading screen del SDK esperan (0,0)). El fallback
 * centro de `getSpritePlacement` es para los llamadores directos del juego.
 */
export const resolveAutoAnchor = (assetId: string): { x: number; y: number } | undefined => {
	const placement = getSpritePlacement(assetId);
	if (placement.source === 'fallback') return undefined;
	return { x: placement.anchorX, y: placement.anchorY };
};

// ── Escritura (la usará el inspector; también sirve para QA por consola) ────

/** Fija/actualiza el override en vivo de un asset (merge sobre lo resuelto). */
export const setSpritePlacement = (assetId: string, patch: Partial<SpritePlacement>) => {
	const { assetId: _id, source: _src, tag: _tag, ...base } = getSpritePlacement(assetId);
	spritePlacementOverrides[assetId] = { ...base, ...patch };
};

/** Atajo para el caso más frecuente: mover solo el ancla. */
export const setSpriteAnchor = (assetId: string, anchor: Partial<SpriteAnchor>) =>
	setSpritePlacement(assetId, anchor);

/**
 * Escritura DIRECTA del override, sin leer el valor resuelto. Es la que se usa
 * desde un `$effect`: `setSpritePlacement` lee el placement actual para hacer
 * merge, y leer lo que se escribe dentro de un efecto crearía un ciclo.
 */
export const putSpritePlacement = (assetId: string, placement: SpritePlacement) => {
	spritePlacementOverrides[assetId] = placement;
};

export const clearSpritePlacement = (assetId: string) => {
	delete spritePlacementOverrides[assetId];
};

export const resetSpritePlacements = () => {
	for (const key of Object.keys(spritePlacementOverrides)) delete spritePlacementOverrides[key];
};

/**
 * Catálogo de assets con placement conocido — lo va a iterar el panel del
 * Paso 4 para dibujar un control por sprite sin hardcodear la lista.
 */
export const listPlacementTargets = (): SpritePlacementInfo[] =>
	[...new Set([...Object.keys(SPRITE_PLACEMENTS), ...Object.keys(spritePlacementOverrides)])]
		.sort()
		.map(getSpritePlacement);
