# Informe de matemática — Kash Rampage Extreme

**Fecha del análisis:** 2026-09-10
**Objeto analizado:** `stake-math-sdk/games/kash_rampage_extreme/` — código de simulación,
setup del optimizer, y la **corrida de producción del 26-08-2026** publicada en
`library/publish_files/` (books + lookup tables + configs).
**Método:** cálculo exacto sobre las lookup tables publicadas (no muestreo) + lectura
del stream de eventos de los 4 books comprimidos, ponderado por los pesos del optimizer.
Ver [Anexo A](#anexo-a--metodología) para la reproducción.

---

## 1. Resumen ejecutivo

La arquitectura matemática es **sólida y está bien construida**: cluster pays con BFS,
tumbling, fences disjuntas por rango de payout, contrato de eventos correcto. El RTP de
3 de los 4 modos cierra exacto. Pero hay **un defecto bloqueante** y varias
inconsistencias entre lo que la math entrega y lo que el juego declara.

| # | Hallazgo | Severidad |
|---|---|---|
| 1 | **`rage_mode` entrega 96.1993%, no 96.50%** — causa raíz identificada, es un error aritmético en `game_optimization.py`, NO un problema de pool ni de convergencia | 🔴 **Bloqueante** |
| 2 | El frontend y `config.json` declaran **96.5% para los 4 modos**, incluido rage | 🔴 **Bloqueante** (declaración al jugador incorrecta) |
| 3 | La escalera de volatilidad de los buys está **invertida**: rage es el MENOS volátil relativo a su costo, no el más | 🟠 Alto |
| 4 | Los pasos **x200 y x500 del tumble multiplier son inalcanzables** en los 4 modos | 🟠 Alto |
| 5 | Las frecuencias de KASH RAMPAGE declaradas no coinciden con las entregadas (hasta +21% de desvío) | 🟠 Alto |
| 6 | La banda 3000–5000x de base está poblada a 1/3.16M — a efectos prácticos vacía para el check 40 | 🟡 Medio |
| 7 | `statistics_summary.json` y el `.xlsx` reportan frecuencias **del pool crudo, sin ponderar** — se leen mal por 20x | 🟡 Medio |
| 8 | `std` de base = 26.699 vs. target ≥27 declarado para "Extreme" | 🟡 Medio |
| 9 | `run.py` quedó con `target_modes = ["rage_mode"]` — una re-corrida no regenera los otros 3 modos | 🟡 Medio |

---

## 2. Cómo funciona la matemática (arquitectura)

El juego no calcula probabilidades en runtime. Sigue el modelo del Stake Engine Math SDK,
que es de **tres etapas**:

```
  [1] SIMULACIÓN               [2] OPTIMIZACIÓN            [3] ENTREGA
  gamestate.py                 game_optimization.py         RGS
  ──────────────               ────────────────────         ─────
  Genera N "books"       →     Asigna un PESO a cada  →     Sortea un book
  (rondas completas,           book para que la             según el peso.
  con todos sus eventos)       distribución final           El resultado ya
  agrupados por criteria       cumpla RTP / hit /           estaba escrito.
  con quotas forzadas          volatilidad
```

**Punto clave para entender todo el resto del informe:** la probabilidad real de
cualquier evento **no** la fija el código de simulación — la fija el peso que el
optimizer le asigna a cada book en la lookup table. Las quotas de `game_config.py`
(`quota=0.03`, `quota=0.1`, …) solo dicen *cuántos books de cada tipo fabricar*, no con
qué frecuencia salen en el juego.

### 2.1 Etapa 1 — Simulación (`gamestate.py`, `game_executables.py`)

- Tablero **6×5** (30 celdas), **cluster pays**: mínimo 5 símbolos iguales conectados
  ortogonalmente (BFS del SDK, `Cluster.get_clusters`). W sustituye todo menos S.
- **Tumble**: los clusters ganadores explotan, caen símbolos nuevos, se re-evalúa. El
  loop corre mientras `totalWin > 0` y no se haya tocado el wincap.
- **Tumble multiplier**, progresión `[1,2,4,8,12,20,50,100,200,500]`, avanza un paso por
  tumble y **resetea cada spin**. No hay multiplicador persistente (el SMASH Meter de KS1
  se eliminó).
- Scoring: `pago_del_símbolo × tumble_mult × 1` (`game_calculations.py:evaluate_clusters_tumble`;
  `persistent_mult` está clavado en 1 y solo sobrevive porque el shape del meta es
  obligatorio para `Cluster.record_cluster_wins`).
- **Free spins**: 4+ scatters en el drop inicial → 10/15/20 spins. 3+ dentro de FS → +5.
  Red de seguridad `max_total_fs = 200` contra runaway de retriggers.
- **KASH RAMPAGE**: convierte TODAS las celdas L1–L4/M1–M2 del tablero a High
  (H1 .45 / H2 .30 / H3 .25) o Premium H4 (15%). Nunca toca W ni S, nunca dispara en
  tumbles — solo en el drop inicial de un spin.

El contrato de emisión está bien resuelto (lección N3 de Kash Smash): `draw_board(emit_event=False)`
→ mutación del board → `reveal_event` → `kashRampage`. El reveal serializado ya contiene
el board convertido, y el evento solo alimenta la animación.

### 2.2 Cómo se decide *cuándo* hay rampage — difiere por modo

Esto es lo más sutil del diseño y conviene tenerlo claro:

| Modo | Mecanismo | Dónde se fija la frecuencia |
|---|---|---|
| `base` (spin base) | **Forzado** por `Distribution(criteria="rampage")` con `force_rampage=True` | Peso que el optimizer da a esos books |
| Free spins naturales | **Roll i.i.d. por spin**, `prob_per_spin["base_freegame"] = 1/10` | El código |
| `vault_crack` / `smash_mode` / `rage_mode` | **Roll i.i.d. por free spin**, `1/8`, `1/5`, `1/2.3` | El código, *sesgado luego por el optimizer* |

Es decir: en base la frecuencia es **emergente** (la decide el optimizer); en los buys
está en el código pero el optimizer la **distorsiona** al favorecer los books que más
pagan (ver [§6.2](#62-frecuencia-entregada-vs-configurada)).

### 2.3 Etapa 2 — El optimizer y las "fences"

`game_optimization.py` divide el espacio de payouts en **fences disjuntas por rango** y
le pide a cada una un RTP y un hit rate objetivo. Ejemplo de `rage_mode`:

| fence | rango de payout (x-bet) | rtp objetivo | hr objetivo | av implícito |
|---|---|---|---|---|
| wincap | = 5000 | 0.011 | — | 5000x |
| big | 2000 – 4999.9 | 0.059 | 1/95 | 2802.5x |
| mid | 500 – 1999.9 | 0.644 | 1/3.0166 | 971.3x |
| freegame | 0 – 499.9 | 0.251 | 1/1.51515 | 190.2x |

Y la restricción que el SDK verifica es que **Σ rtp = 0.965**. Eso se cumple en los 4
modos. Lo que el SDK **no** verifica es la segunda restricción, implícita pero igual de
dura, y ahí está el bug del punto siguiente.

---

## 3. 🔴 Hallazgo #1 — `rage_mode` entrega 96.1993%

### 3.1 Lo medido

RTP exacto calculado sobre `library/publish_files/lookUpTable_rage_mode_0.csv`
(250.000 entradas, suma de pesos = 1.129e15):

```
rage_mode  RTP = 96.1993%    target 96.50%    déficit -0.3007 pp
```

`verify_10m.py` (tolerancia ±0.05%) **falla** contra esta tabla.

### 3.2 La causa raíz

En un buy mode **no existe la fence `"0"`**, así que las probabilidades de las fences
tienen que sumar exactamente 1. Si suman más, el optimizer normaliza y **el RTP entregado
queda escalado por el mismo factor**:

```
RTP_entregado = 0.965 / Σ P_fence
```

Calculando `Σ P_fence = P(wincap) + 1/hr_big + 1/hr_mid + 1/hr_freegame` para cada modo:

| modo | Σ P_fence | exceso | RTP predicho | **RTP medido** | error |
|---|---|---|---|---|---|
| vault_crack | 1.0000170 | +0.0017% | 96.4984% | **96.4984%** | 0 |
| smash_mode | 1.0000048 | +0.0005% | 96.4995% | **96.4995%** | 0 |
| rage_mode | **1.0031260** | **+0.3126%** | **96.1993%** | **96.1993%** | 0 |

La predicción coincide con lo medido **hasta el sexto decimal en los tres modos**. No es
una coincidencia ni un problema estadístico: el optimizer hizo exactamente lo que se le
pidió. Las fences de rage están **sobre-suscritas en probabilidad en un 0.3126%**, y el
RTP cae exactamente ese 0.3126%.

Confirmación adicional: al comparar target vs. realizado fence por fence, **cada fence
alcanza su `av_win` objetivo con precisión perfecta** (2802.5 → 2802.5; 971.3 → 971.3;
190.2 → 190.2) y **todas** entregan una probabilidad ~0.3126% baja. Ese patrón uniforme
es la firma de una normalización, no de una falta de books en el pool.

### 3.3 Por qué las 10 iteraciones anteriores no lo arreglaron

Los comentarios de `run.py`, `game_config.py` y `game_optimization.py` documentan un
proceso largo que atribuyó el déficit a otras causas:

| Iteración documentada | Diagnóstico asumido | Realidad |
|---|---|---|
| iter 7 | "av de big demasiado alto para el pool" → 4037 → 2800 | La fence ya alcanzaba su av |
| iter 8 | "el pool de wincap capea el peso" → rtp 0.015 → 0.011 | Bajar P(wincap) **redujo** el exceso pero no lo eliminó |
| iter 10 | "las ventanas de score cortas subestiman las colas" → `rage_params` | No afecta la restricción de suma |
| 26-08 | "límite del pool de 100k sims" → re-sim con 250k | La corrida de 250k dio **exactamente 96.1993%** otra vez |
| 26-08 | `prob_per_spin` 1/2.5 → 1/2.3 "para enriquecer las bandas altas" | No mueve `Σ P_fence` |

El `HANDOFF.md` del frontend todavía dice *"es límite del pool chico; la corrida de
producción (buys 250k) debería cerrarlo a 96.50"*. Eso quedó desmentido: la corrida de
250k está publicada y da el mismo número.

### 3.4 El fix

Una sola línea en `game_optimization.py` (fence `mid` de `rage_mode`):

```python
# hoy
("mid", (500, 1999.9), 0.644, 3.0166),   # Σ P = 1.0031260 → RTP 96.1993%
# fix
("mid", (500, 1999.9), 0.644, 3.0453),   # Σ P = 1.0000000 → RTP 96.5000%
```

Verificación del fix:
- `P_mid` necesario = `1 − 0.0011 − 1/95 − 1/1.51515` = **0.328373** → `hr = 3.0453`
- `av_mid` resultante = `0.644 × 500 / 0.328373` = **980.6x** → sigue dentro del rango
  `(500, 1999.9)` de la fence ✅
- `Σ rtp` no cambia (sigue 0.965) → `verify_optimization_input` sigue pasando ✅

Requiere **re-correr solo el optimizer de rage** (`run_sims: False`, `run_optimization: True`,
`target_modes = ["rage_mode"]`); los books actuales sirven.

> **Recomendación de proceso:** agregar a `verify_10m.py` (o al preflight) un assert de
> `Σ P_fence == 1.0 ± 1e-6` por buy mode, leyendo `library/configs/math_config.json`.
> Es la clase de error que el SDK no atrapa y que costó ~10 iteraciones.

---

## 4. Estado medido de los 4 modos

Todo calculado de forma exacta sobre las lookup tables publicadas.

| Modo | Costo | **RTP** | std (x-bet) | std (x-costo) | P(win < costo) | Hit rate | P(wincap) |
|---|---|---|---|---|---|---|---|
| `base` | 1x | **96.5000%** ✅ | 26.699 | 26.70 | 96.26% | 21.99% | 1/45.455 |
| `vault_crack` | 100x | **96.4984%** ✅ | 139.46 | 1.395 | 66.00% | 100% | 1/5.000 |
| `smash_mode` | 250x | **96.4995%** ✅ | 359.20 | 1.437 | 66.00% | 100% | 1/2.016 |
| `rage_mode` | 500x | **96.1993%** ❌ | 582.79 | 1.166 | 65.79% | 100% | 1/934 |

Notas de lectura:
- El "hit rate 100%" de los buys es literal pero engañoso: el pago mínimo es 0.6x la
  apuesta base (0.006x el costo de vault). Lo que importa es el **66% de rondas que
  devuelven menos de lo que costaron**.
- La `std` de los buys se declara en `config.json` relativa al **costo del modo**
  (1.39 / 1.44 / 1.17), no a la apuesta base.

### 4.1 Base — descomposición del RTP

| criteria | P (peso optimizado) | 1 en… | aporte al RTP |
|---|---|---|---|
| `0` (sin premio) | 0.780111 | — | 0.000% |
| `basegame` | 0.211567 | 1/5 | 39.562% |
| `freegame` | 0.005096 | **1/196** | 36.608% |
| `rampage` | 0.003204 | **1/312** | 9.330% |
| `wincap` | 0.000022 | 1/45.455 | 11.000% |
| | | | **96.500%** ✅ |

- **Hit rate = 21.989%** contra el target de 22% — ✅ exacto.
- **Split base/bonus: 48.99% / 47.51%** — casi mitad y mitad, un perfil de bonus-driven
  clásico y coherente con "Extreme".
- Free spins **1/196** contra el `hr=200` objetivo ✅.

### 4.2 Distribución de payouts en base (bandas del check 40)

| Banda (x-bet) | Probabilidad | 1 en… |
|---|---|---|
| 0 (sin premio) | 78.0111% | — |
| 0 – 1x | 18.2510% | 1/5 |
| 1 – 2x | 0.2457% | 1/407 |
| 2 – 5x | 0.6413% | 1/156 |
| 5 – 10x | 0.8104% | 1/123 |
| 10 – 20x | 1.5333% | 1/65 |
| 20 – 50x | 0.2357% | 1/424 |
| 50 – 100x | 0.1915% | 1/522 |
| 100 – 250x | 0.0665% | 1/1.503 |
| 250 – 500x | 0.0013% | 1/79.231 |
| 500 – 1000x | 0.0040% | 1/25.052 |
| 1000 – 2000x | 0.0056% | 1/17.754 |
| 2000 – 3000x | 0.00034% | 1/290.436 |
| **3000 – 5000x** | **0.00003%** | **1/3.161.989** ⚠️ |
| ≥ 5000x (wincap) | 0.0022% | 1/45.455 |

Las tres sub-bandas del check 40 tienen peso > 0, así que el check pasa formalmente.
Pero **3000–5000x a 1/3.16M es prácticamente vacía**: un reviewer que muestree la tabla
va a ver cero. Vale la pena subir el `scale_factor` del dress de `big` en ese rango
(hoy 1.3) o agregarle `probability` explícita.

Nota estructural: la banda **250–500x (1/79.231) es más rara que 500–1000x (1/25.052)**.
Es un artefacto de que la fence `rampage` corta en 499.9 y la fence `big` arranca en 500;
el optimizer llena los bordes de forma desbalanceada. No es un error, pero produce una
curva de payout no monótona que puede llamar la atención en revisión.

---

## 5. Hallazgo #3 — La escalera de volatilidad de los buys está invertida

El diseño declarado (README, `game_optimization.py`) es:
**vault = Medium · smash = High · rage = Extreme**.

Lo medido, en las unidades que percibe el jugador (múltiplos del costo del modo):

| Modo | Costo | **Max win posible** | std / costo | p99 | p99.9 |
|---|---|---|---|---|---|
| `vault_crack` | 100x | **50x** el costo | 1.395 | 4.41x | 15.63x |
| `smash_mode` | 250x | **20x** el costo | **1.437** | **6.64x** | 15.50x |
| `rage_mode` | 500x | **10x** el costo | **1.166** ⬇ | 4.21x | **10.0x** (topado) |

**`rage_mode` es el modo menos volátil de los tres**, no el más. Y no es un problema de
tuning: es **estructural**. Con un wincap fijo en 5000x la apuesta base, cuanto más caro
el buy, menos veces su propio precio puede devolver:

```
vault (100x)  →  techo  50x el costo
smash (250x)  →  techo  20x el costo
rage  (500x)  →  techo  10x el costo   ← el p99.9 YA toca el techo
```

En rage, el percentil 99.9 **es** el wincap. No hay cola que estirar. Vender rage como
"Extreme" es matemáticamente inalcanzable mientras el cap sea 5000x y el precio 500x.

**Opciones:**
1. **Bajar el precio de rage** (p. ej. 300x → techo 16.7x) para recuperar rango de cola.
2. **Reposicionar el mensaje**: rage no es "más volátil", es "más rampages por spin"
   (4.88 vs 2.59 vs 1.60) — es un modo de *frecuencia*, no de *varianza*. La copy ya casi
   dice esto ("More rampages, more chaos"); alinear la etiqueta de volatilidad.
3. Aceptar la compresión y **declarar los tres buys como High**, que es lo que el gauge va
   a medir.

También conviene revisar la validación cruzada: `HANDOFF.md` valida "vault Medium ✓ /
smash High ✓" usando la std en x-bet (136, 354), pero el gauge del ACP se calibró sobre
la std de **base** (9.76 / 14.56 / 27.14). Comparar la std absoluta de un buy de 250x
contra un gauge calibrado en base es comparar unidades distintas.

---

## 6. KASH RAMPAGE — comportamiento estadístico real

Medido leyendo el stream de eventos de los books publicados, ponderado por los pesos del
optimizer.

### 6.1 En base

| Métrica | Valor medido |
|---|---|
| P(ronda con ≥1 rampage) | **1/135** |
| … de las cuales también hay free spins | 1/238 |
| P(spin base con rampage forzado, `criteria="rampage"`) | 1/312 |
| Celdas convertidas por evento | mediana **22**, rango 11–30 |
| Tasa de premium (H4) real | **15.02%** (config: 15%) ✅ |

La mecánica funciona exactamente como está especificada. La conversión toca **~73% del
tablero** por evento — es un evento masivo, no un accent, y eso explica su av alto
(~68x según el harness) y por qué necesita ser raro.

**Discrepancia de documentación:** hay tres números distintos circulando para P(rampage
en base):

| Fuente | Dice | Correcto |
|---|---|---|
| `game_optimization.py` (comentario) | "≈ 1/1100 spins" | ❌ Es el hr de la **fence**, no del evento |
| `HANDOFF.md` | "≈ 1/126 visible total" | ✅ Cercano (medido: 1/135) |
| Medido en esta corrida | **1/135** | — |

El "1/1100" del comentario es engañoso: la fence `rampage` está definida **por rango de
payout (20–499.9)**, no por criteria, así que los books de rampage que pagan <20x los
absorbe el catch-all `basegame` y los que pagan ≥500x se los lleva `big`. La suma de todo
eso es 1/312 para el rampage forzado en base, y 1/135 contando los que ocurren dentro de
free spins.

### 6.2 Frecuencia entregada vs. configurada (buys)

Acá hay un efecto que conviene entender bien: **el optimizer sesga la frecuencia**. Como
los books con más rampages pagan más, y el optimizer sube el peso de los books que
necesita para llegar al RTP, la frecuencia efectiva termina **por encima** de la
configurada:

| Modo | `prob_per_spin` configurado | **Entregado (medido)** | Desvío | Rampages por ronda |
|---|---|---|---|---|
| `vault_crack` | 1/8 | **1/6.62** | **+21%** | 1.60 |
| `smash_mode` | 1/5 | **1/4.13** | **+21%** | 2.59 |
| `rage_mode` | 1/2.3 | **1/2.22** | +4% | 4.88 |

Ninguna de esas cifras coincide con lo que dice el juego (ver §8). Los comentarios de
`game_config.py` ("Rampages esperados por bonus: vault ~1.25 · smash 2 · rage ~3.3")
también quedaron desactualizados — lo real es **1.60 / 2.59 / 4.88**.

Free spins por ronda (con retriggers): 10.57 / 10.67 / 10.82. P(retrigger) ≈ 10–14%.

---

## 7. Hallazgo #4 — La mitad de la escalera del tumble multiplier es inalcanzable

Progresión declarada: `[1, 2, 4, 8, 12, 20, 50, 100, 200, 500]`.
Máximo multiplicador alcanzado por ronda, ponderado:

| | x1 | x2 | x4 | x8 | x12 | x20 | x50 | x100 | **x200** | **x500** |
|---|---|---|---|---|---|---|---|---|---|---|
| `base` | 78.01% | 19.94% | 1.556% | 0.418% | 0.072% | 0.0007% | 0.0002% | — | **0** | **0** |
| `vault_crack` | 0.008% | 39.92% | 47.86% | 10.67% | 1.41% | 0.126% | 0.0115% | 0.0030% | **0** | **0** |
| `smash_mode` | 0.019% | 29.54% | 54.28% | 14.03% | 1.91% | 0.201% | 0.0159% | 0.0048% | **0** | **0** |
| `rage_mode` | 0.041% | 20.40% | 57.17% | 19.22% | 2.86% | 0.278% | 0.0317% | 0.0054% | **0** | **0** |

- **x200 y x500 nunca se alcanzan en ninguno de los 4 modos**, en 850.000 books.
- En base, la escalera muere efectivamente en **x12**: x20 es 1/150.000 y x50 es
  1/452.000. El 98% de los spins de base nunca pasa de x2.
- La razón es simple: llegar a x200 requiere **8 tumbles encadenados** en un solo spin.
  La distribución de tumbles en base es 78% cero / 19.7% uno / 1.3% dos; con 9+ tumbles ya
  estás en 0.027%, y el wincap corta antes de llegar arriba.

**Implicancia:** si la escalera se muestra al jugador (paytable, HUD, rules), hay dos
pasos que son publicidad de algo que no puede pasar. Opciones: (a) recortar la progresión
a `[1,2,4,8,12,20,50,100]`, (b) comprimir los saltos para que la cola sea alcanzable, o
(c) dejarla y no exponer x200/x500 en la UI.

---

## 8. Hallazgo #2 y #5 — Inconsistencias math ↔ documentación ↔ frontend

Esto es lo que más riesgo de rechazo tiene, porque son **declaraciones al jugador** que
no coinciden con la math entregada.

| Dónde | Dice | La math entrega | Estado |
|---|---|---|---|
| `Game.svelte` tabla de rules (ES línea ~320, EN ~497) | RAGE MODE RTP **96.5%** | **96.1993%** | 🔴 Falso |
| `library/configs/config.json` | `rage_mode: rtp 0.965` | 96.1993% | 🔴 Falso |
| `library/configs/math_config.json` | `rage_mode: rtp 0.965` | 96.1993% | 🔴 Falso |
| `Game.svelte:320` (tabla) | rage ≈ **1/2.5** spins | 1/2.22 | 🟠 |
| `Game.svelte:408 / :584` (párrafo) | rage ≈ **1/2.3** | 1/2.22 | 🟠 (y **contradice a la tabla del mismo documento**) |
| `Game.svelte:99` (tooltip del buy) | "about **1 in 2.5** spins" | 1/2.22 | 🟠 |
| `Game.svelte` tabla + tooltips | vault ≈ 1/8 | **1/6.62** | 🟠 |
| `Game.svelte` tabla + tooltips | smash ≈ 1/5 | **1/4.13** | 🟠 |
| `Game.svelte:278 / :455` | "Volatilidad **Extreme**" (global) | rage es el menos volátil de los buys | 🟠 |
| `game_optimization.py` (comentario) | rampage en base ≈ 1/1100 | 1/135 (1/312 forzado) | 🟡 Doc |
| `game_config.py` (comentario) | rampages/bonus: 1.25 / 2 / 3.3 | **1.60 / 2.59 / 4.88** | 🟡 Doc |
| `HANDOFF.md` | rage 96.20% "es límite del pool chico" | Es error aritmético; 250k dio lo mismo | 🟡 Doc |
| `README.md` | base std **≥27** (Extreme) | **26.699** | 🟡 Marginal |
| `config_fe_kash_rampage_extreme.json` | `gameName: "sample_lines"` | — | 🟡 Resto del template |

**El más grave es el primero.** Declarar 96.5% y entregar 96.2% es exactamente el tipo de
hallazgo que dispara un rechazo. Nótese además que el `config.json` que se sube al ACP
declara `rtp: 0.965` para rage — el ACP mide la tabla y va a ver 96.1993%.

La contradicción interna del frontend (tabla dice 1/2.5, párrafo dice 1/2.3, en el mismo
documento de rules) también es un hallazgo típico de review.

---

## 9. Hallazgo #7 — El stat sheet reporta frecuencias sin ponderar

`library/statistics_summary.json` y el `.xlsx` reportan `hr_summary` / `custom_hr_summary`
calculados sobre el **conteo crudo de books simulados**, no sobre los pesos del optimizer.

Ejemplo concreto:

```
custom_hr_summary.base["scatter"] = 10.19    →  se lee como "free spins 1 de cada 10 spins"
  count = 9802 / 100000 sims = 9.8%          →  pero eso es la QUOTA forzada de la simulación
  Frecuencia REAL en el juego (ponderada)    →  1/196
```

**Está mal por un factor de 20.** Lo mismo aplica a todas las filas de `hr_summary`.
No es un bug de la math — es cómo el SDK arma el stat sheet — pero cualquiera que abra el
`.xlsx` para responder "¿cada cuánto entra el bonus?" va a dar una respuesta 20x
equivocada. Las cifras confiables son las de las lookup tables (las de este informe).

Conviene dejar esa advertencia escrita al lado del `.xlsx` antes de que alguien la use
para la ficha del juego o para responderle al reviewer.

---

## 10. Estado de la corrida y del entry point

- Los 4 books publicados verifican SHA-256 y payout hash OK contra sus sidecars
  (`[FAST PATH] ... SHA-256 OK, payout hash OK` en `run_rage_iter_2608.log`).
- Tamaños: base 37 MB · vault 442 MB · smash 487 MB · rage 620 MB comprimidos. El comentario
  de `run.py` dice que 250k sims ≈ 400 MB es "seguro para el uploader del ACP" — **rage
  está en 620 MB**, un 55% por encima de esa referencia. Conviene confirmar el límite real
  del uploader antes del submit; el precedente de KS1 fue `ERR_MISSING_FILE` por truncado
  silencioso.
- `run.py` quedó configurado para la iteración de rage:
  ```python
  num_sim_args = {"rage_mode": int(2.5e5)}
  target_modes = ["rage_mode"]   # "restaurar los 4 tras cerrar rage"
  ```
  Una re-corrida tal cual **no regenera base / vault / smash**. Está documentado en el
  propio archivo, pero es una trampa activa para quien retome.
- `verify_10m.py` necesita `numpy`, que **no está** en el `.venv/` de la raíz del repo —
  hay que usar el env del math SDK (`stake-math-sdk/env/`), como indica el HANDOFF.

---

## 11. Acciones recomendadas, en orden

| # | Acción | Esfuerzo | Desbloquea |
|---|---|---|---|
| 1 | `game_optimization.py`: `rage_mode` fence `mid` **hr 3.0166 → 3.0453** | 1 línea | RTP 96.50% |
| 2 | Re-correr **solo el optimizer** de rage (`run_sims: False`, `run_optimization: True`, `target_modes=["rage_mode"]`) + `verify_10m.py` | ~10 min | Cierra el hallazgo bloqueante |
| 3 | Agregar assert `Σ P_fence == 1.0 ± 1e-6` por buy mode al preflight | ~20 líneas | Evita la reincidencia |
| 4 | Actualizar las frecuencias de rampage del frontend a las **medidas** (1/6.6, 1/4.1, 1/2.2) y resolver la contradicción 2.3 vs 2.5 | Copy | Consistencia de rules |
| 5 | Decidir el posicionamiento de volatilidad de rage (bajar precio, o re-etiquetar) | Diseño | Hallazgo #3 |
| 6 | Recortar o no exponer los pasos x200 / x500 del tumble multiplier | Copy/config | Hallazgo #4 |
| 7 | Subir el peso de la banda 3000–5000x en base (dress de `big`) | 1 línea | Robustez del check 40 |
| 8 | Actualizar comentarios obsoletos (`1/1100`, `1.25/2/3.3`, "límite del pool") y `gameName: sample_lines` | Doc | Higiene pre-submit |
| 9 | Restaurar `run.py` a los 4 modos antes de la corrida final | 2 líneas | Evita re-sim parcial |
| 10 | Confirmar el límite real del uploader del ACP para el book de 620 MB | Consulta | Riesgo de truncado |
| 11 | Anotar en el `.xlsx` que `hr_summary` es sin ponderar | Doc | Evita malinterpretación |

Con la acción #1 + #2, los 4 modos quedan en 96.50% y `verify_10m.py` pasa limpio. Las
demás son de consistencia y presentación, no de math.

---

## Anexo A — Metodología

Todas las cifras de RTP, std, probabilidades y bandas son **exactas** (no muestreadas):
se calcularon sumando `Σ pᵢ · xᵢ` sobre las 100.000 / 250.000 filas de cada lookup table
publicada, con `pᵢ = wᵢ / Σw`, usando `math.fsum` para evitar pérdida de precisión.

Las frecuencias de eventos (rampage, tumble multiplier, free spins por ronda) se
obtuvieron descomprimiendo los 4 `books_*.jsonl.zst` completos (850.000 books,
~1.6 GB comprimidos), recorriendo el stream de eventos de cada book y **ponderando cada
observación por el peso que esa entrada tiene en la lookup table** — que es la única forma
de obtener la frecuencia que percibe el jugador.

Las probabilidades por criteria se obtuvieron haciendo join entre
`library/lookup_tables/lookUpTableSegmented_<modo>.csv` (que trae el tag de criteria y el
split basegame/freegame por book id) y los pesos de
`library/publish_files/lookUpTable_<modo>_0.csv`.

**Fuente de datos:** corrida de producción del 26-08-2026 tal como está publicada hoy en
`library/publish_files/`. No se re-simuló ni se modificó nada.

**Advertencia sobre el `.xlsx` y `statistics_summary.json`:** esos archivos NO ponderan
por el optimizer (ver §9). Sus `hr_summary` reflejan las quotas de simulación, no el juego.
