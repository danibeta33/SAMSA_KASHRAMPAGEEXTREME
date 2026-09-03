<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { getContextLayout } from 'utils-layout';
	import { stateModal, stateMetaDerived } from 'state-shared';

	import BonusCards from './BonusCards.svelte';
	import BetMenuAmountToggle from './BetMenuAmountToggle.svelte';
	import BonusContentWrapLarge from './BonusContentWrapLarge.svelte';
	import BonusContentWrapPortrait from './BonusContentWrapPortrait.svelte';
	import BonusContentWrapLandscape from './BonusContentWrapLandscape.svelte';

	const { stateLayoutDerived } = getContextLayout();

	const activateList = $derived(
		stateMetaDerived.betModeMetaList().filter((item) => item.type === 'activate'),
	);

	const buyList = $derived(
		stateMetaDerived.betModeMetaList().filter((item) => item.type === 'buy'),
	);

	const COMPONENT_MAP = {
		desktop: BonusContentWrapLarge,
		tablet: BonusContentWrapLarge,
		portrait: BonusContentWrapPortrait,
		landscape: BonusContentWrapLandscape,
	} as const;

	const BonusContentWrap = $derived(COMPONENT_MAP[stateLayoutDerived.layoutType()]);
</script>

{#if stateModal.modal?.name === 'buyBonus'}
	<Popup zIndex={zIndex.modal} onclose={() => (stateModal.modal = null)}>
		<div class="kash-modal kash-modal--buybonus">
			<h2 class="kash-title">BUY BONUS</h2>
			<p class="kash-subtitle">Pick your weapon</p>
			<BonusContentWrap maxListLength={Math.max(activateList.length, buyList.length)}>
				{#snippet betAmount()}
					<div class="kash-bet-display">
						<BetMenuAmountToggle />
					</div>
				{/snippet}

				{#snippet bonusCardsActivate()}
					<BonusCards list={activateList} />
				{/snippet}

				{#snippet bonusCardsBuy()}
					<BonusCards list={buyList} />
				{/snippet}
			</BonusContentWrap>
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
		max-width: 900px;
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
		margin: 0;
		font-family: 'Europa', sans-serif;
		font-weight: 700;
		font-size: 0.85rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--kash-textmuted);
		text-align: center;
	}

	.kash-bet-display {
		display: inline-flex;
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
		font-size: 1.5rem;
		color: var(--kash-lime);
		min-width: 6rem;
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
</style>
