# KASH RAMPAGE EXTREME — Handoff

**Secuela de Kash Smash: The Vault** (live en Stake desde 28-07-2026). Es un juego
nuevo con submission propia, no un parche: slug math `kash_rampage_extreme`, app
`kash-rampage-extreme`. Fork del stack de KS1 (math y frontend) con mecánica nueva
**KASH RAMPAGE**: en algunos spins Kash batea el board y convierte símbolos a
símbolos altos antes de evaluar clusters.

**Referencias obligadas antes de tocar nada:**
- `dead-heat/` (raíz de samsa-games) — knowledge base del studio para approval de
  Stake Engine: checklist, log de rechazos reales, metodología QA, gotchas técnicos.
- `stake-approval-playbook.zip` — suites y proceso. Meta: pasar en 1 ronda.
- GDD en Drive (`00_Project`). ⚠️ El GDD dice board 6×7; el juego **es 6×5** —
  el doc está desactualizado, no el código.

---

## Estado actual

| Fase | Estado |
|---|---|
| F0 — Fork/scaffolding | ✅ Completa |
| F1 — Math (mecánica rampage + retune) | ✅ Completa; **falta verificar la corrida de producción** (ver Pendientes) |
| F2 — Frontend (mecánica) | ✅ Completa |
| F3 — Reskin/arte | 🟡 En curso — kit integrado, faltan assets (ver `UI_SIN_DISENO_KRE_v2.pdf`) |
| F4 — QA + Approval | ⬜ No iniciada |

## Math (`stake-math-sdk/games/kash_rampage_extreme/`)

- Mecánicas de KS1 removidas (wilds persistentes + meter); KASH RAMPAGE
  implementado: evento `kashRampage` con `conversions: [{reel,row,from,to,premium}]`
  (índices con padding +1), orden de emisión `draw_board(emit_event=False)` →
  mutación → `reveal_event` → evento.
- RTP target 0.9650 ±0.0005 en los 4 modos. Con pool de 100k sims:
  - base **96.5000% exacto · hit 22.00% · std 26.7** (Extreme ✓)
  - vault_crack **96.4984% · std 136** (Medium ✓)
  - smash_mode **96.4995% · std 354** (High ✓)
  - rage_mode **96.20%** — sus fences entregan ~99.7% del av implícito; es límite
    del pool chico. La corrida de producción (buys 250k) debería cerrarlo a 96.50;
    si no, subir `prob_per_spin` de rage (nota en `run.py`).
- **Corrida de producción lanzada el 26-08** (base 100k + buys 250k + optimizer):
  logs `run_production_2608.log` y `run_rage_iter_2608.log`. Backup pre-corrida en
  `library_backup_pre_prod_2608/`. **Primer paso del que retome esto**: verificar
  en el log que terminó bien, chequear RTP de rage, validar el gauge del ACP y
  regenerar el mock (`--game kash_rampage_extreme --port 3032`).
- P(rampage) medida en base ≈ 1/126 visible total.
- Lecciones de optimizer documentadas como comentarios en `game_optimization.py`
  (fence sin search = catch-all posicional; no duplicar criteria — rechazo N3.7 de
  KS1; el av implícito debe ser alcanzable por el pool; wincap rtp capado por su pool).
- Env: usar `stake-math-sdk/env/bin/python` (no el `.venv` de la raíz), correr
  desde `games/kash_rampage_extreme/`.

## Frontend (esta app)

- **Board 6×5, clusters + tumble** (base `cluster-tumble-base` vía fork de KS1).
- **Spin = scroll continuo** (mismo port que hizo dead-heat sobre este template):
  el drop inicial usa `createReelForSpinning` con los strips reales de la math
  (`src/game/reels/BR0|FR0.csv` → `paddingReels.ts`, parada por
  `paddingPositions` del book), rebote 0.35 celda, pre-spin backIn, motion blur
  por columna. Tumbles intactos (`TumbleBoard`). **Si la math re-pilotea strips,
  re-copiar los CSV.**
- **Handler `kashRampage`** (nunca no-op), 5 beats: Windup ~400ms · Impact ~200ms
  (shake+flash) · Conversion Wave ~600ms (swap de texturas en orden de
  conversions, stagger 40ms) · Premium Accent ~400ms (pulse en `premium:true`) ·
  Settle ~300ms → recién ahí los clusters. El reveal presenta los símbolos VIEJOS
  (lookahead en el handler `reveal`), Kash batea (`kashSwing` source `'rampage'`,
  swing de KS1 provisorio) y al strike los símbolos estallan en fragmentos
  (`RampageShatterLayer` + `stateRampage`) con caída del símbolo nuevo.
- SMASH Meter eliminado; `FreeSpinCounter` repuesto (countdown de FS es blocker
  de approval).
- **Paleta**: rojo/amarillo `#e02330`/`#f6ef1b` vía CSS vars `--kash-*`
  overrideadas desde `+layout.svelte`. **Los packages del monorepo no se tocan**
  (KS1 está live y los comparte).
- **Arte integrado**: kit del Drive completo (símbolos ×10 con variantes LUZ =
  estado win del cluster, botonera, marco reconstruido ventana-a-ventana, fondo,
  Kash lateral, buy screens full-screen, AutoSpins reskin, paneles FS, logo
  placeholder). h1 y h4 son stand-ins hasta los recolors definitivos.
  `anim_sym_premium` y las anims KS1 de Kash/wild/scatter están **desactivadas a
  propósito** (`KASH_ANIMS_ENABLED` en Background.svelte / `ANIM_SPECIAL` en
  SymbolSprite.svelte) hasta tener el arte recoloreado.
- Drive de assets: `…/01 - Games /15 - Kash Rampage Extreme/` (⚠️ espacio final
  en "01 - Games "). Pipeline de arte generado: Gemini → siempre BiRefNet
  (gotcha del keying documentado en `dead-heat/04-technical-gotchas.md`).
- Herramientas dev: tecla **A** = AnimLab (incluye botón TIRADA BATEO — mock
  `/debug/arm-next` tier `rampage`), ruta `/sizes` = tweakers por resolución.
- Todo lo ganado en el approval de KS1 viene en el fork (social mode, replay
  card, decimales, error paths, popout S, consola prod limpia): **no tocar esas
  zonas sin re-correr su QA**.

## Pendientes

1. **Math**: verificar la corrida de producción del 26-08 (RTP de rage → 96.50)
   + gauge ACP + regenerar mock.
2. **Arte** — el pedido consolidado con pantallazos es **`UI_SIN_DISENO_KRE_v2.pdf`**
   (regenerar: Chrome headless `--print-to-pdf` sobre el `.src.html`). Al llegar:
   recolors h1/h4 + anims, letterings de win, logo/portada, UI por código
   (TopBar, menú, paytable, rules, bet menu, replay, confirmaciones del buy).
3. **Decisiones de diseño abiertas**: badges X1-X5 (RS-10..19), RS-36 (wipe
   brochazos — ¿transition?), celebración 6 beats (GDD §9.1), Kash cameo en
   portrait (propuesta: slide-in durante rampage).
4. **F4**: suites del playbook + edge cases nuevos (rampage→wincap, rampage con
   0 celdas convertibles — decidir contrato, retrigger con rampage) + regresión
   del checklist heredado + tabla de event IDs de replay por modo.

## Auditoría de texto rasterizado (social mode) — 16-09

`game/social.ts` reemplaza los términos restringidos en vivo, pero **solo llega a text nodes
del DOM**. Quedan afuera los `<Text>` de Pixi (se resuelven con `socialLabel()` en el origen)
y el texto horneado en imágenes (se tapa con covers CSS, o se cambia el asset).

Esta tabla es el resultado de abrir y leer cada asset. **No re-derivarla en el próximo
submit — actualizarla cuando entre arte nuevo.**

| Asset | Texto horneado | Estado |
|---|---|---|
| `ui/bet_pill.png` | **BET** | cubierto — chip `PLAY`, `BottomBar.svelte` |
| `buy/header.png` | **BUY BONUS** | cubierto — header HTML, `BuyBonusOverlay.svelte` |
| `buy/card_*.png` | **N x BET** / **BUY** | cubierto — covers, `BuyBonusOverlay.svelte` |
| `loading/intro.webp` | **CASH**, **BET** | ⛔ **sin resolver — depende de arte**, ver `REPORTE_ARTE_16-09.md` |
| `ui/btn_spin/stop/turbo/auto.png` | SPIN · STOP · TURBO · AUTO | limpio |
| `ui/dock.png`, `ui/Contenedor1.png` | (sin texto) | limpio |
| `autospins/title.png` | AUTO SPINS · NUMBER OF ROUNDS | limpio |
| `autospins/start.png` | START AUTOPLAY | limpio |
| `autospins/opt_*.png`, `panel.png`, `close.png` | números · ∞ · X | limpio |
| `sprites/wins/win_*.png` | SMALL/BIG/MEGA/MAX WIN | limpio |
| `sprites/fs_intro_panel.webp` | FREE SPINS · TAP TO CONTINUE | limpio |
| `sprites/fs_win_panel.webp` | FREE SPINS TOTAL WIN · TAP TO CONTINUE | limpio |

Los `<Text>` de Pixi: el único con término restringido era el `BET` del panel de replay en
`TopHud.svelte` (rechazo 16-09). Ahora los cuatro labels pasan por `socialLabel()`. El resto
(`FREE SPIN`, `TUMBLE WIN`, `xN`, montos, nombres de símbolo) está limpio.

⚠️ Los **atributos** (`aria-label`, `alt`, `title`) tampoco los ve el observer: el walker es
`NodeFilter.SHOW_TEXT`. Los tres del pill de bet van por `socialLabel()`; el resto no tiene
términos restringidos.

## Parámetros abiertos del GDD (defaults en uso)

| Parámetro | Default | Afecta |
|---|---|---|
| P(rampage) por modo | base 1/50 · vault 1/30 · smash 1/20 · rage 1/12 | Retune |
| Scope conversión | per_cell i.i.d. | Fences + Conversion Wave |
| Pesos High destino | H1 .45 / H2 .30 / H3 .25 · premium 15% | Retune fino |
| Rampage en tumbles | NO (solo drop inicial) | Math |
| Scatters/Wilds | nunca se convierten | Math |
| Títulos display de modos | placeholder KS1 (IDs internos NO se renombran) | Copy |
| Timings/arte de beats | wireframes | Solo arte |

## Correr (dev)

```bash
# mock RGS con los books de KRE (generar antes con make run GAME=kash_rampage_extreme)
.venv/bin/python .scripts/mock_rgs.py --game kash_rampage_extreme --port 3032
cd stake-web-sdk/apps/kash-rampage-extreme && pnpm dev              # :3002
# http://localhost:3002/?sessionID=mock&rgs_url=http://127.0.0.1:3032
```

QA funcional: `.scripts/qa_smoke.py` (E2E contra mock + dev server,
parametrizado con `QA_APP_PORT`/`QA_RGS_PORT`).
