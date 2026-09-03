# Checklist oficial de approval — Stake Engine (ACP)

Fuente: los 88 docs oficiales de Stake Engine (`stake-engine.com/docs`), consultados vía el subagent
`stake-engine` (Hayden). Para dudas nuevas, preguntarle a ese subagent — SIEMPRE cita las páginas y
no inventa. La fuente de verdad activa de la API es `/docs/api/authenticate` (no `/docs/example/*`,
que son páginas demo).

---

## 1. Proceso de review

- 3 reviewers anónimos, escala fraccional. Promedio → 0-3 estrellas.
- **Umbral mínimo: promedio < 1.0 estrella = NO aprobado** (regla vigente desde marzo 2026).
- Rechazo → thread se bloquea 7 días, luego se resubmite en el MISMO thread (no crear uno nuevo).
- Re-ranking semanal los viernes (hora Australia).

## 2. Originalidad / restricciones (rechazo directo)

- Juego **stateless**: cada bet independiente. **Prohibido**: jackpots, gamble, cash-out anticipado,
  continuación entre rondas.
- Diseño original. Sin assets de los juegos de ejemplo del web-sdk. Sin branding Stake™/Kick™.
- Sin contenido ofensivo / que atraiga a menores.
- Post-release: solo fixes visuales menores. Cambios de math/mecánica = nuevo slug + re-aprobación.

## 3. Frontend requirements (`/docs/approval/frontend-requirements`)

- Assets audio/visual únicos, sin bugs visuales.
- **Popout view** (mini-player) sin distorsión.
- Mobile con TODAS las funciones de UI usables al escalar.
- Fuentes/recursos desde el CDN de Stake (no externos → XSS policy).
- **Reglas accesibles desde la UI** con: todas las reglas, RTP del juego y de cada modo, max win de
  cada modo, payouts de todas las combinaciones de símbolos, valores de símbolos especiales, cómo
  se gatillan features/bonus y su costo.
- **Controles**: cambiar bet usando TODOS los bet-levels de `authenticate` (no lista hardcodeada);
  balance visible; win final claro; payout incremental si hay múltiples acciones ganadoras; toggle
  de sonido; **barra espaciadora = bet**; **autoplay con confirmación explícita**.
- Network tab sin errores ni logging de info de juego. **Consola sin logs.**
- Testear con combinaciones de monedas e idiomas.

### Viewports soportados (`/docs/reference/dimensions`)

Desktop 1200×675 · Laptop 1024×576 · Popout L 800×450 · Popout S 400×225 ·
Mobile L 425×812 · Mobile M 375×667 · Mobile S 320×568.

**→ Todo overlay/menú debe caber y ser cerrable en los 7. Popout S (400×225) y Mobile S (320×568)
son los que rompen. Ver `02-rejection-log`.**

### Guidelines agregados post-jul-2026 (el checklist del ACP CRECE con el tiempo)

- **"Game should not contain the Stake Engine Loader"** (apareció ~31-07-2026, retroactivo
  a juegos LIVE): el splash `LoaderStakeEngine` + `stake-engine-loader.gif` que trae el
  template del web-sdk debe ELIMINARSE — el juego arranca directo con el loader propio.
  Fix: quitar el componente del `+layout.svelte`, borrar el gif de `static/`, verificar
  que el bundle no lo contenga. Revisar el checklist del ACP periódicamente aunque el
  juego esté aprobado: los guidelines nuevos aplican retroactivamente.

## 4. Disclaimer legal (rechazo automático si falta un punto)

En el popup de reglas/info, accesible siempre. Debe cubrir los 7:
1. Malfunction anula wins/plays.
2. Requiere conexión estable.
3. Recuperación tras desconexión (recargar para terminar rondas).
4. RTP es esperado sobre muchas jugadas, no por sesión.
5. Display ilustrativo, no dispositivo físico.
6. Payout viene del RGS, no del navegador.
7. Copyright/trademark.

(Kash Smash: texto en EN + ES en `Game.svelte` snippet `gameRules`. Copiable como base.)

## 5. Math requirements (`/docs/approval/math-requirements`)

- RTP **90.0%–98.0%**.
- Multi-modo: TODOS los modos dentro de **±0.5%** del base.
- Max win **realmente obtenible** (típicamente mejor que 1 en 10.000.000).
- Simulaciones **100k–1M** por modo (slots).
- Hit-rate de wins no-cero mejor que ~1 en 20.
- Sin "huecos" grandes en la distribución de payouts.

## 6. RGS requirements (`/docs/approval/rgs-requirements`)

- Respetar `betLevels` / `minBet` / `maxBet` / `stepBet` / `defaultBetLevel` del `authenticate`.
- `rgs_url` SIEMPRE del query param, nunca hardcodeado.
- Build 100% estático, cero requests externos.
- Inglés obligatorio; texto no se corrompe con `lang` desconocido.

## 7. Bet replay (`/docs/api/bet-replay`) — OBLIGATORIO

- `replay=true` → auto-carga la ronda, muestra botón **Play** (NO auto-reproduce).
- Durante replay: **ocultar** balance, botones de bet, selector de monto, autoplay.
  **Mantener** win amount, bet amount del replay, moneda.
- Post-replay: botón **Play Again**.
- **Event IDs para el review**: 5 por bet mode cubriendo normal win, big win, win cap, loss, bonus
  trigger. Los reviewers los REPRODUCEN — probar edge cases antes de submit.

## 8. Paquete de archivos (math) — verificado al upload

Mínimo 3 archivos por modo:
- **`index.json`** (nombre exacto): declara modos con `name/cost/events/weights`.
- **Lookup Table CSV** sin header, 3 columnas `uint64` (sim_id, weight, payout_multiplier). Todo entero.
- **Books `.jsonl.zst`** (ZStandard). `id` = número de línea (0-indexed) = sim_id del LUT.
- `payoutMultiplier` de books y LUT deben **matchear exacto** (el RGS los hashea y compara — mismatch = falla el upload).
- Multiplicador en formato x100 (entero, granularidad mínima 0.01x).
- OJO: el uploader del ACP trunca archivos >~1 GB. Books de buys a 250k sims (~400 MB) es tamaño seguro.

## 9. Social mode / stake.us (`/docs/reference/social-mode`)

- `social=true` → **inglés forzado** + reemplazar TODOS los términos restringidos (UI, reglas, imágenes).
- Sin esto no se aprueba para stake.us. El reviewer testea con el toggle social.
- **La tabla oficial de wording está en el checkbox del submit** (~33 frases) — es MÁS larga que la de
  los docs. Ver `02-rejection-log` para la lista completa que usó Kash Smash.
- Currency **XEC** debe mostrarse como **SC** (sweeps coins). También XGC→GC, XSC→SC.

## 10. Game tile (`/docs/approval/game-tile`) — Tile Editor del ACP

- Background **más brillante que la plataforma Stake** (los oscuros se pierden). **Sin texto ni
  multiplicadores en las imágenes.**
- Foreground: personaje/símbolo transparente que llena el área de foco.
- Gradiente discreto; título en capa aparte, máx 2 tamaños de texto.
- **Se compone en el ACP** (no se sube armado). Cambios de tile NO requieren re-review del juego.

## 11. Resume / end-round

- Payout 0 → el RGS auto-cierra la ronda (NO llamar end-round).
- Payout > 0 → hay que llamar `end-round` para acreditar.
- Al `authenticate`, si `round != null` → mostrar el resultado y llamar end-round.

## 12. Jurisdiction flags — IGNORAR (verificado en docs, 2026-07)

`config.jurisdiction` del authenticate dice textualmente **"Do not used. Ignore."** en
`/docs/api/authenticate`. NO hay que implementar `displayRTP` / `displayNetPosition` /
`displaySessionTimer` / `minimumRoundDuration` / session timer / net position para aprobar.
La tabla detallada de flags solo está en `/docs/example/api`, que es una página DEMO del sistema de
docs, no la referencia activa. Los `disabled*` (turbo/autoplay/buy/spacebar/slamstop) que Kash Smash
consume quedan como defensa inocua, no como requisito.
**→ Re-verificar con Hayden antes de cada submit por si cambia.**
