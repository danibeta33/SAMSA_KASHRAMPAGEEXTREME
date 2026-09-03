<script lang="ts">
	import { blur } from 'svelte/transition';
	import { onMount, type Snippet } from 'svelte';

	import { waitForTimeout } from 'utils-shared/wait';

	import OnHotkey from './OnHotkey.svelte';

	type Props = {
		children: Snippet;
		zIndex: number;
		persistent?: boolean;
		onclose: () => void;
	};

	const props: Props = $props();

	const zIndexInternal = {
		topLayer: 2,
		clickToCloseLayer: 2,
		closeButton: 101,
		contentLayer: 100,
	};

	const closeModal = () => (props.persistent ? undefined : props.onclose());

	let disabled = $state(true);

	onMount(async () => {
		await waitForTimeout(300);

		disabled = false;
	});
</script>

<!-- (Se removió un render duplicado de children que quedaba suelto en el
     flujo del documento: contenido fantasma fuera del viewport, doble para
     screen readers y confuso para automation.) -->
<OnHotkey hotkey="Escape" onpress={closeModal} />

<div class="pop-up-wrap" class:disabled style={`z-index: ${props.zIndex};`}>
	<div class="blur-layer"></div>
	<div
		class="top-layer"
		style="--zIndex: {zIndexInternal.topLayer}"
		in:blur={{ duration: 300, opacity: 0 }}
	>
		<div
			tabindex={0}
			class="click-to-close-layer"
			onclick={closeModal}
			onkeypress={closeModal}
			role="button"
			style="--zIndex: {zIndexInternal.clickToCloseLayer}"
		></div>

		{#if !props.persistent}
			<div class="close-button-wrap" style="--zIndex: {zIndexInternal.closeButton}">
				<button
					class="close-button"
					data-test="close-button"
					aria-label="Close"
					onclick={closeModal}
				>
					<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
						<path
							d="M5 5 L19 19 M19 5 L5 19"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							fill="none"
						/>
					</svg>
				</button>
			</div>
		{/if}
		{@render props.children()}
	</div>
</div>

<style lang="scss">
	.pop-up-wrap {
		font-family: 'Europa', sans-serif;
		touch-action: manipulation;
		color: white;
		position: fixed;
		left: 0;
		top: 0;
		bottom: 0;
		right: 0;

		display: flex !important;
		justify-content: center;
		align-items: center;

		&.disabled {
			pointer-events: none;
		}
	}

	.blur-layer {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		right: 0;
		background-color: rgba(13, 12, 10, 0.78);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.top-layer {
		width: 100%;
		height: 100%;
		z-index: var(--zIndex);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.click-to-close-layer {
		z-index: var(--zIndex);

		position: absolute;
		width: 100%;
		height: 100%;
	}

	.close-button-wrap {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: var(--zIndex);
	}

	.close-button {
		cursor: pointer;
		color: var(--kash-lime, #d4ff3a);
		background-color: var(--kash-dark, #0d0c0a);
		border: 2px solid var(--kash-lime, #d4ff3a);
		border-radius: 999px;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		display: grid;
		place-items: center;
		transition: all 0.15s ease;
	}

	.close-button svg {
		display: block;
	}

	.close-button:hover {
		background-color: var(--kash-lime, #d4ff3a);
		color: var(--kash-dark, #0d0c0a);
		box-shadow: 0 0 12px rgba(212, 255, 58, 0.5);
	}
</style>
