<script lang="ts">
	// STUB — wireframe Rectangle fallback. Fires listener.complete on mount so
	// any subscriber awaiting it does not hang.
	import { onMount } from 'svelte';

	import { Container, Rectangle, Text } from 'pixi-svelte';

	import { SYMBOL_SIZE } from '../game/constants';
	import type { getSymbolInfo } from '../game/utils';

	type Props = {
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		x?: number;
		y?: number;
		listener?: {
			complete?: () => void;
			event?: (entry: unknown, event: { data?: { name?: string } }) => void;
		};
		loop?: boolean;
	};

	const props: Props = $props();

	onMount(() => {
		if (props.loop) return;
		const t = setTimeout(() => props.listener?.complete?.(), 150);
		return () => clearTimeout(t);
	});

	const w = $derived(SYMBOL_SIZE * (props.symbolInfo?.sizeRatios?.width ?? 0.92));
	const h = $derived(SYMBOL_SIZE * (props.symbolInfo?.sizeRatios?.height ?? 0.92));
</script>

<Container x={props.x} y={props.y}>
	<Rectangle
		x={-w / 2}
		y={-h / 2}
		width={w}
		height={h}
		backgroundColor={0xe02330}
		alpha={0.25}
	/>
	<Text
		text="?"
		anchor={{ x: 0.5, y: 0.5 }}
		style={{ fill: 0xe02330, fontSize: SYMBOL_SIZE * 0.32, fontWeight: '900' }}
	/>
</Container>
