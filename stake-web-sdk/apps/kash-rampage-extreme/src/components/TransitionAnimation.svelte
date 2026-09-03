<script lang="ts">
	// Transición "SMASH": cubre el cambio de estado con un barrido neón
	// diagonal (lima + pink) sobre un velo oscuro, con un flash de "KASH SMASH"
	// al medio. Reemplaza el rectángulo negro plano.
	// CRITICAL: oncomplete DEBE dispararse, si no cuelga freeSpinTrigger/End.
	import { onMount } from 'svelte';

	import { Container, Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = { oncomplete: () => void };
	const props: Props = $props();
	const context = getContext();

	let p = $state(0); // progreso 0..1 (performance.now → no depende de estado)
	onMount(() => {
		const start = performance.now();
		const dur = 560;
		let raf = 0;
		const tick = () => {
			p = Math.min((performance.now() - start) / dur, 1);
			if (p < 1) raf = requestAnimationFrame(tick);
			else props.oncomplete?.();
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	const sizes = $derived(context.stateLayoutDerived.canvasSizes());
	// Velo: sube rápido (tapa el swap ~0.4) y baja al final revelando lo nuevo.
	const coverAlpha = $derived(p < 0.5 ? Math.min(p / 0.32, 1) : Math.max(1 - (p - 0.5) / 0.5, 0));
	// Barrido en anchos de pantalla (-1.3 → +1.3).
	const sweep = $derived(-1.3 + p * 2.6);
	// Flash central (pico en p=0.5).
	const flash = $derived(Math.max(0, 1 - Math.abs(p - 0.5) / 0.22));
	const ROT = -0.5; // ~-28° diagonal
</script>

<!-- velo oscuro -->
<Rectangle {...sizes} backgroundColor={0x0d0c0a} alpha={coverAlpha} />

<!-- barra LIMA barriendo → -->
<Container x={sizes.width / 2 + sweep * sizes.width} y={sizes.height / 2} rotation={ROT}>
	<Rectangle
		x={-sizes.width * 1.6}
		y={-sizes.height * 0.16}
		width={sizes.width * 3.2}
		height={sizes.height * 0.3}
		backgroundColor={0xf6ef1b}
		alpha={0.92 * coverAlpha}
	/>
</Container>

<!-- barra PINK barriendo ← (opuesta, desfasada) -->
<Container x={sizes.width / 2 - sweep * sizes.width * 0.9} y={sizes.height / 2} rotation={ROT}>
	<Rectangle
		x={-sizes.width * 1.6}
		y={sizes.height * 0.14}
		width={sizes.width * 3.2}
		height={sizes.height * 0.16}
		backgroundColor={0xe02330}
		alpha={0.92 * coverAlpha}
	/>
</Container>

<!-- logo KASH SMASH (en vez de texto) -->
{#if flash > 0.02}
	{@const logoW = Math.min(sizes.width * 0.44, 600) * (0.92 + flash * 0.12)}
	<Sprite
		key="kash_logo"
		anchor={0.5}
		x={sizes.width / 2}
		y={sizes.height / 2}
		width={logoW}
		height={logoW / (1200 / 630)}
		alpha={flash}
	/>
{/if}
