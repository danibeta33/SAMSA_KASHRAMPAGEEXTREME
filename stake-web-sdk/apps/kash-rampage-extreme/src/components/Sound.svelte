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
	import {
		SFX_MAP,
		SFX_GAIN,
		SFX_POLYPHONY,
		SFX_BASE_VOLUME,
		BGM_BASE_VOLUME,
	} from '../game/sound';

	const context = getContext();

	// `BGM_BASE_VOLUME` (el volumen base de la música, ×master*music del
	// mezclador) se mudó a `game/sound.ts`: la cama `BackgroundLoop` que
	// arranca en la intro cuelga del MISMO número (va al 50% de él) y no puede
	// leerlo desde acá — corre por fuera de este componente, ver
	// `game/ambientAudio.svelte.ts`.

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
	// `bgm_main` (MusicaBase-loop) NO lleva entrada aunque también sea `-loop`:
	// ese sí se normalizó ANTES del crossfade y quedó en -14.9 LUFS, a 0.4dB del
	// target, así que su gain natural es 1.
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

	// ── Voces extra de los clips POLIFÓNICOS ────────────────────────────────
	// `sfxCache` guarda LA voz principal de cada clip: es la que `stopSfx` y
	// `fadeSfx` manipulan, así que sigue siendo una sola y esas dos no cambian.
	// Los clips con entrada en `SFX_POLYPHONY` tienen además un anillo de voces
	// alternativas para que dos disparos seguidos se ENCIMEN en vez de cortarse
	// (ver la nota de SFX_POLYPHONY en sound.ts).
	const sfxVoices = new Map<SoundName, HTMLAudioElement[]>();
	const sfxVoiceCursor = new Map<SoundName, number>();

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

	/**
	 * Devuelve la voz con la que hay que reproducir ESTE disparo.
	 *
	 * Sin polifonía es siempre la voz principal — o sea, exactamente lo que
	 * hacía antes. Con polifonía se reparte por turno entre el anillo, creando
	 * cada voz recién cuando el turno llega a ella: un cluster de 5 símbolos no
	 * paga los 6 elementos de audio del techo.
	 *
	 * Los LOOPS quedan siempre en la voz principal: un loop polifónico no
	 * tendría cómo pararse (`stopSfx` conoce una sola voz) y se quedaría
	 * sonando para siempre.
	 */
	const voiceFor = (name: SoundName, { loop }: { loop: boolean }) => {
		const main = getOrCreateAudio(name, { loop });
		if (!main) return null;
		const limit = SFX_POLYPHONY[name] ?? 1;
		if (loop || limit <= 1) return main;

		const ring = sfxVoices.get(name) ?? [main];
		if (!sfxVoices.has(name)) sfxVoices.set(name, ring);
		const next = ((sfxVoiceCursor.get(name) ?? 0) + 1) % limit;
		sfxVoiceCursor.set(name, next);
		if (!ring[next]) {
			const extra = new Audio(main.src);
			extra.preload = 'auto';
			ring[next] = extra;
		}
		ring[next].loop = false;
		return ring[next];
	};

	/**
	 * Crea y BAJA el anillo entero de un clip polifónico, de una y por
	 * adelantado.
	 *
	 * `voiceFor` crea cada voz recién cuando le llega el turno, o sea EN EL
	 * MISMO TICK en que tiene que sonar: un `HTMLAudioElement` nuevo arranca en
	 * `readyState 0` y su `play()` no emite hasta que cargó y decodificó, así
	 * que las primeras voces de cada sesión llegan tarde o directamente no se
	 * oyen. En un cluster GRANDE eso se disimula —la cascada da la vuelta al
	 * anillo y para el final las voces ya están calientes—, pero en uno de 3 o 4
	 * símbolos CADA disparo cae en una voz fría distinta y el enmarcado se oye
	 * mudo. Es exactamente el reporte "no suena en los spins normales, sí en el
	 * bonus": los clusters del bonus son más grandes.
	 *
	 * El camino bueno sigue siendo Web Audio (`playBuffered`), pero el fallback
	 * tiene que ser un fallback de verdad — hasta que el buffer termine de
	 * decodificar, o si el browser no da Web Audio, es lo único que hay.
	 */
	const warmVoices = (name: SoundName) => {
		const limit = SFX_POLYPHONY[name] ?? 1;
		const main = getOrCreateAudio(name, { loop: false });
		if (!main) return;
		main.load();
		if (limit <= 1) return;
		const ring = sfxVoices.get(name) ?? [main];
		sfxVoices.set(name, ring);
		for (let i = 1; i < limit; i += 1) {
			if (ring[i]) continue;
			const extra = new Audio(main.src);
			extra.preload = 'auto';
			extra.load();
			ring[i] = extra;
		}
	};

	const sfxVolume = (name?: SoundName) =>
		// volumeSoundEffect already folds master in; SFX_BASE_VOLUME caps the
		// per-clip ceiling so SFX sit under BGM by default. SFX_GAIN aplica el
		// trim por clip (Feedback N1 #8 — nivelar la mezcla).
		SFX_BASE_VOLUME * stateSoundDerived.volumeSoundEffect() * (name ? (SFX_GAIN[name] ?? 1) : 1);

	// ── DISPARO REAL DE LOS CLIPS POLIFÓNICOS (Web Audio) ───────────────────
	// El anillo de `HTMLAudioElement` de acá arriba resolvió que los disparos no
	// se CORTARAN entre sí, pero no alcanzó para que TODOS SUENEN: un
	// `HTMLAudioElement` recién creado arranca en `readyState 0` y su `play()`
	// no emite hasta que el elemento cargó y decodificó. Las voces del anillo se
	// creaban de a una, EN EL MISMO TICK en que tenían que sonar, así que las
	// primeras de cada sesión llegaban tarde o directamente no se oían.
	//
	// Eso explica el reporte (15-09): en un cluster GRANDE la cascada da la
	// vuelta al anillo y las últimas voces —ya cargadas— suenan apiladas, pero
	// en uno de 3 o 4 símbolos cada disparo cae en una voz FRÍA distinta y el
	// enmarcado se oye mudo o con un solo eslabón.
	//
	// La solución no es precargar más elementos: aunque estén calientes, cada
	// `play()` de un `HTMLAudioElement` pasa por el scheduler de media del
	// browser y puede llegar decenas de ms tarde. Para un golpe que tiene que
	// caer EXACTO en el frame del marco, el camino correcto es Web Audio: se
	// decodifica el wav UNA vez a un `AudioBuffer` y cada disparo es un
	// `AudioBufferSourceNode` nuevo, que arranca en el instante y no compite con
	// ningún otro. La polifonía deja de tener techo —cada símbolo tiene su
	// fuente— y `SFX_POLYPHONY` queda solo para el fallback de abajo.
	//
	// Si Web Audio no está o el buffer todavía no terminó de decodificar,
	// `playBuffered` devuelve `false` y `playSfx` cae al anillo de siempre.
	let audioCtx: AudioContext | undefined;
	const sfxBuffers = new Map<SoundName, AudioBuffer>();
	const decoding = new Set<SoundName>();

	// Un `resume()` pedido FUERA de un gesto puede quedar pendiente o ser
	// rechazado, y el contexto se queda suspendido para el resto de la sesión.
	// Con esto, el siguiente gesto del jugador —el click de SPIN, típicamente—
	// lo levanta. Se arma una sola vez: `ctxResumeArmed` evita apilar listeners
	// en cada disparo.
	let ctxResumeArmed = false;
	const armCtxResume = () => {
		if (ctxResumeArmed) return;
		ctxResumeArmed = true;
		const onGesture = () => {
			ctxResumeArmed = false;
			for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) {
				window.removeEventListener(type, onGesture);
			}
			void audioCtx?.resume().catch(() => {});
		};
		for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) {
			window.addEventListener(type, onGesture, { once: true });
		}
	};

	const getAudioCtx = () => {
		if (!audioCtx) {
			const Ctor =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctor) return undefined;
			audioCtx = new Ctor();
		}
		// El contexto nace `suspended` si el browser todavía no vio un gesto.
		// `<Sound />` se monta DESPUÉS del click de la pantalla de carga, así que
		// normalmente ya arranca corriendo; el resume cubre el caso en que el
		// browser lo suspende solo (pestaña en segundo plano).
		if (audioCtx.state === 'suspended') {
			void audioCtx.resume().catch(() => {});
			armCtxResume();
		}
		return audioCtx;
	};

	/** Baja y decodifica el clip una sola vez. Idempotente. */
	const preloadBuffer = async (name: SoundName) => {
		const path = SFX_MAP[name];
		if (!path || sfxBuffers.has(name) || decoding.has(name)) return;
		const ctx = getAudioCtx();
		if (!ctx) return;
		decoding.add(name);
		try {
			const response = await fetch(srcFor(path));
			sfxBuffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
		} catch (e) {
			// Sin buffer el clip sigue sonando por el anillo de <audio>.
			if (import.meta.env.DEV) console.debug(`[Sound] decode(${name}) failed:`, e);
		} finally {
			decoding.delete(name);
		}
	};

	/** @returns `true` si el disparo salió por Web Audio. */
	const playBuffered = (name: SoundName) => {
		const buffer = sfxBuffers.get(name);
		if (!buffer) return false;
		const ctx = getAudioCtx();
		if (!ctx) return false;
		// ── EL CONTEXTO TIENE QUE ESTAR CORRIENDO (fix 15-09) ────────────────
		// Sin esta guarda, un contexto `suspended` (o ya cerrado) igual aceptaba
		// el `source.start()` —el reloj está congelado, así que no se oye nada— y
		// esta función devolvía `true`. Con ese `true`, `playSfx` daba el disparo
		// por hecho y NO caía al anillo de `<audio>`, que sí habría sonado: los
		// elementos de audio tienen su propia política de autoplay y a esa altura
		// ya está satisfecha. O sea que el eslabón se perdía ENTERO, en silencio.
		//
		// Devolviendo `false` el fallback vuelve a entrar, y `getAudioCtx()` ya
		// dejó armado el reintento por gesto para los disparos siguientes.
		if (ctx.state !== 'running') return false;
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		// Gain propio por disparo: el volumen se lee AL DISPARAR, igual que en
		// `playSfx`, así que el mezclador (master × sfx × SFX_GAIN) sigue mandando.
		const gain = ctx.createGain();
		gain.gain.value = sfxVolume(name);
		source.connect(gain).connect(ctx.destination);
		source.onended = () => {
			source.disconnect();
			gain.disconnect();
		};
		source.start();
		return true;
	};

	const playSfx = (name: SoundName, { loop }: { loop: boolean }) => {
		// Clips POLIFÓNICOS (hoy: la cadena del marco): salen por Web Audio, que
		// es lo único que garantiza un golpe audible POR SÍMBOLO. Si el buffer
		// todavía no está, sigue de largo al anillo de <audio> de siempre.
		if (!loop && (SFX_POLYPHONY[name] ?? 1) > 1) {
			// Traza de DEV: si algún día vuelve a faltar un golpe, esto dice si
			// el disparo llegó y por qué camino salió — sin tener que instrumentar
			// la cascada entera.
			const viaWebAudio = playBuffered(name);
			if (import.meta.env.DEV) console.debug(`[Sound] ${name}`, viaWebAudio ? 'webaudio' : '<audio>');
			if (viaWebAudio) return;
			// Salió por el anillo de `<audio>`, o sea que el buffer NO estaba:
			// o el decode del montaje falló (red, un 404 momentáneo) o el
			// contexto todavía no corría. Se reintenta acá para que el camino
			// bueno se recupere solo — si no, una decodificación fallida al
			// arranque condenaba al clip al fallback POR TODA LA SESIÓN, que es
			// justo donde los clusters chicos se oyen flojos. `preloadBuffer` es
			// idempotente: si ya está o ya se está bajando, no hace nada.
			void preloadBuffer(name);
		}
		const audio = voiceFor(name, { loop });
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
		// PRECARGA de la cadena del marco: el resto de los SFX se crean en su
		// primer play (no tiene sentido pedir 40 clips que la ronda no toca),
		// pero este tiene que caer EN EL FRAME en que arranca el marco. Sin
		// esto, el primer cluster ganador de la sesión se enmarca mudo mientras
		// baja. Es un wav de 79 KB, así que la precarga sale barata.
		// …y con ÉL, sus 6 voces del anillo, todas bajadas de entrada (ver
		// `warmVoices`): es el fallback del Web Audio de acá abajo y tiene que
		// estar listo para el PRIMER cluster, no calentarse con el tercero.
		warmVoices('sfx_marco_chain');
		// …y su AudioBuffer, que es por donde sale de verdad cada eslabón (ver
		// `playBuffered`). El fetch + decode corre en background; hasta que
		// termine, el anillo de <audio> cubre.
		void preloadBuffer('sfx_marco_chain');

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
		sfxVoices.clear();
		sfxVoiceCursor.clear();
		sfxBuffers.clear();
		if (audioCtx) {
			void audioCtx.close().catch(() => {});
			audioCtx = undefined;
		}
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
