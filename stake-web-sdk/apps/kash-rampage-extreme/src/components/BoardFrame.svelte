<script lang="ts" module>
	// Keep the EmitterEventBoardFrame shape so the EventEmitter exhaustiveness
	// check stays happy. bookEventHandlerMap broadcasts these around freegame
	// trigger/end.
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	// Board frame — rendered HERE (inside the same MainContainer + grid
	// wrapper as the reels) so frame + icons behave as ONE group: any
	// responsive change to the board transform moves/scales both together.
	//
	// Landscape: the neon board_frame.png, sized relative to boardLayout.
	// The ratios below were derived from the user-approved on-screen layout
	// at Desktop 1200×675 (frame 604×512 px, centro (622.8, 319.95)) mapped
	// back through wrapper + mainLayout transforms into board coordinates.
	// The local aspect is ~1:1 on purpose — the wrapper's non-uniform stretch
	// (1.492, 1.267) restores the PNG's native 2000:1694 aspect on screen.
	//
	// Portrait / almost-square: the PNG is landscape art — draw a dark panel
	// + thin neon edge instead (readability over the graffiti BG).
	import { Container, Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	// Frame size/offset como fracciones de BOARD_SIZES — tweakeables en vivo
	// desde UiLab (frameW/frameH/frameX/frameY). Los DEFAULTS del estado son
	// la calibración medida del PNG (hueco 87.65%×76.51%, centrado al board).
	import { stateUiTweak } from '../game/stateUiTweak.svelte';

	const context = getContext();

	const PADDING = 14;
	const EDGE = 2;

	const layout = $derived(context.stateGameDerived.boardLayout());
	const isLandscapeDecor = $derived.by(() => {
		const cs = context.stateLayoutDerived.canvasSizes();
		return cs.width / cs.height >= 1.2;
	});

	let glow = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glow = true),
		boardFrameGlowHide: () => (glow = false),
	});
</script>

{#if isLandscapeDecor}
	<Sprite
		key="board_frame"
		anchor={0.5}
		x={layout.x + layout.width * stateUiTweak.frameX}
		y={layout.y + layout.height * stateUiTweak.frameY}
		width={layout.width * stateUiTweak.frameW}
		height={layout.height * stateUiTweak.frameH}
	/>
{:else}
	<!-- Portrait / almost-square: MISMO board_frame.png con las MISMAS
	     proporciones frameW/H/X/Y del landscape. Están calibradas para que el
	     hueco del PNG (87.65%×76.51%) coincida EXACTO con el grid 6×5
	     (480×400) sin stretch — por eso alinean acá también (portrait no
	     aplica boardStretch). Un fill oscuro detrás por si el hueco muestra
	     el fondo. -->
	<Container x={layout.x} y={layout.y}>
		<Rectangle
			x={-layout.width / 2 - PADDING}
			y={-layout.height / 2 - PADDING}
			width={layout.width + PADDING * 2}
			height={layout.height + PADDING * 2}
			backgroundColor={0x0b0a10}
			alpha={0.92}
		/>
	</Container>
	<Sprite
		key="board_frame"
		anchor={0.5}
		x={layout.x + layout.width * stateUiTweak.frameX}
		y={layout.y + layout.height * stateUiTweak.frameY}
		width={layout.width * stateUiTweak.frameW}
		height={layout.height * stateUiTweak.frameH}
		tint={glow ? 0xffc24d : 0xffffff}
	/>
{/if}
