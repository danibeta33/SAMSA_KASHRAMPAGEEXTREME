# DEAD HEAT — Log de rechazos de Stake Engine Support

Mismo formato que `02-rejection-log-kash-smash.md`. Leer antes de cada
re-submit: cada entrada tiene el issue LITERAL del reviewer, la causa raíz
real (no la aparente) y el fix.

---

## Tanda 1 — 26-08-2026 (3 issues, primer feedback post-submit)

### 1.1 — "The game does not function correctly in Popout S/L mode" (Paytable / Game Rules)

**Reviewer**: capturas de PAYTABLE y GAME RULES en popout con la mitad
superior del marco VACÍA (recuadro verde sobre el hueco negro arriba del
título).

**Causa real**: `div.kash-doc` (el marco brandeado de rules/paytable en
`Game.svelte`) tenía `padding: 104px 42px 36px 38px` — **px fijos** sobre un
marco que va de 680px (Desktop) a ~251px de ancho / 211px de alto (Popout S):
los 104px de arriba eran el **49% del alto del panel**. El clásico patrón
"px fijos en panel que escala" de la KB (HANDOFF 25-08).

⚠ **NO era un asset sin precargar** (hipótesis inicial): se verificó con
Playwright que `paytable_lettering.webp` cargaba (`img.complete = true`) y el
mismo hueco aparecía en GAME RULES, que no tiene ninguna imagen en esa zona.

**Fix** (`Game.svelte`):
- padding proporcional: `--docw` + `calc(var(--docw) * 0.1529)` etc.
  (104/680 · 42/680 · 36/680 · 38/680 → Desktop idéntico).
- el contenido `lb-*` (rules + paytable) escalaba en `rem` fijos y la tabla
  desbordaba a lo ancho en popout → `container-type: inline-size` en
  `.kash-doc` + var `--lbf: clamp(6px, 2.667cqw, 16px)` (⚠ cqw resuelve
  contra el CONTENT box: 16/600, no 16/680) y TODOS los tamaños lb-* como
  múltiplos de `--lbf`.
- ⚠ hallazgo: el package `ModalPayTable` (components-ui-html, compartido con
  Kash Smash — NO tocar) mete `td/th { padding: 4px 10px }` y
  `overflow-x: auto` en `.kash-doc__body` con MÁS especificidad que las
  reglas de la app — los paddings rem de las tablas **nunca habían
  aplicado**. Se re-pisan desde la app con selector más fuerte
  (`.kash-doc .kash-doc__body table td`), manteniendo los 4px/10px reales de
  Desktop (= `--lbf` × 0.25/0.625) y `overflow-x: hidden` (scroll del doc
  SOLO vertical).

### 1.2 — "The Play/Bet text overlaps with the Balance text" (replay screen)

**Reviewer**: en el replay, arriba a la izquierda, el label del bet se lee
pisado con "BALANCE". Dos capturas: "Bet" (real money) y "Play" (social).

**Causa real**: en replay `HudRail` oculta el balance y muestra el bet en el
panel de BALANCE… pero `panel_balance.webp` trae el **"BALANCE" horneado**
(y 47-69 de 221) y el `<span>` BET/PLAY del código caía encima → los dos
textos superpuestos.

**Fix**:
- **`panel_plain.webp`** nuevo: el mismo panel con el lettering borrado
  (relleno del fondo plano #141414, patrón `bet_panel_social` — generado por
  script, 0 px rosa residuales). En replay el panel del bet usa esa variante.
- el label BET/PLAY va `position: absolute; top: 21%` — clavado donde vivía
  el horneado — en el magenta del kit (`#c3318c`).
- `htmlAssets.svelte.ts` precarga `panel_plain` o `panel_balance` según
  `stateUrlDerived.replay()` (mismo criterio que `bet_panel_social`).

### 1.3 — "the replay window can currently be scrolled both horizontally and vertically" (Popout S)

**Reviewer**: la card de Bet Replay con scrollbars en los DOS ejes; pide que
todo entre sin scroll (o scroll en UN eje como máximo).

**Causa real** (dos bugs):
1. **Horizontal (en TODOS los viewports, Desktop incluido)**:
   `.replay__rows` con `width: 100%` + padding lateral + border en
   `box-sizing: content-box` (default) → 18px MÁS ancho que la card. Además
   `overflow-y: auto` computa `overflow-x` a `auto` → barra horizontal.
2. **Vertical (Popout S)**: el contenido compacto medía 233px contra 208 de
   card.

**Fix** (`ReplayOverlay.svelte`):
- `box-sizing: border-box` en `.replay__rows` + `overflow-x: hidden` en la
  card (el scroll permitido queda SOLO vertical, y con el contenido
  entrando no aparece nunca).
- media query compacta: breakpoint `max-height: 300px → 420px` (cubre
  también Popout L 640×360, donde la card full-size de ~400px tampoco
  entraba) y valores más apretados: contenido 188px = card 188px en 400×225.

**Verificación (26-08)**: Playwright — doc modals FIT en PopoutS/L y Desktop
idéntico (font 16px exacta, td 4px 10px); replay card sin scrollbars en
PopoutS/PopoutL/Desktop, normal y social; label PLAY/BET limpio sobre panel
sin horneado. + suites qa_viewports / qa_social_replay /
qa_overlays_compliance / qa_smoke.

---

## Tanda 2 — 27-08-2026 (1 issue)

### 2.1 — "All symbols in the paytable must be visually represented using their corresponding images or icons"

**Reviewer**: la tabla del paytable y las secciones de símbolos especiales
mostraban solo los NOMBRES de los símbolos, sin su imagen.

**Fix** (`Game.svelte`): ícono junto al nombre en la primera columna de la
tabla (`.lb-sym-cell`, flex) y en los bullets de especiales de AMBOS modals
(`.lb-sym-li`: WILD y las 3 cards de rival en paytable Y game rules).
- Assets: los webp sueltos de `static/assets/sprites/symbols/` (mapeo de
  `assets.ts`: p1 Bluff · h3 LB Ring · h2 Money Bag · h1 Whistle · m2 UZI ·
  m1 Vial · l4 Sneakers · l3 Ball · l2 Hoop · l1 Shot Clock · w WILD ·
  sa/sw/so cards).
- Tamaño `calc(var(--lbf) * 2)` — escala con el panel como el resto del
  contenido, sin desbordar en Popout (verificado: hOverflow 0 en PopoutS).
- Los 14 webp entraron a la precarga de `htmlAssets.svelte.ts`.

**Verificación (27-08)**: Playwright — 14/14 íconos cargados en paytable y
4/4 en rules, Desktop y PopoutS, 0 overflow horizontal. qa_viewports 56/56.

---

## Hallazgos propios durante la re-verificación (27-08, no reportados por Stake)

### H.1 — pageerror de audio en el BUILD (invisible en dev)
`qa_viewports` contra el build de producción (vite preview) tiró
`Failed to set the 'volume' property: volume provided (-0.001…) is outside
the range [0, 1]` en 6/7 viewports. En dev nunca aparece porque el audio va
MUTEADO. Causa: los ramps de volumen (crossfade/duck/fade-in de
`Sound.svelte`) calculan `t = (now - t0) / ms` con el timestamp del rAF —
que es la hora de INICIO del frame y puede ser ANTERIOR al
`performance.now()` que capturó `t0` → `t` negativo → `bgmFade` negativo →
`bgm.volume` negativo → throw. Fix: clamp de `t` a [0,1] en los 3 ramps +
clamp del producto final. ⚠ Lección: **correr QA contra el build, no solo
contra dev** — el mute de dev esconde toda la familia de bugs de audio.

### H.2 — banner "STAY AHEAD / IT ENDS WHEN THEY TIE YOU" invisible en Popout S/L
Lo cazó el usuario revisando popout. El banner del FS intro
(`bonus_intro_banner`, FreeSpinIntro.svelte) colgaba de `cardH/2 + 26` — en
los popouts la ficha del rival es proporcionalmente más grande y el banner
caía FUERA del canvas; además su ancho usaba `sizes.width * 0.7` en px de
canvas SIN compensar `mainLayout.scale` (el mismo bug de unidades del
25-08, arreglado entonces solo para portrait). Fix: en buckets < 700px el
ancho se compensa por scale (0.85 del ancho real de pantalla) y el `y` se
clampea para que el borde inferior no pase del 78% del alto del main; en
Desktop/Tablet el clamp es 84% y NO muerde el valor natural — el layout
congelado no cambia. Verificado con bounds reales de Pixi (getBounds) en
Desktop/PopoutS/PopoutL/MobLand: VISIBLE en los 4, Desktop idéntico.

---

## Tanda 3 — 27-08-2026 (1 issue CRÍTICO)

### 3.1 — "The game does not launch correctly on iPhone" (iPhone 12, iOS 18.6.2, Safari)

**Reviewer**: el loading llega al 100%, la página se refresca sola y Safari
muestra "A problem repeatedly occurred on [URL]" — video adjunto en el hilo.

**Causa real**: **out-of-memory de WebKit**. Ese mensaje es el jetsam de
Safari: mata la pestaña al pasar ~1-1.5 GB, reintenta, vuelve a morir. El
juego decodifica **3.25 GB de texturas** — 3.0 GB son los 67 atlas de
`sprites/anim` (sheets 4096², ~65 MB de RAM c/u) que el loader carga TODOS
en el boot y `TexturePrewarm` además sube a GPU al cerrar el load (pico
RAM+VRAM justo en el 100% — calza exacto con el síntoma). Desktop sobrevive
por RAM; Kash Smash nunca lo sufrió porque su set es mucho más chico.

**Fix**:
1. **Variantes `.half` de los 67 atlas** (script PIL: bitmap 0.5× + JSON con
   coordenadas escaladas; mismos nombres + sufijo `.half`). RAM de anim:
   3.0 GB → **0.76 GB** (total ~1.0 GB). En pantalla de teléfono la
   diferencia es invisible (frames de ~2000px mostrados a <500px).
2. **Flag `LOW_MEM`** en `assets.ts`: iOS/iPadOS (UA + MacIntel con touch) o
   `deviceMemory ≤ 4`; forzable con `?lowmem=1/0` para probar en Desktop.
   `animSrc()` elige la variante por flag.
   ⚠ La ruta del `new URL` va por VARIABLE: con template literal inline,
   Vite lo convierte en glob build-time que resuelve vacío (los atlas viven
   en static/) y devolvía undefined.
3. **`TexturePrewarm` no sube a GPU en LOW_MEM** (evita el doble pico del
   boot; cada atlas paga su upload de 33-50ms en el primer uso).

**Verificación (27-08)**: con `?lowmem=1` en Desktop — texturas medidas por
Pixi a 2048px (half) vs 4095 (full con lowmem=0), fs_intro + spin + **bonus
Ash completo** sin un solo error de consola y visual idéntico. Los atlas
originales quedan intactos para Desktop.

⚠ **Antes de re-submit conviene probarlo en un iPhone REAL** (dev server por
LAN) — el crash es de memoria del dispositivo y no se puede reproducir del
todo en Desktop.
