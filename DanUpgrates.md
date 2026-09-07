# DanUpgrates

Bitácora de refactors de arquitectura sobre `stake-web-sdk`. Un bloque por
paso ejecutado: qué se tocó, cómo se hizo y en qué estado quedó el sistema.

---

## Paso 1 — UiLab → Inspector Genérico (inversión de dependencia)

**Fecha:** 2026-09-04
**App:** `stake-web-sdk/apps/kash-rampage-extreme`
**Objetivo:** convertir el laboratorio de UI (tecla `T` y su gemelo externo
`/sizes`) en un **Inspector genérico y reutilizable**, sin ninguna referencia
a Kash Rampage Extreme, de modo que cualquier juego del monorepo pueda
inyectar sus propios controles.

### 1. Punto de partida (lo que estaba acoplado)

El panel conocía el juego en tiempo de compilación:

```text
labMeta.ts  ──import LAB_SLIDERS──▶  UiLab.svelte
            ──import LAB_SLIDERS──▶  routes/sizes/+page.svelte
UiLab.svelte ──import stateTweak/saveTweak/resetTweak/syncUi/RES_BUCKETS──▶ juego
```

Valores rígidos específicos del juego detectados en la investigación:

| Dónde | Qué había hardcodeado |
|---|---|
| `src/game/labMeta.ts` | `LAB_SLIDERS`: 12 sliders con `key/label/min/max/step` — `boardH`, `boardX`, `boardY`, `stackScale`, `stackRight`, `stackBottom`, `iconScale`, `iconX`, `iconY`, `kashH`, `kashX`, `kashY` |
| `src/components/UiLab.svelte` | `import { LAB_SLIDERS }`; imports directos de `stateTweak`, `saveTweak`, `resetTweak`, `syncUi`, `labState`, `RES_BUCKETS`; checkbox **LIBRE** con la clave literal `freeScale`; cálculo del label del bucket; formato del `COPY VALUES` (`bucket`, `viewport`, `freeScale`, …) |
| `src/routes/sizes/+page.svelte` | `import { LAB_SLIDERS, LabSliderKey }`; hooks por nombre `__stateTweak` / `__saveTweak` / `__resetTweak` / `__syncUi` / `__labState`; `freeScale` literal; clamp y redondeo del paso fino duplicados |
| `src/game/stateTweak.svelte.ts` | `const KEY = 'kash_tweak_v14'` (clave de persistencia como literal suelto) |

### 2. Modificaciones realizadas

**Archivos creados**

| Archivo | Rol |
|---|---|
| `src/lib/inspector/InspectorRegistry.svelte.ts` | **Nuevo núcleo genérico.** Registro reactivo (`$state`, Svelte 5) de categorías, sliders y toggles + contrato `InspectorHost`. No importa nada del juego. |
| `src/game/labInspector.svelte.ts` | **Puente de inyección.** Único archivo donde el juego se presenta ante el inspector: implementa el `InspectorHost` sobre `stateTweak` y registra el manifiesto. |

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `src/game/labMeta.ts` | Deja de ser el catálogo que importaban los paneles y pasa a ser el **manifiesto de datos del juego**: `LAB_STORAGE_KEY`, `LAB_TITLE`, `LAB_NOTE`, `LAB_CATEGORIES`, `LAB_TOGGLES`, `LAB_SLIDERS`. Los sliders pasan de `key` a `id` y ganan `category` / `order`. Solo tiene un `import type` (se borra al compilar). |
| `src/game/stateTweak.svelte.ts` | `const KEY = LAB_STORAGE_KEY` — la clave de `localStorage` ya no es un literal en el estado; viene del manifiesto del juego, el mismo valor que se le pasa al inspector como `storageKey`. |
| `src/components/UiLab.svelte` | Reescrito como **panel agnóstico**: cero imports del juego, itera `inspector.groups`, renderiza sliders y toggles genéricamente, y despacha a `inspector.read/write/step/toggle/commit/reset/snapshot`. Gana prop `toggleKey` (default `t`), encabezados de categoría, scroll interno y guard para no capturar la tecla dentro de `input`/`textarea`. |
| `src/routes/sizes/+page.svelte` | El panel externo **descubre el catálogo en runtime** desde `iframe.contentWindow.__inspector` en vez de importarlo. Solo quedan `import type`. El clamp/redondeo del paso fino ya no se duplica: lo resuelve el registro del iframe. |
| `src/routes/+layout.svelte` | Llama `registerGameInspector()` bajo `import.meta.env.DEV` — es el punto de entrada donde el juego se inyecta. |

**Archivos eliminados:** ninguno. `labMeta.ts` se conservó a propósito
(reconvertido a manifiesto) porque `stateTweak` necesita leer la clave de
persistencia sin crear un ciclo de imports con `labInspector`.

### 3. Cómo se hizo (arquitectura Svelte 5)

**a) Registro reactivo con runas en una clase.**
`InspectorRegistry` usa campos privados con `$state` (`#host`, `#categories`,
`#controls`). Al ser un módulo `.svelte.ts`, las runas funcionan fuera de
componentes. Los consumidores leen por *getters* (`groups`, `status`,
`schema`, `ready`), así el `$state` interno nunca se expone mutable y cada
lectura desde un template registra su dependencia: cuando el juego llama
`registerSlider()` **después** de que el panel ya se montó, la UI se re-renderiza
sola. No hace falta ningún store adicional ni `$effect`.

**b) Inversión por contrato (`InspectorHost`), no por eventos.**
El registro no lee ni escribe estado: delega en el host que el juego inyecta
con `configure()`:

```ts
inspector.configure({
  title, storageKey, note,
  read:   (id) => tweak[id],
  write:  (id, v) => { tweak[id] = v; syncUi(); },  // vivo, sin I/O
  commit: saveTweak,                                 // persistencia del juego
  reset:  resetTweak,
  status: () => ({ label: bucketLabel(), detail: `${vw}×${vh}` }),
  snapshot: () => ({ bucket, viewport, ...valores }),
});
```

Se eligió **inyección por callbacks** en lugar de un bus de eventos porque el
panel necesita lectura *pull* sincrónica dentro del render (el valor del slider
se lee en cada frame del drag). Con eventos habría que mantener una copia
espejo del estado y sincronizarla; con callbacks el registro lee directo el
proxy `$state` del juego y la reactividad de Svelte 5 propaga sola.
`write()` es deliberadamente distinto de `commit()`: mantiene la optimización
original (el arrastre no escribe `localStorage`; solo al soltar).

**c) Persistencia con clave dinámica.**
`LAB_STORAGE_KEY = 'kash_tweak_v14'` vive en el manifiesto del juego. El
inspector la recibe como dato (`storageKey`) y `stateTweak` la consume para su
propia lógica por bucket. Ni `src/lib` ni los paneles contienen la cadena
`kash_*`. Cambiar de juego = cambiar el manifiesto; el mecanismo de guardado
sigue siendo del juego (buckets, seeds y overrides son semántica suya).

**d) Cruce de realms para `/sizes`.**
`configure()` publica `globalThis.__inspector = this` solo en DEV. El padre
(`/sizes`) hace polling hasta que `__inspector.ready` es `true` y desde ahí usa
`schema` (que devuelve `$state.snapshot(...)`, objetos **planos** — un proxy
`$state` cruzando de realm sería frágil) y llama `read/write/step/commit/reset/
snapshot` como métodos del iframe. Los hooks viejos (`__stateTweak`,
`__saveTweak`, `__resetTweak`, `__syncUi`, `__labState`, `__labBucket`) se
dejaron intactos para QA/Playwright.

### 4. Flujo de datos final

```text
        ┌──────────────── src/lib (genérico, reutilizable) ────────────────┐
        │  InspectorRegistry.svelte.ts                                     │
        │    $state: categorías + controles + host                         │
        └──▲───────────────────────────────────────────────▲──────────────┘
           │ registerCategory/Slider/Toggle + configure()   │ groups / read /
           │                                                │ write / commit
┌──────────┴───────────┐                        ┌───────────┴──────────────┐
│  JUEGO (KRE)         │                        │  PANELES (agnósticos)    │
│  labMeta.ts          │                        │  UiLab.svelte  (tecla T) │
│  labInspector.ts ────┼── host: read/write ───▶ │  /sizes  (vía __inspector│
│  stateTweak.svelte.ts│    commit/reset/status │        del iframe)       │
└──────────────────────┘                        └──────────────────────────┘
                 │
                 ▼  (sin cambios)
        syncUi() → stateUiTweak → hudLayout.boardTransform()
                 → Game / Background / BoardFrame / BottomBar
```

**Confirmación de la inversión:** ningún archivo bajo `src/lib/` importa nada
de `src/game/` ni de `src/components/`; `UiLab.svelte` no importa ningún módulo
del juego; `/sizes` solo conserva `import type` (borrado en compilación). La
dirección quedó `juego → inspector ← panel`, que era el objetivo.

### 5. Comportamiento preservado

- Tecla `T`, lado del panel (`⇄`, no persistido), sliders, `−`/`+` con
  `Shift ×10`, `COPY VALUES` (mismo JSON), `RESET BUCKET`, checkbox **LIBRE**.
- Persistencia idéntica: misma clave `kash_tweak_v14`, mismo formato
  `{ overrides: { [bucket]: {…} } }` — **los overrides guardados siguen
  válidos**, no hay migración.
- `input` no persiste / `change` sí; `−`/`+` persisten de inmediato.
- Buckets, seeds `PER_BUCKET_SEED`, `syncUi()` y `hudLayout` sin tocar.

**Diferencias visibles (intencionales):**

1. El panel `T` ahora muestra encabezados de categoría (GLOBAL / GRILLA /
   BOTONERA + ÍCONOS / KASH) y tiene scroll propio si no entra en pantalla.
2. La tecla `T` ya no alterna el panel si el foco está en un `input`/`textarea`
   (se alineó con el guard que ya tenía AnimLab).
3. `/sizes` muestra en el encabezado el **label** del bucket
   («Desktop (≥1100)») en vez de la clave cruda (`desktop`).

### 6. Análisis de riesgos

| Riesgo | Estado / mitigación |
|---|---|
| **`/sizes` depende ahora de un hook nuevo** (`__inspector`) | El polling espera `ready`, que solo es `true` después de `registerGameInspector()`. Si el juego no registra, el panel queda en «conectando…» con todo deshabilitado — degradación visible, no un crash. Los hooks viejos siguen publicados por `stateTweak`. |
| **Same-origin del iframe** | Sin cambios respecto del handoff: el padre lee `contentWindow`. Si algún día `/sizes` se sirve desde otro origen, hay que pasar a `postMessage`. El costo del cambio bajó: el contrato a serializar ahora es uno solo (`schema` + 6 métodos), no el objeto de estado completo. |
| **Orden de registro vs. montaje del panel** | `registerGameInspector()` corre en el `<script>` del layout, antes de que `UiLab` se monte. Aun si se retrasara, el catálogo es `$state` y la UI se rellena sola. |
| **SSR** | El registro se ejecuta también en el render de servidor; `configure()` es idempotente (guard `registered`) y no toca `window`. `stateTweak` conserva sus guards de `typeof window`. |
| **Doble registro / HMR** | Guard `registered` + `#register()` que hace `Object.assign` sobre el control existente en vez de duplicarlo. Existe `inspector.clear()` para reiniciar. |
| **Sin type-check automatizado en la app** | El paquete no tiene `svelte-check` ni config de ESLint propia (`eslint` falla por falta de `eslint.config.js`, preexistente). La validación fue `vite build`. |
| **Ámbito de reutilización** | El registro vive en `src/lib/` de esta app. Para compartirlo con otros juegos del monorepo hay que promoverlo a un package (`packages/inspector` o similar) — es un `git mv` + entrada en `package.json`, ya no requiere tocar los paneles. Pendiente para un Paso 2. |
| **Documentación** | `HANDOFF_LABS.md` §2 y §6 describen `labMeta.ts` como «definición única que los dos paneles importan». Eso ya no es cierto: hoy es el manifiesto que se inyecta. Ver nota abajo. |

### 7. Cómo agregar un control ahora (nuevo flujo)

1. Agregar la entrada a `LAB_SLIDERS` (o `LAB_TOGGLES`) en `src/game/labMeta.ts`
   con `id`, `label`, `min`, `max`, `step`, `category`.
2. Si la clave debe persistir por bucket, agregarla a `TWEAKABLE_KEYS` y a
   `Tweak`/`DEFAULTS` en `stateTweak.svelte.ts`.
3. Listo: **ambos paneles** (tecla `T` y `/sizes`) lo muestran sin tocar ningún
   componente. Antes había que editar el catálogo y revisar los dos consumidores.

Para hospedar otro juego: implementar un `InspectorHost` propio y llamar
`inspector.configure()` + `registerSlider()` desde su layout. El panel se
reutiliza tal cual.

---

## Paso 2 — Abstracción de AnimLab y Promoción Global

**Fecha:** 2026-09-04
**Alcance:** `stake-web-sdk` (monorepo completo, ya no solo la app)
**Objetivo:** desacoplar el `AnimLab` del juego, extraer todo el inspector a un
paquete del workspace y dejarlo listo para que otro juego (p. ej. "Dead Heat")
lo consuma sin copiar código.

### 1. Punto de partida (lo que seguía acoplado)

Después del Paso 1 el `UiLab` ya era agnóstico, pero:

- `AnimLab.svelte` tenía hardcodeados: 7 clips (`anim_kash_idle_stand1`, …),
  las coreografías de SMALL/BIG/MEGA/MAX WIN con `broadcastAsync('kashSwing')`,
  el `POST /debug/arm-next` de la tirada de rampage, el bonus trigger, la
  anticipación de reels, FS intro/outro, la transición, el soundboard leyendo
  `SFX_MAP` de `src/game/sound.ts`, los nudges de `swingAlign` y todo el
  diagnóstico de `window.__kashDbg` + `boardShake`.
- El núcleo genérico (`InspectorRegistry`, `UiLab`) vivía en
  `apps/kash-rampage-extreme/src/lib/`, invisible para el resto del monorepo.

### 2. Modificaciones realizadas

**Paquete nuevo: `packages/components-inspector`** (workspace `packages/*`,
`main: ./index.ts`, consumido como fuente igual que el resto del SDK).

| Archivo | Origen | Rol |
|---|---|---|
| `src/InspectorRegistry.svelte.ts` | movido desde `app/src/lib/inspector/` + extendido | registro reactivo: categorías, sliders, toggles, **acciones** y **diagnóstico** |
| `src/components/UiLab.svelte` | movido desde `app/src/components/` | panel de controles (tecla `T`) |
| `src/components/AnimLab.svelte` | movido y **reescrito** | panel de acciones + diagnóstico (tecla `A`) |
| `src/components/InspectorRemotePanel.svelte` | extraído de `/sizes` | el mismo panel, operando sobre un iframe |
| `src/inspectorBridge.svelte.ts` | extraído de `/sizes` | puente al registro de otro documento |
| `index.ts`, `package.json`, `tsconfig.json` | nuevos | barrel + manifiesto del paquete |

**Extensión del registro (tarea 1):**

- `registerAction(id, { label, category, callback, title?, variant?, row?, exclusive?, order? })`
  y el atajo `registerActions([...])`.
- `run(id)` ejecuta el callback; si la acción es `exclusive`, publica `running`
  y bloquea el resto hasta que la promesa resuelve (reemplaza el `let running`
  que vivía dentro del AnimLab).
- `groups` ahora entrega `{ category, controls, actions, actionRows }`;
  `actionRows` agrupa las acciones que comparten `row` en una fila horizontal
  (es lo que dibuja `x-5 / x-1 / x+1 / x+5`).
- `InspectorHost.diagnostics()` → `{ rows, guides?, empty? }` para el bloque de
  diagnóstico y las guías sobre el canvas.
- `read`/`write`/`storageKey` pasaron a opcionales: un panel de acciones puro
  (AnimLab) no persiste nada.
- La clase se exporta (`InspectorRegistry`) y el paquete instancia **dos**
  registros: `inspector` (id `layout`) y `animInspector` (id `anim`). Los hooks
  DEV se publican en `globalThis.__inspectors[id]`, con el alias histórico
  `__inspector` apuntando al registro `layout`.

**Limpieza de `AnimLab.svelte` (tarea 2):** quedó sin una sola referencia al
juego. Lo que hace hoy:

- itera `registry.groups` y dibuja toggles, botones y filas de botones `mini`;
- ejecuta `registry.run(id)` y deshabilita todo mientras hay una acción
  `exclusive` corriendo;
- corre **un solo `requestAnimationFrame`** que (a) mide FPS —única métrica
  genérica, agregada en este paso— y (b) relee `registry.diagnostics`;
- dibuja las guías que el host publica en px de pantalla, con un checkbox local
  para ocultarlas.

**Glue del juego (tarea 3): `src/game/labActions.svelte.ts`** (nuevo, ~330
líneas). Registra, sobre `animInspector`:

| Categoría | Contenido |
|---|---|
| `KASH — CLIPS` | 7 acciones `accent` → `window.__forceIdle(clip)` |
| `ALINEAR BATEO` | toggle `swingGhost` + 11 acciones `mini` en filas `dx`/`dy`/`ds` |
| `DIAGNÓSTICO` | `📌 fijar ref` / `limpiar` (mantienen el `pinned` del módulo) |
| `SITUACIONES` | SMALL/BIG/MEGA/MAX WIN, TIRADA BATEO, BONUS TRIGGER, ANTICIPACIÓN (todas `exclusive`) |
| `FREE SPINS` | FS INTRO, FS OUTRO |
| `OTROS` | TRANSITION |
| `SONIDOS` | 3 músicas + una acción por archivo AU derivada de `SFX_MAP` |

Más `buildDiagnostics()`, que arma las filas (clip, frame, centro/pies,
alto/ancho, Δ vs pin, swing dx/dy/escala, GRID shake) y las guías ya
convertidas a px de pantalla.

**Otros archivos modificados**

| Archivo | Cambio |
|---|---|
| `src/routes/+layout.svelte` | `import { UiLab, AnimLab } from 'components-inspector'` y, en DEV, `registerGameInspector()` + `registerGameLabActions(getContext())` |
| `src/routes/sizes/+page.svelte` | pasó de ~380 a ~200 líneas: solo presets + iframe; el panel es `<InspectorRemotePanel {bridge} …/>` sobre un `InspectorBridge` |
| `src/game/labInspector.svelte.ts`, `src/game/labMeta.ts` | imports apuntando a `components-inspector` |
| `apps/kash-rampage-extreme/package.json` | dependencia `"components-inspector": "workspace:*"` |
| `HANDOFF_LABS.md` | §2 (nueva §2.1 de inyección), §3.1–3.6, §5.2, §6 y §7 |

### 3. Cómo se hizo

**a) Acciones como callbacks, no como eventos.**
Una acción es `{ id, label, category, callback }`: el juego cierra sobre su
propio `eventEmitter` y su `context` al registrarla, y el panel solo llama
`registry.run(id)`. No hace falta que el panel conozca el tipo de eventos del
juego ni que exista un bus intermedio. El guard de concurrencia
(`exclusive` → `running`) subió al registro para que cualquier panel lo herede.

**b) Contexto de Svelte y el momento del registro.**
Los callbacks necesitan `getContext()` (eventEmitter, stateGame), que solo es
válido durante la inicialización de un componente. Se resolvió llamando
`registerGameLabActions(getContext())` en el `<script>` de `+layout.svelte`,
justo después de `setContext()` — misma inicialización de componente, sin
componentes puente ni `onMount`.

**c) Diagnóstico inyectado, no leído.**
El panel no toca `window.__kashDbg` ni `boardShake`: pide `host.diagnostics()`
una vez por frame y dibuja lo que venga. Las guías viajan en **px de pantalla**
porque la proyección canvas→pantalla (`x / dbg.cw * innerWidth`) depende del
juego. Así el mismo panel sirve para un juego Pixi, uno DOM o uno WebGL.

**d) Turborepo / pnpm workspace.**
`pnpm-workspace.yaml` ya incluye `packages/*`, así que alcanzó con crear el
paquete y declarar `"components-inspector": "workspace:*"` en la app. No hizo
falta tocar `turbo.json`: el paquete no tiene tarea `build` propia (se consume
como fuente TS/Svelte, igual que `components-shared`), así que hereda el
pipeline existente. Los enlaces de `node_modules` se crearon con la misma forma
que instala pnpm (`apps/kash-rampage-extreme/node_modules/components-inspector`
→ el paquete, y `packages/components-inspector/node_modules/svelte` → la copia
de `.pnpm`); un `pnpm install` los reproduce.

**e) Trampa encontrada y corregida: `$state` en campos de clase.**
El `tsconfig` del SDK (`config-ts/base.json`) usa `target: es6`, lo que implica
`useDefineForClassFields: false`; esbuild entonces **baja los campos públicos al
constructor** (`this.x = $state(...)`) y el compilador de Svelte rechaza esa
posición (`state_invalid_placement`). Se detectó corriendo los archivos por el
pipeline real de Vite. Solución adoptada en todo el paquete: los campos
reactivos son **privados** (`#x = $state(...)`, que esbuild sí preserva) con
getters públicos. Queda documentado en `HANDOFF_LABS.md` §7.

### 4. Estado final y verificación

```text
packages/components-inspector           ← 0 imports del juego, 0 strings de KRE
   ├── InspectorRegistry (layout + anim)
   ├── UiLab · AnimLab · InspectorRemotePanel · InspectorBridge
   ▲
   │ registran (solo DEV, desde +layout.svelte)
   │
apps/kash-rampage-extreme/src/game
   ├── labMeta.ts        → sliders, toggles, storageKey
   ├── labInspector.ts   → host de layout (stateTweak)
   └── labActions.ts     → acciones, soundboard, diagnóstico
```

Verificaciones ejecutadas:

- `vite build` completo de la app: **OK**, sin errores ni warnings nuevos, con
  prerender `200 /` y `200 /sizes`.
- Transformación de los 10 archivos tocados por el pipeline real de Vite
  (plugin de Svelte incluido, cliente y servidor): **OK**.
- `resolveId('components-inspector')` → `packages/components-inspector/index.ts`
  y `ssrLoadModule` del paquete: exporta `UiLab`, `AnimLab`,
  `InspectorRemotePanel`, `InspectorRegistry`, `InspectorBridge`, `inspector`,
  `animInspector`.
- Smoke test del registro en runtime: `configure` + `registerSlider` +
  `registerToggle` + `registerAction` + `run()` (callback ejecutado) +
  `step()` (clamp/redondeo) + `schema` plano + `actionRows`.

**Comportamiento preservado:** tecla `A` abre el AnimLab con las mismas
categorías, botones y textos; tecla `T` el UiLab; `/sizes` conserva presets,
checks verdes, escala del iframe, COPY VALUES (con el viewport del preset) y
RESET BUCKET. La persistencia sigue en `kash_tweak_v14` sin migración.

**Diferencias visibles (intencionales):** el AnimLab ahora muestra una fila de
`fps` arriba del diagnóstico, el bloque de diagnóstico está al principio del
panel (antes en el medio) y el checkbox de guías dice "Guías sobre el canvas".
El texto de ayuda del ghost ("Activá el ghost, reproducí SWING…") se movió al
handoff, que es donde se consulta el procedimiento.

### 5. Riesgos

| Riesgo | Estado / mitigación |
|---|---|
| **Enlace del workspace** | Los symlinks se crearon a mano con la forma de pnpm. En una máquina limpia (o tras borrar `node_modules`) hay que correr `pnpm install`; la dependencia ya está declarada. |
| **`$state` en campos públicos de clase** | Corregido y documentado. Si alguien agrega un campo reactivo público al paquete, el build falla con `state_invalid_placement`. |
| **Registro doble / HMR** | `registerGameInspector` y `registerGameLabActions` tienen guard de idempotencia; el registro hace `Object.assign` sobre entradas existentes. |
| **`getContext()` en el layout** | Depende de que `setContext()` corra antes en el mismo `<script>`. Si alguien mueve `setContext()`, la inyección de acciones rompe (error explícito de Svelte, no silencioso). |
| **`/sizes` en otro origen** | Igual que antes: el puente necesita same-origin. Ahora el contrato a portar a `postMessage` está aislado en `InspectorBridge`. |
| **Sin type-check automatizado** | La app no tiene `svelte-check`; el paquete tampoco. La validación es `vite build` + los chequeos de pipeline descritos arriba. |
| **Storybook** | El paquete no expone stories; si se quiere, hay que agregar `config-storybook` como en `components-shared`. |

### 6. Cómo lo implementa el próximo juego (p. ej. Dead Heat)

1. `package.json` de la app: agregar `"components-inspector": "workspace:*"` y
   correr `pnpm install`.
2. Crear el manifiesto del juego (`src/game/labMeta.ts`): `LAB_STORAGE_KEY`
   propio (¡otro string, no `kash_tweak_v14`!), categorías, sliders y toggles.
3. Crear `src/game/labInspector.ts`: `inspector.configure({ storageKey, read,
   write, commit, reset, status, snapshot })` sobre el estado de layout del
   juego + registrar el manifiesto.
4. Crear `src/game/labActions.ts`: `animInspector.configure({ title,
   diagnostics })` y `registerAction()` por cada clip/evento/sonido propio.
5. En `+layout.svelte`: `import { UiLab, AnimLab } from 'components-inspector'`,
   renderizarlos bajo `import.meta.env.DEV` y llamar a los dos registradores
   (el de acciones, después de `setContext()`).
6. Opcional, para el panel externo: `new InspectorBridge(() =>
   iframe.contentWindow)` + `<InspectorRemotePanel {bridge} />`.

Nada de eso toca el paquete: si un juego necesita un control nuevo (un color
picker, un selector), se agrega al registro genérico como un `kind` más y los
dos juegos lo heredan.

---

## Paso 3 — Sistema Genérico de Anclajes por Código

**Fecha:** 2026-09-04
**Alcance:** `stake-web-sdk` — la app `kash-rampage-extreme` + el paquete `pixi-svelte`
**Objetivo:** que el ancla (pivot) de cada sprite deje de ser una decisión
escrita a mano en cada componente y pase a ser un **dato resuelto por
`assetId`** en el punto donde el sprite se instancia, para (a) eliminar el salto
visual al intercambiar animaciones de distinto bounding box y (b) dejar esos
valores editables desde el Inspector Genérico en el Paso 4.

### 1. Punto de partida (el problema)

PixiJS 8 instancia todo `Sprite` / `AnimatedSprite` con **anchor (0, 0)**: lo que
queda clavado en `(x, y)` es la esquina superior izquierda del bounding box. En
cuanto dos clips del mismo actor tienen bounding box distinto —`anim_kash_swing`
viene de un canvas 1080² con el cuerpo desplazándose, los idles de un recorte
común 384×460— el punto anclado deja de ser el mismo punto anatómico y el
personaje **salta** al intercambiar animación.

En KRE eso estaba parcheado a mano, en un solo componente y repetido cuatro
veces:

| Dónde | Qué había hardcodeado |
|---|---|
| `src/components/Background.svelte` | `const CLIP_ASPECT = 384 / 460` |
| `src/components/Background.svelte` | `const SWING = { aspect, heightMul, anchorX, dxFrac, dyFrac }` — 5 constantes mágicas |
| `src/components/Background.svelte` | `const KASH_W / KASH_H / KASH_ASPECT` + el campo `kash.w` (tercera fuente de verdad para un aspect) |
| `src/components/Background.svelte` | El ternario `isSwing ? … : …` **repetido en `x`, `y`, `anchor`, `width`, `height`, `animationSpeed` y `zIndex`**, y la aritmética duplicada en 4 ramas del markup: ghost del AnimLab, clip actual, prototipo RAMPAGE y sprite estático de fallback |
| `packages/pixi-svelte` | Nada resolvía el ancla: `<Sprite>` y `<SpriteSheet>` conocen el `assetId` (su prop `key`) pero lo pasaban a PixiJS sin usarlo para nada más que buscar la textura |

Consecuencias: el ancla de un clip nuevo dependía de acordarse de copiar los
ternarios; nada podía leer "cuál es el ancla de este asset" desde fuera del
componente; y el inspector no tenía nada que direccionar.

### 2. Modificaciones realizadas

**Archivos creados**

| Archivo | Rol |
|---|---|
| `apps/kash-rampage-extreme/src/game/spriteConfig.svelte.ts` | **Registro de anclajes.** Reglas por patrón de id (tags), entradas explícitas por `assetId`, overrides reactivos `$state`, y `getSpritePlacement()` como única función de resolución. Sin dependencias de PixiJS. |
| `apps/kash-rampage-extreme/src/game/spriteFactory.ts` | **Sprite Factory.** Instanciación imperativa (`createAnimated` / `createSprite` → nodo PixiJS 8 con `anchor.set()` aplicado) y cálculo declarativo (`place()` → props para los componentes de `pixi-svelte`). También es quien enchufa el registro con el SDK. |
| `packages/pixi-svelte/src/lib/anchorRegistry.ts` | **Hook de inyección del SDK.** `setAnchorResolver()` / `resolveAssetAnchor()`. El paquete pregunta el ancla por `assetId` sin conocer ningún juego. |

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `packages/pixi-svelte/src/lib/components/Sprite.svelte` | `const anchor = $derived(baseSpriteProps.anchor ?? resolveAssetAnchor(key))` y se pasa al `<BaseSprite>`. |
| `packages/pixi-svelte/src/lib/components/SpriteSheet.svelte` | Lo mismo hacia `<AnimatedSprite>`. Éste es **el** punto de instanciación del `new PIXI.AnimatedSprite(...)` de un clip. |
| `packages/pixi-svelte/src/lib/index.ts` | `export * from './anchorRegistry'`. |
| `apps/kash-rampage-extreme/src/components/Background.svelte` | Limpieza completa (ver §4). |

**Archivos eliminados:** ninguno.

> Nomenclatura: el registro se llama `spriteConfig.**svelte**.ts` porque usa
> `$state` a nivel de módulo, y Svelte 5 solo compila runes en `.svelte.ts`.
> Misma convención que `stateTweak.svelte.ts` y `swingAlign.svelte.ts`.
> `spriteFactory.ts` no declara runes y queda como `.ts` normal.

> **Paso de build obligatorio:** `pixi-svelte` se consume desde `dist/` (lo
> genera `svelte-package`; `dist` está en `.gitignore`), **no** desde `src/`.
> Tocar `src/lib` sin recompilar da `"setAnchorResolver" is not exported by
> ".../pixi-svelte/dist/index.js"`. Hay que correr `pnpm build` dentro de
> `packages/pixi-svelte` (o `node node_modules/@sveltejs/package/svelte-package.js`).
> Esto lo diferencia de `components-inspector`, que sí se consume como fuente.

### 3. Cómo funciona la cascada de resolución

**a) Clasificación por patrón (tags).** `TAG_PATTERNS` es una lista ORDENADA de
regex; gana el primer patrón que matchea. `PLACEMENT_BY_TAG` le asigna a cada
familia su ancla:

```text
/^anim_kash_/, /^kash_side$/          → character  → (0.5, 1)     ← PIES
/^sym_/, /^anim_sym_/                 → symbol     → (0.5, 0.5)
/^anim_win_/, /^fs_/, /^kash_logo$/   → lettering  → (0.5, 0.5)
/^bg_/, /^board_/                     → scene      → (0.5, 0.5)
(sin match)                           → fallback   → (0.5, 0.5)
```

El orden y la no-superposición son deliberados: `anim_sym_wild` tiene que caer
en `symbol`, no en `character`. Un clip nuevo del personaje
(`anim_kash_idle_stand4`) **nace anclado a los pies sin tocar una línea de
código**: le alcanza con respetar el prefijo.

**b) La cascada.** `getSpritePlacement(assetId)` devuelve la geometría efectiva
**y de dónde salió** (`source`):

```text
1. spritePlacementOverrides[id]   → 'override'    (lo escribe el inspector, en vivo)
2. SPRITE_PLACEMENTS[id]          → 'asset'       (geometría propia del clip)
3. PLACEMENT_BY_TAG[tagOf(id)]    → 'tag:<tag>'   (regla por patrón)
4. FALLBACK_PLACEMENT             → 'fallback'    (centro — NUNCA (0,0))
```

**c) Dos consumidores, un solo registro.**

```ts
// Punto 1 del enunciado — la función del registro.
getSpritePlacement('anim_kash_swing')  // → { anchorX, anchorY, aspect, scale, fps, foreground, source, tag }

// Punto 2 — lo que se le inyecta al SDK, una sola vez en el arranque.
setAnchorResolver(resolveAutoAnchor);

// Vía imperativa — nodo PixiJS 8 ya anclado.
const sprite = SpriteFactory.createAnimated('anim_kash_swing');
// internamente: new PIXI.AnimatedSprite(frames); sprite.anchor.set(x, y)
```

**d) Por qué el resolver que ve el SDK puede decir "no sé".** El juego dibuja con
los componentes declarativos de `pixi-svelte` (no hay ni una llamada directa a
PixiJS en la app: el `new PIXI.AnimatedSprite(...)` vive dentro de
`AnimatedSprite.svelte`). Interceptar ahí significa tocar un paquete que
comparten **7 juegos**, así que el contrato tiene dos guardas:

1. **Un `anchor` explícito del consumidor siempre gana.** El resolver solo
   rellena cuando la prop viene `undefined` — y `propsSyncEffect` ya ignora las
   props `undefined`, así que "no responder" es literalmente "no tocar nada".
2. **`resolveAutoAnchor` devuelve `undefined` para ids que no clasifica**, aunque
   `getSpritePlacement` sí tenga un fallback centro para los llamadores directos.
   Sin esto se re-anclarían assets ajenos: la auditoría encontró **29 usos sin
   `anchor`** en el monorepo (los `progressBar*.png` de los `LoadingScreen` de
   lines/ways/cluster/scatter/price y los `Frame_FSCounter.png`) que dependen del
   (0,0) de PixiJS. Sin resolver registrado —que es el caso de los otros 6
   juegos— el comportamiento del paquete es idéntico al de siempre.

En `kash-rampage-extreme` los 16 usos de sprites pasan `anchor`, así que la
intercepción no cambió por sí sola ningún render existente: el cambio de
comportamiento vino de quitar esas props y dejar que el registro las ponga.

### 4. Limpieza de `Background.svelte`

**Qué desapareció del componente:**

| Eliminado | Dónde vive ahora |
|---|---|
| `CLIP_ASPECT` | `SPRITE_PLACEMENTS[<idle>].aspect` |
| `SWING.aspect` | `SPRITE_PLACEMENTS.anim_kash_swing.aspect` |
| `SWING.heightMul` | `…​.scale` (renombrado: es la proporción del crop que ocupa el cuerpo, no un multiplicador a ojo) |
| `SWING.anchorX`, `SWING.dxFrac`, `SWING.dyFrac` | **plegados dentro del ancla** (ver abajo) |
| `KASH_W`, `KASH_H`, `KASH_ASPECT`, `kash.w` | `SPRITE_PLACEMENTS.kash_side.aspect` |
| `isSwing` en `animationSpeed` | `…​.fps` (10 idles / 24 swing) |
| `isSwing` en `zIndex` | `…​.foreground` (dato del asset) |
| `isSwing` en `x`, `y`, `anchor`, `width`, `height` | no existe: los cuatro `<SpriteSheet>` consumen el mismo objeto resuelto |
| El `anchor=` de las 4 ramas del markup | lo pone `pixi-svelte` vía el resolver |

No queda **ninguna** rama `isSwing` ni **ningún** offset por animación en el
componente. El único ternario que sobrevive es
`kashPlaced.foreground && celebration.n === 0 ? 15 : -4`, que lee un dato del
asset y el estado de celebración — no el nombre de un clip.

**Los offsets X/Y se eliminaron plegándolos en el pivot.** La alineación fina del
swing (que el usuario había ajustado en el AnimLab contra el ghost del idle)
estaba escrita como dos desplazamientos en píxeles. Un offset es un ancla
disfrazada: desplazar el sprite `d` píxeles equivale a mover el pivot `d / tamaño`
en unidades normalizadas. La equivalencia es **exacta**, y el alto de Kash se
cancela en ambas ecuaciones —por eso la alineación aguanta en cualquier
resolución sin fracciones ni recálculo por bucket—:

```text
x = X + H·dxFrac   con anchorX 0.5   ≡   x = X   con anchorX = 0.5 − dxFrac/(scale·aspect)
y = Y + H·dyFrac   con anchorY 1     ≡   y = Y   con anchorY = 1   − dyFrac/scale
```

Resultado: `anim_kash_swing` declara `anchorX ≈ 0.4746` y `anchorY ≈ 1.0316`
(mayor que 1, perfectamente válido en PixiJS) y **`place()` ya no suma nada**:
`x` e `y` salen tal cual del punto de referencia del actor.

**Qué NO se pudo eliminar, y por qué.** `scale` (el ex `heightMul`) se queda. No
es un ajuste a ojo: el crop del swing contiene el cuerpo al ~84.7% de su alto,
mientras que en los idles el cuerpo llena el crop. Un ancla define *dónde*
pivotea un sprite, no *cuánto mide*, así que ningún pivot puede hacer que dos
recortes de distinto zoom rindan un cuerpo del mismo tamaño. Eliminar `scale`
haría que el swing se dibuje ~10% más chico que el idle. La forma de sacarlo
sería re-exportar el sheet del swing con el mismo encuadre que los idles —
trabajo de assets, no de código. Mientras tanto queda declarado como dato del
asset, visible y editable, en vez de como una constante suelta en el render.

**El AnimLab sigue funcionando, por el canal nuevo.** `swingAlign` (los sliders
dx/dy/dscale en píxeles) ya no toca el camino de dibujo: un `$effect` gateado a
DEV lo **traduce a un override del registro**, que es el mismo canal por el que
va a escribir el Inspector Genérico en el Paso 4. Con el default (0/0/1) no se
escribe ningún override.

### 5. Análisis y estado final

**El salto se arregla puramente por código.** No se re-exportó, re-recortó ni
re-escaló un solo asset: la corrección es el ancla `(0.5, 1)` que el registro le
asigna a todo lo que matchea `character`. Con ese pivot el punto clavado en
`(x, y)` es la línea de pies y no la esquina del bounding box, así que un clip
puede cambiar de tamaño sin mover al personaje.

**Verificaciones ejecutadas:**

- **Paridad de geometría renderizada — 1194 comprobaciones, 0 diferencias.**
  Script que carga el registro real y compara contra las fórmulas exactas de
  `Background.svelte` en `git HEAD`. Como el álgebra se replanteó (los offsets
  ahora son pivot), la comparación NO es sobre `x/y/anchor` sino sobre **los 4
  bordes renderizados** (`left = x − anchorX·w`, `top = y − anchorY·h`, `right`,
  `bottom`), que es donde caen los píxeles. Matriz: 8 assets × 4 resoluciones
  (`kash.h` 650/430/980/1) × 3 estados de `swingAlign` (neutro + 2 nudges) × 2
  estados de celebración, más `animationSpeed` y `zIndex` en cada combinación.
  Tolerancia 1e-9 px (error de redondeo de doble precisión).
- **Invariante de pies.** Para los 6 idles y el PNG estático, el borde inferior
  renderizado da **exactamente la misma Y** que el standby de referencia. El
  swing da esa Y más su alineación fina horneada, que es el desplazamiento
  intencional del AnimLab.
- **Un bug encontrado y corregido por el test.** La primera versión de la
  traducción `swingAlign → override` plegaba el offset horneado contra el tamaño
  *escalado*, no el base: con el slider `dscale` fuera de 1 el swing se corría
  ~1.8 px respecto del comportamiento anterior. La traducción ahora recupera el
  offset horneado del pivot base y lo re-pliega sobre el tamaño nuevo.
- **Reglas por patrón.** 11 assets representativos resuelven al ancla esperada,
  incluido un id inventado (`anim_kash_futuro_clip_sin_entrada`) que cae en
  `character` por tag sin entrada explícita, y uno desconocido que cae en el
  fallback centro.
- **Guarda del resolver.** `resolveAutoAnchor` responde para los 5 ids
  clasificados que se probaron y devuelve `undefined` para
  `progressBar.png`, `progressBarFrame.png`, `Frame_FSCounter.png`, `logo.png` y
  `btnPanelCta` — los assets del SDK que dependen del (0,0).
- **Overrides.** `setSpriteAnchor` aplica conservando el resto de la geometría
  (aspect, fps), `getSpritePlacement` reporta `source: 'override'`, y
  `resetSpritePlacements` vuelve al horneado.
- `svelte.compileModule` sobre `spriteConfig.svelte.ts`: OK, 0 warnings.
- `svelte-package` de `pixi-svelte` + `vite build` de la app.

**Diferencia visible intencional:** la caja de diagnóstico del AnimLab
(`__kashDbg.leftX/rightX/topY`) ahora se calcula desde el mismo `place()` que
dibuja el sprite, así que refleja la posición real del swing. Antes se dibujaba
ignorando sus offsets y quedaba corrida respecto de lo que se veía. Las líneas de
referencia (`cx`, `feetY`) no cambiaron.

**Cómo se conecta al Inspector Genérico (Paso 4).** El registro ya expone todo lo
que el `InspectorHost` necesita:

| Necesidad del inspector | Qué ya está |
|---|---|
| enumerar qué se puede editar | `listPlacementTargets()` → `{ assetId, anchorX, anchorY, source, tag, … }[]`, sin hardcodear la lista |
| leer el valor vivo | `getSpritePlacement(id)` |
| escribir en vivo, sin remount | `setSpriteAnchor(id, { anchorX?, anchorY? })` sobre `$state`; los componentes leen dentro de expresiones reactivas, así que el repintado propaga solo |
| escribir desde un `$effect` | `putSpritePlacement(id, placement)` — no lee el valor resuelto, así que no genera ciclos |
| volver al default | `clearSpritePlacement(id)` / `resetSpritePlacements()` |
| mostrar de dónde sale el valor | `getSpritePlacement(id).source` |

El paso siguiente es un `labSprites.svelte.ts` análogo a `labInspector.svelte.ts`:
iterar `listPlacementTargets()` y registrar dos sliders (`anchorX`, `anchorY`) por
asset contra estos setters. El registro no necesita cambios, y
`components-inspector` sigue sin conocer a Kash Rampage Extreme. Cuando eso
exista, los sliders `dx/dy` del AnimLab quedan redundantes y se pueden retirar.

**Riesgos:**

| Riesgo | Estado / mitigación |
|---|---|
| **`pixi-svelte` se consume desde `dist/`** | Tocar `src/lib` obliga a correr `svelte-package`. En una máquina limpia hay que rebuildear el paquete antes que la app; si no, el build de la app falla con un error explícito de export faltante (no silencioso). |
| **Se tocó un paquete compartido por 7 juegos** | El cambio es inerte sin `setAnchorResolver`: los otros 6 juegos no registran resolver y siguen con el (0,0) de PixiJS. Además el `anchor` explícito del consumidor siempre gana. |
| **Un asset nuevo con prefijo no contemplado** | `getSpritePlacement` cae en el fallback centro (no (0,0)) y `resolveAutoAnchor` se calla. Se cubre agregando el patrón a `TAG_PATTERNS`. |
| **Prefijos que se solapen a futuro** | `TAG_PATTERNS` se evalúa en orden y gana el primero. Al agregar una familia hay que verificar que no capture ids de otra (caso típico: `anim_sym_*` vs un futuro `anim_*`). |
| **`scale` del swing sigue siendo un dato de encuadre** | Documentado arriba: no es eliminable por ancla. Desaparece cuando el sheet del swing se re-exporte con el encuadre de los idles. |
| **Overrides no persisten** | A propósito: son ajuste en vivo. El valor bueno se hornea en `SPRITE_PLACEMENTS`. Si el Paso 4 quiere persistirlos, va por `localStorage` con su propia clave. |
| **Símbolos y letterings todavía pasan `anchor` a mano** | El registro ya los clasifica con el mismo valor que pasan hoy (`0.5`), así que borrar esas props es mecánico y sin cambio visual. Quedó fuera del alcance de este paso, que era Kash. |
| **Sin type-check automatizado** | La app no tiene `svelte-check`. La validación es `vite build` + el script de paridad. |
