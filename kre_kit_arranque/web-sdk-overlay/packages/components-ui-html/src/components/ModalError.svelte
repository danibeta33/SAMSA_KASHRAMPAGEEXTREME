<script lang="ts">
	import { Popup } from 'components-shared';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';

	// El error puede llegar como string, como Response-shape { error, message }
	// o como objeto arbitrario del RGS ({ code, message }) — nunca imprimirlo
	// crudo (termina en "[object Object]").
	const describe = (error: unknown): string => {
		if (error == null) return 'unknown error';
		if (typeof error === 'string') return error;
		// Un Error tiene message/stack NO enumerables → JSON.stringify da "{}".
		// Extraerlos a mano para ver la causa real.
		if (error instanceof Error) {
			return `${error.name}: ${error.message}${error.stack ? '\n\n' + error.stack : ''}`;
		}
		const anyE = error as Record<string, unknown>;
		if (typeof anyE.message === 'string') return anyE.message;
		try {
			// getOwnPropertyNames captura props no-enumerables (Error-like)
			return JSON.stringify(error, Object.getOwnPropertyNames(error), 1);
		} catch {
			return String(error);
		}
	};
</script>

{#if stateModal.modal?.name === 'error'}
	<Popup zIndex={180} persistent onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			{@const error = stateModal.modal?.error}
			<div class="kash-error">
				<h2 class="kash-error__title">SOMETHING WENT WRONG</h2>
				<p class="kash-error__hint">Reload the game to keep playing.</p>
				<div class="scrollY kash-error__detail">
					<pre>{describe(error?.error && error?.message ? { error: error.error, message: error.message } : error)}</pre>
				</div>
			</div>
		</BaseContent>
	</Popup>
{/if}

<style lang="scss">
	.kash-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: min(92vw, 460px);
		padding: 30px 28px 24px;
		background: #0d0c0a;
		border: 2px solid var(--kash-lime);
		border-radius: 14px;
		box-shadow: 0 0 34px var(--kash-line);
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		box-sizing: border-box;
	}

	.kash-error__title {
		margin: 0;
		color: #ec4899;
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 4px;
		text-align: center;
	}

	.kash-error__hint {
		margin: 0;
		color: #fff;
		opacity: 0.9;
		font-size: 13px;
		text-align: center;
	}

	.kash-error__detail {
		max-height: 110px;
		width: 100%;
		border-radius: 10px;
		border: 2px solid rgba(236, 72, 153, 0.55);
		padding: 10px 14px;
		box-sizing: border-box;

		pre {
			margin: 0;
			color: var(--kash-lime);
			font-size: 11px;
			line-height: 1.5;
			white-space: pre-wrap;
			word-break: break-word;
			font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		}
	}
</style>
