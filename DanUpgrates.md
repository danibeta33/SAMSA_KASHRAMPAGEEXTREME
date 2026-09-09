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

---

## Paso 4 — Swap del símbolo Premium y HUD superior en canvas

**Fecha:** 2026-09-08
**App:** `stake-web-sdk/apps/kash-rampage-extreme`
**Objetivo:** cerrar la transferencia del objeto especial (H4) al asset
`anim_sym_premium` eliminando el fajo estático que lo respaldaba, y reemplazar la
barra HTML del HUD superior por piezas independientes **dentro del canvas Pixi**,
posicionables en vivo desde el Inspector. Se suma una auditoría de la math contra
los MD de QA, en modo solo-lectura.

### 1. Punto de partida

El HUD superior era un único contenedor HTML fijo, ajeno al canvas y a los
laboratorios, con su alto duplicado a mano en la geometría del board:

```text
+layout.svelte ──<TopBar />──▶ franja HTML `position: fixed`
                                  ├─ brand "KASH RAMPAGE EXTREME" (string literal)
                                  ├─ BALANCE · LAST WIN · TUMBLE (flex row)
                                  └─ 4 media queries con alturas 24/40/56
                                                    │
hudLayout.ts ──topBarHeight()── copia esas alturas ─┘
             └──▶ boardTransform() → sMaxTop / topSafe
```

Y el símbolo Premium arrastraba una geometría que ya no correspondía al arte:

| Dónde | Qué había hardcodeado |
|---|---|
| `src/components/SymbolSprite.svelte` | `ANIM_SPECIAL.sym_h4` con la caja del **grafiti viejo** — arte 182×191 sobre canvas 256², `center.y` 0.572. El sheet en disco ya era `Special_Billetes` (canvas 432², arte casi a sangre y centrado), así que el ícono se dibujaba ~30 % chico y corrido hacia arriba |
| `src/game/assets.ts` | `sym_h4` → `symbols/h4.png` ("fajo Dinero, stand-in del grafiti"), vivo solo como fallback mientras el clip —sin `preload`— terminaba de bajar |
| `src/game/hudLayout.ts` | `topBarHeight()` con `24 / 40 / 56` — las media queries de TopBar copiadas a mano |
| `src/components/TopBar.svelte` | brand, colores y los 3 pares label/valor, todo en CSS; sin ningún control desde el UI LAB |

La animación vieja del grafiti **no** tenía entrada propia que borrar: fue
sobreescrita bajo el mismo nombre de archivo y solo sobrevive en git
(`git show HEAD:…/anim_sym_premium.json` → `Special_Graffiti`, 6 frames).

### 2. Modificaciones realizadas

**Archivos creados**

| Archivo | Rol |
|---|---|
| `src/components/Contenedor1.svelte` | Recipiente reutilizable del HUD: sprite `ui_contenedor1` + título fijo + texto dinámico. Exporta `CONTENEDOR1_ASPECT` para que el layout no re-mida el arte. |
| `src/components/TopHud.svelte` | Dueño de los 3 recipientes + el sprite del título, del auto layout fila/columna y del cableado reactivo que venía de TopBar. |
| `.scripts/repack_spritesheet.py` | Re-empaqueta un sheet de TexturePacker a un canvas por frame más chico, preservando los ratios normalizados. Genérico: sirve para cualquier `anim_*`. |
| `static/assets/sprites/symbols/h4_still.png` | Still de H4 para la tabla de pagos de las reglas (ver §3e). Es HTML, no pasa por el registro Pixi. |

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `src/game/assets.ts` | −`sym_h4` · `preload: true` en `anim_sym_premium` · +`ui_contenedor1` · +`ui_title` |
| `src/components/SymbolSprite.svelte` | Geometría real de `ANIM_SPECIAL.sym_h4` + `STATIC_LESS` / `hasStatic`, la guarda que impide pedir la textura borrada |
| `src/components/Game.svelte` | Monta `<TopHud />` dentro de `<App>`, **fuera** del `<Container>` de `boardTransform` |
| `src/routes/+layout.svelte` | Se va el `import TopBar` y el `<TopBar />` |
| `src/game/hudLayout.ts` | `topBarHeight()` → `0`, conservando firma y callers |
| `src/game/stateTweak.svelte.ts` | 8 claves nuevas en `Tweak` / `DEFAULTS` / `TWEAKABLE_KEYS` |
| `src/game/labMeta.ts` | Categorías `tophud` y `title` + 7 sliders + el toggle `hudVertical` |
| `static/assets/sprites/anim/anim_sym_premium.{json,webp}` | Re-empaquetado a 256² |

**Archivos eliminados:** `src/components/TopBar.svelte` y
`static/assets/sprites/symbols/h4.png`. Se conserva `sym_h4_luz`: es la carta
iluminada del estado de win, no el fajo del board.

**Sin cambios:** `stake-math-sdk/**` (decisión del usuario) y el handler
`kashRampage` de `bookEventHandlerMap.ts`.

### 3. Cómo se hizo

**a) El re-pack como operación que preserva invariantes.**
`SymbolSprite` no dimensiona el sheet por su canvas sino por el **arte** que
contiene, usando tres ratios normalizados (`aspect`, `fill`, `center`). Esos
ratios son invariantes de escala, así que sirven de test del re-pack: si el
script decodifica bien y reescala parejo, no se mueven. `--verify` los compara y
falla si se corren más de 5e-3.

Lo no obvio es decodificar el atlas de entrada: los frames vienen `trimmed`
(recortados a su bounding box) y algunos `rotated` (girados 90° para empaquetar),
así que hay que des-rotar y re-expandir cada uno a su `sourceSize` **antes** de
tocar la escala. El sheet de salida se emite sin trim ni rotación, que es lo que
vuelve triviales sus ratios.

```text
drop inicial     25f × 701²   atlas 3296²   10.34 MB
re-export equipo 25f × 432²   atlas 2027²    4.67 MB
tras el re-pack  25f × 256²   atlas 1280²    0.79 MB   (5.9× más liviano)

aspect  1.031026 → 1.032258      center.y  0.503472 → 0.503906
fill.h  0.969907 → 0.968750      fill.w    1.000000 → 1.000000
```

El atlas se ajusta a la grilla en vez de redondear a potencia de 2: WebP
comprime el vacío a casi nada, pero la textura **descomprimida** en VRAM cuesta
`ancho×alto×4` igual — 2048² serían 16.7 MB contra 6.5 MB de 1280².

**b) Borrar una textura sin borrar la identidad del símbolo.**
`sym_h4` no era solo un asset: es la clave con la que H4 se nombra en
`constants.ts` (`H4: mkSprite('sym_h4')`), en `winPop.svelte.ts`
(`SELF_ANIMATED_ASSET_KEYS`) y en `LUZ_KEY`. Todas esas referencias siguen. Lo
que desapareció es su entrada en el registro, y con ella la posibilidad de que
alguien pida la textura:

```ts
// SymbolSprite.svelte
const STATIC_LESS = new Set(['sym_h4']);
const hasStatic = $derived(!STATIC_LESS.has(props.symbolInfo.assetKey));
// …
{#if !glowReplacesIcon && hasStatic}
    <Sprite anchor={0.5} key={props.symbolInfo.assetKey} … />
{/if}
```

Con `preload: true` el clip ya está en `loadedAssets` antes del primer render del
board, así que la rama estática es inalcanzable — pero *inalcanzable por orden de
carga* no es lo mismo que *imposible*. La guarda lo vuelve una invariante del
componente. Sin ella, el caso degradado es exactamente el `"Sprite key not
found"` que `05-preflight-checklist.md` marca como motivo #1 de rechazo.

**c) Auto layout por lista, no por posiciones.**
No existía ningún helper de fila/columna en el monorepo (`utils-layout` solo hace
fit y alineación; los `Layout*.svelte` del SDK son constantes a mano). El de acá
es deliberadamente chico: los recipientes se arman como **lista** y el toggle
decide sobre qué eje se aplica el paso.

```ts
const vertical = $derived(stateTweak.hudVertical >= 0.5);
const step     = $derived((vertical ? panelH : panelW) + gap);
```

Armarlo como lista es lo que hace que al caer TUMBLE en viewports angostos los
dos restantes se re-acomoden solos, sin dejar el hueco que dejaría una posición
fija por recipiente. El paso incluye el lado del panel, así que subir la escala
nunca los superpone.

Tamaños y gap se multiplican por `uiScaleFor()`, igual que `stackScale` /
`stackRight`: el slider es un trim **por bucket** encima del escalado global, no
un reemplazo.

**El grupo se clampea dentro del canvas, incluso en LIBRE.** Medido en el
navegador con los defaults sacados del mock landscape (`hudX` 0.885):

| Viewport | Borde derecho del panel | Ancho | Resultado |
|---|---|---|---|
| 1200×675 desktop | 1149.5 | 1200 | entra |
| 400×225 popout S | 383.2 | 400 | entra justo |
| 320×568 Mobile S | 349.1 | 320 | **se salía 29 px** |
| 425×812 Mobile L | 463.6 | 425 | **se salía 39 px** |

Es la única excepción a la regla "en LIBRE el usuario es el cap": `freeScale`
apaga los topes ANTI-SOLAPE del board, que como mucho afean. Acá lo que se caía
del viewport era BALANCE — un dato obligatorio, no un solape. Y los dos buckets
afectados son justamente los que traen `freeScale: 1` en `PER_BUCKET_SEED`, así
que atarlo a esa bandera lo habría dejado roto donde más importaba. Dentro del
canvas el posicionamiento sigue siendo libre.

**El valor achica la tipografía si el string es largo.** Pixi `Text` no recorta
ni ajusta: lo que no entra se dibuja fuera del recipiente. El cuerpo entra cómodo
hasta ~11 caracteres (`$100,000.00`, el balance del mock), pero las condiciones
del reviewer son peores — XEC se muestra como SC y con balances altos salen
strings como `SC 1,000,000.00`. `Contenedor1` escala la fuente por
`11 / max(11, value.length)`: determinista y sin medir texto.

**d) El alternador fila/columna es un toggle, no una acción.**
`UiLab.svelte` (tecla `T`) renderiza `group.controls` e **ignora**
`group.actions` — las acciones las dibuja AnimLab (tecla `A`). Registrado como
acción, el botón habría aparecido en el panel equivocado, separado de los
sliders que modifica. Como toggle queda junto a ellos, persiste por bucket como
el resto y encaja con que el `InspectorHost` solo maneja números (`on: 1` /
`off: 0`, igual que `freeScale`).

**e) La tabla de pagos también consumía el PNG borrado.**
Borrar `symbols/h4.png` rompió un consumidor que no está en el registro Pixi: la
tabla de pagos de las reglas es HTML escrito a mano en `Game.svelte` y traía
`<img src="assets/sprites/symbols/h4.png">` en las dos versiones (ES y EN). Con
el archivo borrado quedaba una imagen rota y un 404 en consola — justo lo que el
`05-preflight-checklist.md` pide que dé cero.

Se exportó un still del clip nuevo (frame 12, recortado al arte y re-encuadrado
en 512² como el resto del kit) a `symbols/h4_still.png`, y las dos tablas apuntan
ahí. Se exportó desde el sheet de 432² —antes del re-pack— para que el ícono de
las reglas no salga upscaleado desde los 256² del board. El nombre es distinto a
propósito: `h4.png` sigue borrado y el registro sigue sin estático para H4.

Para que esto no vuelva a pasar, la verificación ahora incluye recorrer TODAS las
referencias `assets/**.{png,jpg,webp,gif}` del código contra `static/` y exigir
cero faltantes — encontró este caso y ningún otro.

**El `InspectorRegistry` no se tocó.** Los 8 controles entraron solo agregando
datos a `labMeta.ts` y claves a `stateTweak`, que es exactamente el flujo que
dejó planteado el Paso 1. `labInspector.svelte.ts` tampoco cambió: ya itera los
tres manifiestos.

⚠ **No se subió `LAB_STORAGE_KEY`** (sigue en `kash_tweak_v14`). `loadOverrides`
filtra por `TWEAKABLE_KEYS` y las claves ausentes caen a `DEFAULTS` /
`PER_BUCKET_SEED`, así que agregar claves es retrocompatible. Bumpear la versión
habría borrado los valores ya aprobados en los 7 buckets.

### 4. Auditoría de la math (solo lectura)

Corrida de `verify_10m.py` (10M rondas por modo) contra las LUT de
`library/publish_files/`, contrastada con `01-stake-approval-checklist.md` §5:

| Requisito Stake | Medido | Estado |
|---|---|---|
| RTP 90–98 % | base 96.5000 · vault 96.4984 · smash 96.4995 · rage 96.1993 | ✅ |
| Modos dentro de ±0.5 % del base | Δ máx 0.30 % (rage) | ✅ |
| Max win realmente obtenible | 5000x alcanzado en los 4 modos; 1/45.455 en base | ✅ |
| Hit-rate no-cero mejor que ~1 en 20 | 1 en 4.548 (base) | ✅ |
| Simulaciones 100k–1M por modo | base 100k books · buys 250k | ✅ |
| Sin huecos en la distribución | bandas 1000–2000 / 2000–3000 / 3000–5000 pobladas | ✅ |

**Hallazgos NO corregidos, por decisión explícita del usuario:**

1. `rage_mode` mide **0.962** pero `library/configs/config.json` y
   `math_config.json` lo **declaran 0.965**. Cumple Stake igual (está dentro del
   ±0.5 % del base), pero es un desajuste declarado-vs-real y hace fallar el
   propio `verify_10m.py`, cuya tolerancia es ±0.05 %. Es el pendiente #1 de
   `HANDOFF.md`.
2. `books_rage_mode.jsonl.zst` pesa **620 MB** (smash 486, vault 442). El
   `05-preflight-checklist.md` fija ~400 MB como tamaño seguro para books de
   buys; el uploader del ACP trunca por encima de ~1 GB.

Nota de entorno: `verify_10m.py` importa `numpy` y la consola de Windows abre en
cp1252, así que el script muere al imprimir el `✗` del resumen de fallas —
después de haber impreso todos los números. No se tocó porque vive en
`stake-math-sdk/`.

### 5. Comportamiento preservado

Lo que TopBar cumplía y TopHud replica — todo esto viene de requisitos de
approval, no de gusto:

| Comportamiento | Cómo sigue |
|---|---|
| Bet replay oculta el balance | `stateUrlDerived.replay()` cambia el primer recipiente a `BET` con `wageredBetAmount` |
| Payout incremental | `tumbleWinAmountUpdate/Reset/Hide` + `lastWinBookAmount = tumbleBookAmount ?? stateBet.winBookEventAmount` |
| TUMBLE real | `globalMultiplierUpdate` / `globalMultiplierHide` |
| Oculto durante el loading | Montado en el `{:else}` de `showLoadingScreen` (antes era `topbar--hidden`) |
| Escalera responsive | TUMBLE cae bajo 430 px y el título bajo 360 px; BALANCE y LAST WIN nunca |
| Moneda de la sesión | Mismos `money()` / `moneyWinFromBookAmount()` |
| Activación y payout de H4 | Intactos por construcción: viven en la math (`rampage.premium_symbol`, `apply_kash_rampage()`, evento `kashRampage`) y el swap fue solo de textura |

### 6. Verificación ejecutada

Se levantó el juego real (mock RGS en :3032 + dev en :3002) y se lo manejó con
Edge headless por CDP — driver mínimo sobre el `WebSocket` global de Node 24, sin
instalar Playwright. Cada corrida hace click en el loading screen, saca captura y
devuelve **toda** la consola.

| Chequeo | Resultado |
|---|---|
| `vite build` | ✅ `✔ done`, `200 /` y `200 /sizes`, sin errores |
| Consola en los 4 viewports | ✅ solo HMR de vite (DEV) y warnings de swiftshader por headless. **Cero "Sprite key not found", cero 404, cero excepciones** |
| `h4.png` tras borrarlo | ✅ 404 en el server y **cero referencias** que lo pidan |
| Referencias `assets/**` vs disco | ✅ 0 faltantes (este barrido encontró el `<img>` de la paytable) |
| Ratios del sheet vs los horneados en el código | ✅ idénticos |
| Símbolo Premium en el board | ✅ entra del tamaño de los demás y centrado |
| Layout landscape vs `REFERENCIA_NUEVA_UI.png` | ✅ barra negra fuera, título arriba a la izquierda, 3 recipientes en columna a la derecha |
| Escalera responsive | ✅ TUMBLE cae bajo 430 px, título bajo 360 px, BALANCE y LAST WIN siempre presentes |
| Auto layout | ✅ `hudVertical` alterna columna↔fila y `hudGap` / `hudScale` / `hudX` / `hudY` responden en vivo |

**Nota de entorno:** `vite build` completa y escribe el sitio, pero el proceso no
termina solo. Se verificó que **no es por estos cambios**: la app `apps/cluster`,
intacta, hace exactamente lo mismo. En CI hay que envolverlo con `timeout` y
mirar el `✔ done` en vez del exit code.

### 7. Pendiente para el próximo pase de laboratorio

Los defaults de `hudX/hudY/titleX/titleY` se midieron del mock **landscape** y
ahí calzan. En portrait el clamp garantiza que nada quede fuera de pantalla, pero
los recipientes quedan **encima de la grilla**: al pasar `topBarHeight()` a 0 el
board ya no reserva franja superior y crece hasta arriba, mientras el HUD flota
sobre la escena (que es lo que pide la referencia). Es ajuste de encuadre, no de
fórmula: mover `hudY` (y si hace falta `boardY`) por bucket en `/sizes` o con la
tecla `T`, y congelar lo aprobado en `PER_BUCKET_SEED` — el mismo flujo con el
que se fijaron board, kash y stack. No se sembraron valores ahí a propósito: esa
tabla es de valores **aprobados por el usuario**, no inventados.

### 8. Análisis de riesgos

| Riesgo | Estado / mitigación |
|---|---|
| **`sym_h4` borrado → "Sprite key not found"** | Doble cobertura: `preload` en el clip + la guarda `STATIC_LESS`. Verificado con consola limpia en 4 viewports. Falta el pase con CDN throttleado y el recorrido autoplay/bonus/replay. |
| **Los 3 recipientes caen en la zona de `stackRightReserve()`** | En landscape quedan por encima del stack BET/SPIN, sin tocarlo. En portrait se montan sobre la grilla — ver §7. |
| **25 frames en vez de 6 durante el spin** | El clip de H4 es 4× más largo que el del grafiti y puede haber varias instancias animando a la vez en la caída. Medir FPS; si molesta, bajar `animationSpeed` o limitar la animación al estado `static`. |
| **Si el sheet se re-exporta, la geometría vuelve a mentir** | Es el bug que originó este paso. Los tres ratios están comentados con su origen y `repack_spritesheet.py --report` los imprime listos para pegar. |
| **`topBarHeight()` devuelve 0 pero sigue existiendo** | A propósito: `boardTransform` la usa en `sMaxTop` y en el `topSafe` que en portrait suma `PORTRAIT_ICON_ROW_H`. Queda un solo punto donde volver a reservar alto arriba. |
| **El HUD ya no capa la escala del board** | Al no reservar franja superior, el board puede crecer hasta donde lo dejen los otros caps y pasar por detrás del HUD nuevo. En `freeScale` el usuario es el cap, como en el resto del lab. |
| **Texto Pixi vs texto DOM** | Los valores ahora rasterizan por canvas: dependen de `loadBrandFonts()` y no heredan el antialiasing del navegador. Verificar legibilidad en Mobile S y Popout S, que es donde TopBar ya sacrificaba tamaño. |
| **`.bak` del re-pack dentro de `static/`** | El script deja backups junto al asset y `static/` se copia entera al build. Se borraron a mano; si se vuelve a correr, borrarlos antes de empaquetar. |

---

## Paso 5 — Pulido: rotación del atlas, textos inclinados, acordeón y escala de especiales

**Fecha:** 2026-09-08
**App:** `stake-web-sdk/apps/kash-rampage-extreme` + `packages/components-inspector`
**Objetivo:** cerrar tres defectos que quedaron visibles después del Paso 4 —
frames del fajo mal orientados, texto horizontal sobre recipientes inclinados y
un panel de laboratorio vuelto inmanejable por la cantidad de sliders — y sumar
un multiplicador de tamaño para los íconos especiales.

### 1. Punto de partida

| Dónde | Qué estaba mal |
|---|---|
| `static/assets/sprites/anim/anim_sym_premium.json` | 11 de los 25 frames salían girados 180°: el re-pack del Paso 4 desgiraba con `ROTATE_270` los frames que el atlas trae con `rotated: true` |
| `src/components/Contenedor1.svelte` | Los `Text` se dibujaban horizontales sobre un panel inclinado ~9°, y su centro vertical estaba mal medido: las etiquetas se montaban sobre el borde superior |
| `packages/components-inspector/src/components/UiLab.svelte` | Las 6 categorías se renderizaban siempre expandidas — 22 controles en una lista con scroll |
| `src/components/SymbolSprite.svelte` | El tamaño de W / S / H4 salía solo de su `box`, sin forma de resaltarlos sin re-exportar arte |

### 2. Modificaciones realizadas

**Archivos modificados**

| Archivo | Cambio |
|---|---|
| `.scripts/repack_spritesheet.py` | `ROTATE_270` → `ROTATE_90` al desgirar frames `rotated` |
| `static/assets/sprites/anim/anim_sym_premium.{json,webp}` | Regenerado desde el master 432² con la rotación corregida |
| `src/components/Contenedor1.svelte` | `CONTENEDOR1_TILT` + `rotation` en los dos `Text`; `BODY_TOP` / `BODY_BOTTOM` re-medidos |
| `packages/components-inspector/src/components/UiLab.svelte` | Acordeón por categoría con `$state`, encabezados clickeables y ABRIR/PLEGAR TODO |
| `src/game/stateTweak.svelte.ts` | Clave `specialScale` (default `1.3`) en `Tweak`, `DEFAULTS` y `TWEAKABLE_KEYS` |
| `src/game/labMeta.ts` | Slider `specialScale` en la categoría `hud` |
| `src/components/SymbolSprite.svelte` | `specialMult` aplicado a `w`/`h` y a `specialSide` |

**Archivos creados / eliminados:** ninguno.

### 3. Cómo se hizo

**a) La rotación del atlas: diagnóstico por vecinos, no por convención.**
Las convenciones de `rotated` de TexturePacker se documentan de las dos formas
según la versión, así que en vez de discutir el sentido se usó el propio sheet
como oráculo: **14 de los 25 frames NO vienen rotados** y son la referencia de
orientación correcta. Los rotados son
`[0, 1, 2, 3, 7, 13, 15, 17, 20, 21, 23]` — exactamente los que se veían mal.

Decodificando el frame 3 (rotado) con las dos opciones y comparándolo con el
frame 4 (no rotado, su vecino inmediato en la animación), `ROTATE_90` alinea y
`ROTATE_270` deja el fajo cabeza abajo. Con eso el criterio queda objetivo y
reproducible, no estético.

El sheet se regeneró desde el master 432² original (guardado fuera del repo),
no desde el 256² ya publicado: rotar el downscale habría corregido la
orientación arrastrando la pérdida de calidad de dos reescalados.

Los ratios normalizados **no cambiaron** (`aspect 1.032258`,
`fill {1.0, 0.96875}`, `center {0.5, 0.503906}`), así que `ANIM_SPECIAL` no se
tocó: girar 180° un arte casi centrado y casi a sangre no mueve el bounding box
de la unión. Peso y dimensiones tampoco cambian — 1280², 0.79 MB.

**b) La inclinación del texto se midió, no se eligió.**
El pedido era "unos 10 grados". El valor real del panel sale de un ajuste por
mínimos cuadrados sobre el borde superior del PNG (60 % central, salteando las
esquinas biseladas): pendiente `dy/dx = -0.15625` → **-8.88°**. Se usó el
medido, que es lo que hace que la inclinación coincida de verdad.

Lo importante es el **signo**: en Pixi la Y crece hacia abajo y el recipiente
sube hacia la derecha, así que la rotación es NEGATIVA. Con `+10 * Math.PI / 180`
el texto se habría inclinado *en contra* del panel — el doble del error visual
que con 0.

```ts
export const CONTENEDOR1_TILT = Math.atan(-0.15625); // ≈ -0.1550 rad ≈ -8.88°
```

Ambos `Text` giran sobre su propio centro (`anchor` 0.5), así que el apilado
vertical no se mueve y cada línea queda paralela al cuerpo.

**c) El bug que la rotación destapó: el cuerpo estaba mal medido.**
Al inclinar el texto se hizo evidente que las etiquetas se montaban sobre el
borde superior. La causa no era la rotación sino `BODY_CENTER_Y`, estimado a ojo
en el Paso 4 sobre el alto total del PNG. **El recipiente es un paralelogramo:**
su borde superior está mucho más abajo a la izquierda que a la derecha, así que
un min/max sobre todo el ancho describe un "cuerpo" que no corresponde a ninguna
columna concreta. Como el texto va centrado, la referencia correcta es la
columna central. Clasificando por color en `x = 637` de 1275:

```text
.   0..86     Y  86..108    D 108..403   ← cuerpo real
Y 403..410    D 410..438    Y 438..446   ← borde inferior + cinta
```

`BODY_CENTER_Y` pasa de `-0.121` a `+0.010` (≈ 9 px de corrección a la escala de
desktop) y `BODY_H` de `0.659` a `0.589`.

**d) Acordeón con `$state`, sin sembrar nada.**

```ts
let openCats = $state<Record<string, boolean>>({});
const isOpen = (id: string, index: number) => openCats[id] ?? index === 0;
const toggleCat = (id: string, index: number) => (openCats[id] = !isOpen(id, index));
```

El mapa guarda **solo** las categorías que el usuario tocó; las ausentes caen al
default (la primera abierta, el resto plegadas), así que un juego que registre
categorías nuevas no necesita inicializar nada. Funciona porque el `$state` de
Svelte 5 hace proxy profundo y rastrea también las claves que todavía no
existen: leer `openCats[id]` cuando es `undefined` deja la dependencia
registrada y la escritura posterior repinta.

Con una sola categoría el encabezado no se renderiza (comportamiento previo), así
que ese caso se fuerza a expandido — si no, el panel quedaría sin forma de
abrirse.

`components-inspector` se consume por `main: "./index.ts"`, o sea **desde
fuente**: a diferencia de `pixi-svelte` no hace falta `svelte-package`. El cambio
alcanza a los 7 juegos del monorepo, pero es DEV-only y puramente de
presentación: ningún juego pierde controles.

**e) `specialScale` enganchado a la lista canónica.**
El multiplicador se decide con `SELF_ANIMATED_ASSET_KEYS` (`winPop.svelte.ts`) y
no con el mapa `ANIM_SPECIAL`, por dos razones: esa lista **es** la definición de
"especial" del juego (la misma que usa winPop para saltear el pop), y está
declarada arriba en el archivo, donde se calculan `w`/`h`.

Se aplica a los **dos** caminos de render — el clip animado y el sprite estático
de respaldo. Si escalara solo el animado, W y S (que van sin `preload`) darían un
salto de tamaño en el instante en que su sheet termina de bajar y reemplaza al
estático.

### 4. Verificación ejecutada

Mismo driver CDP sobre Edge headless del Paso 4 (WebSocket global de Node 24, sin
Playwright).

| Chequeo | Resultado |
|---|---|
| `vite build` | ✅ `✔ done`, `200 /` y `200 /sizes` |
| Los 25 frames del fajo | ✅ contact sheet: los 11 que venían rotados ahora coinciden con sus vecinos |
| Consola | ✅ solo HMR de vite y warnings de swiftshader |
| Texto inclinado | ✅ paralelo al panel y **dentro** del cuerpo (se corrigió tras detectar el desborde) |
| Acordeón | ✅ 6 categorías con su contador; al abrir "BOTONERA + ÍCONOS" pasan de 0 a 7 sliders visibles |
| `specialScale` en el panel | ✅ "Especiales (W/S/H4)" en 1.3, dentro de la categoría de íconos |
| Premium en el board | ✅ visiblemente más grande que los regulares |

### 5. Análisis de riesgos

| Riesgo | Estado / mitigación |
|---|---|
| **`specialScale` 1.3 desborda la celda en W y S** | Sus `box` son 0.9 y 0.95, así que a 1.3 quedan en **1.17 y 1.235 celdas** y se meten sobre los vecinos (H4, con box 0.8, queda en 1.04). Es el efecto pedido, pero el punto exacto se ajusta con el slider — y es por bucket, así que en Mobile S puede necesitar menos. |
| **El master 432² del fajo vive fuera del repo** | El `.webp` versionado es el 256² re-empaquetado. Si hay que volver a re-empaquetar (otro tamaño, otra corrección), hace falta el export original de TexturePacker: conviene guardarlo en el Drive del arte, no en `static/`. |
| **Se tocó `UiLab.svelte`, compartido por 7 juegos** | DEV-only y sin cambios de contrato: sigue leyendo `registry.groups` y despachando a `read/write/step/toggle/commit/reset`. `AnimLab` e `InspectorRemotePanel` no se tocaron — el panel externo de `/sizes` sigue mostrando todo expandido. |
| **La inclinación está horneada en el componente** | `CONTENEDOR1_TILT` sale del PNG actual. Si el arte del recipiente se re-exporta con otra inclinación hay que volver a medir la pendiente del borde superior. |
| **El título no se rotó** | El pedido lo mencionaba, pero su arte ya trae ángulos propios y la referencia lo muestra derecho. Quedó sin rotar y sin slider de rotación; si se quiere, es una clave más en `stateTweak` + `labMeta`. |

---

## Paso 6 — Controles globales de UI, geometría propia de los especiales e iluminación de victoria

**Fecha:** 2026-09-09
**App:** `stake-web-sdk/apps/kash-rampage-extreme`
**Objetivo:** tres cosas que el laboratorio todavía no podía tocar — la
**opacidad y la capa DE CADA ELEMENTO de la UI por separado** (la botonera en la
capa 5, Kash en la 6, cada uno con su propia transparencia), la **geometría
individual** de los 3 símbolos especiales (hasta ahora se movían los tres juntos
con un único slider), y el **feedback de iluminación de victoria** de esos mismos
especiales, cuyo arte (`anim_sym_*_luz`) había llegado al repo sin que nadie lo
registrara.

### 1. Punto de partida

| Área | Qué había |
|---|---|
| Alpha / capa por elemento | **Nada.** Ningún elemento tenía alpha propio, y las capas salían del **orden de montaje** más tres constantes sueltas repartidas por el código (`-5` el fondo, `-4`/`15` Kash, nada el resto). Cambiar el apilado era editar componentes. |
| Especiales | **Un solo dial** (`specialScale`) para W + S + H4, más un trim por símbolo horneado en el componente (`SPECIAL_TRIM = { sym_w: 0.9 }`). Sin control de posición. |
| `anim_sym_premium` | Registrado y con `preload`, pero el export del 09-09 traía **la misma secuencia de 6 frames dos veces** (12 frames, 0.83 MB) y las métricas de `ANIM_SPECIAL` seguían siendo las del sheet anterior (25 frames). |
| `anim_sym_*_luz` | Los 3 `.json` + `.webp` estaban en `static/`, **sin registrar** en `assets.ts` y sin ningún consumidor. `git status` los daba como archivos nuevos sin trackear. |

### 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/game/stateTweak.svelte.ts` | +21 claves en `Tweak`, `DEFAULTS` y `TWEAKABLE_KEYS`; `syncUi()` propaga las 4 de HTML |
| `src/game/stateUiTweak.svelte.ts` | +4 claves (alpha/capa de botonera e íconos) — es lo que lee `BottomBar` |
| `src/game/labMeta.ts` | Categoría nueva `specials` ("ESPECIALES"); constante `LAYER`; +21 sliders |
| `src/components/Game.svelte` | Alpha/capa de la grilla; techo de celebraciones |
| `src/components/TopHud.svelte` | Alpha/capa del grupo de recipientes y del título, por separado |
| `src/components/Background.svelte` | Alpha/capa de Kash (capa de reposo tweakeable) |
| `src/components/BottomBar.svelte` | Alpha/capa de la botonera y de la fila config+BONUS (CSS) |
| `src/components/SymbolSprite.svelte` | Geometría por especial, clip `_luz`, z-index explícito, métricas de H4 re-medidas |
| `src/game/assets.ts` | 3 sheets `_luz` registrados |
| `static/assets/sprites/anim/anim_sym_premium.{json,webp}` | De-duplicado y re-empaquetado |

### 3. Cómo se hizo

**a) Opacidad y capa, un par por elemento.**

Seis elementos, doce claves: grilla, Kash, HUD superior, título, botonera y fila
config+BONUS. Cada uno con `<algo>Alpha` y `<algo>Z`.

La clave del diseño es **no envolver**. La primera versión metía board + HUD +
overlays en un contenedor común con `sortableChildren`, y eso justamente
impide lo que se pedía: los elementos quedan hijos de nodos distintos y ninguno
puede meterse *entre* los otros. Los cuatro elementos de canvas son ahora
**hermanos directos del stage**, que ya venía con `sortableChildren` — lo prende
`Background.svelte`, que es también quien clava el fondo en −5:

```ts
$effect(() => {
    const stage = appContext.stateApp.pixiApplication?.stage;
    if (stage) stage.sortableChildren = true;
});
```

Eso no es un detalle opcional. `createContextParent` (pixi-svelte) llama
`sortChildren()` **solo al montar cada hijo**:

```ts
const addToParent = (node: PIXI.ContainerChild) => {
    onMount(() => {
        context.parent.addChild(node);
        context.parent.sortChildren();
        ...
```

Sin `sortableChildren` en el padre, un `zIndex` reactivo sería letra muerta:
arrastrar el slider cambia la propiedad y nadie vuelve a ordenar. Con él, PIXI
re-ordena en cada render (`collectRenderablesMixin`), que es lo que hace que el
cambio se vea en vivo.

Reparto del espacio de capas del canvas, con los defaults:

```text
 −5   fondo (constante, Background.svelte)
 −4   Kash          ← kashZ    · kashAlpha
  0   grilla        ← boardZ   · boardAlpha
  1   HUD superior  ← hudZ     · hudAlpha
  2   título        ← titleZ   · titleAlpha
 15   Kash durante el swing (constante SWING_FRONT_LAYER)
 20   celebraciones (constante CELEBRATION_LAYER, Game.svelte)
```

Los defaults **reproducen el apilado histórico**, que hasta ahora salía del orden
de montaje: nada se mueve al actualizar. Los dos extremos quedaron como
constantes y no como sliders porque son el piso y el techo del rango, no
decisiones de layout — y el rango de los sliders (−20..40) los encierra a los dos
para que se pueda pasar por encima o por debajo si hace falta.

**⚠ Hay DOS espacios de capas y no se mezclan.** Es una restricción del
navegador, no una decisión de diseño: la botonera y los íconos son HTML
(`BottomBar.svelte`, un `position: fixed` con `z-index: 90`) **encima** del
canvas. Su número de capa los ordena entre ellos — útil, porque en portrait la
fila de íconos y el stack centrado compiten — pero **ningún valor mete la
botonera detrás de la grilla**. Para eso habría que portar la botonera a Pixi.
Está anotado en `stateTweak.svelte.ts` y en la etiqueta de los sliders, que dicen
"capa (HTML)".

Los dos pares de HTML viajan por `syncUi()` hasta `stateUiTweak`, que es lo que
`BottomBar` ya leía (`const t = stateUiTweak`) — así el componente no gana una
segunda fuente de verdad. Se aplican como `opacity` y `z-index` inline sobre
`.bb__right`, `.bb__icons`, `.bb__topicons` y `.bb__bonus--top`; los cuatro son
`position: absolute`, así que el `z-index` les corresponde.

En canvas, `hudAlpha`/`hudZ` y `titleAlpha`/`titleZ` se aplican **dentro** de
`TopHud.svelte` y no en `Game.svelte`: el grupo de recipientes y el título son
dos elementos distintos del laboratorio, y ya eran dos `<Container>` hermanos.
Kash aplica su alpha en las tres ramas de render (idle, swing y el estático de
respaldo) para que el swap entre clips no dé un salto de opacidad — el mismo
criterio que ya se usaba para la escala de los especiales.

**b) Los 3 especiales dejan de compartir perilla.**

```ts
const SPECIAL_GEOMETRY: Record<SelfAnimatedAssetKey, SpecialGeometry> = $derived({
    sym_w:  { x: stateTweak.wildX,    y: stateTweak.wildY,    scale: stateTweak.wildScale },
    sym_s:  { x: stateTweak.scatterX, y: stateTweak.scatterY, scale: stateTweak.scatterScale },
    sym_h4: { x: stateTweak.premiumX, y: stateTweak.premiumY, scale: stateTweak.premiumScale },
});
```

Tipado contra `SelfAnimatedAssetKey` (`winPop.svelte.ts`), igual que
`ANIM_SPECIAL`: si la lista canónica de "especial" cambia, esto deja de compilar
hasta que se sincronice.

Dos decisiones que vale la pena dejar escritas:

- **X/Y son fracciones de CELDA, no de canvas.** `boardX`/`hudX` son fracciones
  del viewport porque posicionan bloques enteros; acá el símbolo ya viene
  colocado por la grilla y esto es un nudge fino encima, así que escala con
  `SYMBOL_SIZE`. Rango ±0.5 = media celda, de sobra para reencuadrar un clip que
  cuelga sin sacarlo de su casilla.
- **La escala multiplica a `specialScale`, no lo reemplaza.** El pedido decía
  "en lugar de los valores globales", pero `specialScale` está congelado con un
  valor distinto en cada uno de los 7 buckets de `PER_BUCKET_SEED` (1.165 a
  1.33). Hacer los tres diales absolutos obligaría a sembrarlos bucket por bucket
  o a perder los 7 layouts aprobados. Con el esquema multiplicativo
  `specialScale` queda como dial del GRUPO y los tres nuevos como trim
  individual — que es la independencia que se pedía — **sin mover un solo píxel
  al cargar**: `wildScale` arranca en 0.90, que es exactamente el `SPECIAL_TRIM`
  que reemplaza, y los otros dos en 1.

**c) `anim_sym_premium`: registrado sí, empaquetado mal.**

El registro estaba bien (con `preload`, que es lo correcto: H4 ya no tiene sprite
estático de respaldo). El empaquetado no. El `.json` traía dos animaciones:

```text
Special_Billetes          6 frames  Special_Billetes_0000N.png
Special_Billetes_00000    6 frames  Special_Billetes_00000_0000N.png
```

Renderizadas las dos a contact sheet, son **el mismo clip**. PIXI reproduce solo
la primera —`getSpriteSheetFrames` toma `Object.values(animations)[0]`—, así que
la mitad del atlas eran píxeles que nadie iba a pedir, en el **único** sheet de
símbolos con `preload`. Además el duplicado era una bomba de tiempo: el criterio
de selección es "la primera clave del objeto", y cuál queda primera depende del
orden de export.

Se sacó la copia del `.json` y se re-empaquetó con la herramienta que ya existe
para esto:

```text
python .scripts/repack_spritesheet.py …/anim_sym_premium.json --verify

  ANTES   canvas 256×256  arte 256×239  aspect 1.071130  fill {w:1.000000, h:0.933594}
          atlas 870×870  0.83 MB  6 frames
  DESPUES atlas 768×512  0.15 MB  6 frames
  → 5.3× más liviano (0.67 MB menos)
  ✓ ratios normalizados estables (tol 0.005)
```

En VRAM son 3.03 MB → 1.57 MB de textura descomprimida, y 0.67 MB menos de
loading screen bloqueante para todos los jugadores.

**d) Las métricas de H4 estaban colgadas del sheet viejo.**

El drop del 09-09 pasó el clip de 25 frames a 6 y con eso cambió la caja del
arte, pero `ANIM_SPECIAL.sym_h4` seguía con los números del anterior. El efecto
NO era de tamaño: `specialW`/`specialH` siempre dan el mismo cuadrado, porque
`aspect` y `fill` salen de la misma bbox y se cancelan —

```text
specialH = (side / aspect) / fill.h = side · arth/artw · 256/arth = side · 256/artw
```

— era de **centrado**. Con `center.y` 0.503906 en vez de 0.533203 el offset
compensaba 0.0039 del lienzo en lugar de 0.0332, así que el fajo se dibujaba
≈2.5 px de board (3 % de celda) **por debajo** de su centro real.

| | aspect | fill.h | center.y |
|---|---|---|---|
| Antes (sheet de 25 frames) | 1.032258 | 0.968750 | 0.503906 |
| Ahora (sheet de 6, re-medido) | 1.071130 | 0.933594 | 0.533203 |

**e) La iluminación de victoria de los especiales.**

Los 3 `_luz` **no son arte nuevo**: son el mismo clip de cada símbolo con el glow
horneado encima, exportados desde el mismo canvas 256² y con el ícono en la misma
posición (verificado a contact sheet: el fajo, el bate con su "Win" y la barra
con su "SCATTER" caen en el mismo lugar en las dos versiones; lo único que cambia
es el destello).

Eso resuelve el alineado sin medir nada: se dibujan con el **mismo**
`width`/`height`/`x`/`y` que el clip base. Compartir el lienzo de origen **es** el
registro. Medir el `_luz` por su cuenta lo desalinearía, justamente porque su
bounding box es más grande — el glow sangra fuera del ícono, que es todo el
punto.

```svelte
<SpriteSheet zIndex={0} key={special.luzKey} width={specialW} height={specialH} … alpha={glowAlpha} />
<SpriteSheet zIndex={1} key={special.key}    width={specialW} height={specialH} … />
```

**Simultaneidad:** el bloque monta cuando el símbolo entra en `win` y
`AnimatedSprite` arranca con `gotoAndPlay(0)`, así que el clip de luz empieza en
su frame 0 en el mismo instante que la animación de victoria. Los especiales
quedan fuera de la cascada de `winFlash` (tienen clip propio y el boing se lo
pisaría), así que su `glowAlpha` cae al fallback `isWinning ? 1 : 0` — que es
exactamente el disparo instantáneo que se pedía.

**f) El bug de jerarquía que esto destapó.**

El brillo trasero **no estaba quedando detrás**. `addToParent` hace `addChild`,
que APENDEA, y el bloque del glow monta al entrar en `win`, o sea DESPUÉS del
ícono. El `sortChildren()` que corre justo después no arregla nada: con los dos
hijos en `zIndex` 0 el sort es estable y respeta el orden del array — el glow
recién agregado al final.

O sea que el comentario "va PRIMERA = detrás del ícono" describía el orden de las
etiquetas, no el resultado. En la rama de los 10 regulares el síntoma estaba
enmascarado: sin secuencia activa `glowReplacesIcon` desmonta el ícono y el
solape no llega a existir; solo con `winFlash` corriendo los dos conviven, y ahí
la carta iluminada se dibujaba sobre el ícono y le tapaba el boing que dice
acompañar.

Se arregló declarando la profundidad en vez de confiar en el orden de montaje:
`sortableChildren` en el Container de la celda y `zIndex` 0 / 1 explícitos, en
**las dos** ramas (la del especial animado y la del sprite estático).

### 4. Controles nuevos en el UI LAB (tecla `T` y `/sizes`)

Los 12 diales de opacidad + capa quedaron **en la categoría de su propio
elemento**, junto a los sliders de posición y tamaño que ya tenía cada uno — no
en un bloque aparte:

| Categoría | Slider | Rango · paso | Default |
|---|---|---|---|
| GRILLA | Grilla opacidad / capa (`boardAlpha`, `boardZ`) | 0 – 1 · 0.01 / −20 – 40 · 1 | 1 / 0 |
| BOTONERA + ÍCONOS | Botonera opacidad / capa **(HTML)** (`stackAlpha`, `stackZ`) | ídem | 1 / 2 |
| BOTONERA + ÍCONOS | Config opacidad / capa **(HTML)** (`iconAlpha`, `iconZ`) | ídem | 1 / 1 |
| KASH | Kash opacidad / capa (`kashAlpha`, `kashZ`) | ídem | 1 / −4 |
| HUD SUPERIOR | HUD opacidad / capa (`hudAlpha`, `hudZ`) | ídem | 1 / 1 |
| TÍTULO | Título opacidad / capa (`titleAlpha`, `titleZ`) | ídem | 1 / 2 |

Y los 9 de geometría de los especiales, en su categoría nueva:

| Categoría | Slider | Rango · paso | Default |
|---|---|---|---|
| ESPECIALES | Wild X / Y (`wildX`, `wildY`) | ±0.5 celda · 0.005 | 0 |
| ESPECIALES | Wild size (`wildScale`) | 0.3 – 2.5 · 0.005 | **0.9** |
| ESPECIALES | Scatter X / Y (`scatterX`, `scatterY`) | ±0.5 celda · 0.005 | 0 |
| ESPECIALES | Scatter size (`scatterScale`) | 0.3 – 2.5 · 0.005 | 1 |
| ESPECIALES | Premium X / Y (`premiumX`, `premiumY`) | ±0.5 celda · 0.005 | 0 |
| ESPECIALES | Premium size (`premiumScale`) | 0.3 – 2.5 · 0.005 | 1 |

Los 6 sliders de capa comparten la constante `LAYER` de `labMeta.ts`, con
`decimals: 0`: tanto el `zIndex` de PIXI como el `z-index` de CSS son enteros, y
sin eso el paso fino (− / +) del inspector guardaría `3.0000` en vez de `3`.

**`LAB_STORAGE_KEY` NO se bumpeó** (sigue en `kash_tweak_v15`), a diferencia de
los pasos anteriores. Las 21 claves son **aditivas**: `loadOverrides` copia solo
las que encuentra, así que un override viejo simplemente no las trae y caen al
default por el merge de `applyBucket` (`DEFAULTS` → `PER_BUCKET_SEED` →
`overrides`). Bumpear habría tirado los ajustes locales del usuario sin ganar
nada.

### 5. Verificación ejecutada

| Chequeo | Resultado |
|---|---|
| `svelte.compile` de los 5 componentes tocados | ✅ sin errores ni warnings |
| Duplicado del sheet de premium | ✅ contact sheet de las dos secuencias: idénticas frame a frame |
| Re-pack | ✅ `--verify`: ratios normalizados estables (tol 5e-3), 0.83 → 0.15 MB |
| Alineación de los `_luz` | ✅ contact sheet contra el clip base: mismo encuadre, mismo canvas 256², el glow es lo único que cambia |
| Comportamiento con defaults | ✅ los 6 alpha en 1, las 6 capas en su valor histórico y `wildScale` 0.9 → apilado y tamaños idénticos a antes del paso |

### 6. Análisis de riesgos

| Riesgo | Estado / mitigación |
|---|---|
| **Se re-encodeó un `.webp` de arte entregado** | Es el único cambio binario del paso. Mitigado con `--verify` (invariantes de escala) **y** con inspección visual a contact sheet antes/después: los 6 frames del fajo son indistinguibles. El original está en el historial de git. |
| **Una capa alta tapa las celebraciones** | Es el efecto pedido: el techo está en 20, así que a partir de 21 ese elemento pasa por delante de Win / FreeSpin / Transition. Documentado en `stateTweak` y en `LAYER`; ningún default lo hace. |
| **`hudAlpha` / `stackAlpha` bajos esconden BALANCE, LAST WIN o el SPIN** | ⚠ **Riesgo de approval, no cosmético.** El `01-stake-approval-checklist.md` exige los 4 datos del HUD SIEMPRE visibles, y estos sliders los pueden llevar a 0 — lo mismo vale para dejar la botonera bajo otro elemento. Es DEV-only (los sliders no existen en producción) y es por bucket, pero **los valores que se congelen en `PER_BUCKET_SEED` no pueden bajar de 1** salvo decisión explícita de dirección. |
| **Botonera e íconos no pueden ir detrás del canvas** | Restricción del navegador: son HTML sobre el canvas. Su capa los ordena entre ellos y nada más. Los sliders lo dicen ("capa (HTML)") y está anotado en `stateTweak`. Si dirección quiere la botonera *detrás* de la grilla, hay que portarla a Pixi — es un rework, no un slider. |
| **`kashZ` no aplica durante el swing** | El batazo sube a la constante `SWING_FRONT_LAYER` (15) para pasar por delante del board; el dial manda en reposo. Es deliberado —esa capa es coreografía del golpe, no layout— pero puede confundir al ajustar si se mira justo en el frame del swing. |
| **Los 3 `_luz` van sin `preload`** | Un especial que gane en los primeros segundos gana sin glow (cae al clip de siempre). Es deliberado: son 1.21 MB y el criterio del repo es no castigar el arranque por un adorno — el mismo que ya siguen las cartas `sym_*_luz`. Si dirección lo quiere garantizado, es agregar `preload: true` a las 3 entradas. |
| **El apilado pasó de implícito a declarado** | Antes lo decidía el orden de montaje; ahora son números. Los defaults lo reproducen 1:1, pero cualquier componente NUEVO que se monte sin `zIndex` cae en 0 — o sea, entre Kash y el HUD, no arriba de todo como antes. Quien agregue una capa tiene que elegir su número. |
| **Fondo y velo de portrait quedaron sin dial** | Siguen clavados en −5 / −4.5. Son escena, no UI, y el velo depende del fondo. Si hace falta, son dos claves más siguiendo el mismo patrón. |
| **`specialScale` sigue existiendo** | Ahora hay dos niveles de escala para el mismo símbolo (grupo × individual) y es fácil confundirse al ajustar. El de grupo quedó en "BOTONERA + ÍCONOS" y los individuales en "ESPECIALES", separados a propósito. |
| **Los 9 diales nuevos no están sembrados por bucket** | Arrancan neutros en los 7 buckets. Cuando el usuario los ajuste en `/sizes` hay que congelar los valores en `PER_BUCKET_SEED`, igual que se hizo con board/kash/stack. |

### 7. Pendiente

- Congelar en `PER_BUCKET_SEED` los valores de los 9 diales de especiales y de
  los 12 de opacidad/capa una vez ajustados bucket por bucket.
- Si dirección pide que la botonera pueda ir POR DEBAJO de elementos del canvas,
  hay que portar `BottomBar.svelte` a Pixi. Hoy el overlay HTML lo impide.
- Sacar el sheet duplicado desde el ORIGEN: el export de TexturePacker sigue
  produciendo las dos secuencias. Mientras eso no se corrija, cada re-export del
  premium hay que pasarlo por `repack_spritesheet.py` después de borrar la copia
  del `.json`.
- Los `_luz` de W y S dependen de que su clip base ya haya bajado (comparten la
  rama `specialReady`): si el sheet base todavía no está, el símbolo gana con el
  sprite estático y sin glow. Dura lo que tarda la descarga.
