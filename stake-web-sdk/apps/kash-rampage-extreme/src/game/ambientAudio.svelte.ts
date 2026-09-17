// ── AUDIO DE PRE-JUEGO: la cama de fondo + el swipe de la intro ─────────────
//
// `Sound.svelte` es la superficie de audio del JUEGO y, a propósito, se monta
// recién DESPUÉS del click de la pantalla de carga (política de autoplay de
// Chrome: "autoplay with sound is allowed if the user has interacted with the
// domain"). O sea que todo lo que tiene que sonar ANTES de ese click —o EN ese
// click, que es el tick en el que `<Sound />` todavía no se suscribió al
// emitter— no puede pasar por el eventEmitter.
//
// Eso es lo que vive acá, y son dos cosas:
//   1. `BackgroundLoop` — la cama de música que corre desde la intro y no se
//      corta nunca, por debajo de la música de fondo del juego.
//   2. el `Swipe` del telón — el efecto del momento en que la pantalla de
//      carga se va hacia abajo y aparece el board.
//
// Los dos respetan el mezclador del juego y los dos van por el bus **SFX**
// (`volumeSoundEffect`), igual que si hubieran salido de `Sound.svelte`.
// La cama vivió en **Music** hasta el 15-09; dirección la movió a SFX para
// dejar la perilla MUSIC mandando SOLO sobre las pistas de `Sound.svelte`
// (base ↔ free spins ↔ rage) y que bajarla no se lleve puesto el ambiente.
//
// Es un SINGLETON de módulo y no un componente porque tiene que sobrevivir al
// montaje/desmontaje de la pantalla de carga: el overlay se puede volver a
// abrir desde el ANIM LAB y la cama no se tiene que reiniciar.

import { stateSound, stateSoundDerived } from 'state-shared';

import {
	AMBIENT_BASE_VOLUME,
	AMBIENT_MUSIC_SRC,
	SFX_BASE_VOLUME,
	SFX_GAIN,
	SFX_MAP,
	type SoundName,
} from './sound';

let bed: HTMLAudioElement | undefined;
const uiCache = new Map<SoundName, HTMLAudioElement>();

const ambientVolume = () => AMBIENT_BASE_VOLUME * stateSoundDerived.volumeSoundEffect();

// ── La cama cuelga del bus SFX, no solo del MASTER ─────────────────────────
// `volumeSoundEffect()` ya multiplica master × sfx, así que el VOLUMEN sale de
// las dos perillas. Falta el APAGADO: sin esto el elemento solo se pausa con el
// master en 0, y con SFX en OFF (o en 0) queda corriendo en silencio — o sea
// sonando de nuevo en cuanto el `pause`/`visibilitychange` de más abajo lo
// levanta. Esta guarda es la que hace que la categoría SFX del mezclador
// (`SettingsOverlay`) mande sobre la cama.
const ambientAudible = () =>
	stateSound.volumeValueMaster > 0 && stateSound.volumeValueSoundEffect > 0;

// ── Autoplay: el arranque real puede caer en el primer gesto ────────────────
// En el ACP el juego vive en un iframe y el jugador ya interactuó con el
// documento, así que el `play()` de entrada suele pasar. Cuando NO pasa (carga
// en frío, tab abierta de cero), el browser rechaza la promesa y hay que
// esperar un gesto. Se escucha el PRIMERO que aparezca —incluido el click que
// entra al juego— y ahí se reintenta.
const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;

const armGestureRetry = (resume: () => void) => {
	const onGesture = () => {
		for (const type of GESTURE_EVENTS) window.removeEventListener(type, onGesture);
		resume();
	};
	for (const type of GESTURE_EVENTS) window.addEventListener(type, onGesture, { once: true });
};

/**
 * Arranca la cama de fondo. Idempotente: llamarla dos veces no crea una
 * segunda voz. La llama `routes/+layout.svelte` al montar la app, o sea desde
 * el primer frame de la intro.
 */
export const startAmbientMusic = () => {
	if (typeof window === 'undefined' || bed) return;

	// Sin `srcFor()`: de este clip solo existe el .mp3 (no pasó por el pipeline
	// que genera los m4a), y el helper de Sound.svelte lo mandaría a un
	// `BackgroundLoop.m4a` inexistente — su guarda mira el sufijo `-loop`, que
	// este archivo no lleva.
	const audio = new Audio(AMBIENT_MUSIC_SRC);
	audio.loop = true;
	audio.preload = 'auto';
	audio.volume = ambientVolume();
	bed = audio;

	const resume = () => {
		if (ambientAudible()) void audio.play().catch(() => {});
	};
	void audio.play().catch(() => armGestureRetry(resume));

	// El mezclador es estado global ($state de state-shared) y este módulo no
	// vive dentro de ningún componente, así que necesita su propia raíz de
	// efectos. Nunca se destruye: la cama dura lo que dura la sesión.
	$effect.root(() => {
		$effect(() => {
			// Leer las dos perillas ACÁ (no dentro de un helper que el efecto no
			// llame en todos los caminos) es lo que las deja como dependencias
			// del efecto: mover MASTER **o** SFX re-corre este bloque.
			const audible = ambientAudible();
			audio.volume = ambientVolume();
			if (!audible) {
				if (!audio.paused) audio.pause();
			} else if (audio.paused) {
				void audio.play().catch(() => {});
			}
		});
	});

	// ── La cama NO se puede quedar callada ──────────────────────────────────
	// El efecto de arriba solo corre cuando se MUEVE el mezclador, así que si el
	// browser pausa el elemento por su cuenta —pestaña al fondo en mobile, una
	// llamada entrante, el sistema robándole el foco de audio— la cama queda
	// muerta para el resto de la sesión y la música de fondo del juego pasa a
	// sonar sola. Esta guarda la vuelve a levantar: cualquier `pause` que NO
	// haya pedido el mezclador se revierte, y al volver a la pestaña se
	// reintenta por las dudas.
	// (el pause del mezclador —master o SFX en 0— es el único legítimo, y por
	// eso las dos guardas preguntan por `ambientAudible()` y no solo por el
	// master: si no, apagar SFX pausaba y este listener la volvía a prender.)
	audio.addEventListener('pause', () => {
		if (ambientAudible()) void audio.play().catch(() => {});
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		if (ambientAudible() && audio.paused) void audio.play().catch(() => {});
	});

	// El swipe del telón tiene que sonar EN el click, no medio segundo después:
	// se trae el archivo mientras el jugador mira la intro.
	primeUiSfx('sfx_intro_swipe');
};

/** Deja el clip en cache y bajando, para que el primer play no espere la red. */
export const primeUiSfx = (name: SoundName) => {
	if (typeof window === 'undefined' || uiCache.has(name)) return;
	const path = SFX_MAP[name];
	if (!path) return;
	const audio = new Audio(path);
	audio.preload = 'auto';
	uiCache.set(name, audio);
};

/**
 * Dispara un SFX por fuera del eventEmitter, con la misma mezcla que
 * `Sound.svelte` (base × bus SFX del mezclador × gain del clip).
 */
export const playUiSfx = (name: SoundName) => {
	if (typeof window === 'undefined') return;
	const path = SFX_MAP[name];
	if (!path) return; // sin archivo entregado → no-op silencioso
	primeUiSfx(name);
	const audio = uiCache.get(name);
	if (!audio) return;
	audio.volume = SFX_BASE_VOLUME * stateSoundDerived.volumeSoundEffect() * (SFX_GAIN[name] ?? 1);
	audio.currentTime = 0;
	void audio.play().catch((e) => {
		if (import.meta.env.DEV) console.debug(`[ambientAudio] play(${name}) blocked:`, e);
	});
};
