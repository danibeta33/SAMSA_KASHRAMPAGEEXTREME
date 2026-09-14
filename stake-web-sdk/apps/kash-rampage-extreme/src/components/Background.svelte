<script lang="ts" module>
	// Feedback N1 #7: el bateo (The SMASH) ya no es parte de la rotación
	// random de idles — se dispara cuando hay win (small/big/mega/max).
	// broadcastAsync resuelve en el FRAME DE GOLPE del swing, así el caller
	// (setWin) puede sincronizar la celebración con el impacto del bate.
	// `source: 'rampage'` marca el bateo del KASH RAMPAGE: es el ÚNICO que
	// reproduce el clip mientras los idles KS1 están deshabilitados (prototipo
	// batazo→conversión pedido por dirección, 26-08). Sin source (wins de setWin)
	// mantiene el comportamiento actual: resuelve al toque.
	export type EmitterEventKashSwing = { type: 'kashSwing'; source?: 'rampage' };
</script>

<script lang="ts">
	// Background scene — 2 layers stacked back-to-front:
	//   1. Vault scene (rocas + grafiti KASH + puerta bóveda dorada) — cover fit
	//   2. Kash lateral (personaje con bat) — pegado al borde izq del board
	// El board frame neón ya NO vive acá: se renderiza en BoardFrame.svelte,
	// dentro del mismo MainContainer + wrapper que los reels, para que frame e
	// íconos escalen/muevan como un solo grupo en responsive.
	// Fondo ANIMADO vía canvas intermedio: el video (bg_vault.webm/mp4) se
	// dibuja frame a frame en un <canvas> oculto y Pixi usa el canvas como
	// textura. NUNCA VideoTexture directa — el WebGPU de Firefox no acepta
	// HTMLVideoElement como source (GPUQueue.copyExternalImageToTexture) y
	// revienta el render loop entero. Canvas está soportado por todos los
	// renderers. Mientras el video carga se muestra el JPG estático.
	import { onMount } from 'svelte';
	import * as PIXI from 'pixi.js';
	import { BaseSprite, Rectangle, Sprite, SpriteSheet, getContextApp } from 'pixi-svelte';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { stateTweak } from '../game/stateTweak.svelte';
	import { boardTransform } from '../game/hudLayout';
	import { triggerBoardShake } from '../game/boardShake.svelte';
	import { swingAlign } from '../game/swingAlign.svelte';
	import { celebration } from '../game/celebration.svelte';
	import { SpriteFactory, registerSpriteAnchors } from '../game/spriteFactory';
	import {
		SPRITE_PLACEMENTS,
		clearSpritePlacement,
		getSpritePlacement,
		putSpritePlacement,
	} from '../game/spriteConfig.svelte';

	const BG_ASPECT = 16 / 9;

	// Sort por zIndex en el stage: sin esto el z-order es SOLO orden de
	// montaje y cualquier remount (p.ej. HMR en dev) puede poner el fondo
	// encima del juego. El sort es estable: los nodos con zIndex 0 conservan
	// su orden; solo BG (-5) y Kash (-4) van al fondo garantizado.
	const appContext = getContextApp();
	$effect(() => {
		const stage = appContext.stateApp.pixiApplication?.stage;
		if (stage) stage.sortableChildren = true;
	});

	const bgTexture = $derived(
		((appContext.stateApp.loadedAssets?.bg_vault as PIXI.Texture) || PIXI.Texture.EMPTY),
	);

	// ── Fondo ANIMADO (drop 07-09) ─────────────────────────────────────
	// `anim_fondo` es un sheet TexturePacker de 16 frames SIN recortar (el
	// frame ES el arte, 1728×972 = 16:9 exacto) que loopea limpio. Ocupa
	// exactamente el mismo hueco que el JPG: mismo cover, mismo centro, mismo
	// zIndex — así el encuadre en portrait (zoom + crop corrido) sigue valiendo
	// tal cual, y ahora además sin la deformación del 0.2% que tenía el sheet
	// anterior (era 634×356, un pelo más ancho que 16:9).
	//
	// El JPG estático NO desaparece: es el fallback mientras el clip carga (~13MB
	// de webp, sin preload) y también si la carga falla.
	const fondoReady = $derived(
		((appContext.stateApp.loadedAssets?.anim_fondo as unknown as unknown[] | undefined)?.length ??
			0) > 0,
	);
	// Ancla y fps salen del registro, como el resto de los clips: este
	// componente sigue sin conocer un solo número de encuadre.
	const fondoSpeed = $derived((getSpritePlacement('anim_fondo').fps ?? 10) / 60);

	const context = getContext();
	const sizes = $derived(context.stateLayoutDerived.canvasSizes());
	const bt = $derived(
		boardTransform(sizes.width, sizes.height, context.stateLayoutDerived.mainLayout().scale),
	);

	// Kash SOLO en landscape (aspect ≥1.2): es arte compuesto a lo alto y en
	// portrait no entra sin pisar los iconos/board (pedido del usuario: en
	// portrait va sin Kash). En portrait el fondo + frame llenan la pantalla.
	const showDecor = $derived(sizes.width / sizes.height >= 1.2);

	// Layer 1 — BG covers canvas. En portrait: zoom extra + crop corrido
	// hacia la bóveda (lado derecho del arte) para que no queden las letras
	// gigantes del grafiti flotando detrás del board, + velo oscuro.
	const bgCover = $derived.by(() => {
		const canvasAspect = sizes.width / sizes.height;
		const zoom = bt.portrait ? 1.2 : 1;
		if (canvasAspect > BG_ASPECT) {
			return { w: sizes.width * zoom, h: (sizes.width / BG_ASPECT) * zoom };
		}
		return { w: sizes.height * BG_ASPECT * zoom, h: sizes.height * zoom };
	});
	const bgX = $derived(bt.portrait ? sizes.width / 2 - bgCover.w * 0.13 : sizes.width / 2);

	// Layer 2 — Kash. El alto es lo único que decide el componente: el ANCHO
	// sale del aspect que el registro de sprites tiene por assetId (los clips y
	// el PNG estático no comparten recorte), vía SpriteFactory.place().
	const PANEL_HALF_H = 214; // main units: BOARD_SIZES.h/2 + padding del panel
	const kash = $derived.by(() => {
		if (bt.portrait) {
			const m = context.stateLayoutDerived.mainLayout().scale;
			const boardTop = sizes.height * bt.by - PANEL_HALF_H * m * bt.s;
			const gap = Math.max(boardTop - bt.topSafe, 40);
			const h = Math.min(gap * 1.9, sizes.height * 0.34);
			return {
				h,
				x: sizes.width * 0.19,
				// centro tal que ~36% del cuerpo queda detrás del board
				y: boardTop - h * 0.14,
			};
		}
		const targetH = sizes.height * stateTweak.kashH;
		return {
			h: targetH,
			x: sizes.width * stateTweak.kashX,
			y: sizes.height * stateTweak.kashY,
		};
	});

	// ── Idles de Kash (clips del equipo, chroma azul) ──────────────────
	// Landscape: rotación viva. Una "stand-by" en loop como reposo; cada
	// ~9-16s una ACCIÓN random (gafas/rascada/mocos/bate) se reproduce UNA
	// vez y vuelve a una stand-by. Todos anclados a los PIES (bottom-center)
	// y a la misma altura → el personaje queda plantado y solo cambia lo que
	// hace. Aspect por clip (ancho/alto del frame procesado, alto ~340).
	// 9 clips con RECORTE COMÚN (mismo canvas del equipo) → Kash queda clavado
	// en el mismo lugar entre clips, sin "moverse". Todos comparten aspecto.
	// (stand3 estaba en otro zoom y nose2 en otro canvas → quedaron fuera.)
	const STANDBYS = ['anim_kash_idle_stand1'];
	// El swing (anim_kash_swing) NO está acá: es el SMASH del win (Feedback
	// N1 #7), se dispara vía el evento 'kashSwing' — la rotación random son
	// solo gestos.
	const ACTIONS = [
		'anim_kash_idle_glasses1',
		'anim_kash_idle_scratch1',
		'anim_kash_idle_nose1',
		'anim_kash_idle_bat1', 'anim_kash_idle_bat2',
	];
	// La GEOMETRÍA de cada clip (ancla, aspect, escala, fps, capa) ya no vive
	// acá: son datos del registro `spriteConfig.svelte.ts`, resueltos por
	// assetId. Este componente decide DÓNDE está el actor y QUÉ clip suena; no
	// conoce ni un solo número de encuadre, y no queda una sola rama `isSwing`.
	//
	// Eso es lo que elimina el salto: todos los clips de Kash resuelven al ancla
	// de PIES (0.5, 1) por su tag `character`, así el punto anclado en (x,y) es
	// la línea de pies aunque el bounding box del clip cambie.
	//
	// `registerSpriteAnchors` hace dos cosas de una: inyecta el resolver en
	// `pixi-svelte` (para que <Sprite>/<SpriteSheet> anclen solos por su `key`) y
	// le pasa el diccionario de texturas del loader a la factory imperativa.
	registerSpriteAnchors(() => appContext.stateApp.loadedAssets);

	const SWING_CLIP = 'anim_kash_swing';
	const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

	let currentClip = $state('anim_kash_idle_stand1');
	let currentLoop = $state(true);
	let currentFrame = $state(0);

	/**
	 * Props de dibujo de un clip, resueltas por la factory desde el registro. El
	 * punto de referencia es SIEMPRE el mismo para todos los clips —
	 * (kash.x, línea de pies)— sin un solo offset por animación: la diferencia
	 * entre uno y otro la pone el placement del asset, no el componente.
	 */
	const placeKash = (assetId: string) =>
		SpriteFactory.place(assetId, { x: kash.x, y: kash.y + kash.h / 2, height: kash.h });

	const kashPlaced = $derived(placeKash(currentClip));
	// Capa del SMASH: pasa por delante del board, salvo durante la celebración
	// (que va encima de todo). `foreground` es un dato del asset, no un
	// `isSwing`. Es una constante y no un slider porque no es una decisión de
	// layout sino la coreografía del batazo — tiene que quedar por debajo del
	// techo de celebraciones (CELEBRATION_LAYER = 20 en Game.svelte).
	const SWING_FRONT_LAYER = 15;
	// Capa de REPOSO de Kash: tweakeable desde el UI LAB (drop 09-09). Es
	// hermano directo del stage, igual que la grilla, el HUD y el título, así
	// que este número lo ordena contra los tres. Default −4 = donde estaba
	// clavado antes: detrás del board y delante del fondo (−5).
	const kashLayer = $derived(
		kashPlaced.foreground && celebration.n === 0 ? SWING_FRONT_LAYER : stateTweak.kashZ,
	);

	// DEV — el AnimLab sigue alineando el swing con dx/dy/dscale en píxeles de
	// canvas. Eso ya NO toca el render: se traduce a un override del registro.
	// Un offset es un ancla disfrazada (desplazar d px equivale a mover el pivot
	// d/tamaño), así que el tweak entra por el mismo canal por el que va a
	// escribir el Inspector Genérico en el Paso 4, y el camino de dibujo queda
	// libre de offsets. Con el default (0/0/1) no se escribe ningún override.
	$effect(() => {
		if (!import.meta.env.DEV) return;
		const { dx, dy, dscale, dwide } = swingAlign;
		if (dx === 0 && dy === 0 && dscale === 1 && dwide === 1) {
			clearSpritePlacement(SWING_CLIP);
			return;
		}
		// Base HORNEADA (no el valor resuelto): leer el override acá crearía un
		// ciclo con la escritura de este mismo efecto.
		const base = SPRITE_PLACEMENTS[SWING_CLIP];
		// Pivot neutro de un personaje: centro-abajo. Todo lo que el pivot del
		// swing se aparta de ahí ES el desplazamiento de alineación horneado, y
		// se puede recuperar en píxeles multiplicándolo por el tamaño base.
		const baseH = kash.h * (base.scale ?? 1);
		const baseW = baseH * (base.aspect ?? 1);
		const bakedDx = (0.5 - base.anchorX) * baseW;
		const bakedDy = (1 - base.anchorY) * baseH;
		// El slider de escala del lab cambia el tamaño, así que el pivot se
		// recalcula sobre el tamaño NUEVO: horneado + nudge, plegados de vuelta.
		// `dwide` entra por el ASPECT y no por la escala: así estira SOLO de los
		// lados —el alto y la línea de pies quedan intactos— que es justo lo que
		// corrige que el swing se vea más angosto que el resto de los clips.
		const scale = (base.scale ?? 1) * dscale;
		const aspect = (base.aspect ?? 1) * dwide;
		const height = kash.h * scale;
		const width = height * aspect;
		putSpritePlacement(SWING_CLIP, {
			...base,
			scale,
			aspect,
			anchorX: 0.5 - (bakedDx + dx) / width,
			anchorY: 1 - (bakedDy + dy) / height,
		});
	});

	// Debug (solo DEV): expone la posición REAL renderizada de Kash para el
	// AnimLab (líneas de referencia de pies/centro para detectar movimiento).
	$effect(() => {
		if (!import.meta.env.DEV) return;
		// Caja REAL renderizada: sale del mismo `place()` que dibuja el sprite,
		// así que ahora incluye los offsets del swing (antes la caja del lab se
		// dibujaba sin dx/dy y quedaba corrida respecto de lo que se veía).
		const p = kashPlaced;
		(globalThis as unknown as { __kashDbg?: unknown }).__kashDbg = {
			clip: currentClip,
			frame: currentFrame,
			loop: currentLoop,
			cw: sizes.width,
			ch: sizes.height,
			cx: kash.x, // centro del cuerpo (referencia: ancla del standby)
			feetY: kash.y + kash.h / 2, // línea de pies (referencia)
			dispW: p.width,
			dispH: p.height,
			leftX: p.x - p.anchor.x * p.width,
			rightX: p.x + (1 - p.anchor.x) * p.width,
			topY: p.y - p.anchor.y * p.height,
		};
	});
	// Arte nuevo de Kash integrado (04-09): los spritesheets reemplazados en
	// static/assets/sprites/anim/ (bat1/bat2/swing como PNG, resto como WEBP).
	// KASH_IDLES_ENABLED activado — las animaciones idle rotan en landscape.
	const KASH_IDLES_ENABLED = true;
	// PROTOTIPO 26-08 (mecánica pedida por dirección): el batazo del KASH RAMPAGE
	// sí reproduce el swing KS1 (outfit viejo, provisorio) para probar cómo se
	// siente que Kash cause la conversión: swing → golpe en frame 30 (shake +
	// AU-09) → wave de conversión de símbolos. Solo aplica a kashSwing con
	// source 'rampage'; al reactivar KASH_IDLES_ENABLED vuelve el swing en wins.
	const KASH_SWING_RAMPAGE_ENABLED = true;
	// La stand-by por defecto no está preloaded — hasta que cargue, se muestra
	// el sprite estático (kash_side, preloaded) para no dejar el hueco vacío.
	const idleReady = $derived(
		KASH_IDLES_ENABLED &&
			!!appContext.stateApp.loadedAssets?.[currentClip as keyof typeof appContext.stateApp.loadedAssets],
	);

	let actionTimer: ReturnType<typeof setTimeout>;
	// El golpe del swing se dispara por FRAME REAL (onFrameChange), no por ms:
	// el frame es determinista aunque el playback varíe. Frame ~43 del clip
	// kash_batea = el bate extendido hacia el board. swingHit evita repetir.
	// Swing ÚNICO (48f a 24fps). Verificado IN-GAME: el bate CONTACTA el grid en
	// el frame 31 (entra en la 1ra columna); frame 33+ ya es follow-through. El
	// jolt en 30 hace que la sacudida caiga justo en el golpe.
	const SWING_STRIKE_FRAME = 30;
	let swingHit = false;
	// Resolver pendiente del broadcastAsync('kashSwing'): se resuelve en el
	// frame de golpe → setWin sincroniza la celebración con el impacto.
	let strikeResolve: (() => void) | null = null;
	// Handler general de frame: actualiza currentFrame (para el AnimLab) y, SOLO
	// en el swing, dispara el golpe al board en el frame de contacto (shake +
	// SFX del bate AU-09 — Feedback N1 #7: el SMASH suena con su golpe).
	const onFrame = (frame: number) => {
		currentFrame = frame;
		if (currentClip === SWING_CLIP && !swingHit && frame >= SWING_STRIKE_FRAME) {
			swingHit = true;
			triggerBoardShake(24, 600);
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_explode' });
			strikeResolve?.();
			strikeResolve = null;
		}
	};
	const scheduleAction = () => {
		if (!KASH_IDLES_ENABLED) return; // sin idles no hay rotación que agendar
		actionTimer = setTimeout(
			() => {
				const clip = pick(ACTIONS);
				swingHit = false; // reset del golpe para el nuevo clip
				currentClip = clip;
				currentLoop = false;
				// SOLO el swing grande (kash_batea) es un bateo REAL y sacude el
				// board (vía onSwingFrame). bat1/bat2 son gestos idle (Kash
				// apunta/sostiene el bate), NO batean → sin shake.
			},
			9000 + Math.random() * 7000,
		);
	};
	// Fin de una acción (loop=false) → volver a una stand-by y re-agendar.
	const onClipComplete = () => {
		if (currentLoop) return;
		currentClip = pick(STANDBYS);
		currentLoop = true;
		scheduleAction();
	};
	// The SMASH (Feedback N1 #7): win → Kash batea. La promesa resuelve en el
	// frame de golpe (via strikeResolve en onFrame) para que setWin entre a la
	// celebración justo con el impacto. Sin Kash visible (portrait) o con el
	// SHEET DEL SWING sin cargar → resuelve al toque y la celebración sale sin
	// espera. OJO: el guard mira el asset del swing, NO idleReady (que es el
	// clip actual) — si mirara el clip actual, un win temprano con el swing a
	// medio cargar caería al sprite estático sin onFrameChange y setWin
	// quedaría colgado hasta el timeout.
	const swingReady = $derived(
		(KASH_IDLES_ENABLED || KASH_SWING_RAMPAGE_ENABLED) &&
			!!appContext.stateApp.loadedAssets?.anim_kash_swing,
	);
	context.eventEmitter.subscribeOnMount({
		kashSwing: async (event) => {
			if (!showDecor || !swingReady) return;
			// Con los idles KS1 apagados, solo el batazo del RAMPAGE reproduce el
			// clip; los kashSwing de wins mantienen el resolve inmediato actual.
			if (!KASH_IDLES_ENABLED && event.source !== 'rampage') return;
			// Wins encadenados (autoplay/turbo/replay): si el swing YA está en
			// curso, reasignar el mismo clip NO reinicia el sheet → el golpe de
			// este caller nunca llegaría y se comía el timeout de 1.6s (QA: 5
			// TIMEOUTs en 17 spins de autoplay). Si el golpe está pendiente nos
			// sumamos a su resolve; si ya pasó, la celebración sale al toque.
			if (currentClip === SWING_CLIP) {
				if (swingHit || !strikeResolve) return;
				await waitForResolve(
					(resolve) => {
						const prev = strikeResolve;
						strikeResolve = () => {
							prev?.();
							resolve();
						};
					},
					{ label: 'Background.kashSwing strike (join)', timeoutMs: 1600 },
				);
				return;
			}
			clearTimeout(actionTimer);
			swingHit = false;
			currentClip = SWING_CLIP;
			currentLoop = false;
			// Golpe en frame 30 @24fps ≈ 1.25s — el fallback apenas por encima:
			// si el clip no corre (race rara vista 1 vez en QA), la celebración
			// entra a lo sumo ~1.6s tarde en vez de 2.6s.
			await waitForResolve((resolve) => (strikeResolve = resolve), {
				label: 'Background.kashSwing strike',
				timeoutMs: 1600,
			});
		},
	});
	onMount(() => {
		scheduleAction();
		// QA hook (solo DEV): forzar un clip específico para capturarlo sin
		// esperar la rotación random. window.__forceIdle('anim_kash_swing').
		if (import.meta.env.DEV) {
			(globalThis as unknown as { __forceIdle?: (c: string) => void }).__forceIdle = (
				c: string,
			) => {
				clearTimeout(actionTimer);
				swingHit = false;
				currentClip = c;
				currentLoop = STANDBYS.includes(c);
			};
		}
		return () => {
			clearTimeout(actionTimer);
		};
	});
</script>

<!-- Layer 1 — BG vault scene (cover, back). El clip animado (anim_fondo) en
     cuanto está cargado; el JPG estático como fallback del primer instante.
     Mismo x/y/cover/zIndex en las dos ramas: el swap no mueve el encuadre. -->
{#if fondoReady}
	<SpriteSheet
		key="anim_fondo"
		x={bgX}
		y={sizes.height / 2}
		width={bgCover.w}
		height={bgCover.h}
		animationSpeed={fondoSpeed}
		loop
		play
		zIndex={-5}
	/>
{:else}
	<BaseSprite
		x={bgX}
		y={sizes.height / 2}
		anchor={0.5}
		texture={bgTexture}
		width={bgCover.w}
		height={bgCover.h}
		zIndex={-5}
	/>
{/if}

{#if bt.portrait}
	<!-- Velo oscuro en portrait: apaga el grafiti detrás del board -->
	<Rectangle
		x={0}
		y={0}
		width={sizes.width}
		height={sizes.height}
		backgroundColor={0x0b0a10}
		alpha={0.52}
		zIndex={-4.5}
	/>
{/if}

{#if showDecor}
	<!-- Layer 2 — Kash (landscape). Rotación de idles del equipo. Todos
	     anclados a los PIES (bottom-center) a la misma altura → plantado.
	     El {#key} fuerza remount limpio al cambiar de clip (gotoAndPlay 0). -->
	{#if idleReady}
		<!-- GHOST del idle standby (solo DEV, toggle en el AnimLab): referencia
		     semitransparente para alinear el bateo. -->
		{#if swingAlign.ghost}
			{@const ghost = placeKash('anim_kash_idle_stand1')}
			<SpriteSheet
				key="anim_kash_idle_stand1"
				x={ghost.x}
				y={ghost.y}
				height={ghost.height}
				width={ghost.width}
				animationSpeed={ghost.animationSpeed}
				loop
				play
				alpha={0.4}
				zIndex={16}
			/>
		{/if}
		{#key currentClip}
			<SpriteSheet
				key={currentClip}
				x={kashPlaced.x}
				y={kashPlaced.y}
				height={kashPlaced.height}
				width={kashPlaced.width}
				animationSpeed={kashPlaced.animationSpeed}
				loop={currentLoop}
				play
				onComplete={onClipComplete}
				onFrameChange={onFrame}
				alpha={stateTweak.kashAlpha}
				zIndex={kashLayer}
			/>
		{/key}
	{:else if swingReady && currentClip === SWING_CLIP && !currentLoop}
		<!-- PROTOTIPO batazo RAMPAGE con idles apagados: el swing KS1 reemplaza
		     al estático SOLO mientras dura el clip (onClipComplete vuelve a
		     standby → cae de nuevo al estático). Mismos transforms/zIndex que la
		     rama del clip actual — el placement sale del mismo registro. -->
		{#key currentClip}
			<SpriteSheet
				key={SWING_CLIP}
				x={kashPlaced.x}
				y={kashPlaced.y}
				height={kashPlaced.height}
				width={kashPlaced.width}
				animationSpeed={kashPlaced.animationSpeed}
				loop={false}
				play
				onComplete={onClipComplete}
				onFrameChange={onFrame}
				alpha={stateTweak.kashAlpha}
				zIndex={kashLayer}
			/>
		{/key}
	{:else}
		<!-- fallback hasta que cargue la stand-by webp -->
		{@const still = placeKash('kash_side')}
		<Sprite
			x={still.x}
			y={still.y}
			key="kash_side"
			width={still.width}
			height={still.height}
			alpha={stateTweak.kashAlpha}
			zIndex={kashLayer}
		/>
	{/if}
{/if}
