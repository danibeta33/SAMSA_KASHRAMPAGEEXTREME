// PUENTE REMOTO — habla con un InspectorRegistry que vive en OTRO documento.
//
// Lo usa un panel externo (una página de presets que embebe el juego en un
// iframe same-origin): en vez de importar el catálogo del juego en tiempo de
// compilación, lo DESCUBRE en runtime leyendo el hook DEV `__inspectors[id]`
// que el registro publica al configurarse.
//
// El puente es genérico: no conoce ni el juego ni la página que lo hospeda.

import type { InspectorControl, InspectorStatus } from './InspectorRegistry.svelte';

/** Superficie del registro remoto vista desde el documento padre. */
export type RemoteInspector = {
	ready: boolean;
	title: string;
	status: InspectorStatus;
	schema: InspectorControl[];
	read: (id: string) => number;
	write: (id: string, value: number) => void;
	commit: () => void;
	reset: () => void;
	step: (id: string, dir: 1 | -1, mult?: number) => number;
	toggle: (id: string, on: boolean) => number;
	isOn: (id: string) => boolean;
	snapshot: () => Record<string, unknown>;
};

type HostWindow = Window & { __inspectors?: Record<string, RemoteInspector> };

export class InspectorBridge {
	/** Documento remoto (ej. `() => iframe.contentWindow`). */
	#target: () => Window | null;
	#registryId: string;
	#pollId: ReturnType<typeof setInterval> | undefined;
	#pollMs: number;

	// OJO: los campos reactivos van en campos PRIVADOS + getters, no en campos
	// públicos. El tsconfig del SDK usa `target: es6`, así que esbuild baja los
	// campos públicos al constructor (`this.x = $state(…)`) y Svelte rechaza
	// esa posición (`state_invalid_placement`). Los privados se preservan.
	#connected = $state(false);
	#controls = $state<InspectorControl[]>([]);
	#values = $state<Record<string, number>>({});
	#title = $state('INSPECTOR');
	#statusLabel = $state('…');
	#statusDetail = $state('');

	constructor(target: () => Window | null, registryId = 'layout', pollMs = 300) {
		this.#target = target;
		this.#registryId = registryId;
		this.#pollMs = pollMs;
	}

	get connected(): boolean {
		return this.#connected;
	}

	get controls(): InspectorControl[] {
		return this.#controls;
	}

	get values(): Record<string, number> {
		return this.#values;
	}

	get title(): string {
		return this.#title;
	}

	get statusLabel(): string {
		return this.#statusLabel;
	}

	get statusDetail(): string {
		return this.#statusDetail;
	}

	/** Registro remoto, o `null` si el documento todavía no lo publicó. */
	get remote(): RemoteInspector | null {
		const w = this.#target() as HostWindow | null;
		return w?.__inspectors?.[this.#registryId] ?? null;
	}

	/** Empieza a esperar a que el documento remoto registre su inspector. */
	connect() {
		this.#connected = false;
		this.#controls = [];
		clearInterval(this.#pollId);
		this.#pollId = setInterval(() => {
			if (!this.remote?.ready) return;
			clearInterval(this.#pollId);
			this.pull();
			this.#connected = true;
		}, this.#pollMs);
	}

	disconnect() {
		clearInterval(this.#pollId);
		this.#connected = false;
	}

	/** Relee catálogo + valores del documento remoto. */
	pull() {
		const r = this.remote;
		if (!r?.ready) return;
		this.#controls = r.schema; // objetos planos, no proxies del otro realm
		this.#values = Object.fromEntries(this.controls.map((c) => [c.id, r.read(c.id)]));
		this.#title = r.title;
		this.#statusLabel = r.status.label || '?';
		this.#statusDetail = r.status.detail ?? '';
	}

	write(id: string, value: number, save = false) {
		const r = this.remote;
		if (!r) return;
		r.write(id, value); // el host del juego sincroniza su HUD
		this.#values[id] = value;
		if (save) r.commit();
	}

	commit() {
		this.remote?.commit();
	}

	/** El clamp/redondeo del paso fino lo resuelve el registro remoto. */
	step(id: string, dir: 1 | -1, mult = 1) {
		const r = this.remote;
		if (!r) return;
		this.#values[id] = r.step(id, dir, mult);
	}

	toggle(id: string, on: boolean) {
		const r = this.remote;
		if (!r) return;
		this.#values[id] = r.toggle(id, on);
	}

	/** Estado on/off de un toggle según la copia local de valores. */
	isOn(control: InspectorControl): boolean {
		if (control.kind !== 'toggle') return false;
		const v = this.#values[control.id] ?? control.off;
		return Math.abs(v - control.on) < Math.abs(v - control.off);
	}

	reset() {
		this.remote?.reset();
		this.pull();
	}

	snapshot(): Record<string, unknown> {
		return this.remote?.snapshot() ?? {};
	}
}
