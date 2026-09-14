// Layout del board/Kash/meter — POR RESOLUCIÓN (pedido del usuario, feedback
// N1 #6): cada bucket de viewport tiene su propio juego de valores, ajustable
// a dedo desde el UI LAB (tecla T) o la página /sizes, y persistido por
// bucket en localStorage.
//
// Desde el 11-09 un bucket puede tener DOS ANCLAJES de resolución en vez de
// uno: PER_BUCKET_SEED (anclaje base) y WIDE_SEED (anclaje ancho). `desktop`
// los usa porque cubre de 1100 px de ancho hasta un 4K y con un solo juego de
// valores no cierra — el board escalaba con la ventana y el HUD no, así que
// el usuario terminaba manteniendo a mano dos configuraciones incompatibles.
// `applyLayout` mezcla los dos anclajes según el viewport (por TAMAÑO lo
// medido en px, por ASPECTO el grupo de Kash), y `uiScaleFor` (hudLayout) se
// encarga del crecimiento más allá del anclaje ancho.
// La clave de persistencia vive en el manifiesto del juego (`labMeta.ts`) —
// es la misma que se le pasa al inspector genérico vía `storageKey`, para que
// el panel no tenga ninguna constante propia del juego.
import { aspectBlend, sizeBlend } from './layoutRefs';
import {
	LAB_STORAGE_KEY,
	LAB_SYMBOLS,
	SYMBOL_GEOM_PROPS,
	type SymbolGeomKey,
	type SymbolLabId,
} from './labMeta';

const KEY = LAB_STORAGE_KEY; // { overrides: { [bucket]: {…claves tweakeables} } }

import { stateUiTweak } from './stateUiTweak.svelte';

type TweakBase = {
	boardH: number; // Board height as ratio of canvas height (drives frame + grid)
	boardX: number; // Board center X as ratio of canvas width
	boardY: number; // Board center Y as ratio of canvas height
	boardStretchX: number; // Horizontal reels-only stretch (spacing between reels)
	boardStretchY: number; // Vertical reels-only stretch
	kashH: number; // Kash lateral height as ratio of canvas height
	kashX: number; // Kash center X as ratio of canvas width
	kashY: number; // Kash center Y as ratio of canvas height
	stackScale: number; // Escala del stack BET/SPIN derecho (se sincroniza a stateUiTweak)
	stackRight: number; // Separación de la botonera al borde derecho (px, → stateUiTweak)
	stackBottom: number; // Separación de la botonera al borde inferior (px, → stateUiTweak)
	iconScale: number; // Escala de los íconos config + BONUS (→ stateUiTweak)
	iconX: number; // Separación de la fila de íconos al borde izquierdo (px, → stateUiTweak)
	iconY: number; // Separación de la fila de íconos al borde inferior (px, → stateUiTweak)
	// Layout LIBRE (0/1, por bucket): apaga los caps anti-solape del board
	// (sMaxRight/sMaxTop/sMaxWidth…) y los clamps del meter — los sliders
	// mandan tal cual, aunque las cosas se solapen. Pedido del usuario para
	// el ajuste a dedo: él es el cap.
	freeScale: number;
	// ── HUD SUPERIOR (TopHud.svelte, drop 08-09) ────────────────────────────
	// Grupo de los 3 recipientes (Balance / Last Win / Tumble). X/Y son
	// fracciones del canvas como boardX/boardY; la escala y el gap se
	// multiplican por uiScale igual que stackScale/stackRight.
	hudX: number;
	hudY: number;
	hudScale: number;
	hudGap: number; // Separación entre recipientes (px de diseño)
	hudVertical: number; // 0/1 — 0 = fila (horizontal) · 1 = columna (vertical)
	// Sprite del título, con controles PROPIOS: se mueve y escala sin relación
	// con el grupo de arriba.
	titleX: number;
	titleY: number;
	titleScale: number;
	// Multiplicador de tamaño SOLO para los íconos especiales (W wild, S scatter
	// y H4 premium) sobre el tamaño que ya les da su `box`. Sirve para que los
	// tres resalten contra los 10 regulares sin re-exportar arte.
	specialScale: number;
	// ── OPACIDAD Y CAPA, POR ELEMENTO (drop 09-09) ──────────────────────────
	// Cada objeto de la UI decide SU alpha y SU número de capa por separado: la
	// botonera puede ir en la capa 5 y Kash en la 6, con opacidades distintas.
	//
	// ⚠ Hay DOS espacios de capas, y no se mezclan — es una restricción del
	// navegador, no una decisión de diseño:
	//
	//   · CANVAS (PixiJS) — Kash · grilla · HUD superior · título. Comparten el
	//     stage, que ya va con `sortableChildren` (lo prende Background.svelte),
	//     así que estos cuatro SÍ se interpolan libremente entre ellos. El fondo
	//     está clavado en −5 y las celebraciones en +20 (constantes de
	//     Game.svelte / Background.svelte): son el piso y el techo del rango
	//     útil.
	//   · HTML (overlay) — botonera · íconos config+BONUS. Viven en
	//     `BottomBar.svelte`, que es un `position: fixed` con `z-index: 90`
	//     ENCIMA del canvas. Su número de capa los ordena entre ellos, nunca
	//     contra los elementos de canvas: ningún valor mete la botonera detrás
	//     de la grilla. Para eso habría que portar la botonera a Pixi.
	//
	// Los alpha van 0..1 y los multiplica el propio elemento (alpha de PIXI /
	// `opacity` de CSS), así que no se pisan entre sí.
	boardAlpha: number; // grilla + marco (el wrapper del board en Game.svelte)
	boardZ: number;
	kashAlpha: number; // personaje lateral (Background.svelte)
	kashZ: number;
	hudAlpha: number; // los 3 recipientes del HUD superior
	hudZ: number;
	titleAlpha: number; // sprite del título, independiente del grupo de arriba
	titleZ: number;
	stackAlpha: number; // botonera derecha (BET pill + SPIN/TURBO/AUTO) — HTML
	stackZ: number;
	iconAlpha: number; // fila config + BONUS — HTML
	iconZ: number;
	// ── CONTADOR DE FREE SPINS (drop 09-09 · Paso 8) ────────────────────────
	// Se independizó del board: X/Y son fracciones de CANVAS, como hudX/titleX.
	fsX: number;
	fsY: number;
	fsScale: number;
	fsAlpha: number;
	fsZ: number;
	// ── MARCO DE COLUMNA de la anticipación (drop 10-09, `Marco_2`) ─────────
	// X/Y en fracciones de CELDA sobre el centro de la columna; `Scale`
	// multiplica el tamaño base, que sale del ALTO del board.
	antMarcoX: number;
	antMarcoY: number;
	antMarcoScale: number;
};

// ── GEOMETRÍA POR SÍMBOLO (drop 09-09 · Paso 8) ─────────────────────────────
// 8 claves × 12 símbolos. En el Paso 6 solo los 3 animados tenían diales
// propios; ahora los 12 se ajustan individualmente y cada uno lleva además los
// del MARCO de victoria que se dibuja sobre él.
//
// Las claves se derivan del `assetKey` sin el prefijo `sym_` (`sym_h1` → `h1X`,
// `h1Y`, `h1Scale`, `h1MarcoX`, `h1MarcoY`, `h1MarcoScale`), así que no hay
// ningún mapa que mantener a mano: `SymbolSprite` hace `assetKey.slice(4)`.
//
// X/Y son FRACCIONES DE CELDA (× SYMBOL_SIZE) sobre la posición que ya le dio
// la grilla — no fracciones de canvas como boardX/hudX.
type Tweak = TweakBase & Record<SymbolGeomKey, number>;

/** Las 96 claves por símbolo, en el mismo orden que las genera el panel. */
export const SYMBOL_GEOM_KEYS = LAB_SYMBOLS.flatMap((symbol) =>
	SYMBOL_GEOM_PROPS.map((prop) => `${symbol.id}${prop}` as SymbolGeomKey),
);

// ── ÍCONOS + MARCOS APROBADOS — UN SOLO JUEGO PARA LOS 7 BUCKETS (09-09) ────
// El usuario ajustó los 6 diales × 12 símbolos a dedo en el UI LAB sobre el viewport de
// Desktop (1200×675) y aprobó el resultado. Se congelan en los DEFAULTS —y NO
// en PER_BUCKET_SEED— porque son INDEPENDIENTES DE LA RESOLUCIÓN:
//
//   · X / Y              → fracciones de CELDA (× SYMBOL_SIZE), no de canvas
//                          como boardX/hudX/fsX.
//   · Scale / MarcoScale → multiplican el tamaño que ya le dio el `box` del
//                          símbolo, que también deriva de SYMBOL_SIZE.
//
// SYMBOL_SIZE lo fija la grilla de cada bucket, así que el MISMO número da el
// MISMO encuadre relativo en los 7 tamaños del ACP: con esta tabla los íconos
// y los marcos quedan idénticos en desktop, laptop, los 2 popouts y los 3
// mobile, sin repetir 96 claves × 7 buckets. Si algún tamaño necesitara una
// excepción, alcanza con pisar ESA clave suelta en PER_BUCKET_SEED — el merge
// de `applyLayout` la deja ganar sobre el default.
//
// Nota sobre `wScale` / `sScale`: son el sucesor del viejo `SPECIAL_TRIM` — el
// bate WILD y el scatter entran en su box con más sangrado que el resto, así
// que a igual `specialScale` se veían más grandes que el fajo. Los valores del
// 11-09 (0.97 / 1.09) son más altos que los del 09-09 (0.82 / 0.935) porque se
// midieron contra los íconos ya sin comprimir en X.
//
// Orden de la tupla = APPROVED_PROPS → [X, Y, Scale, MarcoX, MarcoY, MarcoScale].
//
// Es un SUBCONJUNTO de SYMBOL_GEOM_PROPS a propósito: `ScaleX`/`ScaleY` (drop
// 11-09) no llevan valor por símbolo —son neutros en 1 para los 12— así que
// quedan fuera de esta tabla y salen de NEUTRAL_PROP_DEFAULTS. Indexar por
// NOMBRE y no por posición es lo que permite agregar diales nuevos sin
// reescribir las 12 tuplas aprobadas.
const APPROVED_PROPS = ['X', 'Y', 'Scale', 'MarcoX', 'MarcoY', 'MarcoScale'] as const;
type SymbolGeomTuple = readonly [number, number, number, number, number, number];

const SYMBOL_GEOM_APPROVED: Record<SymbolLabId, SymbolGeomTuple> = {
	// ⚠ h4 y l4 INTERCAMBIARON tupla el 10-09 junto con su arte: estos números
	// son del ARTE, no de la identidad de la math. El fajo animado pasó a H4
	// (marco 1.295, la caja grande que necesita un especial) y el medallón a L4
	// (marco 1.145).
	//
	// RE-APROBADOS EL 11-09, en la misma sesión que el fix de aspect de la hoja
	// de sprite (SYMBOL_SHEET_ASPECT): al dejar de comprimirse en X los íconos
	// cambiaron de ancho, y el usuario reencuadró los marcos y los especiales
	// contra el arte ya sin deformar. Los 7 valores que hasta ahora vivían como
	// EXCEPCIÓN de desktop en PER_BUCKET_SEED se absorbieron acá: son los mismos
	// números, pero ahora valen para los 7 buckets, que es lo que se pidió.
	h4: [0, 0, 1, -0.095, 0, 1.295],
	h3: [0, 0, 1, -0.105, 0, 1],
	h2: [0, 0, 0.92, -0.105, 0, 1.2],
	h1: [0, 0, 0.9, -0.115, -0.035, 1],
	m1: [0, 0.01, 0.875, -0.095, 0, 1.06],
	m2: [-0.01, 0, 1, -0.11, -0.02, 1.17],
	l1: [0, 0, 1, -0.095, -0.035, 1],
	l2: [0, 0, 1, -0.105, 0, 1],
	l3: [0, 0, 1, -0.13, 0, 1],
	l4: [0.01, 0, 1, -0.105, 0, 1.145],
	// Los dos especiales que más se movieron: con el ícono a su ancho real el
	// bate y la barra entraban distinto en su box, así que cambiaron tamaño,
	// nudge y —sobre todo— el encuadre de su marco (1.175 → 1.415 · 1.105 →
	// 1.475).
	w: [0.01, -0.04, 0.97, -0.145, -0.01, 1.415],
	s: [0.035, -0.14, 1.09, -0.095, -0.03, 1.475],
};

/**
 * Default de las props que NO están en la tabla aprobada. Los dos diales por
 * eje arrancan en 1 = el aspect NATIVO de la hoja de sprite (1080×970, ver
 * SYMBOL_SHEET_ASPECT en `constants.ts`): el neutro es "el ícono con la
 * proporción de su arte", no "el ícono cuadrado".
 */
const NEUTRAL_PROP_DEFAULTS: Record<string, number> = { ScaleX: 1, ScaleY: 1 };

const SYMBOL_GEOM_DEFAULTS = Object.fromEntries(
	LAB_SYMBOLS.flatMap((symbol) =>
		SYMBOL_GEOM_PROPS.map((prop) => {
			const approved = APPROVED_PROPS.indexOf(prop as (typeof APPROVED_PROPS)[number]);
			return [
				`${symbol.id}${prop}`,
				approved >= 0 ? SYMBOL_GEOM_APPROVED[symbol.id][approved] : NEUTRAL_PROP_DEFAULTS[prop],
			];
		}),
	),
) as Record<SymbolGeomKey, number>;

// Board height at which the reels grid matches the engine-native scale (1:1).
// DO NOT re-point this to the visual default — this is the anchor for the
// proportional coupling `boardBaseScale = boardH / BOARD_BASE_H`. When boardH
// grows above this, the grid + frame scale up in sync.
export const BOARD_BASE_H = 0.62;

// The frame PNG's transparent hole is not centered on the PNG (there's a
// smash-meter strip up top + progress tiles at the bottom). These constants
// re-center the reels grid inside the hole so `boardX/boardY` moves both frame
// and grid together while their hole/reels stay visually aligned.
// Measured against `board_frame.png` (2000×1694). Positive Y = hole below the
// geometric center of the PNG; positive X = hole to the right.
export const FRAME_HOLE_OFFSET_X = -0.005;
export const FRAME_HOLE_OFFSET_Y = 0.028;

const DEFAULTS: Tweak = {
	// Feedback N1 #6: grilla más grande. El tamaño real lo capan sMaxRight /
	// sMaxTop (hudLayout) — subir boardH sube el target y el board llena lo
	// que el viewport permita (el stack ahora es más chico → más aire).
	boardH: 1.02,
	boardX: 0.5,
	boardY: 0.501,
	// El stretch escala frame + grilla JUNTOS (comparten wrapper) — el fit
	// grilla-dentro-del-hueco lo resuelven los FRAME_*_RATIO de BoardFrame.
	// Acá el stretch solo fija el aspect del PNG en pantalla: el frame local
	// mide 547.6×522.8 (aspect 1.047) y el PNG nativo es 2000/1694 = 1.181 →
	// sx/sy debe ser 1.181/1.047 ≈ 1.127 para no deformarlo. 1.05/0.93 cumple
	// y deja el frame en pantalla ≈593×502 px en desktop (similar al aprobado).
	boardStretchX: 1.05,
	boardStretchY: 0.93,
	// Feedback N1 #6: personaje un poco más grande.
	kashH: 0.68,
	kashX: 0.106,
	kashY: 0.587,
	// Smash Meter (caja KASH STRIKES!) — ancla SOBRE Kash, sin superponerse a
	// la grilla (PersistentMultiplier calcula el ancla); meterX/meterY son un
	// nudge fino en celdas desde esa ancla.
	// Feedback N1 #6: botones de la derecha más pequeños (era 1.16).
	stackScale: 0.94,
	stackRight: 64,
	stackBottom: 22,
	iconScale: 1,
	iconX: 22,
	iconY: 18,
	freeScale: 0,
	// HUD superior — medidos del mock DESPUES de REFERENCIA_NUEVA_UI.png:
	// recipientes en COLUMNA sobre el margen derecho, arrancando arriba, y el
	// logo a la izquierda sobre el personaje. Son un punto de partida: el valor
	// bueno de cada bucket se ajusta en el UI LAB y se congela en
	// PER_BUCKET_SEED, igual que se hizo con board/kash/stack.
	hudX: 0.885,
	hudY: 0.155,
	hudScale: 1,
	hudGap: 6,
	hudVertical: 1,
	titleX: 0.1,
	titleY: 0.17,
	titleScale: 1,
	// Multiplicador de GRUPO de W / S / L4 (Cash Stack), encima del `Scale`
	// individual de cada uno. Va acá y ya NO por bucket: los `wScale`/`sScale`
	// de SYMBOL_GEOM_APPROVED se ajustaron CONTRA este 1.235, así que si un
	// bucket trajera otro valor sus tres especiales saldrían de tamaño distinto
	// al aprobado. Un solo número → los especiales resaltan igual en los 7.
	specialScale: 1.235,
	// Opacidad/capa por elemento: los defaults REPRODUCEN el apilado histórico,
	// que hasta ahora salía del orden de montaje. En canvas, de atrás hacia
	// adelante: fondo (−5, fijo) → Kash (−4) → grilla (0) → HUD superior (1) →
	// título (2) → celebraciones (20, fijo). En el overlay HTML los íconos van
	// detrás de la botonera, como estaban.
	boardAlpha: 1,
	boardZ: 0,
	kashAlpha: 1,
	kashZ: -4,
	hudAlpha: 1,
	hudZ: 1,
	titleAlpha: 1,
	titleZ: 2,
	stackAlpha: 1,
	stackZ: 2,
	iconAlpha: 1,
	iconZ: 1,
	// Contador de free spins. `fsScale` mide en SYMBOL_SIZE × uiScale (ver
	// FreeSpinCounter), o sea que es relativo como los diales de símbolo → el
	// 1.16 aprobado sirve para los 7 buckets. `fsX`/`fsY` en cambio SÍ son
	// fracciones de canvas: acá va la posición aprobada en Desktop (arriba a la
	// derecha) como punto de partida común, y el bucket que la necesite
	// distinta la pisa en PER_BUCKET_SEED. FreeSpinCounter ya clampea contra
	// los bordes, así que en portrait no se sale de pantalla.
	fsX: 0.833,
	fsY: 0.167,
	fsScale: 1.16,
	fsAlpha: 1,
	// −1 = por DETRÁS de la grilla (boardZ 0) y por delante de Kash (−4).
	fsZ: -1,
	// Marco de columna de la anticipación. Sin nudge y a escala 1 = el alto del
	// board. Punto de partida: el encuadre bueno sale del UI LAB (categoría
	// MARCO COLUMNA) con el preview del ANIM LAB prendido.
	antMarcoX: 0,
	antMarcoY: 0,
	antMarcoScale: 1,
	// Las 96 claves de geometría por símbolo (ver SYMBOL_GEOM_DEFAULTS).
	...SYMBOL_GEOM_DEFAULTS,
};

// ── Buckets de resolución — 1:1 con los tamaños del ACP de Stake ────────
// Primer match gana. Selector del ACP: Desktop 1200×675 · Laptop 1024×576 ·
// Popout S 400×225 · Popout L 800×450 · Mobile L/M/S (portrait). El usuario
// ajusta cada bucket a dedo en el UI LAB (o vía /sizes, que embebe el juego
// en cada tamaño exacto); PER_BUCKET_SEED congela los valores aprobados.
export type ResBucketKey =
	| 'portrait_s'
	| 'portrait_m'
	| 'portrait_l'
	| 'popout_s'
	| 'popout_l'
	| 'laptop'
	| 'desktop';

export const RES_BUCKETS: { key: ResBucketKey; label: string; match: (w: number, h: number) => boolean }[] = [
	// Los 3 Mobile del ACP tienen su PROPIO bucket (el usuario los ajustó con
	// valores distintos): S 320×568 · M 375×667 · L 425×812.
	{ key: 'portrait_s', label: 'Mobile S (<350 ancho)', match: (w, h) => h > w && w < 350 },
	{ key: 'portrait_m', label: 'Mobile M (<400 ancho)', match: (w, h) => h > w && w < 400 },
	{ key: 'portrait_l', label: 'Mobile L / portrait', match: (w, h) => h > w },
	{ key: 'popout_s', label: 'Popout S (<600 ancho)', match: (w) => w < 600 },
	{ key: 'popout_l', label: 'Popout L (<900 ancho)', match: (w) => w < 900 },
	{ key: 'laptop', label: 'Laptop (<1100 ancho)', match: (w) => w < 1100 },
	{ key: 'desktop', label: 'Desktop (≥1100)', match: () => true },
];

export const bucketFor = (w: number, h: number): ResBucketKey =>
	RES_BUCKETS.find((b) => b.match(w, h))!.key;


// Punto de partida por bucket (antes de los overrides del usuario) — acá se
// congelan los JSON aprobados del UI LAB. Los 7 buckets del ACP quedaron
// congelados el 08-09 con el drop del HUD superior + título: cada uno trae
// además de board/kash/botonera sus propios hud*/title* (la rama portrait de
// hudLayout lee boardX/boardY tweakeables, así que el board vertical se
// posiciona desde acá y no con constantes fijas).
//
// ⚠ ACÁ VA SOLO LO QUE DEPENDE DE LA RESOLUCIÓN: posiciones y tamaños medidos
// en fracciones de CANVAS o en px de pantalla (board*, kash*, stack*, icon*,
// hud*, title*, fsX/fsY). Lo que se mide en fracciones de CELDA o como
// multiplicador —los diales de íconos + marcos, `specialScale`, `fsScale`,
// y los alpha/capa— vive en DEFAULTS y es UNO SOLO para los 7: así el mismo
// ajuste a dedo hecho en Desktop se ve igual en laptop, popouts y los 3
// mobile. No re-listar esas claves acá salvo que un tamaño necesite una
// excepción real.
//
// Las EXCEPCIONES vigentes (10-09), todas aprobadas a dedo por el usuario:
//   · desktop  → 7 diales de ícono/marco (celda más grande) + boardZ/kashZ
//                intercambiados + `antMarco*`.
//   · laptop   → `fsScale` 1.01 (el 1.16 común se pisaba con el HUD).
//   · portrait → `titleAlpha` 0.05 (logo casi apagado) y `fsZ` 3.
// El resto de `antMarco*` va por bucket en los 7: es lo único de este drop que
// se encuadra contra el board Y contra la grilla a la vez.
const PER_BUCKET_SEED: Partial<Record<ResBucketKey, Partial<Tweak>>> = {
	// Aprobado por el usuario en /sizes (10-09, viewport 425×812 — Mobile L).
	// Este es el bucket MODELO de los 3 portrait: Mobile M y Mobile S copian de
	// acá el bloque de título (transparentado), el del contador de free spins y
	// el del marco de columna, y conservan su propio board/botonera/HUD.
	portrait_l: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.92,
		boardX: 0.485,
		boardY: 0.316,
		// botonera + iconos
		stackScale: 1.35,
		stackRight: -36,
		stackBottom: 6,
		iconScale: 0.655,
		iconX: 22,
		iconY: 118,
		// Kash
		kashH: 0.68,
		kashX: 0.106,
		kashY: 0.587,
		// HUD superior
		hudVertical: 0,
		hudX: 0.333,
		hudY: 0.579,
		hudScale: 0.82,
		hudGap: 6,
		// titulo — en portrait el logo queda CASI APAGADO (alpha 0.05): el board
		// vertical le come el lugar y competía con el HUD en fila.
		titleX: 0.471,
		titleY: 0.314,
		titleScale: 1.915,
		titleAlpha: 0.05,
		// contador de free spins — arriba al centro y por DELANTE de todo
		// (fsZ 3): en portrait no hay margen derecho libre como en landscape.
		fsX: 0.439,
		fsY: 0.008,
		fsScale: 0.66,
		fsZ: 3,
		// marco de columna de la anticipación
		antMarcoX: 0.075,
		antMarcoY: 0.145,
		antMarcoScale: 1.355,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 375×667 — Mobile M).
	// Título / free spins / marco de columna: mismos valores que Mobile L (los
	// tres bloques son fracciones de canvas o de celda, así que dan el mismo
	// encuadre relativo en los 3 portrait).
	portrait_m: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.92,
		boardX: 0.485,
		boardY: 0.34,
		// botonera + iconos
		stackScale: 1.035,
		stackRight: -36,
		stackBottom: 14,
		iconScale: 0.625,
		iconX: 22,
		iconY: 118,
		// Kash
		kashH: 0.68,
		kashX: 0.106,
		kashY: 0.587,
		// HUD superior
		hudVertical: 0,
		hudX: 0.307,
		hudY: 0.632,
		hudScale: 0.86,
		hudGap: 6,
		// titulo (= Mobile L)
		titleX: 0.471,
		titleY: 0.314,
		titleScale: 1.915,
		titleAlpha: 0.05,
		// contador de free spins (= Mobile L)
		fsX: 0.439,
		fsY: 0.008,
		fsScale: 0.66,
		fsZ: 3,
		// marco de columna (= Mobile L)
		antMarcoX: 0.075,
		antMarcoY: 0.145,
		antMarcoScale: 1.355,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 320×568 — Mobile S).
	// Título / free spins / marco de columna: mismos valores que Mobile L.
	portrait_s: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.908,
		boardX: 0.482,
		boardY: 0.346,
		// botonera + iconos
		stackScale: 0.945,
		stackRight: -36,
		stackBottom: 18,
		iconScale: 0.665,
		iconX: 22,
		iconY: 118,
		// Kash
		kashH: 0.68,
		kashX: 0.106,
		kashY: 0.587,
		// HUD superior
		hudVertical: 0,
		hudX: 0.281,
		hudY: 0.64,
		hudScale: 1,
		hudGap: 6,
		// titulo (= Mobile L)
		titleX: 0.471,
		titleY: 0.314,
		titleScale: 1.915,
		titleAlpha: 0.05,
		// contador de free spins (= Mobile L)
		fsX: 0.439,
		fsY: 0.008,
		fsScale: 0.66,
		fsZ: 3,
		// marco de columna (= Mobile L)
		antMarcoX: 0.075,
		antMarcoY: 0.145,
		antMarcoScale: 1.355,
	},
	// Aprobado por el usuario en /sizes (viewport 1200×675 — Desktop). Board /
	// Kash / botonera / título son del 08-09; el HUD superior se re-ajustó el
	// 09-09 junto con el drop de íconos + marcos, y el 10-09 se sumaron el
	// marco de columna, el intercambio de capas board/Kash y las 7 excepciones
	// de marco por símbolo de abajo.
	desktop: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.046,
		boardX: 0.51,
		boardY: 0.52,
		// Capas INTERCAMBIADAS contra el default: en desktop el board va DETRÁS
		// (−4) y Kash DELANTE (0), o sea el personaje pisa el marco de la
		// grilla. Es el único bucket donde el usuario aprobó este orden.
		boardZ: -4,
		kashZ: 0,
		// botonera + iconos
		stackScale: 0.905,
		stackRight: 40,
		stackBottom: 10,
		iconScale: 0.625,
		iconX: 9,
		iconY: 16,
		// Kash
		kashH: 0.64,
		kashX: 0.089,
		kashY: 0.566,
		// HUD superior
		hudVertical: 1,
		hudX: 0.921,
		hudY: 0.36,
		hudScale: 0.9,
		hudGap: -6,
		// titulo — el JSON de /sizes del 11-09 traía titleX/titleY en 0 (el
		// título pegado a la esquina por el clamp de TopHud, o sea el dial sin
		// tocar). Se conservan los últimos valores realmente ajustados ahí, que
		// además son los que el anclaje ancho confirma (0.143 / 0.157).
		titleX: 0.133,
		titleY: 0.147,
		titleScale: 1.355,
		// contador de free spins
		fsX: 0.86,
		fsY: 0.14,
		fsScale: 0.96,
		// marco de columna de la anticipación
		antMarcoX: 0.08,
		antMarcoY: 0.16,
		antMarcoScale: 1.4,
		// (11-09) Acá vivían 7 excepciones de ÍCONO + MARCO exclusivas de desktop.
		// Se fueron a SYMBOL_GEOM_APPROVED: el usuario aprobó ESE encuadre para
		// TODAS las resoluciones, y mientras estuvieran acá desktop se las pisaba
		// al resto de los buckets. Ningún dial de símbolo debería volver a este
		// bloque salvo que un tamaño necesite una excepción real.
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 400×225 — Popout S).
	// HUD vertical, free spins y marco de columna: copiados de Popout L (mismo
	// aspect 16:9, la mitad de tamaño) — conserva su propio hudScale/hudGap.
	popout_s: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.078,
		boardX: 0.512,
		boardY: 0.498,
		// botonera + iconos
		stackScale: 0.96,
		stackRight: 45,
		stackBottom: 14,
		iconScale: 0.785,
		iconX: 22,
		iconY: 18,
		// Kash
		kashH: 0.73,
		kashX: 0.1,
		kashY: 0.568,
		// HUD superior (hudY centrado como en Popout L)
		hudVertical: 1,
		hudX: 0.906,
		hudY: 0.329,
		hudScale: 1.045,
		hudGap: -8,
		// titulo
		titleX: 0.061,
		titleY: 0.089,
		titleScale: 1.515,
		// contador de free spins (= Popout L)
		fsX: 0.837,
		fsY: 0.118,
		// marco de columna (= Popout L)
		antMarcoX: 0.075,
		antMarcoY: 0.145,
		antMarcoScale: 1.355,
	},
	// Aprobado por el usuario en /sizes (10-09, viewport 800×450 — Popout L).
	// Bucket MODELO de Popout S.
	popout_l: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.126,
		boardX: 0.506,
		boardY: 0.5,
		// botonera + iconos
		stackScale: 0.94,
		stackRight: 44,
		stackBottom: 4,
		iconScale: 0.655,
		iconX: 22,
		iconY: 18,
		// Kash
		kashH: 0.702,
		kashX: 0.079,
		kashY: 0.581,
		// HUD superior
		hudVertical: 1,
		hudX: 0.912,
		hudY: 0.329,
		hudScale: 1.09,
		hudGap: 8,
		// titulo
		titleX: 0.088,
		titleY: 0.123,
		titleScale: 1.455,
		// contador de free spins
		fsX: 0.837,
		fsY: 0.118,
		// marco de columna de la anticipación
		antMarcoX: 0.075,
		antMarcoY: 0.145,
		antMarcoScale: 1.355,
	},
	// Aprobado por el usuario en /sizes (10-09, viewport 1024×576 — Laptop).
	laptop: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.028,
		boardX: 0.516,
		boardY: 0.509,
		// botonera + iconos
		stackScale: 0.88,
		stackRight: 41,
		stackBottom: 6,
		iconScale: 0.755,
		iconX: 22,
		iconY: 18,
		// Kash
		kashH: 0.708,
		kashX: 0.093,
		kashY: 0.577,
		// HUD superior
		hudVertical: 1,
		hudX: 0.926,
		hudY: 0.386,
		hudScale: 1,
		hudGap: 6,
		// titulo
		titleX: 0.115,
		titleY: 0.134,
		titleScale: 1.5,
		// contador de free spins
		fsX: 0.856,
		fsY: 0.211,
		fsScale: 1.01,
		// marco de columna de la anticipación
		antMarcoX: 0.055,
		antMarcoY: 0.17,
		antMarcoScale: 1.385,
	},
};

// ── ANCLAJE ANCHO — segundo juego de valores por bucket ───────────────
// El bucket `desktop` arranca en 1100 px de ancho y no termina nunca: cubre el
// preset del ACP (1200×675), la ventana real del usuario (1912×956) y un 4K.
// Con UN solo juego de valores + la escala del HUD topeada en 1 eso no cierra:
// el board crece con el viewport y el HUD no, así que el usuario terminó
// manteniendo a mano DOS configuraciones incompatibles del mismo bucket.
//
// Ahora las dos conviven: PER_BUCKET_SEED es el anclaje BASE (A, 1200×675) y
// esto es el anclaje ANCHO (B, 1912×956). `applyLayout` interpola entre ambos
// según el viewport, así que 1200×675 sale EXACTO como se aprobó en /sizes,
// 1912×956 EXACTO como el usuario lo dejó en su ventana, y los tamaños del
// medio caen en la curva — sin que nadie tenga que re-tunear nada.
//
// Acá van SOLO las claves que cambian contra el anclaje base; lo que no esté
// listado se hereda de A y queda igual en toda la banda. Más allá de B el lerp
// se satura y el crecimiento lo toma `uiScaleFor` de forma proporcional, o sea
// que en 2560×1440 se ve el encuadre de B, a escala.
const WIDE_SEED: Partial<Record<ResBucketKey, Partial<Tweak>>> = {
	// Aprobado por el usuario en su ventana (11-09, viewport 1912×956 — aspect
	// 2.00). board*/kashY/stackBottom/iconX/iconY/hudGap/antMarco* coinciden con
	// el anclaje base, por eso no se repiten.
	desktop: {
		// botonera + iconos — lo que más sufría el tope de escala
		stackScale: 1.5,
		stackRight: 67,
		iconScale: 1.175,
		// Kash — estas tres interpolan por ASPECTO, no por tamaño: lo que cambia
		// es el aire lateral (16:9 → 2.00), no cuántos px mide la pantalla.
		kashH: 0.712,
		kashX: 0.108,
		// HUD superior
		hudX: 0.9,
		hudY: 0.314,
		hudScale: 1.715,
		// titulo
		titleX: 0.143,
		titleY: 0.157,
		titleScale: 2.2,
		// contador de free spins
		fsX: 0.829,
		fsY: 0.114,
		fsScale: 1.76,
	},
};

// Solo estas claves se editan/persisten por bucket — el resto está congelado.
const TWEAKABLE_KEYS = [
	'boardH',
	'boardX',
	'boardY',
	'kashH',
	'kashX',
	'kashY',
	'stackScale',
	'stackRight',
	'stackBottom',
	'iconScale',
	'iconX',
	'iconY',
	'freeScale',
	'hudX',
	'hudY',
	'hudScale',
	'hudGap',
	'hudVertical',
	'titleX',
	'titleY',
	'titleScale',
	'specialScale',
	'boardAlpha',
	'boardZ',
	'kashAlpha',
	'kashZ',
	'hudAlpha',
	'hudZ',
	'titleAlpha',
	'titleZ',
	'stackAlpha',
	'stackZ',
	'iconAlpha',
	'iconZ',
	'fsX',
	'fsY',
	'fsScale',
	'fsAlpha',
	'fsZ',
	// Marco de columna de la anticipación: SÍ va por bucket. Es lo único de la
	// anticipación que se mide contra el board (alto) y contra la celda (X/Y),
	// y cada tamaño del ACP terminó necesitando su propio encuadre — sin estas
	// tres claves acá el UI LAB movía el marco pero no lo guardaba.
	'antMarcoX',
	'antMarcoY',
	'antMarcoScale',
	// …más las 96 de geometría por símbolo, que se agregan abajo.
] as const;

/**
 * Claves editables/persistidas por bucket. Las de símbolo se concatenan en vez
 * de listarse a mano: son 96 y salen del mismo generador que los sliders, así
 * que agregar un símbolo a `LAB_SYMBOLS` alcanza para que aparezca en el panel
 * Y se guarde, sin tocar este archivo.
 */
const ALL_TWEAKABLE_KEYS: readonly (keyof Tweak)[] = [
	...TWEAKABLE_KEYS,
	...SYMBOL_GEOM_KEYS,
];

type Overrides = Partial<Record<ResBucketKey, Partial<Tweak>>>;

/**
 * Anclaje sobre el que se edita/persiste. `base` es el preset del ACP
 * (1200×675) y `wide` la banda ancha (1912×956). Cada uno tiene su propio
 * mapa de overrides en localStorage, bajo la MISMA clave.
 */
export type AnchorKey = 'base' | 'wide';

const readOverrides = (raw: unknown): Overrides => {
	const out: Overrides = {};
	for (const bucket of RES_BUCKETS) {
		const src = (raw as Record<string, Record<string, unknown>> | undefined)?.[bucket.key];
		if (!src) continue;
		const dst: Partial<Tweak> = {};
		for (const k of ALL_TWEAKABLE_KEYS) {
			if (typeof src[k] === 'number') dst[k] = src[k] as never;
		}
		out[bucket.key] = dst;
	}
	return out;
};

// Formato persistido: { v, overrides: {… anclaje base}, wideOverrides: {… ancho} }.
//
// MIGRACIÓN v1 → v2: el formato viejo guardaba UN solo override por bucket, y
// en `desktop` eso era justamente el problema — según dónde se hubiera tocado
// el LAB por última vez, ahí quedaba o el encuadre de 1200×675 o el de la
// ventana ancha, pisando al otro. Los dos están ahora en los seeds (anclajes A
// y B), así que al leer un payload v1 se DESCARTA su override de `desktop`; el
// de los otros 6 buckets se conserva tal cual, porque ahí no hay conflicto.
const STORAGE_VERSION = 2;

const loadOverrides = (): Record<AnchorKey, Overrides> => {
	if (typeof localStorage === 'undefined') return { base: {}, wide: {} };
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		const base = readOverrides(parsed?.overrides);
		if (parsed?.v !== STORAGE_VERSION) delete base.desktop;
		return { base, wide: readOverrides(parsed?.wideOverrides) };
	} catch {
		return { base: {}, wide: {} };
	}
};

const overrides = loadOverrides();

// ── Mezcla entre anclajes ─────────────────────────────────────
// Tres clases de clave, porque no todas dependen de lo mismo:
//
//   ASPECT_BLEND_KEYS → mezclan por ASPECTO. Es el grupo de Kash: lo que hace
//     que el personaje pueda ser más alto y correrse no es que la pantalla
//     tenga más px, sino que tenga más AIRE LATERAL. Los 7 presets del ACP
//     son 16:9 → mezcla 0, o sea que ninguno se mueve; la ventana del usuario
//     es 2.00 → mezcla 1. Extrapola hasta ~21:9 y ahí se corta.
//
//   DISCRETE_KEYS → NO se mezclan. Son capas (z), opacidades, los dos toggles
//     y todo lo que se mide en CELDAS o como multiplicador relativo (los 96
//     diales de símbolo, `specialScale`): ya son independientes de la
//     resolución, y un z-index en 1.37 no significa nada. Toman el anclaje
//     más cercano.
//
//   el resto → mezcla por TAMAÑO. Todo lo medido en px de diseño (escalas y
//     separaciones del stack/íconos/HUD/título/contador FS) y las posiciones
//     que se corren junto con ellos (hudY, fsY…).
const ASPECT_BLEND_KEYS = new Set<keyof Tweak>(['kashH', 'kashX', 'kashY']);

const DISCRETE_KEYS = new Set<keyof Tweak>([
	'freeScale',
	'hudVertical',
	'specialScale',
	'boardAlpha',
	'boardZ',
	'kashAlpha',
	'kashZ',
	'hudAlpha',
	'hudZ',
	'titleAlpha',
	'titleZ',
	'stackAlpha',
	'stackZ',
	'iconAlpha',
	'iconZ',
	...SYMBOL_GEOM_KEYS,
]);

/** Valores completos de un anclaje: DEFAULTS → seed → override del usuario. */
const anchorValues = (bucket: ResBucketKey, anchor: AnchorKey): Tweak =>
	anchor === 'base'
		? { ...DEFAULTS, ...(PER_BUCKET_SEED[bucket] ?? {}), ...(overrides.base[bucket] ?? {}) }
		: {
				...anchorValues(bucket, 'base'),
				...(WIDE_SEED[bucket] ?? {}),
				...(overrides.wide[bucket] ?? {}),
			};

/** ¿Este bucket tiene realmente un segundo anclaje que mezclar? */
const hasWideAnchor = (bucket: ResBucketKey) =>
	WIDE_SEED[bucket] !== undefined || overrides.wide[bucket] !== undefined;

const blendAnchors = (bucket: ResBucketKey, tSize: number, tAspect: number): Tweak => {
	const base = anchorValues(bucket, 'base');
	if (!hasWideAnchor(bucket)) return base;
	const wide = anchorValues(bucket, 'wide');
	const out = { ...base };
	for (const k of ALL_TWEAKABLE_KEYS) {
		if (DISCRETE_KEYS.has(k)) {
			out[k] = tSize >= 0.5 ? wide[k] : base[k];
			continue;
		}
		const t = ASPECT_BLEND_KEYS.has(k) ? tAspect : tSize;
		out[k] = base[k] + (wide[k] - base[k]) * t;
	}
	return out;
};

export const stateTweak = $state<Tweak>({ ...DEFAULTS });

// Bucket activo (reactivo — el UI LAB lo muestra) + viewport para el label.
// `anchor` es el anclaje que van a tocar SAVE/RESET, y `blend` cuánto pesa el
// anclaje ancho ahora mismo (0 = el preset del ACP, 1 = la banda ancha). El
// panel los muestra para que quede claro sobre cuál de los dos se está
// ajustando cuando el viewport cae en el medio.
export const labState = $state({
	bucket: 'desktop' as ResBucketKey,
	vw: 0,
	vh: 0,
	anchor: 'base' as AnchorKey,
	blend: 0,
});

// El stack (BottomBar/hudLayout) lee stateUiTweak.stackScale/Right/Bottom —
// mantener en sync. Exportado para que el UI LAB sincronice EN VIVO durante
// el drag (la persistencia a localStorage va aparte, al soltar el slider).
export const syncUi = () => {
	stateUiTweak.stackScale = stateTweak.stackScale;
	stateUiTweak.stackRight = stateTweak.stackRight;
	stateUiTweak.stackBottom = stateTweak.stackBottom;
	stateUiTweak.iconScale = stateTweak.iconScale;
	stateUiTweak.iconX = stateTweak.iconX;
	stateUiTweak.iconY = stateTweak.iconY;
	// Opacidad + capa de los dos elementos HTML. Van por el mismo puente que el
	// resto de lo que dibuja BottomBar (que lee `stateUiTweak`, no `stateTweak`)
	// para no darle al componente una segunda fuente de verdad.
	stateUiTweak.stackAlpha = stateTweak.stackAlpha;
	stateUiTweak.stackZ = stateTweak.stackZ;
	stateUiTweak.iconAlpha = stateTweak.iconAlpha;
	stateUiTweak.iconZ = stateTweak.iconZ;
};

/**
 * Aplica el layout que corresponde a un viewport: elige el bucket y mezcla sus
 * dos anclajes. Reemplaza al viejo `applyBucket`, que solo corría al CAMBIAR
 * de bucket — ahora tiene que correr en cada resize, porque dentro del bucket
 * `desktop` los valores varían de forma continua con el viewport.
 */
export const applyLayout = (w: number, h: number) => {
	const bucket = bucketFor(w, h);
	const tSize = sizeBlend(w, h);
	labState.bucket = bucket;
	labState.vw = w;
	labState.vh = h;
	labState.blend = hasWideAnchor(bucket) ? tSize : 0;
	labState.anchor = labState.blend >= 0.5 ? 'wide' : 'base';
	Object.assign(stateTweak, blendAnchors(bucket, tSize, aspectBlend(w, h)));
	syncUi();
};

/** Re-aplica el layout del viewport actual (tras un save/reset). */
const reapply = () => {
	if (typeof window === 'undefined') return;
	applyLayout(window.innerWidth, window.innerHeight);
};

const persist = () => {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(
		KEY,
		JSON.stringify({
			v: STORAGE_VERSION,
			overrides: overrides.base,
			wideOverrides: overrides.wide,
		}),
	);
};

// Guardar los valores ACTUALES como override del bucket + anclaje activos.
// El anclaje sale de `labState.anchor`: tuneando en el preset Desktop de
// /sizes se escribe el anclaje base, y tuneando en una ventana ancha, el
// ancho. En un viewport intermedio gana el más cercano — el panel muestra
// cuál es, y lo natural sigue siendo ajustar parado en uno de los dos.
export const saveTweak = () => {
	syncUi();
	const snap = $state.snapshot(stateTweak);
	overrides[labState.anchor][labState.bucket] = Object.fromEntries(
		ALL_TWEAKABLE_KEYS.map((k) => [k, snap[k]]),
	) as Partial<Tweak>;
	persist();
	reapply();
};

// Reset del bucket + anclaje ACTIVOS a sus seeds (borra ese override).
export const resetTweak = () => {
	delete overrides[labState.anchor][labState.bucket];
	persist();
	reapply();
};

// Aplicar el layout que corresponde al viewport, ahora y en cada resize. Ya no
// alcanza con reaccionar al CAMBIO de bucket: dentro de `desktop` la mezcla
// entre anclajes varía de forma continua, así que cada resize recalcula.
if (typeof window !== 'undefined') {
	const onResize = () => applyLayout(window.innerWidth, window.innerHeight);
	onResize();
	window.addEventListener('resize', onResize);
	// Hooks DEV: QA (Playwright) + la página /sizes, que corre el juego en un
	// iframe same-origin y maneja ESTOS objetos desde el panel del padre
	// (así el lab no tapa el juego). Mutar el $state proxy desde el padre
	// dispara la reactividad normal del iframe.
	if (import.meta.env.DEV) {
		const g = globalThis as Record<string, unknown>;
		g.__labBucket = () => labState.bucket;
		g.__stateTweak = stateTweak;
		g.__labState = labState;
		g.__saveTweak = saveTweak;
		g.__resetTweak = resetTweak;
		g.__syncUi = syncUi;
	}
}

// Preview del METER LAB: fuerza el Smash Meter visible fuera de free spins
// (con un multiplicador de muestra) para poder posicionarlo sin comprar un
// bonus. Solo dev — no se persiste.
// Claves vivas (drop 09-09) — las consume SymbolSprite.svelte y las alterna el
// AnimLab (tecla `A`, categoría "MARCO + LUZ"):
//   · marco → fuerza el clip `Marco_Icono` detrás de TODOS los símbolos.
//   · luz   → fuerza el `_luz` de W / S / CASH STACK sin tener que ganar.
// Sirven para revisar encuadre y jerarquía sin depender de que caiga un
// cluster; no se persisten y solo existen en DEV.
export const labPreview = $state({
	marco: false,
	luz: false,
	marcoColumna: false,
} as Record<string, boolean>);
if (import.meta.env.DEV && typeof window !== 'undefined') {
	(globalThis as Record<string, unknown>).__labPreview = labPreview;
}
