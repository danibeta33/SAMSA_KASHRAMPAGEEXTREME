# Court Heat (juego de Jack) — referencia completa de implementación

**Para qué sirve este doc**: Court Heat es la referencia de dirección de Dead Heat
(y probablemente de más juegos del studio). Cuando haya que hacer algo que Jack ya
hizo — un FX, un beat de presentación, un flujo RGS — acá está CÓMO lo hizo y EN QUÉ
ARCHIVO/LÍNEA está. Revisado completo el 13-08-2026.

**Dónde vive**: `dead-heat/Jack Upload/`
- Frontend: `web-sdk/games-court-heat/dist/src/` (vanilla JS + Pixi v8, SIN framework)
- Math: `math-sdk/games/court_heat/` (Python standalone, no usa el Math SDK de Stake)
- Docs propios: `STAKE_READINESS.md`, `RELEASE-CHECKLIST.md`, `HOSTED-RGS-TEST.md`,
  `math-sdk/games/court_heat/MATHS.md`

**Los 6 módulos del frontend** (todas las rutas abajo son relativas a `dist/src/`):

| Archivo | Líneas | Qué es |
|---|---|---|
| `main.js` | 3233 | TODO el juego: renderer (clase `CourtHeatRenderer` L109-2617) + bootstrap/sesión/UI (L2619-3233) |
| `event-player.js` | 335 | Secuenciador de books + `validateBook` (validación exhaustiva del contrato) |
| `books.js` | 324 | Fixtures dev: un book armado a mano POR ESCENARIO + selector + pesos random |
| `rgs-client.js` | 275 | Cliente Stake RGS (authenticate/play/end-round/replay/ack) |
| `audio.js` | 392 | SFX 100% sintetizados con WebAudio + música HTMLAudio con crossfade |
| `presentation.js` | 67 | Helpers puros: formato de moneda, grupos de wins, copy por jurisdicción |

---

## 1. Arquitectura general

- **Sin framework**: un solo `CourtHeatRenderer` imperativo sobre Pixi crudo. Canvas
  de diseño fijo **1600×900** (`DESIGN_W/H`, main.js:42) escalado a cover con branch
  portrait (`resize()` main.js:138). Todo el juego se posiciona en coordenadas de
  diseño absolutas — no hay layout responsive interno, solo el scale del root.
- **Jerarquía de capas** (`buildScene` main.js:150): `designRoot → camera → world`,
  y dentro del world en orden: backdrop → court → `reelLayer` (grid) → `hoopLayer`
  (aro) → `characterLayer` (personajes) → `fx` (efectos) → `basketForeground`
  (red/aro FRONTAL — la pelota pasa POR DETRÁS al encestar) → `bannerLayer`
  (carteles, no lo afecta el zoom de la cámara de la misma forma).
- **UI = HTML DOM** encima del canvas (botones, balance, modales, loading,
  scoreboard del bonus). El canvas solo renderea el juego. Referencias DOM en
  main.js:2619-2659.
- **Separación estricta server/cliente** (comentario clave en event-player.js:165):
  el cliente "consumes the canonical book order and never selects modifiers,
  mutates payouts or calculates wins". Todo lo que se ve viene autorado en el book.

## 2. El grid / board (5×5 ways)

- Constantes: `GRID_X/Y 530/320`, `CELL_W/H 108/82`, `GAP 7` (main.js:44-52).
- **Las celdas son 90% Graphics procedurales** (`buildReels` main.js:240): cada
  celda es un contenedor con 13 piezas: `plate` (marco por tier), `tierGlow`,
  `aura`, `energyRing`, `pedestal` (sombra elíptica de "piso"), `iconShadow`,
  `iconGlow` (aditivo tintado al edge color), `iconRim`, `icon` (el sprite),
  `sweep` (barrido de brillo), `shine` (destello cruz), `sparkles`, `label`.
  El único asset es el sprite del símbolo; todo el dressing es código.
- `setCell(reel,row,name)` (main.js:768): redibuja el plate según el TIER del
  símbolo (low/premium/core/special → grosor de borde, alphas, esquineras) y
  setea texturas + `baseIconScale` por símbolo (tabla main.js:817).
- `SYMBOLS` (main.js:54): cada símbolo declara `{label, color, edge, tier, motion}`.
  El `motion` es el vocabulario de animación (ver §3).
- **Máscara del grid**: `reelClip` con roundRect exacto (main.js:300). Los FX de
  celdas viven en `fx` (fuera de la máscara) — por eso sus glows nunca se cortan.
  *(La lección que aplicamos el 13-08 al margen horizontal de BoardMask.)*

## 3. Vida de los símbolos — el vocabulario `motion`

Tres estados, todos leen `cell.phase` (offset determinista por celda, main.js:391)
para desincronizar:

- **Idle** `updateSymbolIdle` (main.js:896): corre en el ticker ambiental para TODAS
  las celdas cuando no giran. 8 motions: `flicker` (parpadeo neón), `stomp`
  (pisotón con squash), `twist`, `glint` (destello viajero), `bass` (late al
  beat), `bounce` (pique de pelota), `flare` (wild: llamarada+ring girando),
  `flip` (scatter: volteo con shimmer). Encima de todos: hover senoidal + falsa
  perspectiva (`scale.x` oscila, main.js:974-979).
- **Landing** `animateSymbolLanding` (main.js:1151): versión corta del motion al
  clavar el reel.
- **Win** `animateSymbolWin` (main.js:984): versión amplificada (progress 0..1)
  usada en highlightWin, tease y modifiers.

Patrón clave: `resetCellMotion` (main.js:833) al inicio de cada frame de anim —
todo se re-deriva de cero, nunca se acumula estado. `syncCellDepth` (main.js:863)
mantiene sombra/glow/rim coherentes con la posición del icono (la "profundidad").

## 4. Spin de reels

`spinTo` → `spinReelTo` (main.js:1053/1083): no hay tira física — durante el tween
cada "step" **re-randomiza los símbolos visibles** (main.js:1098) mientras baja el
offset; el blur se FINGE con squash del icono (scale.y 1.34, main.js:1112) + un
`veil` de streaks diagonales por reel (main.js:398). Al terminar: overshoot de
13px + rebote senoidal + `animateSymbolLanding` + `audio.reelStop(reel)`.
- Anticipación (`slowFinish`): con modifier/bonus en el book, los reels 3-4 duran
  +390ms y suman steps (main.js:1087) + overlay "BUCKET CHARGED" (`playSpinAnticipation`
  main.js:1193). El dato viene de `presentationHints` que el event-player arma
  MIRANDO ADELANTE en el book (lookahead de modifiers, event-player.js:229).

## 5. Cámara — el arma secreta del juice

- `cameraTo(x, y, scale, ms)` (main.js:1382): pivot+scale del container `camera`,
  con **parallax multicapa** (`applyParallax` main.js:1362: BG se mueve 1.8%,
  luces 1.2%, haze -2% — venden profundidad).
- `punch(amount)` (main.js:2498): shake de cámara (sin/cos de alta frecuencia con
  falloff). Se usa en TODO impacto.
- Cada beat tiene su encuadre: tiros → sube al aro con 3 keyframes (main.js:1407),
  modifiers → zoom al **centroide de las celdas afectadas** (main.js:1898), big win
  → zoom al centro, no-win → zoom sutil 1.045. SIEMPRE `cameraReset` al final del
  book (event-player.js:330).

## 6. Personajes y tiros

- Dos personajes (`rook` izq violeta / `vex` der naranja, `buildCharacters`
  main.js:612): póses como sprites sueltos (`prep/shoot/make/miss`) + **idle como
  atlas 4×2 con TIMELINE de frames** (`idleTimeline` repite índices para pausas,
  ej. vex main.js:641) reproducido a mano en el ticker (main.js:1328) con tablas
  de registración por frame (`frameBottoms`/`frameFootCenters` — compensan que
  cada frame del atlas tiene al personaje en otra posición).
- `animateShot` (main.js:1420): wind-up (crouch con squash) → handoff de la pelota
  del idle a la programática en un frame exacto (`shotHandoffFrame`) → **vuelo en
  bezier cuadrática** con apex fijo (main.js:1485), 8 ghosts aditivos de estela +
  ribbon del arco → resolución.
- Enceste `hoopFlash` (main.js:1585): flash + burst + shockwave + `animateNetResponse`
  (main.js:1603 — la RED y el ARO se deforman: scale y wobble con snap senoidal;
  la pelota cae POR DETRÁS del `basketForeground`) + `courtLightBurst` (wash de
  color en TODA la escena, main.js:1673) + reacción del personaje (`playerReaction`
  main.js:1719: brinco de festejo o encogida de fallo).
- Fallo `missImpact` (main.js:1641): clank en cruz + rim wobble + la pelota sale
  despedida con parábola de rebote.
- Doble enceste → `doubleBucketTakeover` (main.js:1687): pantalla partida
  violeta/naranja + banner "DOUBLE BUCKET • 2 MODIFIERS".

## 7. Modificadores — cómo se APLICAN a la vista (lo que copiamos el 13-08)

`applyModifier` (main.js:1887) — pipeline: label al strip HTML + texto del tablero
("VEX SCORES") → `chargeBackboard` (el tablero pulsa cargándose, main.js:1791) →
`cameraTo(centroide de positions, zoom por modifier)` → `energyDrop` (main.js:1817:
orbe con el PAYLOAD visible — sprite WILD, texto "3X" o escobita según modifier —
vuela del aro al foco con estela, impacto = shockwave+burst+punch) → animación
específica:

- **multiplier** `animateMultiplier` (main.js:1922): badge "3X" con disco cae del
  aro al centro rebotando + punch + shockwave. Actualiza `backboardText` a "3X HEAT".
- **stackedWild** `animateStackedWild` (main.js:1948): beam vertical sobre el reel
  → `setCell(...,'WILD')` por posición con las celdas en scale 1.4/alpha 0.3 que
  ASIENTAN escalonadas (stagger por índice) → `drawBoard(boardAfter)` → punch.
  *La referencia del "conversión visible" que pedía el feedback.*
- **wildRespin** `animateWildRespin` (main.js:1986): setea wilds + dibuja CANDADOS
  sobre las celdas locked → `spinTo(boardAfter, locked)` (¡respin real con celdas
  quietas!) → candados fade out.
- **lowSweep** `animateLowSweep` (main.js:2019): barredora (rect con highlight)
  cruza el grid de izq a der; cada celda afectada cae/rota/fade según el x del
  barrido → `drawBoard(boardAfter)` → shockwave grande + punch.

Los `positions`/`boardAfter`/`value` vienen del book (server-authored). El contrato
exige `boardAfter` para todo modifier menos multiplier (event-player.js:87-98).

## 8. Wins

- `winTier(amount)` (main.js:72): bandas por multiplicador — 2x CLEAN BUCKET,
  10x ANKLE BREAKER, 25x HEAT CHECK, 100x COURT ON FIRE, 500x BLACKTOP LEGEND,
  5000x MAX WIN • TAKEOVER. Cada tier trae color y scale del cartel.
- `highlightWin` (main.js:2137): la presentación de línea es UN SOLO tween
  orquestado: dim de celdas no ganadoras (isolation), zoom sutil de cámara, wash
  aditivo, **callout hexagonal** con kicker (tier+símbolo), monto que CUENTA de 0
  a +X.XXx (con callback `onCount` para que el HUD HTML cuente en paralelo,
  main.js:2299), detalle "3 REELS • 27 WAYS", **trail path**: polilínea que une los
  centros-promedio por reel de la win principal con 3 "runners" (puntitos que la
  recorren en loop, main.js:2256) + frames pulsantes por celda + `animateSymbolWin`
  escalonado.
- **No-win TAMBIÉN se presenta** (`presentNoWin` main.js:2045): cartel "NO SCORE /
  RUN IT BACK" (o "NO PAYING WAY" si hubo modifier), celdas desaturadas (tint
  gris), dim del grid. Nada termina en silencio.
- `bigWin` (main.js:2337, umbral ≥25x y solo fuera del bonus): takeover completo —
  blackout 0.77, crest PNG girando con glow aditivo, 22 rays radiales, count-up
  1250ms con pulso en cada beat senoidal, burst de 42-58 partículas, AMBOS
  personajes festejan, sting de audio con duck de música.

## 9. Bonus "Blacktop Overtime" (1v1 catch-up)

- Regla: arrancás 2-0; cada possession son 2 tiros server-authored (vos y Vex);
  el bonus TERMINA exactamente cuando Vex te alcanza (`endCondition:
  'vexCatchesRook'`). El validador lo VERIFICA matemáticamente (scores esperados
  vs shots, event-player.js:122-151).
- Presentación: `presentBonusStart` (main.js:2511, banner + camera al aro),
  `presentBonusSpin` (main.js:2524, marcador en el TABLERO del aro + heat del
  glow sube con cada possession), `presentBonusProgress` (main.js:2532, "SHE
  CAUGHT YOU" si te alcanzó), `presentBonusEnd` (main.js:2549, FINAL BUZZER +
  banked). Scoreboard HTML aparte (`showShootout` main.js:2730).
- Música cambia a modo bonus con crossfade (event-player.js:293 → audio.js:67).

## 10. Event player y contrato del book

- `validateBook` (event-player.js:33): TODO book se valida ANTES de presentarse —
  tipos permitidos, roundStart/finalWin en los extremos, índices secuenciales,
  boards 5×5 bien formados, positions en rango, modifier order (post-reveal,
  pre-winInfo), continuidad de scores del bonus, y `finalWin.amount ===
  payoutMultiplier === suma de winInfo`. Cualquier violación = error antes de
  animar. *Gran idea para robustez: el cliente se auto-protege de books corruptos.*
- `play(book, {turbo, resumeFrom})` (event-player.js:180): loop secuencial por
  evento con `await` — cada tipo tiene su bloque. Tras CADA evento llama
  `onEventComplete` → `acknowledgeEvent` al RGS (main.js:2908): así Stake sabe
  hasta dónde llegó la presentación (base del resume).
- **Resume de ronda a mitad** (main.js:2926 `projectResumeState` + 3133): si
  `authenticate` devuelve una ronda activa, reconstruye el estado (último board,
  bonus activo, scores, win acumulado) proyectando los eventos ya ack'eados, pinta
  eso y retoma la presentación desde el cursor. El botón dice "RESUME".

## 11. Depurador de modos dev (books.js) — el modelo del GAME LAB

- `BOOKS` (books.js:155): un fixture POR ESCENARIO: `noWin`, `smallWin`,
  `rookMultiplier`, `vexStack`, `rookRespin`, `vexSweep`, `double`, `bigWin`
  (250x), `winCap` (5000x), `overtime` (bonus completo de 8 possessions generado
  por `buildOvertimeEvents` books.js:65). Cada uno es un book VÁLIDO completo.
- En dev (`launch.dev`): un `<select id="round-select">` en el HTML elige el
  escenario y el spin lo reproduce (main.js:3002). `random` usa pesos que espejan
  la distribución real (65% no-win — books.js:297) para que el QA "se sienta"
  como producción.
- QA extra: `?holdLoading=1` congela el loading para inspeccionarlo (main.js:2662).

## 12. Sesión RGS / dinero (main.js:2946-3151 + rgs-client.js)

- `initialiseSession` (main.js:3082): 3 ramas — replay (fetchReplay + panel
  propio), dev (fixtures + balance fake), producción (authenticate → balance,
  currency, bet levels del config, bet modes resueltos por nombre, session policy).
- **Session policy** (main.js:2690): social mode (GC/SC → copy "Play amount/Result"
  vía `applyJurisdictionCopy`, presentation.js:60), `turboAllowed` (jurisdicciones
  sin turbo → botón oculto), `featureBuyAllowed` (bonus buy off por jurisdicción).
- `playRound` (main.js:2971): busy-lock → placeBet → playBook → **`endRound` SOLO
  si hubo payout positivo** (main.js:3020 — "Stake closes losing rounds
  automatically"; llamarlo sin win es error de API).
- Dinero SIEMPRE en micro-unidades enteras (`API_AMOUNT_MULTIPLIER`), formateo
  con `Intl.NumberFormat` + fallback (presentation.js:34).
- Bonus buy: modal con focus trap (main.js:2704-2726: inert en el shell, Tab
  ciclado, Escape, restore focus) — patrón de accesibilidad completo.

## 13. Audio (audio.js) — cero assets de SFX

- **Todos los SFX son sintetizados** con WebAudio (osciladores + noise buffers +
  envelopes): reelStop, windUp, shotRelease, basket, miss, rimRattle, courtPass,
  anticipation, modifier(por tipo), win escalado por amount, UI ticks, idleBounce,
  fingerSpin… Solo la MÚSICA son MP3 (base loop / overtime loop / bigwin sting).
- Crossfade de música por modo (`setMusicMode` audio.js:67, 650ms), `duckMusic`
  (audio.js:88) para el sting, `haptic()` = navigator.vibrate (audio.js:3),
  suspensión con visibilitychange (main.js:3223).

## 14. Accesibilidad / robustez transversal

- `prefers-reduced-motion` → fuerza presentación turbo (main.js:114, 2954).
- Turbo comprime TODAS las duraciones vía ternarios `this.turbo ? a : b`
  (patrón en cada tween — equivale a nuestro `d(ms)`).
- aria-pressed/labels en toggles, `body.classList` como state machine CSS
  (`is-spinning`, `is-winning`, `is-big-win`, `dev-mode`, `social-mode`).
- Space = spin global con guards de modal/focus (main.js:3216).
- Errores: `showError(msg, fatal)` — en producción todo error de ronda es fatal
  ("Reload to safely resume") porque el resume lo arregla (main.js:3026).

## 15. Math (math-sdk/games/court_heat/)

- **Python standalone** (`court_heat_model.py`, 544 líneas — NO usa el Math SDK
  oficial): 5×5, 3125 ways, wincap 5000x, RTP 96.00% exacto en base y bonus-buy
  (100x). Libraries: 100k books base / 20k bonus (`MATHS.md` tiene la tabla
  completa de métricas re-verificadas: hit rate 35%, overtime 1 en 250, etc.).
- Modifiers con pesos y prioridad de orden (`MODIFIER_WEIGHTS/PRIORITY`
  model.py:66/82), handlers por modifier que devuelven el evento con
  positions/boardAfter (model.py:205-273) — el mismo shape que consume el cliente.
- Overtime: catch-up real simulado (`append_overtime` model.py:361).
- `test_court_heat_model.py` (unittest) + `validate_stake_package.py` +
  `build_stake_package.py` (empaqueta) + `finalize_release.py`.

## 16. Mapa Court Heat → Dead Heat (qué ya tomamos, qué queda)

**Ya portado** (con su archivo nuestro):
- Vocabulario FX tween/burstAt/shockwaveAt → `src/game/fx.ts`
- Tiro completo (wind-up/bezier/ghosts/swish/clank) → `BluffShot.svelte`
- Orbe del modificador con payload → `BluffShot.svelte` (playModifierOrb)
- Conversión visible por celda + sweep (13-08) → `ModifierSeal.svelte`
- Fixture-debugger de escenarios (13-08, adaptado a eventos) → `GameLab.svelte`
- Trail de win con runners → parcialmente en las variantes del rayo (`vfx/`)

**Queda por robar cuando haga falta** (ideas listas en CH):
- `cameraTo`/`punch`/parallax multicapa (nosotros solo tenemos boardShake) —
  main.js:1362-1397. El zoom al centroide del modifier es el próximo paso natural.
- `wildRespin` con candados + respin de celdas locked — main.js:1986.
- Net/rim response al enceste (la red se deforma) — main.js:1603. Nuestro aro es
  parte del BG plano; requeriría arte separado de red.
- Idles por símbolo con vocabulario `motion` por tier — main.js:896 (nuestros
  símbolos son estáticos en idle).
- presentNoWin (el no-win presentado, no silencio) — main.js:2045.
- Anticipación con lookahead de modifiers en el book — event-player.js:229.
- Resume mid-round proyectando eventos ack'eados — main.js:2926 (el SDK de Stake
  ya nos da parte de esto, pero la proyección de estado es idea reutilizable).
- SFX sintetizados sin assets — audio.js entero (útil para prototipos pre-Fran).
- validateBook exhaustivo client-side — event-player.js:33.
