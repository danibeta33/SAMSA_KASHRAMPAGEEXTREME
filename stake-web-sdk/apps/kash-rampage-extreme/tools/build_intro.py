"""
INTRO DE LA PANTALLA DE CARGA — multi-pack de TexturePacker → 1 WebP animado.

POR QUÉ ESTE PASO EXISTE
------------------------
El equipo entrega el clip de la ventana de intro (el "crawl" de texto del
Episode 16) como un multi-pack de TexturePacker: `Intro-N.json/.webp`. Ese
formato NO se puede usar tal cual en el browser:

  · cada hoja es un atlas gigante (el drop 15-09 son 9 hojas de ~7700x7600 →
    ~59 Mpx → ~235 MB ya decodificados cada una). Todas juntas no entran en
    RAM/VRAM y Chrome se cae antes del primer frame.
  · el reparto entre hojas NO es secuencial: los frames de una misma hoja
    están salteados, así que para dibujar el principio hacen falta igual
    todas las hojas — no hay forma de ir soltando atlas a medida que avanza.
  · son ~27 MB de descarga, y `static/` se copia entero al build → viajarían
    al CDN aunque no se usen.

Un WebP ANIMADO resuelve las tres cosas de una: lo decodifica el browser
cuadro a cuadro (memoria ~ 1 frame), es un solo `<img>` sin código de
reproducción, mantiene el alfa (la ventana es un cuadrilátero inclinado sobre
fondo transparente) y anda en todos los browsers del ACP (Chrome/Edge/Firefox
y Safari 14+).

DÓNDE VIVE CADA COSA
--------------------
  entrada : art-src/intro/Intro-{0..N}.{json,webp}   ← FUERA de static/
  salida  : static/assets/loading/intro.webp         ← lo que consume el juego

Las hojas fuente están en `art-src/` justamente para que no se publiquen: son
el master, se versionan (o no) aparte, y solo este script las mira.

GEOMETRÍA: SE LEE DEL PACK, NO SE HARDCODEA
-------------------------------------------
La versión anterior de este script traía la tabla de packing escrita a mano
(30 hojas, 240 frames, recorte uniforme de 1703x835, fórmula `hoja = (N % 60)
// 2`). El re-export del 15-09 cambió las tres cosas a la vez —9 hojas, 360
frames, recortes TRIMMED de tamaño variable y 36 frames ROTADOS— y esa tabla
quedó inservible.

Ahora todo sale de los JSON, que es el único lugar donde el dato es
autoritativo:

  · `frames[nombre].frame`            → rect dentro del atlas.
  · `frames[nombre].rotated`          → si el sprite se guardó girado 90°.
  · `frames[nombre].spriteSourceSize` → dónde va ese recorte dentro del
                                        canvas original (el trim que sacó
                                        TexturePacker).
  · `frames[nombre].sourceSize`       → el canvas original (1920x1080).

El orden de reproducción sale del número en el nombre (`Episode 16_00042.png`
→ 42), NO del orden de las claves ni del reparto entre hojas. El script valida
que la numeración sea contigua y sin repetidos antes de codificar.

FRAMES ROTADOS
--------------
Con `rotated: true`, TexturePacker guarda el sprite girado 90° en el atlas
pero deja `frame.w/h` con las medidas SIN girar. Entonces el rect que hay que
recortar es (x, y, x + h, y + w) —alto y ancho intercambiados— y después se
gira 90° ANTIHORARIO para recuperar el original.

El sentido está verificado contra el pack real y no asumido: se compuso el
frame 5 (rotado) de las dos maneras y se comparó contra sus vecinos 4 y 6, que
no lo están. Antihorario da una diferencia media de 11.1/9.9 —por debajo de
los 16.8 que hay entre el 4 y el 6, como corresponde a un frame intermedio—;
horario da 21.0/21.8, o sea peor que comparar los vecinos entre sí. Si un
re-export futuro sale al revés, esta es la comprobación para repetir.

EL RECORTE: CENTRADO EN LA VENTANA, NO EN EL BOUNDING BOX
---------------------------------------------------------
La animación nueva ABRE y CIERRA sola: la ventana entra creciendo desde casi
nada (frames 0-11), se queda quieta en 1708x832 el grueso del clip, y sale
encogiéndose (frames 348-359). En el medio del crecimiento pega un OVERSHOOT
que llega a 1895x915 — más grande que la ventana en reposo.

Si se recortara justo al bounding box de todo el clip, el asset quedaría
descentrado respecto de la ventana en reposo (el overshoot no es simétrico) y
los valores de `introAnimY` que están aprobados por bucket en el UI LAB se
correrían. Por eso el recorte se toma SIMÉTRICO alrededor del centro de la
ventana en reposo, agrandado lo necesario para que entre el overshoot:

  centro = mediana de los centros de todos los frames  → cae en la ventana en
           reposo, que es la mayoría del clip (robusto ante el overshoot, que
           son 10 frames de 360).
  radio  = max(distancia del centro a cada borde del bounding box)

Así el centro de la IMAGEN coincide con el centro de la VENTANA, el margen
extra es transparente y reparte parejo, y `introAnimX`/`introAnimY` siguen
valiendo sin tocar nada.

Lo que sí cambia es el TAMAÑO relativo: la ventana ya no ocupa el 100% del
ancho de la imagen sino el 89.3%, así que a igual ancho CSS se vería más
chica. Eso se compensa UNA vez en el CSS de `.load__intro`
(`LoadingOverlay.svelte`), multiplicando el ancho base por la razón que
imprime este script al terminar — no tocando los sliders de cada bucket.

TASA: 24 fps PAREJOS EN TODO EL CLIP
------------------------------------
Pedido de dirección (15-09): el intro va a 24 fps de punta a punta. El default
de `--crawl-step` es 1, o sea sin decimar.

La versión anterior decimaba el crawl a 12 fps para ahorrar peso — el peso
escala casi lineal con la cantidad de frames porque libwebp no logra
codificarlos por diferencia (el alfa + la compresión con pérdida le rompen el
delta), así que el asset pasa de ~5.1 MB a ~7.5 MB. El razonamiento de
entonces era que el crawl es texto subiendo despacio (cambio medio por frame
2.49 contra 5.43 de la apertura) y que a 12 fps el salto seguía por debajo del
que la apertura ya mostraba a 24. Con el clip en mano dirección prefirió
igualar la tasa; el peso es el costo aceptado.

La maquinaria del tramo lento se deja INTACTA y a un flag de distancia: si
alguna vez hay que volver a bajar el peso, `--crawl-step 2` reproduce
exactamente el asset viejo. El tramo se detecta solo desde los JSON (sin
decodificar nada): son los frames cuya ventana está a menos de `--quiet-tol`
del tamaño en reposo —los que ya terminaron de abrir y todavía no empezaron a
cerrar— recortándole `--quiet-margin` frames a cada punta. Con el pack actual
da 25..334.

La DURACIÓN de cada frame sale de la distancia al siguiente frame elegido, así
que el clip dura exactamente lo mismo se decime o no: 15.00 s.

CICLO: ANIMACIÓN · ESPERA
-------------------------
Una vuelta completa del bucle es:

    animación (15 s) → 3 s en transparente → repite

  · FUNDIDOS — `--fade-frames` sigue existiendo pero ahora arranca en 0. El
    pack anterior entraba y salía de golpe (todos sus frames eran la ventana
    entera) y necesitaba una rampa de alfa por software para no aparecer
    cortado. El pack nuevo trae la entrada y la salida DIBUJADAS: el frame 0
    y el 359 son la ventana casi cerrada (39k y 29k píxeles opacos contra el
    millón de los frames del medio), así que el bucle ya empalma solo. Una
    rampa encima taparía justo la animación de apertura. Se deja el flag por
    si un re-export futuro vuelve a venir sin apertura.
  · ESPERA — al final se agrega UN frame totalmente transparente con una
    duración de `--hold-seconds` (3 s). Un frame y no 72: el WebP animado
    guarda la duración POR FRAME, así que el hueco sale gratis en peso.

Todo esto va HORNEADO en el asset y no en CSS a propósito. El WebP animado lo
reproduce el browser con su propio reloj, que arranca cuando el decodificador
empieza — no en el `load` del `<img>` ni en el montaje del componente. Una
`@keyframes` encima nunca queda en fase, y menos después de la primera vuelta
del bucle. Horneado es exacto frame a frame y no puede desincronizarse.

El slider de opacidad del UI LAB sigue funcionando: multiplica por encima de
este alfa.

USO
---
    python tools/build_intro.py                    # defaults aprobados (24 fps)
    python tools/build_intro.py --width 1152       # más nitidez, más peso
    python tools/build_intro.py --crawl-step 2     # crawl a 12 fps (asset viejo)
    python tools/build_intro.py --frame-step 2     # 12 fps parejos
    python tools/build_intro.py --fps 30           # si el clip se rindió a 30
    python tools/build_intro.py --hold-seconds 0   # sin espera entre vueltas
"""

import argparse
import glob
import json
import os
import re
import statistics
import sys
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC_DIR = os.path.join(APP, "art-src", "intro")
OUT_PATH = os.path.join(APP, "static", "assets", "loading", "intro.webp")


def load_pack(src_dir):
    """
    Indexa el multi-pack: devuelve `{numero_de_frame: (hoja, entrada_json)}`,
    el `sourceSize` común y la cantidad de hojas.

    Valida lo que puede romper el resultado en silencio: que haya hojas, que
    la numeración sea contigua desde 0, que no haya frames repetidos entre
    hojas y que todos declaren el mismo canvas original.
    """
    paths = sorted(
        glob.glob(os.path.join(src_dir, "Intro-*.json")),
        key=lambda p: int(re.search(r"Intro-(\d+)", os.path.basename(p)).group(1)),
    )
    if not paths:
        sys.exit(f"no hay hojas `Intro-*.json` en {src_dir}")

    index = {}
    sizes = set()
    for path in paths:
        pack = int(re.search(r"Intro-(\d+)", os.path.basename(path)).group(1))
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        for name, entry in data["frames"].items():
            match = re.search(r"_(\d+)\.png$", name)
            if not match:
                sys.exit(f"{path}: el frame `{name}` no termina en `_NNNNN.png`")
            number = int(match.group(1))
            if number in index:
                sys.exit(f"{path}: el frame {number} ya venía en la hoja {index[number][0]}")
            index[number] = (pack, entry)
            sizes.add((entry["sourceSize"]["w"], entry["sourceSize"]["h"]))

    if len(sizes) != 1:
        sys.exit(f"los frames no comparten canvas original: {sorted(sizes)}")
    numbers = sorted(index)
    if numbers != list(range(len(numbers))):
        faltan = sorted(set(range(numbers[-1] + 1)) - set(numbers))[:10]
        sys.exit(f"la numeración no es contigua desde 0 — faltan {faltan}")

    return index, sizes.pop(), len(paths)


def crop_box(index):
    """
    Caja de recorte SIMÉTRICA alrededor del centro de la ventana en reposo.

    El centro sale de la MEDIANA de los centros de todos los frames: la ventana
    pasa quieta la mayor parte del clip, así que la mediana cae ahí y no se
    deja arrastrar por el overshoot de la apertura ni por los frames chicos del
    principio y el final.

    El radio es la distancia del centro al borde más lejano del bounding box de
    TODO el clip, así nada queda cortado.

    Devuelve `(x0, y0, w, h, window_w)`, donde `window_w` es el ancho de la
    ventana en reposo (la mediana), que es contra lo que se mide cuánto hay que
    compensar el ancho base del CSS.
    """
    boxes = [entry["spriteSourceSize"] for _, entry in index.values()]
    cx = statistics.median(b["x"] + b["w"] / 2 for b in boxes)
    cy = statistics.median(b["y"] + b["h"] / 2 for b in boxes)

    half_w = max(max(cx - b["x"], b["x"] + b["w"] - cx) for b in boxes)
    half_h = max(max(cy - b["y"], b["y"] + b["h"] - cy) for b in boxes)

    # Se redondea hacia ARRIBA (nada puede quedar cortado) y se fuerza par: un
    # radio impar deja el centro de la imagen en un medio píxel y el reescalado
    # a la salida corre el encuadre respecto del que aprobó el UI LAB.
    half_w = int(-(-half_w // 1))
    half_h = int(-(-half_h // 1))
    half_w += half_w % 2
    half_h += half_h % 2

    x0 = int(round(cx)) - half_w
    y0 = int(round(cy)) - half_h
    return x0, y0, half_w * 2, half_h * 2, statistics.median(b["w"] for b in boxes)


def quiet_run(index, tol, margin):
    """
    Tramo en el que la ventana ya está quieta: el crawl de texto.

    Se mide por el TAMAÑO de la ventana, que sale del JSON y no exige
    decodificar ni un atlas: son los frames cuyo ancho no supera por más de
    `tol` al de la ventana en reposo — los que ya terminaron de abrir y
    todavía no empezaron a cerrar. Se queda con la corrida contigua más larga
    (el medio del clip) y le recorta `margin` frames de cada punta para no
    comerse la cola del movimiento de apertura/cierre.

    Devuelve `(desde, hasta)` inclusive, o `None` si no hay tramo utilizable.
    """
    boxes = {n: entry["spriteSourceSize"] for n, (_, entry) in index.items()}
    rest = statistics.median(b["w"] for b in boxes.values())
    quiet = [n for n in sorted(boxes) if boxes[n]["w"] <= rest * (1 + tol)]
    if not quiet:
        return None

    runs = []
    current = [quiet[0]]
    for n in quiet[1:]:
        if n == current[-1] + 1:
            current.append(n)
        else:
            runs.append(current)
            current = [n]
    runs.append(current)

    longest = max(runs, key=len)
    start, end = longest[0] + margin, longest[-1] - margin
    return (start, end) if end > start else None


def select_frames(total, step, quiet, crawl_step):
    """
    Números de frame que se van a codificar.

    `step` decima TODO el clip por igual; `crawl_step` decima además —y solo—
    el tramo lento. Fuera del tramo lento no se saltea nada, que es lo que
    mantiene la apertura y el cierre a la tasa completa.
    """
    selected = []
    for n in range(0, total, step):
        if quiet and quiet[0] <= n <= quiet[1] and ((n - quiet[0]) // step) % crawl_step:
            continue
        selected.append(n)
    return selected


def extract(sheet, entry):
    """
    Saca un frame del atlas ya desrotado.

    Con `rotated: true` el rect ocupa (h x w) en la hoja —`frame.w/h` vienen
    SIN girar— y se recupera girando 90° antihorario (ver el encabezado: el
    sentido está verificado contra el pack, no asumido).
    """
    fr = entry["frame"]
    if entry.get("rotated"):
        crop = sheet.crop((fr["x"], fr["y"], fr["x"] + fr["h"], fr["y"] + fr["w"]))
        return crop.rotate(90, expand=True)
    return sheet.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))


def fade_factor(position, total, fade):
    """
    Multiplicador de alfa del frame `position` (0-based) de una secuencia de
    `total`, con `fade` frames de entrada y `fade` de salida.

    La rampa es un SMOOTHSTEP (`t²(3-2t)`), no una recta: arranca y termina con
    pendiente cero, así el fundido no tiene ni arranque ni corte perceptibles.

    Los extremos son exactos: el primer frame queda en 0 y el último también,
    así que el bucle empalma transparente con transparente y no hay salto.
    """
    if fade <= 0:
        return 1.0
    t = 1.0
    if position < fade:
        t = position / fade
    elif position >= total - fade:
        t = (total - 1 - position) / fade
    return t * t * (3.0 - 2.0 * t)


def apply_fade(image, factor):
    """Multiplica el canal alfa por `factor` (1.0 = sin tocar)."""
    if factor >= 1.0:
        return image
    alpha = image.getchannel("A").point(lambda v: int(v * factor + 0.5))
    image.putalpha(alpha)
    return image


def build(args):
    index, source_size, packs = load_pack(SRC_DIR)
    total = len(index)
    x0, y0, crop_w, crop_h, window_w = crop_box(index)
    height = round(crop_h * args.width / crop_w)

    quiet = quiet_run(index, args.quiet_tol, args.quiet_margin) if args.crawl_step > 1 else None
    selected = select_frames(total, args.frame_step, quiet, args.crawl_step)
    tramo = f"{quiet[0]}..{quiet[1]} a 1 de cada {args.crawl_step}" if quiet else "sin decimar"

    print(
        f"pack: {packs} hojas · {total} frames · canvas {source_size[0]}x{source_size[1]}\n"
        f"recorte: {crop_w}x{crop_h} en ({x0}, {y0}) · ventana en reposo {int(window_w)} px\n"
        f"tramo lento: {tramo} · se codifican {len(selected)} de {total} frames"
    )

    t0 = time.time()
    # Se abre CADA HOJA UNA SOLA VEZ y se sacan todos sus frames: abrir por
    # frame significaría decodificar 360 veces un atlas de 59 Mpx (minutos, no
    # segundos). Cada frame se compone y se reescala al salir, así que en RAM
    # solo queda un atlas + los frames chicos, nunca las 9 hojas juntas.
    por_hoja = {}
    for n in selected:
        por_hoja.setdefault(index[n][0], []).append(n)

    frames = []
    for i, pack in enumerate(sorted(por_hoja)):
        path = os.path.join(SRC_DIR, f"Intro-{pack}.webp")
        if not os.path.exists(path):
            sys.exit(f"falta la hoja {path}")
        with Image.open(path) as sheet:
            rgba = sheet.convert("RGBA")
        for n in por_hoja[pack]:
            entry = index[n][1]
            ss = entry["spriteSourceSize"]
            # Se compone DIRECTO en el espacio del recorte (no se arma el
            # canvas 1920x1080 intermedio): así el recorte puede salirse de
            # los bordes del canvas original sin ningún caso especial.
            canvas = Image.new("RGBA", (crop_w, crop_h), (0, 0, 0, 0))
            canvas.paste(extract(rgba, entry), (ss["x"] - x0, ss["y"] - y0))
            frames.append((n, canvas.resize((args.width, height), Image.LANCZOS)))
        rgba.close()
        print(f"  hoja {i + 1}/{len(por_hoja)}", end="\r", flush=True)

    # Los frames salieron agrupados por hoja: hay que devolverlos al orden de
    # reproducción (el número del nombre) antes de codificar.
    frames.sort(key=lambda item: item[0])
    images = [im for _, im in frames]

    # Fundido de entrada/salida, ya en el orden final: la rampa se mide sobre
    # la POSICIÓN en la secuencia que se va a codificar, no sobre el número de
    # frame original. Con el pack actual esto es un no-op (fade=0).
    for i, image in enumerate(images):
        apply_fade(image, fade_factor(i, len(images), args.fade_frames))

    # La duración de cada frame es la distancia al SIGUIENTE frame elegido, no
    # un valor fijo: así el clip dura exactamente lo mismo esté decimado o no,
    # y el tramo lento simplemente tiene frames que duran el doble.
    ms = 1000.0 / args.fps
    gaps = [selected[i + 1] - selected[i] for i in range(len(selected) - 1)]
    gaps.append(total - selected[-1])
    durations = [round(g * ms) for g in gaps]
    anim_s = sum(durations) / 1000

    # Espera en transparente entre vuelta y vuelta: un frame vacío que dura lo
    # que haga falta. El WebP animado guarda la duración POR FRAME, así que
    # esto no agrega peso más allá de un frame que comprime a unos bytes.
    if args.hold_seconds > 0:
        images.append(Image.new("RGBA", images[0].size, (0, 0, 0, 0)))
        durations.append(round(args.hold_seconds * 1000))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    images[0].save(
        args.out,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,  # en bucle: la carga dura lo que dura, el intro no puede quedar en negro
        quality=args.quality,
        method=args.method,
        minimize_size=True,
    )

    mb = os.path.getsize(args.out) / 1e6
    print(
        f"\n{args.out}\n  {len(images)} frames · {args.width}x{height} · q{args.quality}\n"
        f"  animación: {anim_s:.2f}s · espera: {args.hold_seconds:.1f}s · "
        f"vuelta completa: {sum(durations) / 1000:.2f}s\n"
        f"  fundido por software: {args.fade_frames} frames\n"
        f"  la ventana ocupa {window_w / crop_w * 100:.1f}% del ancho de la imagen:\n"
        f"    el ancho base de `.load__intro` va x{crop_w / window_w:.3f} para conservar el encuadre\n"
        f"  {mb:.2f} MB en {time.time() - t0:.0f}s"
    )


def main():
    # La consola de Windows abre en cp1252 y revienta al imprimir cualquier
    # caracter fuera de esa tabla. El resumen final los usa.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--width", type=int, default=1004, help="ancho de salida en px (default 1004)")
    ap.add_argument("--quality", type=int, default=72, help="calidad WebP 0-100 (default 72)")
    ap.add_argument(
        "--frame-step",
        type=int,
        default=1,
        help="decima TODO el clip: 1 = todos los frames · 2 = la mitad",
    )
    ap.add_argument(
        "--crawl-step",
        type=int,
        default=1,
        help="decima SOLO el tramo lento (default 1 = desactivado, 24 fps parejos · 2 = crawl a 12 fps)",
    )
    ap.add_argument(
        "--quiet-tol",
        type=float,
        default=0.01,
        help="cuánto puede pasarse la ventana del tamaño en reposo para contar como quieta (default 0.01)",
    )
    ap.add_argument(
        "--quiet-margin",
        type=int,
        default=12,
        help="frames que se le sacan a cada punta del tramo lento (default 12 = 0.5s)",
    )
    ap.add_argument("--fps", type=float, default=24.0, help="cuadros por segundo del clip (default 24)")
    ap.add_argument("--method", type=int, default=4, help="esfuerzo de libwebp 0-6 (default 4)")
    ap.add_argument(
        "--fade-frames",
        type=int,
        default=0,
        help="fundido por software al entrar y salir (default 0: el pack ya abre y cierra solo)",
    )
    ap.add_argument(
        "--hold-seconds",
        type=float,
        default=3.0,
        help="segundos en transparente entre vuelta y vuelta (default 3 · 0 = sin espera)",
    )
    ap.add_argument("--out", default=OUT_PATH)
    build(ap.parse_args())


if __name__ == "__main__":
    main()
