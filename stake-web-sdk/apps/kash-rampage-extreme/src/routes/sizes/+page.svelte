<script lang="ts">
	import { page } from '$app/state';
	// DEV — selector de resoluciones DE STAKE + INSPECTOR EXTERNO (pedido del
	// usuario: el panel vive a la DERECHA, fuera del frame del juego — no tapa
	// nada). El juego corre en un iframe same-origin al tamaño exacto del preset.
	//
	// Toda la lógica del panel es genérica y vive en `components-inspector`:
	// `InspectorBridge` descubre el catálogo en runtime desde el registro del
	// iframe (`window.__inspectors.layout`) e `InspectorRemotePanel` lo dibuja.
	// Esta página solo aporta los presets de Stake y el iframe.
	import { InspectorBridge, InspectorRemotePanel } from 'components-inspector';

	// Presets APROBADOS por el usuario (check verde). Es por PRESET, no por
	// bucket: los 3 Mobile comparten reglas pero cada tamaño se aprueba mirándolo.
	const APPROVED_PRESETS = [
		'Desktop',
		'Laptop',
		'Popout S',
		'Popout L',
		'Mobile L',
		'Mobile M',
		'Mobile S',
	];

	// Los MISMOS tamaños del selector del ACP de Stake (screenshot del usuario, 15-07).
	const PRESETS = [
		{ label: 'Desktop', w: 1200, h: 675 },
		{ label: 'Laptop', w: 1024, h: 576 },
		{ label: 'Popout S', w: 400, h: 225 },
		{ label: 'Popout L', w: 800, h: 450 },
		{ label: 'Mobile L', w: 425, h: 812 },
		{ label: 'Mobile M', w: 375, h: 667 },
		{ label: 'Mobile S', w: 320, h: 568 },
	];

	let active = $state(PRESETS[0]);
	let vw = $state(0);
	let vh = $state(0);
	let frame = $state<HTMLIFrameElement | null>(null);

	// El puente lee el registro 'layout' del documento embebido.
	const bridge = new InspectorBridge(() => frame?.contentWindow ?? null, 'layout');

	// Escala para que el preset entre en el espacio disponible (nunca agranda).
	const BAR_H = 56;
	const PANEL_W = 300;
	const scale = $derived(
		vw && vh ? Math.min(1, (vw - PANEL_W - 24) / active.w, (vh - BAR_H - 24) / active.h) : 1,
	);

	const rgsUrl = $derived(page.url.searchParams.get('rgs_url') || 'http://127.0.0.1:3032');
	const sessionId = $derived(page.url.searchParams.get('sessionID') || 'mock');
	const gameUrl = $derived(`/?sessionID=${sessionId}&rgs_url=${rgsUrl}`);
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<svelte:head>
	<title>Kash Rampage Extreme — tamaños de Stake</title>
</svelte:head>

{#if import.meta.env.DEV}
	<div class="sz">
		<div class="sz__main">
			<div class="sz__bar">
				<span class="sz__title">TAMAÑOS STAKE</span>
				{#each PRESETS as p (p.label)}
					{@const done = APPROVED_PRESETS.includes(p.label)}
					<button
						class="sz__btn"
						class:sz__btn--on={active === p}
						class:sz__btn--done={done}
						onclick={() => (active = p)}
						title={done ? 'Bucket aprobado y congelado en código' : 'Pendiente de ajuste'}
					>
						{p.label}{#if done}<span class="sz__check">✓</span>{/if}<small>{p.w}×{p.h}</small>
					</button>
				{/each}
				{#if scale < 1}
					<span class="sz__hint">mostrado al {Math.round(scale * 100)}%</span>
				{/if}
			</div>
			<div class="sz__stage">
				{#key active.label}
					<iframe
						bind:this={frame}
						title="Kash Rampage Extreme {active.label}"
						src={gameUrl}
						width={active.w}
						height={active.h}
						style="transform: scale({scale});"
						onload={() => bridge.connect()}
					></iframe>
				{/key}
			</div>
		</div>

		<!-- Panel genérico del SDK — fuera del juego, no tapa nada -->
		<InspectorRemotePanel
			{bridge}
			note="Editás el bucket del preset activo. − / + = paso fino · Shift = ×10."
			decorateSnapshot={(snap) => ({ ...snap, viewport: `${active.w}x${active.h}` })}
		/>
	</div>
{:else}
	<p style="color: #fff; font-family: system-ui;">Solo disponible en DEV.</p>
{/if}

<style>
	.sz {
		position: fixed;
		inset: 0;
		background: #17161c;
		display: flex;
		font-family: system-ui, sans-serif;
	}
	.sz__main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.sz__bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: #0d0c0a;
		border-bottom: 1px solid #2a2830;
		flex-wrap: wrap;
	}
	.sz__title {
		color: #e02330;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 2px;
		margin-right: 6px;
	}
	.sz__btn {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		background: transparent;
		border: 1px solid #444;
		color: #ddd;
		border-radius: 5px;
		padding: 5px 10px;
		font-size: 11px;
		cursor: pointer;
	}
	.sz__btn small {
		color: #888;
		font-size: 9px;
	}
	.sz__btn--on {
		border-color: #f6ef1b;
		color: #f6ef1b;
	}
	.sz__btn--done {
		border-color: rgba(52, 211, 153, 0.7);
	}
	.sz__check {
		position: absolute;
		top: -7px;
		right: -7px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #34d399;
		color: #0d0c0a;
		font-size: 10px;
		font-weight: 900;
		line-height: 15px;
	}
	.sz__btn--on small {
		color: #f6ef1b;
	}
	.sz__hint {
		margin-left: auto;
		color: #777;
		font-size: 10px;
	}
	.sz__stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.sz__stage iframe {
		border: 1px solid #3a3842;
		border-radius: 4px;
		background: #000;
		transform-origin: center center;
		flex: none;
	}
</style>
