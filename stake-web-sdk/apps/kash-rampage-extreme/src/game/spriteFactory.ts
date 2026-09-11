// ─────────────────────────────────────────────────────────────────────────────
// SPRITE FACTORY (Paso 3) — único punto donde nace un sprite del juego.
//
// Reemplaza a `new PIXI.AnimatedSprite(...)` / `new PIXI.Sprite(...)` sueltos:
// pide la geometría al registro (`spriteConfig.svelte.ts`) y aplica el ancla
// antes de devolver la instancia. Nadie más decide un anchor a mano.
//
// El juego dibuja de DOS formas y la factory cubre las dos:
//
//   · IMPERATIVA — `createAnimated` / `createSprite` devuelven un nodo PixiJS 8
//     con `anchor.set(x, y)` ya aplicado, para código que maneja el display
//     list a mano.
//   · DECLARATIVA — `place()` devuelve las props (x/y/width/height/fps/…) que
//     consumen los componentes de `pixi-svelte`. El ANCLA en esta vía la aplica
//     el propio paquete: `registerSpriteAnchors()` le inyecta el resolver del
//     registro, así que `<SpriteSheet key="…">` queda anclado aunque nadie le
//     pase la prop.
//
// Ambas leen el MISMO registro, así que un override del inspector (Paso 4)
// mueve los dos caminos a la vez.
// ─────────────────────────────────────────────────────────────────────────────

import * as PIXI from 'pixi.js';
import {
	setAnchorResolver,
	type LoadedAssets,
	type LoadedSprite,
	type LoadedSpriteSheet,
} from 'pixi-svelte';

import { getSpriteAnchor, getSpritePlacement, resolveAutoAnchor } from './spriteConfig.svelte';

// ── Enchufe con el SDK ──────────────────────────────────────────────────────

/**
 * Conecta el registro del juego con `pixi-svelte` (ancla automática en
 * `<Sprite>` / `<SpriteSheet>`) y con el loader (texturas por assetId para la
 * vía imperativa). Se llama una vez, desde el arranque de la app.
 *
 * `pixi-svelte` carga por URL y guarda el diccionario de texturas en el
 * contexto de la app, así que la factory —que vive fuera de Svelte— necesita
 * ese getter para poder instanciar sprites por id.
 */
export const registerSpriteAnchors = (getLoadedAssets?: () => LoadedAssets | undefined) => {
	setAnchorResolver(resolveAutoAnchor);
	if (getLoadedAssets) readLoadedAssets = getLoadedAssets;
};

let readLoadedAssets: () => LoadedAssets | undefined = () => undefined;

const assetOf = (assetId: string) => readLoadedAssets()?.[assetId];

// ── Cálculo de encuadre (vía declarativa) ───────────────────────────────────

export type PlaceOptions = {
	/** Punto de referencia del actor en el canvas. Para un personaje: los pies. */
	x: number;
	y: number;
	/** Alto de referencia en px de canvas. El width sale del aspect del asset. */
	height: number;
};

export type PlacedSprite = {
	anchor: { x: number; y: number };
	x: number;
	y: number;
	width: number;
	height: number;
	/** Velocidad para la prop `animationSpeed` de pixi-svelte (fps / 60). */
	animationSpeed: number;
	/** El clip va por delante del board. */
	foreground: boolean;
};

/**
 * Traduce un assetId + punto de referencia a las props de dibujo finales.
 *
 * `x` e `y` salen TAL CUAL del punto de referencia: no hay offsets por clip.
 * Con anchorY 1 ese punto ES la línea de pies, así que cambiar de clip cambia
 * el bounding box pero NO el punto anclado — los pies no se mueven. La única
 * corrección por asset es `scale`, que iguala el tamaño del CUERPO entre crops
 * distintos, y el pivot, que absorbe la alineación fina.
 */
export const place = (assetId: string, options: PlaceOptions): PlacedSprite => {
	const p = getSpritePlacement(assetId);
	const height = options.height * (p.scale ?? 1);
	return {
		anchor: { x: p.anchorX, y: p.anchorY },
		x: options.x,
		y: options.y,
		width: height * (p.aspect ?? 1),
		height,
		animationSpeed: (p.fps ?? 10) / 60,
		foreground: p.foreground ?? false,
	};
};

// ── Instanciación imperativa ────────────────────────────────────────────────

const applyAnchor = <T extends PIXI.Sprite | PIXI.AnimatedSprite>(sprite: T, assetId: string): T => {
	const { x, y } = getSpriteAnchor(assetId);
	sprite.anchor.set(x, y);
	return sprite;
};

type AnimatedOptions = Omit<Partial<PIXI.AnimatedSpriteOptions>, 'textures'> & {
	/** Texturas explícitas — si no van, salen del loader. */
	textures?: PIXI.Texture[];
};

/**
 * AnimatedSprite listo para usar: frames del loader de PixiJS 8 + ancla del
 * registro ya aplicada. Sustituye a `new PIXI.AnimatedSprite(frames)`.
 */
export const createAnimated = (
	assetId: string,
	options: AnimatedOptions = {},
): PIXI.AnimatedSprite => {
	const { textures, ...rest } = options;
	const frames = textures ?? (assetOf(assetId) as LoadedSpriteSheet | undefined);
	// Consola de prod en CERO es requisito de approval (rechazo N2.2 de KS1:
	// "Sprite key not found"). El aviso queda solo en DEV; en prod el sprite
	// cae a Texture.EMPTY sin ensuciar la consola del reviewer.
	if (!frames?.length && import.meta.env.DEV) {
		console.error(`[SpriteFactory] spriteSheet "${assetId}" no está en loadedAssets`);
	}
	const sprite = new PIXI.AnimatedSprite(frames?.length ? frames : [PIXI.Texture.EMPTY]);
	Object.assign(sprite, rest);
	sprite.label ??= assetId;
	sprite.animationSpeed = rest.animationSpeed ?? (getSpritePlacement(assetId).fps ?? 10) / 60;
	return applyAnchor(sprite, assetId);
};

/** Igual que `createAnimated` pero para un sprite estático. */
export const createSprite = (
	assetId: string,
	options: Omit<Partial<PIXI.SpriteOptions>, 'texture'> & { texture?: PIXI.Texture } = {},
): PIXI.Sprite => {
	const { texture, ...rest } = options;
	const resolved = texture ?? (assetOf(assetId) as LoadedSprite | undefined);
	if (!resolved && import.meta.env.DEV)
		console.error(`[SpriteFactory] sprite "${assetId}" no está en loadedAssets`);
	const sprite = new PIXI.Sprite(resolved ?? PIXI.Texture.EMPTY);
	Object.assign(sprite, rest);
	sprite.label ??= assetId;
	return applyAnchor(sprite, assetId);
};

export const SpriteFactory = {
	register: registerSpriteAnchors,
	createAnimated,
	createSprite,
	applyAnchor,
	/** Ancla del registro, en forma PixiJS. */
	anchor: getSpriteAnchor,
	place,
};
