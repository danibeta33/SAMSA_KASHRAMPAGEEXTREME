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
	import { onMount } from 'svelte';
	import { Container, Rectangle, Sprite, SpriteSheet, Text, getContextApp } from 'pixi-svelte';

	import { SYMBOL_SIZE } from '../game/constants';
	import { getSymbolInfo } from '../game/utils';
	import type { RawSymbol, SymbolState } from '../game/types';
	// Multiplicador global de tamaño de símbolos, tweakeable en vivo (UiLab).
	import { stateUiTweak } from '../game/stateUiTweak.svelte';
	// Multiplicador extra SOLO para los especiales (slider `specialScale`).
	import { stateTweak } from '../game/stateTweak.svelte';
	import { stateWinHighlight } from '../game/stateWinHighlight.svelte';
	import {
		SELF_ANIMATED_ASSET_KEYS,
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

	// Escala extra de los ESPECIALES (W wild, S scatter, H4 premium). Se
	// engancha a `SELF_ANIMATED_ASSET_KEYS` en vez de a `ANIM_SPECIAL` por dos
	// razones: esa lista es la definición canónica de "especial" del juego (la
	// misma que usa winPop para saltear el pop), y está declarada arriba — el
	// mapa `ANIM_SPECIAL` recién existe más abajo y `w`/`h` se calculan acá.
	//
	// Se aplica a los DOS caminos de render (el clip animado y el sprite
	// estático de respaldo). Si solo escalara el animado, W y S —que van sin
	// preload— darían un salto de tamaño en el momento en que su sheet termina
	// de bajar y reemplaza al estático.
	const SPECIAL_KEYS = new Set<string>(SELF_ANIMATED_ASSET_KEYS);
	const specialMult = $derived(
		SPECIAL_KEYS.has(props.symbolInfo.assetKey) ? stateTweak.specialScale : 1,
	);

	const w = $derived(
		SYMBOL_SIZE * props.symbolInfo.sizeRatios.width * stateUiTweak.symScale * specialMult,
	);
	const h = $derived(
		SYMBOL_SIZE * props.symbolInfo.sizeRatios.height * stateUiTweak.symScale * specialMult,
	);

	// Iconos especiales ANIMADOS: W (bate WILD), S (barra SCATTER), H4 (grafiti
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
	type AnimSpecial = {
		key: string;
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
			aspect: 169 / 205,
			fill: { w: 169 / 256, h: 205 / 256 },
			center: { x: 125.5 / 256, y: 153.5 / 256 },
			box: 0.9, // = sizeRatios de sym_w
		},
		// barra SCATTER — arte 255×254 a sangre, prácticamente centrado
		sym_s: {
			key: 'anim_sym_scatter',
			aspect: 255 / 254,
			fill: { w: 255 / 256, h: 254 / 256 },
			center: { x: 127.5 / 256, y: 127 / 256 },
			box: 0.95, // = sizeRatios de sym_s
		},
		// KASH premium — fajo de billetes (drop 08-09: el clip `Special_Billetes`
		// reemplazó al `Special_Graffiti` bajo el mismo nombre de archivo). Arte
		// 256×248 casi a sangre y centrado, contra el grafiti viejo que era
		// 182×191 en (34,51) y colgaba abajo. Números medidos del .json con
		// `.scripts/repack_spritesheet.py --report`: si el sheet se vuelve a
		// re-exportar hay que volver a correrlo y pegar los valores que imprime.
		sym_h4: {
			key: 'anim_sym_premium',
			aspect: 1.032258,
			fill: { w: 1.0, h: 0.96875 },
			center: { x: 0.5, y: 0.503906 },
			box: 0.8, // = sizeRatios de sym_h4
		},
	};
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
	// Símbolos SIN sprite estático de respaldo: su .png se borró del registro
	// porque el clip animado es ahora la única representación (H4 / fajo, drop
	// 08-09 — `anim_sym_premium` va con `preload`, así que ya está en
	// `loadedAssets` antes del primer render del board).
	//
	// Esta guarda NO es defensa en profundidad opcional: sin ella la rama
	// `{:else}` pediría `<Sprite key="sym_h4">` sobre una clave inexistente y
	// PIXI escupiría "Sprite key not found" — el motivo #1 de rechazo del
	// `05-preflight-checklist.md`. Que hoy sea inalcanzable depende del orden de
	// carga; acá se vuelve una invariante del componente.
	const STATIC_LESS = new Set(['sym_h4']);
	const hasStatic = $derived(!STATIC_LESS.has(props.symbolInfo.assetKey));
	// Lado mayor del ARTE (no del canvas) en px de board; el menor sale del aspect.
	const specialSide = $derived(
		special ? SYMBOL_SIZE * special.box * stateUiTweak.symScale * specialMult : 0,
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
	// Iconos ILUMINADOS (kit 26-08): carta full-bleed con marco oscuro + glow
	// horneado que reemplaza al estático + halo lima durante win/postWinStatic.
	// Los 10 regulares tienen versión luz (h1/h4 desde el swap a stand-ins del
	// kit); w/s (y cualquier símbolo cuyo luz aún no cargó — van sin preload)
	// caen al halo de siempre.
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
		sym_h4: 'sym_h4_luz',
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

{#if isWireframe}
	<Container x={props.x} y={props.y} scale={winScale} rotation={winRotation}>
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
	<Container x={props.x} y={props.y} scale={pop * winScale} rotation={winRotation} alpha={dimmed ? 0.3 : 1}>
		<SpriteSheet
			anchor={0.5}
			x={specialOffsetX}
			y={specialOffsetY}
			key={special.key}
			width={specialW}
			height={specialH}
			animationSpeed={10 / 60}
			loop
			play
		/>
	</Container>
{:else}
	<Container x={props.x} y={props.y} scale={winScale} rotation={winRotation} alpha={dimmed ? 0.3 : 1}>
		{#if luzReady && glowAlpha > 0}
			<!-- BRILLO TRASERO: la carta iluminada del kit (marco + glow
			     horneado) va PRIMERA = detrás del ícono, con su propio alpha y
			     SIN escala — el boing es del ícono, no del halo. -->
			<Sprite anchor={0.5} key={luzKey} width={luzW} height={luzH} alpha={glowAlpha} />
		{/if}
		{#if !glowReplacesIcon && hasStatic}
			<!-- SPRITE PRINCIPAL en su propio Container: acá y solo acá vive la
			     escala del boing (0.85 → 1.15). Se omite en los símbolos sin
			     estático (ver STATIC_LESS): su clip preloaded ya cubre el hueco. -->
			<Container scale={flashScale}>
				<Sprite anchor={0.5} key={props.symbolInfo.assetKey} width={w} height={h} />
			</Container>
		{/if}
	</Container>
{/if}
