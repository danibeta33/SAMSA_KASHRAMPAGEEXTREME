<script lang="ts">
	// Top HUD strip — HTML overlay on top of the Pixi canvas. Diseño según
	// mock "screen idea 1" del Figma:
	//   fila 1 (fina): KV_MOOD & STYLE · LUCKY BASTARDS (subrayado) · 2026
	//   fila 2:        KASH SMASH | BALANCE / LAST WIN / TUMBLE en columnas
	//                  (label itálico rosa arriba, valor rosa grande abajo)
	//                  y a la derecha RTP + X1 en lima.
	// Valores reactivos: balance en unidades reales; winBookEventAmount viene
	// en book units (100 = 1× bet) → normalizar antes de formatear.
	import { stateBet, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { money, moneyWinFromBookAmount } from '../game/money';

	// Bet replay: el balance se oculta (no hay sesión de wallet) y en su lugar
	// se mantiene visible el bet amount de la ronda replayada — requisito de
	// /docs/api/bet-replay (mantener win + bet + moneda, ocultar balance).
	const isReplay = stateUrlDerived.replay();

	// Oculto mientras el loading screen ("click to continue") está al frente.
	const context = getContext();
	const loading = $derived(context.stateLayout.showLoadingScreen);

	// Requisito de approval: si un outcome tiene múltiples acciones ganadoras,
	// el payout debe actualizarse INCREMENTALMENTE. El math emite
	// tumbleWinAmountUpdate con el acumulado de la cadena de tumbles — acá se
	// refleja en vivo en LAST WIN (y al cierre setTotalWin fija el final).
	// TUMBLE muestra el multiplicador global real (antes era un X1 estático).
	let tumbleBookAmount = $state<number | null>(null);
	let globalMult = $state(1);
	context.eventEmitter.subscribeOnMount({
		tumbleWinAmountUpdate: (emitterEvent) => (tumbleBookAmount = emitterEvent.amount),
		tumbleWinAmountReset: () => (tumbleBookAmount = null),
		tumbleWinAmountHide: () => (tumbleBookAmount = null),
		globalMultiplierUpdate: (emitterEvent) => (globalMult = emitterEvent.multiplier),
		globalMultiplierHide: () => (globalMult = 1),
	});

	const lastWinBookAmount = $derived(tumbleBookAmount ?? stateBet.winBookEventAmount);
</script>

<div class="topbar" class:topbar--hidden={loading}>
	<div class="topbar__row topbar__row--main">
		<span class="topbar__brand">KASH RAMPAGE EXTREME</span>

		<div class="topbar__col">
			{#if isReplay}
				<span class="topbar__label">BET</span>
				<span class="topbar__value">{money(stateBet.wageredBetAmount)}</span>
			{:else}
				<span class="topbar__label">BALANCE</span>
				<span class="topbar__value">{money(stateBet.balanceAmount)}</span>
			{/if}
		</div>

		<div class="topbar__col">
			<span class="topbar__label">LAST WIN</span>
			<span class="topbar__value">{moneyWinFromBookAmount(lastWinBookAmount)}</span>
		</div>

		<div class="topbar__col">
			<span class="topbar__label">TUMBLE</span>
			<span class="topbar__value">X{globalMult}</span>
		</div>

			<!-- RTP + X1 estático removidos del HUD; el RTP sigue en el paytable/rules. -->
	</div>
</div>

<style>
	.topbar--hidden {
		display: none;
	}
	.topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: #0d0c0a;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, -apple-system, sans-serif;
		border-bottom: 2px solid #e02330;
		user-select: none;
		pointer-events: none;
	}
	.topbar__row {
		display: flex;
		align-items: center;
	}
	.topbar__row--thin {
		height: 26px;
		justify-content: center;
		gap: 18%;
		border-bottom: 1px solid #e02330;
	}
	.topbar__credit {
		color: #f6ef1b;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 2px;
		text-transform: uppercase;
	}
	.topbar__credit--underline {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.topbar__row--main {
		height: 56px;
		padding: 0 28px;
		gap: 0;
		justify-content: space-between;
	}
	.topbar__brand {
		color: #e02330;
		font-size: 16px;
		font-weight: 900;
		letter-spacing: 8px;
	}
	.topbar__col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.topbar__label {
		color: #e02330;
		font-family: 'Neue Plak Text', 'Neue Plak Extended', sans-serif;
		font-style: italic;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}
	.topbar__value {
		color: #e02330;
		font-size: 19px;
		font-weight: 900;
		letter-spacing: 2px;
		font-variant-numeric: tabular-nums;
	}
	.topbar__right {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.topbar__rtp {
		color: #e02330;
		font-size: 12px;
		font-weight: 900;
		letter-spacing: 5px;
	}
	.topbar__mult {
		color: #f6ef1b;
		font-size: 22px;
		font-weight: 900;
		letter-spacing: 1px;
	}
	.topbar__brand,
	.topbar__label,
	.topbar__value,
	.topbar__rtp,
	.topbar__mult,
	.topbar__credit {
		white-space: nowrap;
	}

	/* ── Narrow (mobile portrait ≤700px) — drop credits + TUMBLE/RTP, tighten ── */
	@media (max-width: 700px) {
		.topbar__row--thin {
			display: none;
		}
		.topbar__row--main {
			height: 40px;
			padding: 0 12px;
			gap: 10px;
		}
		.topbar__brand {
			font-size: 11px;
			letter-spacing: 3px;
		}
	}

	/* ── Mobile M/S (≤430px): el brand KRE es más largo que el de KS1 y
	   pegaba BALANCE contra LAST WIN — se compacta antes de sacrificarlo ── */
	@media (max-width: 430px) {
		.topbar__brand {
			font-size: 9px;
			letter-spacing: 1.5px;
		}
		.topbar__label {
			font-size: 7px;
		}
		.topbar__value {
			font-size: 13px;
			letter-spacing: 1px;
		}
		.topbar__col:nth-of-type(3),
		.topbar__right {
			display: none;
		}
	}

	/* ── Extra narrow (mobile S 320px) — se sacrifica el brand, NO el LAST
	   WIN (requisito: win final visible; el balance también se mantiene) ── */
	@media (max-width: 360px) {
		.topbar__brand {
			display: none;
		}
	}

	/* ── Short (popout S 400×225) — single ultra-thin strip ── */
	@media (max-height: 300px) {
		.topbar__row--thin {
			display: none;
		}
		.topbar__row--main {
			height: 24px;
			padding: 0 10px;
		}
		.topbar__col {
			flex-direction: row;
			gap: 6px;
			align-items: baseline;
		}
		.topbar__brand {
			font-size: 9px;
			letter-spacing: 1px;
		}
		.topbar__label {
			font-size: 7px;
		}
		.topbar__value {
			font-size: 11px;
			letter-spacing: 0;
		}
		.topbar__rtp {
			font-size: 8px;
			letter-spacing: 1px;
		}
		.topbar__mult {
			font-size: 12px;
		}
		.topbar__col:nth-of-type(3) {
			display: none;
		}
	}
</style>
