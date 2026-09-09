<script lang="ts">
	// Bottom HUD — HTML overlay con los assets de botones del pack
	// "Asset 2@4x" (mock screen idea 1). Reemplaza la UI Pixi default del SDK.
	//
	// Acciones espejadas de components-ui-pixi (misma semántica):
	//   SPIN/STOP → ButtonBetProvider: idle→bet / no-idle→stop
	//   − / +     → ButtonDecrease/Increase: saltos por stateConfig.betAmountOptions
	//   TURBO     → updateIsTurbo(!isTurbo, {persistent:true})
	//   AUTO      → hasAutoBetCounter ? counter=0 : modal autoSpin
	//   hold SPIN → modal autoSpin ("HOLD FOR AUTO")
	//   menú      → stateUi.menuOpen  ·  gear → modal settings  ·  sound → master 0↔50
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateSound, stateUi, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { money } from '../game/money';
	import { stateUiTweak } from '../game/stateUiTweak.svelte';
	import { uiScaleFor, isPortraitViewport, topBarHeight } from '../game/hudLayout';

	const t = stateUiTweak;

	// ── Escala responsive del HUD (fórmulas compartidas en hudLayout.ts —
	// las mismas que usan los caps del board en Game.svelte) ─────────────
	const vpW = $derived(innerWidth.current ?? 1200);
	const vpH = $derived(innerHeight.current ?? 675);
	const isPortrait = $derived(isPortraitViewport(vpW, vpH));
	const uiScale = $derived(uiScaleFor(vpW, vpH));
	const topH = $derived(topBarHeight(vpW, vpH));

	const context = getContext();

	// Bet replay (/docs/api/bet-replay): sin controles de apuesta — se ocultan
	// el pill de bet, SPIN/TURBO/AUTO y BONUS; quedan menú/settings/sonido.
	// Los controles de replay los pone ReplayOverlay.
	const isReplay = stateUrlDerived.replay();
	// Social mode: el asset bet_pill.png trae "BET" rasterizado — se cubre con
	// un chip "PLAY" (los term-swaps de social.ts no llegan a los bitmaps).
	const isSocial = stateUrlDerived.social();

	// La UI se esconde durante transiciones (FS intro/outro) — mismos eventos
	// que consume la UI Pixi del SDK — y mientras el loading screen está al
	// frente (el "click to continue" va solo, sin HUD).
	let visible = $state(true);
	context.eventEmitter.subscribeOnMount({
		uiShow: () => (visible = true),
		uiHide: () => (visible = false),
		// Requisito de approval: spacebar mapeada al botón de bet. EnableHotkey
		// (Pixi) broadcast-ea hotKey; el consumidor era el ButtonBet del SDK
		// que desmontamos — lo reponemos acá con la misma semántica del SPIN.
		hotKey: (emitterEvent) => {
			if (emitterEvent.key !== 'Space' || emitterEvent.action !== 'keyUp') return;
			if (isReplay) return; // en replay no hay bet — la spacebar queda inerte
			if (!spacebarAllowed) return;
			if (!visible || context.stateLayout.showLoadingScreen || stateModal.modal) return;
			onSpinUp();
		},
	});
	const loading = $derived(context.stateLayout.showLoadingScreen);

	const isIdle = $derived(context.stateXstateDerived.isIdle());
	const betDisabled = $derived(isIdle && !stateBetDerived.isBetCostAvailable());
	const autoActive = $derived(stateBetDerived.hasAutoBetCounter());
	// Review N2: BONUS deshabilitado con auto-bet corriendo (y durante rounds)
	// — comprar en medio del auto-bet dejaba el modo buy activo en loop.
	const bonusDisabled = $derived(autoActive || !isIdle);
	const soundOn = $derived(stateSound.volumeValueMaster > 0);

	// ── Jurisdiction flags (config.jurisdiction del authenticate) ───────
	// Requisito RGS: la sesión puede venir de una jurisdicción que prohíbe
	// turbo/autoplay/buy/spacebar/slam-stop. El SDK guarda los flags en
	// stateConfig pero la UI custom debe consumirlos (la UI Pixi que
	// reemplazamos era quien lo hacía).
	const turboAllowed = $derived(!stateConfig.jurisdiction?.disabledTurbo);
	const autoAllowed = $derived(!stateConfig.jurisdiction?.disabledAutoplay);
	const buyAllowed = $derived(!stateConfig.jurisdiction?.disabledBuyFeature);
	const spacebarAllowed = $derived(!stateConfig.jurisdiction?.disabledSpacebar);
	const slamstopAllowed = $derived(!stateConfig.jurisdiction?.disabledSlamstop);

	// Turbo persiste en localStorage — si la jurisdicción lo prohíbe hay que
	// apagarlo aunque el botón esté oculto, o los spins seguirían rápidos.
	$effect(() => {
		if (!turboAllowed && stateBet.isTurbo) stateBetDerived.updateIsTurbo(false, { persistent: true });
	});

	const sfxGeneral = () => context.eventEmitter.broadcast({ type: 'soundPressGeneral' });

	// ── SPIN / STOP (ButtonBetProvider semantics) ──────────────────────
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let holdFired = false;

	const doBet = () => {
		if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
		context.eventEmitter.broadcast({ type: 'bet' });
	};
	const doStop = () => {
		if (stateBetDerived.hasAutoBetCounter()) stateBet.autoSpinsCounter = 0;
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};
	const onSpinDown = () => {
		holdFired = false;
		// Hold 600ms = abrir autospin (solo tiene sentido en idle)
		if (isIdle && !betDisabled && autoAllowed) {
			holdTimer = setTimeout(() => {
				holdFired = true;
				sfxGeneral();
				stateModal.modal = { name: 'autoSpinKash' };
			}, 600);
		}
	};
	const onSpinUp = () => {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
		if (holdFired) return; // el hold ya abrió el modal — no apostar
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		if (isIdle) {
			if (!betDisabled) doBet();
		} else if (slamstopAllowed) {
			doStop();
		}
	};

	// ── BET − / + (ButtonDecrease/Increase semantics) ──────────────────
	const sortedOptions = () => [...stateConfig.betAmountOptions].sort((a, b) => a - b);
	const increase = () => {
		sfxGeneral();
		const opts = sortedOptions();
		if (!opts.length) return; // sin betLevels del RGS no hay nada que setear
		const next = opts.find((o) => o > stateBet.betAmount);
		stateBetDerived.setBetAmount(next ?? opts[opts.length - 1]);
	};
	const decrease = () => {
		sfxGeneral();
		const opts = sortedOptions();
		if (!opts.length) return;
		const prev = [...opts].reverse().find((o) => o < stateBet.betAmount);
		stateBetDerived.setBetAmount(prev ?? opts[0]);
	};

	// ── TURBO / AUTO ───────────────────────────────────────────────────
	const toggleTurbo = () => {
		sfxGeneral();
		stateBetDerived.updateIsTurbo(!stateBet.isTurbo, { persistent: true });
	};
	const onAuto = () => {
		sfxGeneral();
		if (stateBetDerived.hasAutoBetCounter()) stateBet.autoSpinsCounter = 0;
		else stateModal.modal = { name: 'autoSpinKash' };
	};

	// ── Iconos izquierda ───────────────────────────────────────────────
	const openMenu = () => {
		sfxGeneral();
		stateUi.menuOpen = true;
	};
	const openSettings = () => {
		sfxGeneral();
		stateModal.modal = { name: 'settingsKash' };
	};
	const toggleSound = () => {
		sfxGeneral();
		stateSound.volumeValueMaster = soundOn ? 0 : 50;
	};

	// ── BONUS (buy bonus) — el mock no trae asset dedicado; botón rosa ──
	const openBuyBonus = () => {
		sfxGeneral();
		stateModal.modal = { name: 'buyBonusKash' };
	};

	// ── Click en el pill (fuera de −/+) → menú de monto de apuesta ──────
	const openBetMenu = () => {
		if (!isIdle) return;
		sfxGeneral();
		stateModal.modal = { name: 'betMenuKash' };
	};
</script>

<div class="bb" class:bb--hidden={!visible || loading}>
	{#snippet iconButtons()}
		<button class="bb__icon" style="width:{t.iconSize}px; height:{t.iconSize}px; background-image: url('assets/ui/icon_menu.png?v=2')" onclick={openMenu} aria-label="Menu"></button>
		<button class="bb__icon" style="width:{t.iconSize}px; height:{t.iconSize}px; background-image: url('assets/ui/icon_gear.png?v=2')" onclick={openSettings} aria-label="Settings"></button>
		<button
			class="bb__icon"
			class:bb__icon--off={!soundOn}
			style="width:{t.iconSize}px; height:{t.iconSize}px; background-image: url('assets/ui/icon_sound.png?v=2')"
			onclick={toggleSound}
			aria-label="Sound"
		></button>
	{/snippet}

	{#if isPortrait}
		<!-- Portrait (pedido del usuario): iconos de menú en fila SUPERIOR
		     bajo el TopBar; BONUS solo en la esquina inferior izquierda. -->
		<div
			class="bb__topicons"
			style="top: {topH + 8}px; gap: {t.iconGap}px; opacity: {t.iconAlpha}; z-index: {t.iconZ}; transform: scale({uiScale * t.iconScale}); transform-origin: top left"
		>
			{@render iconButtons()}
		</div>
		<!-- BONUS arriba a la derecha: abajo el stack centrado lo tapaba -->
		{#if buyAllowed && !isReplay}
			<button
				class="bb__bonus bb__bonus--top"
				style="top: {topH + 8}px; opacity: {t.iconAlpha}; z-index: {t.iconZ}; transform: scale({uiScale * t.iconScale}) skew(-8deg); transform-origin: top right"
				onclick={openBuyBonus}
				disabled={bonusDisabled}><span>BONUS</span></button
			>
		{/if}
	{:else}
		<!-- Landscape: fila inferior izquierda (iconos + BONUS). Escala y
		     posición tweakeables por bucket (UI LAB: Config+Bonus / X / Y). -->
		<div
			class="bb__icons"
			style="left: {t.iconX * uiScale}px; bottom: {t.iconY * uiScale}px; gap: {t.iconGap}px; opacity: {t.iconAlpha}; z-index: {t.iconZ}; transform: scale({uiScale * t.iconScale}); transform-origin: bottom left"
		>
			{@render iconButtons()}
			{#if buyAllowed && !isReplay}
				<button class="bb__bonus" onclick={openBuyBonus} disabled={bonusDisabled}><span>BONUS</span></button>
			{/if}
		</div>
	{/if}

	<!-- Stack derecha: BET pill + dock (SPIN / TURBO / AUTO) -->
	<!-- El conjunto pill+dock escala como unidad desde la esquina inf-der. -->
	<!-- Portrait: stack CENTRADO abajo (pedido del usuario). -->
	{#if !isReplay}
	<div
		class="bb__right"
		style={`opacity:${t.stackAlpha}; z-index:${t.stackZ}; ` +
			(isPortrait
				? `width:${t.stackW}px; right:50%; bottom:${t.stackBottom * uiScale}px; transform: translateX(50%) scale(${t.stackScale * uiScale}); transform-origin: bottom center`
				: `width:${t.stackW}px; right:${t.stackRight * uiScale}px; bottom:${t.stackBottom * uiScale}px; transform: scale(${t.stackScale * uiScale}); transform-origin: bottom right`)}
	>
		<div class="bb__pill" style="width:{t.pillW}%; margin-bottom:{t.pillGap}px">
			{#if isSocial}
				<span class="bb__pill-social">PLAY</span>
			{/if}
			<button class="bb__pill-minus" onclick={decrease} disabled={!isIdle} aria-label="Bajar apuesta"></button>
			<button class="bb__pill-center" onclick={openBetMenu} disabled={!isIdle} aria-label="Elegir apuesta">
				<span class="bb__pill-amount">{money(stateBet.betAmount)}</span>
			</button>
			<button class="bb__pill-plus" onclick={increase} disabled={!isIdle} aria-label="Subir apuesta"></button>
		</div>

		<div class="bb__dock">
			<button
				class="bb__spin"
				class:bb__spin--disabled={betDisabled}
				style="top:{t.spinTop}%; left:{(100 - t.spinW) / 2}%; width:{t.spinW}%; background-image: url('assets/ui/{isIdle ? 'btn_spin' : 'btn_stop'}.png?v=2')"
				onpointerdown={onSpinDown}
				onpointerup={onSpinUp}
				onpointerleave={() => holdTimer && clearTimeout(holdTimer)}
				aria-label={isIdle ? 'Spin' : 'Stop'}
			>
				{#if isIdle && autoAllowed}
					<span class="bb__spin-hold">HOLD FOR AUTO</span>
				{/if}
			</button>
			<div class="bb__row" style="bottom:{t.rowBottom}%; left:{t.rowSide}%; right:{t.rowSide}%">
				{#if turboAllowed}
					<button
						class="bb__mini"
						class:bb__mini--active={stateBet.isTurbo}
						style="width:{t.miniW}%; background-image: url('assets/ui/btn_turbo.png?v=2')"
						onclick={toggleTurbo}
						aria-label="Turbo"
					></button>
				{/if}
				{#if autoAllowed}
					<button
						class="bb__mini"
						class:bb__mini--active={autoActive}
						style="width:{t.miniW}%; background-image: url('assets/ui/btn_auto.png?v=2')"
						onclick={onAuto}
						aria-label="Auto"
					>
						{#if autoActive}
							<!-- Spins restantes visibles durante el autoplay -->
							<span class="bb__auto-count"
								>{stateBet.autoSpinsCounter === Infinity ? '∞' : stateBet.autoSpinsCounter}</span
							>
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
	{/if}
</div>

<style>
	.bb {
		position: fixed;
		inset: 0;
		z-index: 90;
		pointer-events: none;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
		transition: opacity 0.25s ease;
	}
	.bb--hidden {
		opacity: 0;
	}
	.bb--hidden * {
		pointer-events: none !important;
	}
	.bb button {
		pointer-events: auto;
		background-color: transparent;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		border: none;
		padding: 0;
		cursor: pointer;
		/* Sin caja de focus/tap del browser — el feedback de selección es
		   el glow lima de marca (drop-shadow sigue la silueta del PNG). */
		outline: none;
		-webkit-tap-highlight-color: transparent;
	}
	.bb__icon:hover,
	.bb__icon:focus-visible,
	.bb__icon:active {
		filter: drop-shadow(0 0 5px rgba(212, 255, 58, 0.95)) drop-shadow(0 0 14px rgba(212, 255, 58, 0.45));
	}
	.bb__icon--off:hover,
	.bb__icon--off:focus-visible {
		filter: grayscale(1) drop-shadow(0 0 5px rgba(212, 255, 58, 0.7));
	}
	.bb button:active {
		transform: scale(0.95);
	}
	.bb button:disabled {
		filter: grayscale(0.9);
		opacity: 0.5;
		cursor: default;
	}

	/* ── iconos izquierda ── */
	.bb__icons {
		position: absolute;
		left: 22px;
		bottom: 18px;
		display: flex;
		gap: 12px;
		align-items: center;
	}
	/* Portrait: fila de iconos ARRIBA (bajo el TopBar) */
	.bb__topicons {
		position: absolute;
		left: 10px;
		display: flex;
		align-items: center;
	}
	.bb__icon {
		width: 54px;
		height: 54px;
	}
	.bb__icon--off {
		filter: grayscale(1);
		opacity: 0.55;
	}
	/* BONUS pro: chip lima inclinado a juego con el SPIN (antes era un
	   placeholder de borde rosa). El span des-inclina el texto. */
	.bb__bonus {
		height: 46px;
		padding: 0 20px !important;
		border: 2px solid #0d0c0a !important;
		border-radius: 6px;
		color: #0d0c0a;
		font-family: inherit;
		font-size: 14px;
		font-weight: 900;
		letter-spacing: 3px;
		background: linear-gradient(120deg, #f6ef1b 0%, #e0b030 55%, #f6ef1b 100%) !important;
		transform: skew(-8deg);
		box-shadow:
			0 0 14px rgba(212, 255, 58, 0.4),
			inset 0 -3px 0 rgba(13, 12, 10, 0.25);
	}
	.bb__bonus > span {
		display: inline-block;
		transform: skew(8deg);
	}
	.bb__bonus:active {
		transform: skew(-8deg) scale(0.95);
	}
	.bb__bonus--top {
		position: absolute;
		right: 12px;
	}

	/* ── stack derecha ── */
	.bb__right {
		position: absolute;
		right: 18px;
		bottom: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 300px;
	}
	.bb__pill {
		position: relative;
		/* por delante del dock cuando el pillGap negativo los solapa */
		z-index: 2;
		width: 210px;
		aspect-ratio: 940 / 335;
		background: url('assets/ui/bet_pill.png?v=2') center / contain no-repeat;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bb__pill-minus,
	.bb__pill-plus {
		position: absolute;
		top: 18.5%;
		width: 26%;
		height: 72.5%;
	}
	.bb__pill-minus {
		left: 2%;
	}
	.bb__pill-plus {
		right: 2%;
	}
	/* Zona central clickeable del pill (abre el betAmountMenu del SDK).
	   Cubre la franja rosa medida del asset: y 18.5%..91% del alto — el flex
	   centra el monto exactamente en el medio de la franja. */
	.bb__pill-center {
		position: absolute;
		top: 18.5%;
		left: 28%;
		right: 28%;
		height: 72.5%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bb__pill-center:disabled {
		/* el pill no debe "apagarse" visualmente durante el round — solo el
		   click queda inerte */
		filter: none;
		opacity: 1;
	}
	/* Social: parche sobre el tab "BET" rasterizado del asset (centro-arriba
	   del PNG) — negro como el tab, deja vivo el borde/glow rosa de abajo. */
	.bb__pill-social {
		position: absolute;
		top: 3%;
		left: 39%;
		right: 39%;
		height: 21%;
		background: #0d0c0a;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 2px;
		pointer-events: none;
		z-index: 1;
	}
	.bb__pill-amount {
		color: #0d0c0a;
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.5px;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
		white-space: nowrap;
	}
	.bb__dock {
		position: relative;
		width: 300px;
		aspect-ratio: 940 / 550;
		background: url('assets/ui/dock.png?v=2') center / contain no-repeat;
	}
	/* SPIN contenido en la bahía superior del dock. Centrado vía `left`
	   calculado inline ((100-width)/2) — NO usar translateX: la regla global
	   `.bb button:active` pisa el transform y el botón saltaba de lugar. */
	.bb__spin {
		position: absolute;
		aspect-ratio: 1140 / 494;
	}
	.bb__spin--disabled {
		filter: grayscale(0.9);
		opacity: 0.5;
	}
	.bb__spin-hold {
		/* Sobre el arte nuevo (RS-04, kit 25-08): franja dorada superior del
		   hexágono — bajado y centrado sobre el oro para que el BET pill no lo
		   pise y el texto no caiga en el slash blanco del borde izquierdo. */
		position: absolute;
		top: 23%;
		left: 14%;
		right: 8%;
		text-align: center;
		color: rgba(90, 8, 16, 0.9);
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 2px;
		pointer-events: none;
	}
	/* TURBO / AUTO — mitad inferior del dock, esquina a esquina con gap
	   central mínimo (los assets traen su propio marco octagonal). */
	.bb__row {
		position: absolute;
		bottom: 7%;
		left: 1.5%;
		right: 1.5%;
		display: flex;
		justify-content: space-between;
	}
	.bb__mini {
		width: 48.5%;
		aspect-ratio: 850 / 361;
		opacity: 0.85;
	}
	.bb__mini--active {
		opacity: 1;
		filter: drop-shadow(0 0 8px #f6ef1b);
	}
	/* Contador de autospins restantes sobre el botón AUTO (esquina sup-der,
	   pill oscuro para legibilidad sobre el asset) */
	.bb__mini {
		position: relative;
	}
	.bb__auto-count {
		position: absolute;
		top: -8%;
		right: 2%;
		min-width: 34%;
		padding: 1px 6px;
		background: #0d0c0a;
		border: 1px solid #f6ef1b;
		border-radius: 999px;
		color: #f6ef1b;
		font-size: 12px;
		font-weight: 900;
		letter-spacing: 0.5px;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	/* Responsive: NO usar media queries acá — los tamaños vienen inline del
	   tweaker (px congelados) y pisan cualquier query. El escalado por
	   viewport lo resuelve uiScale (transform: scale) en el markup. */
</style>
