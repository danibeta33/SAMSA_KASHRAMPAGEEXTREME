<script lang="ts">
	// PANEL DE CONTROLES REMOTO — misma UI que UiLab pero operando sobre un
	// InspectorRegistry que vive en otro documento (iframe same-origin), a
	// través de `InspectorBridge`. Pensado para páginas de presets/tamaños que
	// embeben el juego y necesitan el panel FUERA del frame para no taparlo.
	//
	// Genérico: el catálogo lo descubre el puente en runtime.
	import type { InspectorBridge } from '../inspectorBridge.svelte';
	import type { InspectorSlider } from '../InspectorRegistry.svelte';

	type Props = {
		bridge: InspectorBridge;
		note?: string;
		/** Permite al host agregar/pisar campos del JSON de COPY VALUES. */
		decorateSnapshot?: (snap: Record<string, unknown>) => Record<string, unknown>;
	};

	const {
		bridge,
		note = 'Editás el estado del documento embebido. − / + = paso fino · Shift = ×10.',
		decorateSnapshot = (s: Record<string, unknown>) => s,
	}: Props = $props();

	let copied = $state(false);

	const fine = (control: InspectorSlider, dir: 1 | -1, e: MouseEvent) =>
		bridge.step(control.id, dir, e.shiftKey ? 10 : 1);

	const copy = async () => {
		const json = JSON.stringify(decorateSnapshot(bridge.snapshot()), null, 2);
		console.log('[inspector remoto]', json);
		try {
			await navigator.clipboard.writeText(json);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* queda el console.log */
		}
	};
</script>

<aside class="lab">
	<div class="lab__title">
		<span>{bridge.title}</span>
		<span class="lab__bucket">{bridge.connected ? bridge.statusLabel : 'conectando…'}</span>
	</div>
	<p class="lab__note">{note}</p>
	{#each bridge.controls as control (control.id)}
		{#if control.kind === 'toggle'}
			<label class="lab__check">
				<input
					type="checkbox"
					checked={bridge.isOn(control)}
					disabled={!bridge.connected}
					onchange={(e) => bridge.toggle(control.id, (e.target as HTMLInputElement).checked)}
				/>
				<span>{control.label}</span>
			</label>
		{:else}
			<label class="lab__row">
				<span class="lab__label">{control.label}</span>
				<button class="lab__fine" disabled={!bridge.connected} onclick={(e) => fine(control, -1, e)}>−</button>
				<input
					type="range"
					min={control.min}
					max={control.max}
					step={control.step}
					disabled={!bridge.connected}
					value={bridge.values[control.id] ?? control.min}
					oninput={(e) => bridge.write(control.id, parseFloat((e.target as HTMLInputElement).value))}
					onchange={() => bridge.commit()}
				/>
				<button class="lab__fine" disabled={!bridge.connected} onclick={(e) => fine(control, 1, e)}>+</button>
				<span class="lab__value">{bridge.values[control.id] ?? '–'}</span>
			</label>
		{/if}
	{/each}
	<div class="lab__actions">
		<button disabled={!bridge.connected} onclick={copy}>{copied ? '✓ COPIADO' : 'COPY VALUES'}</button>
		<button disabled={!bridge.connected} onclick={() => bridge.reset()}>RESET BUCKET</button>
	</div>
</aside>

<style>
	.lab {
		width: 300px;
		flex: none;
		background: #0d0c0a;
		border-left: 1px solid #2a2830;
		padding: 14px;
		overflow-y: auto;
		color: #f6ef1b;
		font-size: 12px;
		font-family: system-ui, sans-serif;
	}
	.lab__title {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-weight: 700;
		color: #e02330;
		letter-spacing: 1px;
		margin-bottom: 6px;
	}
	.lab__bucket {
		color: #f6ef1b;
		font-size: 11px;
	}
	.lab__note {
		margin: 0 0 10px;
		color: #999;
		font-size: 10px;
		line-height: 1.35;
	}
	.lab__check {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		font-size: 11px;
		cursor: pointer;
	}
	.lab__check input {
		accent-color: #e02330;
	}
	.lab__row {
		display: grid;
		grid-template-columns: 74px 18px 1fr 18px 44px;
		align-items: center;
		gap: 4px;
		margin-bottom: 6px;
	}
	.lab__label {
		font-size: 11px;
	}
	.lab__fine {
		width: 18px;
		height: 18px;
		padding: 0;
		background: transparent;
		border: 1px solid rgba(236, 72, 153, 0.55);
		color: #e02330;
		border-radius: 4px;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
	}
	.lab__fine:hover:not(:disabled) {
		background: rgba(236, 72, 153, 0.2);
	}
	.lab__row input[type='range'] {
		width: 100%;
		accent-color: #e02330;
	}
	.lab__value {
		text-align: right;
		color: #fff;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.lab__actions {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.lab__actions button {
		flex: 1;
		background: transparent;
		border: 1px solid #f6ef1b;
		color: #f6ef1b;
		padding: 7px;
		font-size: 11px;
		letter-spacing: 1px;
		cursor: pointer;
		border-radius: 4px;
	}
	.lab__actions button:hover:not(:disabled) {
		background: rgba(212, 255, 58, 0.15);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
