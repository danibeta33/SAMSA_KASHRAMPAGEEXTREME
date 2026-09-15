// ── MARCO DE VICTORIA (`Marco_Icono`) — constantes compartidas ───────────────
//
// Vivían en el `<script module>` de SymbolSprite.svelte. Se mudaron acá porque
// la CASCADA de victoria (`winFlash.svelte.ts`, un .ts) necesita saber cuánto
// dura la ENTRADA del marco para escalonar los símbolos: el siguiente arranca
// cuando el anterior terminó de enmarcarse (pedido de dirección 15-09). Un .ts
// importando de un .svelte para leer un número es un acople al revés, y
// duplicar el 667 a mano se desincroniza en cuanto dirección mueva un tramo.
//
// `Marco_Icono`: 21 frames (0..20). Los tramos los pidió dirección:
//   0..15  entrada, mientras el símbolo se ilumina
//   4..15  bucle de espera hasta que termina de iluminarse TODO el cluster
//   …→18   salida, desde el frame en curso, al hacer el boing de desaparición
export const MARCO_INTRO_END = 15;
export const MARCO_LOOP_START = 4;
// La salida CIERRA en el 18 y no en el 20: los dos últimos frames del export
// son el marco ya relleno (amarillo pleno y después bloque rojo), que con el
// marco por ENCIMA del ícono taparían la celda entera justo cuando el
// símbolo se está yendo. Pedido de dirección: terminar en el 18.
export const MARCO_LAST_FRAME = 18;

export const MARCO_FPS = 24;
/** pixi-svelte toma `animationSpeed` como fracción de 60 fps. */
export const MARCO_ANIM_SPEED = MARCO_FPS / 60;
/** Lado del marco en celdas, antes del dial `<id>MarcoScale` de cada símbolo. */
export const MARCO_CELL_RATIO = 1.12;

/**
 * Duración REAL de la entrada del marco: frames 0..MARCO_INTRO_END a
 * MARCO_FPS ⇒ 16/24 = 666.7 ms. Es el stagger NOMINAL de la cascada de
 * victoria — "cuando el marco terminó su entrada, empieza el siguiente".
 */
export const MARCO_INTRO_MS = ((MARCO_INTRO_END + 1) / MARCO_FPS) * 1000;
