<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';
	import BaseScrollable from './BaseScrollable.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	const messageMap = $derived({
		lossLimitReached: i18nDerived.lossLimitReached(),
		singleWinLimitReached: i18nDerived.singleWinLimitReached(),
		insufficientFunds: i18nDerived.insufficientFunds(),
	});
</script>

{#if stateModal.modal?.name === 'autoSpinMessage'}
	<Popup zIndex={zIndex.modal} onclose={() => (stateModal.modal = null)}>
		<div class="kash-modal kash-modal--autospin-message">
			<BaseContent maxWidth="100%">
				<h2 class="kash-title">{i18nDerived.notification()}</h2>
				<BaseScrollable type="column">
					<span class="kash-subtitle" data-test="auto-spin-stop-info">
						{i18nDerived.autoSpinsStopInfo()}
					</span>
					<div class="kash-info-text" data-test="auto-spin-stop-content">
						{messageMap[stateModal.modal.message]}
					</div>
				</BaseScrollable>
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
		max-width: 540px;
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
		font-size: 2rem;
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

	.kash-info-text {
		font-family: 'Europa', sans-serif;
		font-size: 0.95rem;
		line-height: 1.4;
		color: white;
		text-align: center;
		padding: 1rem 1.25rem;
		background: var(--kash-graybluish);
		border: 1px solid var(--kash-line);
		border-radius: 8px;
		max-width: 480px;
		max-height: 200px;
		overflow-y: auto;
		white-space: normal;
	}
</style>
