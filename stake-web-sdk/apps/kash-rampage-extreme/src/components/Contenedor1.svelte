<script lang="ts" module>
	// Arte: static/assets/ui/Contenedor1.png — 1275×501 RGBA.
	export const CONTENEDOR1_ASPECT = 1275 / 501;

	// El PNG no es un rectángulo: es un paralelogramo inclinado (cuerpo oscuro
	// con borde amarillo) MÁS una cinta decorativa debajo. Centrar el texto en
	// el sprite lo dejaría montado sobre la cinta, así que hay que ubicar el
	// cuerpo real.
	//
	// ⚠ La medición se toma en la COLUMNA CENTRAL del arte, no sobre el alto
	// total. Al ser un paralelogramo, el borde superior está mucho más abajo a
	// la izquierda que a la derecha: un min/max sobre todo el ancho da un
	// "cuerpo" que no corresponde a ninguna columna concreta. Como el texto va
	// centrado horizontalmente, la referencia correcta es x = W/2.
	//
	// Clasificando por color en x=637 de 1275 (`.` transparente, `Y` borde
	// amarillo, `D` relleno oscuro) sobre los 501 px de alto:
	//     .   0..86      Y  86..108     D 108..403   ← cuerpo
	//     Y 403..410     D 410..438     Y 438..446   ← borde + cinta
	const BODY_TOP = 108;
	const BODY_BOTTOM = 403;
	const BODY_CENTER_Y = (BODY_TOP + BODY_BOTTOM) / 2 / 501 - 0.5; // ≈ +0.010
	const BODY_H = (BODY_BOTTOM - BODY_TOP) / 501; // ≈ 0.589

	/**
	 * Inclinación del cuerpo del recipiente, en radianes. El texto se rota con
	 * este valor para que quede paralelo al panel en vez de horizontal sobre un
	 * fondo inclinado.
	 *
	 * NO es un número elegido a ojo: sale de un ajuste por mínimos cuadrados
	 * sobre el borde superior del PNG (60 % central, salteando las esquinas
	 * biseladas) → pendiente dy/dx = -0.15625 → -8.88°. El signo es lo que más
	 * importa: en Pixi la Y crece hacia abajo y el panel SUBE hacia la derecha,
	 * así que la rotación es NEGATIVA. Con +10° el texto se inclinaría en
	 * contra del recipiente en vez de acompañarlo.
	 */
	export const CONTENEDOR1_TILT = Math.atan(-0.15625); // ≈ -0.1550 rad ≈ -8.88°
</script>

<script lang="ts">
	// Recipiente del HUD superior (ref. REFERENCIA_NUEVA_UI.png). Se instancia
	// una vez por dato — Balance, Last Win y Tumble — con su título fijo y su
	// texto dinámico adentro. Modelado sobre
	// packages/components-ui-pixi/src/components/UiLabel.svelte (panel + label +
	// value en modo `stacked`), pero local a la app y con la paleta de KRE.
	import { Container, Sprite, Text } from 'pixi-svelte';

	type Props = {
		label: string;
		value: string;
		/** Ancho del recipiente en px de canvas. El alto sale del aspect del arte. */
		width: number;
	};

	const props: Props = $props();

	const KASH_YELLOW = 0xf6ef1b;
	const KASH_WHITE = 0xffffff;
	const KASH_DARK = 0x0d0c0a;

	const h = $derived(props.width / CONTENEDOR1_ASPECT);

	// Tipografías proporcionales al alto del recipiente para que un solo slider
	// de escala mueva panel y texto como una pieza.
	const labelStyle = $derived({
		fontFamily: 'Neue Plak Text',
		fontSize: h * 0.155,
		fontWeight: '900' as const,
		fill: KASH_YELLOW,
		letterSpacing: h * 0.05,
	});

	// El cuerpo del panel entra cómodo hasta ~11 caracteres ("$100,000.00"), que
	// es el largo medido con el balance del mock. Las condiciones del reviewer
	// son peores: XEC se muestra como SC y con balances altos salen strings como
	// "SC 1,000,000.00" (15). Pixi Text NO recorta ni ajusta: el sobrante se
	// dibuja fuera del recipiente. Por eso el cuerpo achica la tipografía en
	// proporción al excedente — determinista y sin medir texto.
	const FIT_CHARS = 11;
	const fit = $derived(Math.min(1, FIT_CHARS / Math.max(FIT_CHARS, props.value.length)));
	const valueStyle = $derived({
		fontFamily: 'Neue Plak Extended',
		fontSize: h * 0.3 * fit,
		fontWeight: '900' as const,
		fill: KASH_WHITE,
		letterSpacing: h * 0.01 * fit,
		// Contorno oscuro: el valor cae sobre el cuerpo negro, pero el borde
		// amarillo pasa cerca en los viewports chicos y sin esto se empasta.
		stroke: { color: KASH_DARK, width: Math.max(1, h * 0.02) },
	});
</script>

<Container>
	<Sprite key="ui_contenedor1" anchor={{ x: 0.5, y: 0.5 }} width={props.width} height={h} />
	<!-- Ambos textos giran sobre su PROPIO centro (anchor 0.5): el apilado
	     vertical no se mueve y cada línea queda paralela al cuerpo inclinado. -->
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		y={h * (BODY_CENTER_Y - BODY_H * 0.24)}
		rotation={CONTENEDOR1_TILT}
		text={props.label}
		style={labelStyle}
	/>
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		y={h * (BODY_CENTER_Y + BODY_H * 0.2)}
		rotation={CONTENEDOR1_TILT}
		text={props.value}
		style={valueStyle}
	/>
</Container>
