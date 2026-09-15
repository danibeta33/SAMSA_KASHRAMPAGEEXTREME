# KASH RAMPAGE EXTREME - Handoff funcional de laboratorios

## 1. Alcance

Este documento describe los laboratorios de desarrollo disponibles en la app
`stake-web-sdk/apps/kash-rampage-extreme`:

1. **AnimLab**: se abre con la tecla `A`.
2. **UiLab**: se abre con la tecla `T`.
3. **Selector externo `/sizes`**: pagina DEV para revisar los tamanos del
   selector de Stake y ajustar el UiLab desde fuera del juego.

Los tres laboratorios son herramientas de QA, integracion visual y ajuste de
assets. No forman parte del flujo de produccion: el montaje esta protegido por
`import.meta.env.DEV`.

## 2. Arquitectura comun

El punto de montaje es
[`src/routes/+layout.svelte`](src/routes/+layout.svelte). En DEV renderiza
`UiLab` y `AnimLab` junto con el juego. Para `/sizes`, el layout detecta la ruta
y deja renderizar la pagina sin autenticar ni redirigir al mock.

La cadena principal del laboratorio de layout es:

```text
UiLab o /sizes
  -> stateTweak (estado reactivo)
  -> syncUi()
  -> stateUiTweak (HUD HTML)
  -> hudLayout.boardTransform() (geometria Pixi)
  -> Game / Background / BoardFrame / BottomBar
```

El estado se separa en dos partes:

- `stateTweak.svelte.ts`: valores por resolucion, seleccion del bucket, seeds,
  overrides y persistencia.
- `stateUiTweak.svelte.ts`: medidas generales del HUD y valores congelados del
  frame/simbolos. Solo `stackScale`, `stackRight`, `stackBottom`, `iconScale`,
  `iconX` e `iconY` reciben sincronizacion desde `stateTweak`.

### 2.1 Inyeccion de dependencias via InspectorRegistry

Desde los Pasos 1 y 2 de `DanUpgrates.md`, **ningun panel importa nada del
juego**. Los tres paneles viven en el paquete compartido
`packages/components-inspector` y son 100% agnosticos:

| Archivo del paquete | Rol |
|---|---|
| `src/InspectorRegistry.svelte.ts` | registro reactivo de categorias, sliders, toggles, acciones y diagnostico |
| `src/components/UiLab.svelte` | panel de controles (tecla `T`) |
| `src/components/AnimLab.svelte` | panel de acciones + diagnostico (tecla `A`) |
| `src/components/InspectorRemotePanel.svelte` | mismo panel de controles, operando sobre un iframe |
| `src/inspectorBridge.svelte.ts` | puente al registro de otro documento (lo usa `/sizes`) |

El paquete exporta dos registros: `inspector` (id `layout`, lo consume `UiLab`
y `/sizes`) y `animInspector` (id `anim`, lo consume `AnimLab`). El juego los
llena en runtime desde
[`src/routes/+layout.svelte`](src/routes/+layout.svelte), solo en DEV:

```text
registerGameInspector()            registerGameLabActions(getContext())
  src/game/labInspector.svelte.ts    src/game/labActions.svelte.ts
        │  manifiesto: labMeta.ts          │  clips, eventos, soundboard,
        │  (sliders, toggles, storageKey)  │  swing align, diagnostico
        ▼                                  ▼
   inspector  ◀── UiLab / InspectorRemotePanel      animInspector ◀── AnimLab
```

Cada juego implementa un `InspectorHost` (`read`, `write`, `commit`, `reset`,
`status`, `snapshot`, `diagnostics`) y registra lo suyo; el panel solo dibuja y
despacha. Agregar o quitar un control/accion se hace en el manifiesto o en el
glue del juego (y en `TWEAKABLE_KEYS`/`DEFAULTS` si debe persistir); los
consumidores se actualizan solos.

---

## 3. Laboratorio `A`: AnimLab

### 3.1 Entrada y visibilidad externa

Panel (generico, del SDK):
`packages/components-inspector/src/components/AnimLab.svelte`.
Contenido (todo lo especifico de KRE):
[`src/game/labActions.svelte.ts`](src/game/labActions.svelte.ts).

- Se monta solo en DEV desde `src/routes/+layout.svelte`, que ademas llama
  `registerGameLabActions(getContext())` para inyectar las acciones.
- `onMount` registra un `window.keydown`.
- `A` o `a` alterna la visibilidad (la tecla es la prop `toggleKey`).
- Ignora la tecla si el target es `input` o `textarea`.
- No tiene persistencia de visibilidad ni de ajustes.
- Se muestra como panel fijo sobre el canvas, en la esquina superior derecha.
- El panel no conoce ningun clip, evento ni sonido: dibuja las acciones
  registradas en `animInspector` y ejecuta sus callbacks.

### 3.2 Clips de Kash

Las acciones de la categoria **KASH - CLIPS** llaman a
`window.__forceIdle(clip)`. La lista es la constante `KASH_CLIPS` de
`labActions.svelte.ts`:

| Label | Clip |
|---|---|
| STAND (loop) | `anim_kash_idle_stand1` |
| Glasses | `anim_kash_idle_glasses1` |
| Scratch | `anim_kash_idle_scratch1` |
| Nose | `anim_kash_idle_nose1` |
| Bat 1 | `anim_kash_idle_bat1` |
| Bat 2 | `anim_kash_idle_bat2` |
| SWING (batea) | `anim_kash_swing` |

El hook se define en
[`src/components/Background.svelte`](src/components/Background.svelte).
Cambiar un clip de la lista solo cambia la prueba disponible; para incorporar
un nuevo clip hay que asegurar tambien que exista en el registro/preload de
assets y que `Background` pueda reproducirlo.

Importante: los idles estan actualmente desactivados por
`KASH_IDLES_ENABLED = false`. El fallback estatico sigue visible. El swing de
rampage esta habilitado provisionalmente por
`KASH_SWING_RAMPAGE_ENABLED = true`.

### 3.3 Alineacion del bateo

La categoria **ALINEAR BATEO** sirve para comparar el swing contra el idle. El
`Ghost idle` es un toggle registrado y el resto son acciones `mini` agrupadas
en filas (`row: 'dx' | 'dy' | 'ds'`):

- `Ghost idle`: muestra una referencia del idle.
- `x-5`, `x-1`, `x+1`, `x+5`: cambia `swingAlign.dx`.
- `y-5`, `y-1`, `y+1`, `y+5`: cambia `swingAlign.dy`.
- `escala -/+`: cambia `swingAlign.dscale` en pasos de `0.02`.
- `reset`: vuelve a `dx=0`, `dy=0`, `dscale=1`.

El estado vive en
[`src/game/swingAlign.svelte.ts`](src/game/swingAlign.svelte.ts), solo en
memoria de la sesion. Los valores se aplican en vivo en `Background.svelte`.

La alineacion que ya fue aprobada no se lee desde `swingAlign`: esta horneada
en la constante `SWING` de `Background.svelte` mediante `heightMul`, `dxFrac` y
`dyFrac`. Por eso, el flujo correcto es:

1. Activar Ghost.
2. Probar `SWING`.
3. Ajustar dx/dy/escala hasta que pies y centro coincidan.
4. Copiar los valores observados.
5. Convertirlos a valores relativos y editar la constante `SWING`.
6. Dejar `swingAlign` en cero antes de validar el juego.

`dx` y `dy` del ajuste vivo son pixeles de canvas, pero los valores horneados
`dxFrac` y `dyFrac` son fracciones de `kash.h`; esta conversion mantiene la
alineacion entre resoluciones.

### 3.4 Diagnostico visual

`Background.svelte` publica en DEV `window.__kashDbg`, actualizado con
`requestAnimationFrame`. Quien lo lee ahora es `buildDiagnostics()` en
`labActions.svelte.ts`, expuesto al panel por el contrato
`InspectorHost.diagnostics()`. El panel lo pollea con un solo `rAF` y presenta:

- FPS (lo mide el panel; es la unica metrica generica);
- clip actual;
- frame actual y si esta en loop;
- centro X y linea de pies;
- ancho y alto renderizados;
- diferencia frente a una referencia fijada (se resalta si supera 2 px);
- `swing dx / dy / escala`;
- `GRID shake`, que lee `boardShake.x/y` para verificar el impacto.

Las guias sobre el canvas (pies, centro, bounding box y la referencia fijada)
las publica el juego dentro de `diagnostics().guides`, ya convertidas a
**pixeles de pantalla** — el panel solo las dibuja, porque la proyeccion
canvas→pantalla la conoce unicamente el juego. El checkbox `Guias sobre el
canvas` es local al panel; `fijar ref` y `limpiar` son acciones registradas.

### 3.5 Pantalla de carga / intro

La pantalla de carga (`LoadingOverlay.svelte`) existe una sola vez por sesion
y se cierra con el primer click en cualquier parte, asi que sin ayuda no hay
forma de encuadrar sus elementos. La categoria `PANTALLA DE CARGA` del AnimLab
resuelve eso con tres entradas:

- `MOSTRAR de nuevo` vuelve a poner `stateLayout.showLoadingScreen` en `true`
  y ademas activa el candado, para que el primer click no la cierre otra vez.
- `No cerrar al click` es el candado (`labPreview.introHold`): mientras esta
  activo, `dismiss()` no hace nada.
- `Icono de carga siempre visible` (`labPreview.introSpinner`) fuerza el bate
  girando aunque los assets ya esten listos, para ubicarlo contra el estado
  final de la pantalla (`CLICK TO SKIP`).

Las tres son solo DEV y ninguna se persiste. El encuadre en si se hace con los
sliders del UiLab (ver 4.2); el flujo completo es: MOSTRAR de nuevo -> candado
-> tecla `T` -> mover sliders -> SAVE -> apagar candado -> click para entrar.

Volver a mostrar la pantalla con el juego ya montado desmonta el board y el
`<Sound />` (es la rama `{#if showLoadingScreen}` de `Game.svelte`) y los
vuelve a montar al cerrarla. Es el comportamiento normal del arranque, no un
modo aparte.

**El asset del intro.** La ventana animada (`introAnim`) no es un sprite del
juego: es `static/assets/loading/intro.webp`, un WebP animado que genera
`tools/build_intro.py` a partir del multi-pack de TexturePacker que entrega el
equipo en `art-src/intro/`. Si llega un re-export nuevo, se reemplazan esas
hojas y se corre el script — lee la geometria (cantidad de hojas, frames,
recortes, rotaciones) de los JSON, no la tiene hardcodeada.

Lo unico que hay que mirar despues de regenerar es la linea que imprime el
script al terminar: el asset lleva un margen transparente alrededor de la
ventana (para que entre el overshoot de la apertura), y ese margen se compensa
en el ancho base de `.load__intro` dentro de `LoadingOverlay.svelte`. Si la
razon que imprime el script cambia, hay que actualizar ese `min(...)`. Se hace
asi —y no tocando `introAnimScale`— para que los encuadres aprobados por
bucket sigan valiendo sin retocar los 7. El recorte es simetrico respecto del
centro de la ventana, asi que `introAnimX/Y` no se mueven nunca.

### 3.6 Situaciones de juego reales

Las acciones registradas no dibujan imitaciones de las animaciones: emiten
eventos del mismo `eventEmitter` que usa el juego (los callbacks viven en
`labActions.svelte.ts` y reciben el contexto real por inyeccion). Las
secuencias largas se registran con `exclusive: true`, asi el panel bloquea el
resto de los botones mientras corren:

- **SMALL/BIG/MEGA/MAX WIN**: ejecuta `kashSwing`, `winShow`, sonidos del tier,
  `winUpdate`, retorno a `bgm_main` y `winHide`.
- **TIRADA BATEO**: contra el mock, hace `POST /debug/arm-next` con
  `{ "tier": "rampage" }` y despues emite `bet`. Esto ejecuta la ruta completa
  de produccion, incluyendo reveal, swing, shake, conversiones, estallido y
  tumble. Contra un RGS real el endpoint puede no existir y la tirada no queda
  forzada.
- **BONUS TRIGGER**: dispara los sonidos de scatter/super free spin,
  transicion, intro de free spins y cambio de musica.
- **ANTICIPACION**: activa temporalmente `anticipating` en los reels 5 y 6.
- **FS INTRO**: muestra intro con 10 free spins.
- **FS OUTRO**: ejecuta el count-up con tier BIG.
- **TRANSITION**: emite la transicion real.

La secuencia de rampage de produccion se controla en
[`src/game/bookEventHandlerMap.ts`](src/game/bookEventHandlerMap.ts) y el
render/strike en `Background.svelte`. AnimLab solo sirve de disparador.

### 3.7 Soundboard

La lista de SFX se genera en `labActions.svelte.ts` a partir de `SFX_MAP` de
[`src/game/sound.ts`](src/game/sound.ts) (el panel ya no importa `sound.ts`):
agrupa aliases que apuntan al mismo archivo AU y registra una accion por
archivo. La musica se lista explicitamente: `bgm_main`, `bgm_freespin` y
`bgm_freespin_rage`.

Esto permite revisar audio sin modificar el flujo de una tirada. Para agregar
un sonido nuevo se debe registrar primero en `SFX_MAP` y, si corresponde, en
los assets; el soundboard lo incluira automaticamente si no es un BGM.

---

## 4. Laboratorio `T`: UiLab dentro del juego

### 4.1 Entrada y comportamiento

Panel (generico, del SDK):
`packages/components-inspector/src/components/UiLab.svelte`.
Contenido (manifiesto de KRE):
[`src/game/labMeta.ts`](src/game/labMeta.ts) +
[`src/game/labInspector.svelte.ts`](src/game/labInspector.svelte.ts).

- Solo existe en DEV.
- `T` o `t` alterna el panel.
- Se muestra sobre el juego, fijo, a izquierda o derecha.
- El boton `⇄` cambia el lado del panel; ese lado no se persiste.
- La resolucion activa y su bucket aparecen en el encabezado.
- El panel puede solaparse visualmente con el juego; `/sizes` existe para
  ajustar sin que el panel tape el frame.

Cada slider actualiza el preview en vivo. El evento `input` no escribe
`localStorage` para evitar I/O sincrono en cada tick del arrastre. El evento
`change` (al soltar) guarda el bucket. Los botones `-` y `+` guardan de
inmediato; con `Shift` multiplican el paso por 10.

### 4.2 Controles y rangos

Los controles salen de `LAB_SLIDERS`:

| Clave | Label | Rango | Paso | Efecto |
|---|---|---:|---:|---|
| `boardH` | Grilla | 0.6 - 1.6 | 0.002 | escala/alto relativo del board |
| `boardX` | Grilla X | 0.15 - 0.85 | 0.001 | centro horizontal relativo |
| `boardY` | Grilla Y | 0.15 - 0.85 | 0.001 | centro vertical relativo |
| `stackScale` | Botonera | 0.5 - 1.5 | 0.005 | escala del stack BET/SPIN |
| `stackRight` | Botonera X | -40 - 400 | 1 | separacion horizontal del stack |
| `stackBottom` | Botonera Y | -40 - 400 | 1 | separacion inferior del stack |
| `iconScale` | Config+Bonus | 0.4 - 2 | 0.005 | escala de iconos/BONUS |
| `iconX` | Config X | -40 - 400 | 1 | posicion horizontal de iconos |
| `iconY` | Config Y | -40 - 400 | 1 | posicion inferior de iconos |
| `kashH` | Kash size | 0.3 - 1.2 | 0.002 | alto relativo de Kash |
| `kashX` | Kash X | -0.1 - 0.5 | 0.001 | centro horizontal de Kash |
| `kashY` | Kash Y | 0.2 - 0.9 | 0.001 | centro vertical de Kash |

La categoria `PANTALLA DE CARGA (INTRO)` agrega 20 claves mas: los 4 elementos
de la pantalla de arranque (`introTitle` el titulo, `introAnim` la ventana
animada del intro, `introSpin` el bate girando, `introText` el texto
LOADING / CLICK TO SKIP), cada uno con 5 diales.

| Sufijo | Label | Rango | Paso | Efecto |
|---|---|---:|---:|---|
| `X` | X | 0 - 1 | 0.002 | centro horizontal, fraccion del VIEWPORT |
| `Y` | Y | 0 - 1 | 0.002 | centro vertical, fraccion del VIEWPORT |
| `Scale` | Tamano | 0.2 - 2.5 | 0.005 | multiplica el tamano base del CSS |
| `Alpha` | Opacidad | 0 - 1 | 0.01 | `opacity` del elemento |
| `Z` | Capa | -20 - 40 | 1 | `z-index` DENTRO del overlay |

A diferencia del resto del panel estas no son coordenadas de canvas sino de
ventana: la pantalla de carga es HTML puro y tapa todo (`z-index: 200`), asi
que su `Z` solo ordena a los 4 entre ellos. El tamano base de cada uno lo fija
el CSS de `LoadingOverlay.svelte` en `min(vw, vh, vmax)` y `Scale` lo
multiplica. Se guardan por bucket como todo lo demas.

Los 7 buckets ya vienen sembrados en `PER_BUCKET_SEED` (y el anclaje ancho de
desktop en `WIDE_SEED`) con los encuadres aprobados el 14-09. Los 3 portrait
comparten uno solo, el de Mobile L, via la constante `INTRO_PORTRAIT`.
Opacidad y capa de los 4 elementos quedaron en su default en los 7.

El checkbox **LIBRE** escribe `freeScale` como `1` o `0`. Con valor libre
activo, `hudLayout.boardTransform` omite los caps anti-solape y usa el dial
`boardH` directamente; esto permite aprobar una composicion manual, pero puede
hacer que board, TopBar o botonera se solapen.

### 4.3 Aplicacion interna

`stateTweak.applyBucket()` combina, en este orden:

```text
DEFAULTS -> PER_BUCKET_SEED[bucket] -> overrides[bucket]
```

Despues llama a `syncUi()`. `hudLayout.boardTransform()` consume `boardH`,
`boardX`, `boardY`, `freeScale` y el stretch congelado para calcular el
transform del board. `Background.svelte` consume los tres valores de Kash.
`BottomBar.svelte` consume los valores sincronizados de `stateUiTweak`.
`BoardFrame.svelte` y `SymbolSprite.svelte` consumen las medidas congeladas
del frame y simbolos.

### 4.4 Buckets y deteccion

El bucket se selecciona con el primer `match` de `RES_BUCKETS`:

| Bucket | Regla |
|---|---|
| `portrait_s` | portrait y ancho menor que 350 |
| `portrait_m` | portrait y ancho menor que 400 |
| `portrait_l` | cualquier portrait restante |
| `popout_s` | ancho menor que 600 |
| `popout_l` | ancho menor que 900 |
| `laptop` | ancho menor que 1100 |
| `desktop` | resto |

El orden es relevante. Los tres presets mobile tienen buckets separados. Al
redimensionar, `stateTweak` actualiza `labState.vw/vh` y aplica el bucket nuevo.

### 4.5 Persistencia y reset

La clave de `localStorage` es `kash_tweak_v14`. Su forma es:

```json
{
  "overrides": {
    "desktop": {
      "boardH": 0.912,
      "boardX": 0.525
    }
  }
}
```

Solo se persisten las claves incluidas en `TWEAKABLE_KEYS`; los valores
`boardStretchX`, `boardStretchY` y otras constantes de `stateUiTweak` no se
editan desde el panel.

`RESET BUCKET` elimina el override del bucket activo y vuelve a aplicar
`DEFAULTS + PER_BUCKET_SEED`. Por tanto, en buckets con seed aprobado vuelve al
seed aprobado, no necesariamente a los defaults globales. Los seeds editables
estan en `PER_BUCKET_SEED` dentro de `stateTweak.svelte.ts`.

`COPY VALUES` genera y copia un JSON con `bucket`, `viewport`, `freeScale` y
todos los sliders. Si el portapapeles no esta disponible, deja el JSON en la
consola con prefijo `[UiLab]`.

---

## 5. Laboratorio `/sizes` externo

### 5.1 Entrada

Archivo:
[`src/routes/sizes/+page.svelte`](src/routes/sizes/+page.svelte).

URL de desarrollo:

```text
http://localhost:3002/sizes?sessionID=mock&rgs_url=http://127.0.0.1:3032
```

La pagina muestra siete presets correspondientes al selector de Stake:

| Preset | Viewport |
|---|---:|
| Desktop | 1200 x 675 |
| Laptop | 1024 x 576 |
| Popout S | 400 x 225 |
| Popout L | 800 x 450 |
| Mobile L | 425 x 812 |
| Mobile M | 375 x 667 |
| Mobile S | 320 x 568 |

### 5.2 Funcionamiento externo

- El preset activo se carga en un `iframe` same-origin.
- El `iframe` recibe exactamente el ancho y alto del preset.
- La pagina exterior puede reducir visualmente el iframe con CSS `transform:
  scale(...)` para que quepa junto al panel; esa escala no cambia el viewport
  interno del juego.
- El panel externo esta fuera del iframe, a la derecha, y por eso no tapa el
  juego.
- Toda esta mecanica vive en el paquete: `InspectorBridge` (puente) +
  `InspectorRemotePanel` (UI). La pagina solo aporta presets e iframe.
- El puente espera mediante polling hasta que el iframe expone
  `window.__inspectors.layout` y este reporta `ready` (o sea, el juego ya
  registro sus controles).
- Al conectar lee `.schema` (catalogo plano) y `.read()` para cada control; el
  encabezado sale de `.status`.
- Cada cambio llama `.write()` (el host del juego sincroniza el HUD); al soltar
  o usar `-`/`+`, llama tambien a `.commit()` / `.step()`.

Hook principal, expuesto por
`packages/components-inspector/src/InspectorRegistry.svelte.ts` al llamarse
`configure()` (`__inspectors[id]`, mas el alias historico `__inspector` para el
registro `layout`):

| Miembro del registro remoto | Funcion |
|---|---|
| `ready` / `title` / `status` | estado del panel (bucket + viewport) |
| `schema` | catalogo plano de controles registrados |
| `read` / `write` | leer y escribir un control en vivo |
| `step` / `toggle` | paso fino (clamp + redondeo) y checkbox |
| `commit` / `reset` | persistir y resetear el bucket |
| `snapshot` | JSON de COPY VALUES |

Hooks historicos de
[`src/game/stateTweak.svelte.ts`](src/game/stateTweak.svelte.ts), que siguen
publicados para QA/Playwright:

| Hook | Funcion |
|---|---|
| `__stateTweak` | proxy de valores editables |
| `__labState` | bucket y viewport activos |
| `__saveTweak` | persiste el bucket actual |
| `__resetTweak` | borra override y aplica seed/default |
| `__syncUi` | propaga valores del HUD |
| `__labBucket` | devuelve el bucket activo |

El acceso es valido porque padre e iframe son same-origin. Si se despliega con
origenes distintos, este mecanismo deja de funcionar y debe reemplazarse por
`postMessage` con validacion de origen.

### 5.3 Marcas de aprobacion

Los checks verdes de los presets no se calculan leyendo un estado de QA: son la
lista estatica `APPROVED_PRESETS` dentro de `+page.svelte`. Cambiar esa lista
solo cambia la marca visual y el tooltip; no modifica seeds ni persistencia.

`COPY VALUES` del panel externo copia el mismo formato que UiLab, pero usa el
viewport del preset activo. `RESET BUCKET` opera sobre el bucket real del
iframe, que puede ser compartido por mas de un viewport si las reglas de
`RES_BUCKETS` asi lo determinan.

---

## 6. Que es editable y donde

### Ajuste rapido de layout por resolucion

Editar desde UiLab o `/sizes`:

- `boardH`, `boardX`, `boardY` para la grilla.
- `stackScale`, `stackRight`, `stackBottom` para BET/SPIN/TURBO/AUTO.
- `iconScale`, `iconX`, `iconY` para menu, settings, sonido y BONUS.
- `kashH`, `kashX`, `kashY` para Kash lateral.
- `freeScale` para activar/desactivar caps anti-solape.

Editar catalogo/rangos en
[`src/game/labMeta.ts`](src/game/labMeta.ts). Editar defaults, seeds, buckets,
persistencia y hooks en
[`src/game/stateTweak.svelte.ts`](src/game/stateTweak.svelte.ts).

### Ajuste de los laboratorios

| Que | Donde |
|---|---|
| Sliders/toggles del `UiLab`, rangos, clave de persistencia | `src/game/labMeta.ts` |
| Host del `UiLab` (read/write/commit/reset/status/snapshot) | `src/game/labInspector.svelte.ts` |
| Clips, situaciones, free spins, soundboard, swing align, diagnostico del `AnimLab` | `src/game/labActions.svelte.ts` |
| UI de los paneles, registro, puente remoto | `packages/components-inspector` (compartido — **no** meter nada de un juego ahi) |

### Ajuste estructural de layout

Editar directamente:

- [`src/game/hudLayout.ts`](src/game/hudLayout.ts): formulas, caps, top bar,
  zona reservada y transform del board.
- [`src/game/stateUiTweak.svelte.ts`](src/game/stateUiTweak.svelte.ts): ancho,
  proporciones y medidas congeladas del HUD, frame y simbolos.
- [`src/components/BottomBar.svelte`](src/components/BottomBar.svelte): markup,
  acciones y posicionamiento HTML.
- [`src/components/BoardFrame.svelte`](src/components/BoardFrame.svelte):
  render del frame.
- [`src/components/SymbolSprite.svelte`](src/components/SymbolSprite.svelte):
  tamano de simbolos y variantes.

Estos cambios requieren revalidar todos los presets porque afectan a mas de un
bucket.

### Ajuste de animacion y bateo

- Lista de clips y acciones del panel: `src/game/labActions.svelte.ts`.
- Reproduccion, debug, hit frame y geometria del swing:
  `src/components/Background.svelte`.
- Ajuste vivo de sesion: `src/game/swingAlign.svelte.ts`.
- Momento y secuencia de eventos de produccion:
  `src/game/bookEventHandlerMap.ts`.
- Registro de sonidos: `src/game/sound.ts`.

El golpe del swing se produce en `SWING_STRIKE_FRAME = 30`; cambiarlo afecta
shake, SFX y el momento en que se resuelve el `broadcastAsync('kashSwing')`.

### Ajuste de situaciones de QA

Editar los disparadores en `src/game/labActions.svelte.ts`: cantidades de
wins, cantidad de free spins, tier usado, sonidos y eventos. La logica de
negocio no debe duplicarse ahi; el laboratorio debe seguir emitiendo los
eventos reales. El panel del SDK no se toca para esto.

---

## 7. Limitaciones y riesgos conocidos

- Nada de esto se monta en produccion por el guard DEV.
- Los valores del `localStorage` son locales al navegador y al origen; no son
  una configuracion versionada del repositorio.
- `/sizes` solo funciona correctamente con iframe same-origin y hooks DEV.
- `freeScale` puede producir solapes intencionados; no debe dejarse activo sin
  revisar cada preset.
- El reset usa seeds por bucket, pero el texto de los botones habla de
  `RESET BUCKET`; la fuente de verdad es `resetTweak()`.
- `APPROVED_PRESETS` es una marca manual, no una prueba automatizada.
- El ajuste `swingAlign` no persiste. Para conservarlo hay que hornearlo en
  `Background.svelte`.
- Los assets de animacion y el estado `KASH_IDLES_ENABLED` pueden hacer que un
  clip aparezca como fallback estatico aunque el boton exista.
- Los valores de frame/simbolos en `stateUiTweak` estan fuera del catalogo de
  sliders y no se pueden cambiar desde estos laboratorios.
- El paquete `components-inspector` se enlaza por workspace (`workspace:*`). Si
  el link de `node_modules` no existe, correr `pnpm install` en la raiz del SDK.
- Dentro del paquete, los campos reactivos de una clase deben ser PRIVADOS
  (`#x = $state(...)`) con getter publico: el tsconfig del SDK usa `target: es6`
  y esbuild baja los campos publicos al constructor, posicion que Svelte
  rechaza (`state_invalid_placement`).

## 8. Procedimiento recomendado de trabajo

1. Levantar mock RGS y app en DEV.
2. Usar `/sizes` para seleccionar un preset Stake concreto.
3. Ajustar primero board, despues botonera/iconos y finalmente Kash.
4. Desactivar `LIBRE` y validar que no haya solapes con los caps normales.
5. Usar `COPY VALUES` para conservar el snapshot en el handoff o en un PR.
6. Ejecutar AnimLab para revisar clips, swing, wins, bonus, free spins,
   anticipacion, transicion y audio.
7. Si se cambia la alineacion de swing, hornearla en `Background.svelte` y
   volver a probar `TIRADA BATEO`.
8. Repetir la comprobacion en los siete presets antes de marcar cambios como
   aprobados.
