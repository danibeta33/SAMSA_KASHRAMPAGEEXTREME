<script lang="ts" module>
	// ── Constantes y estado COMPARTIDO del marco de victoria ─────────────────
	// `Marco_Icono`: 21 frames (0..20). Los tramos los pidió dirección:
	//   0..15  entrada, mientras el cluster se ilumina
	//   4..15  bucle de espera hasta que termina de iluminarse TODO el cluster
	//   …→18   salida, desde el frame en curso, al hacer el boing de desaparición
	export const MARCO_INTRO_END = 15;
	export const MARCO_LOOP_START = 4;
	// La salida CIERRA en el 18 y no en el 20: los dos últimos frames del export
	// son el marco ya relleno (amarillo pleno y después bloque rojo), que con el
	// marco por ENCIMA del ícono taparían la celda entera justo cuando el
	// símbolo se está yendo. Pedido de dirección: terminar en el 18.
	export const MARCO_LAST_FRAME = 18;
	export const MARCO_FPS = 24; // entrada y bucle
	const MARCO_ANIM_SPEED = MARCO_FPS / 60;
	const MARCO_CELL_RATIO = 1.12; // lado del marco en celdas, antes del dial

	// Frame ABSOLUTO en el que va el bucle. Vive en el módulo (compartido por
	// todas las celdas) a propósito: la salida se dibuja en componentes
	// DISTINTOS de los que corrieron el bucle — la presentación es del board
	// principal y el boing del tumble board. Ver la nota del `$effect`.
	let marcoLoopFrame = MARCO_LOOP_START;
</script>

<script lang="ts">
	// Wireframe-aware sprite renderer.
	// - When `symbolInfo.assetKey === 'wireframe'` we draw a coloured Rectangle
	//   + Text (tier-coded) instead of a real Sprite. Drop in real sprite
	//   assets later by changing the `assetKey` in SYMBOL_INFO_MAP.
	// - oncomplete is fired race-safely: TumbleBoard.svelte assigns
	//   `tumbleSymbol.oncomplete = resolve` *after* mutating symbolState, so
	//   firing synchronously would resolve the previous (stale) callback and
	//   the round would hang forever on every win. We delay by 150ms and read
	//   `props.oncomplete` inside the timeout — never via a captured closure.
	import { onMount, untrack } from 'svelte';
	import type * as PIXI from 'pixi.js';
	import {
		AnimatedSprite,
		BaseSprite,
		Container,
		Rectangle,
		Sprite,
		SpriteSheet,
		Text,
		getContextApp,
	} from 'pixi-svelte';

	import { SYMBOL_SIZE } from '../game/constants';
	import { getSymbolInfo } from '../game/utils';
	import type { RawSymbol, SymbolState } from '../game/types';
	// Multiplicador global de tamaño de símbolos, tweakeable en vivo (UiLab).
	import { stateUiTweak } from '../game/stateUiTweak.svelte';
	// Multiplicador extra SOLO para los especiales (slider `specialScale`).
	import { stateTweak, labPreview } from '../game/stateTweak.svelte';
	import { stateWinHighlight } from '../game/stateWinHighlight.svelte';
	import { ANTICIPATION, stateAnticipation } from '../game/stateAnticipation.svelte';
	import {
		SELF_ANIMATED_ASSET_KEYS,
		getWinPopTotalMs,
		type SelfAnimatedAssetKey,
		type WinPop,
	} from '../game/winPop.svelte';
	import type { WinFlashCell } from '../game/winFlash.svelte';

	type Props = {
		x?: number;
		y?: number;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		symbolState?: SymbolState;
		rawSymbol?: RawSymbol;
		oncomplete?: () => void;
		// Tweens del pop/boing de cluster ganador (winPop.svelte.ts). Se aplican
		// al Container DEL SPRITE — la celda (SymbolWrap) queda intacta.
		winPop?: WinPop;
		// Tweens del feedback de victoria (winFlash.svelte.ts): alpha del
		// brillo trasero + escala del ícono, en contenedores SEPARADOS.
		winFlash?: WinFlashCell;
		// ── ANTICIPACIÓN (v5, 09-09) ────────────────────────────────────────
		// Los calcula ReelSymbol contra stateAnticipation. Opcionales: el tumble
		// board y el AnimLab montan sprites sin anticipación y caen a 0 / 1.
		//  · antGlow  → 0→1, cuánto está iluminado ESTE símbolo ahora mismo.
		//  · antAlpha → alpha de la celda; < 1 solo en las columnas ya frenadas.
		antGlow?: number;
		antAlpha?: number;
	};

	const props: Props = $props();

	$effect(() => {
		// Track state changes so the effect re-runs on every transition.
		props.symbolInfo;
		// NO cleanup — letting the timer fire even after a fresh state change
		// is the whole point: `props.oncomplete` is read dynamically when the
		// timer fires, so it always invokes the CURRENT callback (whichever
		// handler is awaiting it right now). Cancelling on cleanup caused
		// hangs when a cluster ganador → tumble cycle changed state within
		// 150ms, dropping the in-flight resolve.
		setTimeout(() => props.oncomplete?.(), 150);
	});

	// Wireframe palette (Lucky Bastards street/hip-hop).
	const TIER_COLOR: Record<string, number> = {
		H: 0xe02330, // hot pink
		M: 0xff7a1a, // teal
		L: 0xf6ef1b, // lime
		W: 0xffffff, // white
		S: 0xfbbf24, // yellow
	};
	const labelOf = (raw?: RawSymbol) => raw?.name ?? '?';
	const colorOf = (raw?: RawSymbol) => TIER_COLOR[(raw?.name ?? 'L')[0]] ?? 0x777777;

	const isWireframe = $derived(props.symbolInfo.assetKey === 'wireframe');

	// ── GEOMETRÍA INDIVIDUAL, LOS 12 SÍMBOLOS (drop 09-09 · Paso 8) ─────────
	// En el Paso 6 solo los 3 animados tenían diales propios; ahora cada uno de
	// los 12 trae del UI LAB su nudge X/Y, su escala, y los 3 equivalentes del
	// MARCO de victoria que se dibuja sobre él.
	//
	// El puente entre símbolo y clave es puramente el nombre: `sym_h1` → `h1X`,
	// `h1Y`, `h1Scale`, `h1MarcoX`… No hay ningún mapa que mantener
	// sincronizado — agregar un símbolo a `LAB_SYMBOLS` (labMeta.ts) le da
	// sliders, persistencia por bucket y lectura acá, sin tocar este archivo.
	// `wireframe` no arranca con `sym_` y cae a los valores neutros.
	const tweakByKey = stateTweak as unknown as Record<string, number>;
	const labId = $derived(
		props.symbolInfo.assetKey.startsWith('sym_') ? props.symbolInfo.assetKey.slice(4) : '',
	);
	const geomOf = (suffix: string, fallback: number) => {
		if (!labId) return fallback;
		const value = tweakByKey[`${labId}${suffix}`];
		return typeof value === 'number' ? value : fallback;
	};

	// Los 3 animados (W / S / KASH) conservan ADEMÁS el dial de GRUPO
	// `specialScale`, que es el que los hace resaltar juntos contra los 10
	// regulares y está congelado por bucket en PER_BUCKET_SEED. El dial
	// individual multiplica encima.
	const SPECIAL_KEYS = new Set<string>(SELF_ANIMATED_ASSET_KEYS);
	const isSpecial = $derived(SPECIAL_KEYS.has(props.symbolInfo.assetKey));
	// Se aplica a los DOS caminos de render (el clip animado y el sprite
	// estático). Si solo escalara uno, el swap estático → animado daría un salto
	// de tamaño. Mismo motivo para el desplazamiento.
	const sizeMult = $derived((isSpecial ? stateTweak.specialScale : 1) * geomOf('Scale', 1));

	// X/Y del laboratorio vienen en FRACCIONES DE CELDA — el símbolo ya está
	// posicionado por la grilla y esto es un nudge fino sobre esa posición, así
	// que escalan con SYMBOL_SIZE y no con el canvas.
	const cx = $derived((props.x ?? 0) + geomOf('X', 0) * SYMBOL_SIZE);
	const cy = $derived((props.y ?? 0) + geomOf('Y', 0) * SYMBOL_SIZE);

	const w = $derived(
		SYMBOL_SIZE * props.symbolInfo.sizeRatios.width * stateUiTweak.symScale * sizeMult,
	);
	const h = $derived(
		SYMBOL_SIZE * props.symbolInfo.sizeRatios.height * stateUiTweak.symScale * sizeMult,
	);

	// Iconos especiales ANIMADOS: W (bate WILD), S (barra SCATTER), H4 (fajo
	// KASH PREMIUM). El static key del math (sym_w/sym_s/sym_h4) se mapea al
	// spritesheet del equipo (drop 04-09: llamas rojas, ya en paleta con los
	// estáticos del kit 25-08). Loop a 10fps.
	//
	// ⚠ Los sheets nuevos son TexturePacker TRIMMED sobre un canvas 256²: PIXI
	// devuelve texturas con `orig` 256×256 (el recorte se re-inyecta al pintar),
	// así que darle `width/height` al SpriteSheet dimensiona el CANVAS, no el
	// arte. Y el arte no está centrado en ese canvas (el bate cuelga hacia
	// abajo: centro y=0.60), así que con anchor 0.5 quedaba chico y corrido.
	// Por eso cada entrada trae la caja del arte medida del .json —
	// union de los `spriteSourceSize` de los 6 frames, normalizada al canvas:
	//   aspect = ancho/alto del arte · fill = qué fracción del canvas ocupa ·
	//   center = dónde cae su centro · box = lado mayor del ARTE en celdas.
	// El `box` replica el sizeRatio del estático correspondiente para que el
	// swap estático → animado (los sheets van sin preload) no dé un salto de
	// tamaño en el board.
	//
	// `luzKey` (drop 09-09) es el clip de ILUMINACIÓN del mismo símbolo. No es
	// arte nuevo sino EL MISMO clip con el glow horneado encima, exportado desde
	// el mismo canvas 256² y con el personaje en la misma posición — por eso se
	// dibuja con el MISMO width/height/offset que el clip base (ver el render)
	// en vez de traer sus propios ratios: compartir el lienzo de origen ES la
	// alineación. Medir el `_luz` por su cuenta lo desalinearía, porque su
	// bounding box es más grande (el glow sangra fuera del ícono).
	type AnimSpecial = {
		key: string;
		luzKey: string;
		aspect: number;
		fill: { w: number; h: number };
		center: { x: number; y: number };
		box: number;
	};
	// Tipado contra SELF_ANIMATED_ASSET_KEYS: son exactamente los íconos que
	// winPop saltea por tener clip propio.
	const ANIM_SPECIAL: Record<SelfAnimatedAssetKey, AnimSpecial> = {
		// bate WILD — arte 169×205 en (41,51); cuelga abajo (center.y 0.600)
		sym_w: {
			key: 'anim_sym_wild',
			luzKey: 'anim_sym_wild_luz',
			aspect: 169 / 205,
			fill: { w: 169 / 256, h: 205 / 256 },
			center: { x: 125.5 / 256, y: 153.5 / 256 },
			box: 0.9, // = sizeRatios de sym_w
		},
		// barra SCATTER — arte 255×254 a sangre, prácticamente centrado
		sym_s: {
			key: 'anim_sym_scatter',
			luzKey: 'anim_sym_scatter_luz',
			aspect: 255 / 254,
			fill: { w: 255 / 256, h: 254 / 256 },
			center: { x: 127.5 / 256, y: 127 / 256 },
			box: 0.95, // = sizeRatios de sym_s
		},
		// KASH (H4, premium) — fajo de billetes (drop 08-09: el clip `Special_Billetes`
		// reemplazó al `Special_Graffiti` bajo el mismo nombre de archivo). Arte
		// 256×239 casi a sangre y centrado, contra el grafiti viejo que era
		// 182×191 en (34,51) y colgaba abajo. Números medidos del .json con
		// `.scripts/repack_spritesheet.py --report`: si el sheet se vuelve a
		// re-exportar hay que volver a correrlo y pegar los valores que imprime.
		//
		// RE-MEDIDOS el 09-09: el drop de ese día cambió el clip de 25 frames a
		// 6 y con él la caja del arte (aspect 1.0323 → 1.0711, fill.h 0.96875 →
		// 0.933594, center.y 0.503906 → 0.533203), pero los valores acá habían
		// quedado colgados del sheet anterior.
		// El TAMAÑO no se movía: `specialW`/`specialH` siempre dan el mismo
		// cuadrado (aspect y fill salen de la misma bbox y se cancelan). Lo que
		// estaba mal era el CENTRADO: con center.y 0.5039 en vez de 0.5332 el
		// offset compensaba 0.0039 de lienzo en lugar de 0.0332, así que el fajo
		// se dibujaba ≈2.5 px de board (3 % de celda) por DEBAJO de su centro.
		sym_h4: {
			key: 'anim_sym_premium',
			luzKey: 'anim_sym_premium_luz',
			aspect: 1.07113,
			fill: { w: 1.0, h: 0.933594 },
			center: { x: 0.5, y: 0.533203 },
			box: 0.8, // = sizeRatios de sym_h4 (default de mkSprite)
		},
	};
	// Velocidad de reproducción de los clips especiales, en la unidad de PIXI
	// (fracción de frame por tick a 60fps) = 10 fps. Es UNA constante y no dos
	// literales sueltos a propósito: el clip base y su `_luz` tienen que correr
	// exactamente igual o el glow se desfasa del ícono al que acompaña. Todo lo
	// demás que comparten —ancho, alto, posición, offset y centro de
	// composición— sale de las MISMAS variables derivadas (`specialW`,
	// `specialH`, `specialOffsetX/Y`), así que no hay ningún número que puedan
	// desincronizar.
	const SPECIAL_ANIM_SPEED = 10 / 60;

	const appContext = getContextApp();
	const special = $derived(
		ANIM_SPECIAL[props.symbolInfo.assetKey as SelfAnimatedAssetKey] as AnimSpecial | undefined,
	);
	// Solo animar cuando el sheet ya cargó; si no, cae al estático.
	const specialReady = $derived(
		!!special &&
			!!appContext.stateApp.loadedAssets?.[
				special.key as keyof typeof appContext.stateApp.loadedAssets
			],
	);
	// Clip de ILUMINACIÓN del especial (drop 09-09). Va sin `preload` como el
	// resto de los `_luz`, así que hay que esperarlo igual que al clip base: si
	// todavía no bajó, el especial gana su ronda con el clip de siempre y sin
	// glow — degrada, no rompe.
	const specialLuzReady = $derived(
		!!special &&
			!!appContext.stateApp.loadedAssets?.[
				special.luzKey as keyof typeof appContext.stateApp.loadedAssets
			],
	);
	// Símbolos SIN sprite estático de respaldo: su .png se borró del registro
	// porque el clip animado es ahora la única representación (H4 = KASH / fajo,
	// drop 08-09 — `anim_sym_premium` va con `preload`, así que ya está en
	// `loadedAssets` antes del primer render del board).
	//
	// Esta guarda NO es defensa en profundidad opcional: sin ella la rama
	// `{:else}` pediría `<Sprite key="sym_h4">` sobre una clave inexistente y
	// PIXI escupiría "Sprite key not found" — el motivo #1 de rechazo del
	// `05-preflight-checklist.md`. Que hoy sea inalcanzable depende del orden de
	// carga; acá se vuelve una invariante del componente.
	// 09-09: pasaron de 1 a 3. El drop de arte borró `l4.png`, `w.png` y `s.png`,
	// así que los tres símbolos animados quedaron SIN estático de respaldo. Sus
	// clips van los tres con `preload`, que es lo que garantiza que la celda
	// nunca quede vacía (el bug de las celdas en blanco salía justamente de
	// pedir una textura que ya no existía).
	// 10-09: el animado del trío vuelve a ser `sym_h4` (el fajo ES el premium
	// KASH) y `sym_l4` recupera estático — el medallón `h4.png` + `h4_luz.png`.
	const STATIC_LESS = new Set(['sym_h4', 'sym_w', 'sym_s']);
	const hasStatic = $derived(!STATIC_LESS.has(props.symbolInfo.assetKey));
	// Lado mayor del ARTE (no del canvas) en px de board; el menor sale del aspect.
	const specialSide = $derived(
		special ? SYMBOL_SIZE * special.box * stateUiTweak.symScale * sizeMult : 0,
	);
	const artW = $derived(
		special ? (special.aspect >= 1 ? specialSide : specialSide * special.aspect) : 0,
	);
	const artH = $derived(
		special ? (special.aspect >= 1 ? specialSide / special.aspect : specialSide) : 0,
	);
	// El SpriteSheet se dimensiona por el CANVAS 256² (ver nota arriba): se
	// infla desde el arte dividiendo por el fill…
	const specialW = $derived(special ? artW / special.fill.w : 0);
	const specialH = $derived(special ? artH / special.fill.h : 0);
	// …y se corre para que el CENTRO DEL ARTE (no el del canvas) caiga en la
	// celda. Sin esto el bate/grafiti quedan ~10% abajo del centro.
	const specialOffsetX = $derived(special ? -specialW * (special.center.x - 0.5) : 0);
	const specialOffsetY = $derived(special ? -specialH * (special.center.y - 0.5) : 0);

	// Resalte de cluster ganador (26-08): la carta ILUMINADA del kit es el
	// estado de win — sin halo lima (pedido: "quita los cuadros verdes, ya
	// tenemos las versiones de luz"). Mientras el highlight global está
	// activo, el resto del board se atenúa para que salten.
	const isWinning = $derived(
		props.symbolState === 'win' ||
			props.symbolState === 'postWinStatic' ||
			// El pop de salida arranca desde la carta iluminada — sin esto el
			// símbolo volvía al estático en el frame justo antes del boing.
			props.symbolState === 'explosion',
	);
	const dimmed = $derived(
		stateWinHighlight.active && !isWinning && props.symbolState === 'static',
	);
	// ── ANTICIPACIÓN: el símbolo ES el efecto ────────────────────────────────
	// Sustituye a los 3 rectángulos lima de Anticipation.svelte. La columna que
	// sigue girando se ilumina con su PROPIA carta/clip `_luz` —conserva su
	// color y el SCATTER se sigue leyendo, que era el caso que el halo amarillo
	// arruinaba— y el resto del board baja de alpha.
	//
	// El `_luz` es el mismo arte que usa la victoria, pero acá se lee distinto y
	// a propósito: en anticipación la luz VIAJA de arriba abajo en bucle sobre
	// símbolos GIRANDO, sin marco ni boing; el win la enciende en celdas
	// quietas, una sola vez y con `Marco_Icono` detrás. Si dirección igual lo
	// quiere separado, es cambiar la fuente de estas tres derivadas.
	const antGlow = $derived(props.antGlow ?? 0);
	const antAlpha = $derived(props.antAlpha ?? 1);
	// El alpha del win manda cuando los dos están activos (nunca coinciden hoy:
	// `dimmed` exige 'static' y en anticipación los símbolos están en 'spin').
	const cellAlpha = $derived(dimmed ? 0.3 : antAlpha);
	// Iconos ILUMINADOS (kit 26-08): carta full-bleed con marco oscuro + glow
	// horneado que reemplaza al estático + halo lima durante win/postWinStatic.
	// Los 9 regulares estáticos tienen versión luz; w/s/h4 son animados y usan
	// su propio clip `_luz`, y cualquier símbolo cuyo luz aún no cargó — van sin
	// preload — cae al halo de siempre.
	// (sym_h4 NO está en este mapa: KASH es el fajo animado y su glow sale del
	// clip `anim_sym_premium_luz`, por la rama de los especiales. `sym_l4` sí
	// está — su carta es `h4_luz.png`, el medallón iluminado.)
	const LUZ_KEY: Record<string, string> = {
		sym_l1: 'sym_l1_luz',
		sym_l2: 'sym_l2_luz',
		sym_l3: 'sym_l3_luz',
		sym_l4: 'sym_l4_luz',
		sym_m1: 'sym_m1_luz',
		sym_m2: 'sym_m2_luz',
		sym_h1: 'sym_h1_luz',
		sym_h2: 'sym_h2_luz',
		sym_h3: 'sym_h3_luz',
	};
	const luzKey = $derived(LUZ_KEY[props.symbolInfo.assetKey]);
	const luzReady = $derived(
		!!luzKey &&
			!!appContext.stateApp.loadedAssets?.[
				luzKey as keyof typeof appContext.stateApp.loadedAssets
			],
	);
	// La carta ocupa la celda completa (no el 0.8 del icono suelto) y conserva
	// el aspect 1080×970 del arte para no estirar el marco.
	const luzW = $derived(SYMBOL_SIZE * 0.98 * stateUiTweak.symScale);
	const luzH = $derived(luzW * (970 / 1080));
	// (halo lima y win_overlay eliminados 26-08 — la carta luz ES el resalte
	// del cluster; el W sin luz se lee por el dim del resto del board)

	// Pop/boing del cluster ganador: se multiplica con el pop de aparición y
	// gira el sprite en su propio centro (los hijos van con anchor 0.5).
	const winScale = $derived(props.winPop?.scale.current ?? 1);
	const winRotation = $derived(props.winPop?.rotation.current ?? 0);

	// Feedback de victoria (cascada de Board.svelte):
	//  · glowAlpha → SOLO el alpha del sprite de brillo trasero. Sin secuencia
	//    activa cae al comportamiento aprobado (26-08): carta luz a full en
	//    win/postWinStatic/explosion, apagada en el resto.
	//  · flashScale → SOLO la escala del ícono, en su propio Container: el
	//    brillo no escala (si no, el halo respira y pisa la celda vecina) y la
	//    celda tampoco (eso movería la grilla).
	const glowAlpha = $derived(props.winFlash?.glow.current ?? (isWinning ? 1 : 0));
	const flashScale = $derived(props.winFlash?.scale.current ?? 1);
	// Sin secuencia activa la carta luz SUSTITUYE al ícono — es el resalte
	// aprobado el 26-08 (y el caso de los especiales, que quedan fuera de la
	// cascada). Con secuencia, el ícono se dibuja ENCIMA del brillo para que
	// el boing tenga algo que golpear.
	const glowReplacesIcon = $derived(!props.winFlash && isWinning && luzReady);
	// Alpha efectivo de la carta trasera: win o anticipación, el que mande.
	const luzShowAlpha = $derived(Math.max(glowAlpha, antGlow));
	// Copia aditiva del MISMO ícono, ENCIMA. Va SIEMPRE que haya anticipación,
	// no solo cuando falta la carta `_luz`: la carta sola se queda corta porque
	// vive DETRÁS del ícono (el ícono es opaco y la tapa casi entera), así que
	// tope el alpha que tope, el símbolo no pasaba de su brillo normal. El
	// aditivo SUMA luz sobre el arte en vez de asomarse por el borde — es lo
	// que hace que la columna se vea encendida y no apenas contorneada.
	// Sigue cubriendo el caso de respaldo: las cartas `_luz` van sin `preload`,
	// y si todavía no bajó, esto es todo el efecto y alcanza.
	const antAddAlpha = $derived(antGlow * ANTICIPATION.addMult);

	// ── Ciclo de vida del brillo de los ESPECIALES (drop 09-09) ─────────────
	// A diferencia de los 10 regulares —cuya carta `_luz` acompaña todo
	// `isWinning`, o sea también `postWinStatic` y `explosion`— el clip de luz
	// de W/S/H4 vive SOLO mientras dura el estado `win`.
	//
	// El brillo acompaña toda la PRESENTACIÓN del cluster (`win` +
	// `postWinStatic`) y se apaga al explotar. `explosion` es el único estado
	// que se excluye a propósito: ahí el símbolo ya está saliendo del board y
	// dejar un clip en loop por detrás es justamente el overlay residual que se
	// quiere evitar.
	//
	// Al caer este flag el bloque `{#if}` se desmonta y `createContextParent`
	// destruye el nodo en su cleanup (`return () => node.destroy()`): no queda
	// AnimatedSprite ni ticker colgando. Apagar el alpha NO alcanzaría — el
	// sprite seguiría vivo y animando invisible.
	//
	// `postWinStatic` entra en la ventana (antes no estaba) porque sin él el
	// brillo se veía apenas: `boardWithAnimateSymbols` deja el estado `win`
	// solo lo que dura la cascada, con un piso de 250 ms, y un cluster de puro
	// especial no anima nada en esa cascada — el clip de 6 frames a 10 fps ni
	// llegaba a media vuelta.
	// `labPreview.luz` lo fuerza desde el AnimLab sin tener que ganar.
	const specialGlowOn = $derived(
		labPreview.luz || props.symbolState === 'win' || props.symbolState === 'postWinStatic',
	);
	// El MISMO clip `_luz` sirve a los dos efectos, pero NO de la misma forma.
	// Es la vía por la que se ilumina el SCATTER (`anim_sym_scatter_luz`), que
	// es el caso de prueba del near-miss.
	//
	//  · VICTORIA → alpha pleno, DETRÁS del clip base (zIndex 0). El glow
	//    sangra alrededor de la silueta y el ícono queda nítido. Sin cambios.
	//  · ANTICIPACIÓN → el mismo clip va ENCIMA (zIndex 2) y en `blendMode`
	//    aditivo. Detrás casi no se notaba: el clip base es opaco y solo dejaba
	//    ver el borde. Aditivo y adelante SUMA luz sobre el arte entero, que es
	//    lo que hace que la columna se lea encendida de verdad.
	//    Es la misma arte registrada al mismo canvas 256², así que sumarlo
	//    sobre sí mismo brilla sin desalinear ni ensuciar la silueta.
	//    El alpha va por debajo de 1 (`specialAddMult`) para que el oro del
	//    SCATTER se realce sin quemarse a blanco.
	const antLuzOnTop = $derived(!specialGlowOn && antGlow > 0);
	const specialLuzAlpha = $derived(
		specialGlowOn ? 1 : antGlow * ANTICIPATION.specialAddMult,
	);

	type MarcoPhase = 'intro' | 'loop' | 'outro' | 'done';
	// Arranca YA en salida si el componente nace explotando. Es el caso normal
	// del tumble board: sus símbolos se montan nuevos y pasan directo de
	// `static` a `explosion` (nunca por `win`), así que sin esto el marco
	// dibujaba un tick de la ENTRADA —frame 0, casi vacío— antes de que el
	// efecto lo corrigiera, y se veía como un parpadeo.
	let marcoPhase = $state<MarcoPhase>(props.symbolState === 'explosion' ? 'outro' : 'intro');

	// ── MARCO DE VICTORIA (drop 09-09) ──────────────────────────────────────
	// `Marco_Icono`: 21 frames de un marco cómic rojo/amarillo que estalla
	// DETRÁS del símbolo. Va en TODOS los que anotan —regulares y especiales—,
	// no solo en los tres animados, así que se dibuja fuera de las tres ramas
	// de render, como hermano directo dentro de la celda.
	//
	// Se dibuja a sangre sobre la celda (el arte es cuadrado y centrado, fill
	// 1.0 / center 0.5 tras el re-pack) y NO hereda la geometría de los
	// especiales: el marco pertenece a la CELDA, no al ícono. Por eso usa
	// `props.x/props.y` y no `cx/cy` — si siguiera el nudge de un especial, el
	// marco se saldría de su casilla.
	//
	// `loop={false}`: es un burst de entrada, no un latido. Los últimos frames
	// cierran el marco en un bloque lleno, que queda como fondo del símbolo
	// mientras dura la presentación. Si dirección lo quiere pulsando, es
	// cambiar esta prop.
	const marcoTextures = $derived(
		(appContext.stateApp.loadedAssets?.marco as unknown as PIXI.Texture[] | undefined) ?? [],
	);
	const marcoReady = $derived(marcoTextures.length > MARCO_INTRO_END);
	// ── El marco TAMBIÉN en la anticipación (pedido de dirección 09-09) ─────
	// Las columnas que siguen girando encienden el mismo `Marco_Icono` que el
	// cluster ganador: entra con su burst (frames 0..15) y se queda en el bucle
	// de espera (4..15) mientras dure la anticipación.
	//
	// `marcoIsAnticipation` distingue los dos usos, y hace falta en dos lugares
	// —el alpha y el frame compartido— porque el marco de win tiene contratos
	// que el de anticipación NO debe tocar (ver abajo).
	const marcoIsAnticipation = $derived(!isWinning && !labPreview.marco && antGlow > 0);
	// El marco RESPIRA CON EL BARRIDO: su alpha es el mismo `antGlow` de la
	// celda, así que la luz que baja de arriba hacia abajo enciende marco e
	// ícono a la vez y se lee como UN solo pulso recorriendo la columna. En
	// win queda en 1, como estaba.
	const marcoAlpha = $derived(marcoIsAnticipation ? antGlow : 1);
	// El marco de anticipación NO usa la máquina de fases de abajo: se dibuja
	// como UN frame suelto, elegido por el reloj COMPARTIDO de la anticipación.
	// El porqué está en `stateAnticipation.elapsedMs` — resumido: la columna
	// gira, cada celda vive ~133 ms y una entrada de 666 ms por celda no
	// llegaría a formarse nunca. Con el reloj compartido la celda que entra por
	// arriba ya aparece con el marco armado y la animación se lee como una
	// sola, corriendo en toda la columna.
	//
	// Recorre los MISMOS tramos que el marco de victoria: entrada 0..15 una vez
	// y después el bucle de espera 4..15.
	const antMarcoFrame = $derived.by(() => {
		const f = Math.floor((stateAnticipation.elapsedMs / 1000) * MARCO_FPS);
		if (f <= MARCO_INTRO_END) return f;
		const loopLength = MARCO_INTRO_END - MARCO_LOOP_START + 1;
		return MARCO_LOOP_START + ((f - MARCO_INTRO_END - 1) % loopLength);
	});
	// `marcoReady` ya garantiza que el array llega hasta MARCO_INTRO_END.
	const antMarcoTexture = $derived(marcoTextures[antMarcoFrame]);
	// `labPreview.marco` lo fuerza desde el AnimLab sin tener que ganar.
	// El de anticipación queda FUERA del guard de `marcoPhase`: esa máquina es
	// del marco de victoria y acá no corre.
	const marcoOn = $derived(
		marcoReady &&
			(marcoIsAnticipation || ((labPreview.marco || isWinning) && marcoPhase !== 'done')),
	);
	// Tamaño y posición salen de los 3 diales PROPIOS del símbolo
	// (`<id>MarcoX/Y/Scale`): el encuadre del marco depende del ícono que
	// enmarca, así que cada uno lleva el suyo. La base es la CELDA, no el ícono.
	const marcoSide = $derived(
		SYMBOL_SIZE * MARCO_CELL_RATIO * stateUiTweak.symScale * geomOf('MarcoScale', 1),
	);
	const marcoX = $derived((props.x ?? 0) + geomOf('MarcoX', 0) * SYMBOL_SIZE);
	const marcoY = $derived((props.y ?? 0) + geomOf('MarcoY', 0) * SYMBOL_SIZE);

	// ── Máquina de fases del marco ───────────────────────────────────────────
	//   intro → frames 0..15 una vez, mientras el cluster se ilumina.
	//   loop  → 4..15 en bucle: es el estado de espera, dura lo que tarden en
	//           iluminarse TODOS los símbolos del cluster.
	//   outro → desde el frame en el que estaba hasta el 20, una sola vez. Se
	//           dispara con el `explosion` (el boing de salida de winPop) y al
	//           terminar apaga el marco.
	//
	// `AnimatedSprite` no sabe reproducir un sub-rango, así que cada fase le
	// pasa un SLICE distinto del array de texturas y `{#key}` lo remonta para
	// que arranque en el frame 0 de ese slice. Por eso se usa `AnimatedSprite`
	// directo y no `SpriteSheet`, que resuelve las texturas por `key` y no deja
	// recortarlas.
	// Se inicializa con el frame COMPARTIDO, no con el inicio del bucle: si este
	// componente nace ya en `explosion` (tumble board), la salida tiene que
	// retomar donde lo dejaron las celdas del board principal.
	let marcoOutroStart = $state(marcoLoopFrame);
	const marcoSlice = $derived(
		marcoPhase === 'intro'
			? marcoTextures.slice(0, MARCO_INTRO_END + 1)
			: marcoPhase === 'loop'
				? marcoTextures.slice(MARCO_LOOP_START, MARCO_INTRO_END + 1)
				: marcoTextures.slice(marcoOutroStart, MARCO_LAST_FRAME + 1),
	);

	// La SALIDA se reproduce a la velocidad que haga falta para entrar en la
	// ventana del boing, en vez de a los 24 fps fijos de la entrada.
	//
	// Es lo que hacía que el marco nunca llegara al frame 18: `tumbleBoardExplode`
	// espera el pop y enseguida `tumbleBoardRemoveExploded` DESMONTA el símbolo,
	// así que el marco se destruye a los ~980 ms (WIN_POP_TOTAL_MS). A 24 fps,
	// arrancando en el frame 4, en ese tiempo apenas pasaban ~11 frames y la
	// animación se cortaba a mitad de camino.
	//
	// Atándola al total del pop el cierre cae SIEMPRE junto con el símbolo, sin
	// importar en qué frame del bucle lo agarre el boing.
	//
	// El total es POR SÍMBOLO (`getWinPopTotalMs`) y no la constante global: los
	// especiales cuelgan 200ms más en el boing, así que su marco tiene que ir
	// proporcionalmente más lento o cerraría en el 18 antes de que el ícono
	// termine de irse.
	const winPopTotalMs = $derived(getWinPopTotalMs({ symbolInfo: props.symbolInfo }));
	const marcoOutroSpeed = $derived(
		(MARCO_LAST_FRAME + 1 - marcoOutroStart) / (winPopTotalMs / 1000) / 60,
	);

	// El frame del bucle es COMPARTIDO entre instancias (ver el `<script
	// module>`): la presentación del cluster corre en el board principal y el
	// boing en el TUMBLE board, que monta componentes nuevos. Sin ese puente el
	// marco del tumble arrancaría su salida desde el frame 4 en vez de "desde
	// donde estaba". Todos los marcos arrancan a la vez —
	// `boardWithAnimateSymbols` pone en `win` a TODO el cluster de una, la
	// cascada solo escalona el GLOW — así que un único contador los describe a
	// todos y además los hace salir sincronizados.
	$effect(() => {
		const state = props.symbolState;
		if (state === 'explosion') {
			untrack(() => {
				if (marcoPhase === 'intro' || marcoPhase === 'loop') {
					marcoOutroStart = marcoLoopFrame;
					marcoPhase = 'outro';
				}
			});
		} else if (state !== 'win' && state !== 'postWinStatic') {
			// Vuelta a reposo (nuevo spin): el componente del board principal NO
			// se remonta entre rondas, así que hay que rearmar la secuencia.
			untrack(() => {
				marcoPhase = 'intro';
			});
		}
	});

	// POP de aparición SOLO para WILD y SCATTER (resaltan al caer). Bounce de
	// escala al montar el símbolo (~250ms). Premium/H4 no popea.
	let pop = $state(1);
	onMount(() => {
		const k = props.symbolInfo.assetKey;
		if (k !== 'sym_w' && k !== 'sym_s') return;
		const seq = [0.55, 0.9, 1.18, 1.06, 1.0];
		let i = 0;
		const id = setInterval(() => {
			pop = seq[i];
			i += 1;
			if (i >= seq.length) {
				pop = 1;
				clearInterval(id);
			}
		}, 45);
		return () => clearInterval(id);
	});
</script>

{#if marcoOn}
	<!-- MARCO POR ENCIMA del símbolo (zIndex 1 · pedido de dirección). Hermano
	     de las tres ramas de render, no hijo: pertenece a la CELDA, así que no
	     hereda el nudge ni el tamaño del ícono — lleva sus propios tres diales.

	     Adentro hay DOS marcos distintos: el de VICTORIA (máquina de fases +
	     `{#key}`, que remonta el AnimatedSprite en cada cambio para que arranque
	     en el frame 0 del slice nuevo) y el de ANTICIPACIÓN (un frame suelto
	     movido por el reloj compartido). Ver el `{#if}` de abajo.

	     Lo que SÍ hereda son las DOS transformaciones del ícono, multiplicadas:
	       · `flashScale` — el golpe de `winFlash` (0.85 → 1.15) que da el
	         símbolo al ILUMINARSE, cuando le llega su turno en la cascada.
	       · `winScale` / `winRotation` — el boing de `winPop` que lo encoge,
	         gira y desvanece al DESAPARECER.
	     Sin esto el marco quedaba clavado mientras el ícono respiraba y después
	     se iba. En reposo los tres tweens valen 1, 1 y 0, así que la entrada y
	     el bucle no se ven afectados. Los 3 animados (W/S/KASH) reciben winPop
	     desde el 10-09 —su marco boinguea con ellos, más lento— pero NO winFlash,
	     así que su `flashScale` queda en 1. -->
	<Container
		x={marcoX}
		y={marcoY}
		zIndex={1}
		scale={winScale * flashScale}
		rotation={winRotation}
		alpha={marcoAlpha}
	>
		{#if marcoIsAnticipation}
			<!-- ANTICIPACIÓN: un frame SUELTO, el que dicte el reloj compartido
			     (`antMarcoFrame`). `BaseSprite` y no `AnimatedSprite` porque acá
			     no hay reproducción propia que mantener — la animación la marca
			     el reloj, y así la celda que entra girando por arriba aparece en
			     EL MISMO frame que sus vecinas en vez de rearrancar su entrada.
			     Tampoco toca `marcoLoopFrame`: ese contador es del marco de
			     victoria (lo lee la salida del tumble board para retomar donde
			     lo dejó la presentación del cluster) y un marco de anticipación
			     —que nunca tiene salida, se desmonta con el reveal— no tiene por
			     qué moverlo y desincronizar el boing del win siguiente. -->
			<BaseSprite
				anchor={0.5}
				texture={antMarcoTexture}
				width={marcoSide}
				height={marcoSide}
			/>
		{:else}
			{#key marcoPhase}
				<AnimatedSprite
					anchor={0.5}
					textures={marcoSlice}
					width={marcoSide}
					height={marcoSide}
					animationSpeed={marcoPhase === 'outro' ? marcoOutroSpeed : MARCO_ANIM_SPEED}
					loop={marcoPhase === 'loop'}
					play
					onFrameChange={(frame: number) => {
						// Solo el bucle publica el frame compartido: es el que hay
						// que retomar cuando arranque la salida.
						if (marcoPhase === 'loop') marcoLoopFrame = MARCO_LOOP_START + frame;
					}}
					onComplete={() => {
						// intro → bucle de espera · salida → apagar (destruye el nodo)
						if (marcoPhase === 'intro') marcoPhase = 'loop';
						else if (marcoPhase === 'outro') marcoPhase = 'done';
					}}
				/>
			{/key}
		{/if}
	</Container>
{/if}

{#if isWireframe}
	<Container x={cx} y={cy} zIndex={0} scale={winScale} rotation={winRotation} alpha={cellAlpha}>
		<!-- filled tile -->
		<Rectangle
			x={-w / 2}
			y={-h / 2}
			width={w}
			height={h}
			backgroundColor={colorOf(props.rawSymbol)}
			alpha={0.18}
		/>
		<!-- border -->
		<Rectangle x={-w / 2} y={-h / 2} width={w} height={2} backgroundColor={colorOf(props.rawSymbol)} />
		<Rectangle x={-w / 2} y={h / 2 - 2} width={w} height={2} backgroundColor={colorOf(props.rawSymbol)} />
		<Rectangle x={-w / 2} y={-h / 2} width={2} height={h} backgroundColor={colorOf(props.rawSymbol)} />
		<Rectangle x={w / 2 - 2} y={-h / 2} width={2} height={h} backgroundColor={colorOf(props.rawSymbol)} />
		<!-- label -->
		<Text
			text={labelOf(props.rawSymbol)}
			anchor={{ x: 0.5, y: 0.5 }}
			style={{
				fill: colorOf(props.rawSymbol),
				fontSize: SYMBOL_SIZE * 0.36,
				fontWeight: '900',
				letterSpacing: 1,
			}}
		/>
	</Container>
{:else if specialReady}
	<!-- Icono especial animado (disco + llamas + grafiti). El pop va en el
	     SCALE del Container wrapper — NUNCA en el width del SpriteSheet: bindear
	     el width a un valor que cambia FRENA la animación (bug: wild/scatter
	     quedaban estáticos). El width del sheet queda constante y sí anima. -->
	<!-- `sortableChildren` + `zIndex` explícito: el orden de las etiquetas NO
	     alcanza. El brillo monta al ENTRAR en `win`, o sea DESPUÉS del clip
	     base, y `addToParent` hace `addChild`, que APENDEA — sin z-index el
	     glow terminaría dibujado ENCIMA del ícono, justo al revés de lo que
	     pide la jerarquía. Con estos dos valores el reparto es por profundidad
	     declarada y no por orden de montaje. -->
	<!-- BOING DE SALIDA también en W, S y H4 (drop 10-09).
	     `winScale`/`winRotation` son el pop de `winPop`, que desde este drop SÍ
	     corre en los tres especiales — con el paso 2 estirado 200ms para que su
	     salida se lea distinta de la de los regulares (ver winPop.svelte.ts).
	     Se multiplica con el `pop` de aparición: los dos escalan el MISMO
	     Container y nunca coinciden en el tiempo (uno es al montar, el otro al
	     explotar), así que el producto es siempre uno de los dos.
	     Lo que sigue afuera es `flashScale` (el golpe de winFlash): la cascada
	     de brillo la resuelven con su clip `_luz`, y `hasOwnClip()` los sigue
	     sacando del filtro de `playWinFlash`. -->
	<Container
		x={cx}
		y={cy}
		zIndex={0}
		scale={pop * winScale}
		rotation={winRotation}
		alpha={cellAlpha}
		sortableChildren={true}
	>
		{#if specialLuzReady && specialLuzAlpha > 0}
			<!-- ILUMINACIÓN DE VICTORIA del especial (drop 09-09). Misma
			     jerarquía que la carta `_luz` de los 10 regulares: va PRIMERA =
			     DETRÁS del clip base, que se dibuja encima y queda nítido
			     mientras el glow sangra alrededor de la silueta.
			     Comparte `width`/`height`/`x`/`y` con el clip base a propósito:
			     los dos sheets salen del mismo canvas 256² con el personaje en
			     la misma posición, así que la misma geometría ES el registro
			     exacto (ver la nota de `luzKey` en ANIM_SPECIAL).
			     El montaje ocurre al entrar en `win` y AnimatedSprite arranca
			     con gotoAndPlay(0), así que el clip de luz empieza en su frame 0
			     en el mismo instante que la animación de victoria. -->
			<SpriteSheet
				anchor={0.5}
				zIndex={antLuzOnTop ? 2 : 0}
				alpha={specialLuzAlpha}
				blendMode={antLuzOnTop ? 'add' : 'normal'}
				x={specialOffsetX}
				y={specialOffsetY}
				key={special.luzKey}
				width={specialW}
				height={specialH}
				animationSpeed={SPECIAL_ANIM_SPEED}
				loop
				play
			/>
		{/if}
		<SpriteSheet
			anchor={0.5}
			zIndex={1}
			x={specialOffsetX}
			y={specialOffsetY}
			key={special.key}
			width={specialW}
			height={specialH}
			animationSpeed={SPECIAL_ANIM_SPEED}
			loop
			play
		/>
	</Container>
{:else}
	<!-- Mismo `sortableChildren` que en la rama del especial y por el mismo
	     motivo: la carta `_luz` monta al arrancar la cascada de victoria, o sea
	     DESPUÉS del ícono, y `addChild` apendea. Sin z-index explícito el
	     "brillo trasero" se dibujaba adelante y tapaba el boing que dice
	     acompañar (se ve solo con `winFlash` activo — sin secuencia
	     `glowReplacesIcon` desmonta el ícono y el solape no llega a existir). -->
	<Container
		x={cx}
		y={cy}
		zIndex={0}
		scale={winScale}
		rotation={winRotation}
		alpha={cellAlpha}
		sortableChildren={true}
	>
		{#if luzReady && luzShowAlpha > 0}
			<!-- BRILLO TRASERO: la carta iluminada del kit (marco + glow
			     horneado) va DETRÁS del ícono (zIndex 0), con su propio alpha y
			     SIN escala — el boing es del ícono, no del halo. -->
			<Sprite
				anchor={0.5}
				zIndex={0}
				key={luzKey}
				width={luzW}
				height={luzH}
				alpha={luzShowAlpha}
			/>
		{/if}
		{#if !glowReplacesIcon && hasStatic}
			<!-- SPRITE PRINCIPAL en su propio Container: acá y solo acá vive la
			     escala del boing (0.85 → 1.15). Se omite en los símbolos sin
			     estático (ver STATIC_LESS): su clip preloaded ya cubre el hueco. -->
			<Container zIndex={1} scale={flashScale}>
				<Sprite anchor={0.5} key={props.symbolInfo.assetKey} width={w} height={h} />
				{#if antAddAlpha > 0}
					<!-- Respaldo de anticipación sin `_luz`: copia aditiva del ícono.
					     Va DESPUÉS del sprite base (addChild apendea) para quedar
					     encima, y comparte width/height/anchor para no desregistrar. -->
					<Sprite
						anchor={0.5}
						key={props.symbolInfo.assetKey}
						width={w}
						height={h}
						blendMode="add"
						alpha={antAddAlpha}
					/>
				{/if}
			</Container>
		{/if}
	</Container>
{/if}
