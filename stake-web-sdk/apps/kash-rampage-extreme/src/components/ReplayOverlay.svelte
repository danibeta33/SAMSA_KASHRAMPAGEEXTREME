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

{#if stateUrlDerived.replay() && !loading}
	<div class="replay">
		<span class="replay__badge">{i18nDerived.replayBadge()}</span>

		{#if replayState.phase === 'ready' || replayState.phase === 'done'}
			<div class="replay__scrim">
				<div class="replay__card">
					<span class="replay__card-badge">{i18nDerived.replayBadge()}</span>
					<h2 class="replay__title">{i18nDerived.replayTitle()}</h2>

					<div class="replay__rows">
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayMode()}</span>
							<span class="replay__value replay__value--mode">{modeTitle}</span>
						</div>
						<hr class="replay__divider" />
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayBaseBet()}</span>
							<span class="replay__value">{money(baseBet)}</span>
						</div>
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayCostMultiplier()}</span>
							<span class="replay__value">{fmtMult(costMultiplier)}</span>
						</div>
						<div class="replay__row replay__row--highlight">
							<span class="replay__label">{i18nDerived.replayTotalBetCost()}</span>
							<span class="replay__value">{money(totalBetCost)}</span>
						</div>
						<hr class="replay__divider" />
						<div class="replay__row">
							<span class="replay__label">{i18nDerived.replayPayoutMultiplier()}</span>
							<span class="replay__value">{fmtMult(payoutMultiplier)}</span>
						</div>
						<div class="replay__row replay__row--highlight">
							<span class="replay__label">{i18nDerived.replayTotalWin()}</span>
							<span class="replay__value replay__value--win"
								>{moneyWinFromBookAmount(finalWinBookAmount)}</span
							>
						</div>
					</div>

					<button class="replay__play" onclick={play}>
						▶&nbsp;{replayState.phase === 'ready'
							? i18nDerived.replayStart()
							: i18nDerived.replayAgain()}
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
		top: 64px;
		left: 50%;
		transform: translateX(-50%) skew(-8deg);
		padding: 4px 14px;
		background: #e02330;
		color: #0d0c0a;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 3px;
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
	.replay__card {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		width: min(340px, 88vw);
		max-height: 92vh;
		overflow-y: auto;
		padding: 18px 20px 14px;
		border: 2px solid #f6ef1b;
		border-radius: 12px;
		background: #14130f;
		box-shadow: 0 0 28px rgba(212, 255, 58, 0.25);
	}
	.replay__card-badge {
		padding: 3px 12px;
		background: #e02330;
		color: #0d0c0a;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 3px;
		border-radius: 4px;
		transform: skew(-8deg);
	}
	.replay__title {
		margin: 0;
		color: #f5f2e9;
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 1px;
	}
	.replay__rows {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(245, 242, 233, 0.05);
	}
	.replay__row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.replay__row--highlight {
		padding: 5px 8px;
		margin: 0 -8px;
		border-radius: 6px;
		background: rgba(245, 242, 233, 0.07);
	}
	.replay__divider {
		width: 100%;
		margin: 2px 0;
		border: none;
		border-top: 1px solid rgba(245, 242, 233, 0.15);
	}
	.replay__label {
		color: rgba(245, 242, 233, 0.6);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.5px;
	}
	.replay__value {
		color: #f6ef1b;
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.5px;
		text-align: right;
	}
	.replay__value--mode {
		color: #e02330;
	}
	.replay__value--win {
		color: #6ee7b7;
	}
	.replay__play {
		pointer-events: auto;
		width: 100%;
		padding: 12px 24px;
		border: 2px solid #0d0c0a;
		border-radius: 8px;
		background: linear-gradient(120deg, #f6ef1b 0%, #e0b030 55%, #f6ef1b 100%);
		color: #0d0c0a;
		font-family: inherit;
		font-size: 16px;
		font-weight: 900;
		letter-spacing: 3px;
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
		font-size: 10px;
		text-align: center;
		line-height: 1.4;
	}

	/* Popout S (400×225 — /docs/reference/dimensions): card compacta. */
	@media (max-height: 300px) {
		.replay__badge {
			top: 28px;
			font-size: 8px;
			padding: 2px 8px;
		}
		.replay__card {
			gap: 5px;
			width: min(280px, 80vw);
			max-height: 94vh;
			padding: 8px 12px 8px;
		}
		.replay__card-badge {
			font-size: 7px;
			padding: 2px 8px;
		}
		.replay__title {
			font-size: 12px;
		}
		.replay__rows {
			gap: 2px;
			padding: 5px 8px;
		}
		.replay__label {
			font-size: 8px;
		}
		.replay__value {
			font-size: 9px;
		}
		.replay__play {
			padding: 5px 12px;
			font-size: 10px;
			letter-spacing: 2px;
		}
		.replay__disclaimer {
			font-size: 6px;
		}
	}
</style>
