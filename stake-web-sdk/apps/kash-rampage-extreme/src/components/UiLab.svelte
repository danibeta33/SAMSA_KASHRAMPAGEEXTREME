<script lang="ts">
	// Lab de sliders POR RESOLUCIÓN (tecla T muestra/oculta). Cada bucket de
	// viewport (ver RES_BUCKETS) guarda sus propios valores: redimensioná la
	// ventana (o usá el device toolbar de devtools) hasta ver el bucket que
	// querés ajustar, mové los sliders y quedan persistidos PARA ESE bucket.
	// "COPY" copia el JSON {bucket, valores} para pegarlo en el chat y
	// congelarlo como seed de ese bucket.
	import { onMount } from 'svelte';

	import {
		stateTweak,
		saveTweak,
		resetTweak,
		syncUi,
		labPreview,
		labState,
		RES_BUCKETS,
	} from '../game/stateTweak.svelte';

	import { LAB_SLIDERS } from '../game/labMeta';

	const METER_META = LAB_SLIDERS;

	// Ajuste FINO: un click = un step del slider (Shift = ×10). Persiste al
	// soltar el mouse igual que el slider (acá directo, es un click).
	const fine = (meta: (typeof METER_META)[number], dir: 1 | -1, e: MouseEvent) => {
		const mult = e.shiftKey ? 10 : 1;
		const next = stateTweak[meta.key] + dir * meta.step * mult;
		stateTweak[meta.key] = Math.min(meta.max, Math.max(meta.min, Number(next.toFixed(4))));
		syncUi();
		saveTweak();
	};

	const bucketLabel = () => RES_BUCKETS.find((b) => b.key === labState.bucket)?.label ?? '';

	// 'input' solo actualiza el preview en vivo (reactividad de stateTweak);
	// persistir a localStorage por cada tick de arrastre (JSON + I/O síncrono)
	// tira frames justo cuando se está evaluando el layout — se guarda en
	// 'change' (al soltar el slider).
	const onSlide = (key: (typeof METER_META)[number]['key'], e: Event) => {
		stateTweak[key] = parseFloat((e.target as HTMLInputElement).value);
		syncUi(); // stackScale se refleja en stateUiTweak en vivo
	};

	let visible = $state(false);
	let copied = $state(false);
	let side = $state<'left' | 'right'>('right');

	onMount(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 't' || e.key === 'T') visible = !visible;
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	const copy = async () => {
		const snap = {
			bucket: labState.bucket,
			viewport: `${labState.vw}x${labState.vh}`,
			freeScale: stateTweak.freeScale,
			...Object.fromEntries(METER_META.map((m) => [m.key, stateTweak[m.key]])),
		};
		const json = JSON.stringify(snap, null, 2);
		console.log('[UiLab]', json);
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
			<span>UI LAB</span>
			<button class="lab__side" onclick={() => (side = side === 'right' ? 'left' : 'right')}>⇄</button>
			<span class="lab__hint">(T oculta)</span>
		</div>
		<div class="lab__bucket">
			<span class="lab__bucket-name">{bucketLabel()}</span>
			<span class="lab__bucket-size">{labState.vw}×{labState.vh}</span>
		</div>
		<p class="lab__note">
			Los sliders guardan SOLO para este bucket — redimensioná la ventana para ajustar otro.
		</p>
		<label class="lab__check">
			<input
				type="checkbox"
				checked={stateTweak.freeScale >= 0.5}
				onchange={(e) => {
					stateTweak.freeScale = (e.target as HTMLInputElement).checked ? 1 : 0;
					saveTweak();
				}}
			/>
			<span>LIBRE — sin límites anti-solape (los sliders mandan)</span>
		</label>
		{#each METER_META as meta (meta.key)}
			<label class="lab__row">
				<span class="lab__label">{meta.label}</span>
				<button class="lab__fine" onclick={(e) => fine(meta, -1, e)} title="fino − (Shift ×10)">−</button>
				<input
					type="range"
					min={meta.min}
					max={meta.max}
					step={meta.step}
					value={stateTweak[meta.key]}
					oninput={(e) => onSlide(meta.key, e)}
					onchange={saveTweak}
				/>
				<button class="lab__fine" onclick={(e) => fine(meta, 1, e)} title="fino + (Shift ×10)">+</button>
				<span class="lab__value">{stateTweak[meta.key]}</span>
			</label>
		{/each}
		<p class="lab__note" style="margin-top: 2px">− / + = un paso fino · Shift+click = ×10</p>
		<div class="lab__actions">
			<button onclick={copy}>{copied ? '✓ COPIADO' : 'COPY VALUES'}</button>
			<button onclick={resetTweak}>RESET BUCKET</button>
		</div>
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
