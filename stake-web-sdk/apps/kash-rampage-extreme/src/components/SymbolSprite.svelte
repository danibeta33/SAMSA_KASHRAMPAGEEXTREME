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
	import { stateWinHighlight } from '../game/stateWinHighlight.svelte';

	type Props = {
		x?: number;
		y?: number;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		symbolState?: SymbolState;
		rawSymbol?: RawSymbol;
		oncomplete?: () => void;
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
	const w = $derived(SYMBOL_SIZE * props.symbolInfo.sizeRatios.width * stateUiTweak.symScale);
	const h = $derived(SYMBOL_SIZE * props.symbolInfo.sizeRatios.height * stateUiTweak.symScale);

	// Iconos especiales ANIMADOS: W (bate WILD), S (barra SCATTER), H4 (grafiti
	// KASH PREMIUM). El static key del math (sym_w/sym_s/sym_h4) se mapea al
	// spritesheet del equipo. aspect = w/h del frame recortado — se respeta para
	// que las llamas/disco no se estiren. Loop a 10fps.
	const ANIM_SPECIAL: Record<string, { key: string; aspect: number }> = {
		// TODO-KRE (F3 arte): anim_sym_wild/anim_sym_scatter siguen con los
		// colores KS1 (llamas cyan/lima) y pisarían los estáticos nuevos del kit
		// 25-08 (bate en llamas rojas / barra SCATTER roja) al cargar. Vuelven
		// cuando el equipo entregue los spritesheets recoloreados.
		// sym_w: { key: 'anim_sym_wild', aspect: 170 / 202 },
		// sym_s: { key: 'anim_sym_scatter', aspect: 173 / 254 },
		// sym_h4 (26-08): anim_sym_premium es el grafiti KS1 violeta y pisaría
		// el stand-in Dinero del kit ICONS PNG (pedido: solo iconos de Juanda).
		// Vuelve cuando llegue el grafiti KASH recoloreado + su anim.
		// sym_h4: { key: 'anim_sym_premium', aspect: 183 / 193 },
	};
	const appContext = getContextApp();
	const special = $derived(ANIM_SPECIAL[props.symbolInfo.assetKey]);
	// Solo animar cuando el sheet ya cargó (no preload); si no, cae al estático.
	const specialReady = $derived(
		!!special &&
			!!appContext.stateApp.loadedAssets?.[
				special.key as keyof typeof appContext.stateApp.loadedAssets
			],
	);
	// Caja uniforme para los 3 especiales (destacan sobre los regulares); el
	// lado mayor del arte ocupa `box`, el menor se deriva del aspect.
	const specialBox = $derived(SYMBOL_SIZE * 0.98 * stateUiTweak.symScale);
	const specialW = $derived(
		special ? (special.aspect >= 1 ? specialBox : specialBox * special.aspect) : 0,
	);
	const specialH = $derived(
		special ? (special.aspect >= 1 ? specialBox / special.aspect : specialBox) : 0,
	);

	// Resalte de cluster ganador (26-08): la carta ILUMINADA del kit es el
	// estado de win — sin halo lima (pedido: "quita los cuadros verdes, ya
	// tenemos las versiones de luz"). Mientras el highlight global está
	// activo, el resto del board se atenúa para que salten.
	const isWinning = $derived(
		props.symbolState === 'win' || props.symbolState === 'postWinStatic',
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
	<Container x={props.x} y={props.y}>
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
	<Container x={props.x} y={props.y} scale={pop} alpha={dimmed ? 0.3 : 1}>
		<SpriteSheet
			anchor={0.5}
			key={special.key}
			width={specialW}
			height={specialH}
			animationSpeed={10 / 60}
			loop
			play
		/>
	</Container>
{:else}
	<Container x={props.x} y={props.y} alpha={dimmed ? 0.3 : 1}>
		{#if isWinning && luzReady}
			<!-- Carta iluminada del kit: trae su propio marco + glow — es TODO
			     el resalte del cluster. -->
			<Sprite anchor={0.5} key={luzKey} width={luzW} height={luzH} />
		{:else}
			<Sprite anchor={0.5} key={props.symbolInfo.assetKey} width={w} height={h} />
		{/if}
	</Container>
{/if}
