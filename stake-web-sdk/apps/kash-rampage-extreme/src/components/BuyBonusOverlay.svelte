<script lang="ts">
	// Buy Bonus — overlay HTML custom (assets Downloads/buy + fondo del
	// loading). Reemplaza el ModalBuyBonus genérico del SDK: BottomBar abre
	// `{ name: 'buyBonusKash' }` así el modal del SDK (name 'buyBonus') nunca
	// se monta. Confirmación: card → stateBonus.selectedBetModeKey +
	// broadcast 'buyBonusConfirm' → Game.svelte abre BuyConfirmOverlay
	// ('buyBonusConfirmKash', también custom — requisito de approval:
	// compra siempre con confirmación). Su CANCEL vuelve acá.
	//
	// Cards sin costo impreso (Downloads/buy 2) — el costo real
	// (costMultiplier × betAmount) se dibuja como texto sobre la franja
	// libre entre el título del modo y el botón BUY, con el estilo del
	// asset de referencia original (blanco, bold, centrado).
	import { stateBet, stateModal, stateUrlDerived } from 'state-shared';
	import { stateBonus } from 'components-ui-html/src/stateBonus.svelte';

	import { getContext } from '../game/context';
	import { money } from '../game/money';
	import { createCurtain } from '../game/curtain.svelte';

	const context = getContext();

	// Social mode: header.png ("BUY BONUS") y las cards ("N x BET" / "BUY")
	// traen términos restringidos rasterizados — acá se reemplaza el header
	// por texto y se parchean las dos zonas de cada card con covers CSS del
	// mismo color de fondo (el texto HTML lo cubre social.ts, los bitmaps no).
	const isSocial = stateUrlDerived.social();

	const curtain = createCurtain(() => stateModal.modal?.name === 'buyBonusKash');


	// `accent` = color del costo según el acento de cada card (Figma).
	type Card = { mode: string; img: string; mult: number; accent: string };
	const CARDS: Card[] = [
		{ mode: 'VAULT_CRACK', img: 'assets/buy/card_vault.png', mult: 100, accent: '#f5333f' },
		{ mode: 'SMASH_MODE', img: 'assets/buy/card_smash.png', mult: 250, accent: '#f6ef1b' },
		{ mode: 'RAGE_MODE', img: 'assets/buy/card_rage.png', mult: 500, accent: '#d32b25' },
	];

	const close = () => (stateModal.modal = null);

	const pick = (card: Card) => {
		if (stateBet.balanceAmount < stateBet.betAmount * card.mult) return;
		stateBonus.selectedBetModeKey = card.mode;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		context.eventEmitter.broadcast({ type: 'buyBonusConfirm' });
	};

	const affordable = (card: Card) => stateBet.balanceAmount >= stateBet.betAmount * card.mult;
</script>

{#if curtain.visible}
	<!-- Fondo full-screen del artboard Buy Bonus 01-07 (drop 26-08): bóveda +
	     marca de agua KASH ya compuesta offline (blend screen) en buy/bg.jpg.
	     El panel queda transparente — la pantalla ES el diseño, sin marco. -->
	<div class="buy" class:buy--out={curtain.closing} style="background-image: url('assets/buy/bg.jpg')">
		<div class="buy__panel">
			<button class="buy__close" onclick={close} aria-label="Cerrar">
				<img src="assets/buy/close.png" alt="" />
			</button>
			{#if isSocial}
				<h2 class="buy__header buy__header--social">
					BONUS <span>PICK YOUR WEAPON</span>
				</h2>
			{:else}
				<img class="buy__header" src="assets/buy/header.png" alt="Buy Bonus — pick your weapon" />
			{/if}
			<div class="buy__cards">
				{#each CARDS as card (card.mode)}
					<button
						class="buy__card"
						class:buy__card--off={!affordable(card)}
						onclick={() => pick(card)}
					>
						<img src={card.img} alt={card.mode} />
						{#if isSocial}
							<span class="buy__badge-social">{card.mult}x PLAY</span>
							<span class="buy__buy-social" style="background: {card.accent}">PLAY</span>
						{/if}
						<span class="buy__cost" style="color: {card.accent}"
							>COST {money(stateBet.betAmount * card.mult)}</span
						>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.buy {
		position: fixed;
		inset: 0;
		z-index: 180;
		/* imagen via style inline (ruta relativa al documento — CDN subpath) */
		/* velo suave: el bg del artboard ya es oscuro/final */
		background: rgba(13, 12, 10, 0.22) center / cover no-repeat;
		background-blend-mode: multiply;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
		/* cortina: entra desde arriba, sale cayendo (mismo lenguaje del loading) */
		animation: curtain-in 0.45s cubic-bezier(0.22, 1, 0.36, 1);
		transition: transform 0.42s cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
	}
	.buy--out {
		transform: translateY(-102%);
		pointer-events: none;
	}
	@keyframes curtain-in {
		from {
			transform: translateY(-102%);
		}
	}
	.buy__panel {
		box-sizing: border-box; /* min(..vw) = ancho TOTAL, con padding adentro */
		position: relative;
		width: min(88vw, 165vh);
		height: min(90vh, 58vw);
		/* transparente: el diseño es la pantalla completa (artboard 01-07) */
		background: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-evenly;
		padding: 2vmin 3vmin;
	}
	.buy__close {
		position: absolute;
		top: 2.5vmin;
		right: 2.5vmin;
		width: clamp(34px, 6vmin, 56px);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.buy__close img {
		width: 100%;
		height: auto;
	}
	.buy__close:active {
		transform: scale(0.92);
	}
	.buy__header {
		height: clamp(52px, 14vmin, 120px);
		width: auto;
		filter: drop-shadow(0 5px 16px rgba(0, 0, 0, 0.6));
	}
	/* Social: header de texto con el mismo lenguaje del asset (barra negra
	   inclinada, título blanco, sub lima) — sin "BUY". */
	.buy__header--social {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5vmin;
		margin: 0;
		padding: 1vmin 5vmin;
		background: #0d0c0a;
		transform: rotate(-3deg);
		color: #fff;
		font-size: clamp(22px, 6vmin, 52px);
		font-weight: 900;
		letter-spacing: 4px;
		line-height: 1;
	}
	.buy__header--social > span {
		color: #f6ef1b;
		font-size: clamp(10px, 2.2vmin, 18px);
		letter-spacing: 3px;
	}
	/* Social: covers sobre las dos zonas con texto rasterizado de cada card —
	   badge "N x BET" (parche negro como el interior) y texto "BUY" de la
	   barra inferior (parche del color de acento de la card). */
	.buy__badge-social {
		position: absolute;
		top: 42.5%;
		left: 28%;
		right: 28%;
		height: 8%;
		background: #0d0c0a;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: clamp(6px, 1.7vmin, 15px);
		font-weight: 700;
		letter-spacing: 1px;
		/* QA popout: sin nowrap el badge hacía wrap y la 2ª línea pisaba el
		   título de la card ("100x VAULT PLAY CRACK") en 400x225. */
		white-space: nowrap;
		pointer-events: none;
	}
	.buy__buy-social {
		position: absolute;
		top: 82.5%;
		left: 32%;
		right: 32%;
		height: 13%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #0d0c0a;
		font-size: clamp(14px, 3.4vmin, 30px);
		font-weight: 900;
		letter-spacing: 2px;
		pointer-events: none;
	}
	.buy__cards {
		display: flex;
		gap: 3vmin;
		align-items: center;
		justify-content: center;
		width: 100%;
	}
	.buy__card {
		position: relative;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		width: clamp(150px, 27%, 360px);
		transition: transform 0.12s ease;
	}
	.buy__card img {
		width: 100%;
		height: auto;
		filter: drop-shadow(0 8px 22px rgba(0, 0, 0, 0.55));
	}
	.buy__card:hover {
		transform: translateY(-4px) scale(1.02);
	}
	.buy__card:active {
		transform: scale(0.97);
	}
	.buy__card--off {
		filter: grayscale(0.85);
		opacity: 0.55;
		cursor: default;
	}
	.buy__card--off:hover {
		transform: none;
	}
	/* Costo dinámico — texto sobre la franja libre del asset entre el
	   título del modo y el botón BUY. Color = acento de la card (inline) y
	   leve inclinación siguiendo el lean del arte (Figma). */
	.buy__cost {
		position: absolute;
		left: 10%;
		right: 10%;
		top: 68.5%;
		height: 9.5%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: clamp(12px, 2.6vmin, 22px);
		font-weight: 900;
		letter-spacing: 1px;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
		transform: rotate(-4deg);
		pointer-events: none;
		white-space: nowrap;
	}

	@media (max-aspect-ratio: 1/1) {
		.buy__panel {
			width: 94vw;
			height: 90vh;
		}
		.buy__cards {
			flex-direction: column;
			gap: 2vmin;
		}
		.buy__card {
			width: auto;
			/* vh, NUNCA %: .buy__cards no tiene altura definida y el % colapsa
			   a 0 → cards invisibles en mobile (bug viewports Stake). */
			height: clamp(100px, 22vh, 210px);
		}
		.buy__card img {
			width: auto;
			height: 100%;
		}
	}

	/* Mini-player (popout 400×225 / 800×450 muy bajos): las cards a 150px de
	   ancho mínimo desbordaban el panel y el costo hacía wrap sobre el BUY.
	   Se acotan por alto de viewport para que las 3 entren completas. */
	@media (min-aspect-ratio: 1/1) and (max-height: 300px) {
		.buy__card {
			width: min(27%, 36vh);
		}
		.buy__header {
			height: clamp(24px, 11vmin, 52px);
		}
		.buy__cost {
			font-size: clamp(6px, 3.4vh, 10px);
			top: 66%;
		}
	}
</style>
