<script lang="ts">
	// PANEL GENÉRICO DE ACCIONES + DIAGNÓSTICO (por defecto tecla A).
	//
	// No conoce clips, eventos ni sonidos de ningún juego: dibuja las acciones
	// registradas en el registro que recibe por prop y ejecuta sus callbacks.
	// El bloque de diagnóstico y las guías sobre el canvas salen de
	// `host.diagnostics()`, que el juego publica en px de PANTALLA (es el único
	// que conoce su proyección canvas→pantalla).
	//
	// Lo único que el panel calcula por su cuenta es el FPS, que es genérico.
	import { onMount } from 'svelte';

	import {
		animInspector,
		type InspectorDiagnostics,
		type InspectorRegistry,
	} from '../InspectorRegistry.svelte';

	type Props = {
		registry?: InspectorRegistry;
		/** Tecla que muestra/oculta el panel. */
		toggleKey?: string;
		/** Mostrar el contador de FPS del panel. */
		showFps?: boolean;
	};

	const { registry = animInspector, toggleKey = 'a', showFps = true }: Props = $props();

	const groups = $derived(registry.groups);

	let visible = $state(false);
	let showGuides = $state(true);
	let dbg = $state<InspectorDiagnostics | null>(null);
	let fps = $state(0);

	onMount(() => {
		const key = toggleKey.toLowerCase();
		const handler = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;
			if (e.key.toLowerCase() === key) visible = !visible;
		};
		window.addEventListener('keydown', handler);

		// Un solo rAF para todo el panel: relee el diagnóstico del host y mide
		// FPS con media móvil sobre el último segundo.
		let raf = 0;
		let frames = 0;
		let last = performance.now();
		const loop = () => {
			dbg = registry.diagnostics;
			frames++;
			const now = performance.now();
			if (now - last >= 500) {
				fps = Math.round((frames * 1000) / (now - last));
				frames = 0;
				last = now;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			window.removeEventListener('keydown', handler);
			cancelAnimationFrame(raf);
		};
	});

	const guideStyle = (g: NonNullable<InspectorDiagnostics['guides']>[number]) => {
		const color = g.color ?? '#34d399';
		if (g.kind === 'h') return `top: ${g.y ?? 0}px; color: ${color};`;
		if (g.kind === 'v') return `left: ${g.x ?? 0}px; color: ${color};`;
		return `left: ${g.x ?? 0}px; top: ${g.y ?? 0}px; width: ${g.w ?? 0}px; height: ${g.h ?? 0}px; border-color: ${color};`;
	};
</script>

<!-- Guías de referencia sobre el canvas (fuera del panel) -->
{#if visible && showGuides && dbg?.guides}
	{#each dbg.guides as guide (guide.id)}
		<div class="guide guide--{guide.kind}" style={guideStyle(guide)}></div>
	{/each}
{/if}

{#if visible}
	<div class="alab">
		<div class="alab__title">
			<span>{registry.title}</span>
			<span class="alab__hint">({toggleKey.toUpperCase()} oculta)</span>
		</div>

		{#if !registry.ready}
			<div class="alab__dbg">Sin acciones registradas — el juego todavía no llamó a configure().</div>
		{:else}
			{#if showFps || dbg}
				<div class="alab__dbg">
					{#if showFps}
						<div>fps: <b>{fps}</b></div>
					{/if}
					{#each dbg?.rows ?? [] as row (row.label)}
						<div class:alab__delta--bad={row.highlight}>{row.label}: <b>{row.value}</b></div>
					{/each}
					{#if dbg?.empty && !dbg.rows.length}
						<div>{dbg.empty}</div>
					{/if}
				</div>
				{#if dbg?.guides?.length}
					<label class="alab__check">
						<input type="checkbox" bind:checked={showGuides} />
						<span>Guías sobre el canvas</span>
					</label>
				{/if}
			{/if}

			{#each groups as group (group.category.id)}
				<div class="alab__group">{group.category.label}</div>
				{#each group.controls as control (control.id)}
					{#if control.kind === 'toggle'}
						<label class="alab__check">
							<input
								type="checkbox"
								checked={registry.isOn(control.id)}
								onchange={(e) => registry.toggle(control.id, (e.target as HTMLInputElement).checked)}
							/>
							<span>{control.label}</span>
						</label>
					{/if}
				{/each}
				{#each group.actionRows as row (row.id)}
					{#if row.actions.length > 1 || row.actions[0].variant === 'mini'}
						<div class="alab__row">
							{#each row.actions as action (action.id)}
								<button
									class="alab__mini"
									title={action.title}
									disabled={registry.running !== null}
									onclick={() => registry.run(action.id)}
								>
									{action.label}
								</button>
							{/each}
						</div>
					{:else}
						{@const action = row.actions[0]}
						<button
							class:alab__accent={action.variant === 'accent'}
							class:alab__soft={action.variant === 'soft'}
							title={action.title}
							disabled={registry.running !== null}
							onclick={() => registry.run(action.id)}
						>
							{registry.running === action.id ? '▶ …' : action.label}
						</button>
					{/if}
				{/each}
			{/each}
		{/if}
	</div>
{/if}

<style>
	.alab {
		position: fixed;
		top: 70px;
		right: 12px;
		z-index: 9999;
		background: rgba(13, 12, 10, 0.94);
		color: #f6ef1b;
		font-family: system-ui, sans-serif;
		font-size: 12px;
		padding: 12px 14px;
		border: 1px solid #ff7a1a;
		border-radius: 6px;
		width: 220px;
		max-height: 92vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		user-select: none;
	}
	.alab__title {
		display: flex;
		justify-content: space-between;
		font-weight: 700;
		color: #ff7a1a;
		letter-spacing: 1px;
	}
	.alab__hint {
		color: #777;
		font-size: 10px;
		font-weight: 400;
	}
	.alab__group {
		margin-top: 6px;
		color: #999;
		font-size: 9px;
		letter-spacing: 2px;
	}
	.alab button {
		background: transparent;
		border: 1px solid #ff7a1a;
		color: #fff;
		padding: 7px 8px;
		font-size: 11px;
		letter-spacing: 1px;
		cursor: pointer;
		border-radius: 4px;
		text-align: left;
	}
	.alab button:hover:not(:disabled) {
		background: rgba(20, 184, 166, 0.15);
	}
	.alab button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.alab__accent {
		border-color: #e02330 !important;
	}
	.alab__soft {
		border-color: #666 !important;
		font-size: 10px !important;
		padding: 5px 7px !important;
	}
	.alab__dbg {
		font-family: ui-monospace, monospace;
		font-size: 10px;
		color: #bde;
		line-height: 1.5;
		background: rgba(0, 0, 0, 0.35);
		padding: 6px 7px;
		border-radius: 4px;
	}
	.alab__dbg b {
		color: #f6ef1b;
	}
	.alab__delta--bad {
		color: #ff5c8a;
		font-weight: 700;
	}
	.alab__row {
		display: flex;
		gap: 6px;
	}
	.alab__mini {
		flex: 1;
		font-size: 10px !important;
		padding: 5px 4px !important;
		text-align: center !important;
	}
	.alab__check {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		color: #f6ef1b;
		font-size: 11px;
		cursor: pointer;
	}
	.alab__check input {
		accent-color: #ff7a1a;
	}
	/* Guías sobre el canvas */
	.guide {
		position: fixed;
		z-index: 9998;
		pointer-events: none;
	}
	.guide--h {
		left: 0;
		width: 100vw;
		height: 0;
		border-top: 1px dashed;
	}
	.guide--v {
		top: 0;
		height: 100vh;
		width: 0;
		border-left: 1px dashed;
	}
	.guide--box {
		border: 1px solid;
	}
</style>
