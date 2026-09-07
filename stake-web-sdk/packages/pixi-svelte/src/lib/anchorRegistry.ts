// ─────────────────────────────────────────────────────────────────────────────
// RESOLVEDOR DE ANCLAS POR assetId (hook de inyección del SDK).
//
// PixiJS 8 instancia todo Sprite/AnimatedSprite con anchor (0,0): lo que queda
// clavado en (x,y) es la esquina superior izquierda del bounding box. Para un
// personaje con clips de distinto recorte eso produce un SALTO al intercambiar
// animación — el punto anclado deja de ser el mismo punto anatómico.
//
// `<Sprite>` y `<SpriteSheet>` son los únicos componentes del paquete que
// conocen el `key` (= assetId) del asset, así que son el chokepoint natural
// para aplicar un ancla por defecto derivada de ese id.
//
// Dirección de la dependencia (misma inversión que `InspectorRegistry`):
//
//   juego  ──setAnchorResolver()──▶  pixi-svelte  ──resolveAssetAnchor(key)──▶ ancla
//
// El paquete NO sabe qué es `anim_kash_swing` ni `sym_h4`: solo pregunta. Sin
// resolver registrado (todos los demás juegos del monorepo) el comportamiento
// es EXACTAMENTE el de siempre.
//
// CONTRATO, en dos reglas:
//   1. Un `anchor` explícito del consumidor SIEMPRE gana. El resolver solo
//      rellena cuando la prop viene `undefined`.
//   2. El resolver devuelve `undefined` para un id que no reconoce. Eso deja
//      intacto el default de PixiJS y evita re-anclar assets ajenos (los
//      progress bars de los loading screens, por ejemplo, sí quieren (0,0)).
// ─────────────────────────────────────────────────────────────────────────────

export type ResolvedAnchor = { x: number; y: number };

/** Devuelve el ancla por defecto de un assetId, o `undefined` si no lo conoce. */
export type AnchorResolver = (assetKey: string) => ResolvedAnchor | undefined;

let resolver: AnchorResolver | null = null;

/**
 * Registra el resolver del juego. Se llama una vez en el arranque; llamarlo de
 * nuevo reemplaza al anterior (HMR / cambio de juego hospedado).
 */
export const setAnchorResolver = (next: AnchorResolver | null) => {
	resolver = next;
};

export const clearAnchorResolver = () => {
	resolver = null;
};

export const hasAnchorResolver = () => resolver !== null;

/**
 * Ancla por defecto para `assetKey`, o `undefined` si no hay resolver o el
 * resolver no reconoce el id. `propsSyncEffect` ignora las props `undefined`,
 * así que devolver `undefined` es literalmente "no tocar nada".
 */
export const resolveAssetAnchor = (assetKey: string): ResolvedAnchor | undefined => {
	if (!resolver) return undefined;
	try {
		return resolver(assetKey);
	} catch (error) {
		console.error(`[pixi-svelte] anchor resolver falló para "${assetKey}":`, error);
		return undefined;
	}
};
