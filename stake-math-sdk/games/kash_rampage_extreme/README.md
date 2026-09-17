# Kash Rampage Extreme — Math SDK

Lucky Bastards Studio · secuela de Kash Smash: The Vault (LIVE 28-07-2026) ·
Stake Engine submission target.

**Fork de `games/kash_smash` (Fase 0).** GDD preliminar: PDF "Listado General de
Cambios Kash Rampage Extreme vs. Kash Smash 1" + decisiones del 28-07. Roadmap y
parámetros abiertos en `stake-web-sdk/apps/kash-rampage-extreme/HANDOFF.md`.

## Game summary (target KRE)

- 6x5 grid, cluster pays (min 5 connected, SDK BFS)
- Tumbling reels con tumble multiplier por spin
  (`[1, 2, 4, 8, 12, 20, 50, 100, 200, 500]`, resetea cada spin)
- **SIN persistent multiplier** — el SMASH Meter de KS1 se elimina (Fase 1)
- **KASH RAMPAGE** (mecánica de firma, Fase 1): probabilístico en base + los 3
  buy modes; convierte TODOS los L1-L4/M1-M2 de la grilla a High (85%,
  H1-H3 ponderado) o Premium (15%, H4). Evento book `kashRampage` con
  `conversions` (posiciones con padding +1), emitido POST-reveal — lección N3:
  el reveal serializado ya debe contener el board convertido.
- Wild (W) sustituye todo menos scatter; Scatter (S) no paga, 4+ en el board
  dispara free spins, 3+ en free spin retriggerea (+5). El conteo es
  POST-tumble (`check_fs_condition` corre después del loop de cascadas, ver
  `gamestate.py`), o sea que los scatters que caen en un tumble SÍ cuentan
- 4 bet modes: `base` (1x), `vault_crack` (100x), `smash_mode` (250x),
  `rage_mode` (500x). IDs internos heredados de KS1 a propósito — solo cambian
  los títulos display en el frontend.
- Volatilidad target: base **Extreme (22% hit freq, std ≥27)** · buys
  escalonados **Medium / High / Extreme**. RTP 96.5% exacto los 4 modos
  (tope ACP 96.70%). Wincap 5000x.

## Estado

- **Fase 0 (actual)**: fork con la mecánica KS1 todavía dentro (Kash Smash
  wilds, Force Wild, persistent mult) — se remueve en Fase 1. El criteria
  "freegame" duplicado del check-40 de KS1 fue ELIMINADO en el fork (base
  re-simulable sin la trampa N3.7; ver nota en `game_config.py`). `run.py`
  quedó en sims chicas (10k/modo) para el smoke.
- **Fase 1**: remover mecánicas KS1 → implementar KASH RAMPAGE → retune.
  Knobs en `game_optimization.py` (base hoy `basegame hr=3.5` → arranque
  KRE ≈5.2 contando el aporte del rampage). Gauge del ACP medido en KS1
  (std de base): 9.76=LOW · 14.56=MEDIUM · 27.14=EXTREME.

## Run

```bash
# desde la raíz del math SDK
make run GAME=kash_rampage_extreme
# verificación estadística sobre las LUT finales
env/bin/python games/kash_rampage_extreme/verify_10m.py
# validador de esquema de books
cd <raíz de samsa-games> && .venv/bin/python .scripts/validate_books.py --game kash_rampage_extreme
```

Outputs en `library/publish_files/` (books, lookup tables) y `library/`
(stats, analytics).

## Symbol-to-narrative mapping (frontend only)

La math usa IDs genéricos (sin cambios vs KS1). El arte/labels de KRE:

| ID  | KRE (nuevo arte)          | KS1 (placeholder actual) | Tier    |
| --- | ------------------------- | ------------------------ | ------- |
| L1  | Crowbar                   | Drill                    | Low 1   |
| L2  | Brass Knuckles            | Keycard                  | Low 2   |
| L3  | Molotov Cocktail          | Smoke Grenade            | Low 3   |
| L4  | Exploding Dye-Pack Cash   | Cash Stack               | Low 4   |
| M1  | Nitro Canister            | Vials                    | Med 1   |
| M2  | Stolen Vault Blueprint    | Dossier                  | Med 2   |
| H1  | Bluff (recolor)           | Bluff                    | High 1  |
| H2  | UZI Gun (recolor)         | UZI                      | High 2  |
| H3  | Bomb w/ detonator (recolor)| Bomb                    | High 3  |
| H4  | KASH (recolor)            | KASH                     | Premium |
| W   | Bat (recolor)             | Bat                      | Wild    |
| S   | Gold Bar (recolor)        | Gold Bar                 | Scatter |

Referencia de proceso/approval: `dead-heat/` (KB del studio) y
`stake-approval-playbook.zip`.
