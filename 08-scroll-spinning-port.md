# 08 — Port del scroll continuo con rebote (estilo Dead Heat) a otro juego

> Escrito 25-08-2026, después de portarlo a **kash-rampage-extreme**. Dead Heat
> lo hizo primero (04-08) sobre el mismo template. Esta guía es la receta para
> repetirlo en cualquier fork de `cluster-tumble-base` (o de kash-smash) en
> ~30 minutos.

## Qué es y por qué

El template cluster/kash usa `createReelForCascading`: los símbolos **caen de a
uno** (lluvia), cada uno frena antes de su celda y asienta con `backOut`. El
gesto de Dead Heat es otro: `createReelForSpinning` — la columna entera es una
**TIRA continua** (board nuevo + relleno + board viejo) que se desliza hacia
abajo, aterriza **pasada de largo** (~0.35 celda) y vuelve como unidad con
`sineOut`. Ese overshoot-y-vuelta es "el rebotesito"; el scroll clásico de
slot es la tira.

**Lección aprendida (no repetir):** intentamos DOS veces emular el gesto dentro
del cascade (flag de overshoot por símbolo, después lockstep con interval 0) y
no convence — el feel de la tira con su pre-spin loop no se falsifica con
constantes. Si piden "el rebote de Dead Heat", el camino es **cambiar el
engine**, no tunear el cascade.

## Por qué es seguro en un juego cluster con tumbles

Los **tumbles NO dependen del engine de reels**: los maneja el sistema
`TumbleBoard`/`TumbleSymbol` aparte. El engine de reels solo hace el **drop
inicial** del reveal. Dead Heat y Kash Rampage Extreme son ambos
`cluster_tumble_base` y funcionan con el spinning engine sin tocar un tumble.

Además, la capa `createEnhanceBoard` (preSpin/spin/settle/readyToSpinEffect)
es **agnóstica del engine** — ambos exponen la misma API pública
(`preSpin`, `prepareToSpin`, `spin`, `stop`, `setSymbolsWithRawSymbols`,
`readyToSpinEffect`, `reelState`). Los params que el cascade no conoce
(`paddingReel`, `paddingPosition`) ya viajan con `@ts-ignore` en el enhance.

## Prerequisito de math

El book debe traer **`paddingPositions: number[]`** en el evento `reveal`
(índice de parada en el strip por reel). Todo lo salido de cluster_tumble_base
lo trae — verificar en `typesBookEvent.ts` o en un book real. Sin eso, el
relleno que scrollea no puede ser el vecindario real del resultado.

## Receta (7 archivos)

Referencias vivas: `apps/dead-heat/` y `apps/kash-rampage-extreme/` (ambos ya
portados — diff contra kash-smash para ver el delta exacto).

### 1. Strips de la math → `src/game/reels/*.csv`

```bash
cp stake-math-sdk/games/<slug>/reels/BR0.csv apps/<juego>/src/game/reels/
cp stake-math-sdk/games/<slug>/reels/FR0.csv apps/<juego>/src/game/reels/
```

⚠ Si la math re-pilotea los strips (`generate_reels.py`), **re-copiar los CSV**.

### 2. `src/game/paddingReels.ts` (nuevo, ~28 líneas)

Copiar de dead-heat o kash-rampage-extreme. Parsea los CSV (`?raw` de Vite,
cada fila = posición del strip, cada columna = reel → **transponer**) y exporta:

```ts
export const PADDING_REELS: { basegame: RawSymbol[][]; freegame: RawSymbol[][] }
```

Un strip representante por gameType basta (DH usa uno solo para los 3 bonus:
el padding es presentación pura).

### 3. `stateGame.svelte.ts` — swap del factory

`createReelForCascading` → `createReelForSpinning` (import + llamada). El resto
del archivo no cambia: mismas options (`reelIndex`, `symbolHeight`,
`initialSymbols`, `initialSymbolState`, `onReelStopping`, `onSymbolLand`) y el
mismo `reel.reelState.spinOptions = () => ...`.

### 4. `constants.ts` — SPIN_OPTIONS del spinning

Reemplazar TODOS los `symbolFallIn*/symbolFallOut*/reelFallIn*/reelFallOut*`
por el set del spinning. Números certificados de DH:

```ts
const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.15,      // velocidad de vuelta del rebote (px/ms)
	reelSpinSpeedBeforeBounce: 4,   // último tramo antes del rebote
	reelPaddingMultiplierNormal: 1.2,       // largo del stream (en largos de reel)
	reelPaddingMultiplierAnticipated: 1.2,  // subir ~10 si se quiere spin lento de anticipación
	reelSpinDelay: 145,             // ola columna a columna
};
export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 1.1,   // pre-spin backIn: la columna SUBE antes de largar ("Zeus")
	reelSpinSpeed: 3,        // crucero
	reelBounceSizeMulti: 0.35, // ← EL rebotesito (celdas de overshoot)
};
export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED, reelPreSpinSpeed: 5, reelSpinSpeed: 5, reelBounceSizeMulti: 0.05,
};
```

`INITIAL_BOARD` no cambia (misma convención: filas del board + 2 de padding;
`BOARD_DIMENSIONS.y = length - 2`).

### 5. `actor.ts` — preSpin con paddingBoard, CON await

```ts
await stateGameDerived.enhancedBoard.preSpin({
	paddingBoard: PADDING_REELS[stateGame.gameType],
});
```

El `void preSpin({})` sin await era el hack anti-"grilla vacía" del cascade
(feedback 15-07 de KS1) — **ya no hace falta**: la tira nunca se vacía por
diseño. El await es barato: `reel.preSpin` resuelve apenas ARRANCA el loop de
scroll (el loop sigue solo hasta `prepareToSpin`).

### 6. `bookEventHandlerMap.ts` — reveal pasa el paddingBoard

```ts
await stateGameDerived.enhancedBoard.spin({
	revealEvent: bookEvent,
	paddingBoard: PADDING_REELS[bookEvent.gameType],
});
```

### 7. Componentes — el contrato de `symbolY` CAMBIA

| | cascade | spinning |
|---|---|---|
| `reelSymbol.symbolY` | `Tween` → `.current` | **función** → `symbolY()` |
| índice | `symbolIndexOfBoard` | `symbolIndex` |
| `reelState.motion` | `'fallingOut'│'hanging'│'fallingIn'│'stopped'` | `'spinning'│'bouncing'│'stopped'` |

- Cambiar **todo** `reelSymbol.symbolY.current` → `reelSymbol.symbolY()`
  (típicamente `ReelSymbol.svelte` + capa de win-overlays en `BoardBase.svelte`).
  Los `TumbleSymbol`/`MultiplierSymbol` siguen siendo Tween — NO tocarlos.
- Guards de motion: usar `!== 'stopped'` y sobreviven al swap.
- **`BoardMask` en LOS DOS BoardContext** (estático Y animado) en
  `Board.svelte`: la tira pasa por encima/debajo del tablero y sin máscara se
  ven los símbolos del strip fuera del marco durante el spin.

### Bonus recomendado: motion blur por columna

En `BoardBase.svelte`, un `PIXI.BlurFilter` vertical por reel, montado solo con
`reel.reelState.motion !== 'stopped'` (en idle `filters = null` → costo cero).
Valores afinados de DH: `strengthY: 3`, `quality: 4` — más blur empasta el
arte. ⚠ Usar `strengthX/strengthY`, NO `blurX/blurY`: los alias viejos
disparan el deprecation warning de Pixi en consola de PROD (= rechazo).

## Lo que NO hay que tocar

- `TumbleBoard*`/`TumbleSymbol` (tumbles) — intactos.
- `createEnhanceBoard` y los packages — nada del port toca packages.
  (En utils-slots quedó una flag opt-in `symbolFallInBounceOvershoot` del
  intento fallido de emulación en cascade — inofensiva, nadie la usa.)
- `settle()` del resume/replay — misma API, funciona igual.
- `Anticipations` (`reelState.anticipating` existe en ambos engines).
- El handler del evento firma del juego (kashRampage, modificadores, etc.) —
  operan por posiciones/estados de símbolo, no por el engine.

## QA de cierre (el que pasó KRE)

1. `qa_smoke.py` con `QA_APP_PORT=<puerto>`: spins base + los 3 buys →
   esperar **N/N OK, 0 hangs, 0 timeouts, 0 console errors**.
2. Verificar visual: tira deslizándose (símbolos a mitad de celda durante el
   spin), ola izquierda→derecha, board asentado ALINEADO, nada del strip
   visible fuera del marco.
3. Turbo + bonus E2E + un resume (settle) — el spinning tiene su propio
   `interruptible` para el stop button, probar STOP a mitad de spin.

## Tuning del feel (todo en SPIN_OPTIONS, hot-reload)

- Rebote más/menos: `reelBounceSizeMulti` (0.35) y `reelBounceBackSpeed` (0.15).
- Scroll más lento/rápido: `reelSpinSpeed` (3).
- Gesto de arranque: `reelPreSpinSpeed` (1.1 → ~330ms de subida backIn).
- Ola entre columnas: `reelSpinDelay` (145).
- Anticipación dramática: `reelPaddingMultiplierAnticipated` ~10 (DH la
  apagó — a 1.2 — porque sin visual dedicado "el spin lento solo confundía").
