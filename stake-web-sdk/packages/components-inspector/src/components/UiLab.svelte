<script lang="ts">
	// PANEL GENÉRICO DE CONTROLES (por defecto tecla T).
	//
	// No importa nada de ningún juego: todo lo que renderiza sale del registro
	// que recibe por prop (`inspector` del SDK por defecto), que el juego llena
	// en runtime. Etiquetas, rangos, categorías, clave de persistencia y estado
	// del encabezado los aporta el host — este componente solo dibuja y despacha.
	import { onMount } from 'svelte';

	import {
		inspector,
		type InspectorRegistry,
		type InspectorSlider,
	} from '../InspectorRegistry.svelte';

	type Props = {
		/** Registro a renderizar. */
		registry?: InspectorRegistry;
		/** Tecla que muestra/oculta el panel. */
		toggleKey?: string;
	};

	const { registry = inspector, toggleKey = 't' }: Props = $props();

	// Catálogo agrupado — se recalcula solo si el juego registra/quita controles.
	const groups = $derived(registry.groups);

	// Ajuste FINO: un click = un step del control (Shift = ×10). El registro
	// clampa, redondea y persiste.
	const fine = (control: InspectorSlider, dir: 1 | -1, e: MouseEvent) =>
		registry.step(control.id, dir, e.shiftKey ? 10 : 1);

	// 'input' solo actualiza el preview en vivo (el host sincroniza lo que
	// haga falta); persistir a localStorage por cada tick de arrastre (JSON +
	// I/O síncrono) tira frames justo cuando se está evaluando el layout — se
	// guarda en 'change' (al soltar el slider).
	const onSlide = (id: string, e: Event) =>
		registry.write(id, parseFloat((e.target as HTMLInputElement).value));

	let visible = $state(false);
	let copied = $state(false);
	let side = $state<'left' | 'right'>('right');

	onMount(() => {
		const key = toggleKey.toLowerCase();
		const handler = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;
			if (e.key.toLowerCase() === key) visible = !visible;
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	const copy = async () => {
		const json = JSON.stringify(registry.snapshot(), null, 2);
		console.log(`[${registry.title}]`, json);
		try {
			await navigator.clipboard.writeText(json);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard puede fallar sin gesto/https — queda el console.log */
		}
	};
</script>

{#if visible}
	<div class="lab" style={side === 'right' ? 'right: 12px; left: auto;' : 'left: 12px; right: auto;'}>
		<div class="lab__title">
			<span>{registry.title}</span>
			<button class="lab__side" onclick={() => (side = side === 'right' ? 'left' : 'right')}>⇄</button>
			<span class="lab__hint">({toggleKey.toUpperCase()} oculta)</span>
		</div>
		{#if !registry.ready}
			<p class="lab__note">Sin controles registrados — el juego todavía no llamó a configure().</p>
		{:else}
			<div class="lab__bucket">
				<span class="lab__bucket-name">{registry.status.label}</span>
				<span class="lab__bucket-size">{registry.status.detail ?? ''}</span>
			</div>
			{#if registry.note}
				<p class="lab__note">{registry.note}</p>
			{/if}
			{#each groups as group (group.category.id)}
				{#if groups.length > 1}
					<div class="lab__cat">{group.category.label}</div>
				{/if}
				{#each group.controls as control (control.id)}
					{#if control.kind === 'toggle'}
						<label class="lab__check">
							<input
								type="checkbox"
								checked={registry.isOn(control.id)}
								onchange={(e) => registry.toggle(control.id, (e.target as HTMLInputElement).checked)}
							/>
							<span>{control.label}</span>
						</label>
					{:else}
						<label class="lab__row">
							<span class="lab__label">{control.label}</span>
							<button class="lab__fine" onclick={(e) => fine(control, -1, e)} title="fino − (Shift ×10)">−</button>
							<input
								type="range"
								min={control.min}
								max={control.max}
								step={control.step}
								value={registry.read(control.id)}
								oninput={(e) => onSlide(control.id, e)}
								onchange={() => registry.commit()}
							/>
							<button class="lab__fine" onclick={(e) => fine(control, 1, e)} title="fino + (Shift ×10)">+</button>
							<span class="lab__value">{registry.read(control.id)}</span>
						</label>
					{/if}
				{/each}
			{/each}
			<p class="lab__note" style="margin-top: 6px">− / + = un paso fino · Shift+click = ×10</p>
			<div class="lab__actions">
				<button onclick={copy}>{copied ? '✓ COPIADO' : 'COPY VALUES'}</button>
				<button onclick={() => registry.reset()}>RESET BUCKET</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.lab {
		position: fixed;
		top: 90px;
		left: 12px;
		z-index: 9999;
		background: rgba(13, 12, 10, 0.94);
		color: #f6ef1b;
		font-family: system-ui, sans-serif;
		font-size: 12px;
		padding: 12px 14px;
		border: 1px solid #e02330;
		border-radius: 6px;
		width: 275px;
		max-height: calc(100vh - 110px);
		overflow-y: auto;
		user-select: none;
	}
	.lab__title {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
		font-weight: 700;
		color: #e02330;
		letter-spacing: 1px;
	}
	.lab__hint {
		color: #777;
		font-size: 10px;
		font-weight: 400;
	}
	.lab__bucket {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 4px;
		padding: 4px 6px;
		border: 1px solid rgba(212, 255, 58, 0.4);
		border-radius: 4px;
	}
	.lab__bucket-name {
		font-weight: 700;
		color: #f6ef1b;
		font-size: 12px;
	}
	.lab__bucket-size {
		color: #fff;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.lab__note {
		margin: 0 0 8px;
		color: #999;
		font-size: 10px;
		line-height: 1.35;
	}
	.lab__cat {
		margin: 8px 0 4px;
		color: #b9a97a;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 1px;
		border-bottom: 1px solid rgba(246, 239, 27, 0.2);
	}
	.lab__check {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 8px;
		color: #f6ef1b;
		font-size: 11px;
		cursor: pointer;
	}
	.lab__check input {
		accent-color: #e02330;
	}
	.lab__side {
		background: transparent;
		border: 1px solid #e02330;
		color: #e02330;
		border-radius: 4px;
		font-size: 12px;
		line-height: 1;
		padding: 2px 8px;
		cursor: pointer;
	}
	.lab__side:hover {
		background: rgba(236, 72, 153, 0.2);
	}
	.lab__row {
		display: grid;
		grid-template-columns: 78px 18px 1fr 18px 44px;
		align-items: center;
		gap: 4px;
		margin-bottom: 5px;
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
	.lab__fine:hover {
		background: rgba(236, 72, 153, 0.2);
	}
	.lab__label {
		font-size: 11px;
	}
	.lab__value {
		text-align: right;
		color: #fff;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.lab__row input[type='range'] {
		width: 100%;
		accent-color: #e02330;
	}
	.lab__actions {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
	.lab__actions button {
		flex: 1;
		background: transparent;
		border: 1px solid #f6ef1b;
		color: #f6ef1b;
		padding: 6px;
		font-size: 11px;
		letter-spacing: 1px;
		cursor: pointer;
		border-radius: 4px;
	}
	.lab__actions button:hover {
		background: rgba(212, 255, 58, 0.15);
	}
</style>
