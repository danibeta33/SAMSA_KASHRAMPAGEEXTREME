// Contador de celebraciones activas (win / FS intro / FS outro / transition).
// Mientras hay al menos una activa, el swing de Kash se manda al fondo (zIndex
// bajo) para que NUNCA quede por delante de la pantalla de celebración.
// Bug reportado: el bateo random durante max/mega win aparecía al frente.
export const celebration = $state({ n: 0 });

export const enterCelebration = () => (celebration.n += 1);
export const exitCelebration = () => (celebration.n = Math.max(0, celebration.n - 1));
