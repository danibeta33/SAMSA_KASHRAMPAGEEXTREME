import type { RawSymbol, SymbolState } from './types';

export const SYMBOL_SIZE = 80;

export const REEL_PADDING = 0.53;

// initial board (padded top and bottom)
export const INITIAL_BOARD: RawSymbol[][] = [
	[
		{ name: 'L1' },
		{ name: 'H1' },
		{ name: 'L2' },
		{ name: 'L3' },
		{ name: 'M1' },
		{ name: 'L4' },
		{ name: 'L2' },
	],
	[
		{ name: 'L2' },
		{ name: 'L3' },
		{ name: 'H2' },
		{ name: 'L1' },
		{ name: 'L4' },
		{ name: 'M2' },
		{ name: 'L3' },
	],
	[
		{ name: 'L4' },
		{ name: 'M1' },
		{ name: 'L1' },
		{ name: 'H3' },
		{ name: 'L2' },
		{ name: 'L3' },
		{ name: 'L4' },
	],
	[
		{ name: 'L3' },
		{ name: 'L2' },
		{ name: 'L4' },
		{ name: 'M2' },
		{ name: 'H4' },
		{ name: 'L1' },
		{ name: 'L2' },
	],
	[
		{ name: 'L1' },
		{ name: 'L4' },
		{ name: 'M1' },
		{ name: 'L3' },
		{ name: 'L2' },
		{ name: 'H1' },
		{ name: 'L3' },
	],
	[
		{ name: 'L2' },
		{ name: 'L3' },
		{ name: 'L1' },
		{ name: 'M2' },
		{ name: 'L4' },
		{ name: 'L3' },
		{ name: 'H2' },
	],
];

export const BOARD_DIMENSIONS = { x: INITIAL_BOARD.length, y: INITIAL_BOARD[0].length - 2 };

export const BOARD_SIZES = {
	width: SYMBOL_SIZE * BOARD_DIMENSIONS.x,
	height: SYMBOL_SIZE * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 2039 / 1000;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;
const PORTRAIT_RATIO = 800 / 1422;
const LANDSCAPE_RATIO = 1600 / 900;
const DESKTOP_RATIO = 1422 / 800;

const DESKTOP_HEIGHT = 800;
const LANDSCAPE_HEIGHT = 900;
const PORTRAIT_HEIGHT = 1422;
export const DESKTOP_MAIN_SIZES = { width: DESKTOP_HEIGHT * DESKTOP_RATIO, height: DESKTOP_HEIGHT };
export const LANDSCAPE_MAIN_SIZES = {
	width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO,
	height: LANDSCAPE_HEIGHT,
};
export const PORTRAIT_MAIN_SIZES = {
	width: PORTRAIT_HEIGHT * PORTRAIT_RATIO,
	height: PORTRAIT_HEIGHT,
};

export const HIGH_SYMBOLS = ['H1', 'H2', 'H3', 'H4'];
export const MEDIUM_SYMBOLS = ['M1', 'M2'];

export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

// ── Spin: SCROLL CONTINUO estilo Dead Heat (port 25-08) ─────────────────────
// Se reemplazó createReelForCascading (fall-out/fall-in por símbolo, con la
// emulación lockstep que no convenció) por createReelForSpinning: la columna
// es una TIRA continua (board nuevo + padding del strip + board viejo) que se
// desliza hacia abajo, aterriza PASADA de largo (reelBounceSizeMulti) y vuelve
// como unidad con sineOut — el "rebotesito" certificado de dead-heat, que
// también es cluster_tumble_base (los tumbles no dependen de este engine).
// El padding que pasa por el medio sale de los strips REALES de la math
// (paddingReels.ts) usando el paddingPositions del book.
const SPIN_OPTIONS_SHARED = {
	// Rebote al asentar: tamaño en alturas de símbolo y velocidad de vuelta.
	reelBounceBackSpeed: 0.15,
	// Velocidad del último tramo antes del rebote (px/ms) — más lento que el
	// crucero para que la parada se lea.
	reelSpinSpeedBeforeBounce: 4,
	// Largo del stream de padding entre el board viejo y el nuevo, en largos
	// de reel. 1.2 es el valor probado de dead-heat/lines; el engine además
	// lo ACUMULA por reel (el N arrastra el de los anteriores → la ola).
	reelPaddingMultiplierNormal: 1.2,
	// = normal (decisión DH 05-08): sin visual de anticipación, el spin lento
	// dramático solo confundía. Subir a ~10 si dirección revive la expectativa.
	reelPaddingMultiplierAnticipated: 1.2,
	// La ola columna-a-columna del arranque (mismo pacing 145 certificado).
	reelSpinDelay: 145,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	// Anticipación estilo Zeus (DH 04-08): el primer slide del pre-spin usa
	// easing backIn — la columna SUBE un poco antes de largar. A 1.1 px/ms el
	// gesto dura ~330ms y se lee.
	reelPreSpinSpeed: 1.1,
	reelSpinSpeed: 3,
	// Rebote al aterrizar (la ref lo pide "rebotesito"): 0.35 celda.
	reelBounceSizeMulti: 0.35,
};

export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 5,
	reelSpinSpeed: 5,
	reelBounceSizeMulti: 0.05,
};

export const MOTION_BLUR_VELOCITY = 31;

// Feedback N1 #3: respiro entre free spins consecutivos del bonus (el base
// game respira solo por el ciclo bet→resultado). No aplica al PRIMER reveal
// tras la intro (ya hubo transición + intro). Turbo lo recorta.
export const FREEGAME_SPIN_PAUSE_MS = 650;
export const FREEGAME_SPIN_PAUSE_TURBO_MS = 250;

export const zIndexes = {
	background: {
		backdrop: -3,
		normal: -2,
		feature: -1,
	},
};

// ─── SYMBOL_INFO_MAP — WIREFRAME ───────────────────────────────────────────
// Every symbol points at `assetKey: 'wireframe'`; SymbolSprite.svelte detects
// that key and renders a Rectangle + Text instead of a real Sprite. Replace
// each call to `mk(...)` with real `type: 'sprite' | 'spine'` entries as soon
// as art is available.
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │  ⚠  CRITICAL — DO NOT IGNORE WHEN ADDING REAL ASSETS  ⚠              │
// │                                                                      │
// │  The `explosion` state MUST use `type: 'spine'` (with a real Spine   │
// │  asset and a `complete` event) once you ship real sprites.           │
// │                                                                      │
// │  TumbleBoard.svelte does:                                            │
// │      tumbleSymbol.symbolState = 'explosion';                         │
// │      await waitForResolve(r => tumbleSymbol.oncomplete = r);         │
// │                                                                      │
// │  Sprite path fires oncomplete from a $effect on state change. The    │
// │  assignment happens *after* the mutation, so a synchronous sprite    │
// │  callback resolves the previous (stale) resolver — TumbleBoard then  │
// │  hangs forever waiting for the new one. Even the 150 ms delay in    │
// │  SymbolSprite.svelte is a band-aid — Spine + `listener.complete` is │
// │  the correct fix because the Spine animation drives the callback   │
// │  itself.                                                             │
// │                                                                      │
// │  Pattern (re-enable when Spine arrives):                             │
// │    const explosionSpine = {                                          │
// │      type: 'spine' as const,                                         │
// │      assetKey: 'explosion',                                          │
// │      animationName: 'explosion',                                     │
// │      sizeRatios: { width: 1, height: 1 },                            │
// │    };                                                                │
// │    const mk = (key) => ({ ..., explosion: explosionSpine });         │
// └──────────────────────────────────────────────────────────────────────┘
const WIREFRAME_RATIO = { width: 0.92, height: 0.92 };
const wireframeSprite = (sizeRatios = WIREFRAME_RATIO) => ({
	type: 'sprite' as const,
	assetKey: 'wireframe',
	sizeRatios,
});

// const explosionSpine = {
// 	type: 'spine' as const,
// 	assetKey: 'explosion',
// 	animationName: 'explosion',
// 	sizeRatios: { width: 1, height: 1 },
// };

// IMPORTANT: each state gets a FRESH object so SymbolSprite's `$effect` (which
// tracks the `symbolInfo` reference) re-runs on state transitions. Sharing one
// object across all states would freeze the win/explosion flow because the
// effect wouldn't detect the change.
const mk = (sizeRatios = WIREFRAME_RATIO) => ({
	static: wireframeSprite(sizeRatios),
	spin: wireframeSprite(sizeRatios),
	land: wireframeSprite(sizeRatios),
	win: wireframeSprite(sizeRatios),
	postWinStatic: wireframeSprite(sizeRatios),
	// ⚠ WIREFRAME ONLY — swap to `explosion: explosionSpine` (uncomment above)
	//   when you add real Spine assets. Sprite explosion + tumble = round hangs
	//   on every win (see comment block above).
	explosion: wireframeSprite(sizeRatios),
});

// Sprites shipped from Figma (Iconos + Iconos Especiales). All 12 symbols are
// 512×512 PNG with transparency, centered on transparent canvas. `win` and
// `explosion` states reuse the static sprite for now — animation goes to Spine
// once the Spine atlas arrives (see the explosion warning above). Reusing the
// SAME sprite object across states is safe here because SymbolSprite renders
// the same texture and the 150 ms `setTimeout` in that component drives the
// oncomplete callback independently of state identity.
const spriteState = (key: string, sizeRatios: { width: number; height: number }) => ({
	type: 'sprite' as const,
	assetKey: key,
	sizeRatios,
});
const mkSprite = (key: string, sizeRatios = { width: 0.8, height: 0.8 }) => {
	// Fresh objects per state so SymbolSprite's $effect (which tracks the
	// symbolInfo reference) re-runs on state transitions.
	const s = () => spriteState(key, sizeRatios);
	return {
		static: s(),
		spin: s(),
		land: s(),
		win: s(),
		postWinStatic: s(),
		// Sprite path for explosion (no wireframe flash on wins). The 150 ms
		// setTimeout in SymbolSprite drives the oncomplete callback, so tumble
		// resolves fine — this stays a temporary shim until the Spine atlas
		// ships and we can drop it into `explosion` with a real `complete`
		// event (see the warning block above).
		explosion: s(),
	};
};

// Cada estado puede ser sprite o Spine — hoy todo es sprite, pero el tipo
// une ambos para que los checks `symbolInfo.type === 'spine'` de los
// componentes (ReelSymbol/TumbleSymbol/Symbol) tipen bien y el drop-in del
// atlas Spine no requiera tocarlos.
export type SymbolStateInfo =
	| { type: 'sprite'; assetKey: string; sizeRatios: { width: number; height: number } }
	| {
			type: 'spine';
			assetKey: string;
			animationName: string;
			sizeRatios: { width: number; height: number };
	  };

// Must mirror the symbols emitted by stake-math-sdk/games/kash_rampage_extreme.
// Math reels: H1-H4, M1-M2, L1-L4, W, S. Add/remove here when you tune the math.
export const SYMBOL_INFO_MAP: Record<
	'H1' | 'H2' | 'H3' | 'H4' | 'M1' | 'M2' | 'L1' | 'L2' | 'L3' | 'L4' | 'W' | 'S',
	Record<SymbolState, SymbolStateInfo>
> = {
	H1: mkSprite('sym_h1'),
	H2: mkSprite('sym_h2'),
	H3: mkSprite('sym_h3'),
	H4: mkSprite('sym_h4'),
	M1: mkSprite('sym_m1'),
	M2: mkSprite('sym_m2'),
	L1: mkSprite('sym_l1'),
	L2: mkSprite('sym_l2'),
	L3: mkSprite('sym_l3'),
	L4: mkSprite('sym_l4'),
	W: mkSprite('sym_w', { width: 0.9, height: 0.9 }),
	S: mkSprite('sym_s', { width: 0.95, height: 0.95 }),
};

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_stop_1',
	2: 'sfx_scatter_stop_2',
	3: 'sfx_scatter_stop_3',
	4: 'sfx_scatter_stop_4',
	5: 'sfx_scatter_stop_5',
} as const;
