<script lang="ts">
	import { Button, Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateBet, stateModal, stateUi, INFINITY_MARK } from 'state-shared';
	import { getContextEventEmitter } from 'utils-event-emitter';

	import BaseContent from './BaseContent.svelte';
	import BaseScrollable from './BaseScrollable.svelte';
	import BaseButtonWrap from './BaseButtonWrap.svelte';
	import { stateBonus, stateBonusDerived } from '../stateBonus.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import type { EmitterEventModal } from '../types';

	const { eventEmitter } = getContextEventEmitter<EmitterEventModal>();

	const confirm = () => {
		stateBet.activeBetModeKey = stateBonus.selectedBetModeKey;

		if (stateBonusDerived.selectedBetModeData().type === 'buy') {
			eventEmitter.broadcast({ type: 'bet' });
		}

		if (stateBonusDerived.selectedBetModeData().type === 'activate') {
			stateUi.autoSpinsLossLimitText = INFINITY_MARK;
			stateUi.autoSpinsSingleWinLimitText = INFINITY_MARK;
		}
	};

	const cancel = () => {
		stateModal.modal = { name: 'buyBonus' };
		eventEmitter.broadcast({ type: 'soundPressGeneral' });
	};
</script>

{#if stateModal.modal?.name === 'buyBonusConfirm'}
	<Popup zIndex={zIndex.dialog} onclose={() => (stateModal.modal = { name: 'buyBonus' })}>
		<div class="kash-modal kash-modal--confirm">
			<BaseContent maxWidth="500px">
				<h2 class="kash-title">
					{stateBonusDerived.selectedBetModeData().text.title}
				</h2>
				<BaseScrollable type="column">
					<div class="kash-body">
						{stateBonusDerived.selectedBetModeData().text.dialog}
					</div>
				</BaseScrollable>
				<BaseButtonWrap type="full-width">
					<div class="kash-actions">
						<button
							type="button"
							class="kash-btn kash-btn--ghost"
							data-test="cancel-button"
							onclick={cancel}
						>
							{i18nDerived.cancel?.() ?? 'CANCEL'}
						</button>
						<button
							type="button"
							class="kash-btn kash-btn--primary"
							data-test="confirm-button"
							onclick={() => {
								confirm();
								eventEmitter.broadcast({ type: 'soundPressGeneral' });
								stateModal.modal = null;
							}}
						>
							{i18nDerived.confirm()}
						</button>
					</div>
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

	.kash-body {
		font-family: 'Europa', sans-serif;
		font-weight: 400;
		font-size: 0.95rem;
		line-height: 1.4;
		color: white;
		opacity: 0.92;
		text-align: center;
		white-space: pre-line;
	}

	.kash-actions {
		display: flex;
		flex-direction: row;
		gap: 0.75rem;
		width: 100%;
		justify-content: center;
	}

	.kash-btn {
		flex: 1;
		max-width: 220px;
		height: 3rem;
		font-family: 'Europa', sans-serif;
		font-weight: 900;
		font-size: 1rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: 999px;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0 1rem;
	}

	.kash-btn--primary {
		color: var(--kash-dark);
		background: linear-gradient(180deg, var(--kash-lime), #b6e02a);
		border: none;
		box-shadow: 0 6px 20px rgba(212, 255, 58, 0.35);
	}

	.kash-btn--primary:hover {
		filter: brightness(1.05);
		box-shadow: 0 8px 28px rgba(212, 255, 58, 0.55);
	}

	.kash-btn--ghost {
		color: var(--kash-teal);
		background: transparent;
		border: 2px solid var(--kash-teal);
	}

	.kash-btn--ghost:hover {
		background: rgba(20, 184, 166, 0.12);
		border-color: var(--kash-lime);
		color: var(--kash-lime);
	}
</style>
