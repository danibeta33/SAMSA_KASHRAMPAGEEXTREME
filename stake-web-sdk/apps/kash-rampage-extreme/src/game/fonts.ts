import { TextStyle } from 'pixi.js';

// Brand fonts for the Pixi canvas. Pixi Text rasterises through the browser's
// font stack, so the family must be REGISTERED in document.fonts before the
// first Text renders — the @font-face rules in neue-plak.css only trigger
// lazy-loading when DOM text uses them, which the canvas never does.
//
// Once loaded we point Pixi's GLOBAL default text style at the brand family,
// so every <Text> in the app (LoadingScreen, Win, counters, HUD labels…)
// picks it up without touching each component. Components can still override
// per-style with `fontFamily`.
//
// `loadBrandFonts()` is awaited nowhere on purpose: it's fired from the layout
// on mount and resolves in a few ms (local static TTFs). Any Pixi Text that
// renders before then falls back to Arial for one frame; the LoadingScreen
// covers that window in practice.

// Single family name used across all Pixi Text styles.
export const BRAND_FONT = 'Neue Plak Extended';

const FONT_FILES: Array<{ family: string; weight: string; file: string }> = [
	{ family: BRAND_FONT, weight: '400', file: 'Neue Plak Extended Regular.ttf' },
	{ family: BRAND_FONT, weight: '900', file: 'Neue Plak Extended Black.ttf' },
	{ family: BRAND_FONT, weight: '950', file: 'Neue Plak Extended ExtraBlack.ttf' },
	{ family: 'Neue Plak Text', weight: '900', file: 'Neue Plak Text Black.ttf' },
];

let loaded = false;

export const loadBrandFonts = async () => {
	if (loaded || typeof document === 'undefined') return;
	loaded = true;
	await Promise.all(
		FONT_FILES.map(async ({ family, weight, file }) => {
			try {
				const face = new FontFace(
					family,
					`url("assets/fonts/neue-plak/${encodeURIComponent(file)}")`,
					{ weight },
				);
				await face.load();
				document.fonts.add(face);
			} catch (e) {
				if (import.meta.env.DEV) console.debug(`[fonts] failed to load ${file}:`, e);
			}
		}),
	);
	// Pixi renders Text lazily per-instance, so mutating the default AFTER the
	// faces are registered means any Text created from here on uses the brand
	// font. Fallback chain keeps Arial for glyphs Neue Plak lacks.
	TextStyle.defaultTextStyle.fontFamily = [BRAND_FONT, 'Arial', 'sans-serif'];
};
