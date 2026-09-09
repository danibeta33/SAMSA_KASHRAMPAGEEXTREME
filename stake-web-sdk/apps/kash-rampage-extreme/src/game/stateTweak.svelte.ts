// Layout del board/Kash/meter — POR RESOLUCIÓN (pedido del usuario, feedback
// N1 #6): cada bucket de viewport tiene su propio juego de valores, ajustable
// a dedo desde el UI LAB (tecla T) o la página /sizes, y persistido por
// bucket en localStorage. Al cambiar el tamaño se aplica el bucket que
// corresponde (DEFAULTS + override guardado de ese bucket).
// La clave de persistencia vive en el manifiesto del juego (`labMeta.ts`) —
// es la misma que se le pasa al inspector genérico vía `storageKey`, para que
// el panel no tenga ninguna constante propia del juego.
import { LAB_STORAGE_KEY } from './labMeta';

const KEY = LAB_STORAGE_KEY; // { overrides: { [bucket]: {…claves tweakeables} } }

import { stateUiTweak } from './stateUiTweak.svelte';

type Tweak = {
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
};

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
	// 1.3 = los especiales entran 30 % más grandes que su box actual.
	specialScale: 1.3,
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
// ahora, además de board/kash/botonera, sus propios hud*/title*/specialScale
// (la rama portrait de hudLayout lee boardX/boardY tweakeables, así que el
// board vertical se posiciona desde acá y no con constantes fijas).
const PER_BUCKET_SEED: Partial<Record<ResBucketKey, Partial<Tweak>>> = {
	// Aprobado por el usuario en /sizes (08-09, viewport 425×812 — Mobile L).
	portrait_l: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.92,
		boardX: 0.485,
		boardY: 0.316,
		// botonera + iconos + especiales
		stackScale: 1.35,
		stackRight: -36,
		stackBottom: 6,
		iconScale: 0.655,
		iconX: 22,
		iconY: 118,
		specialScale: 1.3,
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
		// titulo
		titleX: 0.57,
		titleY: 0.07,
		titleScale: 0.74,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 375×667 — Mobile M).
	portrait_m: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.92,
		boardX: 0.485,
		boardY: 0.34,
		// botonera + iconos + especiales
		stackScale: 1.035,
		stackRight: -36,
		stackBottom: 14,
		iconScale: 0.625,
		iconX: 22,
		iconY: 118,
		specialScale: 1.3,
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
		// titulo
		titleX: 0.561,
		titleY: 0.07,
		titleScale: 0.74,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 320×568 — Mobile S).
	portrait_s: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.908,
		boardX: 0.482,
		boardY: 0.346,
		// botonera + iconos + especiales
		stackScale: 0.945,
		stackRight: -36,
		stackBottom: 18,
		iconScale: 0.665,
		iconX: 22,
		iconY: 118,
		specialScale: 1.3,
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
		// titulo
		titleX: 0.246,
		titleY: 0.237,
		titleScale: 0.865,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 1200×675 — Desktop).
	desktop: {
		// board + layout libre
		freeScale: 1,
		boardH: 0.974,
		boardX: 0.504,
		boardY: 0.538,
		// botonera + iconos + especiales
		stackScale: 0.88,
		stackRight: 37,
		stackBottom: 10,
		iconScale: 0.675,
		iconX: 9,
		iconY: 16,
		specialScale: 1.235,
		// Kash
		kashH: 0.702,
		kashX: 0.108,
		kashY: 0.566,
		// HUD superior
		hudVertical: 1,
		hudX: 0.909,
		hudY: 0.193,
		hudScale: 1.205,
		hudGap: -12,
		// titulo
		titleX: 0.133,
		titleY: 0.147,
		titleScale: 1.55,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 400×225 — Popout S).
	popout_s: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.078,
		boardX: 0.512,
		boardY: 0.498,
		// botonera + iconos + especiales
		stackScale: 0.96,
		stackRight: 45,
		stackBottom: 14,
		iconScale: 0.785,
		iconX: 22,
		iconY: 18,
		specialScale: 1.305,
		// Kash
		kashH: 0.73,
		kashX: 0.1,
		kashY: 0.568,
		// HUD superior
		hudVertical: 1,
		hudX: 0.906,
		hudY: 0.155,
		hudScale: 1.045,
		hudGap: -8,
		// titulo
		titleX: 0.061,
		titleY: 0.089,
		titleScale: 1.515,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 800×450 — Popout L).
	popout_l: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.126,
		boardX: 0.506,
		boardY: 0.5,
		// botonera + iconos + especiales
		stackScale: 0.94,
		stackRight: 44,
		stackBottom: 4,
		iconScale: 0.655,
		iconX: 22,
		iconY: 18,
		specialScale: 1.165,
		// Kash
		kashH: 0.702,
		kashX: 0.079,
		kashY: 0.581,
		// HUD superior
		hudVertical: 1,
		hudX: 0.912,
		hudY: 0.155,
		hudScale: 1.09,
		hudGap: 8,
		// titulo
		titleX: 0.088,
		titleY: 0.123,
		titleScale: 1.455,
	},
	// Aprobado por el usuario en /sizes (08-09, viewport 1024×576 — Laptop).
	laptop: {
		// board + layout libre
		freeScale: 1,
		boardH: 1.028,
		boardX: 0.516,
		boardY: 0.509,
		// botonera + iconos + especiales
		stackScale: 0.88,
		stackRight: 41,
		stackBottom: 6,
		iconScale: 0.755,
		iconX: 22,
		iconY: 18,
		specialScale: 1.33,
		// Kash
		kashH: 0.708,
		kashX: 0.093,
		kashY: 0.577,
		// HUD superior
		hudVertical: 1,
		hudX: 0.926,
		hudY: 0.155,
		hudScale: 1,
		hudGap: 6,
		// titulo
		titleX: 0.115,
		titleY: 0.134,
		titleScale: 1.5,
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
] as const;

type Overrides = Partial<Record<ResBucketKey, Partial<Tweak>>>;

const loadOverrides = (): Overrides => {
	if (typeof localStorage === 'undefined') return {};
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		const out: Overrides = {};
		for (const bucket of RES_BUCKETS) {
			const src = parsed?.overrides?.[bucket.key];
			if (!src) continue;
			const dst: Partial<Tweak> = {};
			for (const k of TWEAKABLE_KEYS) {
				if (typeof src[k] === 'number') dst[k] = src[k];
			}
			out[bucket.key] = dst;
		}
		return out;
	} catch {
		return {};
	}
};

const overrides: Overrides = loadOverrides();

export const stateTweak = $state<Tweak>({ ...DEFAULTS });

// Bucket activo (reactivo — el UI LAB lo muestra) + viewport para el label.
export const labState = $state({ bucket: 'desktop' as ResBucketKey, vw: 0, vh: 0 });

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
};

export const applyBucket = (bucket: ResBucketKey) => {
	labState.bucket = bucket;
	Object.assign(stateTweak, DEFAULTS, PER_BUCKET_SEED[bucket] ?? {}, overrides[bucket] ?? {});
	syncUi();
};

// Guardar los valores ACTUALES como override del bucket activo.
export const saveTweak = () => {
	syncUi();
	const snap = $state.snapshot(stateTweak);
	overrides[labState.bucket] = Object.fromEntries(
		TWEAKABLE_KEYS.map((k) => [k, snap[k]]),
	) as Partial<Tweak>;
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY, JSON.stringify({ overrides }));
};

// Reset del bucket ACTIVO a los defaults (borra su override).
export const resetTweak = () => {
	delete overrides[labState.bucket];
	applyBucket(labState.bucket);
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY, JSON.stringify({ overrides }));
};

// Aplicar el bucket que corresponde al viewport, ahora y en cada resize.
if (typeof window !== 'undefined') {
	const onResize = () => {
		labState.vw = window.innerWidth;
		labState.vh = window.innerHeight;
		const next = bucketFor(window.innerWidth, window.innerHeight);
		if (next !== labState.bucket) applyBucket(next);
	};
	labState.vw = window.innerWidth;
	labState.vh = window.innerHeight;
	applyBucket(bucketFor(window.innerWidth, window.innerHeight));
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
export const labPreview = $state({} as Record<string, boolean>); // KRE: sin previews (el meter se eliminó)
if (import.meta.env.DEV && typeof window !== 'undefined') {
	(globalThis as Record<string, unknown>).__labPreview = labPreview;
}
