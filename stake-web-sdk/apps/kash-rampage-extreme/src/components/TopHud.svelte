<script lang="ts">
	// HUD SUPERIOR (drop 08-09, ref. REFERENCIA_NUEVA_UI.png).
	//
	// Reemplaza a TopBar.svelte, que era una franja HTML `position: fixed` con
	// los 4 datos en un solo contenedor. Ahora son piezas independientes DENTRO
	// del canvas Pixi: el logo del juego suelto y tres recipientes
	// (Balance / Last Win / Tumble) que se acomodan solos en fila o columna.
	//
	// Se monta en Game.svelte como hermano de <Background />, FUERA del
	// <Container> que aplica boardTransform: así vive en coordenadas de canvas y
	// se puede mover libre sin que lo arrastre la escala del board.
	//
	// ⚠ Este componente hereda requisitos de approval que TopBar ya cumplía. No
	// son cosméticos — están enumerados en `01-stake-approval-checklist.md` y en
	// el log de rechazos de Kash Smash:
	//   1. En bet replay se OCULTA el balance y en su lugar se muestra el bet de
	//      la ronda replayada (/docs/api/bet-replay).
	//   2. LAST WIN se actualiza INCREMENTALMENTE durante la cadena de tumbles,
	//      no solo al final (payout incremental con múltiples acciones ganadoras).
	//   3. TUMBLE muestra el multiplicador global REAL, no un X1 decorativo.
	//   4. Los cuatro datos (BALANCE/BET, LAST WIN, TUMBLE y el título) están
	//      SIEMPRE en pantalla. Antes, en viewports angostos se escondían
	//      TUMBLE (<430 de ancho) y el título (<360) con los umbrales heredados
	//      de las media queries de TopBar; el usuario los reportó como faltantes
	//      en Popout S y los tres Mobile. Ahora en vez de ocultarlos el grupo se
	//      ACHICA para entrar (ver `fit` más abajo).
	import { Container, Sprite } from 'pixi-svelte';
	import { stateBet, stateUrlDerived } from 'state-shared';

	import Contenedor1, { CONTENEDOR1_ASPECT } from './Contenedor1.svelte';
	import { getContext } from '../game/context';
	import { money, moneyWinFromBookAmount } from '../game/money';
	import { uiScaleFor } from '../game/hudLayout';
	import { stateTweak } from '../game/stateTweak.svelte';

	// Tamaños de diseño en px de canvas a uiScale 1 (desktop 1200×675). Los
	// sliders del UI LAB son un trim POR BUCKET encima de esto, igual que
	// `stackScale` hace con el stack BET/SPIN en hudLayout.ts.
	const PANEL_W_BASE = 175;
	const TITLE_W_BASE = 200;
	const TITLE_ASPECT = 1306 / 804; // arte: static/assets/ui/Title.png

	const context = getContext();

	// Bet replay: sin sesión de wallet no hay balance que mostrar; se reemplaza
	// por el bet de la ronda, que sí hay que mantener visible.
	const isReplay = stateUrlDerived.replay();

	let tumbleBookAmount = $state<number | null>(null);
	let globalMult = $state(1);
	context.eventEmitter.subscribeOnMount({
		tumbleWinAmountUpdate: (emitterEvent) => (tumbleBookAmount = emitterEvent.amount),
		tumbleWinAmountReset: () => (tumbleBookAmount = null),
		tumbleWinAmountHide: () => (tumbleBookAmount = null),
		globalMultiplierUpdate: (emitterEvent) => (globalMult = emitterEvent.multiplier),
		globalMultiplierHide: () => (globalMult = 1),
	});

	// El math emite el acumulado de la cadena de tumbles; mientras dura, manda
	// sobre el total del bet. Al cerrar la ronda vuelve a null y queda el final.
	const lastWinBookAmount = $derived(tumbleBookAmount ?? stateBet.winBookEventAmount);

	const cs = $derived(context.stateLayoutDerived.canvasSizes());
	const uiScale = $derived(uiScaleFor(cs.width, cs.height));

	// Se arma como lista para que el layout no dependa de cuántos items haya
	// (en replay BALANCE se reemplaza por BET, no se agrega uno más).
	const items = $derived([
		isReplay
			? { key: 'bet', label: 'BET', value: money(stateBet.wageredBetAmount) }
			: { key: 'balance', label: 'BALANCE', value: money(stateBet.balanceAmount) },
		{ key: 'lastwin', label: 'LAST WIN', value: moneyWinFromBookAmount(lastWinBookAmount) },
		{ key: 'tumble', label: 'TUMBLE', value: `X${globalMult}` },
	]);

	// AUTO LAYOUT: el toggle `hudVertical` decide si el paso se aplica en Y
	// (columna, como la referencia) o en X (fila, como el HUD viejo). El paso es
	// el lado que corresponde MÁS el gap, así que los recipientes nunca se
	// pisan por más que se agrande la escala.
	const vertical = $derived(stateTweak.hudVertical >= 0.5);

	// Tamaño que PIDE el bucket (slider `hudScale`), antes de contención.
	const panelWWanted = $derived(PANEL_W_BASE * stateTweak.hudScale * uiScale);
	const gapWanted = $derived(stateTweak.hudGap * uiScale);

	// ── FIT: el grupo se achica hasta entrar en el canvas ────────────────────
	// Reemplaza al viejo "si no entra, escondelo". Con 3 recipientes en FILA
	// (los buckets portrait) el ancho pedido se pasa del viewport — en Mobile S
	// son 404 px de grupo contra 320 de canvas — y el clamp de abajo solo movía
	// el origen, dejando TUMBLE fuera de pantalla. Acá se calcula cuánto hay que
	// encoger para que la caja completa entre, y se aplica a panel y gap por
	// igual para no deformar el ritmo del grupo. En los buckets donde ya entra
	// (todos los landscape) `fit` vale 1 y el slider manda tal cual.
	const MARGIN = 4;
	const count = $derived(items.length);
	const panelHWanted = $derived(panelWWanted / CONTENEDOR1_ASPECT);
	const wantW = $derived(
		vertical ? panelWWanted : count * panelWWanted + (count - 1) * gapWanted,
	);
	const wantH = $derived(
		vertical ? count * panelHWanted + (count - 1) * gapWanted : panelHWanted,
	);
	const fit = $derived(
		Math.min(
			1,
			(cs.width - 2 * MARGIN) / Math.max(1, wantW),
			(cs.height - 2 * MARGIN) / Math.max(1, wantH),
		),
	);

	const panelW = $derived(panelWWanted * fit);
	const panelH = $derived(panelW / CONTENEDOR1_ASPECT);
	const gap = $derived(gapWanted * fit);
	const step = $derived((vertical ? panelH : panelW) + gap);

	// El título tiene su propio dial y su propia contención: nunca más ancho que
	// el canvas (antes desaparecía entero bajo 360 px de ancho → Mobile S).
	const titleW = $derived(
		Math.min(TITLE_W_BASE * stateTweak.titleScale * uiScale, cs.width - 2 * MARGIN),
	);
	const titleH = $derived(titleW / TITLE_ASPECT);

	// ── Contención en pantalla ───────────────────────────────────────────────
	// Los recipientes se anclan al centro, así que el origen del grupo es el
	// CENTRO del primer item y la caja se extiende desde ahí hacia la derecha
	// (fila) o hacia abajo (columna).
	const spanW = $derived(vertical ? panelW : (items.length - 1) * step + panelW);
	const spanH = $derived(vertical ? (items.length - 1) * step + panelH : panelH);

	// El clamp se aplica SIEMPRE, también en `freeScale`. Es deliberado y es la
	// única excepción a la regla "en LIBRE el usuario es el cap": ese modo apaga
	// los topes ANTI-SOLAPE del board, que como mucho afean. Acá lo que está en
	// juego es que BALANCE o LAST WIN queden fuera del viewport, y eso no es un
	// solape sino un dato obligatorio que desaparece — falla de approval
	// directa. Con `hudX` 0.885 (medido del mock landscape) el panel se salía
	// 29 px en Mobile S y 39 px en Mobile L, y esos dos buckets justamente
	// vienen con freeScale = 1 en PER_BUCKET_SEED.
	// Dentro del canvas el usuario sigue posicionando libre. El `fit` de arriba
	// garantiza que la caja ENTRE; este clamp garantiza dónde.
	const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
	const originX = $derived(
		clamp(cs.width * stateTweak.hudX - panelW / 2, MARGIN, cs.width - MARGIN - spanW) + panelW / 2,
	);
	const originY = $derived(
		clamp(cs.height * stateTweak.hudY - panelH / 2, MARGIN, cs.height - MARGIN - spanH) + panelH / 2,
	);
</script>

<!-- Grupo de recipientes: un solo Container mueve/escala a los tres juntos. -->
<Container x={originX} y={originY}>
	{#each items as item, i (item.key)}
		<Container x={vertical ? 0 : i * step} y={vertical ? i * step : 0}>
			<Contenedor1 label={item.label} value={item.value} width={panelW} />
		</Container>
	{/each}
</Container>

<!-- Título: Container hermano y controles propios — se mueve y escala sin
     relación con el grupo de arriba (pedido explícito). -->
<Container
	x={clamp(cs.width * stateTweak.titleX, MARGIN + titleW / 2, cs.width - MARGIN - titleW / 2)}
	y={clamp(cs.height * stateTweak.titleY, MARGIN + titleH / 2, cs.height - MARGIN - titleH / 2)}
>
	<Sprite key="ui_title" anchor={{ x: 0.5, y: 0.5 }} width={titleW} height={titleH} />
</Container>
