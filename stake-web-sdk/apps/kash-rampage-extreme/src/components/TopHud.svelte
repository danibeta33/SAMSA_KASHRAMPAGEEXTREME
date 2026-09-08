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
	//   4. En viewports angostos se sacrifican TUMBLE y el título — nunca
	//      BALANCE ni LAST WIN.
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

	// Umbrales heredados de las media queries de TopBar.svelte.
	const TUMBLE_MIN_W = 430;
	const TITLE_MIN_W = 360;

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

	const panelW = $derived(PANEL_W_BASE * stateTweak.hudScale * uiScale);
	const panelH = $derived(panelW / CONTENEDOR1_ASPECT);
	const gap = $derived(stateTweak.hudGap * uiScale);

	const titleW = $derived(TITLE_W_BASE * stateTweak.titleScale * uiScale);
	const titleH = $derived(titleW / TITLE_ASPECT);

	// AUTO LAYOUT: el toggle `hudVertical` decide si el paso se aplica en Y
	// (columna, como la referencia) o en X (fila, como el HUD viejo). El paso es
	// el lado que corresponde MÁS el gap, así que los recipientes nunca se
	// pisan por más que se agrande la escala.
	const vertical = $derived(stateTweak.hudVertical >= 0.5);
	const step = $derived((vertical ? panelH : panelW) + gap);

	const showTumble = $derived(cs.width > TUMBLE_MIN_W);
	const showTitle = $derived(cs.width > TITLE_MIN_W);

	// Se arma como lista para que el layout no dependa de cuántos items haya:
	// al caer TUMBLE en viewports angostos, los dos que quedan se re-acomodan
	// solos sin dejar un hueco.
	const items = $derived(
		[
			isReplay
				? { key: 'bet', label: 'BET', value: money(stateBet.wageredBetAmount) }
				: { key: 'balance', label: 'BALANCE', value: money(stateBet.balanceAmount) },
			{ key: 'lastwin', label: 'LAST WIN', value: moneyWinFromBookAmount(lastWinBookAmount) },
			...(showTumble ? [{ key: 'tumble', label: 'TUMBLE', value: `X${globalMult}` }] : []),
		],
	);

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
	// Dentro del canvas el usuario sigue posicionando libre.
	const MARGIN = 4;
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
{#if showTitle}
	<Container
		x={clamp(cs.width * stateTweak.titleX, MARGIN + titleW / 2, cs.width - MARGIN - titleW / 2)}
		y={clamp(cs.height * stateTweak.titleY, MARGIN + titleH / 2, cs.height - MARGIN - titleH / 2)}
	>
		<Sprite key="ui_title" anchor={{ x: 0.5, y: 0.5 }} width={titleW} height={titleH} />
	</Container>
{/if}
