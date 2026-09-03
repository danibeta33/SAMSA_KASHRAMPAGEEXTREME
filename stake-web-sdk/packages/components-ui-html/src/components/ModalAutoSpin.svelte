<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';
	import { scrollIntoView } from 'utils-shared/scroll';

	import BaseContent from './BaseContent.svelte';
	import BaseScrollable from './BaseScrollable.svelte';
	import BaseButtonWrap from './BaseButtonWrap.svelte';
	import AutoSpinsOptions from './AutoSpinsOptions.svelte';
	import AutoSpinsAdvanced from './AutoSpinsAdvanced.svelte';
	import AutoSpinsStartButton from './AutoSpinsStartButton.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
</script>

{#if stateModal.modal?.name === 'autoSpin'}
	<Popup zIndex={zIndex.modal} onclose={() => (stateModal.modal = null)}>
		<div class="kash-modal kash-modal--autospin">
			<BaseContent maxWidth="100%">
				<h2 class="kash-title">{i18nDerived.autoSpins()}</h2>
				<BaseScrollable type="column">
					{#snippet children({ element })}
						<div class="kash-subtitle" data-test="number-of-rounds">
							{i18nDerived.numberOfRounds()}
						</div>
						<AutoSpinsOptions />
						<AutoSpinsAdvanced
							ontoggle={(duration) => {
								if (element) {
									scrollIntoView({ element, duration });
								}
							}}
						/>
					{/snippet}
				</BaseScrollable>
				<BaseButtonWrap type="full-width">
					<AutoSpinsStartButton />
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

	:global(.kash-modal .ui-modal-title-wrap) {
		font-family: 'Europa', sans-serif;
	}

	/* Option grid buttons (10/25/50/...) — repaint the BaseIcon rectangle into a real chip. */
	:global(.kash-modal--autospin .rectangle) {
		background: var(--kash-graybluish) !important;
		border: 2px solid var(--kash-teal) !important;
		border-radius: 8px !important;
		transition: all 0.15s ease;
	}

	:global(.kash-modal--autospin button:hover .rectangle) {
		border-color: var(--kash-lime) !important;
		box-shadow: 0 0 8px rgba(212, 255, 58, 0.35);
	}

	/* Selected chips have a white solid border per BaseIcon prop — repaint to lime. */
	:global(.kash-modal--autospin .rectangle[style*='white solid']) {
		background: var(--kash-lime) !important;
		border-color: var(--kash-lime) !important;
		box-shadow: 0 0 14px rgba(212, 255, 58, 0.55);
	}

	:global(.kash-modal--autospin button:has(.rectangle[style*='white solid']) .base-button-content) {
		color: var(--kash-dark) !important;
	}

	:global(.kash-modal--autospin .base-button-content) {
		font-family: 'Europa', sans-serif;
		font-weight: 700;
		color: white;
		letter-spacing: 0.02em;
	}

	/* START AUTOPLAY — pill primary CTA */
	:global(.kash-modal--autospin .ui-modal-button-wrap .rectangle) {
		background: linear-gradient(180deg, var(--kash-lime), #b6e02a) !important;
		border: none !important;
		border-radius: 999px !important;
		box-shadow: 0 6px 20px rgba(212, 255, 58, 0.35);
		height: 3.25rem !important;
	}

	:global(.kash-modal--autospin .ui-modal-button-wrap .base-button-content) {
		color: var(--kash-dark) !important;
		font-weight: 900;
		font-size: 1.05rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(.kash-modal--autospin .ui-modal-button-wrap button:hover .rectangle) {
		box-shadow: 0 8px 28px rgba(212, 255, 58, 0.55);
		filter: brightness(1.05);
	}

	:global(.kash-modal--autospin .ui-modal-button-wrap button.disabled .rectangle) {
		opacity: 1;
	}
</style>
