<script lang="ts" module>
	// SPINNER DE CARGA — "Cargador_Bate" (asset del equipo, drop 10-09).
	//
	// Reemplaza al strip horizontal viejo (630×120 = 6 × 105×120, animado con
	// un `steps(6)` sobre background-position). El sheet nuevo lo exportó
	// TexturePacker y NO es una grilla regular: es una columna de 204×1398 con
	// los 6 frames RECORTADOS (`trimmed: true`), cada uno con su propio alto
	// (229…235 px) y su propio offset dentro del canvas original de 256×256.
	// Con frames de alto distinto un `steps()` sobre el eje Y desencuadra el
	// bate en cada paso — por eso acá cada frame es una CAPA con su recorte
	// exacto, y lo que se anima es cuál está visible.
	//
	// ⚠ CADA CAPA MIDE LO QUE MIDE SU FRAME, no los 256² del canvas. Los frames
	// están empacados con 2 px de separación en el atlas, así que una capa del
	// tamaño del canvas deja ver los VECINOS por arriba y por abajo (se veía el
	// mango del frame de al lado arriba y la llama del otro abajo — reporte del
	// 10-09). El recorte se hace con la caja del elemento: `w`/`h` del frame, y
	// el offset `ox`/`oy` lo vuelve a poner donde estaba dentro del canvas.

	/**
	 * Ruta del sheet, RELATIVA AL DOCUMENTO (igual que el resto de los assets
	 * del loading): el CSS de la app se inlinea en el index.html del build, así
	 * que el `url()` de abajo y este string resuelven al MISMO recurso — y el
	 * preload de GameLoader pega en la misma entrada de cache. Si se cambia
	 * uno, cambiar el otro.
	 */
	export const SPINNER_SRC = 'assets/loading/spinner.webp';

	/** Canvas original de cada frame (`sourceSize` del JSON). Cuadrado. */
	const SOURCE = 256;
	/** Tamaño del sheet (`meta.size` del JSON). */
	const SHEET_W = 204;
	const SHEET_H = 1398;

	type Frame = {
		/** Posición del recorte DENTRO del sheet (`frame` del JSON). */
		x: number;
		y: number;
		w: number;
		h: number;
		/** Dónde iba ese recorte en el canvas de 256² (`spriteSourceSize`). */
		ox: number;
		oy: number;
	};

	/**
	 * Los 6 frames en orden de animación, copiados 1:1 de
	 * `static/assets/loading/spinner.json` (`animations.Cargador_Bate`). Si el
	 * equipo re-exporta el sheet se regenera esta tabla desde el JSON — junto
	 * con SHEET_W/H — y no hay nada más que tocar.
	 */
	const FRAMES: Frame[] = [
		{ x: 1, y: 473, w: 202, h: 230, ox: 24, oy: 12 }, // Cargador_Bate_00000
		{ x: 1, y: 238, w: 202, h: 233, ox: 24, oy: 9 }, // Cargador_Bate_00001
		{ x: 1, y: 1, w: 202, h: 235, ox: 24, oy: 7 }, // Cargador_Bate_00002
		{ x: 1, y: 937, w: 202, h: 229, ox: 24, oy: 13 }, // Cargador_Bate_00003
		{ x: 1, y: 705, w: 202, h: 230, ox: 24, oy: 12 }, // Cargador_Bate_00004
		{ x: 1, y: 1168, w: 202, h: 229, ox: 24, oy: 13 }, // Cargador_Bate_00005
	];
</script>

<script lang="ts">
	type Props = {
		/**
		 * Ancho/alto de la CAJA del spinner (es cuadrada, 256² del canvas
		 * original). Ojo: el bate ocupa 202×~231 de esos 256, o sea ~79% del
		 * ancho — una caja de 132px dibuja un bate de ~104px, que es el tamaño
		 * que tenía el spinner viejo. Los defaults de los dos usos ya vienen
		 * compensados así.
		 */
		size?: string;
		/** Milisegundos de una vuelta completa de los 6 frames. */
		durationMs?: number;
	};

	const { size = 'clamp(72px, 15vmin, 132px)', durationMs = 660 }: Props = $props();

	// `animation-duration` y `animation-delay` van INLINE y en ms, ya
	// resueltos acá: una `var()` mal parseada adentro de esas dos propiedades
	// no da error visible, simplemente deja la animación en 0s — y el loader
	// queda clavado en un frame. Calculados en JS no hay nada que parsear.
	const step = $derived(durationMs / FRAMES.length);
</script>

<span
	class="spin"
	style="--spin-size: {size}; --src: {SOURCE}; --sheet-w: {SHEET_W}; --sheet-h: {SHEET_H};"
	aria-hidden="true"
>
	{#each FRAMES as frame, i (i)}
		<span
			class="spin__frame"
			style="
				--x: {-frame.x}; --y: {-frame.y};
				--w: {frame.w}; --h: {frame.h};
				--ox: {frame.ox}; --oy: {frame.oy};
				animation-duration: {durationMs}ms;
				animation-delay: {-i * step}ms;
			"
		></span>
	{/each}
</span>

<style>
	.spin {
		position: relative;
		display: block;
		width: var(--spin-size);
		height: var(--spin-size);
		/* Píxeles de PANTALLA por píxel del canvas original (256²) — con esto
		   el sheet, el recorte y los offsets del JSON escalan juntos. */
		--u: calc(var(--spin-size) / var(--src));
		filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.6));
	}

	.spin__frame {
		position: absolute;
		/* La caja ES el recorte: recorta el frame y de paso tapa a los vecinos
		   del atlas, que están a 2 px. */
		left: calc(var(--ox) * var(--u));
		top: calc(var(--oy) * var(--u));
		width: calc(var(--w) * var(--u));
		height: calc(var(--h) * var(--u));
		opacity: 0;
		background-image: url('assets/loading/spinner.webp');
		background-repeat: no-repeat;
		background-size: calc(var(--sheet-w) * var(--u)) calc(var(--sheet-h) * var(--u));
		background-position: calc(var(--x) * var(--u)) calc(var(--y) * var(--u));
		/* step-end: la opacidad NO interpola — un frame se apaga y el siguiente
		   se prende en el mismo instante, sin crossfade (que se vería como un
		   fantasma doble del bate). Duración y delay llegan inline. */
		animation-name: spin-frame;
		animation-timing-function: step-end;
		animation-iteration-count: infinite;
	}

	/* Delay NEGATIVO escalonado (inline): el frame `i` es el visible durante el
	   sexto `i` de cada vuelta, y ya desde t=0 — sin delay negativo los 5
	   primeros sextos de la primera vuelta saldrían en blanco. */
	@keyframes spin-frame {
		0% {
			opacity: 1;
		}
		16.6667% {
			opacity: 0;
		}
		100% {
			opacity: 0;
		}
	}

	/* SIN guarda de `prefers-reduced-motion`: esto no es decoración, es el
	   indicador de progreso de la carga. Con la guarda puesta, cualquiera con
	   los efectos de animación de Windows apagados veía el bate CONGELADO y el
	   juego parecía colgado (reporte del 10-09). La excepción de "movimiento
	   esencial" de la WCAG cubre justamente este caso. */
</style>
