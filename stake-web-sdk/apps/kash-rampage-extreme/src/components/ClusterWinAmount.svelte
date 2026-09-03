<script lang="ts" module>
	export type RawWin = {
		win: number;
		mult: number;
		result: number;
		reel: number;
		row: number;
	};
	export type Win = RawWin & { oncomplete: () => void };
</script>

<script lang="ts">
	// STUB — wireframe cluster-win label above a winning cluster.
	// Resolves win.oncomplete after a short readable delay.
	import { onMount } from 'svelte';

	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { moneyWinFromBookAmount } from '../game/money';

	import { SYMBOL_SIZE } from '../game/constants';

	type Props = { win: Win; labelX?: number; labelY?: number };

	const props: Props = $props();

	let show = $state(true);

	onMount(() => {
		const t = setTimeout(() => {
			show = false;
		}, 800);
		return () => clearTimeout(t);
	});

	const labelW = SYMBOL_SIZE * 1.4;
	const labelH = SYMBOL_SIZE * 0.4;
</script>

<FadeContainer
	{show}
	oncomplete={() => {
		if (!show) props.win.oncomplete();
	}}
>
	<Container
		x={SYMBOL_SIZE * (props.labelX ?? props.win.reel + 0.5)}
		y={SYMBOL_SIZE * (props.labelY ?? props.win.row - 0.5)}
	>
		<Rectangle
			x={-labelW / 2}
			y={-labelH / 2}
			width={labelW}
			height={labelH}
			backgroundColor={0x0d0c0a}
			alpha={0.9}
		/>
		<Rectangle
			x={-labelW / 2}
			y={-labelH / 2}
			width={labelW}
			height={2}
			backgroundColor={0xf6ef1b}
		/>
		<Rectangle
			x={-labelW / 2}
			y={labelH / 2 - 2}
			width={labelW}
			height={2}
			backgroundColor={0xf6ef1b}
		/>
		<Text
			text={props.win.mult > 1
				? `${moneyWinFromBookAmount(props.win.win)} x${props.win.mult}`
				: moneyWinFromBookAmount(props.win.result)}
			anchor={{ x: 0.5, y: 0.5 }}
			style={{
				fill: 0xf6ef1b,
				fontSize: SYMBOL_SIZE * 0.22,
				fontWeight: '900',
				letterSpacing: 1,
			}}
		/>
	</Container>
</FadeContainer>
