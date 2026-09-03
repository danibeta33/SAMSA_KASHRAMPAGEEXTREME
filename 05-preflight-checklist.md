# Pre-flight checklist — antes de cada submit de Dead Heat

Tildable. Todo verificado contra el BUILD DE PRODUCCIÓN servido como CDN (subpath), con el mock en
condiciones de reviewer (`--currency XEC --bet-levels 35 --default-bet 200000`) y `demo=true` en la URL.

## PreChecks del ACP (bloquean antes de entrar a review)
- [ ] **SIN Stake Engine Loader**: ni el componente `LoaderStakeEngine` montado ni el
      `stake-engine-loader.gif` en `static/` (guideline jul-2026 "Game should not contain the
      Stake Engine Loader" — Kash Smash lo eliminó; el fork del template lo trae de vuelta ⚠).
- [ ] Authenticate contra el RGS ok en launch; `rgs_url` inválido → error visible.

## Consola (motivo #1 de rechazo repetido)
- [ ] `hello: false` en el init de Pixi.
- [ ] Cero `console.log/debug/info/warn` sin gatear a `import.meta.env.DEV`.
- [ ] i18n compiler seteado en PROD (`setMessagesCompiler`, `game/i18nCompiler.ts`).
- [ ] Loading NO deja entrar hasta `stateApp.loaded` (sin fallback por tiempo). Retry de assets ×3.
- [ ] Consola en CERO probada con CDN LENTO (throttle de símbolos) — 0 "Sprite key not found".
- [ ] Consola en cero a través de: base game, autoplay completo, bonus, replay.

## Bet / RGS
- [ ] Bet inicial = `config.defaultBetLevel` del authenticate.
- [ ] Bet menu = lista COMPLETA de `betLevels` (probado con ~35, no 10).
- [ ] Levels que el balance no banca → `disabled` en el menú; +/− y menú usan la misma lógica de clamp.
- [ ] `rgs_url` del query param, nunca hardcodeado. Build 100% estático, cero requests externos.

## Currency / idioma
- [ ] XEC se muestra como SC en balance, bet, win, celebraciones.
- [ ] `lang` desconocido cae a inglés sin corromper texto.

## Overlays / menús (probar en LOS 7 viewports, foco Popout S y Mobile S)
- [ ] Menú principal, paytable, game rules, settings, bet menu, buy bonus, buy confirm (2 pasos),
      autoplay (+ ADVANCED expandido): cada uno DENTRO del viewport, X visible+clickeable, cierra.
- [ ] Ningún overlay con `max-height: none` en el breakpoint corto.
- [ ] Sin render duplicado del Popup del SDK (borrar el `<div>{@render children()}</div>` suelto).

## Autoplay
- [ ] Requiere confirmación explícita para arrancar.
- [ ] Límites loss/single-win CORTAN y notifican (no cosméticos — setear los `autoSpins*LimitAmount`).
- [ ] BONUS deshabilitado durante autobet. Contador de spins restantes visible.
- [ ] Comprar bonus + autoplay ≠ loop (modo resetea a BASE, counter se corta). Verificar gasto ≈ base.
- [ ] STOP durante autoplay funciona.

## Wins / celebraciones
- [ ] "MAX WIN" SOLO en el cap real. Wins grandes no-cap usan tier inferior.
- [ ] Win final claro en todos los casos (incluido slam-stop en medio de tumbles).
- [ ] Payout incremental si hay múltiples acciones ganadoras.

## Bet replay (obligatorio)
- [ ] `replay=true`: auto-carga, botón PLAY (no auto-reproduce), oculta balance/controles, mantiene
      win/bet/moneda, botón PLAY AGAIN.
- [ ] `requestReplay` fallido → modal de error, no PLAY muerto.
- [ ] **Event IDs listos**: 5 por bet mode (normal/big/win cap/loss/bonus trigger), VERIFICADOS contra
      el LUT publicado. Ponerlos en el GAME_DETAILS.

## Social mode (stake.us)
- [ ] `social=true` fuerza inglés + reemplaza la tabla oficial COMPLETA (~33 frases, la del checkbox).
- [ ] Cero términos restringidos en HUD/reglas/paytable/buy menu (escanear innerText con la regex).
- [ ] Bitmaps con texto restringido cubiertos (o regenerados). "Stake Engine" intacto.

## Reglas / disclaimer / paytable
- [ ] Disclaimer con los 7 puntos, accesible siempre.
- [ ] Reglas: todas las mecánicas, RTP del juego y por modo, max win por modo, payouts de todos los
      símbolos, valores de especiales, triggers de bonus + costo. Valores CONSISTENTES con la math.
- [ ] Toggle de sonido. Barra espaciadora = bet.

## Math
- [ ] RTP 90–98%, modos dentro de ±0.5% del base. Max win obtenible.
- [ ] LUT↔books payoutMultiplier matchea exacto (verificar con python puro, no numpy).
- [ ] `index.json` correcto. Books de buys ≤ ~400 MB (uploader trunca >1 GB).

## Game tile (Tile Editor del ACP)
- [ ] Background brillante, SIN texto/multiplicadores. Foreground = personaje transparente.
- [ ] Se compone en el ACP. (No requiere re-review — se puede iterar después.)

## Empaquetado
- [ ] Build de prod fresco. `sizes.html` y labs DEV EXCLUIDOS del zip. QA hooks gateados a DEV.
- [ ] `index.html` en la RAÍZ del zip. Zip probado servido en subpath `/dead-heat/` (0 404s).
- [ ] Solo subir el frontend si la math no cambió.

## Antes de responder el thread
- [ ] Comment mapeado 1:1 contra el feedback (ver `REVIEW_REPLY.md` de Kash Smash como plantilla).
- [ ] Responder en el MISMO thread, no crear uno nuevo.
- [ ] Re-verificar los jurisdiction flags con Hayden (`stake-engine` subagent) por si cambió la doc.
