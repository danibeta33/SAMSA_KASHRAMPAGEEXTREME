# Log de rechazos y hallazgos — Kash Smash

> **RESULTADO FINAL: APROBADO Y LIVE el 28-07-2026**, tras N1 + N2 + N3 (tres rondas de
> feedback). Primer juego del studio publicado vía Stake Engine. Este log queda como la
> referencia de approval para todos los juegos siguientes.

Cada ítem: **síntoma** (lo que vio el reviewer / QA) → **causa raíz** → **fix**. Ordenado por origen.
El patrón dominante: **el HUD HTML custom no repuso comportamiento que la UI Pixi del SDK sí tenía.**
Si Dead Heat también usa HUD custom, TODOS estos aplican de nuevo.

---

## A. Feedback N1 (del Drive, primeras correcciones)

1. **Loading mostraba cards de bonus** → sacarlas de la intro (solo logo + spinner del wild). No
   anticipar los modos de compra en la carga.
2. **Compra de bonus sin confirmación** → doble check: BUY → "ARE YOU SURE?" (❌/✅). Nada se apuesta
   hasta el ✅. (Requisito de approval: autoplay/buy con confirmación explícita.)
3. **Pacing del bonus**: pausa entre free spins (650ms, 250ms con turbo).
4. **Escalas por resolución**: el HUD custom necesita afinar tamaños POR bucket de viewport
   (portrait/square/landscape/wide/desktop), persistidos. Herramienta: UI Lab (tecla T).
5. **Volatilidad math** "máxima" → "alta": fences disjuntas por rango de payout en
   `game_optimization.py`. Requirió parchear el optimizer Rust (`sort_wins_by_parameter`) para
   soportar `search_conditions=(min,max)` por rango (antes solo matching exacto).

---

## B. Feedback N2 (8 ítems — el rechazo del screenshot)

### N2.1 — Game tile fuera de guidelines + sin foreground
- **Fix**: background más brillante y sin texto (crop de la escena, aclarado/saturado, SIN el grafiti);
  foreground = personaje transparente. Se compone en el Tile Editor del ACP.

### N2.2 — Consola con logs (`Sprite: key "sym_*" not found` + banner PixiJS)
- **Causa 1**: el LoadingOverlay tenía un **fallback de 8s** que dejaba entrar aunque los símbolos
  siguieran cargando del CDN. En conexión lenta (la del reviewer) → entraba con el board a medias →
  Pixi logueaba "Sprite key not found".
- **Fix 1**: `ready = stateApp.loaded` (sin fallback por tiempo). Jamás entrar con assets a medias.
- **Causa 2**: si un asset FALLA (404), el AssetsLoader del SDK se lo traga con `console.error` y
  marca `loaded=true` igual → mismo error en runtime.
- **Fix 2**: retry ×3 por asset con `PIXI.Assets.unload(src)` entre intentos, en
  `packages/pixi-svelte/.../AssetsLoader.svelte`. (**Rebuildear el dist del package** — ver gotchas.)
- **Causa 3**: banner de PixiJS (`hello: true` en `InitialiseApplication.svelte`).
- **Fix 3**: `hello: false`.
- **Causa 4** (destapada después): `console.debug` sueltos (fonts, sound, freeSpinOutro).
- **Fix 4**: gatear todos a `import.meta.env.DEV`.

### N2.3 — Bet levels hardcodeados
- **Causa**: el bet inicial era un `1` fijo que nunca se reemplazaba por `defaultBetLevel`; y al no
  alcanzar el balance, el clamp iba al balance crudo (un valor que no es ningún level).
- **Fix**: en `Authenticate.svelte` setear `betAmount` desde `config.defaultBetLevel` (o el primer
  betLevel). En `correctBetAmount` (stateBet), snapear al mayor bet level válido, no al balance.
  Guardas para `betLevels` vacío.

### N2.4 — XEC no se muestra como SC
- **Causa**: "XEC" no es código ISO → `Intl` lo mostraba crudo ("XEC 1.00").
- **Fix**: agregar `XEC: 'SC'` a `NO_LOCALISATION_CURRENCY_MAP` en `utils-shared/amount.ts`
  (ya tenía XGC→GC, XSC→SC).

### N2.5 — BONUS comprable durante auto-bet
- **Fix**: `bonusDisabled = autoActive || !isIdle` en el BottomBar (`disabled` en ambas instancias del botón).

### N2.6 — Loop infinito de bonus con auto-bet
- **Causa**: comprar durante auto-bet dejaba `activeBetModeKey` en el modo buy → cada autospin
  re-compraba el bonus a 100x.
- **Fix triple**: (a) BONUS disabled durante autobet (N2.5); (b) el `init` de la máquina de autobet
  resetea modo buy→BASE; (c) el `confirm()` de la compra corta `autoSpinsCounter`.
- Verificado: bonus comprado + autoplay 10 rondas = ~$2 de wager (base), no $200.

### N2.7 — "MAX WIN" en wins no-cap
- **Causa**: el tier visual 'max' se mostraba para wins epic (100×–cap) y desde 500× del costo en el outro.
- **Fix**: MAX WIN exclusivo del **cap real** (5000× la APUESTA, helper `isWinCap` en `winRatio.ts`).
  Alias `epic` → tier `mega`. En el outro, `isWinCap()` en vez de ratio de costo.
- **Nota**: sin arte "EPIC WIN" dedicado, se redistribuyeron las bandas: BIG 15–50×, MEGA 50×–cap
  (con presentación intensificada para los ex-epic 100×+), MAX solo cap. Arte EPIC = pedido al equipo,
  post-approval.

### N2.8 — Bet menu desborda el viewport / no se puede cerrar
- **Causa**: el RGS real manda MUCHOS más bet levels que el mock (Kash Smash: mock tenía 10, real ~35).
  El panel crecía más que el viewport y la X (a caballo de la esquina, offset negativo) quedaba fuera.
- **Fix**: `max-height: calc(100vh - 80px)` + `overflow-y: auto` en la grilla + click en backdrop cierra.
- **→ Actualizar el mock para reproducir**: `--bet-levels N` genera una escalera 1-2-5 de N valores.

---

## C. Barrida proactiva (hallazgos antes de que el reviewer los viera)

Simulacro de reviewer + code review adversarial + QA dinámico, los 3 en paralelo.

1. **[HIGH] Límites ADVANCED del autoplay eran cosméticos** — el overlay custom seteaba
   `autoSpinsCounter` pero NO `autoSpinsLossLimitAmount` / `autoSpinsSingleWinLimitAmount` (quedaban
   en Infinity). La conversión chip×bet vive en `AutoSpinsStartButton.svelte` del SDK y el overlay
   custom no la replicó. → **Todo control que el HUD custom reemplaza debe replicar la lógica del SDK,
   no solo la parte visible.**
2. **[HIGH] Buy confirm desbordaba popout S** (X fuera de viewport) — mismo bug que N2.8 en otro
   overlay. → **Auditar `max-height`/`overflow`/posiciones absolutas de TODOS los overlays en Popout S.**
3. **[HIGH] `waitForResolve TIMEOUT` en consola** durante autoplay/replay — el bateo de Kash
   re-broadcasteado con el clip ya corriendo no reiniciaba el sheet → se comía el timeout con
   `console.warn`. Fix: sumarse al golpe pendiente; y el warn de `waitForResolve` gateado a DEV.
4. **[MED] Excepción del playback congelaba el juego** — faltaban `onError` en los invokes `play`/
   `ending` de las máquinas `bet` y `resumeBet` (xstate v5: un error no manejado detiene el actor raíz
   → SPIN/BONUS muertos para siempre). Fix: `onError` que igual llega a cerrar la ronda.
5. **[MED] Bet menu bypaseaba el clamp** — `pick()` asignaba `stateBet.betAmount` directo; los +/−
   pasaban por `setBetAmount`. Dos semánticas. Fix: `pick()` por `setBetAmount` + levels no bancados `disabled`.
6. **[MED] Popup del SDK renderiza children 2 veces** — un `<div>{@render children()}</div>` suelto
   además del `.top-layer`. Contenido fantasma fuera del viewport (mal para SR/automation). Fix: borrar el suelto.
7. **[MED] Contador de autospins no visible** — el botón AUTO solo brillaba, sin número. Fix: badge con el counter.
8. **[LOW] LAST WIN oculto en ≤360px** — se ocultaba la columna. Fix: ocultar el brand, mantener LAST WIN.
9. **[LOW] Badge social de cards con wrap en popout** — "100x PLAY" hacía 2 líneas y pisaba el título. Fix: `nowrap`.
10. **Preload del buy menu** (reportado por el usuario, no el reviewer): las imágenes HTML del HUD
    (cards, botones) no pasaban por el AssetsLoader de Pixi → se descargaban recién al abrir el menú
    (pop-in). Fix: `htmlAssets.svelte.ts` precarga las 16 imágenes durante el loading, y el CONTINUE
    las espera. **Referencias vivas (`pinned[]`) para que el GC no las suelte.**

---

## D. El bug que SOLO existía en producción (la lección más importante)

**Lingui "Uncompiled message detected!"** — al disparar las notificaciones de límite del autoplay
(que recién funcionaban tras arreglar C.1), Lingui emitía un `console.warn` en el build de prod.
- **Causa**: Lingui solo instala su messagesCompiler cuando `NODE_ENV !== 'production'`. En el build
  de prod no hay compiler → traducir un mensaje de catálogo crudo (string) emite el warning.
- **Por qué nunca se vio antes**: las notifs nunca se disparaban (los límites eran cosméticos).
- **Fix**: `game/i18nCompiler.ts` (compilador mínimo texto-plano + `{var}`, mismo shape `Token[]` que
  `@lingui/message-utils`), seteado vía `stateI18n.i18n.setMessagesCompiler()` **solo en
  `import.meta.env.PROD`**, desde el layout de la app (aislado — no toca otros juegos del monorepo).
- **Solo se detectó porque el QA corrió contra el build de PROD, no dev.** → Ver `03-qa-methodology`.

---

## E. Social mode — la tabla oficial completa (checkbox del submit)

El diccionario debe ser ESTA tabla, no la corta de los docs. Frases multi-palabra primero.
"Stake Engine" queda intacto (lookahead) — es trademark del disclaimer. Case-preserving.

```
win feature→play feature · pay out→win/won · paid out→win · stake→play amount ·
pays out→won · betting→play/playing · bet→play · bets→plays · cash→coins ·
payer→winner · pay→win · pays→wins · paid→won · money→coins · buy→play ·
bought→instantly triggered · purchase→play · at the cost of→for · rebet→respin ·
cost of→can be played for · credit→coins · buy bonus→get bonus · gamble→play ·
wager→play · deposit→get coins · withdraw→redeem · bonus buy→bonus/feature ·
be awarded to player's accounts→appear in player's accounts ·
place your bets→come and play/join in the game · bet/s→play/s · currency→token
```

Agregados N3 (no listados en docs; exigidos por el reviewer — ver F/N3.2):

```
payout multiplier→final multiplier · cost multiplier→feature multiplier ·
total bet cost→total play amount · cost/costs→amount · funds→coins
```

Implementación en Kash Smash: `game/social.ts` (MutationObserver sobre `<body>`, corrige solo el nodo
mutado + `walk()` sobre addedNodes) + covers CSS sobre los bitmaps con texto rasterizado (tab "BET"
del pill, header "BUY BONUS", "Nx BET"/"BUY" de las cards). `lang()` fuerza `'en'` con `social=true`.

---

## F. Feedback N3 (2026-07-27 — decimales, social words, replay, wilds invisibles)

### N3.1 — Win truncado a 2 decimales (sub-cent payouts como 0.00)
- **Síntoma**: "win amount with full decimal precision, balance and bet with 2 decimal places" +
  checkbox "Game displays sub-cent payouts correctly" sin marcar.
- **Causa**: `utils-shared/amount.ts:numberToCurrencyString` fija 2 decimales para TODO
  (rama `.toFixed(2)` de XGC/XSC/XEC y rama Intl `maximumFractionDigits: 2`). El valor sub-cent
  existe en el número — solo lo truncaba el formateo.
- **Fix**: `moneyWin`/`moneyWinFromBookAmount` en `game/money.ts` (min 2 / max 8 decimales, trailing
  zeros recortados, mismas 3 ramas que `money()`). Migrados los 5 call sites de WIN (LAST WIN del
  TopBar, ClusterWinAmount, TumbleWinAmount, Win, FreeSpinOutro). Balance/bet siguen con `money()`.
  **Sin tocar el package compartido** (afecta 9 apps). Verificado: bet $0.25 × 1.1 → "$0.275" en
  card de replay y LAST WIN; bet/balance en 2 decimales.
- → **El formatter de moneda del SDK asume 2 decimales; todo juego con tumbles/clusters paga
  sub-cent y necesita la variante precisa para wins desde el día 1.**

### N3.2 — Social: "COST" y "FUNDS" sin regla en el diccionario
- **Síntoma**: screenshots con "COST" subrayado (tabla PLAY MODES, modal VAULT CRACK, ARE YOU SURE)
  y "INSUFFICIENT FUNDS TO PLACE THIS PLAY..." en la notificación de autoplay.
- **Causa**: la tabla oficial (sección E) no lista "cost" suelto ni "funds" — el diccionario los
  seguía dejando pasar. El reviewer los considera restringidos igual (los docs no son exhaustivos).
- **Fix**: reglas nuevas en `game/social.ts`, orden multi-palabra primero:
  `payout multiplier→final multiplier` · `cost multiplier→feature multiplier` ·
  `total bet cost→total play amount` (los 3 son mapeos EXPLÍCITOS del reviewer para la replay card) ·
  `costs?→amount` · `funds→coins`. El mensaje queda "INSUFFICIENT COINS TO PLACE THIS PLAY.
  PLEASE ADD COINS TO YOUR ACCOUNT OR LOWER THE PLAY LEVEL." (regla regex, NO override del catálogo
  i18n — el texto real-money debe seguir diciendo FUNDS/BET).
- → **La tabla de los docs es el piso, no el techo: cualquier término "monetario" va al diccionario
  aunque no esté listado.**

### N3.3 — Replay sin pantalla inicial (Replay Support incompleto)
- **Síntoma**: "implement the Replay Mode in accordance with the Replay Support section" — pidieron
  language param, botón de replay al final, y pantalla inicial con Play cost / multiplier / total,
  como su screenshot de ejemplo ("Bet Replay" card).
- **Causa**: el overlay solo tenía badge + botón PLAY/PLAY AGAIN; el core (URL params, requestReplay,
  fases) ya existía.
- **Fix**: `ReplayOverlay.svelte` rediseñado — card con Mode / Base Bet / Cost Multiplier / Total Bet
  Cost / Payout Multiplier / Total Win + "Start Replay" + disclaimer; en `done` reaparece con
  "Replay Again" (mismo mecanismo, sin refetch). Strings por i18n (keys en `messagesMap/en.ts`) →
  responden a `?lang=`; en social el observer aplica los mapeos del reviewer (Base Play / Feature
  Multiplier / Final Multiplier). Popout S: card compacta bajo `@media (max-height: 300px)` +
  `box-sizing: border-box` (sin él, `max-height` content-box desbordaba el viewport 400×225).
- **Unidades** (corregido en N3.6): `?amount` = **BASE bet** (los book units son múltiplos de la
  base: 100 = 1× wagered). La card deriva Total Bet Cost = base × costMultiplier y muestra el
  Payout Multiplier relativo al Total (`finalWin/100/costMultiplier`) para que Total × Mult = Win
  cierre a la vista — verificado contra el playback (card $4.80 = LAST WIN $4.80).

### N3.4 — VAULT_CRACK event 126891: wilds de Kash Smash invisibles en spin 1
- **Síntoma**: "the first spin does not inject Wilds as described in the game rules".
- **La math era correcta** (el book tenía el evento `kashSmash` y el `winInfo` pagaba con esos
  wilds) — el problema era de presentación, con TRES bugs apilados:
  - **Bug A (math)**: `gamestate.py` emitía el `reveal` en `draw_board()` ANTES de
    `apply_kash_smash()` → el board serializado no contenía los wilds.
  - **Bug B (frontend)**: los handlers `kashSmash`/`forcedWild` eran no-ops (solo SFX) — la v1 los
    animaba y se perdió en el port.
  - **Bug C (math)**: `kash_smash_event`/`forced_wild_event` emitían `row` SIN el offset de padding
    `+1` que usan todos los demás eventos posicionales del SDK.
  - Además: 3,2% de books tenían 0 wilds netos (la inyección podía caer sobre un W natural) y las
    rules decían "any play mode" cuando el trigger natural no tiene Kash Smash.
- **Fix (decisión: regenerar math + frontend)**: reordenar el flujo a
  `draw_board(emit_event=False)` → inyección → `reveal_event` → `kashSmash`/`forcedWild`
  (las funciones de inyección ahora devuelven posiciones y el gamestate emite después del reveal,
  para que el cliente anime sobre el board nuevo); padding `+1` en `game_events.py`; `candidates`
  excluye `W` (inyección siempre neta). Re-sim de los 3 buy modes (250k c/u, ~7 min) + optimizador +
  format checks — RTP 0.965 en los 4 modos, max win 5000×. `base` NO se regeneró (sin inyección el
  reorden emite un book idéntico). Frontend: handlers animan `positions` vía `animateSymbols` (ya
  vienen paddeadas). Rules reescritas con modos explícitos ("spin 1 of VAULT CRACK, SMASH MODE and
  RAGE MODE...", "Free Spins triggered naturally by scatters do not include Kash Smash", Force Wild
  como "guarantee at least one wild").
- **⚠️ Los event IDs de replay de los buy modes cambiaron** — tabla nueva en `HANDOFF.md` y
  `GAME_DETAILS.md`. Los de `base` siguen vigentes.
- → **Todo evento custom de la math debe (a) mutar el board ANTES de serializar el reveal,
  (b) emitir posiciones con la misma convención de padding que el SDK, y (c) tener un handler real
  en el frontend — un no-op "temporal" del wireframe es un rechazo garantizado.**

### N3.5 — Barrida propia: console.log del SDK en cada reveal del replay (PROD)
- **Síntoma**: verificando el build de PROD (lección de D), el replay logueaba
  `mock request end-event: {index, type: reveal}` en CADA reveal — 10 logs por replay de bonus.
  El reviewer mira los replays con consola abierta (así encontró lo de los wilds) y la consola
  sucia ya fue rechazo en N2.2.
- **Causa**: `packages/utils-book/src/utils.ts:recordBookEvent` — en replay/chromatic no settlea
  contra el RGS (correcto) pero el `console.log` de esa rama no estaba gateado a DEV.
- **Fix**: gate `import.meta.env.DEV` (package compartido, pero el cambio solo silencia un log —
  mismo precedente que pixi-svelte en N2.2; utils-book se consume desde src, sin rebuild de dist).
- → **El scan de consola debe correr sobre el REPLAY en prod, no solo el juego normal — el replay
  ejercita ramas de código distintas (recordBookEvent, resumeBet) con sus propios logs.**

### N3.6 — Review adversarial: la replay card mentía en los buy modes
- **Síntoma**: la primera versión de la card asumía `?amount` = total debitado. En realidad
  `?amount` = **base bet** (misma semántica que play normal: `wageredBetAmount = betAmount` y el
  RGS debita base × costMultiplier server-side; los book units son múltiplos de la BASE). En
  VAULT_CRACK con base $1 la card mostraba Base Bet $0.01 / Total $1.00; en SMASH_MODE la base
  daba $0.00. **En BASE (cost 1×) los dos modelos coinciden — por eso el E2E inicial pasó**: el QA
  usaba mode=base por default.
- **Fix**: `baseBet = wagered`, `totalBetCost = base × costMultiplier`, y el Payout Multiplier de
  la card relativo al Total (`finalWin/100/costMultiplier`) para que la aritmética visible cierre
  (Total × Mult = Win). Bonus defensivo en `Authenticate.handleReplay`: normaliza `state`
  top-level vs `round.state` (el mock devuelve ambos "por simetría"; el RGS real puede anidar) y
  fallback de amount a `round.amount` si la URL no lo trae.
- → **Todo QA de replay debe correr también con un BUY mode — en base los errores de
  base-vs-total son invisibles porque costMultiplier = 1.**

### N3.7 — Review adversarial (math): base es irreproducible con el config actual (deuda latente)
- Verificación positiva: re-ejecutar 2.714 books almacenados de base bajo el código N3 da books
  **byte-idénticos** → el reorden del reveal es neutro para base y la decisión de no regenerarlo
  fue correcta.
- **Pero**: el config actual tiene DOS Distributions con criteria `"freegame"` en base (la del fix
  check-40 con force_win_range 1000-4999 y la normal — el SDK matchea por nombre y devuelve la
  primera) y los 50 books `"bigwin"` del fix referencian un criteria que ya no existe. Consecuencia:
  los books de base NO se pueden re-ejecutar/auditar desde el árbol actual, y una **re-sim ingenua
  de base produciría math rota en silencio** (~10% de books forzados a la banda 1000-4999×). No
  bloquea el submit (books y LUT son datos estáticos ya verificados), pero es una bomba para
  cualquier regeneración futura.
- → **Antes de volver a simular base: renombrar el criteria del check-40 a uno único y re-mapear su
  fence, o regenerar con un snapshot del config de esa época.** (Detalle en 04-technical-gotchas.)

### N3.8 — Auditoría total: robustez del error path de replay + consola en errores
- **Síntoma** (auditoría full con RGS caído / evento inexistente): `handleReplay` no tenía
  try/catch ni chequeaba `data.error` → unhandled rejection en consola + loader colgado (RGS
  caído) o card zombie en 0.00 (200 con error). `recordBookEvent` llamaba `requestEndEvent`
  async dentro de un try/catch síncrono → unhandled rejection con red flaky durante el bonus.
  `rgsFetcher` emitía `console.error` sin gate en cualquier non-200.
- **Fix**: try/catch + check de `data.error` en `handleReplay` (betToResume queda null → modal
  REPLAY_NOT_FOUND de ResumeBet); `ResumeBet` exige `savedBet.state.length` (no solo truthiness);
  `.catch()` en el end-event best-effort; `console.error` del fetcher gateado a DEV; en replay
  social sin `?currency`, fallback a XGC (el default USD pintaba "$" — prefijo prohibido).
- Verificado E2E contra PROD: replay con 404 → modal visible + consola 0 mensajes; RGS caído →
  ídem; replay normal → consola 0.
- → **El error path es parte del approval: el reviewer va a probar URLs de replay inválidas, y
  una unhandled rejection es consola sucia igual que un log.**

---
