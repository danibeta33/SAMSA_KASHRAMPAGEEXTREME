<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// Tier-differentiated win celebration (wireframe, no Spine / no external
	// assets). The visual treatment escalates across small → big → mega → max,
	// driven by `winLevelData.alias` returned in the setWin book event.
	//
	// CRITICAL: `winUpdate` must always resolve, otherwise
	// bookEventHandlerMap.setWin hangs. All async paths below preserve that.
	import { onDestroy, onMount } from 'svelte';
	import { Container, Rectangle, SpriteSheet, Text, getContextApp } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { moneyWinFromBookAmount } from '../game/money';

	// WinLevelData ya viene importado en el module script de arriba.
	import type { WinLevelAlias } from '../game/winLevelMap';
	import { getContext } from '../game/context';
	import { triggerBoardShake } from '../game/boardShake.svelte';
	import { enterCelebration, exitCelebration } from '../game/celebration.svelte';

	const context = getContext();

	let show = $state(false);
	let displayAmount = $state(0);
	let winLevelData = $state<WinLevelData>();

	// Animation state — drive Rectangle alphas, panel scale, max-win text
	// pulse without using svelte/motion Tween (intervals are deterministic
	// and don't fight with the async flow / FadeContainer's own Tween).
	let bgDimAlpha = $state(0);
	// Flash blanco de entrada (efecto, SIN escalar el lettering — el usuario no
	// quiere que crezca/achique, solo que se vea la animación + efectos).
	let flashAlpha = $state(0);

	// Track all active intervals/timeouts so winHide / unmount can cancel
	// them and we don't leak loops between rounds.
	const timers: ReturnType<typeof setTimeout>[] = [];
	const intervals: ReturnType<typeof setInterval>[] = [];

	const clearAllTimers = () => {
		while (timers.length) clearTimeout(timers.pop()!);
		while (intervals.length) clearInterval(intervals.pop()!);
		bgDimAlpha = 0;
		flashAlpha = 0;
	};

	type Tier = 'small' | 'big' | 'mega' | 'max';

	// Map the 10-level winLevelMap aliases onto 4 visual tiers. Anything
	// below 'big' counts as 'small' (no celebration choreography needed).
	// 'max' es EXCLUSIVO del alias max (= win cap real 5000× según la math) —
	// review N2: mostrar MAX WIN en un epic (100×–cap) es engañoso.
	// Sin arte EPIC dedicado, las bandas se redistribuyen en los 3 carteles:
	//   BIG  15–50× (big + superwin — antes BIG cubría solo 15–30×)
	//   MEGA 50×–cap (mega + epic; epic además intensifica la presentación)
	//   MAX  solo el cap real
	const tierFromAlias = (alias: WinLevelAlias | undefined): Tier => {
		if (alias === 'max') return 'max';
		if (alias === 'epic' || alias === 'mega') return 'mega';
		if (alias === 'big' || alias === 'superwin') return 'big';
		return 'small';
	};

	type TierConfig = {
		countUpDuration: number;
		bgDim: number;
		holdMs: number;
		shakeOnHit: number; // 0 = sin shake; >0 = intensidad del golpe al entrar
		flashPeak: number; // alpha del flash blanco de entrada
	};

	// holdMs = pausa con el monto final en pantalla ANTES del fade-out.
	// bgDim en TODOS los tiers (leve en small) para que el lettering resalte.
	// shakeOnHit + flash = efectos de entrada SIN escalar el lettering.
	const TIER_CONFIG: Record<Tier, TierConfig> = {
		small: { countUpDuration: 600, bgDim: 0.18, holdMs: 1500, shakeOnHit: 0, flashPeak: 0.25 },
		big: { countUpDuration: 1200, bgDim: 0.4, holdMs: 2200, shakeOnHit: 16, flashPeak: 0.4 },
		mega: { countUpDuration: 2000, bgDim: 0.55, holdMs: 2900, shakeOnHit: 22, flashPeak: 0.5 },
		max: { countUpDuration: 4000, bgDim: 0.72, holdMs: 3800, shakeOnHit: 30, flashPeak: 0.6 },
	};

	// Los epic (100×–cap) usan el cartel MEGA pero con presentación
	// intensificada (a mitad de camino del MAX) — así el rango alto se
	// distingue sin necesitar arte propio. Se extrae a función porque la
	// ventana en pantalla (countUp + hold) ahora también decide el fps del
	// lettering: el handler y el render tienen que leer LA MISMA config.
	const cfgFor = (data: WinLevelData | undefined): TierConfig =>
		data?.alias === 'epic'
			? { ...TIER_CONFIG.mega, countUpDuration: 3000, holdMs: 3400, shakeOnHit: 26, bgDim: 0.63 }
			: TIER_CONFIG[tierFromAlias(data?.alias)];

	const COUNT_UP_STEPS = 24;

	const runCountUp = async (target: number, duration: number) => {
		displayAmount = 0;
		const stepMs = duration / COUNT_UP_STEPS;
		for (let i = 1; i <= COUNT_UP_STEPS; i += 1) {
			await new Promise((r) => setTimeout(r, stepMs));
			// Quadratic ease-out so big tiers feel cinematic, not linear.
			const t = i / COUNT_UP_STEPS;
			const eased = 1 - (1 - t) * (1 - t);
			displayAmount = Math.round(target * eased);
		}
		displayAmount = target;
	};

	// Flash blanco de entrada (efecto sin escalar). Sube rápido y decae.
	const startFlash = (peak: number) => {
		const seq = [peak, peak * 0.7, peak * 0.4, peak * 0.2, 0];
		let i = 0;
		flashAlpha = peak;
		const id = setInterval(() => {
			flashAlpha = seq[i];
			i += 1;
			if (i >= seq.length) clearInterval(id);
		}, 55);
		intervals.push(id);
	};

	context.eventEmitter.subscribeOnMount({
		winShow: () => {
			show = true;
			enterCelebration();
		},
		winHide: () => {
			// NO resetear displayAmount acá: FadeContainer sigue mostrando el
			// contenido durante el fade-out y el monto saltaría a $0.00 en
			// pantalla (se veía como corte seco). Se resetea en el próximo
			// count-up.
			show = false;
			clearAllTimers();
			exitCelebration();
		},
		winUpdate: async (emitterEvent) => {
			winLevelData = emitterEvent.winLevelData;
			const cfg = cfgFor(winLevelData);

			// Reset any prior animation state, then apply tier visuals.
			clearAllTimers();
			bgDimAlpha = cfg.bgDim;
			// Efectos de entrada SIN escalar: golpe al board + flash blanco.
			if (cfg.shakeOnHit) triggerBoardShake(cfg.shakeOnHit, 500);
			startFlash(cfg.flashPeak);

			await runCountUp(emitterEvent.amount, cfg.countUpDuration);

			// Hold the final frame so the player reads the number before the
			// fade-out kicks in — escalado por tier via cfg.holdMs.
			await new Promise<void>((resolve) => {
				const t = setTimeout(resolve, cfg.holdMs);
				timers.push(t);
			});
		},
	});

	onDestroy(clearAllTimers);

	// QA hook (solo DEV): disparar una celebración sin girar. En consola:
	// window.__win(amount, 'max'|'mega'|'big'|'small'). Se auto-oculta a los 6s.
	onMount(() => {
		if (!import.meta.env.DEV) return;
		(globalThis as unknown as { __win?: (a: number, alias: WinLevelAlias) => void }).__win = (
			amount,
			alias,
		) => {
			context.eventEmitter.broadcast({ type: 'winShow' });
			context.eventEmitter.broadcast({
				type: 'winUpdate',
				amount,
				winLevelData: { alias } as WinLevelData,
			});
			setTimeout(() => context.eventEmitter.broadcast({ type: 'winHide' }), 6000);
		};
	});

	const sizes = $derived(context.stateLayoutDerived.canvasSizes());

	const tier = $derived(tierFromAlias(winLevelData?.alias));

	// Lettering ANIMADO per tier.
	//
	// ⚠ Drop 04-09: small/big/mega son TexturePacker TRIMMED (max sigue siendo
	// el sheet viejo, sin recortar). PIXI le da a cada textura `orig` = el
	// canvas COMPLETO y re-inyecta el recorte al pintar, así que el width/height
	// del SpriteSheet dimensiona EL CANVAS, no el arte — y el arte no está
	// centrado en ese canvas (big cae en x=0.526, small en y=0.530). Por eso
	// cada tier trae la caja del arte medida del .json (unión de los
	// `spriteSourceSize` de todos los frames, ignorando el frame vacío de 3×3
	// que TexturePacker mete al inicio de small/big):
	//   aspect = ancho/alto del ARTE · fill = fracción del canvas que ocupa ·
	//   center = dónde cae su centro dentro del canvas.
	// `meta.scale` (0.82/0.67/0.42) no entra en la cuenta: PIXI lo aplica como
	// resolución y divide canvas y recorte por igual, así que las fracciones
	// de arriba son invariantes.
	type Lettering = {
		key: string;
		aspect: number;
		fill: { w: number; h: number };
		center: { x: number; y: number };
	};
	const LETTERING: Record<Tier, Lettering> = {
		// canvas 1574×886 · arte 1236×584 en (153,178)
		small: {
			key: 'anim_win_small',
			aspect: 1236 / 584,
			fill: { w: 1236 / 1574, h: 584 / 886 },
			center: { x: 771 / 1574, y: 470 / 886 },
		},
		// canvas 1286×763 · arte 1020×754 en (166,9) — corrido a la derecha
		big: {
			key: 'anim_win_big',
			aspect: 1020 / 754,
			fill: { w: 1020 / 1286, h: 754 / 763 },
			center: { x: 676 / 1286, y: 386 / 763 },
		},
		// canvas 806×454 · arte 726×454 en (47,0) — a sangre en vertical
		mega: {
			key: 'anim_win_mega',
			aspect: 726 / 454,
			fill: { w: 726 / 806, h: 454 / 454 },
			center: { x: 410 / 806, y: 227 / 454 },
		},
		// sheet viejo SIN recortar: el canvas ES el arte
		max: {
			key: 'anim_win_max',
			aspect: 1024 / 576,
			fill: { w: 1, h: 1 },
			center: { x: 0.5, y: 0.5 },
		},
	};
	const lettering = $derived(LETTERING[tier]);
	// Tamaño por tier — mega/max bastante más grandes (pedido del usuario).
	const TIER_SCALE: Record<Tier, number> = { small: 0.72, big: 0.92, mega: 1.14, max: 1.28 };
	// La medida de referencia es el ancho del ARTE; el canvas se infla desde
	// ahí dividiendo por el fill, y se corre para que el centro del arte (no el
	// del canvas) quede en el medio de la pantalla.
	const letteringArtW = $derived(Math.min(sizes.width * 0.66, 880) * TIER_SCALE[tier]);
	const letteringArtH = $derived(letteringArtW / lettering.aspect);
	const letteringSheetW = $derived(letteringArtW / lettering.fill.w);
	const letteringSheetH = $derived(letteringArtH / lettering.fill.h);
	const letteringOffsetX = $derived(-letteringSheetW * (lettering.center.x - 0.5));
	// El -6% es el empujón de siempre para dejarle aire al monto abajo.
	const letteringOffsetY = $derived(
		-letteringSheetH * (lettering.center.y - 0.5) - letteringArtH * 0.06,
	);
	const amountSize = $derived(Math.min(sizes.width * 0.06, 78));

	// ── Velocidad de reproducción ────────────────────────────────────────
	// Los sheets del drop 04-09 son clips CERRADOS: entran con fade-in, se
	// sostienen y se van con fade-out (el último frame es transparente —
	// medido: small 34→37, big 32→35, mega 51→53 caen a 0 de cobertura).
	// Eso cambia dos cosas respecto de los sheets viejos:
	//   · NO pueden loopear (el cartel parpadearía al reencender el fade-in);
	//   · NO pueden quedarse en el último frame (quedaría vacío, con el monto
	//     flotando solo en pantalla).
	// La solución es calzar el clip a la ventana en la que el overlay está
	// visible (countUp + hold) para que su fade-out coincida con el del
	// overlay. El fps sale de la cantidad real de frames del sheet cargado,
	// así un re-drop con otro largo se acomoda solo sin tocar código.
	// MAX queda como estaba (sheet viejo, 22 frames en loop a 10fps).
	const appContext = getContextApp();
	const letteringFrames = $derived(
		(
			appContext.stateApp.loadedAssets?.[
				lettering.key as keyof typeof appContext.stateApp.loadedAssets
			] as unknown as unknown[] | undefined
		)?.length ?? 0,
	);
	// Sin preload: hasta que el sheet no está, no se dibuja (evita el
	// console.error de SpriteSheet por key faltante).
	const letteringReady = $derived(letteringFrames > 0);
	const activeCfg = $derived(cfgFor(winLevelData));
	const letteringWindowMs = $derived(activeCfg.countUpDuration + activeCfg.holdMs);
	const letteringLoop = $derived(tier === 'max');
	const letteringFps = $derived(
		letteringLoop || !letteringFrames
			? 10
			: Math.min(30, Math.max(8, (letteringFrames * 1000) / letteringWindowMs)),
	);
	const letteringSpeed = $derived(letteringFps / 60);
</script>

<FadeContainer {show}>
	{#if winLevelData}
		{#if bgDimAlpha > 0}
			<Rectangle {...sizes} backgroundColor={0x0d0c0a} alpha={bgDimAlpha} />
		{/if}
		<!-- SIN scale: el usuario no quiere que el lettering crezca/achique.
		     Los efectos son bgDim (foco) + shake del board + flash blanco. -->
		<Container x={sizes.width / 2} y={sizes.height / 2}>
			{#if letteringReady}
				<SpriteSheet
					key={lettering.key}
					anchor={0.5}
					x={letteringOffsetX}
					y={letteringOffsetY}
					width={letteringSheetW}
					height={letteringSheetH}
					animationSpeed={letteringSpeed}
					loop={letteringLoop}
					play={show}
				/>
			{/if}
			<!-- Amount — SIN caja. Look "sticker": halo lima difuso detrás +
			     texto con gradiente lima→blanco, stroke grueso oscuro y drop
			     shadow marcado. Resalta sin recuadro. -->
			{@const amtText = moneyWinFromBookAmount(displayAmount)}
			{@const amtY = letteringArtH * 0.38}
			<!-- halo lima (copia difusa detrás) -->
			<Text
				text={amtText}
				anchor={{ x: 0.5, y: 0.5 }}
				y={amtY}
				alpha={0.55}
				scale={1.06}
				style={{ fill: 0xf6ef1b, fontSize: amountSize, fontWeight: '900', letterSpacing: 3 }}
			/>
			<Text
				text={amtText}
				anchor={{ x: 0.5, y: 0.5 }}
				y={amtY}
				style={{
					fill: 0xffe96b,
					fontSize: amountSize,
					fontWeight: '900',
					letterSpacing: 3,
					stroke: { color: 0x0b0a08, width: 11 },
					dropShadow: {
						color: 0x000000,
						alpha: 0.9,
						blur: 9,
						distance: 8,
						angle: Math.PI / 2,
					},
				}}
			/>
		</Container>
		<!-- Flash blanco de entrada (efecto de impacto, sobre todo). -->
		{#if flashAlpha > 0.01}
			<Rectangle {...sizes} backgroundColor={0xffffff} alpha={flashAlpha} />
		{/if}
	{/if}
</FadeContainer>
