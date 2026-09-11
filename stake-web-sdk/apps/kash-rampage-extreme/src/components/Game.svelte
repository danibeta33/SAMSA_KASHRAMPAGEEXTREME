<script lang="ts">
	import { onMount } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App, Container } from 'pixi-svelte';
	import { stateModal } from 'state-shared';

	import { stateTweak } from '../game/stateTweak.svelte';
	import { boardTransform } from '../game/hudLayout';
	import { boardShake } from '../game/boardShake.svelte';

	import { GameVersion, Modals } from 'components-ui-html';
	import { stateMeta, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import PaySprite from './PaySprite.svelte';

	// TECHO del espacio de capas del canvas. Las celebraciones y la transición
	// no se tweakean: son lo último que se lee en pantalla. Vive acá y no en
	// `stateTweak` porque no es un valor de ajuste sino el borde del rango que
	// documentan los sliders de capa (ver `LAYER` en labMeta.ts).
	const CELEBRATION_LAYER = 20;

	// Override the shared bet-mode metadata so the BuyBonus modal lists ONLY
	// the four modes the math actually supports: base + 3 buys
	// (100×, 250×, 500×). The SDK default (state-shared/constants.ts)
	// hardcodes 5 sample modes which would otherwise show up in the UI.
	// Keys are uppercase; state-shared looks them up case-insensitively,
	// mock RGS lowercases before matching the math's bet_modes
	// (vault_crack, smash_mode, rage_mode — IDs internos heredados de KS1
	// a propósito, ver plan KRE).
	//
	// TODO-KRE (Fase 2): títulos display, dialogs y tickers son los de KS1
	// (placeholder — describen la mecánica vieja, que es la que corre hasta
	// que la Fase 1 traiga los books con KASH RAMPAGE). Reescribir junto con
	// las rules cuando el GDD cierre el copy.
	const NO_ASSETS = { icon: '', dialogImage: '', dialogVolatility: '', volatility: '', button: '' };
	stateMeta.betModeMeta = {
		BASE: {
			mode: 'BASE',
			costMultiplier: 1.0,
			type: 'default',
			parent: '',
			children: '',
			assets: NO_ASSETS,
			text: {
				title: 'BASE',
				dialog: 'Classic cluster pays with tumble.',
				button: '',
				betAmountLabel: '',
				tickerIdle: '',
				tickerSpin: '',
				bannerText: '',
			},
		},
		VAULT_CRACK: {
			mode: 'VAULT_CRACK',
			costMultiplier: 100,
			type: 'buy',
			parent: '',
			children: '',
			assets: NO_ASSETS,
			text: {
				title: 'VAULT CRACK',
				dialog:
					'10 Free Spins. KASH RAMPAGE strikes about 1 in 6.6 spins.',
				description: 'The measured way in.',
				button: 'BUY',
				betAmountLabel: '',
				tickerIdle: 'GETTING READY',
				tickerSpin: 'VAULT CRACK ACTIVE',
				bannerText: '',
			},
		},
		SMASH_MODE: {
			mode: 'SMASH_MODE',
			costMultiplier: 250,
			type: 'buy',
			parent: '',
			children: '',
			assets: NO_ASSETS,
			text: {
				title: 'SMASH MODE',
				dialog:
					'10 Free Spins. KASH RAMPAGE strikes about 1 in 4.1 spins.',
				description: 'More rampages, more chaos.',
				button: 'BUY',
				betAmountLabel: '',
				tickerIdle: 'GETTING READY',
				tickerSpin: 'SMASH MODE ACTIVE',
				bannerText: '',
			},
		},
		RAGE_MODE: {
			mode: 'RAGE_MODE',
			costMultiplier: 500,
			type: 'buy',
			parent: '',
			children: '',
			assets: NO_ASSETS,
			text: {
				title: 'RAGE MODE',
				dialog:
					'10 Free Spins. KASH RAMPAGE strikes about 1 in 2.2 spins.',
				description: 'Most rampages per spin. Total demolition.',
				button: 'BUY',
				betAmountLabel: '',
				tickerIdle: 'GETTING READY',
				tickerSpin: 'RAGE MODE ACTIVE',
				bannerText: '',
			},
		},
	};
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import TopHud from './TopHud.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import MultiplierGrid from './MultiplierGrid.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import ClusterWinAmounts from './ClusterWinAmounts.svelte';
	import TumbleBoard from './TumbleBoard.svelte';
	import GlobalMultiplier from './GlobalMultiplier.svelte';
	import FreeSpinCounter from './FreeSpinCounter.svelte';
	import Win from './Win.svelte';
	import FreeSpinIntro from './FreeSpinIntro.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';

	const context = getContext();

	onMount(() => (context.stateLayout.showLoadingScreen = true));

	context.eventEmitter.subscribeOnMount({
		buyBonusConfirm: () => {
			stateModal.modal = { name: 'buyBonusConfirmKash' };
		},
	});

	// Guard: los modals genéricos del SDK (ModalBuyBonus / ModalBuyBonusConfirm /
	// ModalSettings) quedaron reemplazados por overlays custom, pero rutas
	// internas del SDK aún pueden setear sus names (p.ej. el cancel del confirm
	// viejo volvía a 'buyBonus'). Cualquier intento se redirige al equivalente
	// brandeado — los originales son inalcanzables.
	$effect(() => {
		const name = stateModal.modal?.name;
		if (name === 'buyBonus') stateModal.modal = { name: 'buyBonusKash' };
		else if (name === 'buyBonusConfirm') stateModal.modal = { name: 'buyBonusConfirmKash' };
		else if (name === 'settings') stateModal.modal = { name: 'settingsKash' };
		else if (name === 'betAmountMenu') stateModal.modal = { name: 'betMenuKash' };
	});
</script>

<App>
	<EnableSound />
	<EnableHotkey />
	<EnableGameActor />
	<EnablePixiExtension />

	<Background />

	<!-- Mientras showLoadingScreen=true el canvas queda solo con el Background
	     — el LoadingOverlay HTML (routes/+layout) tapa todo. Al click, el
	     overlay monta el juego al instante y hace su fade por encima. -->
	{#if context.stateLayout.showLoadingScreen}
		<!-- canvas idle detrás del overlay HTML -->
	{:else}
		<ResumeBet />
		<!--
			The reason why <Sound /> is rendered after clicking the loading screen:
			"Autoplay with sound is allowed if: The user has interacted with the domain (click, tap, etc.)."
			Ref: https://developer.chrome.com/blog/autoplay
		-->
		<Sound />

		<!-- Grid grouped con el Frame: X/Y/size del board manejan ambos juntos.
		     El scale del grid = boardBaseScale * boardStretchX/Y — así el grid
		     crece proporcionalmente con el frame (mismo boardH) y además puede
		     tener spacing horizontal/vertical extra vs el frame vector.
		     Pivot en el centro del canvas → crece simétrico en las 4 esquinas. -->
		{@const cs = context.stateLayoutDerived.canvasSizes()}
		<!-- Transform del board via hudLayout.boardTransform: además de la
		     escala de diseño aplica CAPS anti-solape (reporte del ACP: en
		     ventanas más altas que el viewport de diseño el frame se metía
		     bajo el stack BET/SPIN, y el grid bajo el TopBar). Portrait:
		     board centrado con topes contra TopBar+iconos y contra el stack
		     centrado de abajo. -->
		{@const bt = boardTransform(cs.width, cs.height, context.stateLayoutDerived.mainLayout().scale)}
		<!-- ESPACIO DE CAPAS DEL CANVAS (drop 09-09) — Kash, grilla, HUD superior
		     y título son HERMANOS en el stage de PixiJS, cada uno con su propio
		     `zIndex` tweakeable, así que se interpolan libremente entre ellos
		     (poner Kash en la capa 6 y la botonera en la 5 es exactamente esto).
		     NO se los envuelve en un contenedor común a propósito: un wrapper
		     los volvería un solo nodo y ninguno podría meterse entre los otros.
		     El stage ya va con `sortableChildren` — lo prende Background.svelte,
		     que es también quien clava el fondo en −5. Sin eso el `zIndex`
		     reactivo sería letra muerta: `createContextParent` solo llama
		     `sortChildren()` AL MONTAR cada hijo, así que arrastrar un slider no
		     reordenaría nada.
		     Con los defaults (Kash −4 · grilla 0 · HUD 1 · título 2 · overlays
		     20) el apilado queda EXACTAMENTE como antes de este drop, cuando lo
		     decidía el orden de montaje. -->
		<!-- KRE: sin SMASH Meter (el persistent mult se eliminó). El countdown
		     de free spins lo muestra FreeSpinCounter, montado dentro del
		     wrapper del board (abajo). -->
		<Container
			alpha={stateTweak.boardAlpha}
			zIndex={stateTweak.boardZ}
			x={cs.width * bt.bx + boardShake.x}
			y={cs.height * bt.by + boardShake.y}
			scale={{
				x: bt.s * (bt.landscapeDecor ? stateTweak.boardStretchX : 1),
				y: bt.s * (bt.landscapeDecor ? stateTweak.boardStretchY : 1),
			}}
			pivot={{ x: cs.width * 0.5, y: cs.height * 0.5 }}
		>
			<MainContainer>
				<BoardFrame />
			</MainContainer>

			<MainContainer>
				<MultiplierGrid />
			</MainContainer>

			<MainContainer>
				<Board />
				<Anticipations />
				<GlobalMultiplier />
			</MainContainer>

			<MainContainer>
				<TumbleBoard />
				<ClusterWinAmounts />
			</MainContainer>
		</Container>

		<!-- HUD superior (08-09): título + los 3 recipientes, EN EL CANVAS. Va
		     fuera del <Container> del board a propósito — ese aplica
		     boardTransform y arrastraría al HUD con la escala del board. Acá
		     queda en coordenadas de canvas y los sliders del UI LAB lo mueven
		     libre. Al estar dentro de este {:else}, no existe mientras el
		     loading screen está al frente (era el `topbar--hidden` de TopBar).
		     Su alpha/capa se aplican ADENTRO, en TopHud.svelte: el grupo de
		     recipientes y el título son dos elementos distintos del laboratorio
		     y cada uno lleva su propio par. -->
		<TopHud />

		<!-- Contador de FREE SPINS (drop 09-09 · Paso 8). Estaba DENTRO del
		     wrapper del board, así que heredaba `boardTransform` y se movía y
		     escalaba con la grilla — en los tamaños grandes se salía de pantalla.
		     Ahora es un elemento suelto en coordenadas de canvas, igual que el
		     HUD superior y el título, con sus propios X/Y/tamaño/opacidad/capa en
		     el UI LAB. -->
		<FreeSpinCounter />

		<!-- La UI Pixi del SDK (bottom HUD default) sigue desmontada: abajo el
		     HUD es el overlay HTML BottomBar.svelte (SPIN/STOP, TURBO, AUTO,
		     BET ±, iconos, BONUS) con los assets del pack "Asset 2@4x". Los
		     broadcasts uiShow/uiHide del bookEventHandlerMap los consume
		     BottomBar.
		     Las celebraciones son el TECHO del espacio de capas: son lo último
		     que se lee y no se tweakean. El 20 le deja aire al swing de Kash,
		     que pasa por delante del board en 15 (ver Background.svelte). -->
		<Container zIndex={CELEBRATION_LAYER}>
			<Win />
			<FreeSpinIntro />
			<FreeSpinOutro />
			<Transition />
		</Container>
	{/if}
</App>

<Modals>
	{#snippet version()}
		<GameVersion version="1.0.0" />
	{/snippet}

	<!-- TODO-KRE (Fase 2): TODO el contenido de gameRules y payTable es el de
	     KS1 (placeholder coherente con los books forkeados). Reescribir ES+EN
	     para KRE: fuera SMASH Meter y Kash Smash, entra KASH RAMPAGE — y
	     SOCIAL-SAFE de nacimiento (modos por título explícito, nunca
	     "any play mode"; ver dead-heat/02 §F y el playbook). -->
	{#snippet gameRules()}
		<!--
			Modal body renders in two languages: 'es' shows the Spanish source,
			everything else falls back to English (Stake Engine target locale).
			Switch driven by URL param ?lang=es / ?lang=en via stateUrlDerived.
		-->
		{#if stateUrlDerived.lang() === 'es'}
			<div class="lb-doc">
				<section class="lb-disclaimer">
					<h2>Aviso legal</h2>
					<ul>
						<li>El malfuncionamiento anula todas las apuestas y ganancias.</li>
						<li>Se requiere conexión a internet estable.</li>
						<li>En caso de desconexión, recargá el juego para completar cualquier ronda inconclusa.</li>
						<li>El retorno teórico al jugador (RTP) está calculado sobre un gran número de jugadas y no representa el resultado de ninguna sesión individual.</li>
						<li>La pantalla del juego no representa ningún dispositivo físico y tiene únicamente fines ilustrativos.</li>
						<li>Los resultados son determinados por el servidor (RGS), no por el navegador.</li>
						<li>Copyright © Lucky Bastards Studio. TM and © Stake Engine.</li>
					</ul>
				</section>

				<section>
					<h2>Descripción del juego</h2>
					<p>
						<strong>KASH RAMPAGE EXTREME</strong> es el quinto título del universo Lucky Bastards y
						la secuela directa de Kash Smash: The Vault. Esta vez no hay plan: Kash vuelve al
						banco del Corpus Project en New Paradice a puro bate, fuego y demolición total.
					</p>
					<p>
						Slot 6×5 <strong>cluster pays</strong>. Mínimo 5 símbolos del mismo tipo conectados
						horizontal o verticalmente (no diagonal). Los clusters ganadores explotan y los símbolos
						caen por gravedad, generando posibles tumbles en cascada sin límite.
					</p>
					<p>
						Volatilidad <strong>Extreme</strong>. RTP del modo base <strong>96.50%</strong> (el RTP de
						cada modo figura en la tabla). Max win cap
						<strong>5,000×</strong> la apuesta.
					</p>
				</section>

				<section>
					<h2>Modos de apuesta</h2>
					<table class="lb-table">
						<thead>
							<tr>
								<th>Modo</th>
								<th>Costo</th>
								<th>RTP</th>
								<th>Max Win</th>
								<th>KASH RAMPAGE</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>BASE</td>
								<td>1×</td>
								<td>96.5%</td>
								<td>5,000×</td>
								<td>puede golpear en cualquier spin / can strike on any spin</td>
							</tr>
							<tr>
								<td>VAULT CRACK</td>
								<td>100×</td>
								<td>96.5%</td>
								<td>5,000×</td>
								<td>≈ 1 / 6.6 spins</td>
							</tr>
							<tr>
								<td>SMASH MODE</td>
								<td>250×</td>
								<td>96.5%</td>
								<td>5,000×</td>
								<td>≈ 1 / 4.1 spins</td>
							</tr>
							<tr>
								<td>RAGE MODE</td>
								<td>500×</td>
								<td>96.2%</td>
								<td>5,000×</td>
								<td>≈ 1 / 2.2 spins</td>
							</tr>
						</tbody>
					</table>
					<p>
						Los 3 buy modes entran directo a 10 Free Spins. La frecuencia de KASH RAMPAGE de la
					tabla aplica a cada Free Spin del modo.
					</p>
				</section>

				<section>
					<h2>Free Spins</h2>
					<table class="lb-table">
						<thead>
							<tr>
								<th>Scatters (Gold Bar) en initial drop</th>
								<th>Free Spins otorgados</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>4 Scatters</td>
								<td>10 Free Spins</td>
							</tr>
							<tr>
								<td>5 Scatters</td>
								<td>15 Free Spins</td>
							</tr>
							<tr>
								<td>6+ Scatters</td>
								<td>20 Free Spins</td>
							</tr>
						</tbody>
					</table>
					<p>
						<strong>Retrigger</strong>: 3 o más Gold Bars en el initial drop de cualquier Free Spin
						añaden <strong>+5 Free Spins</strong>. Sin límite de retriggers.
					</p>
				</section>

				<section>
					<h2>Wild — Bat</h2>
					<p>
						La <strong>Bat (Kash's Bat)</strong> sustituye cualquier símbolo regular dentro de los
						clusters. No sustituye al Gold Bar (scatter). Cuando una Bat se une a un cluster, cuenta
						como el símbolo del cluster que está completando — y puede conectar dos clusters
						separados del mismo símbolo.
					</p>
				</section>

				<section>
					<h2>Scatter — Gold Bar</h2>
					<p>
						Las <strong>Gold Bars</strong> sólo se cuentan en el initial drop (antes de cualquier
						tumble). <strong>No participan en clusters</strong> y no pagan por sí solas. Su único
						rol es disparar los Free Spins.
					</p>
				</section>

				<section>
					<h2>Tumble Multiplier</h2>
					<p>
						En la esquina superior derecha del board está el <strong>Tumble Multiplier</strong>
						(badge): 1 → 2 → 4 → 8 → 12 → 20 → 50 → 100 → 200 → 500 a lo largo de los tumbles
						del mismo spin. Se resetea cada spin nuevo. Aplica en el juego base y dentro de los
						Free Spins.
					</p>
				</section>

				<section>
					<h2>KASH RAMPAGE — mecánica signature</h2>
					<p>
						En cualquier spin del <strong>juego base</strong> y en cualquier Free Spin de
						<strong>VAULT CRACK, SMASH MODE y RAGE MODE</strong>, Kash puede batear el tablero:
						<strong>todos los símbolos Low y Mid de la grilla se convierten</strong> en un símbolo
						High (85% por celda) o en <strong>KASH</strong>, el símbolo Premium (15% por celda).
						Las conversiones caen en el initial drop, antes de detectar clusters, y son visibles
						en el tablero.
					</p>
					<ul>
						<li>Los Scatters y los Wilds nunca se convierten.</li>
						<li>KASH RAMPAGE golpea como máximo una vez por spin y nunca durante los tumbles.</li>
						<li>
							La chance de un KASH RAMPAGE crece con el modo:
							<strong>VAULT CRACK</strong> ≈ 1 de cada 6.6 Free Spins ·
							<strong>SMASH MODE</strong> ≈ 1 de cada 4.1 ·
							<strong>RAGE MODE</strong> ≈ 1 de cada 2.2.
						</li>
					</ul>
				</section>

				<section>
					<h2>Guía de interfaz</h2>
					<ul>
						<li><strong>SPIN / BET</strong> — inicia la ronda.</li>
						<li><strong>STOP</strong> — interrumpe la animación de la ronda en curso.</li>
						<li><strong>BET (-/+)</strong> — ajusta el monto de la apuesta.</li>
						<li><strong>BONUS</strong> — abre el modal de compra de Free Spins (3 opciones).</li>
						<li><strong>AUTOPLAY</strong> — ejecuta rondas automáticas tras confirmación.</li>
						<li><strong>TURBO</strong> — animación acelerada.</li>
						<li><strong>MENU</strong> — abre settings, paytable y reglas del juego.</li>
						<li><strong>Spacebar</strong> = SPIN, <strong>ESC</strong> = cerrar modal.</li>
					</ul>
				</section>
			</div>
		{:else}
			<div class="lb-doc">
				<section class="lb-disclaimer">
					<h2>Legal Disclaimer</h2>
					<ul>
						<li>Malfunction voids all bets and pays.</li>
						<li>A stable internet connection is required.</li>
						<li>In the event of a disconnection, reload the game to finish any uncompleted rounds.</li>
						<li>The theoretical Return to Player (RTP) is calculated over many plays and does not represent the outcome of any individual session.</li>
						<li>The game display is not representative of any physical device and is for illustrative purposes only.</li>
						<li>Outcomes are determined by the server (RGS), not by the browser.</li>
						<li>Copyright © Lucky Bastards Studio. TM and © Stake Engine.</li>
					</ul>
				</section>

				<section>
					<h2>Game Description</h2>
					<p>
						<strong>KASH RAMPAGE EXTREME</strong> is the fifth title in the Lucky Bastards universe
						and the direct sequel to Kash Smash: The Vault. No plan this time: Kash returns to
						the Corpus Project bank in New Paradice with a bat, fire and total demolition.
					</p>
					<p>
						6×5 <strong>cluster pays</strong> slot. Minimum 5 matching symbols connected horizontally
						or vertically (no diagonals). Winning clusters explode and symbols fall by gravity,
						triggering cascading tumbles with no cap on chain length.
					</p>
					<p>
						Volatility <strong>Extreme</strong>. Base mode RTP <strong>96.50%</strong> (per-mode RTP is
						listed in the table). Max win cap
						<strong>5,000×</strong> the bet.
					</p>
				</section>

				<section>
					<h2>Bet Modes</h2>
					<table class="lb-table">
						<thead>
							<tr>
								<th>Mode</th>
								<th>Cost</th>
								<th>RTP</th>
								<th>Max Win</th>
								<th>KASH RAMPAGE</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>BASE</td>
								<td>1×</td>
								<td>96.5%</td>
								<td>5,000×</td>
								<td>puede golpear en cualquier spin / can strike on any spin</td>
							</tr>
							<tr>
								<td>VAULT CRACK</td>
								<td>100×</td>
								<td>96.5%</td>
								<td>5,000×</td>
								<td>≈ 1 / 6.6 spins</td>
							</tr>
							<tr>
								<td>SMASH MODE</td>
								<td>250×</td>
								<td>96.5%</td>
								<td>5,000×</td>
								<td>≈ 1 / 4.1 spins</td>
							</tr>
							<tr>
								<td>RAGE MODE</td>
								<td>500×</td>
								<td>96.2%</td>
								<td>5,000×</td>
								<td>≈ 1 / 2.2 spins</td>
							</tr>
						</tbody>
					</table>
					<p>
						All 3 buy modes enter directly into 10 Free Spins. The KASH RAMPAGE frequency in the
					table applies to every Free Spin of the mode.
					</p>
				</section>

				<section>
					<h2>Free Spins</h2>
					<table class="lb-table">
						<thead>
							<tr>
								<th>Scatters (Gold Bar) on initial drop</th>
								<th>Free Spins awarded</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>4 Scatters</td>
								<td>10 Free Spins</td>
							</tr>
							<tr>
								<td>5 Scatters</td>
								<td>15 Free Spins</td>
							</tr>
							<tr>
								<td>6+ Scatters</td>
								<td>20 Free Spins</td>
							</tr>
						</tbody>
					</table>
					<p>
						<strong>Retrigger</strong>: 3 or more Gold Bars on the initial drop of any Free Spin
						award an extra <strong>+5 Free Spins</strong>. No retrigger cap.
					</p>
				</section>

				<section>
					<h2>Wild — Bat</h2>
					<p>
						The <strong>Bat (Kash's Bat)</strong> substitutes for any regular symbol within clusters.
						It does not substitute for the Gold Bar (scatter). When a Bat joins a cluster, it counts
						as the symbol it is completing — and can link two separate clusters of the same symbol.
					</p>
				</section>

				<section>
					<h2>Scatter — Gold Bar</h2>
					<p>
						<strong>Gold Bars</strong> are only counted on the initial drop (before any tumble).
						They <strong>do not participate in clusters</strong> and do not pay on their own. Their
						sole role is to trigger Free Spins.
					</p>
				</section>

				<section>
					<h2>Tumble Multiplier</h2>
					<p>
						In the upper right corner of the board is the <strong>Tumble Multiplier</strong>
						(badge): 1 → 2 → 4 → 8 → 12 → 20 → 50 → 100 → 200 → 500 across the tumbles within
						the same spin. Resets at the start of every new spin. It applies in the base game
						and inside Free Spins.
					</p>
				</section>

				<section>
					<h2>KASH RAMPAGE — signature mechanic</h2>
					<p>
						On any spin of the <strong>base game</strong> and on any Free Spin of
						<strong>VAULT CRACK, SMASH MODE and RAGE MODE</strong>, Kash may smash the board:
						<strong>every Low and Mid symbol on the grid is converted</strong> to a High symbol
						(85% chance per cell) or to <strong>KASH</strong>, the Premium symbol (15% chance
						per cell). Conversions land on the initial drop, before clusters are detected, and
						are visible on the board.
					</p>
					<ul>
						<li>Scatters and Wilds are never converted.</li>
						<li>KASH RAMPAGE strikes at most once per spin and never during tumbles.</li>
						<li>
							The chance of a KASH RAMPAGE grows with the mode:
							<strong>VAULT CRACK</strong> ≈ 1 in 6.6 Free Spins ·
							<strong>SMASH MODE</strong> ≈ 1 in 4.1 ·
							<strong>RAGE MODE</strong> ≈ 1 in 2.2.
						</li>
					</ul>
				</section>

				<section>
					<h2>UI Guide</h2>
					<ul>
						<li><strong>SPIN / BET</strong> — starts the round.</li>
						<li><strong>STOP</strong> — interrupts the animation of the current round.</li>
						<li><strong>BET (-/+)</strong> — adjusts the bet amount.</li>
						<li><strong>BONUS</strong> — opens the Free Spins buy modal (3 options).</li>
						<li><strong>AUTOPLAY</strong> — runs automatic rounds after confirmation.</li>
						<li><strong>TURBO</strong> — accelerated animation.</li>
						<li><strong>MENU</strong> — opens settings, paytable and game rules.</li>
						<li><strong>Spacebar</strong> = SPIN, <strong>ESC</strong> = close modal.</li>
					</ul>
				</section>
			</div>
		{/if}
	{/snippet}

	{#snippet payTable()}
		{#if stateUrlDerived.lang() === 'es'}
			<div class="lb-pay">
				<h2>Tabla de pagos</h2>
				<p class="lb-pay-note">
					Multiplicadores sobre la apuesta base, por tamaño del cluster (símbolos conectados horizontal
					o vertical, mínimo 5).
				</p>
				<div class="lb-pay-scroll">
					<table class="lb-pay-table">
						<thead>
							<tr>
								<th>Símbolo</th>
								<th>5</th>
								<th>6-7</th>
								<th>8-9</th>
								<th>10-11</th>
								<th>12-14</th>
								<th>15+</th>
							</tr>
						</thead>
						<tbody>
							<tr class="tier-high">
								<td class="lb-sym"><PaySprite name="premium" label="H4" /><span>KASH</span></td>
								<td>13.5×</td>
								<td>24.5×</td>
								<td>95.0×</td>
								<td>340.0×</td>
								<td>1020.0×</td>
								<td>4900.0×</td>
							</tr>
							<tr class="tier-high">
								<td class="lb-sym"><img src="assets/sprites/symbols/h3.png" alt="H3" /><span>RAT</span></td>
								<td>8.2×</td>
								<td>13.5×</td>
								<td>43.5×</td>
								<td>142.0×</td>
								<td>405.0×</td>
								<td>1880.0×</td>
							</tr>
							<tr class="tier-high">
								<td class="lb-sym"><img src="assets/sprites/symbols/h2.png" alt="H2" /><span>FTP</span></td>
								<td>6.8×</td>
								<td>10.8×</td>
								<td>38.0×</td>
								<td>122.0×</td>
								<td>340.0×</td>
								<td>1620.0×</td>
							</tr>
							<tr class="tier-high">
								<td class="lb-sym"><img src="assets/sprites/symbols/h1.png" alt="H1" /><span>12!</span></td>
								<td>4.8×</td>
								<td>7.4×</td>
								<td>23.5×</td>
								<td>74.0×</td>
								<td>200.0×</td>
								<td>940.0×</td>
							</tr>
							<tr class="tier-mid">
								<td class="lb-sym"><img src="assets/sprites/symbols/m2.png" alt="M2" /><span>CARD</span></td>
								<td>3.3×</td>
								<td>4.8×</td>
								<td>13.5×</td>
								<td>40.0×</td>
								<td>102.0×</td>
								<td>470.0×</td>
							</tr>
							<tr class="tier-mid">
								<td class="lb-sym"><img src="assets/sprites/symbols/m1.png" alt="M1" /><span>Nitro</span></td>
								<td>2.5×</td>
								<td>3.6×</td>
								<td>9.5×</td>
								<td>27.0×</td>
								<td>68.0×</td>
								<td>295.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/h4.png" alt="L4" /><span>MEDALLION</span></td>
								<td>1.4×</td>
								<td>1.9×</td>
								<td>4.7×</td>
								<td>12.0×</td>
								<td>30.0×</td>
								<td>120.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/l3.png" alt="L3" /><span>Molotov</span></td>
								<td>1.1×</td>
								<td>1.5×</td>
								<td>3.6×</td>
								<td>9.5×</td>
								<td>23.0×</td>
								<td>95.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/l2.png" alt="L2" /><span>Brass Knuckles</span></td>
								<td>0.8×</td>
								<td>1.1×</td>
								<td>2.8×</td>
								<td>6.9×</td>
								<td>18.0×</td>
								<td>68.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/l1.png" alt="L1" /><span>Crowbar</span></td>
								<td>0.6×</td>
								<td>0.8×</td>
								<td>2.2×</td>
								<td>5.5×</td>
								<td>14.0×</td>
								<td>55.0×</td>
							</tr>
						</tbody>
					</table>
				</div>

				<h3>Símbolos especiales</h3>
				<ul class="lb-pay-specials">
					<li>
						<strong class="lb-sym-inline"><PaySprite name="wild" size="1.6rem" label="Wild" />Bat (Wild)</strong> — Kash's Bat. Sustituye cualquier símbolo regular dentro de
						los clusters. No sustituye al Gold Bar.
					</li>
					<li>
						<strong class="lb-sym-inline"><PaySprite name="scatterLuz" size="1.6rem" label="Scatter" />Gold Bar (Scatter)</strong> — solo cuenta para disparar Free Spins en el initial
						drop. No participa en clusters. 4 = 10 FS, 5 = 15 FS, 6+ = 20 FS. 3+ durante FS = retrigger
						+5 FS.
					</li>
				</ul>

				<h3>Multiplicadores en Free Spins</h3>
				<ul class="lb-pay-specials">
					<li>
						<strong>Tumble Multiplier (lima, derecha)</strong> — sube por cada tumble dentro del mismo
						spin: 1 → 2 → 4 → 8 → 12 → 20 → 50 → 100 → 200 → 500. Resetea al inicio de cada spin.
					</li>
				</ul>

				<h3>Tier de símbolos</h3>
				<ul class="lb-pay-specials">
					<li>
						<strong>Premium (H4)</strong>: KASH — el fajo marcado, el botín del asalto y el
						símbolo que más paga.
					</li>
					<li>
						<strong>High (H1-H3)</strong>: 12!, FTP, RAT — los tags de la crew.
					</li>
					<li>
						<strong>Medium (M1-M2)</strong>: Nitro (cilindro de nitroglicerina) y CARD (la
						keycard de acceso a la bóveda).
					</li>
					<li>
						<strong>Low (L1-L4)</strong>: Crowbar, Brass Knuckles, Molotov, Medallion — el
						toolkit del asalto.
					</li>
				</ul>
			</div>
		{:else}
			<div class="lb-pay">
				<h2>Pay Table</h2>
				<p class="lb-pay-note">
					Multipliers on the base bet, by cluster size (symbols connected horizontally or vertically,
					minimum 5).
				</p>
				<div class="lb-pay-scroll">
					<table class="lb-pay-table">
						<thead>
							<tr>
								<th>Symbol</th>
								<th>5</th>
								<th>6-7</th>
								<th>8-9</th>
								<th>10-11</th>
								<th>12-14</th>
								<th>15+</th>
							</tr>
						</thead>
						<tbody>
							<tr class="tier-high">
								<td class="lb-sym"><PaySprite name="premium" label="H4" /><span>KASH</span></td>
								<td>13.5×</td>
								<td>24.5×</td>
								<td>95.0×</td>
								<td>340.0×</td>
								<td>1020.0×</td>
								<td>4900.0×</td>
							</tr>
							<tr class="tier-high">
								<td class="lb-sym"><img src="assets/sprites/symbols/h3.png" alt="H3" /><span>RAT</span></td>
								<td>8.2×</td>
								<td>13.5×</td>
								<td>43.5×</td>
								<td>142.0×</td>
								<td>405.0×</td>
								<td>1880.0×</td>
							</tr>
							<tr class="tier-high">
								<td class="lb-sym"><img src="assets/sprites/symbols/h2.png" alt="H2" /><span>FTP</span></td>
								<td>6.8×</td>
								<td>10.8×</td>
								<td>38.0×</td>
								<td>122.0×</td>
								<td>340.0×</td>
								<td>1620.0×</td>
							</tr>
							<tr class="tier-high">
								<td class="lb-sym"><img src="assets/sprites/symbols/h1.png" alt="H1" /><span>12!</span></td>
								<td>4.8×</td>
								<td>7.4×</td>
								<td>23.5×</td>
								<td>74.0×</td>
								<td>200.0×</td>
								<td>940.0×</td>
							</tr>
							<tr class="tier-mid">
								<td class="lb-sym"><img src="assets/sprites/symbols/m2.png" alt="M2" /><span>CARD</span></td>
								<td>3.3×</td>
								<td>4.8×</td>
								<td>13.5×</td>
								<td>40.0×</td>
								<td>102.0×</td>
								<td>470.0×</td>
							</tr>
							<tr class="tier-mid">
								<td class="lb-sym"><img src="assets/sprites/symbols/m1.png" alt="M1" /><span>Nitro</span></td>
								<td>2.5×</td>
								<td>3.6×</td>
								<td>9.5×</td>
								<td>27.0×</td>
								<td>68.0×</td>
								<td>295.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/h4.png" alt="L4" /><span>MEDALLION</span></td>
								<td>1.4×</td>
								<td>1.9×</td>
								<td>4.7×</td>
								<td>12.0×</td>
								<td>30.0×</td>
								<td>120.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/l3.png" alt="L3" /><span>Molotov</span></td>
								<td>1.1×</td>
								<td>1.5×</td>
								<td>3.6×</td>
								<td>9.5×</td>
								<td>23.0×</td>
								<td>95.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/l2.png" alt="L2" /><span>Brass Knuckles</span></td>
								<td>0.8×</td>
								<td>1.1×</td>
								<td>2.8×</td>
								<td>6.9×</td>
								<td>18.0×</td>
								<td>68.0×</td>
							</tr>
							<tr class="tier-low">
								<td class="lb-sym"><img src="assets/sprites/symbols/l1.png" alt="L1" /><span>Crowbar</span></td>
								<td>0.6×</td>
								<td>0.8×</td>
								<td>2.2×</td>
								<td>5.5×</td>
								<td>14.0×</td>
								<td>55.0×</td>
							</tr>
						</tbody>
					</table>
				</div>

				<h3>Special Symbols</h3>
				<ul class="lb-pay-specials">
					<li>
						<strong class="lb-sym-inline"><PaySprite name="wild" size="1.6rem" label="Wild" />Bat (Wild)</strong> — Kash's Bat. Substitutes for any regular symbol within
						clusters. Does not substitute for the Gold Bar.
					</li>
					<li>
						<strong class="lb-sym-inline"><PaySprite name="scatterLuz" size="1.6rem" label="Scatter" />Gold Bar (Scatter)</strong> — only counts toward triggering Free Spins on the
						initial drop. Does not participate in clusters. 4 = 10 FS, 5 = 15 FS, 6+ = 20 FS. 3+
						during FS = retrigger +5 FS.
					</li>
				</ul>

				<h3>Free Spins Multipliers</h3>
				<ul class="lb-pay-specials">
					<li>
						<strong>Tumble Multiplier (lime, right)</strong> — climbs with each tumble within the
						same spin: 1 → 2 → 4 → 8 → 12 → 20 → 50 → 100 → 200 → 500. Resets at the start of every
						spin.
					</li>
				</ul>

				<h3>Symbol Tiers</h3>
				<ul class="lb-pay-specials">
					<li>
						<strong>Premium (H4)</strong>: KASH — the marked cash bundle, the heist loot and the
						top-paying symbol.
					</li>
					<li>
						<strong>High (H1-H3)</strong>: 12!, FTP, RAT — the crew's tags.
					</li>
					<li>
						<strong>Medium (M1-M2)</strong>: Nitro (nitroglycerin canister) and CARD (the vault
						access keycard).
					</li>
					<li>
						<strong>Low (L1-L4)</strong>: Crowbar, Brass Knuckles, Molotov, Medallion — the
						heist toolkit.
					</li>
				</ul>
			</div>
		{/if}
	{/snippet}
</Modals>

<style lang="scss">
	:global(.lb-doc) {
		font-family: 'Europa', system-ui, sans-serif;
		color: #f5f5f5;
		text-align: left;
		max-width: 720px;
		padding: 1rem 1.5rem;
		line-height: 1.5;
	}
	:global(.lb-doc h2) {
		color: #f6ef1b;
		font-size: 1.4rem;
		font-weight: 900;
		letter-spacing: 1px;
		text-transform: uppercase;
		margin: 1.25rem 0 0.5rem;
		border-bottom: 2px solid #e02330;
		padding-bottom: 0.25rem;
	}
	:global(.lb-doc p) {
		margin: 0.4rem 0;
		color: #e5e5e5;
	}
	:global(.lb-doc ul) {
		margin: 0.4rem 0;
		padding-left: 1.25rem;
		color: #e5e5e5;
	}
	:global(.lb-doc li) {
		margin: 0.25rem 0;
	}
	:global(.lb-doc strong) {
		color: #ff7a1a;
	}
	:global(.lb-disclaimer) {
		background: rgba(236, 72, 153, 0.08);
		border: 1px solid #e02330;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
	}
	:global(.lb-disclaimer h2) {
		color: #e02330;
		border-bottom-color: #f6ef1b;
		margin-top: 0;
	}
	:global(.lb-table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5rem 0;
		font-size: 0.95rem;
	}
	:global(.lb-table th),
	:global(.lb-table td) {
		padding: 0.4rem 0.6rem;
		border: 1px solid #2a2825;
		text-align: left;
	}
	:global(.lb-table thead th) {
		background: #0d0c0a;
		color: #f6ef1b;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	:global(.lb-table tbody tr:nth-child(odd)) {
		background: rgba(20, 184, 166, 0.06);
	}
	:global(.lb-table tbody td:first-child) {
		color: #f6ef1b;
		font-weight: 700;
	}

	:global(.lb-pay) {
		font-family: 'Europa', system-ui, sans-serif;
		color: #f5f5f5;
		text-align: left;
		width: 100%;
		max-width: 760px;
		box-sizing: border-box;
		padding: 1rem 1.5rem;
		line-height: 1.4;
	}
	:global(.lb-pay h2) {
		color: #f6ef1b;
		font-size: 1.4rem;
		font-weight: 900;
		letter-spacing: 1px;
		text-transform: uppercase;
		margin: 0 0 0.25rem;
		border-bottom: 2px solid #e02330;
		padding-bottom: 0.25rem;
	}
	:global(.lb-pay h3) {
		color: #ff7a1a;
		font-size: 1.05rem;
		font-weight: 900;
		letter-spacing: 1px;
		text-transform: uppercase;
		margin: 1rem 0 0.4rem;
	}
	:global(.lb-pay-note) {
		color: #b8b8b8;
		font-size: 0.85rem;
		margin: 0.25rem 0 0.75rem;
	}
	:global(.lb-pay-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	:global(.lb-pay-table th),
	:global(.lb-pay-table td) {
		padding: 0.35rem 0.5rem;
		border: 1px solid #2a2825;
		text-align: center;
	}
	:global(.lb-pay-table thead th) {
		background: #0d0c0a;
		color: #f6ef1b;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	:global(.lb-pay-table tbody td:first-child) {
		font-weight: 900;
		letter-spacing: 1px;
	}
	:global(.lb-pay-table tr.tier-high td:first-child) {
		color: #e02330;
	}
	:global(.lb-pay-table tr.tier-mid td:first-child) {
		color: #f6ef1b;
	}
	:global(.lb-pay-table tr.tier-low td:first-child) {
		color: #ff7a1a;
	}
	:global(.lb-pay-table tbody tr:nth-child(even)) {
		background: rgba(20, 184, 166, 0.05);
	}
	:global(.lb-pay-specials) {
		margin: 0;
		padding-left: 1.25rem;
		color: #e5e5e5;
	}
	:global(.lb-pay-specials li) {
		margin: 0.25rem 0;
	}
	:global(.lb-pay-specials strong) {
		color: #f6ef1b;
	}
	/* Celda de símbolo con su icono real (sprites del board) */
	:global(.lb-pay-table td.lb-sym) {
		text-align: left;
		white-space: nowrap;
	}
	:global(.lb-pay-table td.lb-sym img) {
		width: 2.2rem;
		height: 2.2rem;
		object-fit: contain;
		vertical-align: middle;
		margin-right: 0.5rem;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
	}
	:global(.lb-pay-table td.lb-sym span) {
		vertical-align: middle;
	}
	:global(.lb-sym-inline img) {
		width: 1.6rem;
		height: 1.6rem;
		object-fit: contain;
		vertical-align: middle;
		margin-right: 0.35rem;
	}

	/* Los sprites recortados de atlas (PaySprite) comparten la separación de
	   los <img> estáticos: el tamaño ya lo fija el propio componente. */
	:global(.lb-pay-table td.lb-sym .pay-sprite) {
		margin-right: 0.5rem;
	}
	:global(.lb-sym-inline .pay-sprite) {
		margin-right: 0.35rem;
	}

	/* ── Slider horizontal de la tabla de pagos ───────────────────────────
	   El shell del modal es `width: min(86vw, 640px)` y `BaseScrollable` corta
	   con `overflow-x: hidden`, así que en celular las 7 columnas se recortaban
	   sin forma de llegar a los tramos altos. La tabla conserva un ancho mínimo
	   legible y se desplaza DENTRO de este contenedor. */
	:global(.lb-pay-scroll) {
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
		scrollbar-color: #e02330 transparent;
		/* Pista de que hay más tabla a la derecha aunque la barra esté oculta
		   (iOS la esconde hasta que se arrastra). */
		background:
			linear-gradient(to right, #0d0c0a 30%, rgba(13, 12, 10, 0)) left / 24px 100% no-repeat,
			linear-gradient(to left, #0d0c0a 30%, rgba(13, 12, 10, 0)) right / 24px 100% no-repeat,
			radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.6), transparent) left / 12px 100% no-repeat,
			radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.6), transparent) right / 12px 100% no-repeat;
		background-attachment: local, local, scroll, scroll;
	}
	:global(.lb-pay-scroll)::-webkit-scrollbar {
		height: 6px;
	}
	:global(.lb-pay-scroll)::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	:global(.lb-pay-scroll)::-webkit-scrollbar-thumb {
		background: #e02330;
		border-radius: 3px;
	}
	:global(.lb-pay-scroll .lb-pay-table) {
		/* 1ª columna (icono + nombre) + 6 tramos. Por debajo de esto los
		   multiplicadores empiezan a partirse en dos líneas. */
		min-width: 30rem;
	}

	@media (max-width: 640px) {
		:global(.lb-pay) {
			padding: 0.75rem 0.75rem;
		}
		:global(.lb-pay-table) {
			font-size: 0.8rem;
		}
		:global(.lb-pay-table th),
		:global(.lb-pay-table td) {
			padding: 0.3rem 0.4rem;
		}
		:global(.lb-pay-table td.lb-sym img),
		:global(.lb-pay-table td.lb-sym .pay-sprite) {
			width: 1.8rem;
			height: 1.8rem;
		}
	}
</style>
