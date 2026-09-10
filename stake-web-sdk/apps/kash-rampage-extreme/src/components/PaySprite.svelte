<script lang="ts" module>
	// Primer FOTOGRAMA de un spritesheet del board, dibujado en HTML plano para
	// el modal de PAYTABLE.
	//
	// El drop 09-09 borró `l4.png`, `w.png` y `s.png`: el CASH STACK (L4), el
	// bate WILD y la barra SCATTER ya no tienen PNG estático, su ÚNICA
	// representación es el atlas de PIXI. El paytable seguía pidiendo esos tres
	// archivos y devolvían 404 (icono roto). En vez de re-exportar stills que se
	// desincronizarían con el arte, acá se recorta el frame 0 del propio atlas
	// con background-position — mismo pixel que ve el jugador en el board.
	//
	// Los números salen del JSON de TexturePacker que hay al lado de cada
	// imagen (`frame` = rect dentro del atlas, `spriteSourceSize` = offset del
	// recorte dentro del canvas original cuando `trimmed: true`, `sourceSize` =
	// canvas original). Si un clip se re-empaqueta, hay que releer su JSON.
	const SHEETS = {
		// anim_sym_premium.json · Special_Billetes_00000 · atlas 768×512
		premium: { file: 'anim_sym_premium.webp', aw: 768, ah: 512, fx: 0, fy: 0, fw: 256, fh: 256, ox: 0, oy: 0, src: 256 },
		// anim_sym_wild.json · Special_Wild_00000 · atlas 171×1225 (trimmed)
		wild: { file: 'anim_sym_wild.png', aw: 171, ah: 1225, fx: 1, fy: 618, fw: 169, fh: 201, ox: 41, oy: 55, src: 256 },
		// anim_sym_scatter_luz.json · Special_Scatter_LUZ_00000 · atlas 774×774
		scatterLuz: { file: 'anim_sym_scatter_luz.webp', aw: 774, ah: 774, fx: 1, fy: 1, fw: 256, fh: 256, ox: 0, oy: 0, src: 256 },
	} as const;

	export type PaySpriteName = keyof typeof SHEETS;
</script>

<script lang="ts">
	type Props = {
		name: PaySpriteName;
		/** Lado de la caja, en cualquier unidad CSS. Es el canvas COMPLETO del
		 *  clip (256²), así que un frame recortado queda a la misma escala que
		 *  los PNG de los símbolos regulares. */
		size?: string;
		label?: string;
	};

	const props: Props = $props();
	const size = $derived(props.size ?? '2.2rem');
	const s = $derived(SHEETS[props.name]);
	// Ruta RELATIVA al documento, igual que los <img> de los símbolos estáticos
	// del paytable: va en el atributo `style` (no en el <style> del componente)
	// justamente para que resuelva contra la página y no contra el CSS bundle.
	const url = $derived(`assets/sprites/anim/${s.file}`);
	// Todo en calc() sobre `size` para que el sprite escale con el tipo.
	const k = $derived((n: number) => `calc(${size} * ${n} / ${s.src})`);
</script>

<span class="pay-sprite" style="width: {size}; height: {size};" role="img" aria-label={props.label ?? props.name}>
	<span
		class="pay-sprite__frame"
		style="
			left: {k(s.ox)};
			top: {k(s.oy)};
			width: {k(s.fw)};
			height: {k(s.fh)};
			background-image: url({url});
			background-size: {k(s.aw)} {k(s.ah)};
			background-position: calc(-1 * {k(s.fx)}) calc(-1 * {k(s.fy)});
		"
	></span>
</span>

<style lang="scss">
	.pay-sprite {
		position: relative;
		display: inline-block;
		flex: none;
		vertical-align: middle;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
	}

	.pay-sprite__frame {
		position: absolute;
		display: block;
		background-repeat: no-repeat;
	}
</style>
