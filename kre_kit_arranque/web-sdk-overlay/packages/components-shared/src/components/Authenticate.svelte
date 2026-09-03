<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate, requestReplay } from 'rgs-requests';
	import { stateUrlDerived, stateBet, stateConfig, stateModal, stateUi } from 'state-shared';
	import { API_AMOUNT_MULTIPLIER, MOST_USED_BET_INDEXES } from 'constants-shared/bet';

	type Props = { children: Snippet };

	const props: Props = $props();

	let authenticated = $state(false);

	const authenticate = async () => {
		try {
			const authenticateData = await requestAuthenticate({
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
				language: stateUrlDerived.lang(),
			});

			// error
			if (authenticateData?.error) throw authenticateData;

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
			console.error(error);
			stateModal.modal = { name: 'error', error };
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
			await handleReplay();
		} else {
			stateUi.config.mode = 'default';
			await authenticate();
		};

		authenticated = true;
	});
</script>

{#if authenticated}
	{@render props.children()}
{/if}
