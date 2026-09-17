// MODOS DE APUESTA — FUENTE ÚNICA DE VERDAD DEL FRONTEND.
//
// Hasta el feedback del 16-09 los mismos cuatro modos estaban escritos a mano
// en tres lugares que podían divergir (y divergieron): el `betModeMeta` de
// `Game.svelte`, las dos tablas del modal de reglas (EN y ES) y las cards de
// `BuyBonusOverlay`. De ahí salió el bug que marcó el reviewer — la fila BASE
// de la tabla INGLESA tenía el texto en español pegado al inglés, porque la
// celda se había copiado de la tabla ES.
//
// Ahora los cuatro consumidores se derivan de `BET_MODES`. Agregar un modo o
// corregir una cifra se hace UNA vez, acá.
//
// Los valores numéricos se validan contra `config.ts` en DEV (ver el bloque al
// final): `config.ts` es type-only por decisión del port —los valores runtime
// salen de `betModeMeta` + el RGS— así que sin la aserción las dos copias
// podrían separarse en silencio.
//
// ─────────────────────────────────────────────────────────────────────────────
// PROCEDENCIA DE LAS FRECUENCIAS DE KASH RAMPAGE (campo `rampage`)
// ─────────────────────────────────────────────────────────────────────────────
// Son las tasas ENTREGADAS: medidas sobre los books publicados, ponderados por
// los pesos de la lookup table del optimizer. NO son las configuradas.
//
//   modo         configurada   entregada
//   vault_crack  1/8           1/6.62
//   smash_mode   1/5           1/4.13
//   rage_mode    1/2.3         1/2.22
//
// La diferencia no es un error: los books con más rampages pagan más, el
// optimizer los sobre-pondera para llegar al RTP objetivo, y la tasa efectiva
// queda por encima de la configurada. Ver INFORME_MATEMATICA.md §6.2.
//
// `prob_per_spin` de `stake-math-sdk/games/kash_rampage_extreme/game_config.py`
// es la tirada configurada PRE-optimizer y NO es la cifra que se publica. Si
// alguien vuelve a comparar las dos tablas y "encuentra" un desfase, es esto.
import config from './config';

export type BetModeKey = 'BASE' | 'VAULT_CRACK' | 'SMASH_MODE' | 'RAGE_MODE';

/** Copy que existe en los dos idiomas del modal de reglas. */
export type Localised = { en: string; es: string };

export type BetModeInfo = {
	key: BetModeKey;
	/** Clave en `config.ts` / en el math (snake_case). */
	configKey: keyof typeof config.betModes;
	/** Título display. */
	title: string;
	/** Multiplicador de costo sobre la apuesta base. */
	costMultiplier: number;
	/** RTP del modo (fracción, no porcentaje). */
	rtp: number;
	/** Tope de ganancia, en múltiplos de la apuesta. */
	maxWinX: number;
	/** Free Spins que otorga el modo; `null` = no es un buy. */
	freeSpins: number | null;
	/** Celda "KASH RAMPAGE" de la tabla. */
	rampage: Localised;
	/** Descripción del modo — requisito de approval (Game Info por modo). */
	description: Localised;
	/** Ticker del HUD mientras el modo está armado / corriendo. */
	tickerIdle: string;
	tickerSpin: string;
};

export const BET_MODES: BetModeInfo[] = [
	{
		key: 'BASE',
		configKey: 'base',
		title: 'BASE',
		costMultiplier: 1.0,
		rtp: 0.965,
		maxWinX: 5000,
		freeSpins: null,
		rampage: {
			en: 'Can strike on any spin',
			es: 'Puede golpear en cualquier spin',
		},
		description: {
			en: 'The standard game. Every spin is a 6×5 cluster pays grid with unlimited tumbles, and KASH RAMPAGE can strike on any spin. Landing enough Gold Bar scatters triggers the Free Spins round without any extra bet.',
			es: 'El juego estándar. Cada spin es una grilla de 6×5 con cluster pays y tumbles sin límite, y KASH RAMPAGE puede golpear en cualquier spin. Juntar suficientes scatters de Lingote dispara la ronda de Free Spins sin apuesta adicional.',
		},
		tickerIdle: '',
		tickerSpin: '',
	},
	{
		key: 'VAULT_CRACK',
		configKey: 'vault_crack',
		title: 'VAULT CRACK',
		costMultiplier: 100,
		rtp: 0.965,
		maxWinX: 5000,
		freeSpins: 10,
		rampage: { en: '≈ 1 / 6.6 spins', es: '≈ 1 / 6.6 spins' },
		description: {
			en: 'The measured way in. For 100× the bet it enters 10 Free Spins directly, with the tumble multiplier carrying across the whole round. KASH RAMPAGE strikes about 1 in 6.6 spins — the lowest rate of the three entries.',
			es: 'La entrada medida. Por 100× la apuesta entra directo a 10 Free Spins, con el multiplicador de tumble acumulándose durante toda la ronda. KASH RAMPAGE golpea alrededor de 1 de cada 6.6 spins — la tasa más baja de las tres entradas.',
		},
		tickerIdle: 'GETTING READY',
		tickerSpin: 'VAULT CRACK ACTIVE',
	},
	{
		key: 'SMASH_MODE',
		configKey: 'smash_mode',
		title: 'SMASH MODE',
		costMultiplier: 250,
		rtp: 0.965,
		maxWinX: 5000,
		freeSpins: 10,
		rampage: { en: '≈ 1 / 4.1 spins', es: '≈ 1 / 4.1 spins' },
		description: {
			en: 'More rampages, more chaos. For 250× the bet it enters the same 10 Free Spins, but KASH RAMPAGE strikes about 1 in 4.1 spins — roughly 2.6 rampages per round instead of 1.6.',
			es: 'Más rampages, más caos. Por 250× la apuesta entra a los mismos 10 Free Spins, pero KASH RAMPAGE golpea alrededor de 1 de cada 4.1 spins — unos 2.6 rampages por ronda en vez de 1.6.',
		},
		tickerIdle: 'GETTING READY',
		tickerSpin: 'SMASH MODE ACTIVE',
	},
	{
		key: 'RAGE_MODE',
		configKey: 'rage_mode',
		title: 'RAGE MODE',
		costMultiplier: 500,
		rtp: 0.962,
		maxWinX: 5000,
		freeSpins: 10,
		rampage: { en: '≈ 1 / 2.2 spins', es: '≈ 1 / 2.2 spins' },
		description: {
			en: 'Total demolition. For 500× the bet it enters 10 Free Spins at the highest KASH RAMPAGE rate — about 1 in 2.2 spins, close to five rampages per round. RTP is 96.2%, within the range declared for the other modes.',
			es: 'Demolición total. Por 500× la apuesta entra a 10 Free Spins con la tasa de KASH RAMPAGE más alta — alrededor de 1 de cada 2.2 spins, casi cinco rampages por ronda. El RTP es 96.2%, dentro del rango declarado para los otros modos.',
		},
		tickerIdle: 'GETTING READY',
		tickerSpin: 'RAGE MODE ACTIVE',
	},
];

export const betModeByKey = Object.fromEntries(BET_MODES.map((mode) => [mode.key, mode])) as Record<
	BetModeKey,
	BetModeInfo
>;

/** `1×` / `100×` — misma forma en las dos tablas y en las cards del buy. */
export const costLabel = (mode: BetModeInfo) => `${mode.costMultiplier}×`;

/** `96.5%` — el RTP se guarda como fracción para poder compararlo con config.ts. */
export const rtpLabel = (mode: BetModeInfo) => `${(mode.rtp * 100).toFixed(1)}%`;

/** `5,000×` */
export const maxWinLabel = (mode: BetModeInfo) => `${mode.maxWinX.toLocaleString('en-US')}×`;

/** `≈ 1 / 6.6 spins` → `1 in 6.6 spins`, para los diálogos en prosa. */
export const rampageAsRate = (mode: BetModeInfo) =>
	mode.rampage.en.replace(/^≈\s*1\s*\/\s*/, '1 in ');

// Red de seguridad SOLO-DEV: `config.ts` es la copia que se regenera del math
// (library/configs/config_fe_kash_rampage_extreme.json). Si alguien actualiza
// una y no la otra, esto lo grita en la consola de desarrollo en vez de dejar
// que la tabla de reglas publique un número que la math no respalda.
if (import.meta.env.DEV) {
	for (const mode of BET_MODES) {
		const fromConfig = config.betModes[mode.configKey];
		if (!fromConfig) {
			console.error(`betModes.ts: "${mode.configKey}" no existe en config.ts`);
			continue;
		}
		if (fromConfig.cost !== mode.costMultiplier)
			console.error(
				`betModes.ts: costo de ${mode.key} = ${mode.costMultiplier}, config.ts dice ${fromConfig.cost}`,
			);
		if (fromConfig.rtp !== mode.rtp)
			console.error(
				`betModes.ts: RTP de ${mode.key} = ${mode.rtp}, config.ts dice ${fromConfig.rtp}`,
			);
		if (fromConfig.max_win !== mode.maxWinX)
			console.error(
				`betModes.ts: max win de ${mode.key} = ${mode.maxWinX}, config.ts dice ${fromConfig.max_win}`,
			);
	}
}
