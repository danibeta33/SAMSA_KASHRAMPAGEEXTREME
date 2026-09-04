// ─────────────────────────────────────────────────────────────────────────────
// INSPECTOR GENÉRICO — registro reactivo de controles, acciones y diagnóstico.
//
// Este paquete NO sabe nada de ningún juego: no conoce `boardH`, `kashX`,
// `anim_kash_swing` ni `kash_tweak_v14`. Solo mantiene catálogos registrados
// EN RUNTIME por quien lo hospeda, y delega lectura, escritura, persistencia,
// ejecución y diagnóstico en el "host" que el juego inyecta con `configure()`.
//
// Dirección de la dependencia:
//
//   juego  ──registra──▶  InspectorRegistry  ◀──lee/renderiza──  UiLab/AnimLab
//
// Los paneles son consumidores pasivos del registro; el juego es el único que
// aporta semántica (etiquetas, rangos, callbacks, clave de persistencia).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CATEGORY = 'general';

export type InspectorCategoryConfig = {
	label?: string;
	order?: number;
};

export type InspectorCategory = {
	id: string;
	label: string;
	order: number;
};

export type InspectorSliderConfig = {
	label: string;
	min: number;
	max: number;
	step: number;
	/** Valor de referencia del juego (informativo — el valor vivo lo da el host). */
	default?: number;
	category?: string;
	order?: number;
	/** Decimales al redondear el paso fino (evita 0.30000000000000004). */
	decimals?: number;
};

export type InspectorToggleConfig = {
	label: string;
	default?: number;
	category?: string;
	order?: number;
	/** Valores numéricos que representan on/off (el host guarda números). */
	on?: number;
	off?: number;
};

/** Botón ejecutable: el juego inyecta el callback, el panel solo lo dispara. */
export type InspectorActionConfig = {
	label: string;
	category?: string;
	order?: number;
	/** Tooltip. */
	title?: string;
	/** Pista de estilo para el panel. */
	variant?: 'default' | 'accent' | 'soft' | 'mini';
	/** Acciones con el mismo `row` se dibujan en una fila horizontal. */
	row?: string;
	/**
	 * Bloquea el resto de las acciones mientras corre. Para secuencias largas
	 * (celebraciones, tiradas) que no deben solaparse entre sí.
	 */
	exclusive?: boolean;
	callback: () => void | Promise<void>;
};

export type InspectorSlider = {
	kind: 'slider';
	id: string;
	label: string;
	min: number;
	max: number;
	step: number;
	decimals: number;
	category: string;
	order: number;
	default: number | undefined;
};

export type InspectorToggle = {
	kind: 'toggle';
	id: string;
	label: string;
	on: number;
	off: number;
	category: string;
	order: number;
	default: number | undefined;
};

export type InspectorAction = {
	kind: 'action';
	id: string;
	label: string;
	category: string;
	order: number;
	title: string | undefined;
	variant: 'default' | 'accent' | 'soft' | 'mini';
	row: string | undefined;
	exclusive: boolean;
	callback: () => void | Promise<void>;
};

export type InspectorControl = InspectorSlider | InspectorToggle;

export type InspectorStatus = {
	/** Línea principal del encabezado (ej. el bucket activo). */
	label: string;
	/** Línea secundaria (ej. el viewport). */
	detail?: string;
};

/** Una fila del bloque de diagnóstico (el juego decide qué medir). */
export type InspectorDiagnosticRow = {
	label: string;
	value: string;
	/** Resalta la fila (ej. shake activo, delta fuera de tolerancia). */
	highlight?: boolean;
};

/**
 * Guía dibujada sobre el canvas, en PÍXELES DE PANTALLA. El juego hace la
 * conversión canvas→pantalla porque es el único que conoce su proyección.
 */
export type InspectorGuide = {
	id: string;
	kind: 'h' | 'v' | 'box';
	/** h: y · v: x · box: x/y/w/h */
	x?: number;
	y?: number;
	w?: number;
	h?: number;
	color?: string;
};

export type InspectorDiagnostics = {
	rows: InspectorDiagnosticRow[];
	guides?: InspectorGuide[];
	/** Mensaje cuando no hay datos (ej. "sin datos — landscape only"). */
	empty?: string;
};

/**
 * Contrato que el juego implementa para que el inspector pueda operar sobre su
 * estado sin conocerlo. Todo lo específico del juego vive acá.
 */
export type InspectorHost = {
	title?: string;
	/** Clave de localStorage — la aporta el juego, el inspector no la inventa. */
	storageKey?: string;
	/** Nota corta bajo el encabezado del panel. */
	note?: string;
	read?: (id: string) => number;
	/** Escritura EN VIVO (sin persistir) — el host sincroniza lo que necesite. */
	write?: (id: string, value: number) => void;
	/** Persistir el estado actual. */
	commit?: () => void;
	/** Volver al default del host. */
	reset?: () => void;
	status?: () => InspectorStatus;
	/** Objeto plano para COPY VALUES; si falta se arma con los controles. */
	snapshot?: () => Record<string, unknown>;
	/** Lectura de diagnóstico en vivo (el panel la pollea por rAF). */
	diagnostics?: () => InspectorDiagnostics | null;
};

export type InspectorActionRow = {
	id: string;
	actions: InspectorAction[];
};

export type InspectorGroup = {
	category: InspectorCategory;
	controls: InspectorControl[];
	actions: InspectorAction[];
	/** Las mismas acciones, agrupadas por `row` para el layout horizontal. */
	actionRows: InspectorActionRow[];
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const isDev = () => import.meta.env.DEV;

export class InspectorRegistry {
	#host = $state<InspectorHost | null>(null);
	#categories = $state<InspectorCategory[]>([]);
	#controls = $state<InspectorControl[]>([]);
	#actions = $state<InspectorAction[]>([]);
	#running = $state<string | null>(null);
	#seq = 0;

	/** Id del registro — se usa para publicar el hook DEV. */
	readonly id: string;

	constructor(id = 'default') {
		this.id = id;
	}

	// ── Lectura del catálogo (lo que consume la UI) ──────────────────────────
	get ready(): boolean {
		return this.#host !== null;
	}

	get title(): string {
		return this.#host?.title ?? 'INSPECTOR';
	}

	get storageKey(): string {
		return this.#host?.storageKey ?? '';
	}

	get note(): string {
		return this.#host?.note ?? '';
	}

	get controls(): InspectorControl[] {
		return this.#controls;
	}

	get actions(): InspectorAction[] {
		return this.#actions;
	}

	/** Id de la acción exclusiva en curso, o `null`. */
	get running(): string | null {
		return this.#running;
	}

	get categories(): InspectorCategory[] {
		return [...this.#categories].sort((a, b) => a.order - b.order);
	}

	/** Catálogo agrupado y ordenado — es lo que iteran los paneles. */
	get groups(): InspectorGroup[] {
		return this.categories
			.map((category) => {
				const actions = this.#actions
					.filter((a) => a.category === category.id)
					.sort((a, b) => a.order - b.order);
				return {
					category,
					controls: this.#controls
						.filter((c) => c.category === category.id)
						.sort((a, b) => a.order - b.order),
					actions,
					actionRows: toRows(actions),
				};
			})
			.filter((g) => g.controls.length > 0 || g.actions.length > 0);
	}

	get status(): InspectorStatus {
		return this.#host?.status?.() ?? { label: '' };
	}

	/** Lectura de diagnóstico del host (o `null` si no publica ninguna). */
	get diagnostics(): InspectorDiagnostics | null {
		return this.#host?.diagnostics?.() ?? null;
	}

	/**
	 * Copia PLANA del catálogo de controles. La usa el panel remoto, que corre
	 * en el window padre y lee este registro a través de un iframe: necesita
	 * objetos serializables, no proxies de `$state`.
	 */
	get schema(): InspectorControl[] {
		return $state.snapshot(this.#controls) as InspectorControl[];
	}

	// ── Registro (lo que llama el juego) ─────────────────────────────────────
	configure(host: InspectorHost) {
		this.#host = host;
		if (isDev()) {
			// Hooks DEV: el panel remoto (`/sizes`) corre fuera del iframe y
			// descubre el catálogo acá, en vez de importarlo en compilación.
			const g = globalThis as Record<string, unknown>;
			const all = (g.__inspectors ?? {}) as Record<string, unknown>;
			all[this.id] = this;
			g.__inspectors = all;
			if (this.id === 'layout') g.__inspector = this;
		}
	}

	registerCategory(id: string, config: InspectorCategoryConfig = {}) {
		const existing = this.#categories.find((c) => c.id === id);
		const next: InspectorCategory = {
			id,
			label: config.label ?? existing?.label ?? id,
			order: config.order ?? existing?.order ?? this.#seq++,
		};
		if (existing) Object.assign(existing, next);
		else this.#categories.push(next);
		return next;
	}

	registerSlider(id: string, config: InspectorSliderConfig): InspectorControl {
		return this.#registerControl({
			kind: 'slider',
			id,
			label: config.label,
			min: config.min,
			max: config.max,
			step: config.step,
			default: config.default,
			decimals: config.decimals ?? 4,
			category: this.#ensureCategory(config.category),
			order: config.order ?? this.#seq++,
		});
	}

	registerToggle(id: string, config: InspectorToggleConfig): InspectorControl {
		return this.#registerControl({
			kind: 'toggle',
			id,
			label: config.label,
			default: config.default,
			on: config.on ?? 1,
			off: config.off ?? 0,
			category: this.#ensureCategory(config.category),
			order: config.order ?? this.#seq++,
		});
	}

	/** Botón ejecutable. El panel lo dibuja; el callback es del juego. */
	registerAction(id: string, config: InspectorActionConfig): InspectorAction {
		const action: InspectorAction = {
			kind: 'action',
			id,
			label: config.label,
			title: config.title,
			variant: config.variant ?? 'default',
			row: config.row,
			exclusive: config.exclusive ?? false,
			callback: config.callback,
			category: this.#ensureCategory(config.category),
			order: config.order ?? this.#seq++,
		};
		const existing = this.#actions.find((a) => a.id === id);
		if (existing) {
			Object.assign(existing, action);
			return existing;
		}
		this.#actions.push(action);
		return action;
	}

	/** Atajo para registrar una lista de acciones de una misma categoría. */
	registerActions(configs: (InspectorActionConfig & { id: string })[]) {
		for (const { id, ...config } of configs) this.registerAction(id, config);
	}

	unregister(id: string) {
		const i = this.#controls.findIndex((c) => c.id === id);
		if (i >= 0) this.#controls.splice(i, 1);
		const j = this.#actions.findIndex((a) => a.id === id);
		if (j >= 0) this.#actions.splice(j, 1);
	}

	/** Vacía el registro (HMR / cambio de juego hospedado). */
	clear() {
		this.#controls.splice(0, this.#controls.length);
		this.#actions.splice(0, this.#actions.length);
		this.#categories.splice(0, this.#categories.length);
		this.#host = null;
		this.#running = null;
		this.#seq = 0;
	}

	// ── Operación sobre el estado del host ───────────────────────────────────
	read(id: string): number {
		return this.#host?.read?.(id) ?? 0;
	}

	write(id: string, value: number) {
		this.#host?.write?.(id, value);
	}

	commit() {
		this.#host?.commit?.();
	}

	reset() {
		this.#host?.reset?.();
	}

	/**
	 * Ejecuta una acción registrada. Si es `exclusive`, bloquea al resto hasta
	 * que su promesa resuelve (el panel deshabilita los botones mirando
	 * `running`).
	 */
	async run(id: string): Promise<void> {
		const action = this.#actions.find((a) => a.id === id);
		if (!action) return;
		if (!action.exclusive) {
			await action.callback();
			return;
		}
		if (this.#running) return;
		this.#running = id;
		try {
			await action.callback();
		} finally {
			this.#running = null;
		}
	}

	/** Paso fino de un slider (− / +). Clampa, redondea y persiste. */
	step(id: string, dir: 1 | -1, mult = 1): number {
		const control = this.#controls.find((c) => c.id === id);
		if (!control || control.kind !== 'slider') return this.read(id);
		const raw = this.read(id) + dir * control.step * mult;
		const next = clamp(Number(raw.toFixed(control.decimals)), control.min, control.max);
		this.write(id, next);
		this.commit();
		return next;
	}

	/** Alterna un toggle entre sus valores on/off y persiste. */
	toggle(id: string, on: boolean): number {
		const control = this.#controls.find((c) => c.id === id);
		if (!control || control.kind !== 'toggle') return this.read(id);
		const next = on ? control.on : control.off;
		this.write(id, next);
		this.commit();
		return next;
	}

	/** true si el valor vivo del toggle está más cerca de `on` que de `off`. */
	isOn(id: string): boolean {
		const control = this.#controls.find((c) => c.id === id);
		if (!control || control.kind !== 'toggle') return false;
		const v = this.read(id);
		return Math.abs(v - control.on) < Math.abs(v - control.off);
	}

	/** Objeto plano para COPY VALUES. */
	snapshot(): Record<string, unknown> {
		if (this.#host?.snapshot) return this.#host.snapshot();
		const status = this.status;
		return {
			status: status.label,
			detail: status.detail,
			...Object.fromEntries(this.#controls.map((c) => [c.id, this.read(c.id)])),
		};
	}

	// ── Internos ─────────────────────────────────────────────────────────────
	#ensureCategory(id?: string): string {
		const key = id ?? DEFAULT_CATEGORY;
		if (!this.#categories.some((c) => c.id === key)) this.registerCategory(key);
		return key;
	}

	#registerControl(control: InspectorControl): InspectorControl {
		const existing = this.#controls.find((c) => c.id === control.id);
		if (existing) {
			Object.assign(existing, control);
			return existing;
		}
		this.#controls.push(control);
		return control;
	}
}

/** Agrupa acciones consecutivas que comparten `row` en una fila horizontal. */
const toRows = (actions: InspectorAction[]): InspectorActionRow[] => {
	const rows: InspectorActionRow[] = [];
	for (const action of actions) {
		const key = action.row ?? `__solo_${action.id}`;
		const last = rows[rows.length - 1];
		if (last && last.id === key) last.actions.push(action);
		else rows.push({ id: key, actions: [action] });
	}
	return rows;
};

/**
 * Registros por defecto del SDK. Cada panel usa el suyo para que un juego
 * pueda tener varios laboratorios independientes:
 *   `inspector`     → panel de layout / sliders (UiLab, tecla T)
 *   `animInspector` → panel de acciones / diagnóstico (AnimLab, tecla A)
 * Un juego puede crear más con `new InspectorRegistry('mi-panel')`.
 */
export const inspector = new InspectorRegistry('layout');
export const animInspector = new InspectorRegistry('anim');
