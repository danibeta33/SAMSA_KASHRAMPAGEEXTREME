<script lang="ts">
	// Settings de sonido — overlay HTML custom (sin assets: mismo sistema
	// visual que AutoSpinOverlay). Reemplaza el ModalSettings del SDK.
	// Misma semántica: bind directo a stateSound.volumeValue* (0-100);
	// master multiplica music y sfx (stateSoundDerived), así que "quitar la
	// música y no los sfx" = MUSIC a 0 con MASTER arriba.
	import { stateModal, stateSound } from 'state-shared';

	import { getContext } from '../game/context';
	import { createCurtain } from '../game/curtain.svelte';

	const context = getContext();

	const curtain = createCurtain(() => stateModal.modal?.name === 'settingsKash');

	const close = () => (stateModal.modal = null);

	type VolumeKey = 'volumeValueMaster' | 'volumeValueMusic' | 'volumeValueSoundEffect';
	const ROWS: { key: VolumeKey; label: string }[] = [
		{ key: 'volumeValueMaster', label: 'MASTER' },
		{ key: 'volumeValueMusic', label: 'MUSIC' },
		{ key: 'volumeValueSoundEffect', label: 'SFX' },
	];

	const toggle = (key: VolumeKey) => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound[key] = stateSound[key] === 0 ? 50 : 0;
	};
</script>

{#if curtain.visible}
	<div class="st" class:st--out={curtain.closing}>
		<div class="st__panel">
			<button class="st__close" onclick={close} aria-label="Close">
				<img src="assets/buy/close.png" alt="" />
			</button>
			<h2 class="st__title">SOUND</h2>
			{#each ROWS as row (row.key)}
				<div class="st__row">
					<span class="st__label">{row.label}</span>
					<button
						class="st__toggle"
						class:st__toggle--on={stateSound[row.key] > 0}
						onclick={() => toggle(row.key)}
					>
						{stateSound[row.key] > 0 ? 'ON' : 'OFF'}
					</button>
					<input class="st__range" type="range" min="0" max="100" bind:value={stateSound[row.key]} />
					<span class="st__value">{stateSound[row.key]}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.st {
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
	.st--out {
		transform: translateY(-102%);
		pointer-events: none;
	}
	@keyframes curtain-in {
		from {
			transform: translateY(-102%);
		}
	}
	.st__panel {
		box-sizing: border-box; /* min(..vw) = ancho TOTAL, con padding adentro */
		position: relative;
		width: min(86vw, 460px);
		border: 2px solid #f6ef1b;
		border-radius: 14px;
		background: #0d0c0a;
		box-shadow: 0 0 34px rgba(212, 255, 58, 0.25);
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 28px 26px 26px;
	}
	/* X a caballo de la esquina del panel (mock del usuario) */
	.st__close {
		position: absolute;
		top: -17px;
		right: -17px;
		width: 40px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.st__close img {
		width: 100%;
	}
	.st__close:active {
		transform: scale(0.92);
	}
	.st__title {
		margin: 0;
		align-self: center;
		color: #e02330;
		font-size: 24px;
		font-weight: 900;
		letter-spacing: 6px;
	}
	.st__row {
		display: grid;
		grid-template-columns: 74px 52px 1fr 34px;
		align-items: center;
		gap: 10px;
	}
	.st__label {
		color: #f6ef1b;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 2px;
	}
	.st__toggle {
		padding: 7px 0;
		background: transparent;
		border: 2px solid rgba(236, 72, 153, 0.55);
		border-radius: 8px;
		color: #fff;
		font-family: inherit;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 1px;
		cursor: pointer;
	}
	.st__toggle--on {
		background: #e02330;
		border-color: #e02330;
		color: #0d0c0a;
	}
	.st__range {
		width: 100%;
		accent-color: #e02330;
	}
	.st__value {
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* Compacto mini-player (popout ≤300px de alto) */
	@media (max-height: 300px) {
		.st__panel {
			width: min(80vw, 360px);
			gap: 8px;
			padding: 12px 18px 14px;
		}
		.st__title {
			font-size: 15px;
			letter-spacing: 4px;
		}
	}
</style>
