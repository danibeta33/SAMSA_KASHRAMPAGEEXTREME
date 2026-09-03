# Dead Heat — Modificadores y buffs (y comparación con Court Heat de Jack)

Actualizado 13-08-2026. Fuentes: `stake-math-sdk/games/dead_heat/` (game_config.py,
gamestate.py), `stake-web-sdk/apps/dead-heat/src/` (BluffShot, ModifierSeal),
y `dead-heat/Jack Upload/` (court_heat_model.py, main.js). Ver también
`06-court-heat-reference.md` §7 para el detalle de implementación de Jack.

---

## 1. Cómo se ganan (el marco de cada juego)

| | **Dead Heat** | **Court Heat (Jack)** |
|---|---|---|
| Trigger | Bluff tira ANTES del reveal (`baseShot`); si encesta, cae 1 modificador del pool | Los DOS personajes (Rook y Vex) tiran en cada spin; cada enceste otorga 1 modificador a su dueño |
| Doble | No existe en base (1 tiro por spin) | "DOUBLE BUCKET": ambos encestan → 2 modificadores en el mismo spin (con takeover visual propio) |
| Bonus | Buffs por posesión, POOL DISTINTO POR RIVAL (§3) | Mismos 4 modificadores del base dentro del 1v1 |
| Momento | Casi todos PRE-reveal (el board ya viene modificado); sweeps POST-reveal | Todos POST-reveal (el cliente ve el board y luego lo muta) |

Esa última fila explica la diferencia de presentación histórica: Jack siempre pudo
mostrar la conversión sobre el board visible; nosotros lo logramos el 13-08 con el
truco del board-de-relleno + sello (`ModifierSeal.svelte`).

## 2. Modificadores del BASE de Dead Heat

Pool del tiro de Bluff (`game_config.py:170`, pesos sobre 100):

| Modificador | Peso | Efecto (math) | Presentación (13-08) |
|---|---|---|---|
| `WILD_RAIN` | 45 | 2–3 wilds en celdas al azar del próximo reveal (`wild_rain_cells.base`) | Orbe con W → board cae con rellenos → mini-orbes estampan cada wild (seal) |
| `SPIN_MULT_2` | 25 | Win del spin ×2 | Orbe "2X" + badge (no toca el board) |
| `SPIN_MULT_3` | 15 | Win del spin ×3 | Ídem ×3 |
| `SPIN_MULT_5` | 5 | Win del spin ×5 | Ídem ×5 (color rosa) |
| `LOW_SWEEP` | 10 | POST-reveal: elimina los símbolos LOW del board y compacta (`boardAfter`) | Banda de luz barre el board reventando las celdas → settle |

## 3. Buffs del BONUS (pool por rival)

Se cosechan encestando en las posesiones (`possessionStart.shots[].buff`). Cada
rival tiene identidad mecánica (`game_config.py:183-200`):

**Ash (60×, arranca 3-0)** — ritmo/tempo:
| Buff | Peso | Efecto |
|---|---|---|
| `QUICK_HANDS` | 32 | UPGRADE de todos los LOW→MED (L1/L2→M1, L3/L4→M2) |
| `FAST_BREAK` | 30 | = wildRain de 2–3 celdas |
| `HEAT_2` | 20 | +2 al multiplicador PERSISTENTE del bonus |
| `EXTRA_SHOT` | 18 | Tiro extra en la posesión (con cap; al agotarse sale del pool) |

**Watts (100×, arranca 5-0)** — fuerza bruta:
| Buff | Peso | Efecto |
|---|---|---|
| `BACKBOARD_BREAK` | 44 | = lowSweep post-reveal (dos en la misma posesión = dos sweeps) |
| `HEAT_3` | 30 | +3 al mult persistente |
| `HEAT_5` | 16 | +5 al mult persistente |
| `WILD_SLAM` | 10 | Bloque 2×2 de wilds |

**Otto (200×, arranca 7-0)** — información/precisión:
| Buff | Peso | Efecto |
|---|---|---|
| `INTEL` | 38 | UPGRADE de todos los MED→HIGH (M1→H1, M2→H2) |
| `HEAT_1` | 22 | +1 al mult persistente |
| `WILD_RAIN` | 14 | wildRain ampliado: 2–4 celdas (`wild_rain_cells.WILD_RAIN`) |
| `CAMERA_HACK` | 12 | Convierte una CÁMARA del board de Otto en celda-wild con mult; si no hay cámaras libres se re-rollea a otro buff; cap de 3 celdas-wild activas |

Buy perks (elección de card en el buy): `GUARANTEED_MAKE_P1` (enceste asegurado
en la posesión 1) y `EXTRA_SHOT_P1`.

## 4. Los 4 modificadores de Court Heat (Jack)

`court_heat_model.py:66` (pesos) + presentación en `main.js:1887-2044`:

| Modificador | Efecto | Presentación (la referencia) |
|---|---|---|
| `multiplier` (×2..×25) | Multiplica la win del spin | Badge "NX" con disco cae del aro al centro rebotando + punch |
| `stackedWild` | Columna ENTERA de wilds | Beam vertical sobre el reel → cada celda se convierte con pop escalonado |
| `wildRespin` | Pone wilds, los BLOQUEA y respinea el resto del board | Candados sobre las celdas locked → respin real con celdas quietas → candados fade |
| `lowSweep` | Elimina los LOW y reemplaza el board | Barredora cruza el grid; cada celda barrida cae/rota/fade → redraw |

Común a todos: zoom de cámara al centroide de las celdas afectadas, orbe
(`energyDrop`) con el payload visible, y `chargeBackboard` (el tablero "se carga")
antes de aplicar.

## 5. Comparativa directa

**Equivalencias:**
| Dead Heat | Court Heat | Diferencia |
|---|---|---|
| `WILD_RAIN` / `FAST_BREAK` | `stackedWild` | El nuestro es disperso (2–4 celdas random); el de Jack es una columna entera (lee más fuerte visualmente) |
| `SPIN_MULT_N` | `multiplier` | Mismo concepto; Jack llega a ×25, nosotros ×5 en base + HEAT persistente en bonus |
| `LOW_SWEEP` / `BACKBOARD_BREAK` | `lowSweep` | Idéntico concepto y presentación (nuestra banda es port de la suya) |
| `WILD_SLAM` (2×2) | — | Nuestro; entre el rain y la columna de Jack en potencia |

**Lo que Jack tiene y nosotros NO:**
- `wildRespin`: wilds con CANDADOS + respin real del resto del board. Es su
  modificador más espectacular y el único con mecánica de re-giro. Si dirección
  quiere sumarlo alguna vez, es cambio de MATH (nuevo evento con `lockedPositions`
  + segundo reveal), no solo de presentación. La presentación está lista para
  copiar (main.js:1986).
- Double Bucket: 2 modificadores apilados en el mismo spin con takeover propio.
- Zoom de cámara al foco del modificador (nosotros aún no tenemos cámara).

**Lo que nosotros tenemos y Jack NO:**
- Pools de buffs POR RIVAL (identidad mecánica por bonus) + pesos re-balanceados.
- `HEAT_N`: multiplicador PERSISTENTE que escala durante todo el bonus (Jack solo
  tiene mult por spin).
- UPGRADES de tier (`QUICK_HANDS` LOW→MED, `INTEL` MED→HIGH) — transforman la
  calidad del board sin wilds.
- `CAMERA_HACK` + celdas-cámara de Otto (mecánica de tablero propia del rival).
- `EXTRA_SHOT` (más tiros = más buffs en la misma posesión) y buy perks por card.
- Nuestro bonus es catch-up real (termina cuando te empatan), el de Jack también
  pero con marco fijo 2-0 y un solo rival.

**Estado de presentación nuestro (13-08):** wildRain/wildSlam/upgrade/cameraHack
se ven celda a celda (seal), lowSweep con barrido, spinMult con orbe+badge, HEAT
con el badge persistente. Pendiente de dirección: zoom al foco tipo Jack y retener
el orbe hasta el centroide de las celdas.
