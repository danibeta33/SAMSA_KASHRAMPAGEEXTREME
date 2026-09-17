<script lang="ts">
	// PANTALLA DE ERROR FATAL — feedback Stake 16-09, punto 1.
	//
	// "When the rgs_url is invalid or changed to an incorrect value, the game
	//  should not be playable and only an appropriate 'Failed to fetch' error
	//  message should be displayed, without any unnecessary technical details
	//  or code."
	//
	// Por qué es una pantalla y no el modal de error del juego:
	//
	// 1. "not playable": el modal vivía DENTRO de `<Game />` (Modals.svelte),
	//    o sea que para mostrarlo había que montar el juego entero detrás.
	//    Esta pantalla se monta en lugar del juego, no encima.
	// 2. En KRE la pantalla de carga tiene z-index 200 y el modal 180: con un
	//    `rgs_url` inválido el jugador veía LOADING → "CLICK TO SKIP" (como si
	//    todo estuviera bien) y recién después el error. Acá no hay carrera de
	//    capas posible: es lo único montado.
	//
	// NO recibe ni muestra el objeto de error. No hay prop para pasarlo. Es
	// deliberado: ningún cambio futuro puede volver a filtrar un stack trace
	// por esta vía.
</script>

<div class="fatal" role="alert" aria-live="assertive">
	<div class="fatal__box">
		<h1 class="fatal__title">SOMETHING WENT WRONG</h1>
		<p class="fatal__message">Failed to fetch.</p>
		<p class="fatal__hint">Please reload the game to keep playing.</p>
	</div>
</div>

<style lang="scss">
	.fatal {
		position: fixed;
		inset: 0;
		/* Por encima de TODO lo del juego (la pantalla de carga de KRE está en
		   200, los modals en 180/190). Aunque algo se montara por error, esto
		   queda arriba. */
		z-index: 2147483647;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
		background: #0d0c0a;
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
	}

	.fatal__box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		width: min(92vw, 460px);
		padding: 30px 28px 26px;
		box-sizing: border-box;
		background: #0d0c0a;
		border: 2px solid var(--kash-lime, #f6ef1b);
		border-radius: 14px;
		box-shadow: 0 0 34px var(--kash-line, rgba(246, 239, 27, 0.25));
	}

	.fatal__title {
		margin: 0;
		color: var(--kash-pink, #e02330);
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 4px;
		text-align: center;
	}

	.fatal__message {
		margin: 0;
		color: #fff;
		font-size: 15px;
		font-weight: 700;
		text-align: center;
	}

	.fatal__hint {
		margin: 0;
		color: #fff;
		opacity: 0.75;
		font-size: 13px;
		text-align: center;
	}
</style>
