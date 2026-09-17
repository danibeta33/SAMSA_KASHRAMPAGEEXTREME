<script lang="ts">
	// Bet replay (requisito de approval — /docs/api/bet-replay): con
	// replay=true el HUD normal se esconde (BottomBar/TopBar consultan
	// stateUrlDerived.replay()) y este overlay maneja la reproducción.
	// Feedback N3: antes de reproducir (y al terminar) se muestra la card
	// con Mode / Base Bet / Cost Multiplier / Total Bet Cost / Payout
	// Multiplier / Total Win, como el ejemplo del reviewer. Durante el
	// playback queda solo el badge REPLAY.
	import { stateBet, stateMeta, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { replayState } from '../game/replay.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { money, moneyWinFromBookAmount } from '../game/money';
	import { labPreview } from '../game/stateTweak.svelte';

	const context = getContext();

	const loading = $derived(context.stateLayout.showLoadingScreen);
	const isIdle = $derived(context.stateXstateDerived.isIdle());
	const isResuming = $derived(context.stateXstateDerived.isResumingBet());

	const modeKey = $derived(stateUrlDerived.mode().toUpperCase());
	const modeMeta = $derived(stateMeta.betModeMeta?.[modeKey]);
	const modeTitle = $derived(modeMeta?.text?.title ?? modeKey.replace(/_/g, ' '));
	const costMultiplier = $derived(modeMeta?.costMultiplier ?? 1);

	// wageredBetAmount = ?amount / API_AMOUNT_MULTIPLIER (Authenticate) = la
	// BASE BET del jugador — misma semántica que en play normal, donde
	// wageredBetAmount = betAmount y el RGS debita base × costMultiplier
	// server-side (los book amounts son múltiplos de la base: 100 = 1× base).
	// Total Bet Cost = lo realmente debitado.
	const baseBet = $derived(stateBet.wageredBetAmount);
	const totalBetCost = $derived(baseBet * costMultiplier);

	// El total de la ronda sale del book: finalWin en book units (100 = 1×
	// base). El Payout Multiplier de la card se muestra relativo al Total
	// Bet Cost para que la aritmética visible cierre como en el ejemplo del
	// reviewer: Total Bet Cost × Payout Multiplier = Total Win (en BASE, con
	// costMultiplier 1, coincide con el multiplicador crudo del RGS).
	const finalWinBookAmount = $derived.by(() => {
		const events = replayState.savedBet?.state ?? [];
		for (let i = events.length - 1; i >= 0; i--) {
			const ev = events[i];
			if (ev.type === 'finalWin' || ev.type === 'setTotalWin') return ev.amount;
		}
		return 0;
	});
	const payoutMultiplier = $derived(finalWinBookAmount / 100 / costMultiplier);

	// ── DEV — preview de la card desde el ANIM LAB (tecla A) ─────────────────
	// La card solo se monta con ?replay=true y con una ronda cargada, así que
	// revisarla en los 7 viewports obligaba a armar una URL de replay a mano.
	// Estos dos toggles la montan en una sesión normal: `replayCard` la muestra
	// y `replayLong` la llena con los strings más largos que puede recibir
	// (buy de 100×, moneda de 3 letras, win de 7 cifras) — el caso que rompe el
	// layout y el que hay que mirar al cambiar tamaños.
	//
	// Con `import.meta.env.DEV` en falso el build colapsa `labCard` a `false` y
	// los ternarios de abajo se pliegan a los valores reales: en producción
	// esto no existe.
	const labCard = $derived(import.meta.env.DEV && labPreview.replayCard);
	const labLong = $derived(labCard && labPreview.replayLong);

	// `replayCard` solo: los valores reales mandan y el preview rellena lo que
	// en una sesión normal viene vacío (el modo sale de la URL, el win de la
	// ronda). `replayLong`: pisa TODO — si no pisara el bet, que en sesión
	// normal ya trae un valor, la fila más ancha se quedaría corta y el stress
	// no probaría nada.
	const shownMode = $derived(
		labLong ? 'VAULT CRACK' : labCard && !modeKey ? 'BASE' : modeTitle,
	);
	const shownCostMultiplier = $derived(
		labLong ? 100 : labCard && !modeMeta ? 1 : costMultiplier,
	);
	const shownBaseBet = $derived(labLong ? 1000 : labCard && !baseBet ? 1 : baseBet);
	const shownTotalBetCost = $derived(shownBaseBet * shownCostMultiplier);
	const shownWinBookAmount = $derived(
		labLong ? 987_654_300 : labCard && !finalWinBookAmount ? 0 : finalWinBookAmount,
	);
	const shownPayoutMultiplier = $derived(shownWinBookAmount / 100 / shownCostMultiplier);

	// Multiplicadores chicos (buys: win/costo suele ser <1) con precisión
	// suficiente para que total × mult = win cierre a la vista.
	const fmtMult = (m: number) => `×${Number(m.toFixed(m >= 1 ? 2 : 4))}`;

	const play = () => {
		if (replayState.phase === 'playing' || !replayState.savedBet) return;
		stateBet.betToResume = replayState.savedBet;
		replayState.phase = 'playing';
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	};

	// Fin del playback: la máquina entró a resumeBet y volvió a idle.
	// (No alcanza con mirar isIdle tras el click — el broadcast puede
	// procesarse async y isIdle seguiría true un frame.)
	let started = $state(false);
	$effect(() => {
		if (replayState.phase === 'playing' && isResuming) started = true;
		if (started && isIdle) {
			replayState.phase = 'done';
			started = false;
		}
	});
</script>

{#if (stateUrlDerived.replay() || labCard) && !loading}
	<div class="replay">
		<span class="replay__badge">{i18nDerived.replayBadge()}</span>

		{#if labCard || replayState.phase === 'ready' || replayState.phase === 'done'}
			<div class="replay__scrim">
				<div class="replay__card">
					<span class="replay__card-badge">{i18nDerived.replayBadge()}</span>
					<h2 class="replay__title">{i18nDerived.replayTitle()}</h2>

					<div class="replay__rows">
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayMode()}</span>
							<span class="replay__value replay__value--mode">{shownMode}</span>
						</div>
						<hr class="replay__divider" />
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayBaseBet()}</span>
							<span class="replay__value">{money(shownBaseBet)}</span>
						</div>
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayCostMultiplier()}</span>
							<span class="replay__value">{fmtMult(shownCostMultiplier)}</span>
						</div>
						<div class="replay__row replay__row--highlight">
							<span class="replay__label">{i18nDerived.replayTotalBetCost()}</span>
							<span class="replay__value">{money(shownTotalBetCost)}</span>
						</div>
						<hr class="replay__divider" />
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayPayoutMultiplier()}</span>
							<span class="replay__value">{fmtMult(shownPayoutMultiplier)}</span>
						</div>
						<div class="replay__row replay__row--highlight">
							<span class="replay__label">{i18nDerived.replayTotalWin()}</span>
							<span class="replay__value replay__value--win"
								>{moneyWinFromBookAmount(shownWinBookAmount)}</span
							>
						</div>
					</div>

					<button class="replay__play" onclick={play}>
						<!-- Se testea contra 'done' y no contra 'ready': en producción es
						     equivalente (son las dos únicas fases que dibujan la card), pero
						     el preview del lab corre con la fase en 'idle' y mostraba
						     "Replay Again" cuando lo que hay que revisar es el estado inicial. -->
						▶&nbsp;{replayState.phase === 'done'
							? i18nDerived.replayAgain()
							: i18nDerived.replayStart()}
					</button>
					<p class="replay__disclaimer">{i18nDerived.replayDisclaimer()}</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.replay {
		position: fixed;
		inset: 0;
		z-index: 95; /* sobre el canvas, bajo modals (Modals/menú van más arriba) */
		pointer-events: none;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
	}
	.replay__badge {
		position: absolute;
		top: clamp(14px, 9.5vh, 64px);
		left: 50%;
		transform: translateX(-50%) skew(-8deg);
		padding: 0.36em 1.27em;
		background: #e02330;
		color: #0d0c0a;
		font-size: clamp(7px, 1.63vh, 11px);
		font-weight: 900;
		letter-spacing: 0.27em;
		border-radius: 4px;
	}
	.replay__scrim {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(13, 12, 10, 0.72);
		pointer-events: auto;
	}
	/* Rechazo Stake 17-09: "The replay window must not be scrollable" — el
	   reviewer fotografió la card con barra horizontal en Desktop y con las DOS
	   barras en popout. Dos causas, las mismas que ya documentó Dead Heat
	   (09-rejection-log-dead-heat.md 1.3):

	   1. `.replay__rows` heredaba `box-sizing: content-box`, así que su
	      `width:100%` + padding lateral medía MÁS que la card. Y al declarar
	      `overflow-y` dejando `overflow-x` en `visible`, CSS computa el
	      horizontal a `auto` → barra en todos los viewports.
	   2. El único breakpoint compacto era `max-height: 300px`: cubría Popout S
	      (400×225) y dejaba afuera todo lo de en medio — Popout L acá es
	      800×450 y la card full-size no entraba en el 92vh.

	   Fix del (2) sin breakpoints: la card define UNA font-size fluida por
	   altura de viewport y TODO adentro va en `em`. Card y tipografía escalan
	   como una pieza, así que la proporción contenido/card es constante y no
	   existe un viewport donde desborde — que es lo que habilita el
	   `overflow: hidden` de abajo sin riesgo de clipear.
	   El tope de 13px deja Desktop/Mobile L idénticos a como estaban. */
	.replay__card {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: clamp(6.5px, 1.93vh, 13px);
		gap: 0.77em;
		width: min(26em, 88vw);
		/* 95vh y no 92: en Popout S (400×225) la font-size toca su piso de
		   6.5px y la card deja de achicarse con el viewport, así que el
		   max-height pasa a ser la restricción que manda. Con 92vh (207px)
		   quedaba 1px corto del contenido. */
		max-height: 95vh;
		/* Literal al pedido de Stake: no scrollea en ningún eje. */
		overflow: hidden;
		padding: 1.38em 1.54em 1.08em;
		border: 2px solid #f6ef1b;
		border-radius: 12px;
		background: #14130f;
		box-shadow: 0 0 28px rgba(212, 255, 58, 0.25);
	}
	.replay__card-badge {
		padding: 0.23em 0.92em;
		background: #e02330;
		color: #0d0c0a;
		font-size: 0.77em;
		font-weight: 900;
		letter-spacing: 0.23em;
		border-radius: 4px;
		transform: skew(-8deg);
		white-space: nowrap;
	}
	.replay__title {
		margin: 0;
		color: #f5f2e9;
		font-size: 1.54em;
		font-weight: 900;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}
	.replay__rows {
		/* La causa (1): sin esto mide 24px más que la card. */
		box-sizing: border-box;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.46em;
		padding: 0.77em 0.92em;
		border-radius: 8px;
		background: rgba(245, 242, 233, 0.05);
	}
	.replay__row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.92em;
	}
	.replay__row--highlight {
		padding: 0.38em 0.62em;
		margin: 0 -0.62em;
		border-radius: 6px;
		background: rgba(245, 242, 233, 0.07);
	}
	.replay__divider {
		width: 100%;
		margin: 0.15em 0;
		border: none;
		border-top: 1px solid rgba(245, 242, 233, 0.15);
	}
	.replay__label {
		color: rgba(245, 242, 233, 0.6);
		font-size: 0.92em;
		font-weight: 600;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.replay__value {
		color: #f6ef1b;
		font-size: 1em;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-align: right;
		white-space: nowrap;
	}
	.replay__value--mode {
		color: #e02330;
	}
	.replay__value--win {
		color: #6ee7b7;
	}
	.replay__play {
		pointer-events: auto;
		box-sizing: border-box;
		width: 100%;
		padding: 0.92em 1.85em;
		border: 2px solid #0d0c0a;
		border-radius: 8px;
		background: linear-gradient(120deg, #f6ef1b 0%, #e0b030 55%, #f6ef1b 100%);
		color: #0d0c0a;
		font-family: inherit;
		font-size: 1.23em;
		font-weight: 900;
		letter-spacing: 0.19em;
		cursor: pointer;
		white-space: nowrap;
		box-shadow:
			0 0 18px rgba(212, 255, 58, 0.45),
			inset 0 -3px 0 rgba(13, 12, 10, 0.25);
	}
	.replay__play:active {
		transform: scale(0.97);
	}
	.replay__disclaimer {
		margin: 0;
		color: rgba(245, 242, 233, 0.45);
		font-size: 0.77em;
		text-align: center;
		line-height: 1.4;
	}
</style>
