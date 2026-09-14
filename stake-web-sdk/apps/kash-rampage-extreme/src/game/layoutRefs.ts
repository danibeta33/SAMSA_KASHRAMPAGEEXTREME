// Anclajes de resolución del layout — módulo SIN dependencias a propósito.
//
// Lo importan `hudLayout.ts` (escala del HUD) y `stateTweak.svelte.ts` (lerp
// de los valores por anclaje). Vive aparte para que no haya ciclo entre esos
// dos: hudLayout ya importa stateTweak.
//
// ── Por qué hay DOS anclajes ─────────────────────────────────────────────
// El bucket `desktop` cubre de 1100 px de ancho para arriba, o sea desde el
// preset Desktop del ACP (1200×675) hasta un monitor 4K. Hasta el 11-09 tenía
// UN solo juego de valores y la escala del HUD estaba topeada en 1, así que
// arriba de 1200×675 el board crecía y el HUD no. El usuario terminó con dos
// configuraciones incompatibles del mismo bucket: la aprobada en /sizes y la
// que ajustó a mano en su ventana. Ahora las dos conviven como ANCLAJES y el
// layout interpola entre ellas según el viewport.
//
//   A (base) = 1200×675 — preset Desktop del ACP        → ratio 1
//   B (wide) = 1912×956 — ventana del usuario           → ratio 956/675

export const isPortraitViewport = (w: number, h: number) => h > w;

export const LANDSCAPE_REF_W = 1200;
export const LANDSCAPE_REF_H = 675;
export const PORTRAIT_REF_W = 425;
export const PORTRAIT_REF_H = 812;

/** Viewport del anclaje ANCHO (la ventana donde se aprobó el segundo encuadre). */
export const WIDE_REF_W = 1912;
export const WIDE_REF_H = 956;

/** Ratio del viewport contra el anclaje de diseño (1 = 1200×675). */
export const viewportRatio = (w: number, h: number) =>
	Math.min(w / LANDSCAPE_REF_W, h / LANDSCAPE_REF_H);

/** Ratio del anclaje ancho. Con 1912×956 manda el alto: 956/675 ≈ 1.4163. */
export const WIDE_RATIO = viewportRatio(WIDE_REF_W, WIDE_REF_H);

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Mezcla por TAMAÑO (0 = anclaje A, 1 = anclaje B). Manda todo lo medido en px
 * de diseño —escalas y separaciones del stack/íconos/HUD/título/contador FS— y
 * las posiciones que se mueven CON ellos (hudY, fsY…). Se satura en 1: más
 * allá del anclaje ancho el crecimiento lo toma `uiScaleFor`, proporcional.
 */
export const sizeBlend = (w: number, h: number) =>
	WIDE_RATIO > 1 ? clamp((viewportRatio(w, h) - 1) / (WIDE_RATIO - 1), 0, 1) : 0;

/**
 * Mezcla por ASPECTO (0 = 16:9, 1 = 2.00). Manda lo que depende del AIRE
 * LATERAL y no del tamaño: el grupo de Kash. Los 7 presets del ACP son todos
 * 16:9 → 0, así que ninguno se mueve; la ventana 1912×956 del usuario es 2.00
 * → 1. Se deja extrapolar hasta 1.6 (≈21:9) para que en monitores ultra anchos
 * Kash siga aprovechando el aire extra, y ahí se corta.
 */
export const ASPECT_REF = LANDSCAPE_REF_W / LANDSCAPE_REF_H; // 16:9
export const ASPECT_WIDE = WIDE_REF_W / WIDE_REF_H; // 2.00
export const ASPECT_BLEND_MAX = 1.6;

export const aspectBlend = (w: number, h: number) =>
	clamp((w / h - ASPECT_REF) / (ASPECT_WIDE - ASPECT_REF), 0, ASPECT_BLEND_MAX);
