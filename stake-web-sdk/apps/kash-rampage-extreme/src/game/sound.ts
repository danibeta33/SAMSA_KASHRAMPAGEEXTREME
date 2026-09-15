import { createSound } from 'utils-sound';

export type MusicName =
	| 'bgm_main'
	| 'bgm_freespin'
	| 'bgm_freespin_rage'
	| 'bgm_winlevel_big'
	| 'bgm_winlevel_epic'
	| 'bgm_winlevel_max'
	| 'bgm_winlevel_mega'
	| 'bgm_winlevel_superwin';

export type SoundEffectName =
	| 'jng_intro_fs'
	| 'sfx_anticipation'
	| 'sfx_anticipation_start'
	| 'sfx_bigwin_coinloop'
	| 'sfx_btn_general'
	| 'sfx_btn_spin'
	| 'sfx_fs_respins'
	| 'sfx_intro_swipe'
	| 'sfx_marco_chain'
	| 'sfx_multiplier_combine_a'
	| 'sfx_multiplier_combine_b'
	| 'sfx_multiplier_explosion_a'
	| 'sfx_multiplier_explosion_b'
	| 'sfx_multiplier_explosion_c'
	| 'sfx_multiplier_landing'
	| 'sfx_multiplier_reset'
	| 'sfx_multiplier_up'
	| 'sfx_multiplier_update'
	| 'sfx_multiplier_win'
	| 'sfx_reel_stop_1'
	| 'sfx_reel_stop_2'
	| 'sfx_reel_stop_3'
	| 'sfx_reel_stop_4'
	| 'sfx_reel_stop_5'
	| 'sfx_royals_landing'
	| 'sfx_scatter_reveal'
	| 'sfx_scatter_stop_1'
	| 'sfx_scatter_stop_2'
	| 'sfx_scatter_stop_3'
	| 'sfx_scatter_stop_4'
	| 'sfx_scatter_stop_5'
	| 'sfx_scatter_win'
	| 'sfx_scatter_win_v2'
	| 'sfx_superfreespin'
	| 'sfx_symbols_landing'
	| 'sfx_wild_landing'
	| 'sfx_wild_explode'
	| 'sfx_winlevel_big'
	| 'sfx_winlevel_end'
	| 'sfx_winlevel_max'
	| 'sfx_winlevel_mega'
	| 'sfx_winlevel_nice'
	| 'sfx_winlevel_small'
	| 'sfx_winlevel_standard'
	| 'sfx_winlevel_substantial'
	| 'sfx_youwon_panel'
	| 'tumble_win_1'
	| 'tumble_win_2'
	| 'tumble_win_3'
	| 'tumble_win_4';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };

// ─── SFX_MAP — single source of truth for audio file paths ────────────────
// Sound.svelte reads this map; null = no file delivered yet (no-op).
// Files live under `static/assets/audio/AU-XX.mp3` (raw IDs preserved so they
// match the KashSmash Audio Asset List sheet 1:1). Keys are the engine's
// semantic sound names that book event handlers already emit.
//
// Delivered (2026-07-02 zip):
//   AU-01 base game music, AU-03 smash mode music, AU-04 rage mode music,
//   AU-09 bat smash, AU-10 generic button, AU-11 spin button, AU-12..AU-15
//   cluster wins (Low/Med/High/Premium), AU-16 tumble drop, AU-17 mult tick,
//   AU-18 + AU-18bis scatter land, AU-19 bonus trigger fanfare, AU-20 win
//   counter tick, AU-21 retrigger sting, AU-22 smash meter electric, AU-23
//   smash % counter tick, AU-24 FS trigger mark.
// Missing (rows highlighted in PDF v1.0):
//   AU-02 Vault Crack bonus loop, AU-05 BIG win sting, AU-06 MEGA win sting,
//   AU-07 MAX win sting, AU-08 big/mega win explosion.
// Reemplazos del drop 14-09 (ya no por número de planilla sino por nombre):
//   MusicaBase reemplaza a AU-01 (música base), Bateo a AU-09 (golpe del bate)
//   y Contador a AU-20 (tick del count-up). Los AU-XX viejos siguen en
//   `static/assets/audio/` pero ya no los referencia nadie.

const AU = (id: string) => `assets/audio/AU-${id}.mp3`;

// Clips entregados por nombre propio (drop 14-09), fuera de la numeración AU-XX
// de la planilla original. Pasaron por el MISMO pipeline que el resto
// (trim de silencios + loudnorm 2-pass a -14 LUFS / -14.5 la música, TP -1).
// Los SFX traen su par .m4a y `srcFor()` en Sound.svelte los sirve igual que
// los AU-XX; el `-loop` de la música va solo en mp3, como los AU-03/04-loop.
// Los archivos crudos que entregó el equipo quedaron en `src/game/sounds/`
// (la carpeta de fuentes sin compilar del SDK, gitignoreada) y NO en `static/`:
// ahí adentro el .wav de 23MB se copiaría tal cual al build.
const CLIP = (name: string) => `assets/audio/${name}.mp3`;

// Clips del drop 15-09 que llegaron en .wav y TODAVÍA NO pasaron por el
// pipeline (trim + loudnorm + mp3/m4a): esta máquina no tiene ffmpeg. Se
// sirven tal cual — el browser reproduce wav sin problema y `srcFor()` en
// Sound.svelte los deja pasar (solo reescribe `.mp3` → `.m4a`). Cuando se
// corra el pipeline, cambiar la extensión acá y listo; el resto no se toca.
const RAW = (name: string) => `assets/audio/${name}.wav`;

export const SFX_BASE_VOLUME = 0.7;

// ─── Bus de MÚSICA ────────────────────────────────────────────────────────
// Volumen base de la pista de música (lo multiplica el ratio master*music del
// mezclador). Vivía dentro de Sound.svelte; se subió acá porque ahora hay DOS
// emisores de música y los dos tienen que colgar del mismo número:
//   · `bgm_main` y compañía — Sound.svelte, arranca al entrar al juego.
//   · la cama `BackgroundLoop` — ambientAudio.svelte.ts, arranca en la intro.
// Feedback del usuario (15-07): la música iba muy arriba en la mezcla —
// bajada 0.45 → 0.3 para que los SFX (base 0.7 × gain) manden.
export const BGM_BASE_VOLUME = 0.3;

// ─── Cama de fondo (`BackgroundLoop`, drop 15-09) ─────────────────────────
// Segunda capa de música que corre DEBAJO de la música de fondo del juego, en
// bucle y SIN CORTES desde la intro: a diferencia de `bgm_main` —que Sound.svelte
// recién monta después del click de la pantalla de carga— esta arranca con la
// app (ver `ambientAudio.svelte.ts`, llamado desde `routes/+layout.svelte`) y
// no se detiene en los swaps de pista (base ↔ free spins ↔ rage).
//
// Va por fuera de SFX_MAP a propósito: no es un `MusicName` ruteable por
// `soundMusic`, que SUSTITUYE la pista del elemento `bgm`. Si estuviera en el
// mapa, un `soundMusic({ name: 'bgm_ambient' })` mataría la música de fondo.
//
// Pedido del usuario: "50% menos de volumen que la música de fondo" — de ahí
// el ×0.5 exacto sobre BGM_BASE_VOLUME. Igual que la otra, la afecta el
// mezclador del juego por el bus **Music**.
export const AMBIENT_MUSIC_SRC = 'assets/audio/BackgroundLoop.mp3';
export const AMBIENT_BASE_VOLUME = BGM_BASE_VOLUME * 0.5;

export const SFX_MAP: Record<SoundName, string | null> = {
	// Mapeo deliberado contra la spec del equipo (PDF "Audio — Detalle" v1.0).
	// Cada AU va a SU momento de juego. Los 5 archivos que faltan
	// (AU-02/05/06/07/08) usan un SUSTITUTO marcado para no dejar mudo un
	// momento clave; reemplazar cuando lleguen los definitivos.

	// ── BGM (music bus) ──────────────────────────────────────────────
	// Música base — reemplaza al AU-01 por "MusicaBase" (drop 14-09), 2:10.3.
	// El .wav entregado NO era un loop: cerraba con 1.39s de silencio y una cola
	// en fade (−38 dBFS RMS contra −19 del arranque), el mismo defecto que
	// dirección rechazó en los AU-03/04 el 15-07 ("se corta y vuelve a
	// arrancar"). Lleva entonces el MISMO tratamiento que aquellos: silencio de
	// cola recortado + crossfade de 1.5s del final contra el arranque. Por eso
	// el sufijo `-loop`, que además hace que `srcFor()` en Sound.svelte lo sirva
	// como mp3 y no busque un .m4a (re-encodear rompería el seam).
	bgm_main: CLIP('MusicaBase-loop'),
	// Los AU-03/04 originales NO eran loops (intro fuerte + cola con fade →
	// "se corta y vuelve a arrancar", feedback de dirección 15-07). Los
	// *-loop.mp3 son los mismos temas procesados a loop seamless: cola de
	// silencio recortada + crossfade de 1.5s del final contra el arranque.
	bgm_freespin: 'assets/audio/AU-03-loop.mp3', // Smash Mode — también Vault Crack (AU-02 falta)
	bgm_freespin_rage: 'assets/audio/AU-04-loop.mp3', // Rage Mode
	// AU-05/06/07 (loops de win level) NO entregados. Sin loop dedicado, la
	// música base/FS sigue sonando durante la celebración — aceptable.
	bgm_winlevel_big: null, // falta AU-05
	bgm_winlevel_epic: null, // falta AU-06
	bgm_winlevel_max: null, // falta AU-07
	bgm_winlevel_mega: null, // falta AU-06
	bgm_winlevel_superwin: null, // falta AU-07

	// ── Triggers de free spins (layer: gold bar → bass drop → fanfare) ─
	jng_intro_fs: AU('19'), // AU-19 fanfare de bonus trigger (2-3s), la celebración grande
	sfx_scatter_win_v2: AU('21'), // AU-21 gold bar aterrizando pesado [CORREGIDO: estaba en retrigger]
	sfx_superfreespin: AU('24'), // AU-24 FS Trigger Mark — bass drop + hit de batería
	sfx_scatter_win: AU('19'), // AU-19 4+ scatters → fanfare

	// ── SFX signature ────────────────────────────────────────────────
	// El BATEO. Reemplaza al AU-09 por "Bateo" (drop 14-09): suena en el swing de
	// Kash (Background.svelte) y en el acento premium de la wave del RAMPAGE.
	// Se le recortaron 0.19s de silencio de cabeza al entregarlo.
	//
	// OJO al usarlo en otro lado: el clip dura 674 ms y NO empieza en el golpe —
	// los primeros 250 ms son el silbido del bate y el crack cae recién ahí. Lo
	// que queda de cabeza es SONIDO, no silencio, así que no se recorta: el
	// caller que necesite el crack en un frame exacto lo dispara 250 ms antes
	// (ver `SWING_SFX_LEAD_FRAMES` en Background.svelte).
	sfx_wild_explode: CLIP('Bateo'),
	// Feedback N1 #8: el landing de wild usa la caída pesada del gold bar
	// (AU-21) con gain bajo — el AU-18 que sonaba acá era demasiado
	// preponderante y pasó a los wins (sfx_winlevel_small).
	sfx_wild_landing: AU('21'),

	// ── Win celebrations (AU-05/06/07/08 faltan → sustituto fanfare/smash) ─
	sfx_youwon_panel: AU('19'), // FS total win reveal → fanfare (falta AU-08 explosion)
	sfx_bigwin_coinloop: null, // loop de coins big/mega — falta AU-05/06
	sfx_multiplier_explosion_b: CLIP('Bateo'), // explosión de mult → bateo (falta AU-08)
	// Feedback N1 #8: "wild scatter queda para win" — el AU-18 (aparición de
	// wild/scatter, antes en los landings) ahora abre la celebración chica.
	// Small/big usan el sonido de wild/scatter (pedido de dirección 15-07);
	// mega/max usan los temas dedicados de Juanda (AU-25/AU-26).
	sfx_winlevel_small: AU('21'),
	// Feedback (15-07): el sustituto AU-19 acá era la FANFARRIA DEL BONUS y
	// los big wins sonaban a bonus trigger. Sustituto nuevo: AU-15 (impacto +
	// coin rain del cluster premium) — lee como plata, no como bonus. Los
	// definitivos siguen faltando (AU-05/06/07).
	sfx_winlevel_big: AU('21'),
	sfx_winlevel_mega: AU('25'), // Mega win — tema de Juanda
	sfx_winlevel_max: AU('26'), // Max Win — tema de Juanda

	// ── Botones / UI ─────────────────────────────────────────────────
	sfx_btn_general: AU('10'), // AU-10 generic button
	sfx_btn_spin: AU('11'), // AU-11 spin button (whoosh metálico)

	// ── Caída de símbolos / tumble ───────────────────────────────────
	sfx_symbols_landing: AU('16'), // AU-16 tumble drop (whoosh + impacto)
	sfx_royals_landing: AU('16'), // sin landing de royals aparte → mismo drop
	sfx_reel_stop_1: AU('16'),
	sfx_reel_stop_2: AU('16'),
	sfx_reel_stop_3: AU('16'),
	sfx_reel_stop_4: AU('16'),
	sfx_reel_stop_5: AU('16'),

	// ── Scatter (Gold Bar) ───────────────────────────────────────────
	// Feedback N1 #8: los landings de scatter dejan el AU-18 (pasó a win) y
	// usan la caída pesada del gold bar (AU-21) — "algo grande cayendo" —
	// con gain bajo (ver SFX_GAIN) para que no tapen el resto.
	sfx_scatter_reveal: AU('21'),
	sfx_scatter_stop_1: AU('21'),
	sfx_scatter_stop_2: AU('21'),
	sfx_scatter_stop_3: AU('21'),
	sfx_scatter_stop_4: AU('21'),
	sfx_scatter_stop_5: AU('21'),

	// ── Multiplicador (tick) ─────────────────────────────────────────
	sfx_multiplier_up: AU('17'), // AU-17 tick metálico al subir mult
	sfx_multiplier_update: AU('17'),
	sfx_multiplier_landing: AU('17'),
	sfx_multiplier_win: AU('17'),
	sfx_multiplier_combine_a: AU('17'),
	sfx_multiplier_combine_b: AU('17'),
	sfx_multiplier_explosion_a: AU('17'),
	sfx_multiplier_explosion_c: AU('17'),
	sfx_multiplier_reset: null, // reset no necesita sonido

	// ── Smash Meter (exclusivo Kash Smash) ───────────────────────────

	// ── Cluster win por tier ─────────────────────────────────────────
	tumble_win_1: AU('12'), // AU-12 cluster Low (cash register ligero)
	tumble_win_2: AU('13'), // AU-13 cluster Med
	tumble_win_3: AU('14'), // AU-14 cluster High
	tumble_win_4: AU('15'), // AU-15 cluster Premium (KASH, impacto + coin rain)

	// ── Anticipación / misc ──────────────────────────────────────────
	sfx_anticipation: AU('22'), // sin sonido dedicado → corriente del meter (tensión)
	sfx_anticipation_start: AU('24'), // arranque de anticipación → mark
	sfx_fs_respins: AU('24'), // retrigger +5 → FS mark corto [CORREGIDO: era AU-21 gold bar]
	// Contador del count-up: suena EN LOOP mientras las cifras suben debajo del
	// cartel de win y se apaga cuando llegan al total (Win.svelte). Reemplaza al
	// AU-20, que estaba mapeado acá pero no lo disparaba nadie en KRE.
	sfx_winlevel_end: CLIP('Contador'),
	// ── Transición de la intro al juego (drop 15-09) ─────────────────
	// Suena EXACTAMENTE cuando el telón de la pantalla de carga se va hacia
	// abajo y aparece el board (`dismiss()` en LoadingOverlay.svelte). En ese
	// instante `<Sound />` todavía no está montado —se monta recién con el
	// juego, un tick después—, así que este clip NO se dispara por el
	// eventEmitter sino directo desde `ambientAudio.svelte.ts`.
	sfx_intro_swipe: RAW('Swipe'),
	// ── Marco de victoria (drop 15-09) ───────────────────────────────
	// Un disparo por SÍMBOLO, en el mismo turno en que se enciende su marco
	// dentro de la cascada de victoria (winFlash.svelte.ts → Board.svelte).
	// Hasta acá el enmarcado era mudo.
	sfx_marco_chain: RAW('Chain'),
	sfx_winlevel_nice: null, // cubierto por cluster win
	sfx_winlevel_standard: null,
	sfx_winlevel_substantial: null,
};

// ─── SFX_GAIN — mezcla por clip (recalibrada 26-08 sobre archivos loudnorm) ─
// Multiplica SFX_BASE_VOLUME en Sound.svelte; sin entrada = 1 (sin trim).
// Los ARCHIVOS ahora están nivelados a -14 LUFS / TP -1 (pipeline estilo
// dead-heat: trim de silencios + loudnorm 2-pass + mp3 192k/m4a 128k), así
// que estos gains son la mezcla REAL en dB relativos al techo de -14:
//   1.0 = techo (celebraciones/triggers) · 0.55 ≈ -5dB · 0.4 ≈ -8dB.
// Anclados a los niveles efectivos que ya estaban aprobados de oído
// (Feedback N1 #8): recurrentes abajo, celebraciones a full.
export const SFX_GAIN: Partial<Record<SoundName, number>> = {
	// Landings de wild/scatter — sutiles (antes AU-21 crudo -19 LUFS × 0.55;
	// con el archivo a -14 el mismo nivel efectivo pide ~0.45)
	sfx_wild_landing: 0.45,
	sfx_scatter_reveal: 0.45,
	sfx_scatter_stop_1: 0.45,
	sfx_scatter_stop_2: 0.5,
	sfx_scatter_stop_3: 0.55,
	sfx_scatter_stop_4: 0.6,
	sfx_scatter_stop_5: 0.65,
	// Caídas de símbolos / reel stops — suenan en cada tumble, van bajo
	sfx_symbols_landing: 0.5,
	sfx_royals_landing: 0.5,
	sfx_reel_stop_1: 0.5,
	sfx_reel_stop_2: 0.5,
	sfx_reel_stop_3: 0.5,
	sfx_reel_stop_4: 0.5,
	sfx_reel_stop_5: 0.5,
	// Ticks de multiplicador — recurrentes, sutiles (AU-17 quedó ~2dB más
	// caliente tras el loudnorm → trim más profundo que el 0.7 anterior)
	sfx_multiplier_up: 0.55,
	sfx_multiplier_update: 0.55,
	sfx_multiplier_landing: 0.55,
	// Anticipación — corriente de fondo en loop, nunca protagonista (el
	// archivo subió de -22 a -14 con el loudnorm; 0.4 la devuelve a su lugar)
	sfx_anticipation: 0.4,
	// Tick del contador de win — repetitivo durante el count-up
	sfx_winlevel_end: 0.8,
	// Botón de spin — feedback de UI, por debajo del juego
	sfx_btn_spin: 0.8,
	// Cadena del marco — se dispara una vez POR SÍMBOLO del cluster (hasta 25
	// en cascada, y en clusters grandes cada ~110 ms), así que va bajo: a 1.0
	// una victoria larga se vuelve una ametralladora. Además el .wav todavía
	// no pasó por el loudnorm, así que viene más caliente que el resto.
	sfx_marco_chain: 0.45,
	// Swipe del telón de la intro — transición, no celebración
	sfx_intro_swipe: 0.7,
};
