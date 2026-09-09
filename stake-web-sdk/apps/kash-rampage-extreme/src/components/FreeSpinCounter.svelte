<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	// Contador de FREE SPINS.
	//
	// Drop 09-09 (Paso 8): dejó de vivir dentro del wrapper del board. Antes se
	// montaba en un `<MainContainer>` del Container que aplica `boardTransform`,
	// así que heredaba la escala y la posición de la grilla: con el board
	// grande el badge se iba fuera de pantalla y no había forma de recuperarlo.
	//
	// Ahora es un elemento SUELTO en coordenadas de canvas —igual que el HUD
	// superior y el título— con sus cinco diales propios en el UI LAB
	// (`fsX`, `fsY`, `fsScale`, `fsAlpha`, `fsZ`). Se posiciona como fracción
	// del canvas y se clampa para no poder sacarlo del viewport.
	import { FadeContainer } from 'components-pixi';
	import { Container, Rectangle, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';
	import { stateTweak } from '../game/stateTweak.svelte';
	import { uiScaleFor } from '../game/hudLayout';

	const context = getContext();

	let show = $state(false);
	let current = $state(0);
	let total = $state(0);

	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => (show = true),
		freeSpinCounterHide: () => (show = false),
		freeSpinCounterUpdate: (emitterEvent) => {
			if (emitterEvent.current !== undefined) current = emitterEvent.current;
			if (emitterEvent.total !== undefined) total = emitterEvent.total;
		},
	});

	// Tamaño de diseño en px de canvas a uiScale 1 (desktop 1200×675), igual
	// criterio que el HUD superior: el slider es un trim POR BUCKET encima.
	const cs = $derived(context.stateLayoutDerived.canvasSizes());
	const uiScale = $derived(uiScaleFor(cs.width, cs.height));
	const panelW = $derived(SYMBOL_SIZE * 2 * stateTweak.fsScale * uiScale);
	const panelH = $derived(panelW * 0.4); // conserva el aspect 2 : 0.8 del diseño
	// Los bordes naranjas también escalan: a 2 px fijos desaparecían al achicar
	// y se veían como una franja al agrandar.
	const borderH = $derived(Math.max(1, panelH * 0.03));

	// Clamp dentro del canvas, por el mismo motivo que en TopHud: el contador de
	// free spins es un dato OBLIGATORIO en pantalla (`01-stake-approval-
	// checklist.md`), así que el modo LIBRE no lo exime. Dentro del canvas el
	// usuario lo posiciona a gusto; el clamp solo garantiza que no se salga.
	const MARGIN = 4;
	const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
	const originX = $derived(clamp(cs.width * stateTweak.fsX, MARGIN, cs.width - MARGIN - panelW));
	const originY = $derived(clamp(cs.height * stateTweak.fsY, MARGIN, cs.height - MARGIN - panelH));
</script>

<!-- `alpha` va en un Container INTERNO y no en el FadeContainer: ese aplica
     `alpha={alpha.current}` DESPUÉS de esparcir el resto de las props, así que
     un alpha propio se perdería contra el tween de entrada/salida. `zIndex` sí
     pasa derecho — es de las props que reenvía. -->
<FadeContainer {show} x={originX} y={originY} zIndex={stateTweak.fsZ}>
	<Container alpha={stateTweak.fsAlpha}>
		<Rectangle width={panelW} height={panelH} backgroundColor={0x0d0c0a} alpha={0.9} />
		<Rectangle width={panelW} height={borderH} backgroundColor={0xff7a1a} />
		<Rectangle y={panelH - borderH} width={panelW} height={borderH} backgroundColor={0xff7a1a} />
		<Container x={panelW / 2} y={panelH * 0.32}>
			<Text
				text="FREE SPIN"
				anchor={{ x: 0.5, y: 0.5 }}
				style={{
					fill: 0xff7a1a,
					fontSize: panelH * 0.25,
					fontWeight: '700',
					letterSpacing: 2,
				}}
			/>
		</Container>
		<Container x={panelW / 2} y={panelH * 0.68}>
			<Text
				text={`${current} / ${total}`}
				anchor={{ x: 0.5, y: 0.5 }}
				style={{
					fill: 0xf6ef1b,
					fontSize: panelH * 0.4,
					fontWeight: '900',
					letterSpacing: 1,
				}}
			/>
		</Container>
	</Container>
</FadeContainer>
