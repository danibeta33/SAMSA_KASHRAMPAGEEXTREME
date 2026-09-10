// Ajuste fino del SWING de Kash (solo DEV) — el AnimLab mueve estos valores en
// vivo para alinear el bateo con el idle; una vez encontrados, se hornean en
// la const SWING de Background.svelte. dx/dy en px de canvas; dscale multiplica
// el alto (y el ancho lo sigue, es escala uniforme); dwide multiplica SOLO el
// ancho —el aspect— para des-angostar el clip sin tocar el alto ni la línea de
// pies; ghost muestra el idle standby de referencia detrás.
export const swingAlign = $state({ dx: 0, dy: 0, dscale: 1, dwide: 1, ghost: false });
