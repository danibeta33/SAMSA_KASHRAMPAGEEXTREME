<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Popup } from 'components-shared';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';
	import BaseScrollable from './BaseScrollable.svelte';

	type Props = {
		children: Snippet;
		payTable?: Snippet;
	};

	const props: Props = $props();
</script>

{#if stateModal.modal?.name === 'payTable'}
	<Popup zIndex={180} onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			<div class="kash-doc">
				<h2 class="kash-doc__title">PAYTABLE</h2>
				<BaseScrollable type="column">
					<div class="kash-doc__body">
						{#if props.payTable}
							{@render props.payTable()}
						{:else}
							<span>ADD YOUR PAY TABLE</span>
						{/if}
						{@render props.children()}
					</div>
				</BaseScrollable>
			</div>
		</BaseContent>
	</Popup>
{/if}

<style lang="scss">
	// Shell brandeado Kash — el contenido lo aporta el snippet del juego.
	.kash-doc {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: min(86vw, 640px);
		max-height: 82vh;
		padding: 26px 26px 20px;
		background: #0d0c0a;
		border: 2px solid var(--kash-lime);
		border-radius: 14px;
		box-shadow: 0 0 34px var(--kash-line);
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		box-sizing: border-box;
	}

	.kash-doc__title {
		margin: 0;
		color: #ec4899;
		font-size: 22px;
		font-weight: 900;
		letter-spacing: 5px;
		text-align: center;
	}

	.kash-doc__body {
		color: #fff;
		font-size: 13px;
		line-height: 1.55;
		padding-right: 6px;

		:global(h1),
		:global(h2),
		:global(h3) {
			color: var(--kash-lime);
			letter-spacing: 2px;
		}

		:global(table) {
			border-collapse: collapse;
		}

		:global(td),
		:global(th) {
			border: 1px solid rgba(236, 72, 153, 0.4);
			padding: 4px 10px;
		}
	}

	.kash-doc__body {
		overflow-x: auto;
	}

	/* Compacto mini-player (popout ≤300px de alto) */
	@media (max-height: 300px) {
		.kash-doc {
			width: 96vw;
			max-height: 94vh;
			padding: 10px 12px 8px;
			gap: 6px;
		}
		.kash-doc__title {
			font-size: 13px;
			letter-spacing: 3px;
		}
	}
</style>
