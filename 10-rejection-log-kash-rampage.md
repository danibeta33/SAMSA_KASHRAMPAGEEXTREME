# KASH RAMPAGE EXTREME — Log de rechazos de Stake Engine Support

Mismo formato que `02-rejection-log-kash-smash.md` y `09-rejection-log-dead-heat.md`.
Leer antes de cada re-submit: cada entrada tiene el issue LITERAL del reviewer,
la causa raíz real (no la aparente) y el fix.

---

## Tanda 1 — 16-09-2026 (6 issues)

Resumida en `CAMBIOS_FEEDBACK_16-09.md`: `rgs_url` inválido filtrando sesión por
stack trace, tile 16:9 demasiado oscuro, descripciones de modo faltantes,
disclaimer no textual, español filtrado al inglés, y términos restringidos en
modo social (panel de replay dibujado en canvas + texto horneado en la intro).

---

## Tanda 2 — 17-09-2026 (5 issues)

Ninguno era de matemática. Dos eran bugs reales de cliente que el reviewer
encontró reproduciendo event IDs concretos, y uno era un texto de reglas que
contradecía a la math.

### 2.1 — "The wide thumbnail does not meet the approval requirements"

**Estado: pendiente.** No hay nada que tocar en el repo — el tile se compone en
el **Tile Editor del ACP** a partir de dos capas subidas a mano y no viaja en el
build. Las únicas imágenes de tile en disco son las de Kash Smash
(`art-src/tile-legacy-ks1/`, cuadradas), movidas fuera de `static/` en la tanda
anterior.

Requisitos a cumplir (`01-stake-approval-checklist.md` §10): background más
brillante que el fondo de Stake (`#1a2c38` ≈ 41 de luma media), **sin texto ni
multiplicadores horneados**, foreground = personaje transparente que llena el
área de foco, gradiente discreto, título en capa aparte del ACP.

Ya había pasado lo mismo en KS1 (N2.1). Cambiar el tile **no** requiere
re-review del juego, así que puede ir por separado del resto.

### 2.2 — "The replay window must not be scrollable"

**Reviewer**: dos capturas de la card de Bet Replay, una con barra horizontal en
Desktop y otra con las DOS barras en popout.

**Causa real** (dos bugs independientes — los MISMOS que Dead Heat 1.3; KRE
había quedado con la versión pre-fix del componente):

1. **Horizontal, en TODOS los viewports**: `.replay__rows` no declaraba
   `box-sizing`, así que heredaba `content-box` y su `width: 100%` + 24px de
   padding medía 324px contra los 300px de content box de la card. Encima
   `.replay__card` declaraba `overflow-y: auto` dejando `overflow-x` en
   `visible`, y CSS computa el horizontal a `auto` → barra.
2. **Vertical**: el único breakpoint compacto era `@media (max-height: 300px)`,
   que cubre Popout S (400×225) y deja descubierto todo lo de en medio. Popout L
   acá es **800×450** y la card full-size no entraba en el `max-height: 92vh`.

**Fix** (`ReplayOverlay.svelte`):
- `box-sizing: border-box` en `.replay__rows`.
- `overflow: hidden` en la card — Stake pide literalmente que NO scrollee, más
  estricto que el "un eje como máximo" de Dead Heat.
- Se eliminaron los breakpoints. La card define una `font-size` fluida
  (`clamp(6.5px, 1.93vh, 13px)`) y **todo adentro va en `em`**: card y
  tipografía escalan como una pieza, la proporción contenido/card es constante y
  no existe viewport donde desborde. El tope de 13px deja Desktop y Mobile L
  idénticos a como estaban.
- `max-height: 92vh → 95vh`: en Popout S la font toca su piso de 6.5px y la card
  deja de achicarse con el viewport, así que el max-height pasa a ser la
  restricción que manda — con 92vh (207px) quedaba **1px** corto del contenido.

⚠ El `overflow: hidden` sólo es seguro porque el contenido entra en los 7
viewports. Si se agregan filas a la card hay que volver a medir.

### 2.3 — "The bet field in the bet bar is not properly responsive"

**Reviewer**: captura del pill con `GC 10000.00` desbordado — la "G" comida por
el botón `−` y el último `0` por el `+`.

**Causa real**: el hueco central del pill (`.bb__pill-center`) es el 44% de su
ancho (≈74px con los valores congelados del tweaker) y `.bb__pill-amount` era
`font-size: 13px` fijo + `white-space: nowrap`, sin `max-width` ni fit:
`"GC 10000.00"` mide ~110px. **Independiente de la resolución**: el stack entero
se escala con `transform: scale()`, así que la proporción entre texto y hueco
nunca mejora. Peor con `SC 1,000,000.00`.

**Fix** (`BottomBar.svelte`): fit MEDIDO, sin números mágicos. `ResizeObserver` +
`$effect` sobre el texto del monto; se mide el ancho natural del span (apagando
el transform, porque entra en `getBoundingClientRect`) contra el ancho del
hueco, y se aplica `transform: scale()` **uniforme** (no `scaleX`, que
deformaría la tipografía).

Detalles que costaron:
- **Anchos fraccionarios**: `clientWidth`/`scrollWidth` son enteros y redondean
  hacia arriba → el factor quedaba medio punto largo y el monto seguía asomando
  ~0.5px sobre el `+`. Hay que usar `getBoundingClientRect()`.
- **`flex: 0 0 auto` en el span**: por defecto es un flex item encogible, el
  navegador lo achicaba al ancho del hueco y `getBoundingClientRect` dejaba de
  reportar el ancho natural del texto.
- **Re-medir en `document.fonts.ready`**: Neue Plak Extended carga tarde y medir
  con la fuente de fallback (más angosta) dejaba el monto desbordando al swapear.
- No se pueden usar media queries acá: los tamaños vienen inline del tweaker en
  px congelados y pisan cualquier query.

Patrón hermano ya existente para los paneles Pixi: `Contenedor1.svelte` (fit
determinista por cantidad de caracteres). Acá conviene medir porque el
presupuesto de 11 chars de `Contenedor1` está calibrado contra otro ancho.

### 2.4 — "The Tumble Multiplier widget remains frozen at x1 during cascades"

**Reviewer**: *"even when the active multiplier is x2, x4, etc. The multiplier is
applied correctly in the game, but the widget must update accordingly."*

**Causa real**: todo el camino del multiplicador en el cliente estaba cableado a
**`updateGlobalMult`, un book event que esta math no emite nunca** (0
ocurrencias en `stake-math-sdk/games/kash_rampage_extreme/`). Es herencia del
template `cluster`. Lo que la math emite es **`applyTumbleMult`**, y su handler
en `bookEventHandlerMap.ts` era un **no-op explícito**.

Por eso el multiplicador se aplicaba bien —las etiquetas de cluster usan
`win.meta.globalMult`, que sí viene en el book— pero el widget `TUMBLE` del
`TopHud` y el badge in-board nunca recibían nada.

**Fix**:
- `applyTumbleMult` pasa a emitir `globalMultiplierShow` +
  `globalMultiplierUpdate { multiplier: bookEvent.tumbleMult }`. El timing ya era
  el correcto: la math emite `applyTumbleMult` **después** del `tumbleBoard` y
  **antes** del `winInfo` siguiente, o sea justo cuando caen los símbolos nuevos.
- El handler `reveal` resetea a 1. **La math resetea el tumble mult en
  silencio** (`game_executables.py:reset_tumble_mult` no emite evento), así que
  el reset visual lo tiene que reponer el cliente o el widget queda pegado en el
  escalón del spin anterior.
- `utils.ts`: `BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT` reservaba
  `updateGlobalMult` (inexistente) → un bonus **resumido** volvía a mostrar X1.
  Ahora reserva `applyTumbleMult` + `reveal`, y `createBonusSnapshot` restaura
  sólo el último `applyTumbleMult` **posterior al último `reveal`** (el escalón
  se resetea por spin).

No hizo falta tocar `GlobalMultiplier.svelte` ni `TopHud.svelte`: ambos ya
consumían `globalMultiplierUpdate`.

### 2.5 — "Event ID 225490 in Smash Mode: the RAT symbol displays 8.19 on the grid, while Game Info shows 8.2"

**Causa real**: el cliente **recalculaba** el monto de la etiqueta desde `meta`
en vez de usar el campo `win`, que es el autoritativo (el que la math suma a
`updateTumbleWin`/`setTotalWin` y el que sostiene el `payoutMultiplier`):

```ts
win: win.meta.winWithoutMult,                            // 819
result: win.meta.winWithoutMult * win.meta.globalMult,   // 819 → "8.19"
```

El origen es float: el paytable define `"H3": {5: 8.2}` y `8.2 * 100` es
`819.9999999999999` en IEEE754 — el engine serializa `win` redondeando (820) y
`meta.winWithoutMult` truncando (819).

**Alcance medido** sobre 137.693 wins de `books_smash_mode`:
- **4.69%** de los wins tienen `win != winWithoutMult × globalMult`.
- `sum(win) == winInfo.totalWin` en 102.983 de 102.998 casos ⇒ `win` es el campo
  correcto.
- Segunda clase de mismatch, independiente del float: en **wincap** la math
  clipea `win` al tope y `winWithoutMult` no → la etiqueta mostraba `4900.00 x2`
  para un win acreditado como 5000×. El mismo fix lo cubre.

⚠ **CORRECCIÓN (17-09, re-medición sobre los 4 modos publicados).** La primera
versión de esta entrada decía que `win` era divisible por `globalMult` en el
**100%** de los casos y que por eso la forma `monto ×N` cerraba siempre exacta.
**Es falso.** Barriendo los cuatro books completos (base 134.590 labels,
vault_crack 1.465.702, smash_mode 1.722.718, rage_mode 2.559.827) aparece
**exactamente 1 excepción por modo**, y es siempre la misma: la ronda de
**WINCAP**, con `win: 500000` (el tope de 5000×) y `globalMult: 12`.
500000/12 = 41666.666… no es entero.

Con el fix tal como estaba escrito, esa ronda mostraba
**`416.66666667 x12`** — `moneyWin` formatea hasta `WIN_MAX_DECIMALS = 8`—, y
además 416.67 × 12 = 5000.04 ≠ 5000.00 acreditado. O sea: el fix del 2.5
reintroducía el 2.5 justo en la ronda de max win, que es la que el reviewer
**siempre** prueba (checklist §7 pide event IDs de win cap).

La medición del 4.69% también estaba calculada sobre otro denominador: sobre el
total de labels de `smash_mode` (1.722.718) da **4.72%**.

**Fix** (`bookEventHandlerMap.ts`, handler `winInfo`): `result: win.win`, y el
monto se deriva dividiendo **sólo si la división es exacta**
(`win.win % globalMult === 0`). Si no lo es, se emite `mult: 1`, con lo que
`ClusterWinAmount` cae a `moneyWinFromBookAmount(result)` y muestra el total
exacto sin el `×N`. En una ronda capeada el `×N` no describe nada igual: el
premio dejó de ser `monto × mult` en cuanto la math lo clipeó.

**Lección**: al reemplazar un campo por otro "autoritativo", medir la propiedad
que el RENDER necesita (acá: divisibilidad), no sólo que el campo sume bien.
Y medirla sobre los 4 modos, no sobre uno.

⚠ El patrón `winWithoutMult` viene de los samples del SDK (`apps/cluster`,
`apps/scatter`). NO tocar esos packages: el fix va aislado a esta app.

### 2.6 — "Event ID 166637 in Rage Mode: a third Scatter landed after a cascade and awarded additional free spins, while Game Info states that Scatters landing during cascades do not count"

**Confirmado: manda la math, el texto estaba mal.** `gamestate.py` llama
`check_fs_condition()` **después** del loop de tumbles, tanto en base (en
`run_spin`) como en free spins (dentro del loop), y el conteo sale de
`special_syms_on_board`, que el engine refresca en cada `tumble_game_board()`.

Verificado en los books publicados:
- Event ID 166637 (= línea 166638 del `.jsonl`; el `id` del book es 0-based):
  reveal con 2 scatters → dos `tumbleBoard` agregan 1 scatter cada uno →
  `freeSpinRetrigger` con `totalFs: 15`. Exactamente el caso del reviewer.
- Sobre 15.000 books de Rage Mode: **26.6% de los retriggers** (506 de 1.903)
  llegan a 3+ recién gracias a las cascadas.
- En base el efecto cambia el TAMAÑO del premio, no el disparo: hay triggers
  donde el drop inicial trae 4 scatters y la cascada suma el 5º o 6º ⇒ 15 o 20
  FS en vez de 10.

**Decisión: se corrigió el texto, no la math.** Cambiar la math implicaba
re-simular los 4 modos (~1.5 GB de books), re-optimizar RTP y generar **event
IDs de replay nuevos**, además de bajar el RTP de los buys al quitar un 26.6% de
los retriggers. El comportamiento actual es el estándar del género.

**Fix**: seis lugares en `Game.svelte` (reglas y paytable, EN y ES) más
`KASH_RAMPAGE_EXTREME_DESCRIPTION.md`, el `README.md` de la math y un comentario
en `game_config.py` con la advertencia.

⚠ Las menciones a "initial drop" que quedan en las reglas son de **KASH
RAMPAGE**, y esas SÍ son correctas: el rampage sólo ocurre en el drop inicial y
nunca durante tumbles.

**Verificación (17-09)**: Playwright contra mock RGS —
- Replay card sin scroll en los 7 viewports × (normal, social): `scrollWidth ==
  clientWidth` y `scrollHeight == clientHeight` en los 14 casos.
- Bet field: escalera real de 35 bet levels en XEC (se muestra SC), el monto
  entra en el hueco en los 7 viewports (peor caso 0.5px de colchón).
- Replay de `smash_mode` book 16 (mismo bug del 819/820 que el 225490 del
  reviewer, y con cascadas): secuencia de multiplicador `[1,1,1,1,2,1,1,2,4,1]`
  — coincide con el book — y el cluster del RAT emite `result: 820`, ningún
  cluster con 819. Cero errores de consola.

**La matemática no cambió.** Sólo se re-sube el frontend.
