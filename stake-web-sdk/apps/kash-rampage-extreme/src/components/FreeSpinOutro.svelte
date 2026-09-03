<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// FS-outro overlay with tier-differentiated celebration. Mirrors the
	// approach in Win.svelte (small / big / mega / max) so the FS finale —
	// where 5000× max-win hits are surfaced — gets a cinematic treatment
	// instead of the previous flat countUp.
	//
	// CRITICAL: `freeSpinOutroCountUp` must always resolve, otherwise the
	// FS-end book event flow stalls. The await chain below preserves that
	// guarantee (the user-tap shortcut also resolves the same promise).
	import { onDestroy } from 'svelte';
	import { CanvasSizeRectangle, MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { FadeContainer } from 'components-pixi';
	import { Container, Rectangle, Sprite, SpriteSheet, Text } from 'pixi-svelte';
	import { moneyWinFromBookAmount } from '../game/money';

	import { getContext } from '../game/context';
	import { isWinCap, winToRoundCostRatio } from '../game/winRatio';
	import { enterCelebration, exitCelebration } from '../game/celebration.svelte';
	// WinLevelData ya viene importado en el module script de arriba.

	const context = getContext();

	let show = $state(true);
	let amount = $state(0);
	let displayAmount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});

	// Tier-driven visual state — drive alphas / scale via interval-backed
	// state so we don't fight FadeContainer's own Tween and don't depend
	// on svelte/motion (intervals are deterministic across HMR reloads).
	let panelScale = $state(1);
	let panelGlowAlpha = $state(0);
	let bgDimAlpha = $state(0.3); // baseline pink wash kept from prior look
	let maxWinTextAlpha = $state(1);
	let currentTier = $state<Tier>('small');

	const timers: ReturnType<typeof setTimeout>[] = [];
	const intervals: ReturnType<typeof setInterval>[] = [];

	const clearAllTimers = () => {
		while (timers.length) clearTimeout(timers.pop()!);
		while (intervals.length) clearInterval(intervals.pop()!);
		panelScale = 1;
		panelGlowAlpha = 0;
		bgDimAlpha = 0.3;
		maxWinTextAlpha = 1;
	};

	type Tier = 'small' | 'big' | 'mega' | 'max';

	type TierConfig = {
		countUpDuration: number;
		bgDim: number;
		panelGlow: number;
		pulse: boolean;
		showMaxLabel: boolean;
		holdMs: number;
	};

	const TIER_CONFIG: Record<Tier, TierConfig> = {
		small: { countUpDuration: 600, bgDim: 0.3, panelGlow: 0.0, pulse: false, showMaxLabel: false, holdMs: 700 },
		big: { countUpDuration: 1200, bgDim: 0.4, panelGlow: 0.5, pulse: false, showMaxLabel: false, holdMs: 1100 },
		mega: { countUpDuration: 2000, bgDim: 0.55, panelGlow: 0.7, pulse: true, showMaxLabel: false, holdMs: 1600 },
		max: { countUpDuration: 4000, bgDim: 0.7, panelGlow: 0.85, pulse: true, showMaxLabel: true, holdMs: 2400 },
	};

	const COUNT_UP_STEPS = 24;

	// Clasificación por ratio ganancia/costo de la ronda con las escalas
	// correctas (book units + costMultiplier del modo — ver winRatio.ts).
	// betCost() estaba en dólares y sin el multiplier de los buys: rompía el
	// tier con cualquier apuesta ≠ $1 y en bonus comprados.
	// MAX es EXCLUSIVO del win cap real (5000× la apuesta, isWinCap) — review
	// N2: el label MAX WIN aparecía desde 500× del costo y eso es engañoso.
	const tierFromRatio = (winAmount: number): Tier => {
		if (isWinCap(winAmount)) return 'max';
		const ratio = winToRoundCostRatio(winAmount);
		if (ratio >= 50) return 'mega';
		if (ratio >= 5) return 'big';
		return 'small';
	};

	const resolveTier = (_data: WinLevelData | undefined, winAmount: number): Tier => {
		// El payout MANDA: el tier sale del ratio contra el costo real de la
		// ronda (incluye el costMultiplier del buy). El alias del math
		// clasifica contra la apuesta base y en bonus comprados infla el tier
		// (mostraba MAX WIN para 0.4× del costo del bonus).
		return tierFromRatio(winAmount);
	};

	const runCountUp = async (target: number, duration: number) => {
		displayAmount = 0;
		const stepMs = duration / COUNT_UP_STEPS;
		for (let i = 1; i <= COUNT_UP_STEPS; i += 1) {
			await new Promise((r) => setTimeout(r, stepMs));
			// Quadratic ease-out so bigger tiers don't feel linear.
			const t = i / COUNT_UP_STEPS;
			const eased = 1 - (1 - t) * (1 - t);
			displayAmount = Math.round(target * eased);
		}
		displayAmount = target;
	};

	const startPulse = () => {
		// Panel breathes scale 1.0 → 1.05 on a 700ms cycle.
		let phase = 0;
		const id = setInterval(() => {
			phase = (phase + 1) % 2;
			panelScale = phase === 0 ? 1.05 : 1.0;
		}, 350);
		intervals.push(id);
	};

	const startMaxLabelPulse = () => {
		let phase = 0;
		const id = setInterval(() => {
			phase = (phase + 1) % 2;
			maxWinTextAlpha = phase === 0 ? 0.45 : 1;
		}, 280);
		intervals.push(id);
	};

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			enterCelebration();
		},
		freeSpinOutroHide: () => {
			show = false;
			clearAllTimers();
			exitCelebration();
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;

			const tier = resolveTier(winLevelData, amount);
			currentTier = tier;
			const cfg = TIER_CONFIG[tier];

			// Debug breadcrumb — verifies tier assignment in console without
			// needing to attach a debugger. DEV-only: consola de prod limpia.
			if (import.meta.env.DEV)
				console.debug(
					`[FreeSpinOutro] tier=${tier} amount=${amount} ratio=${winToRoundCostRatio(amount).toFixed(2)}x alias=${winLevelData?.alias ?? 'n/a'}`,
				);

			clearAllTimers();
			bgDimAlpha = cfg.bgDim; // sobre rect OSCURO ahora (no rosa), sin pulso

			await runCountUp(amount, cfg.countUpDuration);

			// Hold the final frame either until the tap-to-continue or until
			// the tier-specific hold elapses, whichever happens first.
			await new Promise<void>((resolve) => {
				oncomplete = resolve;
				const t = setTimeout(resolve, cfg.holdMs);
				timers.push(t);
			});
		},
	});

	onDestroy(clearAllTimers);

	const sizes = $derived(context.stateLayoutDerived.canvasSizes());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());
	// Panel del equipo (fs_win_panel, aspect 1400/684). "FREE SPINS TOTAL WIN"
	// y "TAP TO CONTINUE" vienen en el arte; overlay: lettering del tier + monto.
	const PANEL_ASPECT = 1400 / 684;
	const panelW = $derived(Math.min(sizes.width * 0.82, 940));
	const panelH = $derived(panelW / PANEL_ASPECT);

	// Glow palette — lime for big, hot pink for mega/max (matches Win.svelte).
	const glowColor = $derived(currentTier === 'big' ? 0xf6ef1b : 0xe02330);
	const glowSecondaryColor = 0xf6ef1b;

	// Letterings ANIMADOS — mismos spritesheets que Win.svelte, así el cierre
	// de FS lee igual que las celebraciones del base game.
	const LETTERING: Record<Tier, { key: string; aspect: number }> = {
		small: { key: 'anim_win_small', aspect: 300 / 145 },
		big: { key: 'anim_win_big', aspect: 1 },
		mega: { key: 'anim_win_mega', aspect: 1 },
		max: { key: 'anim_win_max', aspect: 1 },
	};
	const lettering = $derived(LETTERING[currentTier]);
	// Los tiers 1:1 traen el burst completo — más chicos que el lettering
	// horizontal para que no se coman el panel.
	const letteringH = $derived(lettering.aspect > 1.5 ? 120 : 170);
	const ANIM_SPEED = 16 / 60;
</script>

<FadeContainer {show}>
	{#if winLevelData}
		<!-- Velo OSCURO (antes rosa) — foco sobre el panel, sin pulso. -->
		<CanvasSizeRectangle backgroundColor={0x0d0c0a} backgroundAlpha={bgDimAlpha} />
		<MainContainer>
			<!-- SIN scale (antes pulsaba grande/chico → look viejo). -->
			<Container x={mainLayout.width / 2} y={mainLayout.height / 2}>
				<Sprite key="fs_win_panel" anchor={0.5} width={panelW} height={panelH} />
				<!-- Monto en la zona vacía central, inclinado ~-6° para calzar con
				     el tilt del panel. Look "sticker" (halo + gradiente + stroke). -->
				{@const amtText = moneyWinFromBookAmount(displayAmount)}
				<Text
					text={amtText}
					anchor={{ x: 0.5, y: 0.5 }}
					y={panelH * 0.12}
					rotation={-0.1}
					alpha={0.5}
					scale={1.06}
					style={{ fill: 0xf6ef1b, fontSize: panelH * 0.2, fontWeight: '900', letterSpacing: 4 }}
				/>
				<Text
					text={amtText}
					anchor={{ x: 0.5, y: 0.5 }}
					y={panelH * 0.12}
					rotation={-0.1}
					style={{
						fill: 0xffe96b,
						fontSize: panelH * 0.2,
						fontWeight: '900',
						letterSpacing: 4,
						stroke: { color: 0x0b0a08, width: 9 },
						dropShadow: { color: 0x000000, alpha: 0.85, blur: 7, distance: 6, angle: Math.PI / 2 },
					}}
				/>
			</Container>
		</MainContainer>
		<OnHotkey hotkey="Space" onpress={() => oncomplete()} />
		<OnPressFullScreen onpress={() => oncomplete()} />
	{/if}
</FadeContainer>
