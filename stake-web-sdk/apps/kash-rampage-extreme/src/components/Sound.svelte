<script lang="ts" module>
	// Pre-cabled audio surface. BGM uses a dedicated HTMLAudioElement for
	// reliable autoplay-after-gesture (loaded via Game.svelte after the
	// LoadingScreen click). SFX one-shots / loops route through SFX_MAP —
	// any entry whose path is `null` is a silent no-op until the sound
	// designer drops a file in `/static/assets/audio/` and the path is
	// filled in `game/sound.ts`. No code changes required beyond that.
	import type { MusicName, SoundEffectName, SoundName } from '../game/sound';

	export type EmitterEventSound =
		| { type: 'soundMusic'; name: MusicName }
		| { type: 'soundOnce'; name: SoundEffectName; forcePlay?: boolean }
		| { type: 'soundLoop'; name: SoundEffectName }
		| { type: 'soundStop'; name: SoundName }
		| { type: 'soundFade'; name: SoundName; from: number; to: number; duration: number }
		| { type: 'soundBetMode'; betModeKey: string }
		| { type: 'soundPressGeneral' }
		| { type: 'soundPressBet' }
		| { type: 'soundScatterCounterIncrease' }
		| { type: 'soundScatterCounterClear' };
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { stateSound, stateSoundDerived } from 'state-shared';

	import { getContext } from '../game/context';
	// SoundName ya viene importado en el module script de arriba.
	import { SFX_MAP, SFX_GAIN, SFX_BASE_VOLUME } from '../game/sound';

	const context = getContext();

	// Base BGM volume — multiplied by master*music ratio from stateSound (0..1).
	// Feedback del usuario (15-07): la música iba muy arriba en la mezcla —
	// bajada 0.45 → 0.3 para que los SFX (base 0.7 × gain) manden.
	const BGM_BASE_VOLUME = 0.3;

	// Pipeline de audio 26-08 (estilo dead-heat): clips trimeados + loudnorm a
	// -14 LUFS (música -14.5) / TP -1, servidos como m4a cuando el browser lo
	// soporta (mejor compresión, mismos nombres). Los *-loop.mp3 quedaron con
	// BYTES INTACTOS (re-encodear rompería el seam del crossfade) → sin m4a y
	// nivelados por código vía MUSIC_GAIN.
	const supportsM4A = !!new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"');
	const srcFor = (path: string) =>
		supportsM4A && !path.includes('-loop') ? path.replace(/\.mp3$/, '.m4a') : path;
	// Gains que llevan los loops (sin re-encode) al target -14.5 LUFS de la
	// música: AU-03-loop -9.3 LUFS medido → ×0.55 · AU-04-loop -9.9 → ×0.59.
	const MUSIC_GAIN: Record<string, number> = {
		bgm_freespin: 0.55,
		bgm_freespin_rage: 0.59,
	};
	let musicGain = 1;

	let bgm: HTMLAudioElement | undefined = $state();

	// Cache of one-shot / loop SFX HTMLAudioElements, keyed by SoundName.
	// Created lazily on first play so we don't issue HEAD requests for the
	// dozens of clips a round never touches. Reused across rounds — for
	// one-shots we just reset `currentTime = 0` before each play.
	const sfxCache = new Map<SoundName, HTMLAudioElement>();

	// Active fade interval ids, keyed by name, so a follow-up fade or stop
	// cancels the previous tween (prevents racing fades from compounding).
	const fadeIntervals = new Map<SoundName, ReturnType<typeof setInterval>>();

	const getOrCreateAudio = (name: SoundName, { loop }: { loop: boolean }) => {
		const path = SFX_MAP[name];
		if (!path) return null;
		let audio = sfxCache.get(name);
		if (!audio) {
			audio = new Audio(srcFor(path));
			audio.preload = 'auto';
			sfxCache.set(name, audio);
		}
		audio.loop = loop;
		return audio;
	};

	const sfxVolume = (name?: SoundName) =>
		// volumeSoundEffect already folds master in; SFX_BASE_VOLUME caps the
		// per-clip ceiling so SFX sit under BGM by default. SFX_GAIN aplica el
		// trim por clip (Feedback N1 #8 — nivelar la mezcla).
		SFX_BASE_VOLUME *
		stateSoundDerived.volumeSoundEffect() *
		(name ? (SFX_GAIN[name] ?? 1) : 1);

	const playSfx = (name: SoundName, { loop }: { loop: boolean }) => {
		const audio = getOrCreateAudio(name, { loop });
		if (!audio) return; // no file delivered — silent no-op
		// Cancel any in-flight fade so the new play starts at full volume.
		const existingFade = fadeIntervals.get(name);
		if (existingFade) {
			clearInterval(existingFade);
			fadeIntervals.delete(name);
		}
		audio.volume = sfxVolume(name);
		audio.currentTime = 0;
		void audio.play().catch((e) => {
			// Autoplay can still block before first user gesture on cold loads
			// (e.g. preloaded resumeBet) — log and swallow so the book stream
			// never stalls on a soundOnce.
			if (import.meta.env.DEV) console.debug(`[Sound] play(${name}) blocked:`, e);
		});
	};

	const stopSfx = (name: SoundName) => {
		const audio = sfxCache.get(name);
		if (!audio) return;
		const existingFade = fadeIntervals.get(name);
		if (existingFade) {
			clearInterval(existingFade);
			fadeIntervals.delete(name);
		}
		audio.pause();
		audio.currentTime = 0;
	};

	const fadeSfx = (name: SoundName, from: number, to: number, duration: number) => {
		const audio = sfxCache.get(name) ?? (name === 'bgm_main' ? bgm : undefined);
		if (!audio) return;
		const existingFade = fadeIntervals.get(name);
		if (existingFade) clearInterval(existingFade);

		const steps = Math.max(1, Math.round(duration / 16)); // ~60fps
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			const t = Math.min(1, i / steps);
			const v = from + (to - from) * t;
			audio.volume = Math.max(0, Math.min(1, v * sfxVolume(name)));
			if (t >= 1) {
				clearInterval(id);
				fadeIntervals.delete(name);
				if (to === 0) audio.pause();
			}
		}, 16);
		fadeIntervals.set(name, id);
	};

	onMount(() => {
		// Background music — the parent Game.svelte renders <Sound /> AFTER the
		// LoadingScreen click, which satisfies Chrome's "autoplay needs gesture"
		// policy. Arranca con el trap del base game (AU-01, SFX_MAP.bgm_main) —
		// el lofi placeholder del template quedó eliminado.
		bgm = new Audio(SFX_MAP.bgm_main ? srcFor(SFX_MAP.bgm_main) : undefined);
		bgm.loop = true;
		bgm.volume = BGM_BASE_VOLUME * musicGain * stateSoundDerived.volumeMusic();
		bgm.preload = 'auto';
		if (stateSound.volumeValueMaster > 0) {
			// Autoplay may be blocked by the browser; user gesture starts BGM via stateSound.
			void bgm.play().catch(() => {});
		}
		// Expose for headless tests / debugging
		(globalThis as unknown as { __bgm?: HTMLAudioElement }).__bgm = bgm;
		(globalThis as unknown as { __stateSound?: typeof stateSound }).__stateSound = stateSound;
		(globalThis as unknown as { __sfxCache?: typeof sfxCache }).__sfxCache = sfxCache;
		(globalThis as unknown as { __sfxMap?: typeof SFX_MAP }).__sfxMap = SFX_MAP;
	});

	onDestroy(() => {
		if (bgm) {
			bgm.pause();
			bgm.src = '';
			bgm = undefined;
		}
		for (const id of fadeIntervals.values()) clearInterval(id);
		fadeIntervals.clear();
		for (const audio of sfxCache.values()) {
			audio.pause();
			audio.src = '';
		}
		sfxCache.clear();
	});

	// React to volume changes — master at 0 pauses BGM and mutes all cached
	// SFX (next play() picks the new gain via sfxVolume()).
	$effect(() => {
		const master = stateSoundDerived.volumeMaster();
		const music = stateSoundDerived.volumeMusic();
		if (bgm) {
			bgm.volume = BGM_BASE_VOLUME * musicGain * music;
			if (master === 0) {
				if (!bgm.paused) bgm.pause();
			} else {
				if (bgm.paused) void bgm.play().catch(() => {});
			}
		}
		for (const [name, audio] of sfxCache) {
			audio.volume = sfxVolume(name);
		}
	});

	context.eventEmitter.subscribeOnMount({
		// ── UI presses — TODO when sfx_btn_* files arrive (currently null) ──
		soundBetMode: () => {
			// When bgm_freespin arrives we can branch on betModeKey here, mirror
			// of apps/cluster/src/components/Sound.svelte. For now silent.
		},
		soundPressGeneral: () => playSfx('sfx_btn_general', { loop: false }),
		soundPressBet: () => playSfx('sfx_btn_spin', { loop: false }),

		// ── scatterCounter — state-only, no audio ──────────────────────────
		soundScatterCounterIncrease: () =>
			(context.stateGame.scatterCounter = context.stateGame.scatterCounter + 1),
		soundScatterCounterClear: () => (context.stateGame.scatterCounter = 0),

		// ── Routed audio API ───────────────────────────────────────────────
		soundMusic: ({ name }) => {
			// Swap genérico de pista: base (AU-01), free spins (AU-03) o rage
			// (AU-04). Los winlevel BGMs siguen null → no-op hasta que lleguen.
			const path = SFX_MAP[name];
			if (!path || !bgm) return;
			const src = srcFor(path);
			if (bgm.src.endsWith(src)) return; // already this track
			bgm.src = src;
			bgm.loop = true;
			musicGain = MUSIC_GAIN[name] ?? 1;
			bgm.volume = BGM_BASE_VOLUME * musicGain * stateSoundDerived.volumeMusic();
			void bgm.play().catch(() => {});
		},
		soundLoop: ({ name }) => playSfx(name, { loop: true }),
		soundOnce: ({ name }) => playSfx(name, { loop: false }),
		soundStop: ({ name }) => {
			if (name === 'bgm_main' && bgm) {
				bgm.pause();
				return;
			}
			stopSfx(name);
		},
		soundFade: ({ name, from, to, duration }) => fadeSfx(name, from, to, duration),
	});
</script>
