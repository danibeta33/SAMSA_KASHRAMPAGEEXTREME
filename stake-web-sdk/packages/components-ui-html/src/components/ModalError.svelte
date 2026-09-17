<script lang="ts">
	import { Popup } from 'components-shared';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';

	// ⚠ CERO INFO TÉCNICA — requisito de approval, sin excepciones ni gates.
	//
	// Feedback Stake 16-09, punto 1: con `rgs_url=sdasda:85:602` este modal
	// mostraba el stack trace completo en un <pre> scrolleable, y ahí adentro
	// iban el `sessionID` y el `rgs_url` de la sesión. El pedido textual fue
	// "only an appropriate 'Failed to fetch' error message should be displayed,
	// without any unnecessary technical details or code".
	//
	// De dónde salían los query params: el build inlinea el bundle entero en
	// `index.html` (`assetsInlineLimit: Infinity` en config-vite, que es lo que
	// produce el archivo único que espera el ACP). Con el código viviendo en el
	// propio documento, los frames del stack se atribuyen a la URL del
	// documento — que en el iframe del ACP lleva los parámetros.
	//
	// El primer parche escondió el <pre> detrás de `import.meta.env.DEV`. Ese
	// bloque YA NO EXISTE: un gate por entorno sigue siendo un camino de código
	// que imprime internals, y basta un build con mode=development para que
	// vuelva a aparecer en producción. Para depurar está la consola de DEV
	// (`rgs-fetcher` loguea ahí la causa real; en prod el build elimina todos
	// los console.*). Este componente no tiene forma de imprimir un error.
	//
	// ALLOWLIST EXPLÍCITO, no heurístico: solo se muestra lo que alguien marcó
	// como apto para el jugador poniendo `userMessage` en el objeto de error
	// (ver ResumeBet.svelte). Un "¿este message parece seguro?" por regex falla
	// en los dos sentidos — deja pasar un `message` crudo del RGS, y degrada en
	// silencio un texto curado que use dos puntos o llaves.
	const GENERIC = 'Failed to fetch. Please reload the game to keep playing.';

	const userMessage = (error: unknown): string => {
		const candidate = (error as { userMessage?: unknown } | null | undefined)?.userMessage;
		return typeof candidate === 'string' && candidate.trim() ? candidate : GENERIC;
	};
</script>

{#if stateModal.modal?.name === 'error'}
	<Popup zIndex={180} persistent onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			{@const error = stateModal.modal?.error}
			<div class="kash-error">
				<h2 class="kash-error__title">SOMETHING WENT WRONG</h2>
				<p class="kash-error__hint">{userMessage(error)}</p>
			</div>
		</BaseContent>
	</Popup>
{/if}

<style lang="scss">
	.kash-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: min(92vw, 460px);
		padding: 30px 28px 24px;
		background: #0d0c0a;
		border: 2px solid var(--kash-lime);
		border-radius: 14px;
		box-shadow: 0 0 34px var(--kash-line);
		font-family: 'Neue Plak Extended', 'Europa', system-ui, sans-serif;
		box-sizing: border-box;
	}

	.kash-error__title {
		margin: 0;
		color: #ec4899;
		font-size: 20px;
		font-weight: 900;
		letter-spacing: 4px;
		text-align: center;
	}

	.kash-error__hint {
		margin: 0;
		color: #fff;
		opacity: 0.9;
		font-size: 13px;
		text-align: center;
	}
</style>
