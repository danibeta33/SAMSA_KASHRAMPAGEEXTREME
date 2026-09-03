<script lang="ts">
	import { stateUi } from 'state-shared';
	import { BLACK } from 'constants-shared/colors';
	import { MainContainer } from 'components-layout';
	import { Container, Rectangle, anchorToPivot } from 'pixi-svelte';

	import { DESKTOP_BASE_SIZE, DESKTOP_BACKGROUND_WIDTH_LIST } from '../constants';
	import { getContext } from '../context';
	import type { LayoutUiProps } from '../types';

	const props: LayoutUiProps = $props();
	const context = getContext();
</script>

<Container x={20}>
	{@render props.gameName()}
</Container>

<Container x={context.stateLayoutDerived.canvasSizes().width - 20}>
	{@render props.logo()}
</Container>

<MainContainer standard alignVertical="bottom">
	<Container
		x={context.stateLayoutDerived.mainLayoutStandard().width * 0.5}
		y={context.stateLayoutDerived.mainLayoutStandard().height - DESKTOP_BASE_SIZE - 10}
		pivot={anchorToPivot({
			anchor: { x: 0.5, y: 0 },
			sizes: {
				height: DESKTOP_BASE_SIZE,
				width: DESKTOP_BACKGROUND_WIDTH_LIST.reduce((sum, width) => sum + width, 0),
			},
		})}
	>
		<!--
			Buttons are spaced so they never touch (gap ≥ 28px between any pair).
			After scale 0.8:
			  round button width = 108  (half 54)
			  pill button width  = 192  (half 96)
			Required center-to-center distance to leave 28px gap:
			  round↔round = 108 + 28 = 136
			  round↔pill  = 150 + 28 = 178
			Pills above are recentred over their respective button group.
		-->
		<Container y={DESKTOP_BASE_SIZE * 0.5 - 160} x={290} scale={0.8}>
			{@render props.amountBalance({ stacked: true })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5 - 160} x={900} scale={0.8}>
			{@render props.amountWin({ stacked: true })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5 - 160} x={1500} scale={0.8}>
			{@render props.amountBet({ stacked: true })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={60} scale={0.8}>
			{@render props.buttonSoundSwitch({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={200} scale={0.8}>
			{@render props.buttonMenu({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={380} scale={0.8}>
			{@render props.buttonBuyBonus({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={720} scale={0.8}>
			{@render props.buttonAutoSpin({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={900} scale={0.8}>
			{@render props.buttonBet({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={1080} scale={0.8}>
			{@render props.buttonTurbo({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={1430} scale={0.8}>
			{@render props.buttonDecrease({ anchor: 0.5 })}
		</Container>

		<Container y={DESKTOP_BASE_SIZE * 0.5} x={1570} scale={0.8}>
			{@render props.buttonIncrease({ anchor: 0.5 })}
		</Container>
	</Container>
</MainContainer>

{#if stateUi.menuOpen}
	<Rectangle
		eventMode="static"
		cursor="pointer"
		alpha={0.5}
		anchor={0.5}
		backgroundColor={BLACK}
		width={context.stateLayoutDerived.canvasSizes().width}
		height={context.stateLayoutDerived.canvasSizes().height}
		x={context.stateLayoutDerived.canvasSizes().width * 0.5}
		y={context.stateLayoutDerived.canvasSizes().height * 0.5}
		onpointerup={() => (stateUi.menuOpen = false)}
	/>

	<MainContainer standard alignVertical="bottom">
		<Container
			x={298}
			y={context.stateLayoutDerived.mainLayoutStandard().height - DESKTOP_BASE_SIZE - 10}
		>
			<Container scale={0.8} y={DESKTOP_BASE_SIZE * 0.5 - 150 - 170 * 3}>
				{@render props.buttonPayTable({ anchor: 0.5 })}
			</Container>

			<Container scale={0.8} y={DESKTOP_BASE_SIZE * 0.5 - 150 - 170 * 2}>
				{@render props.buttonGameRules({ anchor: 0.5 })}
			</Container>

			<Container scale={0.8} y={DESKTOP_BASE_SIZE * 0.5 - 150 - 170 * 1}>
				{@render props.buttonSettings({ anchor: 0.5 })}
			</Container>

			<Container scale={0.8} y={DESKTOP_BASE_SIZE * 0.5 - 150}>
				{@render props.buttonSoundSwitch({ anchor: 0.5 })}
			</Container>

			<Container scale={0.8} y={DESKTOP_BASE_SIZE * 0.5}>
				{@render props.buttonMenuClose({ anchor: 0.5 })}
			</Container>
		</Container>
	</MainContainer>
{/if}
