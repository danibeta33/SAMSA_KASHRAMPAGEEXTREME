# Trampas técnicas del stack (Svelte 5 + Pixi 8 + web-sdk + Math SDK)

Cosas que costaron horas de debug en Kash Smash y que NO son obvias. Leer antes de tocar el equivalente.

---

## Monorepo / packages

- **`pixi-svelte` se consume desde `dist/`, no del source.** Su `package.json` apunta a `./dist/index.js`.
  Si editás `packages/pixi-svelte/src/lib/**`, **tenés que `npm run build` dentro del package** para que
  el cambio llegue a la app. Editar solo el source y no ver el efecto = este es el motivo.
  (Otros packages como `state-shared`, `utils-xstate`, `components-shared` sí se consumen del source directo.)
- Tras editar un package compartido, reiniciar el dev server con `rm -rf node_modules/.vite` (cache).
- Los packages compartidos afectan a TODOS los juegos del monorepo. Cambios de comportamiento (ej.
  setear el i18n compiler) deben aislarse a la app si pueden romper otro juego.

## i18n / Lingui

- Lingui **no instala su messagesCompiler en producción** (`NODE_ENV !== 'production'`). Traducir un
  catálogo crudo en prod → `console.warn("Uncompiled message detected!")`. Fix: setear un compiler
  propio con `i18n.setMessagesCompiler()` **solo en `import.meta.env.PROD`**, aislado a la app.
  Ver `game/i18nCompiler.ts` de Kash Smash (copiable — el catálogo del juego es texto plano).
- El catálogo (`i18n/messagesMap/en.ts`) usa clave===valor (raw). Los mensajes de UI son texto plano
  sin ICU. Si agregás plurales/select, el compiler mínimo NO los maneja — usar el real de Lingui.

## HUD custom (el patrón de Kash Smash) — el que más rompe requisitos

Al reemplazar la UI Pixi del SDK por overlays HTML, **hay que reponer manualmente TODO lo que la UI
del SDK hacía**, no solo lo visible. Lo que se olvidó en Kash Smash y hubo que reponer:
- Barra espaciadora → bet (el `EnableHotkey` broadcastea `hotKey`, alguien lo tiene que consumir).
- Jurisdiction flags `disabled*` (turbo/autoplay/buy/spacebar/slamstop) — leerlos de `stateConfig`.
- Los MONTOS de los límites de autoplay (`autoSpins*LimitAmount`), no solo el counter — la conversión
  chip×bet está en `AutoSpinsStartButton.svelte` del SDK.
- Autoplay con confirmación explícita.
- Reset de modo buy→BASE al arrancar autobet.
- El modo `replay` (ocultar controles) y `social` (term-swaps) — el HUD custom no ve `stateUi.config.mode`
  ni `stateUrlDerived.replay()`/`.social()` a menos que lo cablees.
- Bet levels desde `stateConfig.betAmountOptions` (no la lista default de `stateConfig`).

## Overlays / CSS responsive

- **Todo overlay debe tener `max-height: calc(100vh - Npx)` + `overflow-y: auto`** o desborda en
  Popout S (400×225) y Mobile S (320×568). Un botón de cierre "a caballo" de la esquina (offset
  negativo) se sale del viewport en pantallas chicas → moverlo adentro en el breakpoint corto.
- El breakpoint `@media (max-height: 300px)` es el de los popouts. Cuidado con `max-height: none` ahí
  (mata el scroll interno — le pasó al AutoSpinOverlay).
- Cerrar por click en el backdrop además del botón X (cinturón).
- Testear con la LISTA COMPLETA de bet levels del RGS real (~35), no los 10 del mock default.

## Assets

- **Imágenes HTML (`<img>`/CSS background) NO pasan por el AssetsLoader de Pixi** → se descargan al
  primer render (pop-in). Precargarlas aparte durante el loading (ver `htmlAssets.svelte.ts`) y
  guardar referencias vivas (`pinned[]`) para que el GC no las suelte.
- El AssetsLoader del SDK se traga fallos de carga por-asset con `console.error` y marca `loaded=true`
  igual. Sin retry, un 404 transitorio = juego sin ese asset + error en consola. (Fix del retry ya en
  el `pixi-svelte` del studio.)
- Nunca dejar `sizes.html` / labs DEV en el zip del ACP. `sizes.html` es una ruta SvelteKit que el
  adapter-static prerenderiza — **excluirla al empaquetar** (`zip ... -x 'sizes.html'`). Los labs
  (UiLab/AnimLab) gatearlos a `import.meta.env.DEV`.
- Los QA hooks (`window.__eventEmitter`, `__getXstate`, etc.) DEBEN estar gateados a DEV o se filtran
  al build del ACP.

## Pixi / renderer

- **Firefox WebGPU** no acepta `HTMLVideoElement` como source → revienta el render loop. Usar WebGL en
  Firefox, WebGPU en el resto. Y para BG animado, dibujar el video en un `<canvas>` intermedio y usar
  el canvas como textura, NUNCA `VideoTexture` directa.
- **Fallback obligatorio a WebGL**: en el iframe del ACP la creación de WebGPU puede fallar y Pixi 8
  no cae solo a WebGL → canvas negro. Retry explícito con `preference: 'webgl'`. (Ya en
  `InitialiseApplication.svelte`.)

## RGS / `rgs_url` y fuga de datos por stack trace (rechazo 16-09, punto 1)

El reviewer del ACP **rompe el `rgs_url` a propósito** (puso literalmente
`&rgs_url=sdasda:85:602`) y mira qué hace el juego. Pide dos cosas: que NO sea
jugable, y que muestre solo un "Failed to fetch" sin detalle técnico.

- **El stack trace de un `fetch` fallido contiene el `sessionID` y el `rgs_url`.**
  No porque algo los loguee: el build inlinea todo el bundle en `index.html`
  (`assetsInlineLimit: Infinity` + `bundleStrategy: 'inline'`), así que los frames
  del stack se atribuyen a la URL del documento — y en el iframe del ACP esa URL
  lleva los query params. Imprimir el error en pantalla = publicar la sesión.
  **Regla: ningún objeto de error llega nunca a la UI.** `packages/rgs-fetcher`
  normaliza todo fallo de red/parseo/timeout a `{ error, message: 'Failed to fetch' }`
  — un objeto PLANO, sin `stack`. `ModalError` solo imprime un `userMessage` que
  alguien marcó explícitamente como apto para el jugador; no tiene código para
  imprimir otra cosa, ni siquiera detrás de un gate de DEV (un gate por entorno
  se filtra al primer build con `mode=development`).

- **"Not playable" ≠ "hay un modal encima".** El `Authenticate` del SDK ponía
  `authenticated = true` aunque fallara, o sea que el juego entero se montaba
  detrás del modal. Peor en KRE: la pantalla de carga (z-index 200) tapaba el
  modal (z-index 180), así que el jugador veía LOADING → "CLICK TO SKIP" como si
  todo estuviera bien. Y la `BottomBar` y los overlays se montan **fuera** de
  `<Authenticate>` en `+layout.svelte`, así que el botón de SPIN quedaba vivo.
  Fix: `stateAuth.status` (`state-shared`) como interruptor único — en `'failed'`
  `<Authenticate>` renderiza `FatalError.svelte` **en lugar** del juego y el
  bloque de overlays del layout queda fuera del render. No se monta nada.

- **Validar el `rgs_url` ANTES de la red.** `new URL('https://sdasda:85:602')`
  tira por el puerto inválido: sin chequeo previo ese throw sale de `fetch()`
  como error nativo con stack.

- **Timeout obligatorio** (20 s, `RGS_REQUEST_TIMEOUT_MS`). Un host que traga la
  conexión dejaba el juego cargando para siempre — que tampoco es "mostrar el
  mensaje de error".

- **Un 200 con JSON cualquiera no es autenticarse.** Si la respuesta no trae
  `balance.amount` y `config.betLevels`, se trata como fallo: apuntar el
  `rgs_url` a otro servidor no puede dejar el juego "jugable" a medias.

- **Los `console.*` gateados a mano no alcanzan.** No cubren las dependencias:
  medido sobre el build real, `console.log("PixiJS ...")` seguía ahí. Ahora el
  plugin `stake-strip-console-on-build` (`packages/config-vite`) los borra del
  chunk final en `vite build` — dos pasadas de esbuild, porque `drop: ['console']`
  no reconoce el `globalThis.console.log(...)` que usa pixi.js. `vite dev` queda
  intacto. `tools/verify-build.mjs` (corre dentro de `pnpm build`) falla si
  sobrevive alguno.

## xstate v5

- Un error no manejado en un actor invocado **detiene el actor raíz** → el juego queda congelado fuera
  de idle (SPIN/BONUS muertos para siempre). SIEMPRE poner `onError` en los invokes `play`/`ending` de
  las máquinas `bet` y `resumeBet`.

## Currency / montos

- `API_AMOUNT_MULTIPLIER = 1_000_000` (6 decimales) en el web-sdk del studio. Los docs dicen 6 decimales
  también. (Un build viejo del SDK usaba 100_000_000 — verificar cuál corre.)
- Mapa de currency display en `utils-shared/amount.ts` → `NO_LOCALISATION_CURRENCY_MAP`: XEC→SC, XGC→GC,
  XSC→SC. Códigos no-ISO se muestran crudos si faltan del mapa.

## Math SDK

- **numpy/Py3.14 elision bug**: el env del math SDK corrompe aritmética numpy sobre arrays grandes
  dentro de funciones. Scripts de análisis: usar `fsum`/`np.dot`/`out=` o python puro. (Ver
  `verify_10m.py` de Kash Smash — inmune al bug.)
- LUT↔books: `payoutMultiplier` debe matchear EXACTO (el RGS hashea y compara). IDs 0-based OK aunque
  el ejemplo de la doc use 1-based (el RGS compara las secuencias, no los índices).
- El uploader del ACP trunca archivos individuales >~1 GB (visto en N1 con books de 1.6 GB,
  ERR_MISSING_FILE). Books de buys a 250k sims (~400 MB) es tamaño seguro.
  Nota N3: un "No changes to publish" persistente en la card de Math resultó ser un **bug visual
  del ACP que se resolvió solo** — no asumir truncado de una; esperar/refrescar antes de
  diagnosticar. Si el tamaño molestara de verdad: recomprimir books con `zstd -19` los baja a
  ~40% (contenido descomprimido idéntico; actualizar los sha256 en config.json).
- **El detector de cambios del ACP es `library/configs/config.json`** (SHA256 por LUT/books/force,
  doc oficial `/docs/math-sdk/source/outputs`: "used by the RGS to determine and verify changes").
  `generate_configs` lo regenera con cada corrida de run.py — si el upload no lo incluye o quedó
  stale, el ACP compara hashes viejos y no reconoce nada. Incluirlo en la subida junto con
  index.json + books + LUTs.
- **El reveal se serializa donde lo emitas, no donde muta el board** (rechazo N3.4): si el juego
  inyecta/forza símbolos post-`draw_board()`, usar `draw_board(emit_event=False)` → mutar →
  `reveal_event()` → evento custom. Si el reveal sale antes, el reviewer ve un board sin la mecánica
  y la reporta como "not implemented" aunque la math pague bien.
- **Eventos custom posicionales: sumar el padding `+1` al row** (`include_padding`), igual que
  `fs_trigger`/`win_info`/`tumble` del SDK. Un evento con rows crudos desalinea una fila cualquier
  animación del cliente.
- **Regenerar solo lo que cambió el RNG**: reordenar emisión de eventos NO cambia el consumo de RNG
  (mismo book, otra serialización); cambiar candidates/filtros SÍ (books nuevos → re-optimizar +
  event IDs de replay nuevos → actualizar HANDOFF/GAME_DETAILS). `base` sin la mecánica quedó intacto.
- **⚠️ NO re-simular base de kash_smash sin arreglar el config antes**: hay DOS Distributions con
  criteria `"freegame"` (la del fix check-40 con force_win_range 1000-4999 va primera y el SDK
  matchea por nombre → se come a la normal) y 50 books legacy con criteria `"bigwin"` que ya no
  existe. Una re-sim ingenua fuerza ~10% de los books a la banda 1000-4999× (RTP roto en silencio).
  Los books publicados (Jul 9) son datos estáticos válidos — el problema es solo al regenerar.
  Fix pendiente: criteria único para la distribution del check-40 + su fence. (Ver N3.7 del log.)
- **Criterios con nombre duplicado NO fallan ruidosamente**: `get_current_distribution_conditions`
  devuelve la primera coincidencia y `get_sim_splits` colapsa las cuotas en un dict. El SDK además
  hace `return RuntimeError(...)` (sin raise) para criteria inexistente → muere después con un
  `TypeError` confuso en draw_board.

## Herramientas del studio

- `.scripts/mock_rgs.py` — mock del Carrot RGS. Flags de reviewer: `--currency XEC --bet-levels 35
  --default-bet 200000`. Endpoint `/debug/arm-next` para forzar outcomes.
- `.scripts/qa_smoke.py` — smoke E2E Playwright contra mock + dev server.
- `.scripts/package_for_acp.sh <slug>` — empaqueta math+frontend. **Genera un math zip de ~1 GB que
  no necesitás si la math no cambió** — usar solo el frontend zip. Excluir `sizes.html` manualmente.
- Reglas del studio: NUNCA escribir en el Drive del usuario (solo leer). No auto-zipear hasta que el
  usuario lo pida. Gemini Image → siempre pasar por BiRefNet (pinta el checker pattern como BG).

## White-keying de slices de Illustrator (kit KRE 25-08)

Los exports de UI de diseño suelen venir **RGB con el fondo blanco horneado**
(sin alpha). Para transparentarlos por script:

- **NO** usar umbral laxo de "blanco" (p. ej. min(r,g,b)≥200) ni aplicar
  unmix `alpha=255-min` a toda la región floodeada: se come los DETALLES
  BLANCOS del arte que tocan el fondo (slashes de botones, remeras/highlights
  de personajes, rings/outlines blancos de diseño). Nos pasó con el kit de KRE
  — "los assets aparecen sin sus blancos".
- Receta correcta (`scratchpad/rekey_assets.py` de la sesión 25-08 de KRE):
  flood fill desde los bordes SOLO por blanco puro (min≥250) — los blancos
  encerrados por arte no se floodean y quedan opacos —, banda AA de 2px
  dilatada del bg con unmix parcial, y para piezas convexas cuyos detalles
  blancos CRUZAN el borde (slashes del SPIN/STOP), constraint de hull convexo
  sobre los píxeles no blancos.
- Pedirle al equipo que exporte **PNG con transparencia** directo — todo esto
  es un workaround.
