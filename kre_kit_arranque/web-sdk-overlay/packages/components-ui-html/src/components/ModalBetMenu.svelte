<script lang="ts">
	import { Button, Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';

	import BaseIcon from './BaseIcon.svelte';
	import BaseContent from './BaseContent.svelte';
	import BaseScrollable from './BaseScrollable.svelte';
	import BaseButtonWrap from './BaseButtonWrap.svelte';
	import BaseButtonContent from './BaseButtonContent.svelte';
	import BetMenuAmountToggle from './BetMenuAmountToggle.svelte';
	import BetMenuAmountGrid from './BetMenuAmountGrid.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	const confirm = () => {
		stateModal.modal = null;
	};
</script>

{#if stateModal.modal?.name === 'betAmountMenu'}
	<Popup zIndex={zIndex.modal} onclose={() => (stateModal.modal = null)}>
		<div class="kash-modal kash-modal--betmenu">
			<BaseContent maxWidth="100%">
				<h2 class="kash-title">{i18nDerived.betMenu()}</h2>
				<BaseScrollable type="column">
					<span class="kash-subtitle">{i18nDerived.selectYourBet()}</span>
					<div class="kash-bet-display">
						<BetMenuAmountToggle />
					</div>
					<BetMenuAmountGrid />
				</BaseScrollable>
				<BaseButtonWrap type="full-width">
					<Button data-test="confirm-button" onclick={confirm}>
						<BaseIcon width="100%" height="3rem" />
						<BaseButtonContent>
							<span style="font-size: 1rem;">{i18nDerived.confirm()}</span>
						</BaseButtonContent>
					</Button>
				</BaseButtonWrap>
			</BaseContent>
		</div>
	</Popup>
{/if}

<style lang="scss">
	.kash-modal {
		font-family: 'Europa', sans-serif;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: 100%;
		max-width: 560px;
		padding: 1.5rem;
		background: var(--kash-dark);
		border: 1px solid var(--kash-line);
		border-radius: 12px;
		box-shadow: var(--kash-glow);
		box-sizing: border-box;
	}

	.kash-title {
		margin: 0;
		font-family: 'Europa', sans-serif;
		font-weight: 900;
		font-size: 2.25rem;
		line-height: 1;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--kash-lime);
		text-shadow: 0 2px 14px rgba(236, 72, 153, 0.45);
		text-align: center;
	}

	.kash-subtitle {
		font-family: 'Europa', sans-serif;
		font-weight: 700;
		font-size: 0.85rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--kash-textmuted);
		text-align: center;
	}

	.kash-bet-display {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--kash-graybluish);
		border: 2px solid var(--kash-lime);
		border-radius: 12px;
		box-shadow: inset 0 0 18px rgba(212, 255, 58, 0.08), 0 0 14px rgba(212, 255, 58, 0.18);
	}

	:global(.kash-bet-display .amount) {
		font-family: 'Europa', sans-serif;
		font-weight: 900;
		font-size: 1.75rem;
		color: var(--kash-lime);
		min-width: 7rem;
		text-align: center;
		text-shadow: 0 0 12px rgba(212, 255, 58, 0.4);
	}

	:global(.kash-bet-display .rectangle) {
		background: var(--kash-dark) !important;
		border: 2px solid var(--kash-teal) !important;
		border-radius: 8px !important;
		transition: all 0.15s ease;
	}

	:global(.kash-bet-display button:hover .rectangle) {
		border-color: var(--kash-lime) !important;
		box-shadow: 0 0 8px rgba(212, 255, 58, 0.35);
	}

	:global(.kash-bet-display .base-button-content) {
		color: var(--kash-lime) !important;
		font-weight: 900;
	}

	/* Preset bet grid chips */
	:global(.kash-modal--betmenu .rectangle) {
		background: var(--kash-graybluish) !important;
		border: 2px solid var(--kash-teal) !important;
		border-radius: 8px !important;
		transition: all 0.15s ease;
	}

	:global(.kash-modal--betmenu button:hover .rectangle) {
		border-color: var(--kash-lime) !important;
		box-shadow: 0 0 8px rgba(212, 255, 58, 0.35);
	}

	:global(.kash-modal--betmenu .rectangle[style*='white solid']) {
		background: var(--kash-lime) !important;
		border-color: var(--kash-lime) !important;
		box-shadow: 0 0 14px rgba(212, 255, 58, 0.55);
	}

	:global(.kash-modal--betmenu button:has(.rectangle[style*='white solid']) .base-button-content) {
		color: var(--kash-dark) !important;
	}

	:global(.kash-modal--betmenu .base-button-content) {
		font-family: 'Europa', sans-serif;
		font-weight: 700;
		color: white;
		letter-spacing: 0.02em;
	}

	/* MAX preset — last child highlighted with pink */
	:global(.kash-modal--betmenu .grid > :last-child .rectangle:not([style*='white solid'])) {
		border-color: var(--kash-pink) !important;
		box-shadow: 0 0 12px rgba(236, 72, 153, 0.35);
	}

	:global(.kash-modal--betmenu .grid > :last-child .base-button-content) {
		color: var(--kash-pink) !important;
	}

	:global(.kash-modal--betmenu .grid > :last-child .rectangle[style*='white solid']) {
		background: var(--kash-pink) !important;
		border-color: var(--kash-pink) !important;
		box-shadow: 0 0 16px rgba(236, 72, 153, 0.55);
	}

	:global(.kash-modal--betmenu .grid > :last-child:has(.rectangle[style*='white solid']) .base-button-content) {
		color: white !important;
	}

	/* Override the bet-display chip color rule (above) for the +/- buttons specifically: */
	:global(.kash-bet-display button:has(.rectangle[style*='white solid']) .base-button-content) {
		color: var(--kash-dark) !important;
	}

	/* CONFIRM CTA */
	:global(.kash-modal--betmenu .ui-modal-button-wrap .rectangle) {
		background: linear-gradient(180deg, var(--kash-lime), #b6e02a) !important;
		border: none !important;
		border-radius: 999px !important;
		box-shadow: 0 6px 20px rgba(212, 255, 58, 0.35);
		height: 3.25rem !important;
	}

	:global(.kash-modal--betmenu .ui-modal-button-wrap .base-button-content) {
		color: var(--kash-dark) !important;
		font-weight: 900;
		font-size: 1.05rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(.kash-modal--betmenu .ui-modal-button-wrap button:hover .rectangle) {
		box-shadow: 0 8px 28px rgba(212, 255, 58, 0.55);
		filter: brightness(1.05);
	}
</style>
