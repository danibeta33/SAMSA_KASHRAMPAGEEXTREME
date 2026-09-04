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
		status: () => ({ label: bucketLabel(), detail: `${labState.vw}×${labState.vh}` }),
		// Mismo formato que el COPY VALUES histórico (bucket + viewport + valores),
		// plano y serializable para que `/sizes` pueda leerlo desde el padre.
		snapshot: () => ({
			bucket: labState.bucket,
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
