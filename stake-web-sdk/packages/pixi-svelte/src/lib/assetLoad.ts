import * as SPINE_PIXI from '@esotericsoftware/spine-pixi-v8';
import type {
	RawType,
	RawAsset,
	RawSpine,
	RawSprites,
	RawSpriteSheet,
	SpineSrc,
	RawAudio,
	LoadedSprite,
	LoadedSpriteSheet,
} from './types';

/**
 * Frames de un spriteSheet EN ORDEN DE REPRODUCCIÓN, incluidos los sheets
 * MULTI-PÁGINA (TexturePacker "multipack").
 *
 * `Object.values(sheet.textures)` —lo que hacía esto antes— falla en dos
 * puntos apenas el arte deja de entrar en un solo atlas:
 *
 *  1. PÁGINAS. TexturePacker parte el clip en N .json y encadena el resto en
 *     `meta.related_multi_packs`. PixiJS los carga solo y los deja colgados en
 *     `linkedSheets`, pero `textures` sigue siendo el de la página raíz: sin
 *     unirlas, del clip solo llegan los frames que cayeron en la página 0.
 *  2. ORDEN. El packer reparte los frames por criterio de EMPAQUETADO, no por
 *     número de frame (medido sobre un export multipack de KRE: el frame 1 cayó
 *     en la página 2 y el 3 en la página 10), así que concatenar páginas
 *     devuelve el clip barajado. El único sitio donde vive la secuencia real es
 *     la lista `animations` del .json raíz, que nombra los frames en orden
 *     aunque vivan en otra página.
 *
 * Hoy todos los sheets del juego son de UNA página y caen por este mismo camino
 * sin cambiar de resultado: su lista `animations` ES el orden de sus frames
 * (verificado sobre los 15). Esto es lo que hace que un re-export partido en
 * páginas —el caso que rompió el drop del 07-09— entre sin tocar código. Si no
 * hay `animations`, o si algún nombre de la lista no resuelve a una textura, se
 * vuelve al comportamiento de siempre.
 */
const getSpriteSheetFrames = (sheet: RawSpriteSheet): LoadedSpriteSheet => {
	const pages = [sheet, ...(sheet.linkedSheets ?? [])];
	const textures: Record<string, LoadedSprite> = Object.assign(
		{},
		...pages.map((page) => page.textures),
	);
	// El primer (y en la práctica único) clip del sheet: TexturePacker exporta
	// una `animations` por secuencia y estos sheets traen exactamente una.
	const frameNames = Object.values(sheet.data?.animations ?? {})[0] as string[] | undefined;
	if (frameNames?.length) {
		const ordered = frameNames.map((name) => textures[name]).filter(Boolean);
		if (ordered.length === frameNames.length) return ordered;
		console.warn(
			`[assetLoad] "animations" del spriteSheet nombra ${frameNames.length} frames pero solo ${ordered.length} resolvieron a textura; se usa el orden de empaquetado.`,
		);
	}
	return Object.values(textures);
};

const PROCESS_METHOD_MAP = {
	spine: ({ key, rawAsset, src }: { key: string; rawAsset: RawSpine; src: SpineSrc }) => {
		const atlasAsset = rawAsset[src.atlas] as SPINE_PIXI.TextureAtlas;
		const skeletonAsset = rawAsset[src.skeleton] as Uint8Array;
		const attachmentLoader = new SPINE_PIXI.AtlasAttachmentLoader(atlasAsset);
		const parser =
			skeletonAsset instanceof Uint8Array
				? new SPINE_PIXI.SkeletonBinary(attachmentLoader)
				: new SPINE_PIXI.SkeletonJson(attachmentLoader);
		const scale = src?.scale ?? 1;
		parser.scale = scale;
		const skeletonData = parser.readSkeletonData(skeletonAsset);

		return { [key]: skeletonData };
	},
	sprite: ({ key, rawAsset }: { key: string; rawAsset: RawSprites }) => ({ [key]: rawAsset }),
	sprites: ({ rawAsset }: { rawAsset: RawSprites }) => rawAsset.textures,
	spriteSheet: ({ key, rawAsset }: { key: string; rawAsset: RawSpriteSheet }) => ({
		[key]: getSpriteSheetFrames(rawAsset),
	}),
	audio: ({ key, rawAsset }: { key: string; rawAsset: RawAudio }) => {
		return { [key]: rawAsset };
	},
} as const;

export const getProcessed = ({
	key,
	type,
	rawAsset,
	src,
}: {
	key: string;
	type: RawType;
	rawAsset: RawAsset;
	src: string | SpineSrc;
}) => {
	if (type === 'font') return; // No need to process raw font data and add it to the loaded assets.
	const processMethod = PROCESS_METHOD_MAP[type];
	if (!processMethod)
		throw Error('No asset process method found, please check the type of the asset.');
	// @ts-expect-error
	return processMethod({ key, rawAsset, src });
};
