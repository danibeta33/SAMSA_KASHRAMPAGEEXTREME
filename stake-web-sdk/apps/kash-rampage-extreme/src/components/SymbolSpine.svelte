<script lang="ts">
	// STUB — wireframe template uses type:'sprite' everywhere, so this branch
	// is currently unreachable. Forks that re-enable Spine symbols import this
	// file, so we keep it as a Rectangle fallback that still fires `oncomplete`.
	import SymbolSpineMain from './SymbolSpineMain.svelte';
	import type { getSymbolInfo } from '../game/utils';

	type Props = {
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		x?: number;
		y?: number;
		// Mismo shape que el listener de Spine (pixi-spine): `event` dispara
		// los custom events del timeline (p.ej. 'wildExplode' → SFX).
		listener?: {
			complete?: () => void;
			event?: (entry: unknown, event: { data?: { name?: string } }) => void;
		};
		loop?: boolean;
	};

	const props: Props = $props();
</script>

<SymbolSpineMain
	x={props.x}
	y={props.y}
	symbolInfo={props.symbolInfo}
	listener={props.listener}
	loop={props.loop}
/>
