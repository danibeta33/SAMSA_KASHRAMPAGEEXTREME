<script lang="ts">
	// PANTALLA DE CARGA / INTRO — overlay HTML a pantalla completa.
	//
	// Composición (drop 14-09, pedido del usuario): un ÚNICO fondo a pantalla
	// completa (el panel interior del vault, `bg_inner`), el TÍTULO arriba, la
	// ventana animada del INTRO en el medio, y abajo el bate girando con el
	// texto. Mientras los assets bajan dice LOADING; con todo listo pasa a
	// CLICK TO SKIP y el click entra al juego.
	//
	// Hasta el 16-09 el fondo eran DOS capas: `bg_outer` cubriendo el viewport
	// y `bg_inner` como panel recortado y centrado encima. El panel se eliminó
	// (pedido del usuario) y `bg_inner` pasó a ser el único fondo, a `cover`.
	//
	// Esta pantalla es AHORA la única del arranque: `GameLoader.svelte` (el
	// rectángulo negro con solo el bate) se eliminó. Era redundante —
	// `+layout.svelte` monta este overlay en el primer render, antes que
	// `Authenticate`, y `stateApp.loaded` arranca en false, así que este
	// componente ya cubría desde el frame 1 con el mismo spinner y el mismo
	// LOADING, pero además con el fondo, el título y el intro.
	//
	// Los 4 elementos se encuadran desde el UI LAB (tecla T → PANTALLA DE
	// CARGA), por bucket de resolución: X/Y son fracciones del VIEWPORT y
	// `Scale` multiplica el tamaño base que les da el CSS. Para poder tunear
	// hace falta que la pantalla esté visible — ANIM LAB (tecla A) → PANTALLA
	// DE CARGA la vuelve a abrir y tiene el candado que evita que el click la
	// cierre.
	import { onMount } from 'svelte';
	import { getContextApp } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { htmlAssets } from '../game/htmlAssets.svelte';
	import { labPreview, stateTweak } from '../game/stateTweak.svelte';
	import { playUiSfx } from '../game/ambientAudio.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const context = getContext();
	const appContext = getContextApp();

	// Assets listos: hasta entonces se muestra el spinner del bate girando y NO
	// se permite entrar (el board estaría a medio cargar). `stateApp.loaded`
	// pasa a true cuando terminan TODOS los assets (incl. los sin preload).
	// SIN fallback por tiempo: entrar con assets a medio cargar hace que Pixi
	// loguee "Sprite: key sym_* is not found in the loadedAssets" — motivo de
	// rechazo del review N2 (consola debe quedar limpia). Si una carga cuelga,
	// el jugador recarga — jamás entrar con el board a medias.
	// htmlAssets: las imágenes HTML del HUD/overlays (cards del buy, botones)
	// también deben estar en cache — si no, el buy menu abre con pop-in.
	//
	// El intro (9.0 MB) NO entra en esta cuenta a propósito: es decoración de
	// la espera, no parte del juego. Si baja tarde aparece con un fade; si el
	// juego queda listo antes, el jugador entra sin esperarlo.
	const ready = $derived(appContext.stateApp.loaded && htmlAssets.loaded);

	// Salida animada tipo TELÓN: al click el juego se monta inmediatamente
	// detrás (showLoadingScreen=false) y el overlay completo se desliza hacia
	// abajo fuera de pantalla (650ms), revelando el board desde arriba.
	let closing = $state(false);
	const dismiss = () => {
		// Candado del laboratorio: mientras se encuadran los 4 elementos, el
		// click no puede cerrar la pantalla que se está ajustando.
		if (import.meta.env.DEV && labPreview.introHold) return;
		if (closing || !ready) return;
		closing = true;
		// SWIPE del telón: acompaña los 650 ms del `translateY` de salida. No
		// va por el eventEmitter porque `<Sound />` se monta recién con el
		// juego —en el tick que abre esta misma función— y todavía no está
		// suscrito: el evento se perdería. Ver `game/ambientAudio.svelte.ts`.
		playUiSfx('sfx_intro_swipe');
		context.stateLayout.showLoadingScreen = false;
		setTimeout(() => (closing = false), 680);
	};

	// Touch (mobile/tablet) → TAP; puntero fino (desktop) → CLICK.
	// "SKIP" y no "CONTINUE": lo que se saltea es el intro, que si nadie toca
	// nada queda en bucle.
	const skipLabel =
		typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
			? 'TAP TO SKIP'
			: 'CLICK TO SKIP';

	// El bate solo tiene sentido mientras algo está cargando. El toggle del
	// ANIM LAB lo fuerza visible para poder encuadrarlo con el juego ya listo.
	const showSpinner = $derived(!ready || (import.meta.env.DEV && labPreview.introSpinner));

	// El webp animado del intro pesa lo suyo: hasta que no terminó de bajar se
	// mantiene en opacidad 0 y entra con un fade, en vez de aparecer de golpe
	// a mitad de la carga.
	let introLoaded = $state(false);

	// Latido del texto. Va por JS y no por una `animation` de CSS a proposito:
	// una animacion CSS sobre `opacity` le gana al `style` inline, y el slider
	// de opacidad del laboratorio quedaria sin efecto sobre este elemento.
	let pulse = $state(true);
	onMount(() => {
		const id = setInterval(() => (pulse = !pulse), 600);
		return () => clearInterval(id);
	});

	// Un elemento = posición (fracción de viewport) + escala + opacidad + capa.
	// Se arma acá y no en el markup para que los 4 usen exactamente la misma
	// fórmula: `translate(-50%, -50%)` centra el elemento en (X, Y) y el
	// `scale()` crece desde ese mismo centro.
	//
	// `posId` permite tomar la POSICIÓN de otro elemento conservando escala,
	// opacidad y capa propias — lo usa el texto para mudarse al hueco del bate.
	type IntroId = 'introTitle' | 'introAnim' | 'introSpin' | 'introText';
	const place = (id: IntroId, alpha = 1, posId: IntroId = id) => {
		const t = stateTweak as unknown as Record<string, number>;
		return [
			`left: ${t[`${posId}X`] * 100}%`,
			`top: ${t[`${posId}Y`] * 100}%`,
			`transform: translate(-50%, -50%) scale(${t[`${id}Scale`]})`,
			`opacity: ${t[`${id}Alpha`] * alpha}`,
			`z-index: ${Math.round(t[`${id}Z`])}`,
		].join('; ');
	};

	// Cuando los assets terminan, el bate desaparece y el texto SUBE a ocupar
	// su lugar (pedido del usuario): sin esto quedaba un hueco donde estaba el
	// bate y el CLICK TO SKIP solo, pegado al borde de abajo.
	//
	// Se mira `showSpinner` y no `ready` a propósito: con el toggle del ANIM
	// LAB que fuerza el bate visible, los dos elementos conviven y el texto
	// tiene que quedarse en su propia posición para poder encuadrarlo.
	const textPos: IntroId = $derived(showSpinner ? 'introText' : 'introSpin');
</script>

{#if context.stateLayout.showLoadingScreen || closing}
	<button
		class="load"
		class:load--out={closing}
		onclick={dismiss}
		aria-label={skipLabel}
		style="background-image: url('assets/loading/bg_inner.jpg')"
	>
		<!-- TÍTULO — arriba (antes iba centrado en el panel). -->
		<img
			class="load__title"
			src="assets/loading/logo.png"
			alt="KASH RAMPAGE EXTREME"
			style={place('introTitle')}
		/>

		<!-- UI DEL INTRO — la ventana con el crawl de texto del Episode 16.
		     Es un WebP ANIMADO en bucle, no un spritesheet: las hojas que
		     entrega el equipo (9 atlas de ~7700x7600) son cientos de MB ya
		     decodificadas y el browser no las aguanta. Lo genera
		     `tools/build_intro.py` desde `art-src/intro/`.

		     El ciclo —15 s de animación + 3 s en transparente, 18 s en
		     total— está HORNEADO en el archivo, no acá: el WebP corre con el
		     reloj del decodificador del browser, que no empieza ni en el
		     `load` del `<img>` ni en el montaje de este componente, así que
		     ninguna animación CSS puede quedar en fase con él. Para cambiar
		     esos tiempos se re-genera el asset (`--hold-seconds`).

		     La animación ABRE y CIERRA sola (la ventana crece desde nada y se
		     vuelve a cerrar), así que el asset NO lleva el fundido por
		     software que tenía el pack anterior — ver `--fade-frames` en el
		     script. Corre a 24 fps PAREJOS (pedido de dirección 15-09): hasta
		     el 15-09 el crawl iba decimado a 12 fps para ahorrar peso, y
		     igualar la tasa llevó el asset de 5.1 a 9.0 MB. `--crawl-step 2`
		     en el script vuelve al asset anterior. -->
		<img
			class="load__intro"
			src="assets/loading/intro.webp"
			alt=""
			decoding="async"
			onload={() => (introLoaded = true)}
			style={place('introAnim', introLoaded ? 1 : 0)}
		/>

		<!-- ÍCONO DE CARGA — el bate girando (Cargador_Bate). -->
		{#if showSpinner}
			<span class="load__spin" style={place('introSpin')}>
				<LoadingSpinner size="clamp(72px, 15vmin, 132px)" />
			</span>
		{/if}

		<!-- TEXTO — LOADING mientras baja, CLICK/TAP TO SKIP cuando se puede entrar. -->
		<span
			class="load__text"
			class:load__text--load={!ready}
			style={place('introText', pulse ? 1 : 0.35, textPos)}
		>
			{ready ? skipLabel : 'LOADING'}
		</span>
	</button>
{/if}

<style>
	.load {
		position: fixed;
		inset: 0;
		z-index: 200;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		/* imagen via style inline (ruta relativa al documento — CDN subpath).
		   `cover` = el fondo llena SIEMPRE el viewport y recorta el sobrante,
		   sin deformar: es lo que lo hace responsive en cualquier forma de
		   pantalla. El color de atrás solo se ve mientras el jpg baja. */
		background: #0d0c0a center / cover no-repeat;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
		/* telón: el overlay entero baja fuera de pantalla */
		transition: transform 0.65s cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
	}
	.load--out {
		transform: translateY(102%);
		pointer-events: none;
		box-shadow: 0 -18px 40px rgba(0, 0, 0, 0.55);
	}

	/* Los 4 elementos del laboratorio comparten anclaje: `position: absolute`
	   contra el overlay (= el viewport) y su centro en el (X, Y) que les dan
	   los sliders. Ninguno recibe clicks: el botón de abajo es toda la
	   pantalla, así que tocar cualquier lado entra al juego. */
	.load__title,
	.load__intro,
	.load__spin,
	.load__text {
		position: absolute;
		pointer-events: none;
		/* el transform lo arma `place()` — acá solo el origen del scale */
		transform-origin: center center;
	}

	/* Tamaños BASE (con el slider de tamaño en 1). Son un `min()` de TRES
	   términos, y cada uno cubre una forma de pantalla:
	     · vw   → tope contra el ancho (manda en PORTRAIT, donde el límite es
	              lo angosta que es la pantalla).
	     · vh   → tope contra el alto (manda en landscape bajito, tipo el
	              popout 800×450, donde el intro se comería el título).
	     · vmax → el tamaño de diseño en landscape normal, atado al lado
	              LARGO: sin este término un desktop ancho recibiría el mismo
	              tope de ancho que un teléfono y el intro saldría gigante.
	   Sin el vmax el default solo servía en landscape y en portrait entraba
	   todo diminuto. El encuadre fino igual es por bucket, desde el UI LAB. */
	.load__title {
		width: min(60vw, 56vh, 32vmax);
		height: auto;
		filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
	}
	/* El intro es el único que NO mide lo mismo que lo que se ve: el asset
	   lleva un margen transparente alrededor de la ventana para que entre el
	   OVERSHOOT de la apertura (la ventana se pasa de tamaño antes de
	   asentarse). La ventana en reposo ocupa el 89.3% del ancho de la imagen,
	   así que los tres términos van x1.119 respecto de los del resto — 92/112/60
	   eran los aprobados cuando el asset era exactamente la ventana.

	   Se compensa ACÁ y no en los sliders porque `introAnimScale` tiene un
	   valor aprobado por bucket en el UI LAB: tocando el ancho base una sola
	   vez, los ~8 juegos de valores siguen valiendo tal cual. El recorte del
	   asset es simétrico respecto del centro de la ventana (ver
	   `tools/build_intro.py`), así que `introAnimX/Y` tampoco se mueven. */
	.load__intro {
		width: min(103vw, 125vh, 67vmax);
		height: auto;
		/* fade de entrada cuando termina de bajar el webp (ver `introLoaded`) */
		transition: opacity 0.45s ease;
	}
	.load__spin {
		display: block;
	}
	.load__text {
		color: #f6ef1b;
		font-size: clamp(12px, 2.4vmin, 20px);
		font-weight: 900;
		letter-spacing: 5px;
		/* compensa el tracking del último caracter al centrar */
		text-indent: 5px;
		white-space: nowrap;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
		/* `left`/`top` también entran en la transición: al terminar la carga el
		   texto se MUEVE al lugar que deja el bate, y sin esto saltaba. */
		transition:
			opacity 0.3s ease,
			left 0.4s ease,
			top 0.4s ease;
	}
	.load__text--load {
		letter-spacing: 8px;
		text-indent: 8px;
	}
</style>
