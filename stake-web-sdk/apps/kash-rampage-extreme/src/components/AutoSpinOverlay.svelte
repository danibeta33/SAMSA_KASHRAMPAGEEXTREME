<script lang="ts">
	// Autospins — overlay HTML según Figma "Pantalla / Autospins": mismo
	// escenario del buy bonus (bóveda + grafiti), título AUTO SPINS en caja
	// negra inclinada, grid 3×3 de rondas con borde por fila (rojo/lima/
	// magenta), ADVANCED colapsable (loss limit / single win limit del SDK)
	// y START AUTOPLAY lima. Semántica idéntica al ModalAutoSpin del SDK:
	//   START → stateBet.autoSpinsCounter = MAP[selección] + broadcast autoBet
	import {
		stateBet,
		stateBetDerived,
		stateModal,
		stateUi,
		AUTO_SPINS_TEXT_OPTIONS,
		AUTO_SPINS_TEXT_OPTION_MAP,
		LOSS_LIMIT_TEXT_OPTIONS,
		SINGLE_WIN_LIMIT_TEXT_OPTIONS,
		AUTO_SPINS_LOSS_LIMIT_MULTIPLIER_MAP,
		AUTO_SPINS_SINGLE_WIN_LIMIT_MULTIPLIER_MAP,
	} from 'state-shared';

	import { getContext } from '../game/context';
	import { createCurtain } from '../game/curtain.svelte';

	const context = getContext();

	const curtain = createCurtain(() => stateModal.modal?.name === 'autoSpinKash');

	let advanced = $state(false);

	// Despiece del artboard AutoSpins 01-07 (drop 26-08, assets/autospins/):
	// las cajas de números vienen con el valor y el borde de color HORNEADOS —
	// una imagen por opción. La última opción del SDK es INFINITY_MARK.
	const optImg = (opt: string) =>
		`assets/autospins/opt_${/^\d+$/.test(opt) ? opt : 'inf'}.png`;

	const close = () => (stateModal.modal = null);

	const start = () => {
		if (!stateBetDerived.isBetCostAvailable()) return;
		stateBet.autoSpinsCounter = AUTO_SPINS_TEXT_OPTION_MAP[stateUi.autoSpinsText];
		// QA edge: los límites ADVANCED eran cosméticos — la máquina de autobet
		// lee los MONTOS (autoSpins*LimitAmount) y quedaban en Infinity. La
		// conversión chip×bet es la misma del AutoSpinsStartButton del SDK.
		stateBet.autoSpinsLossLimitAmount =
			stateBet.betAmount * AUTO_SPINS_LOSS_LIMIT_MULTIPLIER_MAP[stateUi.autoSpinsLossLimitText];
		stateBet.autoSpinsSingleWinLimitAmount =
			stateBet.betAmount * AUTO_SPINS_SINGLE_WIN_LIMIT_MULTIPLIER_MAP[stateUi.autoSpinsSingleWinLimitText];
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		context.eventEmitter.broadcast({ type: 'autoBet' });
		close();
	};
</script>

{#if curtain.visible}
	<!-- Pantalla full-screen del artboard AutoSpins 01-07 (drop 26-08):
	     fondo bóveda propio, lockup AUTO SPINS, placa, cajas de números y
	     START AUTOPLAY — todo arte del despiece. ADVANCED sigue CSS (sin
	     pieza en el kit). -->
	<div class="as" class:as--out={curtain.closing} style="background-image: url('assets/autospins/bg.jpg')">
		<div class="as__panel">
			<button class="as__close" onclick={close} aria-label="Cerrar">
				<img src="assets/autospins/close.png" alt="" />
			</button>

			<div class="as__head">
				<img class="as__title-img" src="assets/autospins/title.png" alt="Auto spins — number of rounds" />
			</div>

			<div class="as__box" style="background-image: url('assets/autospins/panel.png')">
				<div class="as__grid">
					{#each AUTO_SPINS_TEXT_OPTIONS as opt (opt)}
						<button
							class="as__opt"
							class:as__opt--sel={stateUi.autoSpinsText === opt}
							onclick={() => (stateUi.autoSpinsText = opt)}
						>
							<img src={optImg(opt)} alt={opt} />
						</button>
					{/each}
				</div>
				<button class="as__adv" onclick={() => (advanced = !advanced)}>
					ADVANCED <span class="as__adv-arrow" class:as__adv-arrow--open={advanced}>▼</span>
				</button>
				{#if advanced}
					<div class="as__limits">
						<div class="as__limit">
							<span class="as__limit-label">LOSS LIMIT</span>
							<div class="as__limit-opts">
								{#each LOSS_LIMIT_TEXT_OPTIONS as opt (opt)}
									<button
										class="as__chip"
										class:as__chip--sel={stateUi.autoSpinsLossLimitText === opt}
										onclick={() => (stateUi.autoSpinsLossLimitText = opt)}
									>
										{opt}
									</button>
								{/each}
							</div>
						</div>
						<div class="as__limit">
							<span class="as__limit-label">SINGLE WIN LIMIT</span>
							<div class="as__limit-opts">
								{#each SINGLE_WIN_LIMIT_TEXT_OPTIONS as opt (opt)}
									<button
										class="as__chip"
										class:as__chip--sel={stateUi.autoSpinsSingleWinLimitText === opt}
										onclick={() => (stateUi.autoSpinsSingleWinLimitText = opt)}
									>
										{opt}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<button class="as__start" onclick={start} disabled={!stateBetDerived.isBetCostAvailable()}>
				<img src="assets/autospins/start.png" alt="Start autoplay" />
			</button>
		</div>
	</div>
{/if}

<style>
	.as {
		position: fixed;
		inset: 0;
		z-index: 180;
		/* imagen via style inline (ruta relativa al documento — CDN subpath).
		   Velo suave: el bg del artboard ya es oscuro/final. */
		background: rgba(13, 12, 10, 0.22) center / cover no-repeat;
		background-blend-mode: multiply;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		user-select: none;
		animation: curtain-in 0.45s cubic-bezier(0.22, 1, 0.36, 1);
		transition: transform 0.42s cubic-bezier(0.65, 0, 0.35, 1);
		will-change: transform;
	}
	.as--out {
		transform: translateY(-102%);
		pointer-events: none;
	}
	@keyframes curtain-in {
		from {
			transform: translateY(-102%);
		}
	}
	.as__panel {
		box-sizing: border-box; /* min(..vw) = ancho TOTAL, con padding adentro */
		position: relative;
		width: min(88vw, 165vh);
		height: min(90vh, 58vw);
		/* transparente: el diseño es la pantalla completa (artboard 01-07) */
		background: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 2.2vmin 3vmin 2.6vmin;
	}
	.as__close {
		position: absolute;
		top: 2.5vmin;
		right: 2.5vmin;
		width: clamp(34px, 6vmin, 56px);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		z-index: 1;
	}
	.as__close img {
		width: 100%;
	}
	.as__close:active {
		transform: scale(0.92);
	}
	.as__head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8vmin;
	}
	/* Lockup AUTO SPINS + NUMBER OF ROUNDS: pieza del despiece */
	.as__title-img {
		width: clamp(220px, 42vmin, 440px);
		display: block;
		filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
	}
	/* Placa del artboard (inclinación y borde horneados en el arte).
	   26-08: más alta (pedido de dirección) — más aire vertical para grid + ADVANCED. */
	.as__box {
		background: center / 100% 100% no-repeat;
		padding: 5vmin 4.6vmin 4.2vmin;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.4vmin;
		max-height: 72%;
		overflow-y: auto;
	}
	.as__grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.6vmin 2.4vmin;
	}
	/* Cajas de números: imagen con valor y borde horneados. La selección se
	   marca con brillo + glow (el kit no trae variante "seleccionada"). */
	.as__opt {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: transform 0.12s ease, filter 0.12s ease;
		filter: brightness(0.82);
	}
	.as__opt img {
		width: clamp(92px, 17vmin, 200px);
		display: block;
	}
	.as__opt:hover {
		transform: scale(1.05);
		filter: brightness(1);
	}
	.as__opt--sel {
		filter: brightness(1.15) drop-shadow(0 0 10px rgba(246, 239, 27, 0.55));
		transform: scale(1.04);
	}
	.as__adv {
		background: none;
		border: none;
		color: #fff;
		font-family: inherit;
		font-size: clamp(10px, 1.9vmin, 16px);
		font-weight: 900;
		letter-spacing: 2px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		/* inclinado como el lenguaje del artboard (cajas/título) */
		transform: rotate(-1.5deg);
	}
	.as__adv-arrow {
		display: inline-block;
		transition: transform 0.2s ease;
	}
	.as__adv-arrow--open {
		transform: rotate(180deg);
	}
	.as__limits {
		display: flex;
		flex-direction: column;
		gap: 1.2vmin;
	}
	.as__limit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6vmin;
	}
	.as__limit-label {
		color: #f6ef1b;
		font-size: clamp(8px, 1.4vmin, 12px);
		font-weight: 700;
		letter-spacing: 2px;
	}
	.as__limit-opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8vmin;
		justify-content: center;
	}
	.as__chip {
		min-width: clamp(38px, 6vmin, 60px);
		padding: 0.8vmin 1vmin;
		background: transparent;
		border: 2px solid rgba(236, 72, 153, 0.55);
		border-radius: 6px;
		color: #fff;
		font-family: inherit;
		font-size: clamp(10px, 1.7vmin, 14px);
		font-weight: 700;
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.as__chip:hover {
		border-color: #e02330;
	}
	.as__chip--sel {
		background: #e02330;
		border-color: #e02330;
		color: #0d0c0a;
	}
	/* START AUTOPLAY: pieza del despiece (inclinación horneada) */
	.as__start {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		filter: drop-shadow(0 6px 20px rgba(212, 255, 58, 0.3));
	}
	.as__start img {
		width: clamp(220px, 44vmin, 460px);
		display: block;
	}
	.as__start:active {
		transform: scale(0.97);
	}
	.as__start:disabled {
		filter: grayscale(0.8);
		opacity: 0.5;
		cursor: default;
	}

	/* Portrait — panel a lo alto, grid más compacto */
	@media (max-aspect-ratio: 1/1) {
		.as__panel {
			width: 94vw;
			height: 90vh;
		}
		.as__box {
			max-height: 64%;
		}
	}

	/* Compacto mini-player (popout ≤300px de alto) */
	@media (max-height: 300px) {
		.as__title-img {
			width: 130px;
		}
		.as__box {
			padding: 8px 12px;
			gap: 5px;
			/* QA popout: con ADVANCED expandido el contenido superaba el panel
			   y se derramaba fuera del viewport de 225px (misma clase de bug
			   que el bet menu del review N2). El box mantiene scroll interno. */
			max-height: 58%;
			overflow-y: auto;
		}
		.as__grid {
			gap: 5px 8px;
		}
		.as__opt img {
			width: 52px;
		}
		.as__adv {
			font-size: 8px;
		}
		.as__chip {
			padding: 2px 6px;
			font-size: 8px;
		}
		.as__limit-label {
			font-size: 7px;
		}
		.as__start img {
			width: 130px;
		}
	}
</style>
