# Metodología de QA — cómo verificar antes de submit

La verificación de Kash Smash evolucionó de "probar a mano en dev" a un flujo repetible que atrapa
los bugs que causan rechazo. Replicarlo para Dead Heat.

---

## Regla #1: verificar contra el BUILD DE PRODUCCIÓN, no dev

El dev server oculta bugs reales. Cosas que SOLO aparecen en el build de prod:
- Banner de PixiJS (`hello`).
- Warning de Lingui "Uncompiled message detected!".
- Cualquier comportamiento gateado por `NODE_ENV` / `import.meta.env.PROD`.
- Assets servidos bajo el subpath del CDN (rutas relativas que en dev "andan" y en prod 404ean).

**Flujo correcto:**
```bash
cd stake-web-sdk/apps/<juego>
npm run build                          # genera build/
npm run preview -- --port 4173         # sirve el build de prod
# …o mejor aún, servirlo como el CDN del ACP (subpath):
unzip -q frontend_<juego>.zip -d /tmp/zipserve/<juego>
cd /tmp/zipserve && python -m http.server 4180
# → http://127.0.0.1:4180/<juego>/?sessionID=mock&rgs_url=...
```
La versión "zip servido en subpath" es la MÁS fiel al ACP y atrapa problemas de rutas del paquete.

## Regla #2: replicar las condiciones del reviewer

El reviewer NO usa los defaults del mock. Reproducir su entorno:
- **Currency XEC** (para verificar el mapeo a SC).
- **Muchos bet levels** (el RGS real manda ~35, no 10) — esto es lo que reventó el bet menu.
- **`demo=true`** en la URL (así entra el reviewer; el frontend lo ignora, lo maneja el RGS).

```bash
.venv/bin/python .scripts/mock_rgs.py --game <juego> \
  --bet-levels 35 --default-bet 200000 --currency XEC
```
(Los flags `--bet-levels`, `--default-bet` se agregaron durante Kash Smash. Ya están en el mock.)

## Regla #3: consola en CERO, no "sin errores rojos"

El requisito es literal: **la consola no debe devolver NINGÚN log**. Warnings y logs cuentan.
Capturar TODOS los niveles en Playwright:
```python
page.on("console", lambda m: CONSOLE.append(f"[{m.type}] {m.text}"))  # todos los tipos
page.on("pageerror", lambda e: CONSOLE.append(str(e)))
```
Filtrar solo `favicon`. Todo lo demás es fail.

---

## Suites de QA reutilizables (adaptar de Kash Smash)

Los scripts vivían en el scratchpad de la sesión. Vale la pena portarlos a `.scripts/` o a la carpeta
del juego. Cobertura que tenían (replicar para Dead Heat):

### Suite 1 — Requisitos base
- XEC→SC en balance/bet/win. Bet inicial = defaultBetLevel. Bet menu = lista completa del authenticate.
- Bet menu dentro del viewport + cerrable en LOS 7 tamaños.
- BONUS habilitado en idle / deshabilitado en autobet / re-habilitado al cortar.

### Suite 2 — Replay + Social
- `replay=true`: badge, PLAY, balance oculto, controles ocultos, moneda del replay, PLAY AGAIN ×2.
- `social=true`: cero términos restringidos en HUD/reglas/paytable/buy menu (escanear `document.body.innerText`
  con la regex de la tabla oficial); covers de bitmaps; disclaimer conserva "Stake Engine".

### Suite 3 — Autoplay + edge
- Límites (loss/single-win) CORTAN y notifican (no cosméticos). ← OJO Playwright: `has_text="5×"`
  matchea "25×" — usar `re.compile(r"^5×$")`.
- Buy confirm dentro del viewport en popout S, X clickeable.
- Contador de autospins visible.
- Sin `waitForResolve TIMEOUT` en ~18 spins de autoplay.

### Suite 4 — Loading + carga
- **CDN lento** (throttle de los assets críticos con `page.route` + `time.sleep`): a los N segundos
  sigue en LOADING (no fallback prematuro), click prematuro NO entra, 0 "Sprite key not found".
- Imágenes HTML del HUD cacheadas al abrir el menú (throttle de las cards, verificar `img.complete`).
- Cada tier de celebración corre sin crash (forzar con `/debug/arm-next`).

### Suite 5 — TODOS los menús × viewports críticos
Para cada overlay (menú principal, paytable, game rules, settings, bet menu, buy bonus, buy confirm
2 pasos, autoplay + ADVANCED): panel dentro del viewport, botón de cierre visible+clickeable, cierra
efectivamente, consola limpia. Viewports: Desktop, Popout L, **Popout S 400×225**, **Mobile S 320×568**.

### Smoke de gameplay
`.scripts/qa_smoke.py --rounds N` — spins reales + bonus, detecta hangs/timeouts/console errors.

---

## Herramientas del mock que existen (heredadas)

- `/debug/arm-next` con `{"tier": "big"|"max"|"medium"|"none"}` — fuerza el próximo outcome (para
  probar celebraciones sin esperar RNG).
- `/bet/replay/<game>/<version>/<mode>/<event>` — el mock ya sirve replays.
- Flags: `--game`, `--port`, `--currency`, `--bet-levels N`, `--default-bet X`, `--jurisdiction`, `--max-books`.

## Patrón de dismiss del loading (para todos los scripts Playwright)
```python
def dismiss(page):
    page.wait_for_selector("button.load", timeout=30_000)
    for _ in range(120):
        if "CONTINUE" in (page.locator("button.load").inner_text() or ""): break
        time.sleep(0.5)
    page.locator("button.load").click()
    page.wait_for_selector("button.load", state="detached", timeout=10_000)
```

## Cómo se estructuró el review proactivo (recomendado antes de cada submit)

3 agentes en paralelo:
1. **Simulacro de reviewer**: contra el checklist, foco en lo que un HUD custom rompe.
2. **Code review adversarial**: bugs de corrección en el diff reciente (estados colgados, imports, races).
3. **QA dinámico**: edge cases contra el server vivo (resize mid-spin, overlays en popout, reload,
   autoplay con límites).

Luego consolidar, priorizar, arreglar todo junto, y re-verificar contra el build de prod.
