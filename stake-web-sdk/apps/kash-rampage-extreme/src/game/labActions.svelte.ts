// PUENTE JUEGO → ANIM LAB (inyección de acciones).
//
// Todo lo que antes vivía hardcodeado dentro de AnimLab.svelte (clips de Kash,
// coreografías de win, bonus, free spins, tirada de rampage, soundboard,
// alineación del swing y diagnóstico visual) se registra acá como ACCIONES y
// DIAGNÓSTICO del registro genérico `animInspector` de `components-inspector`.
//
// El panel solo dibuja botones y ejecuta callbacks: no conoce ni un solo clip
// ni evento de Kash Rampage Extreme.

import { animInspector, type InspectorDiagnostics, type InspectorGuide } from 'components-inspector';
import { stateBet, stateBetDerived } from 'state-shared';

import type { getContext } from './context';
import { winLevelMap } from './winLevelMap';
import { boardShake } from './boardShake.svelte';
import { swingAlign } from './swingAlign.svelte';
import { labPreview } from './stateTweak.svelte';
import { SFX_MAP, type SoundEffectName, type MusicName } from './sound';

type GameContext = ReturnType<typeof getContext>;

// ── Diagnóstico en vivo publicado por Background.svelte ──────────────────
type KashDbg = {
	clip: string;
	frame: number;
	loop: boolean;
	cw: number;
	ch: number;
	cx: number;
	feetY: number;
	dispW: number;
	dispH: number;
	leftX: number;
	rightX: number;
	topY: number;
};

const readDbg = () => (globalThis as unknown as { __kashDbg?: KashDbg }).__kashDbg ?? null;

const forceIdle = (clip: string) =>
	(globalThis as unknown as { __forceIdle?: (c: string) => void }).__forceIdle?.(clip);

/** Referencia fijada con "📌 fijar ref" para comparar entre clips. */
let pinned: { cx: number; feetY: number } | null = null;

const KASH_CLIPS = [
	{ label: 'STAND (loop)', clip: 'anim_kash_idle_stand1' },
	{ label: 'Glasses', clip: 'anim_kash_idle_glasses1' },
	{ label: 'Scratch', clip: 'anim_kash_idle_scratch1' },
	{ label: 'Nose', clip: 'anim_kash_idle_nose1' },
	{ label: 'Bat 1 (gesto)', clip: 'anim_kash_idle_bat1' },
	{ label: 'Bat 2 (gesto)', clip: 'anim_kash_idle_bat2' },
	{ label: 'SWING (batea) 🏏', clip: 'anim_kash_swing' },
];

// El alias tiene que ser el REAL del winLevelMap: Win.svelte mapea alias → tier
// de arte (tierFromAlias), y varios alias comparten cartel. Un botón rotulado
// MEGA con alias 'superwin' mostraba el cartel BIG — el sheet mega no se podía
// ver desde el lab. Se listan los 4 carteles + los 2 alias que comparten arte
// pero cambian sonido y ritmo, para poder revisarlos por separado.
const WINS = [
	{ label: 'SMALL WIN', alias: 'small', amount: 2_300 },
	{ label: 'BIG WIN', alias: 'big', amount: 12_000 },
	{ label: 'SUPER WIN (cartel BIG)', alias: 'superwin', amount: 45_000 },
	{ label: 'MEGA WIN', alias: 'mega', amount: 150_000 },
	{ label: 'EPIC WIN (cartel MEGA)', alias: 'epic', amount: 800_000 },
	{ label: 'MAX WIN', alias: 'max', amount: 5_000_000 },
];

const MUSIC_LIST: { label: string; name: MusicName }[] = [
	{ label: 'AU-01 — música base', name: 'bgm_main' },
	{ label: 'AU-03 — música bonus', name: 'bgm_freespin' },
	{ label: 'AU-04 — música Rage', name: 'bgm_freespin_rage' },
];

// Soundboard: agrupa el SFX_MAP por ARCHIVO (varios nombres comparten AU) —
// un botón por archivo, tocado con un nombre representativo (así respeta el
// SFX_GAIN real de ese momento de juego).
const SOUND_LIST = (() => {
	const byPath = new Map<string, SoundEffectName[]>();
	for (const [name, path] of Object.entries(SFX_MAP)) {
		if (!path || name.startsWith('bgm_')) continue;
		const list = byPath.get(path) ?? [];
		list.push(name as SoundEffectName);
		byPath.set(path, list);
	}
	return [...byPath.entries()]
		.map(([path, names]) => ({ au: path.split('/').pop()!.replace('.mp3', ''), names }))
		.sort((a, b) => a.au.localeCompare(b.au, undefined, { numeric: true }));
})();

const levelByAlias = (alias: string) =>
	Object.values(winLevelMap).find((l) => l.alias === alias) ?? winLevelMap[3];

// px de pantalla ← coords de canvas (el canvas llena el viewport)
const toScreenX = (dbg: KashDbg, x: number) => (x / dbg.cw) * window.innerWidth;
const toScreenY = (dbg: KashDbg, y: number) => (y / dbg.ch) * window.innerHeight;

const buildDiagnostics = (): InspectorDiagnostics => {
	const dbg = readDbg();
	const shaking = Math.abs(boardShake.x) > 0.5 || Math.abs(boardShake.y) > 0.5;
	const rows: InspectorDiagnostics['rows'] = [];
	const guides: InspectorGuide[] = [];

	if (dbg) {
		rows.push({ label: 'clip', value: dbg.clip.replace('anim_kash_', '') });
		rows.push({ label: 'frame', value: `${dbg.frame}${dbg.loop ? ' (loop)' : ''}` });
		rows.push({ label: 'centro X · pies Y', value: `${Math.round(dbg.cx)} · ${Math.round(dbg.feetY)}` });
		rows.push({ label: 'alto · ancho', value: `${Math.round(dbg.dispH)} · ${Math.round(dbg.dispW)}` });
		if (pinned) {
			const dx = Math.round(dbg.cx - pinned.cx);
			const dy = Math.round(dbg.feetY - pinned.feetY);
			rows.push({
				label: 'Δ vs pin (X · Y)',
				value: `${dx} · ${dy}`,
				highlight: Math.abs(dx) > 2 || Math.abs(dy) > 2,
			});
		}
		guides.push({ id: 'feet', kind: 'h', y: toScreenY(dbg, dbg.feetY), color: '#34d399' });
		guides.push({ id: 'center', kind: 'v', x: toScreenX(dbg, dbg.cx), color: '#34d399' });
		guides.push({
			id: 'bbox',
			kind: 'box',
			x: toScreenX(dbg, dbg.leftX),
			y: toScreenY(dbg, dbg.topY),
			w: toScreenX(dbg, dbg.rightX) - toScreenX(dbg, dbg.leftX),
			h: toScreenY(dbg, dbg.feetY) - toScreenY(dbg, dbg.topY),
			color: 'rgba(52, 211, 153, 0.5)',
		});
		if (pinned) {
			guides.push({ id: 'pin-feet', kind: 'h', y: toScreenY(dbg, pinned.feetY), color: '#e02330' });
			guides.push({ id: 'pin-center', kind: 'v', x: toScreenX(dbg, pinned.cx), color: '#e02330' });
		}
	}

	rows.push({
		label: 'swing dx · dy · escala',
		value: `${Math.round(swingAlign.dx)} · ${Math.round(swingAlign.dy)} · ${swingAlign.dscale.toFixed(3)}`,
	});
	rows.push({
		label: 'GRID shake',
		value: `x:${Math.round(boardShake.x)} y:${Math.round(boardShake.y)}`,
		highlight: shaking,
	});

	return { rows, guides, empty: 'sin datos de Kash — landscape only' };
};

let registered = false;

export const registerGameLabActions = (context: GameContext) => {
	if (registered) return;
	registered = true;

	const emit = context.eventEmitter;

	// Los toggles del panel son numéricos (1/0). `swingGhost` va contra
	// `swingAlign`; los dos previews del drop 09-09 contra `labPreview`, que es
	// el mismo objeto que SymbolSprite lee para forzar marco y `_luz` sin tener
	// que esperar un cluster ganador.
	const PREVIEW_TOGGLES: Record<string, string> = {
		previewMarco: 'marco',
		previewLuz: 'luz',
	};

	animInspector.configure({
		title: 'ANIM LAB',
		read: (id) => {
			if (id === 'swingGhost') return swingAlign.ghost ? 1 : 0;
			const key = PREVIEW_TOGGLES[id];
			if (key) return labPreview[key] ? 1 : 0;
			return 0;
		},
		write: (id, value) => {
			if (id === 'swingGhost') swingAlign.ghost = value >= 0.5;
			const key = PREVIEW_TOGGLES[id];
			if (key) labPreview[key] = value >= 0.5;
		},
		diagnostics: buildDiagnostics,
	});

	// ── Previsualización de MARCO + LUZ (drop 09-09) ──────────────────────
	// Los dos efectos de victoria solo existen mientras dura la presentación
	// del cluster, que en un cluster de puro especial son 250 ms. Estos toggles
	// los dejan prendidos en TODO el board para poder revisar encuadre,
	// tamaño y jerarquía (marco detrás del ícono, `_luz` detrás del clip) sin
	// depender de que caiga la combinación.
	animInspector.registerCategory('winfx', { label: 'MARCO + LUZ', order: 1.5 });
	animInspector.registerToggle('previewMarco', {
		label: 'MARCO fijo en todos los símbolos',
		category: 'winfx',
		order: 0,
	});
	animInspector.registerToggle('previewLuz', {
		label: 'LUZ fija en W / S / CASH STACK',
		category: 'winfx',
		order: 1,
	});

	// ── Clips de Kash ─────────────────────────────────────────────────────
	animInspector.registerCategory('clips', { label: 'KASH — CLIPS', order: 0 });
	for (const [i, k] of KASH_CLIPS.entries()) {
		animInspector.registerAction(`clip:${k.clip}`, {
			label: k.label,
			category: 'clips',
			order: i,
			variant: 'accent',
			title: k.clip,
			callback: () => forceIdle(k.clip),
		});
	}

	// ── Alineación del bateo ──────────────────────────────────────────────
	animInspector.registerCategory('swing', { label: 'ALINEAR BATEO', order: 1 });
	animInspector.registerToggle('swingGhost', {
		label: 'Ghost idle (referencia)',
		category: 'swing',
		order: 0,
	});
	const nudge = (k: 'dx' | 'dy' | 'dscale', d: number) => () => (swingAlign[k] += d);
	const NUDGES: { id: string; label: string; row: string; fn: () => void }[] = [
		{ id: 'dx-5', label: '◀ x-5', row: 'dx', fn: nudge('dx', -5) },
		{ id: 'dx-1', label: 'x-1', row: 'dx', fn: nudge('dx', -1) },
		{ id: 'dx+1', label: 'x+1', row: 'dx', fn: nudge('dx', 1) },
		{ id: 'dx+5', label: 'x+5 ▶', row: 'dx', fn: nudge('dx', 5) },
		{ id: 'dy-5', label: '▲ y-5', row: 'dy', fn: nudge('dy', -5) },
		{ id: 'dy-1', label: 'y-1', row: 'dy', fn: nudge('dy', -1) },
		{ id: 'dy+1', label: 'y+1', row: 'dy', fn: nudge('dy', 1) },
		{ id: 'dy+5', label: 'y+5 ▼', row: 'dy', fn: nudge('dy', 5) },
		{ id: 'ds-', label: 'escala −', row: 'ds', fn: nudge('dscale', -0.02) },
		{ id: 'ds+', label: 'escala +', row: 'ds', fn: nudge('dscale', 0.02) },
		{
			id: 'ds-reset',
			label: 'reset',
			row: 'ds',
			fn: () => {
				swingAlign.dx = 0;
				swingAlign.dy = 0;
				swingAlign.dscale = 1;
			},
		},
	];
	for (const [i, n] of NUDGES.entries()) {
		animInspector.registerAction(`swing:${n.id}`, {
			label: n.label,
			category: 'swing',
			order: 10 + i,
			variant: 'mini',
			row: n.row,
			callback: n.fn,
		});
	}

	// ── Diagnóstico: referencia fijada ────────────────────────────────────
	animInspector.registerCategory('diag', { label: 'DIAGNÓSTICO', order: 2 });
	animInspector.registerAction('diag:pin', {
		label: '📌 fijar ref',
		category: 'diag',
		order: 0,
		variant: 'mini',
		row: 'pin',
		callback: () => {
			const dbg = readDbg();
			pinned = dbg ? { cx: dbg.cx, feetY: dbg.feetY } : null;
		},
	});
	animInspector.registerAction('diag:unpin', {
		label: 'limpiar',
		category: 'diag',
		order: 1,
		variant: 'mini',
		row: 'pin',
		callback: () => (pinned = null),
	});

	// ── Situaciones reales de juego ───────────────────────────────────────
	// Emiten los MISMOS eventos que bookEventHandlerMap: lo que se ve acá es
	// exactamente el componente de producción, no una imitación.
	animInspector.registerCategory('situations', {
		label: 'SITUACIONES (flujo real: bateo + sonidos)',
		order: 3,
	});

	// La MISMA coreografía que bookEventHandlerMap.setWin: Kash batea (la
	// promesa resuelve en el frame de golpe: shake + AU-09), la celebración
	// entra con el impacto, suena el sting del tier y al final vuelve la
	// música base.
	const playWin = (alias: string, amount: number) => async () => {
		const winLevelData = levelByAlias(alias);
		await emit.broadcastAsync({ type: 'kashSwing' });
		emit.broadcast({ type: 'winShow' });
		if (alias === 'small') emit.broadcast({ type: 'soundOnce', name: 'sfx_winlevel_small' });
		if (winLevelData?.sound?.sfx) emit.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
		if (winLevelData?.sound?.bgm) emit.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
		await emit.broadcastAsync({ type: 'winUpdate', amount, winLevelData });
		emit.broadcast({ type: 'soundMusic', name: 'bgm_main' });
		emit.broadcast({ type: 'winHide' });
	};

	for (const [i, w] of WINS.entries()) {
		animInspector.registerAction(`win:${w.alias}`, {
			label: w.label,
			category: 'situations',
			order: i,
			exclusive: true,
			callback: playWin(w.alias, w.amount),
		});
	}

	// TIRADA DE BATEO 🎲 — spin REAL de base game con KASH RAMPAGE. Arma el
	// mock RGS (/debug/arm-next tier 'rampage') y dispara el MISMO evento
	// 'bet' del botón SPIN, así corre la vía completa de producción. Contra un
	// RGS real el endpoint no existe y la tirada sale normal.
	animInspector.registerAction('spin:rampage', {
		label: 'TIRADA BATEO 🏏🎲',
		category: 'situations',
		order: 10,
		exclusive: true,
		callback: async () => {
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
			if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
			emit.broadcast({ type: 'bet' });
		},
	});

	// Trigger de bonus (capa de sonidos real: gold bar pesado → bass drop →
	// fanfarria) + intro visual con su jingle y swap de música.
	animInspector.registerAction('bonus:trigger', {
		label: 'BONUS TRIGGER 🎰',
		category: 'situations',
		order: 11,
		exclusive: true,
		callback: async () => {
			emit.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win_v2' });
			await new Promise((r) => setTimeout(r, 500));
			emit.broadcast({ type: 'soundOnce', name: 'sfx_superfreespin' });
			await emit.broadcastAsync({ type: 'transition' });
			emit.broadcast({ type: 'freeSpinIntroShow' });
			emit.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
			emit.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
			await emit.broadcastAsync({ type: 'freeSpinIntroUpdate', totalFreeSpins: 10 });
			emit.broadcast({ type: 'freeSpinIntroHide' });
			emit.broadcast({ type: 'soundMusic', name: 'bgm_main' });
		},
	});

	// Anticipación: la MISMA vía que producción — se marca `anticipating` en
	// los reels y Anticipations.svelte enciende la carga eléctrica + sonidos.
	animInspector.registerAction('anticipation', {
		label: 'ANTICIPACIÓN ⚡ (reels 5-6)',
		category: 'situations',
		order: 12,
		exclusive: true,
		callback: async () => {
			for (const reelIndex of [4, 5]) {
				const reel = context.stateGame.board[reelIndex];
				reel.reelState.anticipating = true;
				const t0 = Date.now();
				while (reel.reelState.anticipating && Date.now() - t0 < 4000) {
					await new Promise((r) => setTimeout(r, 120));
				}
				reel.reelState.anticipating = false;
			}
		},
	});

	// ── Free spins ────────────────────────────────────────────────────────
	animInspector.registerCategory('freespins', { label: 'FREE SPINS', order: 4 });
	animInspector.registerAction('fs:intro', {
		label: 'FS INTRO (10 SPINS)',
		category: 'freespins',
		order: 0,
		exclusive: true,
		callback: async () => {
			emit.broadcast({ type: 'freeSpinIntroShow' });
			emit.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
			await emit.broadcastAsync({ type: 'freeSpinIntroUpdate', totalFreeSpins: 10 });
			emit.broadcast({ type: 'freeSpinIntroHide' });
		},
	});
	animInspector.registerAction('fs:outro', {
		label: 'FS OUTRO (BIG)',
		category: 'freespins',
		order: 1,
		exclusive: true,
		callback: async () => {
			const winLevelData = levelByAlias('big');
			emit.broadcast({ type: 'freeSpinOutroShow' });
			emit.broadcast({ type: 'soundOnce', name: 'sfx_youwon_panel' });
			await emit.broadcastAsync({ type: 'freeSpinOutroCountUp', amount: 87_500, winLevelData });
			emit.broadcast({ type: 'soundMusic', name: 'bgm_main' });
			emit.broadcast({ type: 'freeSpinOutroHide' });
		},
	});

	// ── Otros ─────────────────────────────────────────────────────────────
	animInspector.registerCategory('other', { label: 'OTROS', order: 5 });
	animInspector.registerAction('transition', {
		label: 'TRANSITION',
		category: 'other',
		order: 0,
		exclusive: true,
		callback: async () => {
			await emit.broadcastAsync({ type: 'transition' });
		},
	});

	// ── Soundboard ────────────────────────────────────────────────────────
	animInspector.registerCategory('sounds', { label: 'SONIDOS — UNO POR UNO', order: 6 });
	for (const [i, m] of MUSIC_LIST.entries()) {
		animInspector.registerAction(`music:${m.name}`, {
			label: `♫ ${m.label}`,
			category: 'sounds',
			order: i,
			variant: 'soft',
			callback: () => emit.broadcast({ type: 'soundMusic', name: m.name }),
		});
	}
	for (const [i, s] of SOUND_LIST.entries()) {
		const extra = s.names.length > 1 ? ` (+${s.names.length - 1})` : '';
		animInspector.registerAction(`sfx:${s.au}`, {
			label: `🔊 ${s.au} — ${s.names[0].replace('sfx_', '')}${extra}`,
			title: s.names.join(', '),
			category: 'sounds',
			order: 100 + i,
			variant: 'soft',
			callback: () => emit.broadcast({ type: 'soundOnce', name: s.names[0] }),
		});
	}
};
