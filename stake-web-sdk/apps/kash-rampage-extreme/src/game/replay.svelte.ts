import type { Bet } from './typesBookEvent';

// Estado del modo bet replay (requisito de approval — /docs/api/bet-replay):
// la ronda se auto-carga al detectar replay=true pero NO se auto-reproduce.
// ResumeBet guarda acá la ronda cargada y ReplayOverlay la dispara con PLAY
// (y la repite con PLAY AGAIN re-inyectándola en stateBet.betToResume).
export const replayState = $state({
	phase: 'idle' as 'idle' | 'ready' | 'playing' | 'done',
	savedBet: null as Bet | null,
});
