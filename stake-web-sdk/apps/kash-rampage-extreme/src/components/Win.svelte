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

	// ── Reloj del clip de MAX ───────────────────────────────────────────
	// El cartel de MAX corre a su velocidad de autoría (30fps) y se congela en
	// el último frame con el arte a tamaño completo — ver el bloque de
	// velocidad más abajo. Esas dos constantes viven ACÁ arriba porque el
	// count-up del tier se mide contra ellas.
	const MAX_FPS = 30;
	// Medido sobre los `spriteSourceSize` del sheet: 0-4 es la entrada, 5-42 el
	// sostén a sangre (1307×788), 43-45 ya encoge y 46-49 colapsa hacia el
	// centro antes de los 6 frames vacíos del final (50-55). Congelar en 42
	// deja el cartel entero.
	const MAX_HOLD_FRAME = 42;
	// Cuánto dura el MOVIMIENTO del cartel: desde el frame 0 hasta que se
	// congela. ≈1400ms. Es "lo que dura la animación" a ojo del jugador — los
	// frames posteriores no se ven.
	const MAX_CLIP_MS = Math.round((MAX_HOLD_FRAME / MAX_FPS) * 1000);

	// holdMs = pausa con el monto final en pantalla ANTES del fade-out.
	// bgDim en TODOS los tiers (leve en small) para que el lettering resalte.
	// shakeOnHit + flash = efectos de entrada SIN escalar el lettering.
	//
	// countUpDuration de MAX (07-09): estaba en 4000ms fijos, heredados de
	// cuando el cartel era un loop sin final propio. Con el clip nuevo el
	// cartel se planta a los ~1.4s y los números seguían subiendo 2.6s más,
	// solos — se leía como que la celebración se colgaba. Ahora se ata al
	// clip: el conteo termina UN SEGUNDO después de que el cartel se planta.
	// Atado y no hardcodeado para que un re-drop con otro largo (o un cambio
	// de MAX_FPS) reajuste el conteo sin tocar este número.
	const MAX_COUNT_UP_TAIL_MS = 1000;
	// holdMs de MAX (07-09): estaba en 3800ms, la pausa QUIETA entre el final
	// del conteo y el fade-out — con el cartel ya congelado y el monto ya en su
	// valor final, ahí no se mueve nada en pantalla. Al acortar el conteo esa
	// pausa quedó siendo la mitad del festejo. A esto hay que sumarle el
	// fade-out del FadeContainer (~400ms del Tween por defecto), así que 1000ms
	// acá son ~1.4s de imagen fija: alcanza para leer el monto sin que el
	// cartel se quede plantado.
	const MAX_HOLD_MS = 1000;
	const TIER_CONFIG: Record<Tier, TierConfig> = {
		small: { countUpDuration: 600, bgDim: 0.18, holdMs: 1500, shakeOnHit: 0, flashPeak: 0.25 },
		big: { countUpDuration: 1200, bgDim: 0.4, holdMs: 2200, shakeOnHit: 16, flashPeak: 0.4 },
		mega: { countUpDuration: 2000, bgDim: 0.55, holdMs: 2900, shakeOnHit: 22, flashPeak: 0.5 },
		max: {
			countUpDuration: MAX_CLIP_MS + MAX_COUNT_UP_TAIL_MS, // ≈2400ms
			bgDim: 0.72,
			holdMs: MAX_HOLD_MS,
			shakeOnHit: 30,
			flashPeak: 0.6,
		},
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
			// `play={show}` hace gotoAndPlay(0) en el sheet: el congelado del
			// tier max se levanta acá para que el clip arranque de nuevo.
			letteringHeld = false;
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
			// Belt del reset de winShow: si un winUpdate llegara sin winShow
			// previo (wins encadenados), el clip de max no debe seguir congelado
			// del festejo anterior.
			letteringHeld = false;
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
	// ⚠ Drop 04-09 / 07-09: los CUATRO tiers son ya TexturePacker TRIMMED.
	// PIXI le da a cada textura `orig` = el
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
		// canvas 1402×788 · arte 1402×788 en (0,0) — re-export 07-09 a mayor
		// resolución. Aunque el sheet viene trimmed frame a frame, la UNIÓN de
		// los 56 recortes es el canvas entero, así que arte y canvas coinciden:
		// fill 1 y centro al medio.
		max: {
			key: 'anim_win_max',
			aspect: 1402 / 788,
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
	// Los sheets de los drops 04-09 y 07-09 son clips CERRADOS: entran con
	// fade-in, se sostienen y se van con fade-out (el último frame es
	// transparente — medido: small 34→37, big 32→35, mega 51→53 y, desde el
	// 07-09, max 50→55 caen a 0 de cobertura).
	// Eso cambia dos cosas respecto de los sheets viejos:
	//   · NO pueden loopear (el cartel parpadearía al reencender el fade-in);
	//   · NO pueden quedarse en el último frame (quedaría vacío, con el monto
	//     flotando solo en pantalla).
	// La solución es calzar el clip a la ventana en la que el overlay está
	// visible (countUp + hold) para que su fade-out coincida con el del
	// overlay. El fps sale de la cantidad real de frames del sheet cargado,
	// así un re-drop con otro largo se acomoda solo sin tocar código.
	//
	// MAX es la EXCEPCIÓN (decisión del usuario 07-09): corre a 30fps fijos, su
	// velocidad de autoría. Estirarlo a la ventana lo dejaría en ~7fps y el
	// batido de partículas se vería a tirones. Pero a 30fps sus 56 frames duran
	// 1.87s y la ventana del tier es más larga, así que dejarlo llegar al final
	// del clip (6 frames vacíos) dejaría el monto solo en pantalla.
	//
	// La salida es CONGELAR el clip en el último frame con arte a tamaño
	// completo en vez de dejarlo correr hasta los frames vacíos: el cartel
	// entra a su velocidad real, se queda puesto el resto del festejo, y la
	// salida la hace el fade del FadeContainer (que es quien apaga el overlay
	// entero, lettering y monto a la vez). Congelar = animationSpeed 0; NO
	// `play=false`, que en AnimatedSprite hace gotoAndStop(0) y saltaría al
	// primer frame, que está casi vacío.
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
	// Ningún tier loopea ya: los cuatro sheets son clips cerrados.
	const letteringLoop = false;
	// MAX_FPS / MAX_HOLD_FRAME están declaradas arriba, junto a TIER_CONFIG:
	// el count-up del tier se mide contra ellas.
	let letteringHeld = $state(false);
	// Un ÚNICO cambio de estado por celebración (no uno por frame): en cuanto
	// el clip de max llega al frame de sostén, se congela y no se vuelve a
	// tocar hasta el próximo winShow.
	const onLetteringFrame = (frame: number) => {
		if (!letteringHeld && tier === 'max' && frame >= MAX_HOLD_FRAME) letteringHeld = true;
	};
	const letteringFps = $derived(
		tier === 'max'
			? MAX_FPS
			: !letteringFrames
				? 10
				: Math.min(30, Math.max(6, (letteringFrames * 1000) / letteringWindowMs)),
	);
	const letteringSpeed = $derived(letteringHeld ? 0 : letteringFps / 60);
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
					onFrameChange={onLetteringFrame}
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
