<script lang="ts" module>
	import type { SymbolName } from '../game/types';

	// Estallido + reemplazo de un símbolo del KASH RAMPAGE: `symbol` es el
	// símbolo VIEJO (`from` del book) — su textura se rompe en fragmentos — y
	// `to` es el símbolo nuevo, que CAE desde arriba del marco y aterriza en la
	// celda. Mientras cae, la celda del engine va oculta (stateRampage).
	export type EmitterEventRampageShatter = {
		type: 'rampageShatter';
		reel: number;
		row: number;
		symbol: SymbolName;
		to: SymbolName;
	};
</script>

<script lang="ts">
	// Capa del batazo (prototipo 26-08, feedback de dirección: "que los quiebre…
	// y caigan los nuevos"). Por celda convertida: (1) la textura del símbolo
	// viejo se corta en 3×3 y los 9 pedazos vuelan con velocidad radial +
	// gravedad + rotación + fade; (2) la celda queda VACÍA un beat; (3) el
	// símbolo nuevo cae desde arriba del marco con aceleración y aterriza —
	// recién ahí se desoculta el símbolo real del engine (mismo frame, sin
	// flash). Vive en el contexto ESTÁTICO del board (durante el rampage nada
	// gira) y BoardMask recorta tanto esquirlas como la entrada del que cae.
	import * as PIXI from 'pixi.js';
	import { BaseSprite, getContextApp } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, SYMBOL_SHEET_ASPECT } from '../game/constants';
	import {
		rampageUnhide,
		RAMPAGE_FALL_DELAY_MS,
		RAMPAGE_FALL_DUR_MS,
	} from '../game/stateRampage.svelte';
	import SymbolWrap from './SymbolWrap.svelte';

	const GRID = 3; // 3×3 = 9 fragmentos por símbolo
	const LIFE_MS = 700;
	const FADE_FROM = 0.45; // fracción de vida donde arranca el fade
	const GRAVITY = 1400; // unidades board/s² (celda = 80)
	// Caída del símbolo nuevo: beat de celda vacía + caída con ease-in.
	const FALL_DELAY_MS = RAMPAGE_FALL_DELAY_MS;
	const FALL_DUR_MS = RAMPAGE_FALL_DUR_MS;
	// El sprite del símbolo se dibuja a 0.8 de celda de ALTO (mkSprite) y con el
	// ancho derivado del aspect de su hoja (1080×970) → los fragmentos arrancan
	// cubriendo exactamente esa caja. Eran cuadrados hasta el fix del 11-09, así
	// que las esquirlas salían un 10 % más angostas que el símbolo que rompían.
	const SYM_BOX_H = SYMBOL_SIZE * 0.8;
	const SYM_BOX_W = SYM_BOX_H * SYMBOL_SHEET_ASPECT;

	type Fragment = {
		texture: PIXI.Texture;
		ox: number; // offset inicial del centro del fragmento vs centro de celda
		oy: number;
		vx: number;
		vy: number;
		vrot: number;
	};
	type Burst = { id: number; x: number; y: number; bornAt: number; fragments: Fragment[] };
	type Faller = {
		id: number;
		x: number;
		y: number; // centro de la celda destino (coords board)
		bornAt: number;
		texture: PIXI.Texture;
		fromOffset: number; // offset Y inicial (negativo, arriba del marco)
		reelSymbol: object; // ref para desocultar al aterrizar
	};

	const context = getContext();
	const appContext = getContextApp();

	let bursts = $state<Burst[]>([]);
	let fallers = $state<Faller[]>([]);
	let now = $state(0);
	let nextId = 0;

	const easeInQuad = (p: number) => p * p;

	// Un solo rAF-loop mientras haya bursts o fallers vivos; expira y limpia solo.
	$effect(() => {
		if (bursts.length === 0 && fallers.length === 0) return;
		let raf = 0;
		const loop = (t: number) => {
			now = t;
			bursts = bursts.filter((b) => t - b.bornAt < LIFE_MS);
			const landed = fallers.filter((f) => t - f.bornAt >= FALL_DELAY_MS + FALL_DUR_MS);
			if (landed.length) {
				// Desocultar el símbolo del engine en el MISMO update que borra la
				// copia en caída → sin frame doble ni hueco.
				landed.forEach((f) => rampageUnhide(f.reelSymbol));
				fallers = fallers.filter((f) => !landed.includes(f));
			}
			if (bursts.length > 0 || fallers.length > 0) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const symTexture = (name: SymbolName) =>
		appContext.stateApp.loadedAssets?.[
			`sym_${name.toLowerCase()}` as keyof typeof appContext.stateApp.loadedAssets
		] as PIXI.Texture | undefined;

	context.eventEmitter.subscribeOnMount({
		rampageShatter: ({ reel, row, symbol, to }) => {
			const reelSymbol = context.stateGame.board[reel]?.reelState.symbols[row];
			if (!reelSymbol) return;
			const x = getSymbolX(reel);
			const y = reelSymbol.symbolY();
			const bornAt = performance.now();

			// (1) Fragmentos del símbolo viejo — sin textura cargada, sin esquirlas
			// (el reemplazo sigue igual).
			const fromTexture = symTexture(symbol);
			if (fromTexture?.source) {
				const pieceW = fromTexture.width / GRID;
				const pieceH = fromTexture.height / GRID;
				const dispX = SYM_BOX_W / GRID;
				const dispY = SYM_BOX_H / GRID;
				const fragments: Fragment[] = [];
				for (let i = 0; i < GRID; i += 1) {
					for (let j = 0; j < GRID; j += 1) {
						const ox = (j - (GRID - 1) / 2) * dispX;
						const oy = (i - (GRID - 1) / 2) * dispY;
						fragments.push({
							texture: new PIXI.Texture({
								source: fromTexture.source,
								frame: new PIXI.Rectangle(j * pieceW, i * pieceH, pieceW, pieceH),
							}),
							ox,
							oy,
							// Radial desde el centro + jitter + patada hacia arriba: lee
							// como golpe seco, la gravedad se los lleva después.
							vx: ox * 7 + (Math.random() - 0.5) * 160,
							vy: oy * 7 - (140 + Math.random() * 220),
							vrot: (Math.random() - 0.5) * 14,
						});
					}
				}
				bursts = [...bursts, { id: nextId++, x, y, bornAt, fragments }];
			}

			// (2+3) El símbolo nuevo cae desde arriba del marco. Si su textura no
			// cargó todavía, desocultar al toque (mejor pop instantáneo que celda
			// invisible).
			const toTexture = symTexture(to);
			if (toTexture?.source) {
				fallers = [
					...fallers,
					{
						id: nextId++,
						x,
						y,
						bornAt,
						texture: toTexture,
						// Arranca justo por encima del borde superior del marco (y=0
						// en coords board), venga de la fila que venga.
						fromOffset: -(y + SYM_BOX_H),
						reelSymbol,
					},
				];
			} else {
				rampageUnhide(reelSymbol);
			}
			now = bornAt;
		},
	});

	const alphaAt = (t: number) => {
		const life = t / (LIFE_MS / 1000);
		if (life <= FADE_FROM) return 1;
		return Math.max(0, 1 - (life - FADE_FROM) / (1 - FADE_FROM));
	};

	const fallOffset = (f: Faller) => {
		const t = now - f.bornAt - FALL_DELAY_MS;
		if (t <= 0) return f.fromOffset;
		const p = Math.min(1, t / FALL_DUR_MS);
		return f.fromOffset * (1 - easeInQuad(p));
	};
</script>

{#each bursts as b (b.id)}
	{@const t = Math.max(0, (now - b.bornAt) / 1000)}
	<SymbolWrap x={b.x} y={b.y} animating={false}>
		{#each b.fragments as f, k (k)}
			<BaseSprite
				texture={f.texture}
				anchor={0.5}
				x={f.ox + f.vx * t}
				y={f.oy + f.vy * t + 0.5 * GRAVITY * t * t}
				rotation={f.vrot * t}
				width={SYM_BOX_W / GRID}
				height={SYM_BOX_H / GRID}
				alpha={alphaAt(t)}
			/>
		{/each}
	</SymbolWrap>
{/each}

{#each fallers as f (f.id)}
	<SymbolWrap x={f.x} y={f.y} animating={false}>
		<BaseSprite
			texture={f.texture}
			anchor={0.5}
			x={0}
			y={fallOffset(f)}
			width={SYM_BOX_W}
			height={SYM_BOX_H}
		/>
	</SymbolWrap>
{/each}
