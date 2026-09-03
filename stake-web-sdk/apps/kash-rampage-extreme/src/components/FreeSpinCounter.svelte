<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	// STUB — wireframe FS counter (under the board).
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { Container, Rectangle, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';

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

	const boardLayout = $derived(context.stateGameDerived.boardLayout());
	const panelW = SYMBOL_SIZE * 2;
	const panelH = SYMBOL_SIZE * 0.8;
	const position = $derived({
		x: boardLayout.x - boardLayout.width * 0.5 - panelW - SYMBOL_SIZE * 0.3,
		// Pedido de dirección: el badge va bien arriba del tope del board para no tapar a Kash.
		y: boardLayout.y - boardLayout.height * 0.5 - SYMBOL_SIZE * 1.75,
	});
</script>

<MainContainer>
	<FadeContainer {show} x={position.x} y={position.y}>
		<Rectangle
			width={panelW}
			height={panelH}
			backgroundColor={0x0d0c0a}
			alpha={0.9}
		/>
		<Rectangle width={panelW} height={2} backgroundColor={0xff7a1a} />
		<Rectangle y={panelH - 2} width={panelW} height={2} backgroundColor={0xff7a1a} />
		<Container x={panelW / 2} y={panelH * 0.32}>
			<Text
				text="FREE SPIN"
				anchor={{ x: 0.5, y: 0.5 }}
				style={{
					fill: 0xff7a1a,
					fontSize: SYMBOL_SIZE * 0.2,
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
					fontSize: SYMBOL_SIZE * 0.32,
					fontWeight: '900',
					letterSpacing: 1,
				}}
			/>
		</Container>
	</FadeContainer>
</MainContainer>
