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

	const KASH_W = 528;
	const KASH_H = 1200;
	const KASH_ASPECT = KASH_W / KASH_H;

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

	// Layer 2 — Kash.
	const PANEL_HALF_H = 214; // main units: BOARD_SIZES.h/2 + padding del panel
	const kash = $derived.by(() => {
		if (bt.portrait) {
			const m = context.stateLayoutDerived.mainLayout().scale;
			const boardTop = sizes.height * bt.by - PANEL_HALF_H * m * bt.s;
			const gap = Math.max(boardTop - bt.topSafe, 40);
			const h = Math.min(gap * 1.9, sizes.height * 0.34);
			return {
				w: h * KASH_ASPECT,
				h,
				x: sizes.width * 0.19,
				// centro tal que ~36% del cuerpo queda detrás del board
				y: boardTop - h * 0.14,
			};
		}
		const targetH = sizes.height * stateTweak.kashH;
		return {
			w: targetH * KASH_ASPECT,
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
	const CLIP_ASPECT = 384 / 460; // idéntico para los 6 idles (alta res, recorte común)
	// El swing (Kash_Batea) viene de otro canvas (1080²) y con el cuerpo
	// desplazándose. Overrides para que su frame de reposo calce EXACTO con el
	// standby: cuerpo = 80% del crop → escala 1/0.8; centro del cuerpo en 44.1%
	// del ancho → anchorX; pies al fondo del crop → anchorY 1 (misma línea de
	// pies que los idles). Fuera de reposo el cuerpo se mueve (es el bateo).
	// Swing PLANTADO: cada frame recortado centrado en los PIES (ver
	// swing_planted.py) → Kash queda fijo, solo torso/bate se mueven. Los pies
	// quedan en el centro del crop (anchorX 0.5) y el cuerpo ocupa 84.7% del
	// crop → heightMul iguala su alto al standby.
	// Alineación fina horneada desde el AnimLab (dx/dy/escala que el usuario
	// ajustó contra el ghost del idle en resolución con kash.h=650: dx -26, dy -18,
	// escala 1.020 sobre los valores previos dx37/563, dy-4/563, escala 1.09*0.99).
	// swingAlign queda como tweak ADICIONAL en vivo (default 0/0/1) sobre estos valores.
	// dx/dy como FRACCIÓN de kash.h (no px absolutos) → la alineación se
	// mantiene en TODAS las resoluciones (el offset escala con el personaje).
	const SWING = {
		aspect: 423 / 460,
		heightMul: 1.09 * 0.99 * 1.02, // ≈1.1007 (escala horneada con el ajuste del lab)
		anchorX: 0.5,
		dxFrac: 37 / 563 - 26 / 650, // ≈0.0257 (offset horizontal relativo horneado)
		dyFrac: -4 / 563 - 18 / 650, // ≈-0.0348 (offset vertical relativo horneado)
	};
	const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

	let currentClip = $state('anim_kash_idle_stand1');
	let currentLoop = $state(true);
	let currentFrame = $state(0);

	// Debug (solo DEV): expone la posición REAL renderizada de Kash para el
	// AnimLab (líneas de referencia de pies/centro para detectar movimiento).
	$effect(() => {
		if (!import.meta.env.DEV) return;
		const isSwing = currentClip === 'anim_kash_swing';
		const dispH = isSwing ? kash.h * SWING.heightMul : kash.h;
		const dispW = isSwing ? dispH * SWING.aspect : kash.h * clipAspect;
		const anchorX = isSwing ? SWING.anchorX : 0.5;
		(globalThis as unknown as { __kashDbg?: unknown }).__kashDbg = {
			clip: currentClip,
			frame: currentFrame,
			loop: currentLoop,
			cw: sizes.width,
			ch: sizes.height,
			cx: kash.x, // centro del cuerpo (ancla del standby)
			feetY: kash.y + kash.h / 2, // línea de pies
			dispW,
			dispH,
			leftX: kash.x - anchorX * dispW,
			rightX: kash.x + (1 - anchorX) * dispW,
			topY: kash.y + kash.h / 2 - dispH,
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
	const clipAspect = CLIP_ASPECT;

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
		if (currentClip === 'anim_kash_swing' && !swingHit && frame >= SWING_STRIKE_FRAME) {
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
			if (currentClip === 'anim_kash_swing') {
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
			currentClip = 'anim_kash_swing';
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

<!-- Layer 1 — BG vault scene (cover, back). JPG hasta que el canvas del
     video está listo — mismo nodo, solo muta la textura. -->
<BaseSprite
	x={bgX}
	y={sizes.height / 2}
	anchor={0.5}
	texture={bgTexture}
	width={bgCover.w}
	height={bgCover.h}
	zIndex={-5}
/>

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
			<SpriteSheet
				key="anim_kash_idle_stand1"
				x={kash.x}
				y={kash.y + kash.h / 2}
				anchor={{ x: 0.5, y: 1 }}
				height={kash.h}
				width={kash.h * clipAspect}
				animationSpeed={10 / 60}
				loop
				play
				alpha={0.4}
				zIndex={16}
			/>
		{/if}
		{#key currentClip}
			{@const isSwing = currentClip === 'anim_kash_swing'}
			{@const swingH = kash.h * SWING.heightMul * (isSwing ? swingAlign.dscale : 1)}
			<SpriteSheet
				key={currentClip}
				x={kash.x + (isSwing ? kash.h * SWING.dxFrac + swingAlign.dx : 0)}
				y={kash.y + kash.h / 2 + (isSwing ? kash.h * SWING.dyFrac + swingAlign.dy : 0)}
				anchor={{ x: isSwing ? SWING.anchorX : 0.5, y: 1 }}
				height={isSwing ? swingH : kash.h}
				width={isSwing ? swingH * SWING.aspect : kash.h * clipAspect}
				animationSpeed={(isSwing ? 24 : 10) / 60}
				loop={currentLoop}
				play
				onComplete={onClipComplete}
				onFrameChange={onFrame}
				zIndex={isSwing ? (celebration.n > 0 ? -4 : 15) : -4}
			/>
		{/key}
	{:else if swingReady && currentClip === 'anim_kash_swing' && !currentLoop}
		<!-- PROTOTIPO batazo RAMPAGE con idles apagados: el swing KS1 reemplaza
		     al estático SOLO mientras dura el clip (onClipComplete vuelve a
		     standby → cae de nuevo al estático). Mismos transforms/zIndex que la
		     rama isSwing de arriba. -->
		{#key currentClip}
			{@const swingH = kash.h * SWING.heightMul * swingAlign.dscale}
			<SpriteSheet
				key="anim_kash_swing"
				x={kash.x + kash.h * SWING.dxFrac + swingAlign.dx}
				y={kash.y + kash.h / 2 + kash.h * SWING.dyFrac + swingAlign.dy}
				anchor={{ x: SWING.anchorX, y: 1 }}
				height={swingH}
				width={swingH * SWING.aspect}
				animationSpeed={24 / 60}
				loop={false}
				play
				onComplete={onClipComplete}
				onFrameChange={onFrame}
				zIndex={celebration.n > 0 ? -4 : 15}
			/>
		{/key}
	{:else}
		<!-- fallback hasta que cargue la stand-by webp -->
		<Sprite
			x={kash.x}
			y={kash.y + kash.h / 2}
			anchor={{ x: 0.5, y: 1 }}
			key="kash_side"
			width={kash.w}
			height={kash.h}
			zIndex={-4}
		/>
	{/if}
{/if}
