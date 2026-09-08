<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import Game from '../components/Game.svelte';
	import GameLoader from '../components/GameLoader.svelte';
	import BottomBar from '../components/BottomBar.svelte';
	import LoadingOverlay from '../components/LoadingOverlay.svelte';
	import BuyBonusOverlay from '../components/BuyBonusOverlay.svelte';
	import BuyConfirmOverlay from '../components/BuyConfirmOverlay.svelte';
	import AutoSpinOverlay from '../components/AutoSpinOverlay.svelte';
	import SettingsOverlay from '../components/SettingsOverlay.svelte';
	import MenuOverlay from '../components/MenuOverlay.svelte';
	import BetMenuOverlay from '../components/BetMenuOverlay.svelte';
	import ReplayOverlay from '../components/ReplayOverlay.svelte';
	// Laboratorios genéricos del SDK — el catálogo lo inyecta el juego más
	// abajo (registerGameInspector / registerGameLabActions).
	import { UiLab, AnimLab } from 'components-inspector';
	import { stateModal, stateUi, stateUrlDerived, stateI18n } from 'state-shared';
	import { page } from '$app/state';

	import { setContext, getContext } from '../game/context';
	import { registerGameInspector } from '../game/labInspector.svelte';
	import { registerGameLabActions } from '../game/labActions.svelte';
	import { loadBrandFonts } from '../game/fonts';
	import { enableSocialText } from '../game/social';
	import { preloadHtmlAssets } from '../game/htmlAssets.svelte';
	import { compileMessagePlain } from '../game/i18nCompiler';

	// Lingui no instala compilador de mensajes en prod → "Uncompiled message
	// detected!" al traducir (visible al disparar las notifs de límite del
	// autoplay). Se instala uno mínimo para texto plano SOLO en prod (en dev
	// Lingui ya trae el suyo). Aislado a esta app — no toca los otros juegos.
	if (import.meta.env.PROD) {
		// cast: nuestro compiler devuelve el mismo shape (Token[]) que el de
		// @lingui/message-utils, cuyo tipo exacto no es importable acá.
		stateI18n.i18n.setMessagesCompiler(compileMessagePlain as Parameters<typeof stateI18n.i18n.setMessagesCompiler>[0]);
	}

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	// Guideline nuevo del ACP (jul-2026): "Game should not contain the Stake
	// Engine Loader" — el splash LoaderStakeEngine del SDK se eliminó; el
	// juego arranca directo con el loader brandeado (GameLoader).
	const loaderUrl = new URL('../../loader.gif', import.meta.url).href;

	// QoL de DEV: entrar a localhost:3001 "pelado" (sin rgs_url) moría con
	// SOMETHING WENT WRONG al intentar autenticar contra el RGS real. En dev,
	// sin parámetros → redirige solo al mock local (mock_rgs.py en :3030).
	// OJO: mientras redirige NO se monta el app (gate en el template) — si se
	// montara, Authenticate alcanza a disparar el fetch con rgs_url vacío
	// (https://wallet/…) y el ModalError gana la carrera a la navegación.
	// En prod el ACP siempre inyecta los parámetros — esto no aplica.
	// /sizes es una página DEV standalone (selector de tamaños de Stake con el
	// juego en iframe) — no monta el app ni participa del redirect al mock.
	const isSizesPage = $derived(page.url.pathname.startsWith('/sizes'));

	const redirectingToMock =
		import.meta.env.DEV &&
		typeof window !== 'undefined' &&
		!window.location.pathname.startsWith('/sizes') &&
		!new URLSearchParams(window.location.search).has('rgs_url');
	if (redirectingToMock) {
		window.location.replace('?sessionID=mock&rgs_url=http://127.0.0.1:3032');
	}

	setContext();

	// INYECCIÓN DE LOS LABORATORIOS (solo DEV): el juego registra sus
	// categorías, sliders, toggles, acciones y diagnóstico en los registros
	// genéricos de `components-inspector`. UiLab, AnimLab y /sizes leen de
	// ahí — ninguno importa nada del juego.
	// `getContext()` es válido acá: `setContext()` acaba de correr en esta
	// misma inicialización de componente.
	if (import.meta.env.DEV) {
		registerGameInspector();
		registerGameLabActions(getContext());
	}

	// Registra las Neue Plak en document.fonts y apunta el default de Pixi al
	// brand font. Fire-and-forget: no-op en SSR, resuelve en ms en cliente.
	void loadBrandFonts();

	// Social mode (stake.us): term-swaps sobre todo el texto HTML del juego
	// (ver game/social.ts). onMount = solo cliente, con el DOM ya montado.
	onMount(() => {
		if (stateUrlDerived.social()) enableSocialText();
		// Imágenes HTML del HUD/overlays al cache durante el loading — sin esto
		// las cards del buy menu "aparecían" tarde en la primera apertura.
		void preloadHtmlAssets();
	});

	// (Se removió la telemetría DEV que posteaba a http://127.0.0.1:9911/err:
	// ese sink no corre y en Firefox el fetch fallido cross-origin se
	// propagaba como "NetworkError" al ModalError. Para debug usar la consola.)

	// ESC cierra el menú abierto. En la confirmación de compra equivale a su
	// CANCEL (vuelve al menú de bonus); en el resto cierra directo.
	const onEscape = (e: KeyboardEvent) => {
		if (e.key !== 'Escape') return;
		if (stateUi.menuOpen) stateUi.menuOpen = false;
		const name = stateModal.modal?.name;
		if (!name) return;
		stateModal.modal = name === 'buyBonusConfirmKash' ? { name: 'buyBonusKash' } : null;
	};
</script>

<svelte:window onkeydown={onEscape} />

<svelte:head>
	<link rel="stylesheet" href="assets/fonts/neue-plak/neue-plak.css" />
</svelte:head>

{#if isSizesPage}
	{@render props.children()}
{:else if redirectingToMock}
	<!-- pantalla negra de un instante mientras location.replace navega al mock -->
	<div style="position: fixed; inset: 0; background: #000;"></div>
{:else}
<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<!-- Loader brandeado: wild girando (static/loader.gif) + LOADING lima. -->
<GameLoader src={loaderUrl} />

{@render props.children()}

<!-- (TopBar eliminado 08-09: el HUD superior es ahora TopHud.svelte, dentro del
     canvas Pixi y montado desde Game.svelte.) -->
<BottomBar />
<ReplayOverlay />
<LoadingOverlay />
<BuyBonusOverlay />
<BuyConfirmOverlay />
<AutoSpinOverlay />
<SettingsOverlay />
<MenuOverlay />
<BetMenuOverlay />

{#if import.meta.env.DEV}
	<UiLab />
	<AnimLab />
{/if}
{/if}
<style>
	/* ── Tema KRE (kit 25-08): re-declaración de las vars --kash-* del
	   global.scss del package components-ui-html (compartido con KS1 LIVE —
	   NO tocar el package; el override vive acá, solo en esta app). ── */
	:global(:root) {
		--kash-lime: #f6ef1b;
		--kash-pink: #e02330;
		--kash-teal: #ff7a1a;
		--kash-textmuted: #b9a97a;
		--kash-line: rgba(246, 239, 27, 0.25);
		--kash-glow: 0 0 12px rgba(246, 239, 27, 0.35), 0 0 24px rgba(224, 35, 48, 0.18);
		--kash-pink-glow: 0 4px 18px rgba(224, 35, 48, 0.35);
	}
	/* Hardcodeados rosa del shell de modals del package (PAYTABLE/RULES) */
	:global(.kash-doc__title) {
		color: #e02330 !important;
	}
	:global(.kash-doc__body td),
	:global(.kash-doc__body th) {
		border-color: rgba(224, 35, 48, 0.4) !important;
	}
</style>
