// Shake del board — se dispara cuando Kash baja el bate (idle bat) para que
// el tablero "sienta" el golpe. Lo setea Background.svelte (rotación de
// idles) y lo consume el wrapper del board en Game.svelte, que suma
// boardShake.x/y a su posición. Amplitud con decaimiento cuadrático.
export const boardShake = $state({ x: 0, y: 0 });

let raf = 0;

export function triggerBoardShake(intensity = 16, durationMs = 480) {
	const start = performance.now();
	cancelAnimationFrame(raf);
	const tick = () => {
		const t = (performance.now() - start) / durationMs;
		if (t >= 1) {
			boardShake.x = 0;
			boardShake.y = 0;
			return;
		}
		// decae cuadrático + oscilación random (sacudida, no vibración regular)
		const amp = intensity * (1 - t) * (1 - t);
		boardShake.x = (Math.random() * 2 - 1) * amp;
		boardShake.y = (Math.random() * 2 - 1) * amp * 0.55;
		raf = requestAnimationFrame(tick);
	};
	tick();
}

// Hook de QA/debug (solo DEV): dispara el shake a mano desde la consola
// (window.__boardShake()). Fuera del bundle de prod.
if (import.meta.env.DEV && typeof globalThis !== 'undefined') {
	(globalThis as unknown as { __boardShake?: typeof triggerBoardShake }).__boardShake =
		triggerBoardShake;
}
