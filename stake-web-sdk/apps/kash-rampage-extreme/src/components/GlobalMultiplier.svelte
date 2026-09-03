<script lang="ts" module>
	export type EmitterEventGlobalMultiplier =
		| { type: 'globalMultiplierShow' }
		| { type: 'globalMultiplierHide' }
		| { type: 'globalMultiplierUpdate'; multiplier: number };
</script>

<script lang="ts">
	// STUB — wireframe global multiplier badge (top-right of board).
	// `globalMultiplierUpdate` must resolve, otherwise the FS trigger sequence hangs.
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';

	const context = getContext();

	let show = $state(false);
	let multiplier = $state(1);

	context.eventEmitter.subscribeOnMount({
		globalMultiplierShow: () => (show = true),
		globalMultiplierHide: () => (show = false),
		globalMultiplierUpdate: async (emitterEvent) => {
			multiplier = emitterEvent.multiplier;
			await new Promise((r) => setTimeout(r, 200));
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	const badgeW = SYMBOL_SIZE * 0.95;
	const badgeH = SYMBOL_SIZE * 0.7;

	// Lime palette — pairs with the pink PersistentMultiplier badge on the
	// left of the board so the two FS-only HUD pieces don't read as the same
	// thing. Global mult = per-spin tumble multiplier (resets each spin).
	const COLOR_LIME = 0xf6ef1b;
</script>

<!-- Only render when multiplier > 1: a tumble-mult badge at ×1 carries no info
     (KRE: el meter se eliminó; el contraste ahora es contra el FreeSpinCounter.) -->
<FadeContainer show={show && multiplier > 1}>
	<BoardContainer>
		<Container x={layout.width - badgeW * 0.6} y={-badgeH * 0.6}>
			<Rectangle
				x={-badgeW / 2}
				y={-badgeH / 2}
				width={badgeW}
				height={badgeH}
				backgroundColor={0x0d0c0a}
				alpha={0.92}
			/>
			<Rectangle
				x={-badgeW / 2}
				y={-badgeH / 2}
				width={badgeW}
				height={2}
				backgroundColor={COLOR_LIME}
			/>
			<Rectangle
				x={-badgeW / 2}
				y={badgeH / 2 - 2}
				width={badgeW}
				height={2}
				backgroundColor={COLOR_LIME}
			/>
			<Text
				text={`x${multiplier}`}
				anchor={{ x: 0.5, y: 0.5 }}
				style={{
					fill: COLOR_LIME,
					fontSize: SYMBOL_SIZE * 0.4,
					fontWeight: '900',
					letterSpacing: 1,
				}}
			/>
		</Container>
	</BoardContainer>
</FadeContainer>
