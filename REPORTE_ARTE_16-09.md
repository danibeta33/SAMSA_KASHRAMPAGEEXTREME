# Reporte para el equipo de arte — feedback Stake 16-09

Del feedback de Stake del 16-09 hay **dos puntos que no se pueden resolver en código**: el
texto está horneado dentro de las imágenes. Los otros cuatro ya están arreglados en el
frontend.

Este documento es el pedido concreto: qué hay que rehacer, con qué criterio, y qué pasa si no
llega a tiempo.

---

## 1. Intro de la pantalla de carga — términos prohibidos en el texto

**Prioridad: BLOQUEANTE para stake.us.** Sin esto el juego no se aprueba para social casino.

### El problema

El crawl del intro dice, textualmente:

> TO VANISH FROM THE CITY, THE CREW NEEDS **CASH** AND NEW IDENTITIES
> — AND THOSE ARE SEALED INSIDE THE CENTRAL BANK.
> NO PLAN, NO BACKUP, NO TIME.
> GOING IN THE FRONT AND DOING WHAT HE ALWAYS DOES:
> ANSWER EVERY LOSS WITH A BIGGER **BET**.

`CASH` y `BET` están en la lista de términos prohibidos de stake.us. La tabla oficial los
mapea a `coins` y `play`.

### Por qué no se arregla por software

El juego ya tiene un mecanismo que reemplaza estos términos en vivo (`game/social.ts`): con
`social=true` recorre todo el texto de la pantalla y lo cambia. Pero **solo funciona sobre
texto real**. Acá el texto es parte del dibujo: viaja dentro de
`static/assets/loading/intro.webp`, que se genera desde los atlas que ustedes entregan
(`art-src/intro/Intro-0..8.json` + `.webp`). Para el navegador son píxeles, no letras. No hay
forma de reemplazarlos, ni de taparlos con un parche (el texto se mueve y la ventana cambia de
tamaño durante la animación).

### Qué necesitamos

**Re-export de los atlas del intro con el texto reescrito.** Propuesta de copy — mantiene el
tono y no toca ningún término restringido:

| Dice | Debería decir |
|---|---|
| `THE CREW NEEDS **CASH** AND NEW IDENTITIES` | `THE CREW NEEDS A **FORTUNE** AND NEW IDENTITIES` |
| `ANSWER EVERY LOSS WITH A BIGGER **BET**` | `ANSWER EVERY LOSS WITH A BIGGER **PLAY**` |

Si prefieren otra redacción, adelante — la única condición es que **no aparezca ninguna de
estas palabras**: `bet`, `bets`, `betting`, `cash`, `money`, `buy`, `purchase`, `wager`,
`gamble`, `stake`, `deposit`, `withdraw`, `credit`, `funds`, `cost`, `pay`, `payout`,
`currency`.

**Importante: una sola versión, no dos.** El copy nuevo es válido también en el juego con
dinero real, así que no hace falta mantener un intro por modo — eso agregaría 9 MB al build.

### Entrega

Mismo formato de siempre: el multi-pack de TexturePacker en `art-src/intro/`
(`Intro-N.json` + `Intro-N.webp`). El resto lo hace el script:

```
python tools/build_intro.py
```

que regenera `static/assets/loading/intro.webp`. No cambien resolución, cantidad de frames ni
fps sin avisar — el script valida que la numeración sea contigua.

### Si no llega a tiempo

Hay un plan B de una línea de código: **ocultar el intro cuando el juego corre en modo
social**. El jugador de stake.us vería el fondo, el logo y el bate girando, sin el crawl. Es
100% compatible con la aprobación, pero se pierde el intro en esa plataforma. Decidir antes
del submit.

---

## 2. Tile 16:9 — demasiado oscuro

**Prioridad: alta.** No bloquea el submit del juego, pero sí la colocación en la tienda.

### El problema

Textual del reviewer:

> Please make sure that the 16:9 tile is generally bright and does not clash with the Stake
> background. It is currently too dark.

Medimos la escena del vault que se está usando: **luminancia media ≈ 23**. El fondo de la
plataforma Stake es `#1a2c38`, que da **≈ 41**. O sea que el tile es *más oscuro que el fondo
sobre el que se apoya* — se desvanece en la grilla en vez de destacarse.

Es exactamente el mismo rechazo que ya nos comimos con Kash Smash (ver
`02-rejection-log-kash-smash.md`, N2.1).

### Qué necesitamos

**Background 16:9:**
- Luminancia media claramente por encima de 41. **Apuntar a 60-80.** No alcanza con subir el
  brillo global: conviene levantar medios y luces y sumar saturación, manteniendo negros con
  algo de densidad para que no se lave.
- **Sin texto y sin multiplicadores de ningún tipo.** Es requisito explícito del checklist. El
  título del juego lo compone el ACP en una capa aparte.
- Gradiente discreto, sin bordes duros.

**Foreground:**
- Personaje (Kash) recortado, **con transparencia real**, llenando el área de foco.
- Que funcione encima del background sin halo ni borde de recorte.

### Cómo se entrega

**No se sube un tile ya armado.** El ACP tiene un Tile Editor donde se suben las dos capas por
separado (background + foreground) y él compone el 16:9. Así que necesitamos los dos PNG
sueltos.

Buena noticia: **cambiar el tile no requiere re-review del juego**, así que esto puede ir
después del submit sin frenar nada.

---

## 3. Limpieza: hay arte de Kash Smash dentro del build de Rampage

No es parte del feedback, pero lo encontramos revisando y conviene resolverlo.

`static/assets/tile/` tiene cuatro archivos:

```
tile_background_1024.png   1.8 MB
tile_background_2048.png   6.2 MB
tile_foreground_1024.png   1.9 MB
tile_foreground_2048.png   6.8 MB
```

Son **el gorila de Kash Smash**, no Kash Rampage Extreme. No los usa ningún componente del
juego (búsqueda en todo `src/`: cero referencias), pero como están en `static/` se copian al
build y viajan al CDN: **~16 MB de peso muerto, con el branding de otro juego adentro**.

Propuesta: borrar el directorio, y cuando lleguen los tiles nuevos del punto 2 guardarlos
fuera de `static/` (van al ACP a mano, no los consume el juego).

---

## Resumen

| # | Qué | Quién | Bloquea |
|---|---|---|---|
| 1 | Re-export del intro con copy sin términos prohibidos | Arte | **Sí** — aprobación stake.us |
| 2 | Tile 16:9 más brillante, sin texto + foreground transparente | Arte | Colocación en tienda |
| 3 | Borrar `static/assets/tile/` (arte de KS1) | Dev | No |
