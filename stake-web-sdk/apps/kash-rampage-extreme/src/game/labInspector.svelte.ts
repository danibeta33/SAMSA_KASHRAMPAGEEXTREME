// PUENTE JUEGO → INSPECTOR (inyección de dependencias).
//
// Único punto donde el laboratorio genérico conoce a Kash Rampage Extreme.
// Se llama una vez desde `src/routes/+layout.svelte` (solo DEV). A partir de
// acá, `UiLab.svelte` y `/sizes` renderizan lo que haya en el registro sin
// importar nada del juego.

import { inspector } from 'components-inspector';
import { LAB_CATEGORIES, LAB_NOTE, LAB_SLIDERS, LAB_STORAGE_KEY, LAB_TITLE, LAB_TOGGLES } from './labMeta';
import {
	labState,
	resetTweak,
	RES_BUCKETS,
	saveTweak,
	stateTweak,
	syncUi,
} from './stateTweak.svelte';

// `stateTweak` es un objeto tipado; el inspector direcciona por id (string).
const tweak = stateTweak as unknown as Record<string, number>;

const bucketLabel = () => RES_BUCKETS.find((b) => b.key === labState.bucket)?.label ?? labState.bucket;

// El bucket `desktop` tiene DOS anclajes (1200×675 y 1912×956) y el layout
// interpola entre ellos, así que el panel tiene que decir sobre CUÁL de los dos
// van a caer SAVE/RESET — si no, ajustar en una ventana intermedia es a ciegas.
// En un viewport que cae justo en un anclaje se muestra solo su nombre; en el
// medio se agrega el peso de la mezcla.
const anchorLabel = () => {
	const t = labState.blend;
	const name = labState.anchor === 'wide' ? 'ancho' : 'base';
	const exact = t <= 0.001 || t >= 0.999;
	return exact ? `anclaje ${name}` : `anclaje ${name} · mezcla ${Math.round(t * 100)}%`;
};

let registered = false;

export const registerGameInspector = () => {
	if (registered) return;
	registered = true;

	inspector.configure({
		title: LAB_TITLE,
		// La clave de persistencia la aporta el juego — el panel no la conoce.
		storageKey: LAB_STORAGE_KEY,
		note: LAB_NOTE,
		read: (id) => tweak[id],
		// Escritura en vivo: `syncUi()` propaga stack/iconos a stateUiTweak sin
		// tocar localStorage (persistir en cada tick del drag tira frames).
		write: (id, value) => {
			tweak[id] = value;
			syncUi();
		},
		commit: saveTweak,
		reset: resetTweak,
		status: () => ({
			label: bucketLabel(),
			detail: `${labState.vw}×${labState.vh} · ${anchorLabel()}`,
		}),
		// Mismo formato que el COPY VALUES histórico (bucket + viewport + valores),
		// plano y serializable para que `/sizes` pueda leerlo desde el padre.
		snapshot: () => ({
			bucket: labState.bucket,
			anchor: labState.anchor,
			viewport: `${labState.vw}x${labState.vh}`,
			...Object.fromEntries(
				[...LAB_TOGGLES, ...LAB_SLIDERS].map((c) => [c.id, tweak[c.id]]),
			),
		}),
	});

	for (const { id, ...config } of LAB_CATEGORIES) inspector.registerCategory(id, config);
	for (const { id, ...config } of LAB_TOGGLES) inspector.registerToggle(id, config);
	for (const { id, ...config } of LAB_SLIDERS) inspector.registerSlider(id, config);
};
