# Dead Heat — Knowledge Base

Documentación de arranque para **Dead Heat** (próximo juego Lucky Bastards sobre Stake Engine),
destilada del proceso completo de aprobación de **Kash Smash** (3 rondas de review: N1, N2, y
una barrida proactiva). El objetivo: llegar al primer submit ya cumpliendo todo lo que a Kash
Smash le costó 3 iteraciones descubrir.

## Cómo usar esto

1. Antes de escribir código de UI: leé **`04-technical-gotchas.md`** y **`01-stake-approval-checklist.md`**.
2. Durante el desarrollo: tené al lado **`05-preflight-checklist.md`** y tildá a medida que avanzás.
3. Antes de CADA submit: corré el flujo de **`03-qa-methodology.md`** contra el build de PRODUCCIÓN.
4. Si te rechazan: mirá **`02-rejection-log-kash-smash.md`** — es muy probable que el hallazgo ya esté ahí con su fix.

## Índice

| Archivo | Qué contiene |
|---|---|
| `01-stake-approval-checklist.md` | Checklist oficial de approval (fuente: 88 docs de Stake Engine vía el subagent `stake-engine`/Hayden). La fuente de verdad. |
| `02-rejection-log-kash-smash.md` | TODO rechazo/hallazgo de Kash Smash con causa raíz + fix. N1, N2 (8 ítems), barrida proactiva, i18n prod. |
| `03-qa-methodology.md` | Cómo verificar: build de prod (no dev), mock RGS con flags de reviewer, scripts Playwright reutilizables. |
| `04-technical-gotchas.md` | Trampas del stack (pixi-svelte se consume desde dist, i18n en prod, HUD custom rompe requisitos, etc.). |
| `05-preflight-checklist.md` | Checklist accionable pre-submit. Tildable. |

## Contexto del stack (heredado de Kash Smash)

- **Frontend**: Stake web-sdk oficial (Svelte 5 + Pixi 8 + TurboRepo), en `stake-web-sdk/apps/<juego>`.
  Kash Smash reemplazó la UI Pixi del SDK por un **HUD HTML custom** (overlays). Casi todos los
  hallazgos de review vienen de que el HUD custom no repuso algo que la UI del SDK sí hacía.
- **Math**: Math SDK (Python + optimizer Rust) en `stake-math-sdk/games/<juego>`.
- **RGS**: Carrot RGS. No hay backend custom. Aprobación vía ACP (Admin Control Panel).
- **Herramientas de dev del studio**: `.scripts/mock_rgs.py` (mock del RGS), `.scripts/qa_smoke.py`
  (smoke E2E Playwright), `.scripts/package_for_acp.sh` (empaqueta math+frontend a zips).

## Regla de oro (la lección más cara de Kash Smash)

**Verificá SIEMPRE contra el build de producción servido como el CDN del ACP, no solo contra el dev server.**
Hay bugs que SOLO existen en producción (banner de Pixi, warning de Lingui "Uncompiled message",
comportamiento gateado por `NODE_ENV`). El dev server los oculta. Ver `03-qa-methodology.md`.
