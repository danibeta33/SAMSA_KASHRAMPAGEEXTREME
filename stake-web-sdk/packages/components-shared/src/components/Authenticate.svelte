<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate, requestReplay } from 'rgs-requests';
	import { stateUrlDerived, stateBet, stateConfig, stateModal, stateUi, stateAuth } from 'state-shared';
	import { API_AMOUNT_MULTIPLIER, MOST_USED_BET_INDEXES } from 'constants-shared/bet';

	import FatalError from './FatalError.svelte';

	type Props = { children: Snippet };

	const props: Props = $props();

	let authenticated = $state(false);

	// ── REQUISITO STAKE 16-09, PUNTO 1 ──────────────────────────────────────
	// "Please ensure that the game uses the rgs_url parameter to determine the
	//  server. When the rgs_url is invalid or changed to an incorrect value,
	//  the game should not be playable and only an appropriate 'Failed to
	//  fetch' error message should be displayed, without any unnecessary
	//  technical details or code."
	//
	// El servidor sale SIEMPRE de `stateUrlDerived.rgsUrl()`, que lee el query
	// param `rgs_url` y no tiene fallback a ningún host hardcodeado (ver
	// state-shared/src/stateUrl.svelte.ts). Acá se cierra la otra mitad: que
	// un `rgs_url` inválido termine en pantalla de error y en NADA jugable.
	// ────────────────────────────────────────────────────────────────────────

	/**
	 * Valida el `rgs_url` ANTES de tocar la red.
	 *
	 * El caso exacto del reviewer (`rgs_url=sdasda:85:602`) ni siquiera es una
	 * URL: `new URL('https://sdasda:85:602')` tira porque el puerto es
	 * inválido. Sin este chequeo ese throw sale de `fetch()` como un error
	 * nativo con stack — el que terminó impreso en el modal del screenshot.
	 */
	const isValidRgsUrl = (raw: string) => {
		const value = (raw || '').trim();
		if (!value) return false;
		// Protocolo-relativo (`//host`): no es un host, y concatenarle el
		// `https://` que agrega rgsFetcher da una URL sin sentido.
		if (value.startsWith('//')) return false;
		// Con esquema explícito, solo http/https. Sin esto un `ftp://x.com`
		// pasaba: como no matchea `^https?://`, se le anteponía `https://` y
		// quedaba `https://ftp://x.com`, que `new URL` acepta (host = "ftp").
		const scheme = value.match(/^([a-z][a-z0-9+.-]*):\/\//i);
		if (scheme && !/^https?$/i.test(scheme[1])) return false;
		try {
			const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
			return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
		} catch {
			return false;
		}
	};

	/**
	 * Un `rgs_url` puede apuntar a un servidor que existe, contesta 200 y
	 * devuelve JSON — pero que no es el RGS de este juego. Sin `config.betLevels`
	 * y sin `balance` el juego no tiene ni montos de apuesta ni saldo: dejarlo
	 * entrar sería "playable" en apariencia y roto en la práctica. Se trata
	 * como fallo de autenticación, que es lo que es.
	 */
	const isUsableAuthenticateData = (data: unknown) => {
		const payload = data as
			| { balance?: { amount?: unknown }; config?: { betLevels?: unknown } }
			| null
			| undefined;
		if (!payload) return false;
		if (typeof payload.balance?.amount !== 'number') return false;
		const betLevels = payload.config?.betLevels;
		return Array.isArray(betLevels) && betLevels.length > 0;
	};

	/**
	 * Único punto de salida del camino de error. `stateAuth.status = 'failed'`
	 * es el interruptor que apaga TODO el juego (ver el markup de este archivo
	 * y el gate de +layout.svelte en la app).
	 *
	 * Nunca recibe el objeto de error: no hay forma de que un detalle técnico
	 * viaje hasta la UI por acá.
	 */
	const failAuthentication = (reason: string, cause?: unknown) => {
		// Solo DEV; en el build de prod el `console.*` se elimina entero.
		if (import.meta.env.DEV) console.error(`[auth] ${reason}`, cause);
		stateAuth.status = 'failed';
		// Se limpia cualquier modal pendiente: la pantalla fatal es lo único
		// que se muestra, sin capas encima ni debajo.
		stateModal.modal = null;
		authenticated = false;
	};

	const authenticate = async () => {
		if (!isValidRgsUrl(stateUrlDerived.rgsUrl())) {
			// Sin red de por medio: no hay a dónde ir.
			failAuthentication('invalid rgs_url');
			return;
		}

		try {
			const authenticateData = await requestAuthenticate({
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
				language: stateUrlDerived.lang(),
			});

			// error
			if (authenticateData?.error) throw authenticateData;

			if (!isUsableAuthenticateData(authenticateData)) {
				throw { error: 'INVALID_AUTHENTICATE_RESPONSE' };
			}

			// balance
			if (authenticateData?.balance) {
				// Example of authenticateData.balance
				// {
				// 		"amount": 10000000000000000,
				// 		"currency": "USD"
				// },
				stateBet.currency = authenticateData.balance.currency;
				stateBet.balanceAmount = authenticateData.balance.amount / API_AMOUNT_MULTIPLIER;
			}

			// config
			if (authenticateData?.config) {
				// Example of authenticateData.config
				// {
				// 	"gameID": "37_test-lines",
				// 	"minBet": 100000,
				// 	"maxBet": 1000000000,
				// 	"stepBet": 10000,
				// 	"defaultBetLevel": 1000000,
				// 	"betLevels": [100000, 200000, ..., 1000000000],
				// 	"betModes": {},
				// 	"jurisdiction": {
				// 			"socialCasino": false,
				// 			"disabledFullscreen": false,
				// 			"disabledTurbo": false,
				// 			"disabledSuperTurbo": false,
				// 			"disabledAutoplay": false,
				// 			"disabledSlamstop": false,
				// 			"disabledSpacebar": false,
				// 			"disabledBuyFeature": false,
				// 			"displayNetPosition": false,
				// 			"displayRTP": false,
				// 			"displaySessionTimer": false,
				// 			"minimumRoundDuration": 0
				// 	}
				// }
				stateConfig.jurisdiction = authenticateData?.config?.jurisdiction;
				stateConfig.betAmountOptions = (authenticateData.config?.betLevels || []).map(
					(level) => level / API_AMOUNT_MULTIPLIER,
				);
				stateConfig.betMenuOptions = stateConfig.betAmountOptions.filter((_, index) =>
					MOST_USED_BET_INDEXES.includes(index),
				);
				// Bet inicial = defaultBetLevel del RGS (review N2: nada de montos
				// hardcodeados — el default estático de stateBet puede no existir
				// en los betLevels de la moneda de la sesión). Si el RGS no manda
				// default, usar el primer bet level disponible. El round a resumir
				// (más abajo) puede pisarlo con el monto de la ronda pendiente.
				const defaultBetAmount = authenticateData.config?.defaultBetLevel
					? authenticateData.config.defaultBetLevel / API_AMOUNT_MULTIPLIER
					: stateConfig.betAmountOptions[0];
				if (defaultBetAmount !== undefined) {
					stateBet.betAmount = defaultBetAmount;
				}
			}

			// round
			if (authenticateData?.round) {
				// Example of authenticateData.round 
				// {
				// 	"betID": 62277967,
				// 	"amount": 1000000,
				// 	"payout": 33400000,
				// 	"payoutMultiplier": 33.4,
				// 	"active": true,
				// 	"state": [...],
				// 	"mode": "BONUS",
				// 	"event": null
				// }

				if(authenticateData.round?.state) {
					// @ts-ignore
					stateBet.betToResume =  authenticateData.round;
				}

				if(authenticateData.round?.amount) {
					const betAmountValue =
						authenticateData.round.amount > 0
							? authenticateData.round.amount / API_AMOUNT_MULTIPLIER
							: 0;
					stateBet.betAmount = betAmountValue;
					stateBet.wageredBetAmount = betAmountValue;
				}

				if (authenticateData.round?.mode) {
					stateBet.activeBetModeKey = authenticateData.round.mode;
				};
			}
		} catch (error) {
			// Antes esto levantaba `stateModal.modal = { name: 'error', error }`
			// y seguía de largo: el juego se montaba igual detrás del modal.
			// Ahora corta el arranque. El objeto `error` NO sale de este scope.
			failAuthentication('authenticate failed', error);
		}
	};

	const handleReplay = async () => {
		stateBet.betAmount = (stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER) || 0;
		stateBet.wageredBetAmount = (stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER) || 0;
		stateBet.activeBetModeKey = stateUrlDerived.mode();
		// En replay no hay authenticate() que traiga la currency — el requisito
		// pide mantener el display de moneda de la ronda, que llega por URL.
		if (stateUrlDerived.currency()) {
			stateBet.currency = stateUrlDerived.currency();
		} else if (stateUrlDerived.social()) {
			// Sin ?currency en social el default 'USD' pintaría "$" en todo el
			// HUD — prefijo prohibido en Stake.us. Caer a Gold Coins.
			stateBet.currency = 'XGC';
		}

		// Sin try/catch (como sí tiene authenticate()) un RGS caído dejaba una
		// unhandled rejection en consola y el loader colgado sin mensaje; un
		// 200 con {error} armaba un betToResume zombie con state vacío en vez
		// del modal REPLAY_NOT_FOUND de ResumeBet.
		try {
			const data = await requestReplay({
				rgsUrl: stateUrlDerived.rgsUrl(),
				game: stateUrlDerived.game(),
				mode: stateUrlDerived.mode(),
				version: stateUrlDerived.version(),
				event: stateUrlDerived.event(),
			});

			// @ts-ignore
			if (data && !data.error) {
				// El shape del replay puede venir plano (mock) o anidado en `round`
				// (RoundDetailObject del RGS) — normalizar acá para que el playback
				// y la replay card siempre lean betToResume.state.
				// @ts-ignore
				const round = data.round ?? {};
				// @ts-ignore
				stateBet.betToResume = {
					...round,
					...data,
					// @ts-ignore
					state: data.state ?? round.state ?? [],
					event: '0',
					active: true,
					mode: stateUrlDerived.mode(),
				};

				// Si la URL no trajo ?amount, caer al amount de la ronda para que
				// los montos del replay no queden en 0.00.
				if (!stateBet.wageredBetAmount) {
					// @ts-ignore
					const rawAmount = data.amount ?? round.amount;
					if (rawAmount) {
						stateBet.betAmount = rawAmount / API_AMOUNT_MULTIPLIER;
						stateBet.wageredBetAmount = stateBet.betAmount;
					}
				}
			}
		} catch (error) {
			// betToResume queda null → ResumeBet muestra REPLAY_NOT_FOUND.
			if (import.meta.env.DEV) console.error(error);
		}
	};

	onMount(async () => {
		if(stateUrlDerived.replay()) {
			stateUi.config.mode = 'replay';
			// El replay tampoco es "jugable" con un rgs_url inválido: sin
			// servidor no hay ronda que reproducir.
			if (!isValidRgsUrl(stateUrlDerived.rgsUrl())) {
				failAuthentication('invalid rgs_url (replay)');
				return;
			}
			await handleReplay();
		} else {
			stateUi.config.mode = 'default';
			await authenticate();
		};

		// `failAuthentication()` ya dejó el status en 'failed' — no montar nada.
		if (stateAuth.status === 'failed') return;

		stateAuth.status = 'authenticated';
		authenticated = true;
	});
</script>

{#if stateAuth.status === 'failed'}
	<!-- Lo ÚNICO que se muestra. El juego no se monta. -->
	<FatalError />
{:else if authenticated}
	{@render props.children()}
{/if}
