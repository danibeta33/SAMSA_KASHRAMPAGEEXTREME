// Ajuste fino del SWING de Kash (solo DEV) — el AnimLab mueve estos valores en
// vivo para alinear el bateo con el idle; una vez encontrados, se hornean en
// la const SWING de Background.svelte. dx/dy en px de canvas; dscale multiplica
// el alto; ghost muestra el idle standby de referencia detrás.
export const swingAlign = $state({ dx: 0, dy: 0, dscale: 1, ghost: false });
