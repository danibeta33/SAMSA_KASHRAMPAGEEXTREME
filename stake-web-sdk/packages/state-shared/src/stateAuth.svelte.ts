// ESTADO DE AUTENTICACIÓN CONTRA EL RGS
//
// Feedback Stake 16-09, punto 1: "When the rgs_url is invalid or changed to an
// incorrect value, the game should NOT BE PLAYABLE and only an appropriate
// 'Failed to fetch' error message should be displayed, without any unnecessary
// technical details or code."
//
// Hasta el 16-09 el fallo de `authenticate()` solo levantaba un modal, pero el
// juego se montaba igual detrás (Authenticate ponía `authenticated = true`
// pase lo que pase) y en KRE la pantalla de carga —z-index 200— tapaba el
// modal —z-index 180—. Este flag es el interruptor único: con 'failed' NADA
// del juego se monta, ni el canvas, ni la barra inferior, ni los overlays.
export type AuthStatus = 'pending' | 'authenticated' | 'failed';

export const stateAuth = $state({
	status: 'pending' as AuthStatus,
});
