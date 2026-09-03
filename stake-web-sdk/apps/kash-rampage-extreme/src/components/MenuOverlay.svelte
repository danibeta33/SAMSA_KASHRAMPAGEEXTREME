<script lang="ts">
	// Menú hamburguesa — el consumer original de stateUi.menuOpen era la UI
	// Pixi del SDK (desmontada); este overlay lo reemplaza con el sistema
	// visual del juego. Da acceso a PAYTABLE, GAME RULES (modals del SDK con
	// shell brandeado — requisito de approval) y SOUND (overlay custom).
	import { stateModal, stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { createCurtain } from '../game/curtain.svelte';

	const context = getContext();

	const curtain = createCurtain(() => stateUi.menuOpen);

	const close = () => (stateUi.menuOpen = false);

	const openEntry = (name: 'payTable' | 'gameRules' | 'settingsKash') => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateUi.menuOpen = false;
		stateModal.modal = { name };
	};
</script>

{#if curtain.visible}
	<div class="mn" class:mn--out={curtain.closing}>
		<div class="mn__panel">
			<button class="mn__close" onclick={close} aria-label="Cerrar">
				<img src="assets/buy/close.png" alt="" />
			</button>
			<h2 class="mn__title">MENU</h2>
			<button class="mn__entry" onclick={() => openEntry('payTable')}>PAYTABLE</button>
			<button class="mn__entry" onclick={() => openEntry('gameRules')}>GAME RULES</button>
			<button class="mn__entry" onclick={() => openEntry('settingsKash')}>SOUND</button>
		</div>
	</div>
{/if}

<style>
	.mn {
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
	.mn--out {
		transform: translateY(-102%);
		pointer-events: none;
	}
	@keyframes curtain-in {
		from {
			transform: translateY(-102%);
		}
	}
	.mn__panel {
		box-sizing: border-box; /* min(..vw) = ancho TOTAL, con padding adentro */
		position: relative;
		width: min(86vw, 380px);
		border: 2px solid #f6ef1b;
		border-radius: 14px;
		background: #0d0c0a;
		box-shadow: 0 0 34px rgba(212, 255, 58, 0.25);
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 28px 26px 26px;
	}
	/* X a caballo de la esquina del panel */
	.mn__close {
		position: absolute;
		top: -17px;
		right: -17px;
		width: 40px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.mn__close img {
		width: 100%;
	}
	.mn__close:active {
		transform: scale(0.92);
	}
	.mn__title {
		margin: 0 0 6px;
		align-self: center;
		color: #e02330;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 6px;
	}
	.mn__entry {
		padding: 14px;
		background: transparent;
		border: 2px solid rgba(236, 72, 153, 0.55);
		border-radius: 10px;
		color: #fff;
		font-family: inherit;
		font-size: 15px;
		font-weight: 900;
		letter-spacing: 3px;
		cursor: pointer;
		transition: border-color 0.12s ease;
	}
	.mn__entry:hover {
		border-color: #e02330;
		background: rgba(236, 72, 153, 0.12);
	}
	.mn__entry:active {
		transform: scale(0.98);
	}

	/* Compacto mini-player (popout ≤300px de alto) */
	@media (max-height: 300px) {
		.mn__panel {
			width: min(78vw, 300px);
			gap: 6px;
			padding: 12px 18px 14px;
		}
		.mn__title {
			font-size: 15px;
			letter-spacing: 4px;
			margin-bottom: 2px;
		}
		.mn__entry {
			padding: 7px;
			font-size: 11px;
			letter-spacing: 2px;
			border-radius: 7px;
		}
	}
</style>
