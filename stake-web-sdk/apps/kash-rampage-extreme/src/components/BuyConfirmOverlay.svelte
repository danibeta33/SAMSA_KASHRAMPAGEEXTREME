<script lang="ts">
	// Confirmación de compra de bonus — overlay HTML custom (sin assets:
	// mismo sistema visual que AutoSpinOverlay). Reemplaza el
	// ModalBuyBonusConfirm del SDK, cuyo cancel/onclose volvían al
	// ModalBuyBonus genérico ('buyBonus') — acá CANCEL vuelve a nuestro
	// menú 'buyBonusKash'. CONFIRM replica la semántica del SDK:
	// activeBetModeKey = modo elegido + broadcast 'bet'.
	import { stateBet, stateMeta, stateModal } from 'state-shared';
	import { stateBonus } from 'components-ui-html/src/stateBonus.svelte';

	import { getContext } from '../game/context';
	import { money } from '../game/money';
	import { createCurtain } from '../game/curtain.svelte';

	const context = getContext();

	const curtain = createCurtain(() => stateModal.modal?.name === 'buyBonusConfirmKash');
	const modeData = $derived(stateMeta.betModeMeta[stateBonus.selectedBetModeKey]);
	const cost = $derived(stateBet.betAmount * (modeData?.costMultiplier ?? 0));

	// Doble check (Feedback N1 #2 — "otra confirmación"): BUY no compra,
	// pasa al segundo check "ARE YOU SURE?" con ✅/❌; recién ahí se apuesta.
	let armed = $state(false);
	$effect(() => {
		if (!curtain.visible) armed = false; // reset al cerrar/reabrir
	});

	const cancel = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateModal.modal = { name: 'buyBonusKash' };
	};

	const arm = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		armed = true;
	};

	const disarm = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		armed = false;
	};

	const confirm = () => {
		// Review N2: comprar con auto-bet corriendo dejaba el modo buy activo y
		// cada autospin re-compraba el bonus (loop infinito). El botón BONUS ya
		// queda deshabilitado durante el auto-bet — esto es el cinturón: si un
		// autobet llegara vivo hasta acá, se corta antes de apostar.
		stateBet.autoSpinsCounter = 0;
		stateBet.activeBetModeKey = stateBonus.selectedBetModeKey;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		context.eventEmitter.broadcast({ type: 'bet' });
		stateModal.modal = null;
	};
</script>

{#if curtain.visible}
	<div class="bc" class:bc--out={curtain.closing}>
		<div class="bc__panel">
			<button class="bc__close" onclick={cancel} aria-label="Close">
				<img src="assets/buy/close.png" alt="" />
			</button>
			<!-- El scroll vive en este wrapper, NO en el panel: con overflow en
			     el panel la X a caballo de la esquina (-17px) quedaba clipeada
			     en diagonal (feedback del usuario, 28-07). -->
			<div class="bc__scroll">
			{#if !armed}
				<h2 class="bc__title">{modeData?.text.title}</h2>
				<p class="bc__dialog">{modeData?.text.dialog}</p>
				<div class="bc__cost">
					<span class="bc__cost-label">COST</span>
					<span class="bc__cost-value">{money(cost)}</span>
				</div>
				<div class="bc__actions">
					<button class="bc__btn bc__btn--ghost" onclick={cancel}>CANCEL</button>
					<button
						class="bc__btn bc__btn--buy"
						onclick={arm}
						disabled={stateBet.balanceAmount < cost}
					>
						BUY
					</button>
				</div>
			{:else}
				<!-- Segundo check de compra: nada se apuesta hasta el ✅ -->
				<h2 class="bc__title">ARE YOU SURE?</h2>
				<p class="bc__dialog">
					{modeData?.text.title} — this buy is final. No take-backs.
				</p>
				<div class="bc__cost">
					<span class="bc__cost-label">COST</span>
					<span class="bc__cost-value">{money(cost)}</span>
				</div>
				<div class="bc__actions">
					<button class="bc__btn bc__btn--ghost" onclick={disarm}>❌ NO</button>
					<button
						class="bc__btn bc__btn--buy"
						onclick={confirm}
						disabled={stateBet.balanceAmount < cost}
					>
						✅ YES
					</button>
				</div>
			{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.bc {
		position: fixed;
		inset: 0;
		z-index: 190;
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
	.bc--out {
		transform: translateY(-102%);
		pointer-events: none;
	}
	@keyframes curtain-in {
		from {
			transform: translateY(-102%);
		}
	}
	.bc__panel {
		box-sizing: border-box; /* min(..vw) = ancho TOTAL, con padding adentro */
		position: relative;
		width: min(86vw, 480px);
		/* QA popout (misma clase que el bet menu del N2): en 400x225 el panel
		   desbordaba arriba y abajo y la X quedaba fuera del viewport. Tope a
		   pantalla + scroll interno; 40px de aire arriba para la X a caballo. */
		max-height: calc(100vh - 80px);
		/* SIN overflow acá: clipeaba la X a caballo de la esquina. El scroll
		   vive en .bc__scroll (interno). */
		border: 2px solid #f6ef1b;
		border-radius: 14px;
		background: #0d0c0a;
		box-shadow: 0 0 34px rgba(212, 255, 58, 0.25);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 30px 28px 26px;
		text-align: center;
	}
	.bc__scroll {
		width: 100%;
		min-height: 0; /* permite que el flex hijo encoja y scrollee */
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	/* X a caballo de la esquina del panel (mock del usuario) */
	.bc__close {
		position: absolute;
		top: -17px;
		right: -17px;
		width: 40px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.bc__close img {
		width: 100%;
	}
	.bc__close:active {
		transform: scale(0.92);
	}
	.bc__title {
		margin: 0;
		color: #e02330;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 5px;
	}
	.bc__dialog {
		margin: 0;
		color: #fff;
		opacity: 0.92;
		font-size: 13px;
		font-weight: 400;
		line-height: 1.5;
		max-width: 340px;
	}
	.bc__cost {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 22px;
		border: 2px solid rgba(236, 72, 153, 0.55);
		border-radius: 10px;
	}
	.bc__cost-label {
		color: #f6ef1b;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 3px;
	}
	.bc__cost-value {
		color: #fff;
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 1px;
		font-variant-numeric: tabular-nums;
	}
	.bc__actions {
		display: flex;
		gap: 10px;
		width: 100%;
		margin-top: 6px;
	}
	.bc__btn {
		flex: 1;
		padding: 14px;
		border-radius: 10px;
		font-family: inherit;
		font-size: 16px;
		font-weight: 900;
		letter-spacing: 4px;
		cursor: pointer;
	}
	.bc__btn--ghost {
		background: transparent;
		border: 2px solid rgba(236, 72, 153, 0.55);
		color: #fff;
	}
	.bc__btn--ghost:hover {
		border-color: #e02330;
	}
	.bc__btn--buy {
		background: #f6ef1b;
		border: none;
		color: #0d0c0a;
	}
	.bc__btn--buy:active {
		transform: scale(0.98);
	}
	.bc__btn--buy:disabled {
		filter: grayscale(0.8);
		opacity: 0.5;
		cursor: default;
	}

	/* Compacto mini-player (popout ≤300px de alto): todo entra sin scroll y
	   la X pasa a la esquina INTERIOR (a caballo quedaba fuera del viewport
	   y/o clipeada por el overflow del panel). */
	@media (max-height: 300px) {
		.bc__panel {
			max-height: calc(100vh - 16px);
			width: min(80vw, 420px);
			padding: 10px 14px 12px;
		}
		.bc__scroll {
			gap: 6px;
		}
		.bc__close {
			top: 4px;
			right: 4px;
			width: 26px;
		}
		.bc__title {
			font-size: 14px;
			letter-spacing: 2px;
		}
		.bc__dialog {
			font-size: 9px;
			margin: 0;
		}
		.bc__cost {
			padding: 3px 12px;
		}
		.bc__cost-label {
			font-size: 8px;
		}
		.bc__cost-value {
			font-size: 13px;
		}
		.bc__btn {
			padding: 6px 14px;
			font-size: 11px;
		}
	}
</style>
