<script lang="ts" module>
	export type EmitterEventTumbleWinAmount =
		| { type: 'tumbleWinAmountShow' }
		| { type: 'tumbleWinAmountHide' }
		| { type: 'tumbleWinAmountReset' }
		| { type: 'tumbleWinAmountUpdate'; amount: number; animate: boolean };
</script>

<script lang="ts">
	// STUB — wireframe tumble-win panel above the board.
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { moneyWinFromBookAmount } from '../game/money';

	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import BoardContainer from './BoardContainer.svelte';

	const context = getContext();

	let show = $state(false);
	let amount = $state(0);

	context.eventEmitter.subscribeOnMount({
		tumbleWinAmountShow: () => (show = true),
		tumbleWinAmountHide: () => (show = false),
		tumbleWinAmountReset: () => {
			amount = 0;
		},
		tumbleWinAmountUpdate: async (emitterEvent) => {
			amount = emitterEvent.amount;
		},
	});

	const layout = $derived(context.stateGameDerived.boardLayout());
	const panelW = SYMBOL_SIZE * 3.2;
	const panelH = SYMBOL_SIZE * 0.6;
</script>

<FadeContainer {show}>
	<BoardContainer>
		<Container x={layout.width / 2} y={-panelH * 0.9}>
			<Rectangle
				x={-panelW / 2}
				y={-panelH / 2}
				width={panelW}
				height={panelH}
				backgroundColor={0x0d0c0a}
				alpha={0.85}
			/>
			<Rectangle
				x={-panelW / 2}
				y={-panelH / 2}
				width={panelW}
				height={2}
				backgroundColor={0xf6ef1b}
			/>
			<Rectangle
				x={-panelW / 2}
				y={panelH / 2 - 2}
				width={panelW}
				height={2}
				backgroundColor={0xf6ef1b}
			/>
			<Text
				text={`TUMBLE WIN ${moneyWinFromBookAmount(amount)}`}
				anchor={{ x: 0.5, y: 0.5 }}
				style={{
					fill: 0xf6ef1b,
					fontSize: SYMBOL_SIZE * 0.28,
					fontWeight: '900',
					letterSpacing: 2,
				}}
			/>
		</Container>
	</BoardContainer>
</FadeContainer>
