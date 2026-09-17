<script lang="ts">
	// Bet menu — overlay HTML custom (sin assets: sistema visual kash).
	// Reemplaza el ModalBetMenu genérico del SDK. Opciones: los betLevels
	// COMPLETOS del RGS (betAmountOptions — betMenuOptions viene submuestreado
	// por el SDK). Click setea stateBet.betAmount; CONFIRM cierra. La última
	// opción es MAX.
	import { stateBet, stateBetDerived, stateConfig, stateModal } from 'state-shared';

	import { getContext } from '../game/context';
	import { money } from '../game/money';
	import { createCurtain } from '../game/curtain.svelte';

	const context = getContext();

	const curtain = createCurtain(() => stateModal.modal?.name === 'betMenuKash');

	const options = $derived(stateConfig.betAmountOptions);
	const maxValue = $derived(options[options.length - 1]);

	// Un level que el balance no banca no se puede elegir (mismo criterio que
	// el clamp de setBetAmount — si se asignara directo quedaría un bet
	// inválido con el SPIN muerto).
	const affordable = (value: number) => value <= stateBet.balanceAmount;

	const close = () => (stateModal.modal = null);

	const pick = (value: number) => {
		if (!affordable(value)) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		// Por setBetAmount (no asignación directa): mismas reglas de clamp que
		// los botones −/+ del HUD.
		stateBetDerived.setBetAmount(value);
	};
</script>

{#if curtain.visible}
	<!-- Click en el fondo (fuera del panel) también cierra — belt del review
	     N2 ("once we open it, it is not possible to close it"). -->
	<div
		class="bm"
		class:bm--out={curtain.closing}
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && close()}
	>
		<div class="bm__panel">
			<button class="bm__close" onclick={close} aria-label="Close">
				<img src="assets/buy/close.png" alt="" />
			</button>
			<h2 class="bm__title">BET AMOUNT</h2>
			<p class="bm__sub">SELECT YOUR BET</p>
			<div class="bm__current">{money(stateBet.betAmount)}</div>
			<div class="bm__grid">
				{#each options as option (option)}
					<button
						class="bm__opt"
						class:bm__opt--sel={stateBet.betAmount === option}
						class:bm__opt--max={option === maxValue}
						disabled={!affordable(option)}
						onclick={() => pick(option)}
					>
						{option === maxValue ? 'MAX' : money(option)}
					</button>
				{/each}
			</div>
			<button class="bm__confirm" onclick={close}>CONFIRM</button>
		</div>
	</div>
{/if}

<style>
	.bm {
		position: fixed;
		inset: 0;
		z-index: 180;
		background: rgba(13, 12, 10, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
		animation: curtain-in 0.45s cubic-bezier(0.22, 1, 0.36, 1);
		transition: transform 0.42s cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
	}
	.bm--out {
		transform: translateY(-102%);
		pointer-events: none;
	}
	@keyframes curtain-in {
		from {
			transform: translateY(-102%);
		}
	}
	.bm__panel {
		box-sizing: border-box; /* min(..vw) = ancho TOTAL, con padding adentro */
		position: relative;
		width: min(86vw, 520px);
		/* Review N2: el RGS real manda MUCHOS más bet levels que el mock — sin
		   tope el panel superaba el viewport en todas las vistas y la X (a
		   caballo de la esquina, -17px) quedaba inalcanzable. Panel acotado a
		   la pantalla + scroll interno en la grilla. El margen de 40px arriba
		   deja siempre visible la X. */
		max-height: calc(100vh - 80px);
		border: 2px solid #f6ef1b;
		border-radius: 14px;
		background: #0d0c0a;
		box-shadow: 0 0 34px rgba(212, 255, 58, 0.25);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 28px 26px 26px;
	}
	/* X a caballo de la esquina del panel */
	.bm__close {
		position: absolute;
		top: -17px;
		right: -17px;
		width: 40px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.bm__close img {
		width: 100%;
	}
	.bm__close:active {
		transform: scale(0.92);
	}
	.bm__title {
		margin: 0;
		color: #e02330;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 5px;
	}
	.bm__sub {
		margin: -8px 0 0;
		color: #f6ef1b;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 3px;
	}
	.bm__current {
		padding: 8px 26px;
		border: 2px solid rgba(236, 72, 153, 0.55);
		border-radius: 10px;
		color: #fff;
		font-size: 22px;
		font-weight: 900;
		letter-spacing: 1px;
		font-variant-numeric: tabular-nums;
	}
	.bm__grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		width: 100%;
		/* La grilla absorbe el alto sobrante y scrollea; title/current/CONFIRM
		   quedan siempre visibles. */
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(236, 72, 153, 0.6) transparent;
	}
	.bm__opt {
		padding: 12px 6px;
		background: transparent;
		border: 2px solid rgba(236, 72, 153, 0.55);
		border-radius: 8px;
		color: #fff;
		font-family: inherit;
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.5px;
		cursor: pointer;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bm__opt:hover {
		border-color: #e02330;
	}
	.bm__opt:disabled {
		opacity: 0.35;
		cursor: default;
		border-color: rgba(236, 72, 153, 0.25);
	}
	.bm__opt--sel {
		background: #e02330;
		border-color: #e02330;
		color: #0d0c0a;
	}
	.bm__opt--max {
		border-color: rgba(212, 255, 58, 0.75);
		color: #f6ef1b;
	}
	.bm__opt--max.bm__opt--sel {
		background: #f6ef1b;
		border-color: #f6ef1b;
		color: #0d0c0a;
	}
	.bm__confirm {
		width: 100%;
		margin-top: 6px;
		padding: 14px;
		background: #f6ef1b;
		border: none;
		border-radius: 10px;
		color: #0d0c0a;
		font-family: inherit;
		font-size: 18px;
		font-weight: 900;
		letter-spacing: 5px;
		cursor: pointer;
	}
	.bm__confirm:active {
		transform: scale(0.98);
	}

	/* Compacto mini-player (popout ≤300px de alto) */
	@media (max-height: 300px) {
		.bm__panel {
			width: min(80vw, 400px);
			gap: 5px;
			padding: 10px 16px 12px;
		}
		.bm__title {
			font-size: 13px;
			letter-spacing: 3px;
		}
		.bm__sub {
			display: none;
		}
		.bm__current {
			padding: 2px 14px;
			font-size: 12px;
		}
		.bm__grid {
			gap: 5px;
		}
		.bm__opt {
			padding: 4px 4px;
			font-size: 10px;
		}
		.bm__confirm {
			padding: 6px;
			font-size: 11px;
		}
		/* panel casi a pantalla completa: la X a caballo (-17px) se salía del
		   viewport — se acerca a la esquina para que quede entera */
		.bm__close {
			top: -6px;
			right: -6px;
			width: 28px;
		}
	}
</style>
