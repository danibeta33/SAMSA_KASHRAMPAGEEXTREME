<script lang="ts">
	import { page } from '$app/state';
	// DEV — selector de resoluciones DE STAKE + UI LAB EXTERNO (pedido del
	// usuario: el panel vive acá, a la DERECHA, fuera del frame del juego —
	// no tapa nada). El juego corre en un iframe same-origin al tamaño exacto
	// del preset; el panel manipula directamente los objetos del iframe vía
	// los hooks DEV (__stateTweak/__saveTweak/__syncUi/…) — mutar el $state
	// proxy desde el padre dispara la reactividad normal adentro.
	import { LAB_SLIDERS, type LabSliderKey } from '../../game/labMeta';

	// Presets APROBADOS por el usuario (check verde). Es por PRESET, no por
	// bucket: los 3 Mobile comparten bucket 'portrait' pero cada tamaño se
	// aprueba por separado mirándolo.
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

	// Copia local reactiva de los valores del iframe (los sliders muestran
	// esto; cada cambio se empuja al __stateTweak del iframe).
	let vals = $state<Record<string, number>>({});
	let bucket = $state('…');
	let connected = $state(false);
	let copied = $state(false);

	type GameWindow = Window & {
		__stateTweak?: Record<string, number>;
		__labState?: { bucket: string; vw: number; vh: number };
		__saveTweak?: () => void;
		__resetTweak?: () => void;
		__syncUi?: () => void;
	};

	const gw = () => (frame?.contentWindow ?? null) as GameWindow | null;

	// El iframe tarda en montar el juego — poll hasta que los hooks existan.
	let pollId: ReturnType<typeof setInterval> | undefined;
	const connect = () => {
		connected = false;
		clearInterval(pollId);
		pollId = setInterval(() => {
			const w = gw();
			if (!w?.__stateTweak || !w.__labState) return;
			clearInterval(pollId);
			pull();
			connected = true;
		}, 300);
	};

	// Leer estado actual del iframe → panel.
	const pull = () => {
		const w = gw();
		if (!w?.__stateTweak) return;
		const next: Record<string, number> = {};
		for (const s of LAB_SLIDERS) next[s.key] = w.__stateTweak[s.key];
		next.freeScale = w.__stateTweak.freeScale;
		vals = next;
		bucket = w.__labState?.bucket ?? '?';
	};

	// Empujar un valor al iframe (en vivo) — persiste con push(save=true).
	const push = (key: string, value: number, save = false) => {
		const w = gw();
		if (!w?.__stateTweak) return;
		w.__stateTweak[key] = value;
		vals[key] = value;
		w.__syncUi?.();
		if (save) w.__saveTweak?.();
	};

	const onSlide = (key: LabSliderKey, e: Event) =>
		push(key, parseFloat((e.target as HTMLInputElement).value));

	const fine = (meta: (typeof LAB_SLIDERS)[number], dir: 1 | -1, e: MouseEvent) => {
		const mult = e.shiftKey ? 10 : 1;
		const cur = vals[meta.key] ?? 0;
		const next = Math.min(meta.max, Math.max(meta.min, Number((cur + dir * meta.step * mult).toFixed(4))));
		push(meta.key, next, true);
	};

	const toggleFree = (e: Event) =>
		push('freeScale', (e.target as HTMLInputElement).checked ? 1 : 0, true);


	const reset = () => {
		gw()?.__resetTweak?.();
		pull();
	};

	const copy = async () => {
		const snap = {
			bucket,
			viewport: `${active.w}x${active.h}`,
			...Object.fromEntries([['freeScale', vals.freeScale ?? 0], ...LAB_SLIDERS.map((s) => [s.key, vals[s.key]])]),
		};
		const json = JSON.stringify(snap, null, 2);
		console.log('[sizes lab]', json);
		try {
			await navigator.clipboard.writeText(json);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* queda el console.log */
		}
	};

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
						onload={connect}
					></iframe>
				{/key}
			</div>
		</div>

		<!-- UI LAB externo — fuera del juego, no tapa nada -->
		<aside class="lab">
			<div class="lab__title">
				<span>UI LAB</span>
				<span class="lab__bucket">{connected ? bucket : 'conectando…'}</span>
			</div>
			<p class="lab__note">
				Editás el bucket del preset activo. − / + = paso fino · Shift = ×10.
			</p>
			<label class="lab__check">
				<input type="checkbox" checked={(vals.freeScale ?? 0) >= 0.5} onchange={toggleFree} disabled={!connected} />
				<span>LIBRE — sin límites anti-solape</span>
			</label>
			{#each LAB_SLIDERS as meta (meta.key)}
				<label class="lab__row">
					<span class="lab__label">{meta.label}</span>
					<button class="lab__fine" disabled={!connected} onclick={(e) => fine(meta, -1, e)}>−</button>
					<input
						type="range"
						min={meta.min}
						max={meta.max}
						step={meta.step}
						disabled={!connected}
						value={vals[meta.key] ?? meta.min}
						oninput={(e) => onSlide(meta.key, e)}
						onchange={() => gw()?.__saveTweak?.()}
					/>
					<button class="lab__fine" disabled={!connected} onclick={(e) => fine(meta, 1, e)}>+</button>
					<span class="lab__value">{vals[meta.key] ?? '–'}</span>
				</label>
			{/each}
			<div class="lab__actions">
				<button disabled={!connected} onclick={copy}>{copied ? '✓ COPIADO' : 'COPY VALUES'}</button>
				<button disabled={!connected} onclick={reset}>RESET BUCKET</button>
			</div>
		</aside>
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
	/* ── Panel del lab, columna derecha fija ── */
	.lab {
		width: 300px;
		flex: none;
		background: #0d0c0a;
		border-left: 1px solid #2a2830;
		padding: 14px;
		overflow-y: auto;
		color: #f6ef1b;
		font-size: 12px;
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
