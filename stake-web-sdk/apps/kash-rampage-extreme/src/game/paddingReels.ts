import type { RawSymbol } from './types';

// Strips REALES de la math (copias de stake-math-sdk/games/kash_rampage_extreme/
// reels/). Son el relleno que scrollea por encima del board con
// createReelForSpinning (port del approach de dead-heat, 25-08): el book trae
// paddingPositions (índice de parada en el strip), así que lo que se ve pasar
// es el vecindario EXACTO del resultado — no un relleno inventado.
// ⚠ Si la math re-pilotea los strips (generate_reels.py), re-copiar los CSV.
import br0Raw from './reels/BR0.csv?raw';
import fr0Raw from './reels/FR0.csv?raw';

// CSV: cada FILA es una posición del strip, cada COLUMNA un reel → transponer.
const parseStrips = (csv: string): RawSymbol[][] => {
	const rows = csv
		.trim()
		.split('\n')
		.map((line) => line.trim().split(','));
	return rows[0].map((__, reelIndex) =>
		rows.map((row) => ({ name: row[reelIndex] as RawSymbol['name'] })),
	);
};

// freegame usa FR0; WCAP (wincap) no llega como gameType propio al cliente.
export const PADDING_REELS: { basegame: RawSymbol[][]; freegame: RawSymbol[][] } = {
	basegame: parseStrips(br0Raw),
	freegame: parseStrips(fr0Raw),
};
