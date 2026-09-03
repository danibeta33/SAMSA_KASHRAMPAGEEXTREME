<script lang="ts">
	import { stateBet, stateModal, type BetModeData } from 'state-shared';
	import { Button } from 'components-shared';
	import { getContextEventEmitter } from 'utils-event-emitter';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import { stateBonus } from '../stateBonus.svelte';
	import type { EmitterEventModal } from '../types';

	type Props = {
		list: BetModeData[];
	};

	const props: Props = $props();
	const { eventEmitter } = getContextEventEmitter<EmitterEventModal>();
</script>

{#each props.list as betModeData}
	{#if betModeData.type !== 'default'}
		{@const isBuy = betModeData.type === 'buy'}
		<div class="kash-bonus-card" class:kash-bonus-card--buy={isBuy}>
			<div class="kash-bonus-card__info">
				<div class="kash-bonus-card__title">
					{betModeData.text.title}
				</div>

				{#if betModeData?.text?.description}
					<div class="kash-bonus-card__description">
						{betModeData.text.description}
					</div>
				{/if}

				<div class="kash-bonus-card__price-block">
					<span class="kash-bonus-card__price-label">Cost</span>
					<span class="kash-bonus-card__price">
						{numberToCurrencyString(stateBet.betAmount * betModeData.costMultiplier)}
					</span>
				</div>
			</div>

			<Button
				onclick={() => {
					stateBonus.selectedBetModeKey = betModeData.mode;
					eventEmitter.broadcast({ type: 'buyBonusConfirm' });
					eventEmitter.broadcast({ type: 'soundPressGeneral' });
				}}
				disabled={stateBet.betAmount <= 0 ||
					stateBet.balanceAmount < stateBet.betAmount * betModeData.costMultiplier}
			>
				<span class="kash-bonus-card__cta">
					{betModeData.text.button}
				</span>
			</Button>
		</div>
	{/if}
{/each}

<style lang="scss">
	.kash-bonus-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1rem;

		min-width: 175px;
		max-width: 200px;
		padding: 1.25rem 1rem;
		box-sizing: border-box;

		background: var(--kash-graybluish);
		border: 2px solid var(--kash-lime);
		border-radius: 12px;
		box-shadow: 0 4px 18px rgba(212, 255, 58, 0.18);

		text-align: center;
		font-family: 'Europa', sans-serif;
	}

	.kash-bonus-card--buy {
		border-color: var(--kash-pink);
		box-shadow: 0 4px 18px rgba(236, 72, 153, 0.3);
	}

	.kash-bonus-card__info {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.kash-bonus-card__title {
		font-family: 'Europa', sans-serif;
		font-weight: 900;
		font-size: 1.15rem;
		line-height: 1.1;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--kash-lime);
		text-shadow: 0 0 10px rgba(212, 255, 58, 0.35);
	}

	.kash-bonus-card--buy .kash-bonus-card__title {
		color: var(--kash-pink);
		text-shadow: 0 0 10px rgba(236, 72, 153, 0.45);
	}

	.kash-bonus-card__description {
		font-family: 'Europa', sans-serif;
		font-weight: 400;
		font-size: 0.78rem;
		line-height: 1.25;
		color: white;
		opacity: 0.85;
		white-space: pre-line;
		min-height: 3.25rem;
	}

	.kash-bonus-card__description:empty {
		display: none;
	}

	.kash-bonus-card__price-block {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-top: 0.4rem;
		border-top: 1px dashed rgba(168, 185, 122, 0.35);
	}

	.kash-bonus-card__price-label {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--kash-textmuted);
	}

	.kash-bonus-card__price {
		font-family: 'Europa', sans-serif;
		font-weight: 900;
		font-size: 1.15rem;
		color: white;
		white-space: nowrap;
	}

	.kash-bonus-card__cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 2.5rem;
		font-family: 'Europa', sans-serif;
		font-weight: 900;
		font-size: 0.95rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--kash-dark);
		background: linear-gradient(180deg, var(--kash-lime), #b6e02a);
		border-radius: 999px;
		box-shadow: 0 4px 14px rgba(212, 255, 58, 0.35);
		transition: all 0.15s ease;
	}

	.kash-bonus-card--buy .kash-bonus-card__cta {
		background: linear-gradient(180deg, var(--kash-pink), #c83780);
		color: white;
		box-shadow: 0 4px 14px rgba(236, 72, 153, 0.4);
	}

	:global(.kash-bonus-card button) {
		padding: 0;
	}

	:global(.kash-bonus-card button:hover .kash-bonus-card__cta) {
		filter: brightness(1.08);
		box-shadow: 0 6px 22px rgba(212, 255, 58, 0.55);
	}

	:global(.kash-bonus-card--buy button:hover .kash-bonus-card__cta) {
		box-shadow: 0 6px 22px rgba(236, 72, 153, 0.6);
	}

	:global(.kash-bonus-card button.disabled .kash-bonus-card__cta) {
		opacity: 0.55;
		filter: grayscale(0.4);
	}
</style>
