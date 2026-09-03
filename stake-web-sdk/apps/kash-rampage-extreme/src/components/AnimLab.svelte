<script lang="ts">
	// ANIM LAB (dev only) — dispara TODAS las animaciones/celebraciones reales
	// del juego a demanda para diagnosticar. Tecla A muestra/oculta.
	// Cada botón emite los MISMOS eventos que el bookEventHandlerMap, así lo que
	// ves es exactamente el componente de producción.
	//
	// Sección KASH: fuerza cada clip (via window.__forceIdle) y muestra en vivo
	// la posición renderizada + líneas de referencia (pies/centro fijados) para
	// detectar si Kash se MUEVE entre clips. Indicador del shake del grid para
	// ver qué animación lo sacude.
	import { onMount } from 'svelte';

	import { stateBet, stateBetDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { winLevelMap } from '../game/winLevelMap';
	import { labPreview } from '../game/stateTweak.svelte';
	import { boardShake } from '../game/boardShake.svelte';
	import { swingAlign } from '../game/swingAlign.svelte';
	import { SFX_MAP, type SoundEffectName, type MusicName } from '../game/sound';

	// Ajuste del bateo: nudge dx/dy/escala en vivo para alinearlo con el idle.
	const nudge = (k: 'dx' | 'dy' | 'dscale', d: number) => (swingAlign[k] += d);
	const resetSwing = () => {
		swingAlign.dx = 0;
		swingAlign.dy = 0;
		swingAlign.dscale = 1;
	};

	const context = getContext();

	let visible = $state(false);
	let running = $state<string | null>(null);

	// ── Diagnóstico en vivo de Kash ──────────────────────────────────────
	type KashDbg = {
		clip: string; frame: number; loop: boolean;
		cw: number; ch: number; cx: number; feetY: number;
		dispW: number; dispH: number; leftX: number; rightX: number; topY: number;
	};
	let dbg = $state<KashDbg | null>(null);
	let pinned = $state<{ cx: number; feetY: number } | null>(null);
	let showGuides = $state(true);
	let raf = 0;
	onMount(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.key === 'a' || e.key === 'A') && !/input|textarea/i.test((e.target as HTMLElement)?.tagName ?? ''))
				visible = !visible;
		};
		window.addEventListener('keydown', handler);
		const loop = () => {
			dbg = (globalThis as unknown as { __kashDbg?: KashDbg }).__kashDbg ?? null;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			window.removeEventListener('keydown', handler);
			cancelAnimationFrame(raf);
		};
	});

	const forceIdle = (clip: string) =>
		(globalThis as unknown as { __forceIdle?: (c: string) => void }).__forceIdle?.(clip);

	const KASH_CLIPS = [
		{ label: 'STAND (loop)', clip: 'anim_kash_idle_stand1' },
		{ label: 'Glasses', clip: 'anim_kash_idle_glasses1' },
		{ label: 'Scratch', clip: 'anim_kash_idle_scratch1' },
		{ label: 'Nose', clip: 'anim_kash_idle_nose1' },
		{ label: 'Bat 1 (gesto)', clip: 'anim_kash_idle_bat1' },
		{ label: 'Bat 2 (gesto)', clip: 'anim_kash_idle_bat2' },
		{ label: 'SWING (batea) 🏏', clip: 'anim_kash_swing' },
	];

	// px de pantalla ← coords de canvas (canvas llena el viewport)
	const toScreenX = (x: number) => (dbg ? (x / dbg.cw) * window.innerWidth : 0);
	const toScreenY = (y: number) => (dbg ? (y / dbg.ch) * window.innerHeight : 0);

	const levelByAlias = (alias: string) =>
		Object.values(winLevelMap).find((l) => l.alias === alias) ?? winLevelMap[3];

	const WINS = [
		{ label: 'SMALL WIN', alias: 'small', amount: 2_300 },
		{ label: 'BIG WIN', alias: 'big', amount: 12_000 },
		{ label: 'MEGA WIN', alias: 'superwin', amount: 150_000 },
		{ label: 'MAX WIN', alias: 'max', amount: 5_000_000 },
	];

	const run = async (label: string, fn: () => Promise<void>) => {
		if (running) return;
		running = label;
		try {
			await fn();
		} finally {
			running = null;
		}
	};

	// SITUACIÓN REAL de win — la MISMA coreografía que bookEventHandlerMap.setWin:
	// Kash batea (la promesa resuelve en el frame de golpe: shake + AU-09),
	// la celebración entra con el impacto, suena el sting del tier y al final
	// vuelve la música base. Lo que ves/escuchás acá es lo que ve el jugador.
	const playWin = (alias: string, amount: number, label: string) =>
		run(label, async () => {
			const winLevelData = levelByAlias(alias);
			await context.eventEmitter.broadcastAsync({ type: 'kashSwing' });
			context.eventEmitter.broadcast({ type: 'winShow' });
			if (alias === 'small') {
				context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_winlevel_small' });
			}
			if (winLevelData?.sound?.sfx) {
				context.eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
			}
			if (winLevelData?.sound?.bgm) {
				context.eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
			}
			await context.eventEmitter.broadcastAsync({ type: 'winUpdate', amount, winLevelData });
			context.eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
			context.eventEmitter.broadcast({ type: 'winHide' });
		});

	// Trigger de bonus (capa de sonidos real: gold bar pesado → bass drop →
	// fanfarria) + intro visual con su jingle y swap de música, y vuelta a base.
	const playBonusTrigger = () =>
		run('BONUS TRIGGER', async () => {
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win_v2' });
			await new Promise((r) => setTimeout(r, 500));
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_superfreespin' });
			await context.eventEmitter.broadcastAsync({ type: 'transition' });
			context.eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
			context.eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
			await context.eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: 10,
			});
			context.eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
			context.eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
		});

	const playIntro = () =>
		run('FS INTRO', async () => {
			context.eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
			await context.eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: 10,
			});
			context.eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		});

	const playOutro = (alias: string, amount: number, label: string) =>
		run(label, async () => {
			const winLevelData = levelByAlias(alias);
			context.eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_youwon_panel' });
			await context.eventEmitter.broadcastAsync({
				type: 'freeSpinOutroCountUp',
				amount,
				winLevelData,
			});
			context.eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
			context.eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		});

	const playTransition = () =>
		run('TRANSITION', async () => {
			await context.eventEmitter.broadcastAsync({ type: 'transition' });
		});

	// ── TIRADA DE BATEO 🎲 — spin REAL de base game con KASH RAMPAGE ──────
	// Arma el mock RGS (/debug/arm-next tier 'rampage'): la próxima /wallet/play
	// devuelve un book AL AZAR del pool de base books que traen kashRampage —
	// cada tirada es distinta (board, conversiones, premiums y pago). Después
	// dispara el MISMO evento 'bet' del botón SPIN, así corre la vía completa
	// de producción (reveal con símbolos viejos → swing → estallido → caída).
	// Solo funciona contra el mock (rgs_url local); contra un RGS real el
	// endpoint no existe y la tirada sale normal.
	const playRampageSpin = () =>
		run('TIRADA BATEO', async () => {
			const rgsUrl = new URLSearchParams(window.location.search).get('rgs_url');
			if (rgsUrl) {
				try {
					await fetch(`${rgsUrl}/debug/arm-next`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ tier: 'rampage' }),
					});
				} catch {
					// RGS sin debug panel — la tirada sale igual, sin forzar.
				}
			}
			if (stateBetDerived.activeBetMode()?.type === 'buy') {
				stateBet.activeBetModeKey = 'BASE';
			}
			context.eventEmitter.broadcast({ type: 'bet' });
		});

	// Anticipación / expectativa de bonus (2 scatters y el 3ro por caer): la
	// MISMA vía que producción — se marca `anticipating` en los reels y
	// Anticipations.svelte enciende la carga eléctrica + sonidos, apagándose
	// solo cuando el efecto completa. Recorre reel 5 y luego 6, como en juego.
	const playAnticipation = () =>
		run('ANTICIPACIÓN', async () => {
			for (const reelIndex of [4, 5]) {
				const reel = context.stateGame.board[reelIndex];
				reel.reelState.anticipating = true;
				const t0 = Date.now();
				while (reel.reelState.anticipating && Date.now() - t0 < 4000) {
					await new Promise((r) => setTimeout(r, 120));
				}
				reel.reelState.anticipating = false;
			}
		});

	// ── Soundboard: escuchar cada sonido, uno por uno ────────────────────
	// Agrupa el SFX_MAP por ARCHIVO (varios nombres comparten AU) — un botón
	// por archivo, tocado vía soundOnce con un nombre representativo (así
	// respeta el SFX_GAIN real de ese momento de juego).
	const SOUND_LIST = (() => {
		const byPath = new Map<string, SoundEffectName[]>();
		for (const [name, path] of Object.entries(SFX_MAP)) {
			if (!path || name.startsWith('bgm_')) continue;
			const list = byPath.get(path) ?? [];
			list.push(name as SoundEffectName);
			byPath.set(path, list);
		}
		return [...byPath.entries()]
			.map(([path, names]) => ({
				au: path.split('/').pop()!.replace('.mp3', ''),
				names,
			}))
			.sort((a, b) => a.au.localeCompare(b.au, undefined, { numeric: true }));
	})();

	const MUSIC_LIST: { label: string; name: MusicName }[] = [
		{ label: 'AU-01 — música base', name: 'bgm_main' },
		{ label: 'AU-03 — música bonus', name: 'bgm_freespin' },
		{ label: 'AU-04 — música Rage', name: 'bgm_freespin_rage' },
	];

	const playSound = (name: SoundEffectName) =>
		context.eventEmitter.broadcast({ type: 'soundOnce', name });
</script>

<!-- Guías de referencia sobre el canvas (fuera del panel) -->
{#if visible && showGuides && dbg}
	<!-- línea de pies EN VIVO (verde) -->
	<div class="guide guide--h guide--live" style="top: {toScreenY(dbg.feetY)}px"></div>
	<!-- centro del cuerpo EN VIVO (verde) -->
	<div class="guide guide--v guide--live" style="left: {toScreenX(dbg.cx)}px"></div>
	<!-- bbox EN VIVO -->
	<div
		class="guide guide--box"
		style="left: {toScreenX(dbg.leftX)}px; top: {toScreenY(dbg.topY)}px; width: {toScreenX(dbg.rightX) - toScreenX(dbg.leftX)}px; height: {toScreenY(dbg.feetY) - toScreenY(dbg.topY)}px"
	></div>
	{#if pinned}
		<!-- referencia FIJADA (rosa) — comparar contra la viva -->
		<div class="guide guide--h guide--pin" style="top: {toScreenY(pinned.feetY)}px"></div>
		<div class="guide guide--v guide--pin" style="left: {toScreenX(pinned.cx)}px"></div>
	{/if}
{/if}

{#if visible}
	<div class="alab">
		<div class="alab__title">
			<span>ANIM LAB</span>
			<span class="alab__hint">(A oculta)</span>
		</div>

		<div class="alab__group">KASH — CLIPS</div>
		{#each KASH_CLIPS as k (k.clip)}
			<button class="alab__kash" onclick={() => forceIdle(k.clip)}>{k.label}</button>
		{/each}

		<div class="alab__group">ALINEAR BATEO</div>
		<label class="alab__check">
			<input type="checkbox" bind:checked={swingAlign.ghost} />
			<span>Ghost idle (referencia)</span>
		</label>
		<div class="alab__dbg">
			dx: <b>{Math.round(swingAlign.dx)}</b> · dy: <b>{Math.round(swingAlign.dy)}</b> · escala:
			<b>{swingAlign.dscale.toFixed(3)}</b>
		</div>
		<div class="alab__row">
			<button class="alab__mini" onclick={() => nudge('dx', -5)}>◀ x-5</button>
			<button class="alab__mini" onclick={() => nudge('dx', -1)}>x-1</button>
			<button class="alab__mini" onclick={() => nudge('dx', 1)}>x+1</button>
			<button class="alab__mini" onclick={() => nudge('dx', 5)}>x+5 ▶</button>
		</div>
		<div class="alab__row">
			<button class="alab__mini" onclick={() => nudge('dy', -5)}>▲ y-5</button>
			<button class="alab__mini" onclick={() => nudge('dy', -1)}>y-1</button>
			<button class="alab__mini" onclick={() => nudge('dy', 1)}>y+1</button>
			<button class="alab__mini" onclick={() => nudge('dy', 5)}>y+5 ▼</button>
		</div>
		<div class="alab__row">
			<button class="alab__mini" onclick={() => nudge('dscale', -0.02)}>escala −</button>
			<button class="alab__mini" onclick={() => nudge('dscale', 0.02)}>escala +</button>
			<button class="alab__mini" onclick={resetSwing}>reset</button>
		</div>
		<div class="alab__hint" style="line-height:1.4">
			Activá el ghost, reproducí SWING y movelo hasta que calce. Pasame los
			valores dx/dy/escala y los horneo.
		</div>

		<div class="alab__group">DIAGNÓSTICO</div>
		<div class="alab__dbg">
			{#if dbg}
				<div>clip: <b>{dbg.clip.replace('anim_kash_', '')}</b></div>
				<div>frame: <b>{dbg.frame}</b> {dbg.loop ? '(loop)' : ''}</div>
				<div>centro X: <b>{Math.round(dbg.cx)}</b> · pies Y: <b>{Math.round(dbg.feetY)}</b></div>
				<div>alto: <b>{Math.round(dbg.dispH)}</b> · ancho: <b>{Math.round(dbg.dispW)}</b></div>
				{#if pinned}
					<div class="alab__delta" class:alab__delta--bad={Math.abs(dbg.cx - pinned.cx) > 2 || Math.abs(dbg.feetY - pinned.feetY) > 2}>
						Δ vs pin → X: {Math.round(dbg.cx - pinned.cx)} · Y: {Math.round(dbg.feetY - pinned.feetY)}
					</div>
				{/if}
			{:else}
				<div>(sin datos — landscape only)</div>
			{/if}
			<div class="alab__shake" class:alab__shake--on={Math.abs(boardShake.x) > 0.5 || Math.abs(boardShake.y) > 0.5}>
				GRID shake → x:{Math.round(boardShake.x)} y:{Math.round(boardShake.y)}
			</div>
		</div>
		<div class="alab__row">
			<button class="alab__mini" onclick={() => (pinned = dbg ? { cx: dbg.cx, feetY: dbg.feetY } : null)}>
				📌 fijar ref
			</button>
			<button class="alab__mini" onclick={() => (pinned = null)}>limpiar</button>
		</div>
		<label class="alab__check">
			<input type="checkbox" bind:checked={showGuides} />
			<span>Guías (pies/centro/bbox)</span>
		</label>

		<div class="alab__group">SITUACIONES (flujo real: bateo + sonidos)</div>
		{#each WINS as w (w.label)}
			<button disabled={running !== null} onclick={() => playWin(w.alias, w.amount, w.label)}>
				{running === w.label ? '▶ …' : w.label}
			</button>
		{/each}
		<button disabled={running !== null} onclick={playRampageSpin}>TIRADA BATEO 🏏🎲</button>
		<button disabled={running !== null} onclick={playBonusTrigger}>BONUS TRIGGER 🎰</button>
		<button disabled={running !== null} onclick={playAnticipation}>ANTICIPACIÓN ⚡ (reels 5-6)</button>

		<div class="alab__group">FREE SPINS</div>
		<button disabled={running !== null} onclick={playIntro}>FS INTRO (10 SPINS)</button>
		<button disabled={running !== null} onclick={() => playOutro('big', 87_500, 'FS OUTRO')}>
			FS OUTRO (BIG)
		</button>

		<div class="alab__group">OTROS</div>
		<button disabled={running !== null} onclick={playTransition}>TRANSITION</button>

		<div class="alab__group">SONIDOS — UNO POR UNO</div>
		{#each MUSIC_LIST as m (m.name)}
			<button class="alab__snd" onclick={() => context.eventEmitter.broadcast({ type: 'soundMusic', name: m.name })}>
				♫ {m.label}
			</button>
		{/each}
		{#each SOUND_LIST as s (s.au)}
			<button class="alab__snd" title={s.names.join(', ')} onclick={() => playSound(s.names[0])}>
				🔊 {s.au} — {s.names[0].replace('sfx_', '')}{s.names.length > 1 ? ` (+${s.names.length - 1})` : ''}
			</button>
		{/each}
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
	.alab__kash {
		border-color: #e02330 !important;
	}
	.alab__snd {
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
	.alab__delta {
		margin-top: 3px;
		color: #6ee7b7;
	}
	.alab__delta--bad {
		color: #ff5c8a;
		font-weight: 700;
	}
	.alab__shake {
		margin-top: 4px;
		color: #667;
	}
	.alab__shake--on {
		color: #ffd166;
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
	.guide--live {
		color: #34d399;
	}
	.guide--pin {
		color: #e02330;
	}
	.guide--box {
		border: 1px solid rgba(52, 211, 153, 0.5);
	}
</style>
