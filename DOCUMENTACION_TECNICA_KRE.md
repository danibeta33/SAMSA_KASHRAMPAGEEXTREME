# Kash Rampage Extreme — Documentación técnica integral

Alcance: motor matemático (Stake Engine Math SDK), cliente web (SvelteKit 5 + PixiJS 8), laboratorios de edición en vivo (UiLab / AnimLab) y pipeline de assets. Estado del repositorio en `main`, commit `09ee09b`.

---

## 0. Topología del proyecto

El repositorio es un monorepo con tres troncos independientes que se comunican por un contrato de datos, no por código compartido:

| Tronco | Ruta | Rol |
|---|---|---|
| Matemática | `stake-math-sdk/games/kash_rampage_extreme/` | Simula, optimiza y publica los *books* y las tablas de peso. Python. |
| Cliente | `stake-web-sdk/apps/kash-rampage-extreme/` | Reproduce los books. SvelteKit 5 + PixiJS 8. |
| SDK compartido | `stake-web-sdk/packages/*` | Paquetes reutilizables por los juegos del monorepo: `pixi-svelte`, `components-inspector`, `utils-book`, `rgs-fetcher`, `utils-xstate`, `state-shared`, `utils-slots`. |

El punto de unión es el **book**: una lista ordenada de eventos serializados que la matemática genera *offline* y que el cliente ejecuta como si fuera una partitura. El navegador nunca decide un resultado; solo lo interpreta.

```
Python (sims + optimizer)  ->  books_*.jsonl.zst + lookUpTable_*.csv  ->  RGS  ->  /wallet/play  ->  bookEvents[]  ->  cliente
```

---

## 1. Sistema matemático y probabilidades

### 1.1 Dónde vive el azar: el modelo de books precalculados

El Stake Engine no ejecuta el juego en tiempo real. El motor RGS trabaja con un modelo de **muestreo ponderado sobre un universo finito de rondas ya simuladas**:

1. `run.py` corre N simulaciones por modo de apuesta (`num_sim_args`; la corrida de producción usó 100 000 para `base` y 250 000 para cada modo de compra). Cada simulación produce un **book**: una ronda completa con todos sus eventos.
2. Los books se serializan en `library/publish_files/books_<modo>.jsonl.zst` (JSON Lines comprimido con Zstandard).
3. El optimizador (binario Rust, invocado por `OptimizationExecution`) asigna a cada book un **peso entero** y escribe `library/lookup_tables/lookUpTable_<modo>.csv`, con formato `bookId,peso,payout`. La tabla del modo base tiene 100 000 filas, una por simulación.
4. `library/publish_files/index.json` empareja cada modo con su par (books, tabla de pesos):

```json
{ "name": "rage_mode", "cost": 500.0,
  "events": "books_rage_mode.jsonl.zst",
  "weights": "lookUpTable_rage_mode_0.csv" }
```

En producción, cada `/wallet/play` consiste en generar un entero aleatorio criptográficamente seguro en el rango `[0, Σ pesos)` del modo, localizar por búsqueda binaria acumulada qué book cae en ese punto y devolver ese book. El RNG certificado, por lo tanto, no vive ni en Python ni en el navegador: vive en el RGS, y su única salida es un índice. Toda la varianza del juego está horneada en la distribución de pesos.

Consecuencias de diseño visibles en todo el código:

- El cliente es **determinista y auditable**: dado el mismo book, la presentación es siempre la misma. De ahí el endpoint de replay (`/bet/replay/{game}/{version}/{mode}/{event}`, en `stake-web-sdk/packages/rgs-requests/src/rgs-requests.ts`) y el reporte de progreso `recordBookEvent` contra `/bet/event`, que permite reanudar una ronda tras una desconexión.
- Un cambio de matemática obliga a re-simular y re-publicar; no existe ningún parámetro ajustable en caliente.
- `library/configs/config.json` firma cada artefacto con SHA-256 (`booksFile.sha256`, `tables[].sha256`), de modo que el RGS verifica integridad antes de servir.

### 1.2 Geometría, evaluación de clusters y paytable

Configuración base (`game_config.py`):

- Grilla de **6 columnas × 5 filas** (`num_reels = 6`, `num_rows = [5]*6`), 30 celdas.
- `win_type = "cluster"`: paga por **clusters de 5 o más símbolos iguales conectados ortogonalmente** (arriba, abajo, izquierda, derecha; nunca en diagonal). La búsqueda es un flood-fill sobre la grilla, implementado en el SDK como `Cluster.get_clusters(board, "wild")`; el segundo argumento indica que el símbolo `W` actúa como comodín y puede unir dos regiones separadas del mismo símbolo.
- `include_padding = True`: el board serializado lleva una fila de padding arriba y otra abajo. Todas las posiciones emitidas en eventos aplican el desplazamiento `+1` en `row` (ver `_row_offset()` en `game_events.py`). Este detalle es el origen histórico de desalineaciones entre matemática y cliente, y está documentado en el código como "contrato N3".
- Símbolos: `L1..L4` (bajos), `M1..M2` (medios), `H1..H3` (altos), `H4` (premium KASH), `W` (Bat, wild), `S` (Gold Bar, scatter). Declarados como `special_symbols = {"wild": ["W"], "scatter": ["S"], "multiplier": []}`.

La paytable se declara por **tramos de tamaño de cluster** y se expande con `_build_paytable_10c()`:

```python
"H4": {5: 13.5, 7: 24.5, 9: 95.0, 11: 340.0, 14: 1020.0, 30: 4900.0}
```

Se lee así: cluster de 5 paga 13.5×, de 6 a 7 paga 24.5×, de 8 a 9 paga 95×, de 10 a 11 paga 340×, de 12 a 14 paga 1020×, y de 15 a 30 paga 4900×. El helper fuerza cada pago a un múltiplo de 0.10× porque el RGS exige que los centavos sean divisibles por 10 (`betDenomination: 1000`, `minDenomination: 10` en `config.json`).

La curva es marcadamente **convexa**: el salto de L1 entre 5 y 30 símbolos es ×91, mientras que el de H4 es ×363. Esto concentra el valor esperado en la cola derecha y es, junto con el multiplicador de tumble, la palanca principal de volatilidad.

### 1.3 Tumble (cascada) y multiplicador acumulativo

El bucle de una jugada (`gamestate.py::_play_base_game`):

```python
self.reset_tumble_mult()                     # índice de progresión a 0
self._draw_with_rampage(force_rampage)       # drop inicial + posible RAMPAGE
self.get_clusters_update_wins()
self.emit_tumble_win_events()

while self.win_data["totalWin"] > 0 and not self.wincap_triggered:
    self.tumble_game_board()                 # explota ganadores, gravedad, rellena por arriba
    self.advance_tumble_mult()               # sube un escalón + emite applyTumbleMult
    self.get_clusters_update_wins()
    self.emit_tumble_win_events()
```

La progresión es una escalera fija, no un incremento lineal:

```python
tumble_mult_progression = [1, 2, 4, 8, 12, 20, 50, 100, 200, 500]
```

`current_tumble_mult()` satura en el último elemento (`min(idx, len-1)`), de modo que la cascada número 10 en adelante paga 500×. **El multiplicador se reinicia en cada spin**: `reset_tumble_mult()` se invoca al inicio del spin base y dentro de `update_freespin()` antes de cada free spin. KRE no tiene multiplicador persistente — el "SMASH Meter" del título anterior (Kash Smash) fue eliminado por decisión de GDD, y `maximum_board_mult = 1`.

El scoring de cada cluster (`game_calculations.py::evaluate_clusters_tumble`):

```
win_cluster = paytable[(tamaño, símbolo)] × tumble_mult × persistent_mult
```

con `persistent_mult` fijado en 1 desde `get_clusters_update_wins()`. El parámetro sigue existiendo porque el `meta` del evento debe contener las claves `globalMult` y `clusterMult` o `Cluster.record_cluster_wins` falla con `KeyError`. El `meta` que llega al cliente es:

```python
"meta": {
    "tumbleMult": tumble_mult,
    "persistentMult": persistent_mult,
    "globalMult": tumble_mult * persistent_mult,
    "clusterMult": 1,
    "winWithoutMult": sym_win,
    "overlay": {"reel": cx, "row": cy},   # centro geométrico del cluster
}
```

El cliente usa exactamente esos campos para el overlay de "pago × multiplicador = resultado" (`bookEventHandlerMap.winInfo` emitiendo `showClusterWinAmounts`).

Sobre el valor esperado: como el multiplicador escala **todos** los clusters de la cascada y las cascadas se encadenan mientras haya ganancia, la distribución de payout por ronda tiene cola pesada por construcción. Es el motor de la curtosis extrema que reporta la estadística (§1.7).

### 1.4 Wild, Scatter y Free Spins

- **Wild (`W`, el bate)**: sustituye a cualquier símbolo regular dentro de un cluster y puede fusionar dos clusters del mismo símbolo. No sustituye al scatter. Se pasa como parámetro a `Cluster.get_clusters(board, "wild")`, de modo que la conectividad se evalúa incluyendo comodines.
- **Scatter (`S`, la barra de oro)**: no forma clusters ni paga por sí mismo. Solo se cuenta en el **drop inicial**, nunca entre los símbolos que caen por tumble. Su función exclusiva es disparar los free spins.

Tabla de disparo (`freespin_triggers`):

```python
basegame: {4: 10, 5: 15, **{n: 20 for n in range(6, 31)}}
freegame: {n: 5 for n in range(3, 31)}          # retrigger: 3+ scatters -> +5
```

El rango se extiende hasta 30 (todas las celdas) a propósito: las reels cargadas de scatter (`WCAP.csv`, usadas por los books forzados a wincap) pueden producir 9 o más scatters, y un lookup por conteo exacto tiraba `KeyError` matando el hilo de simulación. Adicionalmente, `update_freespin_amount()` aplica un clamp defensivo:

```python
count = min(self.count_special_symbols("scatter"), max(triggers.keys()))
```

`anticipation_triggers` se deriva como `min(claves) - 1`: 3 en base, 2 en free spins. Es el umbral que activa la animación de anticipación de los reels 5 y 6 en el cliente.

Existe un tope duro de seguridad, `max_total_fs = 200`. Sin él, una reel con tasa alta de retrigger hace crecer `tot_fs` más rápido de lo que avanza `fs` y el bucle de free spins no termina, colgando la simulación.

### 1.5 KASH RAMPAGE: la mecánica de firma

Es una **conversión masiva de la grilla**, implementada en `game_executables.py::apply_kash_rampage`:

```python
cells = [(c, r) for c in reels for r in rows if board[c][r].name in convertible]
for c, r in cells:
    if random.random() < premium_chance:            # 0.15
        to_sym = "H4"
    else:
        to_sym = random.choices(["H1","H2","H3"], weights=[0.45,0.30,0.25])[0]
    board[c][r] = self.create_symbol(to_sym)
```

Parámetros (`game_config.py::self.rampage`):

| Parámetro | Valor | Efecto |
|---|---|---|
| `scope` | `per_cell` | Cada celda elige destino de forma independiente. La alternativa `global_symbol` unificaría toda la grilla en un solo High. |
| `convertible` | `{L1,L2,L3,L4,M1,M2}` | Wilds y scatters nunca se convierten. |
| `premium_chance` | `0.15` | Probabilidad por celda de resolver a `H4`. |
| `high_weights` | `H1 0.45 · H2 0.30 · H3 0.25` | Reparto del 85% restante. |

Tras la conversión se ejecuta `_rebuild_special_syms_cache()`, que vuelve a escanear el board: sin ello el conteo de scatters quedaría desactualizado respecto de la grilla real.

**Cómo se dispara, y por qué es distinto en base que en los modos de compra.** Este es el punto conceptual más delicado de la matemática:

- En los **modos de compra** y en los free spins naturales es un sorteo independiente por spin, únicamente en el drop inicial: `_rampage_roll(prob)` con `prob = config.rampage["prob_per_spin"][modo]`.

  ```python
  "prob_per_spin": {
      "base_freegame": 1/10,     # trigger natural desde base
      "vault_crack":   1/8,
      "smash_mode":    1/5,
      "rage_mode":     1/2.3,
  }
  ```

  Esperanza de rampages por bono de 10 spins: vault ≈ 1.25, smash ≈ 2, rage ≈ 4.35.

- En el **juego base** no hay sorteo. La frecuencia es emergente: existe una `Distribution` con `criteria="rampage"` y `conditions["force_rampage"] = True`, cuota 0.03 del pool de simulación. Esos books tienen rampage garantizado, pero **cuántos de ellos se sirven realmente lo decide el peso que el optimizador asigna a la fence `rampage`**, calibrada a `hr = 1100` (uno cada ~1100 spins).

El bloque de comentarios de `game_optimization.py` documenta tres iteraciones fallidas antes de llegar a este diseño, y conviene conservarlas porque describen fallos estructurales del optimizador:

1. Fence `rampage` sin `search_conditions`: el binario Rust la trata como catch-all posicional y degenera el perfil completo (RTP 90.6%, hit 1.6%).
2. Books de rampage enviados al catch-all `basegame`: su `av_win ≈ 68×` contamina una fence cuyo target es 2.07 y el constructor no converge (`neg_pigs=0, RTP too high`).
3. Solución adoptada: fence `rampage` **por rango de payout** `(20, 499.9)`, evaluada después de `freegame`. Absorbe el grueso de los books de rampage (mediana ≈ 23×) más las colas naturales sin scatter, dejando el catch-all `basegame` homogéneo en 0.1–20×.

Hay además una trampa nombrada explícitamente en el código (`game_config.py`, nota "N3.7"): **dos `Distribution` no pueden compartir el mismo `criteria`**. El SDK resuelve por nombre y siempre matchea la primera, de modo que una re-simulación rompería la matemática en silencio. Una iteración del 29-07 etiquetó la distribución de rampage como `"basegame"` y el 100% de los books base salieron con rampage.

### 1.6 Orden de eventos: el contrato N3

`_draw_with_rampage()` fija un orden que el cliente asume:

```python
self.draw_board(emit_event=False)                     # 1. sortear la grilla
conversions, gs = self.apply_kash_rampage(...)        # 2. MUTAR el board
reveal_event(self)                                    # 3. serializar el reveal YA CONVERTIDO
kash_rampage_event(self, conversions, gs)             # 4. emitir el detalle de conversiones
```

Es decir: **el `reveal` que recibe el cliente contiene la grilla final**, y el evento `kashRampage` posterior es metadata de presentación (`from`, `to`, `premium`, ordenada por `reel → row` para una ola determinista de izquierda a derecha). Esto garantiza que el board serializado y el board evaluado sean el mismo objeto, pero crea un problema de lectura visual que el cliente resuelve con un lookahead (§4.5).

Catálogo completo de eventos que emite esta matemática y consume el cliente (`src/game/typesBookEvent.ts` frente a `game_events.py` y `src/events/events.py` del SDK):

| Evento | Payload relevante | Consumidor en cliente |
|---|---|---|
| `reveal` | `board`, `paddingPositions`, `anticipation`, `gameType` | `enhancedBoard.spin()` |
| `winInfo` | `wins[]` con `positions` y `meta` | animación de cluster y overlays de monto |
| `updateTumbleWin` | `amount` acumulado del spin | contador de tumble |
| `applyTumbleMult` | `tumbleMult` | badge de multiplicador (handler no-op actualmente) |
| `tumbleBoard` | `explodingSymbols`, `newSymbols` | coreografía de explosión y caída |
| `setWin` / `setTotalWin` | `amount`, `winLevel` | celebración por tier |
| `freeSpinTrigger` / `freeSpinRetrigger` | `totalFs`, `positions` | intro y transición de bono |
| `updateFreeSpin` | `amount`, `total` | contador de giros |
| `freeSpinEnd` | `amount`, `winLevel` | outro del bono |
| `kashRampage` | `conversions[]`, `globalSymbol` | los cinco beats de la mecánica de firma |
| `wincap` | — | marcador informativo de cap |
| `finalWin` | `amount` | limpieza de HUD |

### 1.7 RTP, hit frequency y volatilidad: cómo se construyen numéricamente

El RTP **no** emerge de las reels: emerge del reparto de pesos que hace el optimizador. `game_optimization.py` declara, por modo, un conjunto de fences disjuntas con tres parámetros: rango de payout buscado, RTP aportado y hit rate (rondas por acierto). La restricción dura es que **la suma de RTP de las fences debe igualar `bet_mode.rtp` (0.965)**, o `verify_optimization_input` aborta.

**Modo base** (perfil Extreme):

| Fence | Rango de búsqueda | RTP | `hr` | `av_win` implícito |
|---|---|---|---|---|
| `wincap` | payout = 5000× | 0.11 | — | 5000× |
| `big` | 500 – 4999.9× | 0.11 | 10 000 | 1100× |
| `freegame` | `{"symbol": "scatter"}` | 0.26 | 200 | 52× |
| `rampage` | 20 – 499.9× | 0.06 | 1100 | 66× |
| `0` | payout = 0 | 0 | — | 0 |
| `basegame` | catch-all | 0.425 | 4.676 | 1.99× |

La identidad que gobierna cada fila es `av_win = rtp × cost × hr`. Para `basegame`: `0.425 × 1 × 4.676 = 1.99`. Para `big`: `0.11 × 1 × 10000 = 1100`, que debe caer **dentro** del rango de búsqueda declarado; si no, el pool de books no puede alcanzar el promedio pedido y el optimizador converge por debajo del objetivo en silencio. Esa fue exactamente la causa raíz de dos iteraciones fallidas de `rage_mode` (se pedía un `av_win` de 4037× sobre un pool con mediana 2500×).

**Hit frequency** del modo base como suma de las fences con acierto:

```
HF = 1/4.676 + 1/200 + 1/1100 + 1/10000 + P(wincap)
   ≈ 0.2139 + 0.0050 + 0.00091 + 0.0001 ≈ 0.2200
```

es decir **22%**, o una ronda pagadora cada ~4.55. La medición real post-optimización (`library/stats_summary.json`) confirma `non_zero_hr = 4.548` y `prob_nil = 0.78`.

**Modos de compra** — mismo esquema, escalonado deliberadamente por precio:

| Modo | Costo | Fence `big` | `hr` de `big` | Fence `mid` | Fence `freegame` | Volatilidad objetivo |
|---|---|---|---|---|---|---|
| `vault_crack` | 100× | 1500–4999.9×, rtp 0.020 | 1/1200 | 100–1999.9×, rtp 0.671, 34% | 0–99.9×, rtp 0.264, 66% | Medium |
| `smash_mode` | 250× | 2000–4999.9×, rtp 0.056 | 1/200 | 250–1999.9×, rtp 0.6482, 33% | 0–249.9×, rtp 0.2508, 66% | High |
| `rage_mode` | 500× | 2000–4999.9×, rtp 0.059 | 1/95 | 500–1999.9×, rtp 0.644, 33% | 0–499.9×, rtp 0.251, 66% | Extreme |

El `plb` (probability of less than bet) queda anclado en `1/1.51515 = 0.66` para los tres modos de compra: **dos de cada tres compras devuelven menos que el costo**. La diferencia de volatilidad entre modos no está en esa probabilidad sino en la frecuencia y el tamaño de la cola: `big` pasa de 1/1200 en vault a 1/95 en rage, con un `av_win` prácticamente idéntico de ~2800×.

**Métricas medidas** (`library/stats_summary.json`, corrida de producción del 26-08):

| Modo | RTP | Desviación estándar | m2m | prob_nil | prob_less_bet | Asimetría |
|---|---|---|---|---|---|---|
| `base` | 0.965 | 26.699 | 0 | 0.78 | 0.963 | 154.2 |
| `vault_crack` | 0.965 | 139.461 | 1.585 | 0 | 0.66 | 1.6e7 |
| `smash_mode` | 0.965 | 359.202 | 1.694 | 0 | 0.66 | 7.8e7 |
| `rage_mode` | **0.962** | 582.789 | 1.253 | 0 | 0.658 | 3.0e8 |

Contra la escala de volatilidad del ACP de Stake citada en el propio código (LOW = 9.76, MEDIUM = 14.56, EXTREME = 27.14, en desviación estándar), `base` con σ = 26.70 queda **inmediatamente por debajo del umbral Extreme**, cuando el objetivo declarado en los comentarios es `std >= 27`. Es un dato a considerar antes del envío.

`rage_mode` está en **96.2%, tres décimas por debajo del objetivo de 96.5%**. El historial de iteraciones documentado en `run.py` y `game_optimization.py` describe la investigación: no era falta de pool (se corrió con 250k sims), sino que las fences entregaban ~99.7% del `av_win` implícito de forma estructural. Las contramedidas aplicadas fueron subir `prob_per_spin` de rage de 1/2.5 a 1/2.3 (enriquece las bandas altas ~9%), bajar el `av_win` de la fence `big` de 4037× a 2800×, reducir el RTP de la fence `wincap` de 0.015 a 0.011 y alargar las ventanas de score (`test_spins=[50,100,200]`, `sim_trials=10000` en `rage_params`). El resultado publicado sigue siendo 96.1993%, por lo que **el modo rage está pendiente de cierre**.

Un detalle de calibración digno de mención es `min_m2m = 1.0` (iteración 4). El catch-all `basegame` de KRE quedó comprimido en 0–20× porque las fences `big`, `rampage` y `freegame` se llevan todas las colas; con `min_m2m = 4` el constructor no podía armar pigs bajo el objetivo. El m2m del modo lo aportan las fences de cola, no el catch-all.

### 1.8 Repetición y aceptación de books

`game_override.py::check_repeat` define cuándo una simulación se descarta y se vuelve a tirar:

```python
if win_criteria is not None and self.final_win != win_criteria:   repeat   # p.ej. wincap exacto
if conditions["force_freegame"] and not self.triggered_freegame:  repeat
if running_bet_win == 0 and self.criteria != "0":                 repeat   # solo la fence "0" acepta ceros
win_range = conditions.get("force_win_range")
if win_range and not (win_range[0] <= final_win < win_range[1]+1): repeat
```

`force_win_range` es una extensión propia del proyecto: `win_criteria` nativo solo soporta igualdad exacta (sirve para el wincap pero no para poblar una banda). Se lee de las *conditions* y no del nombre del criterio, precisamente para que esos books queden etiquetados con una fence existente y no se solapen dos fences sobre el mismo pool.

### 1.9 Modos de apuesta y wincap

```python
buy_modes = {
    "vault_crack": {"cost": 100.0, "spins": 10},
    "smash_mode":  {"cost": 250.0, "spins": 10},
    "rage_mode":   {"cost": 500.0, "spins": 10},
}
wincap = 5000.0   # en los cuatro modos
```

Los modos de compra no atraviesan el juego base: `_play_buy_bonus()` levanta el estado de bono directamente (`triggered_freegame = True`, `gametype = freegame_type`, `tot_fs = 10`) y emite un `fs_trigger_event` sintético con `basegame_trigger=True`. Los identificadores internos (`vault_crack`, `smash_mode`, `rage_mode`) se heredaron deliberadamente del título anterior; solo cambian los títulos de presentación.

El wincap de 5000× se fuerza mediante reels cargadas de scatter (`WCAP.csv`) con pesos crecientes por modo: 5 en base, 8 en vault, 10 en smash, 12 en rage. En el cliente, `winRatio.ts::isWinCap` verifica que la etiqueta "MAX WIN" solo aparezca cuando el payout alcanza realmente el cap, con un margen de una unidad de book por redondeo — una corrección explícita de revisión, porque mostrar "MAX WIN" en una ganancia grande no-cap es engañoso.

---

## 2. Diseño y arquitectura de la interfaz de usuario (Svelte 5)

### 2.1 Composición general: dos capas superpuestas

El juego no es una sola escena. Son **dos capas de render que comparten un solo modelo reactivo**:

1. **Canvas PixiJS** (fondo, personaje, marco, grilla, celebraciones, transiciones), montado por `<App>` de `pixi-svelte` dentro de `src/components/Game.svelte`.
2. **Overlays HTML** (TopBar, BottomBar, modales de compra, autoplay, ajustes, menú, replay), montados como hermanos en `src/routes/+layout.svelte`.

La UI Pixi que trae el SDK por defecto está deliberadamente desmontada: el HUD de este juego es HTML, con los assets del pack de arte, y consume los mismos broadcasts (`uiShow` / `uiHide`) que consumiría la UI Pixi. Esto permite tipografía nativa, accesibilidad de foco y CSS responsive sin reimplementarlos sobre el canvas.

Jerarquía de `+layout.svelte`:

```
GlobalStyle
  Authenticate            (autenticación contra el RGS)
    LoadI18n              (mensajes por idioma, Lingui)
      Game                (todo el canvas Pixi)
GameLoader                (loader brandeado)
TopBar / BottomBar        (HUD HTML)
ReplayOverlay / LoadingOverlay / BuyBonusOverlay / BuyConfirmOverlay /
AutoSpinOverlay / SettingsOverlay / MenuOverlay / BetMenuOverlay
UiLab / AnimLab           (solo en DEV)
```

### 2.2 Runas de Svelte 5 como sustrato de estado

Todo el estado del juego son objetos `$state` exportados desde módulos `*.svelte.ts`, sin store ni contexto propietario:

| Módulo | Contenido |
|---|---|
| `game/stateGame.svelte.ts` | `board` (6 reels), `gameType`, `tumbleBoardAdding/Base`, `scatterCounter` |
| `game/stateTweak.svelte.ts` | layout por bucket de resolución |
| `game/stateUiTweak.svelte.ts` | geometría congelada del HUD y del marco |
| `game/boardShake.svelte.ts` | desplazamiento `x/y` del shake |
| `game/stateRampage.svelte.ts` | símbolos ocultos durante el batazo |
| `game/stateWinHighlight.svelte.ts` | atenuado global del board |
| `game/celebration.svelte.ts` | contador de celebraciones activas |
| `packages/state-shared` | `stateBet`, `stateUi`, `stateModal`, `stateSound`, `stateConfig`, `stateUrlDerived` |

El patrón dominante es **estado exportado + `$derived` en el componente que lo dibuja**. Ejemplo canónico en `Game.svelte`:

```svelte
{@const cs = context.stateLayoutDerived.canvasSizes()}
{@const bt = boardTransform(cs.width, cs.height, context.stateLayoutDerived.mainLayout().scale)}
<Container
  x={cs.width * bt.bx + boardShake.x}
  y={cs.height * bt.by + boardShake.y}
  scale={{ x: bt.s * stateTweak.boardStretchX, y: bt.s * stateTweak.boardStretchY }}
  pivot={{ x: cs.width * 0.5, y: cs.height * 0.5 }}
>
```

Cualquier escritura sobre `boardShake.x` o `stateTweak.boardH` repropaga hasta el nodo Pixi sin intervención manual. Esa propiedad es la que hacen explotar los laboratorios (§3).

Un detalle no obvio y documentado en `packages/components-inspector/src/inspectorBridge.svelte.ts`: **los campos reactivos de una clase deben ser privados con getters públicos**. El `tsconfig` del SDK usa `target: es6`, así que esbuild baja los campos públicos al constructor (`this.x = $state(...)`) y Svelte rechaza esa posición con `state_invalid_placement`. Los campos privados (`#connected = $state(false)`) se preservan.

### 2.3 Contexto de aplicación e inyección

`src/game/context.ts` centraliza la composición de contextos del SDK:

```ts
export const setContext = () => {
  setContextEventEmitter<EmitterEvent>({ eventEmitter });
  setContextXstate({ stateXstate, stateXstateDerived });
  setContextLayout({ stateLayout, stateLayoutDerived });
  setContextApp({ stateApp });
};

export const getContext = () => ({
  ...getContextEventEmitter<EmitterEvent>(),
  ...getContextLayout(),
  ...getContextXstate(),
  ...getContextApp(),
  stateGame, stateGameDerived, i18nDerived,
});
```

Todo componente hace `const context = getContext()` y accede a emisor de eventos, layout, máquina de estados, aplicación Pixi y estado de juego por una sola puerta.

### 2.4 El HUD: TopBar y BottomBar

`BottomBar.svelte` replica la semántica de los botones Pixi del SDK sobre HTML:

- **SPIN/STOP**: si la máquina está en `idle`, emite `bet`; si no, emite `stopButtonClick`.
- **BET −/+**: salta por `stateConfig.betAmountOptions`.
- **TURBO**: `updateIsTurbo(!isTurbo, { persistent: true })`.
- **AUTO**: si hay contador activo lo pone en cero, si no abre el modal de autoplay. Mantener presionado SPIN abre el mismo modal.
- **Barra espaciadora**: `EnableHotkey` (Pixi) emite `hotKey`; el consumidor original era el `ButtonBet` del SDK, que aquí está desmontado, de modo que `BottomBar` lo reimplementa con la misma semántica. Es un requisito de aprobación del ACP.

**Flags jurisdiccionales.** El `authenticate` del RGS devuelve `config.jurisdiction`, y la UI custom debe consumirlo porque quien lo hacía era la UI Pixi reemplazada:

```ts
const turboAllowed    = $derived(!stateConfig.jurisdiction?.disabledTurbo);
const autoAllowed     = $derived(!stateConfig.jurisdiction?.disabledAutoplay);
const buyAllowed      = $derived(!stateConfig.jurisdiction?.disabledBuyFeature);
const spacebarAllowed = $derived(!stateConfig.jurisdiction?.disabledSpacebar);
const slamstopAllowed = $derived(!stateConfig.jurisdiction?.disabledSlamstop);
```

Y, como el turbo persiste en `localStorage`, hay un `$effect` que lo apaga si la jurisdicción lo prohíbe, aunque el botón esté oculto.

También se contemplan dos modos operativos especiales: **replay** (sin controles de apuesta; los pone `ReplayOverlay`) y **social** (`stake.us`), donde `game/social.ts` hace intercambio de términos sobre todo el texto HTML y `BottomBar` cubre el asset `bet_pill.png` con un chip "PLAY", porque los intercambios de texto no alcanzan a los bitmaps.

### 2.5 Adaptabilidad: el sistema de buckets de resolución

Este es el subsistema de UI más específico del proyecto. En lugar de un único conjunto de reglas responsive, el juego define **siete buckets de viewport alineados uno a uno con el selector de tamaños del ACP de Stake**, y cada bucket tiene su propio juego de valores de layout, ajustado a mano y congelado en código.

`game/stateTweak.svelte.ts`:

```ts
export const RES_BUCKETS = [
  { key: 'portrait_s', label: 'Mobile S (<350 ancho)', match: (w,h) => h > w && w < 350 },
  { key: 'portrait_m', label: 'Mobile M (<400 ancho)', match: (w,h) => h > w && w < 400 },
  { key: 'portrait_l', label: 'Mobile L / portrait',   match: (w,h) => h > w },
  { key: 'popout_s',   label: 'Popout S (<600 ancho)', match: (w)   => w < 600 },
  { key: 'popout_l',   label: 'Popout L (<900 ancho)', match: (w)   => w < 900 },
  { key: 'laptop',     label: 'Laptop (<1100 ancho)',  match: (w)   => w < 1100 },
  { key: 'desktop',    label: 'Desktop (≥1100)',       match: ()    => true },
];
export const bucketFor = (w, h) => RES_BUCKETS.find(b => b.match(w, h))!.key;
```

Gana el primer match; el orden importa (los tres portrait antes que los popout). La resolución de valores es una **cascada de tres niveles**:

```ts
Object.assign(stateTweak,
  DEFAULTS,                       // 1. base común
  PER_BUCKET_SEED[bucket] ?? {},  // 2. valores aprobados y congelados en código
  overrides[bucket] ?? {});       // 3. override del usuario en localStorage
```

`PER_BUCKET_SEED` contiene los JSON aprobados desde el laboratorio, con la fecha y el viewport exacto en el comentario de cada entrada. Por ejemplo, para Desktop 1200×675:

```ts
desktop: { freeScale: 1, boardH: 0.912, boardX: 0.525, boardY: 0.542,
           stackScale: 0.86, stackRight: 37, stackBottom: 2,
           iconScale: 0.805, iconX: 22, iconY: 18,
           kashH: 0.68, kashX: 0.108, kashY: 0.566 }
```

Solo trece claves (`TWEAKABLE_KEYS`) son editables y persistibles; el resto está congelado. La persistencia usa la clave `kash_tweak_v14` (definida en `labMeta.ts`, no en el módulo de estado): subir el número de versión invalida los overrides guardados con buckets antiguos.

El cambio de bucket es automático:

```ts
const onResize = () => {
  labState.vw = window.innerWidth; labState.vh = window.innerHeight;
  const next = bucketFor(window.innerWidth, window.innerHeight);
  if (next !== labState.bucket) applyBucket(next);
};
```

### 2.6 Geometría compartida entre HUD HTML y board Pixi

El problema original, reportado en la revisión del ACP: el board escala con la ventana pero el HUD se limita a su tamaño de diseño, de modo que en ventanas más altas que 675 px el marco crecía hasta meterse debajo del stack de BET/SPIN, y en otras la grilla se metía bajo el TopBar.

`game/hudLayout.ts` es la **única fuente de verdad** de las zonas reservadas, importada tanto por `BottomBar` como por `Game.svelte`:

```ts
export const uiScaleFor = (w, h) =>
  isPortraitViewport(w, h)
    ? Math.min(1, Math.max(0.7,  w / 425))
    : Math.min(1, Math.max(0.32, Math.min(w / 1200, h / 675)));

export const topBarHeight = (w, h) => h <= 300 ? 24 : w <= 700 ? 40 : 56;

export const stackRightReserve = (uiScale) =>
  (stateUiTweak.stackW * stateUiTweak.stackScale + stateUiTweak.stackRight) * uiScale + 8;
```

`boardTransform(csW, csH, mScale)` devuelve `{ s, bx, by, landscapeDecor, portrait, topSafe, uiScale }` y aplica los topes anti-solape. En landscape:

```ts
const sDesign  = stateTweak.boardH / BOARD_BASE_H;             // escala de diseño
const sMaxRight = (csW * (1 - bx) - stackRightReserve(uiScale))
                / (frameHalfRight * mScale * stateTweak.boardStretchX);
const sMaxTop   = (csH * by - tb - 6)
                / (frameHalfTop   * mScale * stateTweak.boardStretchY);
return { s: free ? sDesign : Math.min(sDesign, sMaxRight, sMaxTop), ... };
```

En portrait el criterio cambia: manda el ancho (`sMaxWidth` con 4 px de margen lateral) y solo si no entra intervienen los topes contra TopBar y contra el stack inferior centrado.

`BOARD_BASE_H = 0.62` es el ancla del acoplamiento proporcional `boardBaseScale = boardH / BOARD_BASE_H`. El comentario en el código advierte explícitamente que **no debe re-apuntarse al valor visual por defecto**: es una constante de referencia, no un ajuste estético.

`FRAME_HOLE_OFFSET_X = -0.005` y `FRAME_HOLE_OFFSET_Y = 0.028` corrigen que el hueco transparente del PNG del marco (2000×1694) no está centrado sobre el PNG. Con ellos, `boardX/boardY` mueven marco y grilla juntos manteniendo la alineación hueco-reels.

**El toggle `freeScale`.** Por pedido explícito de dirección artística existe un modo LIBRE por bucket que apaga todos los topes anti-solape: `s = sDesign` sin `Math.min`. Los sliders mandan tal cual, aunque las cosas se superpongan. Los seis buckets aprobados lo tienen en 1.

### 2.7 Flujo de estados: la máquina XState

El ciclo de vida de una apuesta lo gobierna una jerarquía de máquinas XState (`packages/utils-xstate`), instanciada en `src/game/actor.ts`:

```ts
const primaryMachines = createPrimaryMachines<Bet>({
  onResumeGameActive:   (bet) => convertTorResumableBet(bet),
  onResumeGameInactive: (bet) => { /* settle del último reveal */ },
  onNewGameStart:       async () => { await enhancedBoard.preSpin({ paddingBoard: PADDING_REELS[gameType] }); },
  onNewGameError:       () => enhancedBoard.settle(),
  onPlayGame:           async (bet) => await playBet(bet),
  checkIsBonusGame:     (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
});
```

El flujo completo de una ronda:

1. **`onNewGameStart`** — arranca el pre-spin visual (la grilla empieza a deslizarse) antes de que exista respuesta del servidor. Se omite si hay turbo con autoplay o si se está manteniendo la barra espaciadora.
2. **`handleRequestBet`** — `POST /wallet/play` con `{ mode, currency, sessionID, amount × API_AMOUNT_MULTIPLIER }`. Si falla o el `state` viene vacío, se cancela el autoplay, se abre el modal de error y se lanza la excepción.
3. **Clasificación de la apuesta** (`getBetType`) en `noWin`, `singleRoundWin` o `bonusWin`, lo que determina cuándo se llama a `/wallet/end-round` y cuándo se refresca el balance. En un bono, el `end-round` se difiere hasta el final de la presentación.
4. **`onPlayGame` → `playBet`** — reproduce los eventos del book:

```ts
export const playBet = async (bet: Bet) => {
  stateBet.winBookEventAmount = 0;
  await playBookEvents(bet.state);
  eventEmitter.broadcast({ type: 'stopButtonEnable' });
};
```

`playBookEvents` (`packages/utils-book/src/createPlayBookUtils.ts`) recorre los eventos **secuencialmente con `await`**, lo que convierte al array de eventos en un guion temporal: cada handler controla su propia duración y el siguiente evento no empieza hasta que el anterior resuelve. Es el mecanismo que sincroniza toda la presentación.

**Reanudación de ronda.** Si el jugador recarga en medio de un bono, `convertTorResumableBet` reconstruye el estado: filtra los eventos anteriores al índice reportado, se queda solo con los tipos que definen estado (`updateGlobalMult`, `freeSpinTrigger`, `updateFreeSpin`, `setTotalWin`), los empaqueta en un evento sintético `createBonusSnapshot` y antepone ese evento al resto del book. El handler de `createBonusSnapshot` reproduce el último de cada tipo para restaurar contadores y multiplicadores sin volver a mostrar toda la animación.

### 2.8 Estados visibles de la interfaz

| Estado | Disparador | Comportamiento |
|---|---|---|
| Carga | montaje | `GameLoader` con GIF brandeado; `LoadingOverlay` HTML tapa el canvas; el "click to continue" espera a que estén listos los assets Pixi **y** los assets HTML (`htmlAssets.loaded`) |
| Juego base | `showLoadingScreen = false` | board, HUD y fondo activos; `<Sound />` se monta recién tras el clic, por la política de autoplay de audio de Chrome |
| Presentación de cluster | `winInfo` | atenuado global (`stateWinHighlight`), cascada de brillo y boing, overlays de monto |
| Tumble | `tumbleBoard` | se oculta el board del engine, se muestra `TumbleBoard`, explosión, deslizamiento, settle y vuelta al board |
| Celebración | `setWin` | `Win.svelte` con tier `small/big/mega/max`; el swing de Kash sincroniza con el impacto |
| Bono | `freeSpinTrigger` | `uiHide` → transición → intro → cambio de música → contador → `uiShow` |
| Fin de bono | `freeSpinEnd` | outro con conteo, transición de salida, restauración de HUD |

El **piso de celebración** es una decisión de diseño explícita en `bookEventHandlerMap.setWin`:

```ts
if (winToRoundCostRatio(bookEvent.amount) < 1) return;
```

Por debajo de 1× el costo de la ronda (pérdida neta) no hay overlay. `winRatio.ts` documenta las dos escalas que se mezclaban y provocaban errores: el `amount` de un book event viene en unidades de book (`BOOK_AMOUNT_MULTIPLIER`, donde 100 = 1× la apuesta), mientras que `betCost()` está en dólares y además solo multiplica el `costMultiplier` de modos de tipo `activate`, ignorando los de tipo `buy`.

---

## 3. Los laboratorios (UiLab y AnimLab) y la depuración

### 3.1 El problema y la inversión de dependencias

En su primera versión, los paneles de laboratorio importaban directamente el catálogo del juego (`import { LAB_SLIDERS } from '../game/labMeta'`). Eso los ataba a Kash Rampage Extreme: no podían reutilizarse en los otros seis juegos del monorepo y cada cambio del juego rompía el paquete compartido.

La refactorización invierte la dependencia. El paquete `components-inspector` **no sabe nada de ningún juego**: no conoce `boardH`, ni `kashX`, ni `anim_kash_swing`, ni la clave `kash_tweak_v14`. Solo mantiene catálogos registrados en tiempo de ejecución y delega toda la semántica en un "host" que el juego inyecta.

```
juego  ──registra──▶  InspectorRegistry  ◀──lee y renderiza──  UiLab / AnimLab / InspectorRemotePanel
```

Los paneles son consumidores pasivos del registro; el juego es el único que aporta etiquetas, rangos, callbacks y clave de persistencia.

### 3.2 `InspectorRegistry.svelte.ts`: el núcleo

Es una clase con **estado reactivo privado**:

```ts
export class InspectorRegistry {
  #host       = $state<InspectorHost | null>(null);
  #categories = $state<InspectorCategory[]>([]);
  #controls   = $state<InspectorControl[]>([]);
  #actions    = $state<InspectorAction[]>([]);
  #running    = $state<string | null>(null);
  #seq = 0;
}
```

El paquete exporta dos instancias por defecto, para que un juego pueda tener varios laboratorios independientes:

```ts
export const inspector     = new InspectorRegistry('layout');  // UiLab, tecla T
export const animInspector = new InspectorRegistry('anim');    // AnimLab, tecla A
```

**Catálogo registrable.** Cuatro primitivas:

| Primitiva | Método | Configuración |
|---|---|---|
| Categoría | `registerCategory(id, {label, order})` | agrupa controles y acciones |
| Slider | `registerSlider(id, {label, min, max, step, decimals, category, order})` | control continuo |
| Toggle | `registerToggle(id, {label, on, off, category, order})` | binario, pero almacenado como número |
| Acción | `registerAction(id, {label, callback, variant, row, exclusive, title})` | botón ejecutable |

Los registros son idempotentes: si el `id` ya existe, se hace `Object.assign` sobre la entrada existente en lugar de duplicarla. Esto hace que el HMR de Vite no acumule controles fantasma.

**La vista agrupada** es lo único que iteran los paneles:

```ts
get groups(): InspectorGroup[] {
  return this.categories
    .map((category) => {
      const actions = this.#actions.filter(a => a.category === category.id)
                                   .sort((a,b) => a.order - b.order);
      return { category,
               controls: this.#controls.filter(c => c.category === category.id)
                                       .sort((a,b) => a.order - b.order),
               actions,
               actionRows: toRows(actions) };
    })
    .filter(g => g.controls.length > 0 || g.actions.length > 0);
}
```

`toRows()` agrupa acciones consecutivas que comparten la propiedad `row` en una fila horizontal — así los once botones de ajuste fino del swing (`x-5, x-1, x+1, x+5`, etc.) se dibujan en tres filas compactas en lugar de once botones apilados.

### 3.3 El contrato `InspectorHost`

Es la interfaz que el juego implementa para que el inspector pueda operar sobre su estado sin conocerlo:

```ts
export type InspectorHost = {
  title?: string;
  storageKey?: string;                                  // la aporta el juego
  note?: string;
  read?:   (id: string) => number;
  write?:  (id: string, value: number) => void;         // escritura EN VIVO, sin persistir
  commit?: () => void;                                  // persistir el estado actual
  reset?:  () => void;                                  // volver al default del host
  status?: () => InspectorStatus;                       // encabezado (bucket + viewport)
  snapshot?: () => Record<string, unknown>;             // objeto plano para COPY VALUES
  diagnostics?: () => InspectorDiagnostics | null;      // lectura en vivo, polleada por rAF
};
```

Cada método corresponde a una capacidad que el panel necesita pero no puede implementar genéricamente. Nótese la separación deliberada entre `write` (vivo) y `commit` (persistente): es la que evita tirar frames durante el arrastre de un slider.

Las **guías de diagnóstico** merecen mención aparte:

```ts
export type InspectorGuide = {
  id: string; kind: 'h' | 'v' | 'box';
  x?: number; y?: number; w?: number; h?: number; color?: string;
};
```

Se declaran en **píxeles de pantalla**, no de canvas. La conversión canvas→pantalla la hace el juego, porque es el único que conoce su proyección. El panel solo posiciona `div`s absolutos.

### 3.4 La inyección del juego: `labInspector.svelte.ts` y `labMeta.ts`

`labMeta.ts` es un **manifiesto de datos puro, sin imports en tiempo de ejecución** (a propósito: `stateTweak.svelte.ts` lee de ahí la clave de persistencia y no puede haber ciclo). Contiene `LAB_STORAGE_KEY`, `LAB_TITLE`, `LAB_NOTE`, `LAB_CATEGORIES`, `LAB_TOGGLES` y `LAB_SLIDERS`:

```ts
export const LAB_SLIDERS = [
  { id: 'boardH',     label: 'Grilla',      min: 0.6,  max: 1.6, step: 0.002, category: 'board', order: 10 },
  { id: 'boardX',     label: 'Grilla X',    min: 0.15, max: 0.85, step: 0.001, category: 'board', order: 11 },
  { id: 'stackScale', label: 'Botonera',    min: 0.5,  max: 1.5, step: 0.005, category: 'hud',   order: 20 },
  { id: 'kashH',      label: 'Kash size',   min: 0.3,  max: 1.2, step: 0.002, category: 'kash',  order: 30 },
  // ...
];
```

`labInspector.svelte.ts` es el **único punto donde el laboratorio genérico conoce al juego**. Se invoca una sola vez desde `+layout.svelte`, solo en DEV:

```ts
inspector.configure({
  title: LAB_TITLE,
  storageKey: LAB_STORAGE_KEY,
  note: LAB_NOTE,
  read:  (id) => tweak[id],
  write: (id, value) => { tweak[id] = value; syncUi(); },
  commit: saveTweak,
  reset:  resetTweak,
  status: () => ({ label: bucketLabel(), detail: `${labState.vw}×${labState.vh}` }),
  snapshot: () => ({ bucket: labState.bucket, viewport: `${labState.vw}x${labState.vh}`,
                     ...Object.fromEntries([...LAB_TOGGLES, ...LAB_SLIDERS].map(c => [c.id, tweak[c.id]])) }),
});

for (const { id, ...config } of LAB_CATEGORIES) inspector.registerCategory(id, config);
for (const { id, ...config } of LAB_TOGGLES)    inspector.registerToggle(id, config);
for (const { id, ...config } of LAB_SLIDERS)    inspector.registerSlider(id, config);
```

El puente clave está en la línea de `write`: el inspector direcciona por `id` (string), mientras que `stateTweak` es un objeto tipado. La conversión es un cast único:

```ts
const tweak = stateTweak as unknown as Record<string, number>;
```

### 3.5 Reactividad de los sliders: el camino completo de un arrastre

Este es el mecanismo central del laboratorio. Trazado extremo a extremo:

1. **Evento DOM.** `UiLab.svelte` dibuja un `<input type="range">` cuyo `value` se lee del registro:

   ```svelte
   <input type="range" min={control.min} max={control.max} step={control.step}
          value={registry.read(control.id)}
          oninput={(e) => onSlide(control.id, e)}
          onchange={() => registry.commit()} />
   ```

2. **`input` → escritura viva.** `onSlide` llama a `registry.write(id, parseFloat(value))`, que delega en `host.write`, que hace `tweak[id] = value` sobre el proxy `$state` y ejecuta `syncUi()`.

3. **`syncUi()` propaga a la otra mitad del layout.** El HUD HTML (BottomBar) no lee `stateTweak` sino `stateUiTweak`; la función copia las seis claves compartidas:

   ```ts
   export const syncUi = () => {
     stateUiTweak.stackScale  = stateTweak.stackScale;
     stateUiTweak.stackRight  = stateTweak.stackRight;
     stateUiTweak.stackBottom = stateTweak.stackBottom;
     stateUiTweak.iconScale   = stateTweak.iconScale;
     stateUiTweak.iconX       = stateTweak.iconX;
     stateUiTweak.iconY       = stateTweak.iconY;
   };
   ```

4. **Propagación reactiva automática.** `stateTweak` y `stateUiTweak` son proxies `$state`. Cualquier `$derived` que los lea se recalcula: `boardTransform()` en `Game.svelte` (posición, escala y topes del board), `kash` en `Background.svelte` (alto, X e Y del personaje), y los cálculos de escala en `BottomBar.svelte`. Los `Container` de Pixi reciben las nuevas props y `propsSyncEffect` las escribe sobre el nodo. **No hay ningún paso de "aplicar cambios"**: el arrastre del slider mueve el sprite en el mismo frame.

5. **`change` → persistencia.** Solo al soltar el slider se llama a `registry.commit()` → `saveTweak()`, que serializa a `localStorage`. El comentario en `UiLab.svelte` explica la razón:

   > `'input'` solo actualiza el preview en vivo; persistir a localStorage por cada tick de arrastre (JSON + I/O síncrono) tira frames justo cuando se está evaluando el layout.

6. **Paso fino.** Los botones `−` / `+` llaman a `registry.step(id, dir, e.shiftKey ? 10 : 1)`, que clampa, redondea al número de decimales del control y persiste inmediatamente:

   ```ts
   step(id, dir, mult = 1): number {
     const control = this.#controls.find(c => c.id === id);
     if (!control || control.kind !== 'slider') return this.read(id);
     const raw  = this.read(id) + dir * control.step * mult;
     const next = clamp(Number(raw.toFixed(control.decimals)), control.min, control.max);
     this.write(id, next); this.commit();
     return next;
   }
   ```

   El `toFixed(decimals)` existe para evitar el clásico `0.30000000000000004` de la aritmética de punto flotante.

7. **Persistencia por bucket.** `saveTweak()` guarda **solo el bucket activo**, y solo las trece claves editables:

   ```ts
   const snap = $state.snapshot(stateTweak);
   overrides[labState.bucket] = Object.fromEntries(TWEAKABLE_KEYS.map(k => [k, snap[k]]));
   localStorage.setItem(KEY, JSON.stringify({ overrides }));
   ```

8. **`COPY VALUES`.** Serializa `registry.snapshot()` a JSON con indentación, lo escribe en el portapapeles y además lo imprime por consola (el portapapeles puede fallar sin gesto de usuario o sin HTTPS). Ese JSON es exactamente el que se pega en `PER_BUCKET_SEED` para congelar un ajuste aprobado.

### 3.6 `AnimLab`: acciones, exclusividad y diagnóstico

`AnimLab.svelte` es el segundo panel genérico. Además de sliders y toggles, dibuja **acciones** y un bloque de diagnóstico.

**Ejecución exclusiva.** Una acción marcada `exclusive: true` bloquea todas las demás mientras corre. El registro lo gestiona:

```ts
async run(id: string): Promise<void> {
  const action = this.#actions.find(a => a.id === id);
  if (!action) return;
  if (!action.exclusive) { await action.callback(); return; }
  if (this.#running) return;
  this.#running = id;
  try { await action.callback(); } finally { this.#running = null; }
}
```

El panel lee `registry.running` y deshabilita los botones. Es lo que impide que dos coreografías largas (una celebración de MAX WIN de 32 segundos y una tirada de bono) se solapen.

**Diagnóstico por rAF.** Un único `requestAnimationFrame` alimenta todo el panel: relee `registry.diagnostics` y calcula FPS con media móvil sobre medio segundo.

```ts
const loop = () => {
  dbg = registry.diagnostics;
  frames++;
  const now = performance.now();
  if (now - last >= 500) { fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now; }
  raf = requestAnimationFrame(loop);
};
```

El FPS es lo único que el panel calcula por su cuenta, porque es genérico. Todo lo demás sale del host.

### 3.7 `labActions.svelte.ts`: qué inyecta el juego en el AnimLab

Todo lo que antes estaba cableado dentro de `AnimLab.svelte` se registra ahora como acciones. Categorías:

| Categoría | Contenido |
|---|---|
| `clips` | los siete clips de Kash (seis idles y el swing), vía el hook DEV `__forceIdle` |
| `swing` | toggle de ghost + once botones de ajuste fino (`dx ±1/±5`, `dy ±1/±5`, escala ±0.02, reset) |
| `diag` | fijar y limpiar una referencia de posición para medir deriva entre clips |
| `situations` | seis celebraciones de win, tirada de rampage, trigger de bono, anticipación |
| `freespins` | intro y outro del bono |
| `other` | transición |
| `sounds` | tres músicas y un botón por archivo de audio, agrupando el `SFX_MAP` por ruta |

Un principio explícito del diseño: **las acciones emiten los mismos eventos que `bookEventHandlerMap`**, de modo que lo que se ve en el laboratorio es exactamente el componente de producción, no una imitación. Ejemplo, la celebración de win:

```ts
const playWin = (alias, amount) => async () => {
  const winLevelData = levelByAlias(alias);
  await emit.broadcastAsync({ type: 'kashSwing' });     // resuelve en el frame de golpe
  emit.broadcast({ type: 'winShow' });
  if (winLevelData?.sound?.sfx) emit.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
  if (winLevelData?.sound?.bgm) emit.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
  await emit.broadcastAsync({ type: 'winUpdate', amount, winLevelData });
  emit.broadcast({ type: 'soundMusic', name: 'bgm_main' });
  emit.broadcast({ type: 'winHide' });
};
```

La acción "TIRADA BATEO" llega más lejos: arma el RGS mock (`POST {rgsUrl}/debug/arm-next` con `{ tier: 'rampage' }`), fuerza el modo base si estaba en un buy, y dispara el mismo evento `bet` que el botón SPIN. Contra un RGS real el endpoint no existe, el `fetch` falla en silencio y la tirada sale normal.

El **diagnóstico** que publica el juego (`buildDiagnostics`) lee un objeto global que `Background.svelte` mantiene actualizado (`__kashDbg`) con clip actual, frame, centro X, línea de pies y bounding box renderizado, y produce:

- Filas de texto: clip, frame, `centro X · pies Y`, `alto · ancho`, delta contra la referencia fijada (resaltada si supera 2 px), estado del swing y amplitud del shake.
- Guías sobre el canvas: línea horizontal en la línea de pies, línea vertical en el centro del cuerpo, caja del bounding box, y las mismas dos líneas en rojo para la referencia fijada.

Ese conjunto es lo que permite verificar visualmente que un cambio de clip **no mueve al personaje** (§4.4).

### 3.8 El panel remoto y la página `/sizes`

`/sizes` (`src/routes/sizes/+page.svelte`) es una página exclusiva de DEV que reproduce el selector de tamaños del ACP de Stake: siete presets, el juego embebido en un `<iframe>` same-origin al tamaño exacto, y el panel de control **a la derecha, fuera del frame del juego**, de modo que no tapa nada.

El desafío técnico es que el panel corre en el documento padre y el registro vive en el documento del iframe. La solución es descubrimiento en tiempo de ejecución en lugar de importación en compilación. Al configurarse, el registro publica un hook DEV:

```ts
configure(host: InspectorHost) {
  this.#host = host;
  if (isDev()) {
    const g = globalThis as Record<string, unknown>;
    const all = (g.__inspectors ?? {}) as Record<string, unknown>;
    all[this.id] = this;
    g.__inspectors = all;
    if (this.id === 'layout') g.__inspector = this;
  }
}
```

`InspectorBridge` (`inspectorBridge.svelte.ts`) hace polling cada 300 ms hasta que `iframe.contentWindow.__inspectors['layout']` está listo, y entonces sincroniza catálogo y valores. Un detalle relevante: el catálogo se transfiere a través de un getter especial:

```ts
get schema(): InspectorControl[] {
  return $state.snapshot(this.#controls) as InspectorControl[];
}
```

`$state.snapshot` produce **objetos planos serializables**, no proxies reactivos. Cruzar un proxy de Svelte entre dos realms de JavaScript produce comportamiento indefinido; el snapshot lo evita.

Las escrituras van en dirección contraria: `bridge.write(id, value)` invoca `remote.write(id, value)` sobre el registro del iframe, cuya mutación del `$state` dispara la reactividad normal **dentro** del iframe. El padre solo mantiene una copia local de valores para dibujar sus propios sliders.

La página además marca con un check verde los presets ya aprobados y congelados en `PER_BUCKET_SEED`, y escala el iframe si el preset no entra en pantalla (`transform: scale()` sin agrandar nunca).

### 3.9 Otros hooks de depuración

`stateTweak.svelte.ts` expone, solo en DEV, un conjunto de hooks que consumen tanto QA automatizado (Playwright) como la página `/sizes`:

```ts
g.__labBucket  = () => labState.bucket;
g.__stateTweak = stateTweak;      // el proxy $state: mutarlo desde el padre dispara reactividad
g.__labState   = labState;
g.__saveTweak  = saveTweak;
g.__resetTweak = resetTweak;
g.__syncUi     = syncUi;
```

`boardShake.svelte.ts` publica `__boardShake()` para disparar la sacudida desde la consola, y `Background.svelte` publica `__forceIdle(clip)` para forzar un clip concreto sin esperar la rotación aleatoria. Todos quedan fuera del bundle de producción por el guard `import.meta.env.DEV`.

---

## 4. Sistema de animaciones y renderizado (PixiJS 8)

### 4.1 El puente declarativo: `pixi-svelte`

`packages/pixi-svelte` traduce componentes Svelte a nodos del árbol de render de PixiJS. El mecanismo tiene tres piezas:

**a) Contexto de padre.** `createContextParent(container)` expone un `addToParent` que engancha el ciclo de vida de Svelte al display list de Pixi:

```ts
const addToParent = (node: PIXI.ContainerChild) => {
  onMount(() => {
    context.parent.addChild(node);
    context.parent.sortChildren();
    return () => { if (node) node.destroy(); };   // equivalente a onDestroy
  });
};
```

Montar un componente añade el nodo; desmontarlo lo destruye. La estructura del markup Svelte **es** la jerarquía de contenedores de Pixi.

**b) Sincronización de props.** `propsSyncEffect` (en `utils.svelte.ts`) escribe cada prop definida sobre el objeto Pixi dentro de un único `$effect`:

```ts
export function propsSyncEffect({ props, target, ignore }) {
  $effect(() => {
    const t = target instanceof Function ? target() : target;
    if (!t) return;
    Object.keys(props)
      .filter(key => ignore ? !ignore.includes(key) : true)
      .forEach(key => { if (props[key] !== undefined) t[key] = props[key]; });
  });
}
```

Al leer `props[key]` dentro del efecto, este se re-ejecuta ante el cambio de cualquier prop. Las props `undefined` se ignoran, lo que resulta esencial para el resolutor de anclajes (§4.4).

**c) Componentes hoja.** `Container`, `Sprite`, `SpriteSheet`, `Text`, `BitmapText`, `Rectangle`, `Graphics`, `Particles`, `Spine*`.

**Un bug corregido que conviene conocer.** `AnimatedSprite.svelte` excluye explícitamente `textures` de `propsSyncEffect`:

```ts
propsSyncEffect({ props, target: animatedSprite, ignore: ['play', 'textures'] });

$effect(() => {
  const textures = props.textures ?? [];
  if (animatedSprite.textures === textures) return;
  const wasPlaying = animatedSprite.playing;
  animatedSprite.textures = textures;
  if (wasPlaying) animatedSprite.play();      // play(), NO gotoAndPlay(0)
});
```

El motivo: el setter `textures` de Pixi llama internamente a `gotoAndStop()`, que detiene la animación y da de baja el sprite del `Ticker.shared`. Como `propsSyncEffect` reasigna **todas** las props cuando cambia cualquiera de ellas, un simple cambio de resolución (que recalcula `x/y/width/height`) reasignaba las texturas y congelaba todas las animaciones del juego, con el ticker corriendo a 60 fps pero sin listeners. El síntoma se reportó en el ACP el 24-08.

La corrección usa `play()` y no `gotoAndPlay(0)` porque reiniciar al frame 0 rompía las animaciones de una sola pasada: una celebración de bono se reiniciaba, su `onComplete` no llegaba nunca y la ronda quedaba colgada.

### 4.2 Pipeline de assets: `assets.ts` como fuente única de verdad

`src/game/assets.ts` es el registro que consume el `AssetsLoader` de `pixi-svelte`. Cada entrada declara tipo, ruta y si se precarga:

```ts
export default {
  bg_vault:    { type: 'sprite',      src: new URL('../../assets/sprites/bg/vault_scene.jpg', import.meta.url).href, preload: true },
  board_frame: { type: 'sprite',      src: new URL('../../assets/sprites/bg/board_frame.png', import.meta.url).href, preload: true },
  anim_kash_swing: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_swing.json', import.meta.url).href, preload: true },
  anim_win_mega:   { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_win_mega.json',   import.meta.url).href },
  sym_h4:      { type: 'sprite',      src: new URL('../../assets/sprites/symbols/h4.png', import.meta.url).href },
  // ...
} as const;
```

**Restricción crítica documentada en el archivo**: las rutas deben ser literales estáticos dentro de `new URL(...)`. La reescritura de URLs de Vite no resuelve interpolación de plantillas y emite `undefined` en silencio, con lo que `PIXI.Assets.load` falla sin registrar el asset. No se debe refactorizar a un helper que concatene el nombre de archivo.

El inventario actual del registro:

| Familia | Prefijo | Tipo | Notas |
|---|---|---|---|
| Escenografía | `bg_`, `board_` | sprite | precargados; el fondo es 2000×1126 (16:9) |
| Personaje | `anim_kash_idle_*`, `anim_kash_swing`, `kash_side` | spriteSheet + sprite | seis idles y el swing; `kash_side` es el PNG estático de respaldo |
| Símbolos estáticos | `sym_l1..l4`, `sym_m1..m2`, `sym_h1..h4`, `sym_w`, `sym_s` | sprite | 512×512 PNG con transparencia |
| Símbolos iluminados | `sym_*_luz` | sprite | 512×460, marco y glow horneados; usados como estado de victoria |
| Símbolos animados | `anim_sym_wild`, `anim_sym_scatter`, `anim_sym_premium` | spriteSheet | seis frames cada uno |
| Celebraciones | `anim_win_small/big/mega/max` | spriteSheet | letterings animados |
| Paneles de bono | `fs_intro_panel`, `fs_win_panel` | sprite | WebP precargados |
| Logo | `kash_logo` | sprite | usado en la transición |

**Estrategia de precarga.** `AssetsLoader.svelte` implementa dos fases:

```svelte
{#if preLoaded}
  {@render props.children()}
{/if}
```

La primera fase carga solo los assets con `preload: true` y desbloquea el render; la segunda carga el resto en segundo plano y actualiza `stateApp.loadingProgress`. Los componentes que dependen de un asset no precargado consultan `loadedAssets[key]` y hacen fallback mientras tanto: los símbolos animados caen al sprite estático, y Kash cae a `kash_side`.

Una decisión de precarga documentada: `anim_kash_swing` está en `preload` aunque pese 1.2 MB, porque es el primer beat de KASH RAMPAGE y, sin él, una compra hecha a los pocos segundos de abrir el juego salía sin bateo (`swingReady` en falso, resolución inmediata).

**Reintentos por asset.** Un fallo puntual de red se tragaba con `console.error` y el juego arrancaba con el asset faltante, produciendo `Sprite: key ... is not found in the loadedAssets` en tiempo de ejecución. Eso fue motivo de rechazo por consola sucia. El loader ahora reintenta tres veces con backoff, limpiando el caché de Pixi entre intentos:

```ts
await PIXI.Assets.unload(loadSrc).catch(() => undefined);   // Assets cachea la promesa fallida por URL
await new Promise(r => setTimeout(r, 500 * attempt));
```

**Procesamiento por tipo** (`assetLoad.ts::getProcessed`): `sprite` devuelve la textura, `spriteSheet` devuelve `Object.values(rawAsset.textures)` (un array ordenado de texturas, listo para `AnimatedSprite`), `sprites` devuelve el diccionario completo, `spine` construye el `SkeletonData` con `AtlasAttachmentLoader` y el parser binario o JSON según corresponda, y `font` se omite.

**Assets HTML.** Los overlays del HUD usan `<img>` y `background` CSS, que no pasan por el loader de Pixi. `game/htmlAssets.svelte.ts` los precarga durante la pantalla de carga y mantiene referencias vivas a las `Image` en un array (`pinned`) para que el recolector de basura no suelte la copia decodificada. El botón "click to continue" espera a que estén listos tanto los assets Pixi como los HTML.

### 4.3 Formato de spritesheets: TexturePacker

Los sheets se generan con TexturePacker y se entregan como par `.json` + imagen (`.webp` para la mayoría, `.png` donde hace falta canal alfa sin pérdida). Metadatos reales del swing:

```json
"meta": { "app": "texturepacker", "version": "1.1",
          "image": "anim_kash_swing.png", "format": "RGBA8888",
          "size": { "w": 4096, "h": 4096 }, "scale": "0.83" }
```

40 frames, cada uno con recorte (`trimmed: true`):

```json
"Kash_Batea_00000.png": {
  "frame":            { "x": 2882, "y": 2423, "w": 376, "h": 771 },
  "trimmed": true,
  "spriteSourceSize": { "x": 261,  "y": 218,  "w": 376, "h": 771 },
  "sourceSize":       { "w": 1038, "h": 1021 }
}
```

El recorte es la fuente de dos complicaciones que el código resuelve explícitamente:

1. Pixi devuelve texturas cuyo `orig` es el `sourceSize` (el canvas completo), reinyectando el recorte al pintar. Dimensionar el sprite con `width/height` dimensiona el **canvas**, no el arte.
2. El arte no está centrado en ese canvas. Para los tres símbolos animados, `SymbolSprite.svelte` mide del propio JSON la unión de los `spriteSourceSize` de los seis frames y la normaliza:

   ```ts
   sym_w: { key: 'anim_sym_wild',
            aspect: 169/205,                            // proporción del ARTE
            fill:   { w: 169/256, h: 205/256 },         // fracción del canvas que ocupa
            center: { x: 125.5/256, y: 153.5/256 },     // dónde cae su centro
            box: 0.9 }                                  // = sizeRatios del estático
   ```

   y de ahí deriva el tamaño del canvas (`artW / fill.w`) y el desplazamiento necesario para que el **centro del arte**, no el del canvas, caiga en la celda (`-specialW * (center.x - 0.5)`). El campo `box` replica el `sizeRatio` del símbolo estático correspondiente, para que el intercambio estático→animado (los sheets van sin precarga) no produzca un salto de tamaño.

Los clips de Kash provienen de material del equipo de arte procesado con un pipeline de chroma (`chroma_pipeline.py`: chromakey, despill, frames RGBA, grid y JSON). Los seis idles comparten un recorte común de 384×460 a 10 fps; el swing viene de otro canvas (1038×1021) a 24 fps.

### 4.4 Resolución de anclajes dinámicos: el subsistema clave

**El problema.** PixiJS 8 crea todo `Sprite` y `AnimatedSprite` con `anchor` en (0,0): lo que queda clavado en `(x, y)` es la esquina superior izquierda del bounding box. Si un personaje tiene clips con distinto recorte —el swing viene de un canvas de 1038×1021, los idles de uno de 384×460— al intercambiar animación cambia el box, cambia el punto anclado, y **el personaje salta**: los pies se van de sitio.

**La solución conceptual.** Anclar por **semántica**, no por defecto de la librería:

| Familia | Ancla | Razón |
|---|---|---|
| `character` | (0.5, 1) | los pies quedan clavados |
| `symbol` | (0.5, 0.5) | el pop y la rotación giran sobre su eje |
| `lettering` | (0.5, 0.5) | centrado |
| `scene` | (0.5, 0.5) | ajuste tipo cover |

**La implementación tiene dos mitades**, con la misma inversión de dependencias que el inspector.

*Mitad genérica* — `packages/pixi-svelte/src/lib/anchorRegistry.ts`:

```ts
export type AnchorResolver = (assetKey: string) => ResolvedAnchor | undefined;
let resolver: AnchorResolver | null = null;

export const setAnchorResolver = (next: AnchorResolver | null) => { resolver = next; };

export const resolveAssetAnchor = (assetKey: string): ResolvedAnchor | undefined => {
  if (!resolver) return undefined;
  try { return resolver(assetKey); }
  catch (error) { console.error(`[pixi-svelte] anchor resolver falló para "${assetKey}":`, error); return undefined; }
};
```

El contrato son dos reglas:

1. Un `anchor` explícito del consumidor **siempre gana**. El resolutor solo rellena cuando la prop viene `undefined`.
2. El resolutor devuelve `undefined` para un id que no reconoce, dejando intacto el comportamiento por defecto de PixiJS. Esto protege a assets ajenos que sí quieren (0,0) —las barras de progreso de las pantallas de carga del SDK, por ejemplo— y garantiza que los otros seis juegos del monorepo no cambien de comportamiento.

El punto de enganche son `Sprite.svelte` y `SpriteSheet.svelte`, los únicos componentes del paquete que conocen el `key` del asset:

```svelte
const anchor = $derived(animateSpriteProps.anchor ?? resolveAssetAnchor(key));
```

Como `propsSyncEffect` ignora las props `undefined`, devolver `undefined` es literalmente "no tocar nada".

*Mitad específica del juego* — `src/game/spriteConfig.svelte.ts`. Define una cascada de cuatro niveles, gana el primero que matchea:

```
1. override reactivo en vivo   (spritePlacementOverrides — escrito por los laboratorios)
2. entrada explícita por assetId (SPRITE_PLACEMENTS)
3. regla por TAG derivado del patrón del id (TAG_PATTERNS + PLACEMENT_BY_TAG)
4. fallback (centro)
```

Los tags se derivan por expresión regular sobre el id, en orden:

```ts
export const TAG_PATTERNS = [
  { tag: 'character', patterns: [/^anim_kash_/, /^kash_side$/] },
  { tag: 'symbol',    patterns: [/^sym_/, /^anim_sym_/] },
  { tag: 'lettering', patterns: [/^anim_win_/, /^fs_/, /^kash_logo$/] },
  { tag: 'scene',     patterns: [/^bg_/, /^board_/] },
];
```

El orden importa: `anim_sym_*` debe caer en `symbol` y no en `character`, por eso los prefijos son explícitos y no se solapan.

Un `SpritePlacement` declara tres conceptos distintos, y ninguno es un "offset mágico":

```ts
export type SpritePlacement = SpriteAnchor & {
  aspect?: number;      // relación ancho/alto del frame recortado
  scale?: number;       // proporción del crop que ocupa el CUERPO del personaje
  fps?: number;         // los sheets no lo traen en su JSON
  foreground?: boolean; // el clip se dibuja por delante del board
};
```

**El pliegue de offsets dentro del pivote.** Esta es la idea central del módulo. La alineación fina del swing se había ajustado en el AnimLab como dos desplazamientos en píxeles (`dxFrac`, `dyFrac`, en fracción del alto de Kash). Pero un desplazamiento y un anclaje son la misma cosa escrita de dos maneras: mover el sprite `d` píxeles equivale a mover el pivote `d / tamaño` en unidades normalizadas. La equivalencia algebraica que aplica el código:

```
x = X + H·dxFrac   con anchorX 0.5   ≡   x = X   con anchorX = 0.5 − dxFrac/(scale·aspect)
y = Y + H·dyFrac   con anchorY 1     ≡   y = Y   con anchorY = 1   − dyFrac/scale
```

`H` (el alto de referencia) **se cancela en ambas**, y esa es la propiedad valiosa: la alineación aguanta en cualquier resolución sin recalcular nada por bucket. El resultado horneado:

```ts
const SWING_ASPECT   = 423 / 460;
const SWING_SCALE    = 1.09 * 0.99 * 1.02;                    // ≈1.1007
const SWING_DX_FRAC  = 37/563 - 26/650 + 39/650;              // ≈ 0.0857
const SWING_DY_FRAC  = -4/563 - 18/650 + 7/650;               // ≈ −0.0240

anim_kash_swing: {
  anchorX: 0.5 - SWING_DX_FRAC / (SWING_SCALE * SWING_ASPECT), // ≈0.4153
  anchorY: 1   - SWING_DY_FRAC / SWING_SCALE,                  // ≈1.0218 (>1 es válido en PixiJS)
  aspect: SWING_ASPECT, scale: SWING_SCALE, fps: 24, foreground: true,
}
```

Un `anchorY` mayor que 1 es perfectamente válido en Pixi: significa que el punto de anclaje cae por debajo del borde inferior del bounding box.

`scale` no es un ajuste a ojo: es la proporción del recorte que ocupa el cuerpo del personaje. Dos clips recortados con distinto zoom necesitan escalas distintas para que el cuerpo mida lo mismo en pantalla. El swing ocupa ~84.7% del alto de su crop, de ahí el ≈1.10.

**La factoría** — `src/game/spriteFactory.ts` — es el único punto donde nace un sprite del juego, y cubre las dos vías de dibujo:

```ts
export const place = (assetId: string, options: PlaceOptions): PlacedSprite => {
  const p = getSpritePlacement(assetId);
  const height = options.height * (p.scale ?? 1);
  return {
    anchor: { x: p.anchorX, y: p.anchorY },
    x: options.x,                       // TAL CUAL: no hay offsets por clip
    y: options.y,
    width: height * (p.aspect ?? 1),    // el ancho sale del aspect del asset
    height,
    animationSpeed: (p.fps ?? 10) / 60, // Pixi mide en frames por tick
    foreground: p.foreground ?? false,
  };
};
```

Y para la vía imperativa, `createAnimated` / `createSprite` devuelven nodos Pixi con `anchor.set(x, y)` ya aplicado.

El registro se enchufa al SDK con una sola llamada desde `Background.svelte`:

```ts
registerSpriteAnchors(() => appContext.stateApp.loadedAssets);
// → setAnchorResolver(resolveAutoAnchor) + getter de texturas para la vía imperativa
```

**El resultado en el componente.** `Background.svelte` ya no contiene ni un número de encuadre ni una sola rama `isSwing`:

```ts
const placeKash = (assetId: string) =>
  SpriteFactory.place(assetId, { x: kash.x, y: kash.y + kash.h / 2, height: kash.h });

const kashPlaced = $derived(placeKash(currentClip));
const kashLayer  = $derived(kashPlaced.foreground && celebration.n === 0 ? 15 : -4);
```

El punto de referencia es siempre el mismo —`(kash.x, línea de pies)`— para todos los clips. Con `anchorY = 1`, ese punto **es** la línea de pies, así que cambiar de clip cambia el bounding box pero no el punto anclado. La única corrección por asset es `scale`, que iguala el tamaño del cuerpo entre recortes distintos, y el pivote, que absorbe la alineación fina.

Nótese también que `foreground` es un **dato del asset**, no una condición en el componente: el swing pasa por delante del board (zIndex 15), los idles viven detrás (−4), y durante una celebración activa (`celebration.n > 0`) el swing se manda al fondo para que nunca quede por delante de la pantalla de celebración.

**Conexión con los laboratorios.** Los overrides son `$state`:

```ts
export const spritePlacementOverrides = $state<Record<string, SpritePlacement>>({});
```

Como los componentes leen el placement dentro de expresiones reactivas, tocar este objeto repinta los sprites **sin remontar el nodo**. El `$effect` de DEV en `Background.svelte` traduce los nudges del AnimLab (`dx`, `dy`, `dscale` en píxeles) a un override del registro, recalculando el pivote sobre el tamaño nuevo:

```ts
const bakedDx = (0.5 - base.anchorX) * baseW;   // recupera el desplazamiento horneado
const bakedDy = (1   - base.anchorY) * baseH;
const scale   = (base.scale ?? 1) * dscale;
const height  = kash.h * scale;
const width   = height * (base.aspect ?? 1);
putSpritePlacement(SWING_CLIP, { ...base, scale,
  anchorX: 0.5 - (bakedDx + dx) / width,
  anchorY: 1   - (bakedDy + dy) / height });
```

Se usa `putSpritePlacement` (escritura directa) y no `setSpritePlacement` (merge) porque esta última lee el valor resuelto, y leer lo que se escribe dentro de un efecto crearía un ciclo. La base se toma de `SPRITE_PLACEMENTS` (el valor horneado) y no del resuelto, por la misma razón.

### 4.5 Coreografías: el "game juice"

**Cascada de victoria — `winFlash.svelte.ts`.** Presentación del cluster ganador antes de que estalle:

```
0. Instante cero, TODOS a la vez → se enciende el sprite de brillo trasero a alpha 0.4
1. Orden de lectura (arriba→abajo, izquierda→derecha) + delay progresivo
2. Por símbolo: FLASH del brillo 0.4 → 1.0, y en paralelo el BOING del ícono: 0.85 → 1.15 (backOut)
```

El reparto de propiedades entre nodos de Pixi es deliberado y no trivial:

- `glow` va al `alpha` del sprite de brillo, que **no escala**: si escalara con el boing, el halo respiraría y se comería la celda vecina.
- `scale` va a un `Container` propio que envuelve **solo** al sprite del ícono. La celda (`SymbolWrap`) y el brillo quedan fuera de ese contenedor, de modo que el golpe no mueve la grilla ni el halo.

El stagger se comprime en clusters grandes para no estirar la ronda:

```ts
const staggerFor = (count) => count > 1 ? Math.min(90, 700 / (count - 1)) : 0;
```

Un cluster de 25 símbolos no consume 2.25 s: consume como máximo 700 ms.

Las celdas se almacenan en un `SvelteMap` keyeado por `"reel:row"`, porque los símbolos del board los crea el engine (`createReelForSpinning`) y no se les puede colgar estado propio como al tumble board; el `SvelteMap` hace que el `get` de `SymbolSprite` sea reactivo.

**Pop de salida — `winPop.svelte.ts`.** Tres pasos encadenados con `Tween` de `svelte/motion`:

| Paso | Duración | Easing | Escala | Rotación |
|---|---|---|---|---|
| Anticipación | 110 ms | `quadOut` | 0.75 | −12° |
| Boing | 220 ms | `backOut` | 1.50 | 0° |
| Desaparición | 150 ms | `cubicIn` | 0 | — |

Total ≈ 480 ms, el mismo orden de magnitud que el rebote del deslizamiento (200 ms), para que el ciclo victoria→tumble no se sienta pesado.

Igual que en el flash, el pop corre sobre el `Container` interno de `SymbolSprite`, nunca sobre `SymbolWrap` ni sobre el contenedor de la celda: esos llevan la posición del board y el escalado inverso del `boardStretch`, de modo que escalarlos movería la grilla entera.

**Guard de símbolos con clip propio.** Tanto el flash como el pop se saltan los símbolos que traen su propia animación:

```ts
export const SELF_ANIMATED_ASSET_KEYS = ['sym_w', 'sym_s', 'sym_h4'] as const;
export const hasOwnClip = ({ symbolInfo }) =>
  symbolInfo.type === 'spine' || SELF_ANIMATED.has(symbolInfo.assetKey);
```

El tipado está deliberadamente acoplado: `ANIM_SPECIAL` en `SymbolSprite.svelte` está tipado contra `SelfAnimatedAssetKey`, de modo que desincronizar las dos listas rompe la compilación.

**Shake del board — `boardShake.svelte.ts`.** Amplitud con decaimiento cuadrático y oscilación aleatoria (sacudida, no vibración regular):

```ts
const amp = intensity * (1 - t) * (1 - t);
boardShake.x = (Math.random() * 2 - 1) * amp;
boardShake.y = (Math.random() * 2 - 1) * amp * 0.55;
```

El eje Y se atenúa al 55% para que la sacudida se lea como horizontal, coherente con un bateo. El estado es un `$state` que `Game.svelte` suma directamente a la posición del wrapper del board.

**Celebraciones por tier — `Win.svelte`.** Los diez niveles de `winLevelMap` se mapean a cuatro tiers visuales:

| Tier | Alias de origen | Duración de conteo | Atenuado de fondo | Hold | Shake | Flash |
|---|---|---|---|---|---|---|
| small | hasta `substantial` | 600 ms | 0.18 | 1500 ms | 0 | 0.25 |
| big | `big`, `superwin` | 1200 ms | 0.40 | 2200 ms | 16 | 0.40 |
| mega | `mega`, `epic` | 2000 ms | 0.55 | 2900 ms | 22 | 0.50 |
| max | `max` (solo el cap real) | 4000 ms | 0.72 | 3800 ms | 30 | 0.60 |

Los `epic` usan el cartel MEGA pero con presentación intensificada (conteo 3000 ms, hold 3400 ms, shake 26, atenuado 0.63): así el rango alto se distingue sin necesitar arte propio. El conteo usa 24 pasos con easing cuadrático de salida.

**Transiciones y contador de celebraciones.** `celebration.svelte.ts` mantiene un contador de celebraciones activas (win, intro de bono, outro, transición). Mientras hay al menos una, el swing de Kash se manda al fondo. `curtain.svelte.ts` implementa la cortina compartida de los overlays HTML: el gate `visible` mantiene el overlay montado 420 ms después del cierre para que la animación de salida alcance a verse.

### 4.6 El spin: scroll continuo

`stateGame.svelte.ts` construye los seis reels con `createReelForSpinning` (`packages/utils-slots`): la columna es una **tira continua** formada por board nuevo + padding + board viejo, que se desliza hacia abajo, aterriza pasada de largo y vuelve como unidad con easing sinusoidal.

Parámetros (`constants.ts`):

```ts
const SPIN_OPTIONS_SHARED = {
  reelBounceBackSpeed: 0.15,
  reelSpinSpeedBeforeBounce: 4,       // px/ms, más lento que el crucero para que la parada se lea
  reelPaddingMultiplierNormal: 1.2,   // largo del stream de padding, en largos de reel
  reelPaddingMultiplierAnticipated: 1.2,
  reelSpinDelay: 145,                 // la ola columna a columna del arranque
};
export const SPIN_OPTIONS_DEFAULT = { ...SPIN_OPTIONS_SHARED, reelPreSpinSpeed: 1.1, reelSpinSpeed: 3, reelBounceSizeMulti: 0.35 };
export const SPIN_OPTIONS_FAST    = { ...SPIN_OPTIONS_SHARED, reelPreSpinSpeed: 5,   reelSpinSpeed: 5, reelBounceSizeMulti: 0.05 };
```

`reelPreSpinSpeed: 1.1` produce un gesto de anticipación de ~330 ms: el primer deslizamiento usa easing `backIn`, de modo que la columna sube un poco antes de largar.

El relleno que scrollea **no es inventado**: `paddingReels.ts` importa los CSV reales de la matemática (`reels/BR0.csv` para el juego base, `reels/FR0.csv` para free spins) con `?raw`, los transpone (cada fila del CSV es una posición del strip, cada columna un reel) y los pasa a `spin()`. Como el book trae `paddingPositions` (el índice de parada en el strip), lo que se ve pasar es el vecindario exacto del resultado. Si la matemática vuelve a generar los strips, hay que volver a copiar los CSV.

`onSymbolLand` dispara el audio contextual al aterrizar: los scatters suenan con tono ascendente según el contador acumulado (`SCATTER_LAND_SOUND_MAP`, cinco niveles), los wilds con un golpe pesado de ganancia baja.

### 4.7 KASH RAMPAGE en el cliente: los cinco beats

Aquí se resuelve una tensión de diseño real. La matemática entrega el `reveal` **ya convertido** (contrato N3), de modo que el jugador nunca vería los símbolos originales: el efecto sería invisible. La dirección artística reportó exactamente eso el 26-08 ("no se nota el efecto").

**La solución es un lookahead en el handler de `reveal`:**

```ts
const nextRevealIndex = bookEvents.find(e => e.type === 'reveal' && e.index > bookEvent.index)?.index ?? Infinity;
const rampageEvent = bookEvents.find(e => e.type === 'kashRampage'
                                       && e.index > bookEvent.index
                                       && e.index < nextRevealIndex);
let revealEvent = bookEvent;
if (rampageEvent) {
  const board = bookEvent.board.map(reel => reel.map(cell => ({ ...cell })));  // clon superficial
  rampageEvent.conversions.forEach(c => {
    const cell = board[c.reel]?.[c.row];
    if (cell) cell.name = c.from;                                              // revertir a los VIEJOS
  });
  revealEvent = { ...bookEvent, board };
}
await stateGameDerived.enhancedBoard.spin({ revealEvent, paddingBoard: PADDING_REELS[bookEvent.gameType] });
```

Es decir: si a este `reveal` le sigue un `kashRampage` antes del próximo `reveal`, el drop se presenta con los símbolos **originales** (`from`) en las celdas que se van a convertir. El batazo los estalla y recién entonces queda el `to` real del book. El `bookEvent` original no se muta —el snapshot y el replay lo releen—, por eso el clon superficial.

Después, el handler de `kashRampage` ejecuta la coreografía:

| Beat | Acción |
|---|---|
| 1. Windup | `await broadcastAsync({ type: 'kashSwing', source: 'rampage' })` — resuelve en el frame de golpe |
| 2. Impact | `triggerBoardShake(26, 620)` refuerza el shake que ya disparó `Background` |
| 3. Conversion Wave | por reel de izquierda a derecha: ocultar celda → intercambiar `rawSymbol` → emitir `rampageShatter`; SFX rotando entre tres explosiones; espera de 90 ms (40 con turbo) |
| 4. Premium Accent | pulso de victoria sobre las celdas que resolvieron a `H4`, con su golpe de sonido |
| 5. Settle | 300 ms de respiro para leer el board nuevo antes de detectar clusters |

El orden por celda del beat 3 es crítico y está anotado como tal: **ocultar → intercambiar → emitir**, de modo que el símbolo nuevo jamás parpadee antes de su caída.

`RampageShatterLayer.svelte` implementa el efecto físico. Por celda convertida:

1. La textura del símbolo viejo se corta en **3×3 = 9 fragmentos**, cada uno con velocidad radial, gravedad (1400 unidades de board/s², donde una celda son 80), rotación y desvanecimiento a partir del 45% de su vida (700 ms).
2. La celda queda **vacía** un beat (`RAMPAGE_FALL_DELAY_MS = 130`).
3. El símbolo nuevo **cae** desde arriba del marco con easing cuadrático de entrada (`RAMPAGE_FALL_DUR_MS = 240`) y aterriza; en ese mismo frame se desoculta el símbolo real del engine.

El ocultamiento se coordina con `stateRampage.svelte.ts`, que guarda las referencias de los `ReelSymbol` ocultos; `ReelSymbol.svelte` no los renderiza mientras estén en la lista. `RampageShatterLayer` los saca al aterrizar, y el handler hace un `rampageUnhideAll()` final de seguridad para garantizar que ninguna celda quede invisible si un asset no cargó o el componente se desmontó.

Un solo bucle `requestAnimationFrame` gobierna todos los fragmentos y caídas vivos, y se apaga solo cuando no queda ninguno.

### 4.8 Sincronización de la celebración con el impacto del bate

`Background.svelte` implementa un mecanismo de sincronización fino entre la animación del personaje y la presentación de la victoria. El golpe no se dispara por milisegundos sino **por frame real**, porque el frame es determinista aunque el playback varíe:

```ts
const SWING_STRIKE_FRAME = 30;   // verificado in-game: el bate contacta el grid en el frame 31

const onFrame = (frame: number) => {
  currentFrame = frame;
  if (currentClip === SWING_CLIP && !swingHit && frame >= SWING_STRIKE_FRAME) {
    swingHit = true;
    triggerBoardShake(24, 600);
    context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_explode' });
    strikeResolve?.();          // resuelve el broadcastAsync del caller
    strikeResolve = null;
  }
};
```

`bookEventHandlerMap.setWin` hace `await broadcastAsync({ type: 'kashSwing' })`, de modo que la celebración entra exactamente **con** el impacto. Con turbo activo el swing acompaña pero no bloquea (el frame 30 a 24 fps son ~1.25 s).

El manejo de casos límite está documentado con el incidente que lo motivó. Con victorias encadenadas (autoplay, turbo, replay), si el swing ya está en curso, reasignar el mismo clip **no reinicia el sheet**, de modo que el golpe de este segundo llamador nunca llegaría y se comería el timeout de 1.6 s. QA registró 5 timeouts en 17 spins de autoplay. La corrección: si el golpe está pendiente, el nuevo llamador se **suma** al resolve existente; si ya pasó, retorna de inmediato.

```ts
if (currentClip === SWING_CLIP) {
  if (swingHit || !strikeResolve) return;
  await waitForResolve((resolve) => {
    const prev = strikeResolve;
    strikeResolve = () => { prev?.(); resolve(); };
  }, { label: 'Background.kashSwing strike (join)', timeoutMs: 1600 });
  return;
}
```

El guard de disponibilidad mira el asset del swing (`loadedAssets.anim_kash_swing`) y **no** el clip actual: si mirara el clip actual, una victoria temprana con el swing a medio cargar caería al sprite estático, que no emite `onFrameChange`, y `setWin` quedaría colgado hasta el timeout.

### 4.9 Rotación de idles

En landscape, Kash tiene vida propia: una animación de reposo en bucle y, cada 9 a 16 segundos, una acción aleatoria (gafas, rascarse, nariz, dos gestos con el bate) que se reproduce una vez y vuelve al reposo.

```ts
const STANDBYS = ['anim_kash_idle_stand1'];
const ACTIONS  = ['anim_kash_idle_glasses1', 'anim_kash_idle_scratch1',
                  'anim_kash_idle_nose1', 'anim_kash_idle_bat1', 'anim_kash_idle_bat2'];

const scheduleAction = () => {
  actionTimer = setTimeout(() => {
    currentClip = pick(ACTIONS); currentLoop = false; swingHit = false;
  }, 9000 + Math.random() * 7000);
};
const onClipComplete = () => {
  if (currentLoop) return;
  currentClip = pick(STANDBYS); currentLoop = true; scheduleAction();
};
```

El swing no está en esta rotación: es la reacción a una victoria y al KASH RAMPAGE. Los gestos `bat1` y `bat2` son idles (Kash apunta o sostiene el bate) y no sacuden el board.

En portrait el personaje no se dibuja (`showDecor = aspect >= 1.2`): es arte compuesto a lo alto y no entra sin pisar los iconos o el board. En su lugar, el fondo aplica un zoom de 1.2 con recorte desplazado hacia la bóveda y un velo oscuro de alpha 0.52, para que las letras gigantes del grafiti no queden flotando detrás del board.

El `{#key currentClip}` que envuelve el `<SpriteSheet>` fuerza un remontaje limpio al cambiar de clip, garantizando un `gotoAndPlay(0)`.

---

## 5. Mapa de código y archivos clave

### 5.1 Matemática — `stake-math-sdk/games/kash_rampage_extreme/`

| Archivo | Rol |
|---|---|
| `game_config.py` | Singleton de configuración: geometría, paytable, símbolos especiales, progresión de tumble, parámetros de KASH RAMPAGE, modos de compra, reels y las `Distribution` por modo con sus cuotas y condiciones. |
| `gamestate.py` | Orquestación del spin. `run_spin` es el punto de entrada; separa la ruta de juego base de la de compra, y `_draw_with_rampage` fija el orden del contrato N3. |
| `game_executables.py` | Multiplicador de tumble (`reset/current/advance`), `apply_kash_rampage`, `_rebuild_special_syms_cache`, `get_clusters_update_wins`, `update_freespin`. |
| `game_calculations.py` | `evaluate_clusters_tumble`: scoring de cada cluster y construcción del `meta` que consume el cliente. |
| `game_events.py` | Eventos propios del juego: `applyTumbleMult` y `kashRampage`, con el desplazamiento de padding aplicado. |
| `game_override.py` | `update_freespin_amount` con clamp de scatters, `reset_book`, y `check_repeat` con la extensión `force_win_range`. |
| `game_optimization.py` | Definición de fences por modo, parámetros del constructor y escalado. Es donde vive el RTP y el perfil de volatilidad. |
| `run.py` | Punto de entrada: número de simulaciones, hilos, batching, y las cuatro fases (`run_sims`, `run_optimization`, `run_analysis`, `run_format_checks`). |
| `library/publish_files/index.json` | Manifiesto que el RGS consume: modo → (books, tabla de pesos). |
| `library/configs/config.json` | Configuración publicada con hashes SHA-256, RTP, denominaciones y metadatos por modo. |
| `library/stats_summary.json` | Métricas medidas por modo tras la optimización. |
| `library/lookup_tables/*.csv` | Pesos por book. Es la distribución de probabilidad efectiva del juego. |
| `reels/BR0.csv`, `FR0.csv`, `WCAP.csv` | Strips de símbolos. `WCAP` está cargada de scatters y solo la usan los books forzados a wincap. |

### 5.2 Laboratorios — `stake-web-sdk/packages/components-inspector/`

| Archivo | Rol |
|---|---|
| `src/InspectorRegistry.svelte.ts` | **Núcleo de registro.** Clase con `$state` privado; define los tipos `InspectorHost`, `InspectorSlider/Toggle/Action`, `InspectorDiagnostics`, `InspectorGuide`; implementa registro idempotente, agrupación por categoría, `read/write/commit/reset`, `step`, `toggle`, `run` con exclusividad, `snapshot` y el getter `schema` (plano y serializable). Exporta las instancias `inspector` y `animInspector`. |
| `src/components/UiLab.svelte` | **Panel de controles (tecla T).** Renderiza sliders y toggles del registro que reciba por prop. No importa nada de ningún juego. Implementa paso fino con Shift, `COPY VALUES`, `RESET BUCKET` y cambio de lado del panel. |
| `src/components/AnimLab.svelte` | **Panel de acciones y diagnóstico (tecla A).** Renderiza acciones agrupadas en filas, el bloque de diagnóstico del host y las guías sobre el canvas. Calcula FPS por su cuenta con un único `requestAnimationFrame`. |
| `src/inspectorBridge.svelte.ts` | **Puente remoto.** Habla con un registro que vive en otro documento (iframe same-origin) descubriéndolo por el hook DEV `__inspectors[id]`. Campos reactivos privados con getters públicos, por la restricción de `target: es6`. |
| `src/components/InspectorRemotePanel.svelte` | Panel que dibuja lo que expone el puente, para uso desde el documento padre. |

### 5.3 Cliente — `stake-web-sdk/apps/kash-rampage-extreme/src/`

**Puentes de inyección (la frontera juego ↔ SDK):**

| Archivo | Rol |
|---|---|
| `game/labMeta.ts` | Manifiesto de datos del inspector: clave de persistencia (`kash_tweak_v14`), título, nota, categorías, toggles y sliders. Sin imports en tiempo de ejecución, para evitar un ciclo con `stateTweak`. |
| `game/labInspector.svelte.ts` | Implementa el `InspectorHost` del UiLab y registra el catálogo. Único punto donde el laboratorio de layout conoce al juego. |
| `game/labActions.svelte.ts` | Implementa el host del AnimLab: clips, alineación del swing, situaciones de juego reales, free spins, soundboard y `buildDiagnostics` con guías en píxeles de pantalla. |
| `game/spriteFactory.ts` | Enchufa el registro de anclajes al SDK (`setAnchorResolver`) y expone `place()` (vía declarativa) y `createAnimated/createSprite` (vía imperativa). |

**Sistema de anclajes y assets:**

| Archivo | Rol |
|---|---|
| `game/spriteConfig.svelte.ts` | **Registro de anclajes por código.** Tags por patrón, placements por familia, placements explícitos por assetId, overrides reactivos, y `getSpritePlacement` / `resolveAutoAnchor`. Aquí viven el pliegue de offsets dentro del pivote y la geometría del swing. |
| `game/assets.ts` | **Fuente única de verdad del arte.** Todas las entradas del `AssetsLoader` con tipo, ruta literal y bandera de precarga. |
| `game/htmlAssets.svelte.ts` | Precarga de las imágenes HTML del HUD y los overlays, que no pasan por el loader de Pixi. |
| `game/paddingReels.ts` | Importa y transpone los CSV reales de la matemática para el relleno del scroll. |
| `game/fonts.ts` | Registra las fuentes brand en `document.fonts` y apunta el default de Pixi. |

**Estado y layout:**

| Archivo | Rol |
|---|---|
| `game/stateTweak.svelte.ts` | **Buckets de resolución.** `RES_BUCKETS`, `bucketFor`, `DEFAULTS`, `PER_BUCKET_SEED` con los valores aprobados por preset, carga y guardado de overrides en `localStorage`, `applyBucket`, `syncUi`, listener de resize y hooks DEV. |
| `game/stateUiTweak.svelte.ts` | Geometría congelada del HUD (stack, iconos) y del marco del board (`frameW/H/X/Y`, `symScale`). |
| `game/hudLayout.ts` | **Única fuente de verdad de la geometría compartida.** `uiScaleFor`, `topBarHeight`, `stackRightReserve`, `stackTopY` y `boardTransform` con los topes anti-solape. |
| `game/stateGame.svelte.ts` | Board de seis reels con `createReelForSpinning`, tipos `Reel/ReelSymbol/TumbleSymbol`, estado del tumble board, contador de scatters y derivados de layout. |
| `game/constants.ts` | `SYMBOL_SIZE`, `BOARD_DIMENSIONS/SIZES`, board inicial, opciones de spin normal y rápido, `SYMBOL_INFO_MAP` (símbolo → assetKey por estado), mapa de sonidos de aterrizaje de scatter. |
| `game/context.ts` | Composición de contextos del SDK: emisor de eventos, XState, layout y aplicación Pixi. |

**Reproducción del book:**

| Archivo | Rol |
|---|---|
| `game/bookEventHandlerMap.ts` | **El corazón de la presentación.** Un handler `async` por tipo de evento. Incluye el lookahead del rampage, los cinco beats, la coreografía de tumble, el piso de celebración y la lógica de música por modo. |
| `game/typesBookEvent.ts` | Tipado exhaustivo de cada evento del book. Es el contrato con la matemática. |
| `game/utils.ts` | `playBet`, `playBookEvent(s)`, `convertTorResumableBet`, y los helpers de coordenadas `getSymbolX/Y` y resolución de assets por símbolo. |
| `game/actor.ts` | Instancia las máquinas XState con los callbacks del juego. |
| `game/winLevelMap.ts` | Los diez niveles de victoria con alias, tipo, duración, sonidos y nombres de animación. |
| `game/winRatio.ts` | `winToRoundCostRatio` e `isWinCap`, con la documentación de las dos escalas (unidades de book contra dólares). |

**Animación:**

| Archivo | Rol |
|---|---|
| `game/winFlash.svelte.ts` | Cascada de brillo y boing sobre el cluster ganador, antes de que estalle. |
| `game/winPop.svelte.ts` | Pop de salida de tres pasos y el guard `hasOwnClip`. |
| `game/boardShake.svelte.ts` | Sacudida con decaimiento cuadrático. |
| `game/stateRampage.svelte.ts` | Celdas ocultas durante el batazo y timings de la caída. |
| `game/celebration.svelte.ts` | Contador de celebraciones activas, para el z-order del swing. |
| `game/curtain.svelte.ts` | Cortina compartida de los overlays HTML. |
| `game/swingAlign.svelte.ts` | Estado DEV de alineación del swing que manipula el AnimLab. |

**Componentes:**

| Archivo | Rol |
|---|---|
| `components/Game.svelte` | Raíz del canvas: `<App>`, capas, wrapper del board con transform y shake, celebraciones, y el override de `stateMeta.betModeMeta` con los cuatro modos reales. Contiene también el contenido de reglas y paytable de los modales. |
| `components/Background.svelte` | Fondo, personaje, rotación de idles, sincronización del golpe del swing, hooks de diagnóstico y el `$effect` que traduce nudges a overrides de placement. |
| `components/Board.svelte` | Board del engine con máscara, capa de fragmentos y la presentación de cluster ganador. Monta la máscara en los dos contextos (estático y animado). |
| `components/TumbleBoard.svelte` | Board paralelo para la cascada: inicialización, explosión con pop, eliminación y deslizamiento. |
| `components/SymbolSprite.svelte` | Render de un símbolo: wireframe, especial animado con corrección de recorte, o estático con carta iluminada de fondo. Reparto de escalas entre contenedores. |
| `components/RampageShatterLayer.svelte` | Fragmentación 3×3 con gravedad y caída del símbolo nuevo. |
| `components/Win.svelte` | Celebración por tier con conteo, flash, atenuado y shake. |
| `components/BottomBar.svelte` | HUD inferior HTML con la semántica de los botones del SDK y los flags jurisdiccionales. |
| `components/TopBar.svelte` | HUD superior HTML: marquee, balance, última ganancia. |
| `routes/+layout.svelte` | Composición de la aplicación, inyección de los laboratorios en DEV, redirección al RGS mock en desarrollo, tema CSS y cierre de modales con Escape. |
| `routes/sizes/+page.svelte` | Selector de tamaños del ACP con el juego en iframe y el panel remoto. |

### 5.4 SDK compartido — `stake-web-sdk/packages/`

| Paquete | Rol |
|---|---|
| `pixi-svelte` | Puente declarativo Svelte ↔ PixiJS: `App`, `Container`, `Sprite`, `SpriteSheet`, `AssetsLoader`, `propsSyncEffect`, contextos, y `anchorRegistry` con el hook de inyección de anclajes. |
| `utils-book` | `createPlayBookUtils` (reproducción secuencial con `await`), `createMultiBookUtils`, `recordBookEvent`. |
| `utils-slots` | `createReelForSpinning`, `createEnhanceBoard`, helpers de board vacío con padding. |
| `utils-xstate` | Máquinas de apuesta, autoplay y reanudación; llamadas al RGS y clasificación de la ronda. |
| `rgs-requests` / `rgs-fetcher` | Cliente tipado de la API del RGS. El schema está autogenerado con `openapi-typescript`. |
| `state-shared` | `stateBet`, `stateUi`, `stateModal`, `stateSound`, `stateConfig`, `stateUrlDerived`, `stateMeta`. |
| `components-ui-html`, `components-ui-pixi`, `components-layout`, `components-shared`, `components-pixi` | Componentes reutilizables de UI y layout. |

### 5.5 Cómo se conecta todo: dos trazas completas

**Traza A — el jugador presiona SPIN.**

```
BottomBar (HTML)  ->  emit 'bet'
  -> gameActor (XState) -> onNewGameStart -> enhancedBoard.preSpin(PADDING_REELS[gameType])
  -> requestBet -> POST /wallet/play
       RGS: RNG -> índice ponderado -> book
  -> data.round.state : BookEvent[]
  -> playBet -> playBookEvents (secuencial, con await por evento)
       reveal        -> lookahead de rampage -> enhancedBoard.spin()  [scroll continuo + rebote]
       kashRampage   -> swing -> shake -> ola de fragmentos -> caídas -> premium accent -> settle
       winInfo       -> winFlash (brillo + boing en cascada) + overlays de monto
       tumbleBoard   -> explosión con winPop -> deslizamiento -> settle
       applyTumbleMult -> (no-op actual)
       setWin        -> kashSwing sincronizado -> Win.svelte por tier
       finalWin      -> limpieza de HUD
  -> end-round segun el tipo de apuesta -> actualización de balance
```

**Traza B — el diseñador arrastra el slider "Grilla".**

```
UiLab <input type=range> oninput
  -> registry.write('boardH', v)
  -> host.write -> stateTweak.boardH = v ; syncUi()
       (stateTweak y stateUiTweak son proxies $state)
  -> $derived en Game.svelte: boardTransform(...) recalcula s / bx / by con topes
  -> <Container scale={...}> recibe props nuevas
  -> propsSyncEffect escribe sobre el nodo PIXI.Container
  -> el marco y la grilla crecen en el mismo frame
  onchange (soltar)
  -> registry.commit() -> saveTweak()
  -> localStorage['kash_tweak_v14'] = { overrides: { desktop: { boardH: v, ... } } }
  COPY VALUES
  -> JSON con bucket + viewport + valores  ->  se pega en PER_BUCKET_SEED  ->  queda congelado en código
```

---

## 6. Observaciones para la revisión

Puntos que el análisis del código deja abiertos y conviene atender antes de un envío al ACP:

1. **`rage_mode` publica 96.1993% de RTP** contra un objetivo de 96.5%, con las contramedidas de las iteraciones 7 a 10 ya aplicadas. `run.py` está configurado con `target_modes = ["rage_mode"]`, es decir, en medio de esa iteración; hay que restaurar los cuatro modos antes de la corrida final.
2. **`base` mide σ = 26.699** contra el umbral EXTREME de 27.14 de la escala citada. El objetivo declarado en los comentarios es `std >= 27`.
3. La tabla de reglas de `Game.svelte` declara para RAGE MODE "≈ 1 / 2.5 spins", mientras que la configuración vigente es `1/2.3`. El comentario de `game_config.py` indica que las reglas del frontend se actualizaron; conviene verificar el copy.
4. **`SYMBOL_INFO_MAP` reutiliza el mismo sprite para el estado `explosion`.** El bloque de advertencia en `constants.ts` es explícito: la ruta correcta es `type: 'spine'` con un evento `complete` real. El `setTimeout` de 150 ms de `SymbolSprite.svelte` es un parche, y `TumbleBoard.svelte` conduce el timing localmente para no depender del `oncomplete` por símbolo.
5. **`game/config.ts` está desincronizado**: sus `betModes` y su paytable son los del título anterior. Solo se consume como tipo; los valores en tiempo de ejecución salen de `betModeMeta` y del RGS. Debe regenerarse desde `library/configs/config_fe_kash_rampage_extreme.json`.
6. Varios bloques marcados `TODO-KRE (Fase 2)` señalan que los títulos de presentación, diálogos y tickers de los modos siguen describiendo la mecánica anterior.
