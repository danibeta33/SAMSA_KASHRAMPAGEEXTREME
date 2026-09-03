<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		// `added` presente = RETRIGGER (muestra "+N", los que se suman); ausente
		// = trigger inicial (muestra "N TOTAL").
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number; added?: number };
</script>

<script lang="ts">
	// STUB — wireframe FS-intro overlay (no Spine, no Sprite).
	// `freeSpinIntroUpdate` must resolve, otherwise the FS-trigger flow hangs.
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { FadeContainer } from 'components-pixi';
	import { Container, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { enterCelebration, exitCelebration } from '../game/celebration.svelte';

	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let addedSpins = $state<number | undefined>(undefined);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => {
			show = true;
			enterCelebration();
		},
		freeSpinIntroHide: () => {
			show = false;
			exitCelebration();
		},
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			addedSpins = emitterEvent.added;
			await new Promise<void>((resolve) => {
				oncomplete = resolve;
				// Retrigger (added): popup corto de +N. Trigger inicial: pausa larga.
				setTimeout(resolve, addedSpins !== undefined ? 900 : 1200);
			});
		},
	});

	// Texto según sea trigger inicial ("N TOTAL") o retrigger ("+N SPINS").
	const isRetrigger = $derived(addedSpins !== undefined);
	const countText = $derived(isRetrigger ? `+${addedSpins} SPINS` : `${freeSpinsFromEvent} TOTAL`);

	const sizes = $derived(context.stateLayoutDerived.canvasSizes());
	// Panel del equipo (fs_intro_panel, aspect 1400/684). El título "FREE
	// SPINS" y "TAP TO CONTINUE" vienen en el arte; solo va overlay el
	// contador, en la zona vacía del medio-abajo del panel.
	const PANEL_ASPECT = 1400 / 684;
	const panelW = $derived(Math.min(sizes.width * 0.82, 940));
	const panelH = $derived(panelW / PANEL_ASPECT);
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x0b0a10} backgroundAlpha={0.72} />
	<MainContainer>
		<Container
			x={context.stateLayoutDerived.mainLayout().width / 2}
			y={context.stateLayoutDerived.mainLayout().height / 2}
		>
			<Sprite key="fs_intro_panel" anchor={0.5} width={panelW} height={panelH} />
			<!-- Contador en la zona vacía central (brackets). Inclinado ~-4°
			     para calzar con el tilt del panel (paralelogramo). Retrigger:
			     "+N SPINS"; inicial: "N TOTAL". -->
			<Text
				text={countText}
				anchor={{ x: 0.5, y: 0.5 }}
				y={panelH * 0.12}
				rotation={-0.1}
				style={{
					fill: 0xf6ef1b,
					fontSize: panelH * 0.2,
					fontWeight: '900',
					letterSpacing: 4,
				}}
			/>
		</Container>
	</MainContainer>
	<OnHotkey hotkey="Space" onpress={() => oncomplete()} />
	<OnPressFullScreen onpress={() => oncomplete()} />
</FadeContainer>
