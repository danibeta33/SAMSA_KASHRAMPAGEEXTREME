"""Re-empaqueta un spritesheet de TexturePacker a un canvas por frame más chico.

Motivo (drop 08-09): `anim_sym_premium` llegó como 25 frames de 701×701 en un
atlas de 3296×3296 = 10.34 MB, contra 0.19–0.23 MB de `anim_sym_wild` y
`anim_sym_scatter`. El símbolo se dibuja en una celda de SYMBOL_SIZE = 80 px, así
que 701 px por frame es ~9× más resolución de la que se ve, y con `preload: true`
esos 10 MB bloquean el loading screen de todos los jugadores.

Qué hace:
  1. Decodifica cada frame del atlas viejo a su SOURCE SIZE completo. Los frames
     vienen `trimmed` (recortados al bounding box del arte) y algunos `rotated`
     (girados 90° en el atlas para empaquetar mejor), así que hay que des-rotar y
     re-pegar cada uno en su lienzo original antes de tocar la escala.
  2. Reescala esos lienzos completos al lado pedido (default 256, el mismo canvas
     que usan los otros dos especiales).
  3. Re-empaqueta en una grilla simple y emite el JSON con el MISMO nombre de
     animación y las MISMAS claves de frame, para no romper a los consumidores.

Trabajar sobre el lienzo completo (y no sobre el recorte) es lo que mantiene los
ratios normalizados que `SymbolSprite.svelte` tiene horneados en `ANIM_SPECIAL`:
`aspect`, `fill` y `center` son invariantes de escala, así que si el re-pack está
bien hecho no cambian. `--verify` los compara antes/después y falla si se movieron.

Uso:
    python .scripts/repack_spritesheet.py <ruta/al/sheet.json> [--size 256] [--verify]
    python .scripts/repack_spritesheet.py <ruta/al/sheet.json> --report   # solo medir
"""

import argparse
import json
import math
import shutil
import sys
from pathlib import Path

from PIL import Image

# La consola de Windows abre en cp1252 y revienta con las flechas/×/✓ de los
# reportes. Sin esto el script muere DESPUÉS de haber escrito el atlas, que es
# la peor combinación posible.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Tolerancia al comparar los ratios normalizados antes/después. El re-pack
# redondea coordenadas a entero, así que el error escala como 1/lado.
RATIO_TOL = 5e-3


def load_sheet(json_path: Path):
    """Devuelve (data, {nombre_frame: Image RGBA del sourceSize completo})."""
    data = json.loads(json_path.read_text(encoding="utf-8"))
    atlas_path = json_path.parent / data["meta"]["image"]
    atlas = Image.open(atlas_path).convert("RGBA")

    frames = {}
    for name, entry in data["frames"].items():
        f = entry["frame"]
        # En un frame `rotated`, TexturePacker guarda el arte girado en el atlas:
        # la región ocupa (h, w) en vez de (w, h), así que se lee con las
        # dimensiones intercambiadas y después se desgira.
        #
        # ⚠ El sentido importa y es fácil de errar: con ROTATE_270 el resultado
        # queda 180° al revés. Se verificó contra los frames NO rotados del mismo
        # sheet, que son la referencia de orientación: en `anim_sym_premium` los
        # frames 0,1,2,3,7,13,15,17,20,21,23 vienen rotados y el resto no, y solo
        # con ROTATE_90 los rotados quedan alineados con sus vecinos.
        box = (
            (f["x"], f["y"], f["x"] + f["h"], f["y"] + f["w"])
            if entry.get("rotated")
            else (f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])
        )
        art = atlas.crop(box)
        if entry.get("rotated"):
            art = art.transpose(Image.Transpose.ROTATE_90)

        # Re-expandir el recorte a su lienzo original en la posición que declara
        # spriteSourceSize, para que el frame vuelva a ser autocontenido.
        src = entry["sourceSize"]
        canvas = Image.new("RGBA", (src["w"], src["h"]), (0, 0, 0, 0))
        sss = entry.get("spriteSourceSize", {"x": 0, "y": 0})
        canvas.paste(art, (sss["x"], sss["y"]))
        frames[name] = canvas

    return data, frames


def art_ratios(frames):
    """Ratios normalizados del arte — los mismos que hornea ANIM_SPECIAL."""
    x0 = y0 = math.inf
    x1 = y1 = -math.inf
    for img in frames.values():
        bbox = img.getbbox()  # None si el frame es totalmente transparente
        if bbox is None:
            continue
        x0, y0 = min(x0, bbox[0]), min(y0, bbox[1])
        x1, y1 = max(x1, bbox[2]), max(y1, bbox[3])

    any_frame = next(iter(frames.values()))
    cw, ch = any_frame.size
    w, h = x1 - x0, y1 - y0
    return {
        "canvas": (cw, ch),
        "bbox": (x0, y0, x1, y1),
        "art": (w, h),
        "aspect": w / h,
        "fill": {"w": w / cw, "h": h / ch},
        "center": {"x": ((x0 + x1) / 2) / cw, "y": ((y0 + y1) / 2) / ch},
    }


def fmt_ratios(r):
    return (
        f"canvas {r['canvas'][0]}×{r['canvas'][1]}  arte {r['art'][0]}×{r['art'][1]}  "
        f"aspect {r['aspect']:.6f}  fill {{w:{r['fill']['w']:.6f}, h:{r['fill']['h']:.6f}}}  "
        f"center {{x:{r['center']['x']:.6f}, y:{r['center']['y']:.6f}}}"
    )


def repack(json_path: Path, side: int, verify: bool):
    data, frames = load_sheet(json_path)
    before = art_ratios(frames)
    atlas_path = json_path.parent / data["meta"]["image"]
    before_bytes = atlas_path.stat().st_size

    names = list(data["frames"].keys())
    scaled = {n: frames[n].resize((side, side), Image.LANCZOS) for n in names}

    # Grilla lo más cuadrada posible, con el atlas AJUSTADO a la grilla. Nada de
    # redondear a potencia de 2: WebP comprime el vacío a casi nada, pero la
    # textura DESCOMPRIMIDA en VRAM cuesta ancho×alto×4 bytes igual — 2048²
    # serían 16.7 MB contra 6.5 MB de 1280².
    cols = math.ceil(math.sqrt(len(names)))
    rows = math.ceil(len(names) / cols)
    aw, ah = cols * side, rows * side

    out_atlas = Image.new("RGBA", (aw, ah), (0, 0, 0, 0))
    out_frames = {}
    for i, name in enumerate(names):
        x, y = (i % cols) * side, (i // cols) * side
        out_atlas.paste(scaled[name], (x, y))
        # Se emite SIN trim: el frame ya es el lienzo completo, así que
        # spriteSourceSize arranca en (0,0) y sourceSize == frame.
        out_frames[name] = {
            "frame": {"x": x, "y": y, "w": side, "h": side},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": side, "h": side},
            "sourceSize": {"w": side, "h": side},
        }

    out = {
        "frames": out_frames,
        "meta": {
            **{k: v for k, v in data["meta"].items() if k not in ("size", "scale")},
            "size": {"w": aw, "h": ah},
            "scale": "1",
        },
    }
    # `animations` es lo que PIXI usa para armar el clip: conservarlo tal cual.
    if "animations" in data:
        out["animations"] = data["animations"]

    # Backup antes de pisar, por si hay que volver.
    for p in (json_path, atlas_path):
        shutil.copy2(p, p.with_suffix(p.suffix + ".bak"))

    out_atlas.save(atlas_path, "WEBP", quality=92, method=6)
    json_path.write_text(json.dumps(out, indent=2), encoding="utf-8")

    _, new_frames = load_sheet(json_path)
    after = art_ratios(new_frames)
    after_bytes = atlas_path.stat().st_size

    print(f"  ANTES   {fmt_ratios(before)}")
    print(f"          atlas {data['meta']['size']['w']}×{data['meta']['size']['h']}  "
          f"{before_bytes / 1048576:.2f} MB  {len(names)} frames")
    print(f"  DESPUES {fmt_ratios(after)}")
    print(f"          atlas {aw}×{ah}  {after_bytes / 1048576:.2f} MB  {len(names)} frames")
    print(f"  → {before_bytes / after_bytes:.1f}× más liviano "
          f"({(before_bytes - after_bytes) / 1048576:.2f} MB menos)")

    if verify:
        bad = []
        for key, b, a in (
            ("aspect", before["aspect"], after["aspect"]),
            ("fill.w", before["fill"]["w"], after["fill"]["w"]),
            ("fill.h", before["fill"]["h"], after["fill"]["h"]),
            ("center.x", before["center"]["x"], after["center"]["x"]),
            ("center.y", before["center"]["y"], after["center"]["y"]),
        ):
            if abs(a - b) > RATIO_TOL:
                bad.append(f"{key}: {b:.6f} → {a:.6f} (Δ {abs(a - b):.6f})")
        if bad:
            print("  ✗ los ratios normalizados se movieron:")
            for line in bad:
                print(f"      {line}")
            raise SystemExit(1)
        print(f"  ✓ ratios normalizados estables (tol {RATIO_TOL})")

    print("\n  Valores para ANIM_SPECIAL de SymbolSprite.svelte:")
    print(f"      aspect: {after['aspect']:.6f},")
    print(f"      fill:   {{ w: {after['fill']['w']:.6f}, h: {after['fill']['h']:.6f} }},")
    print(f"      center: {{ x: {after['center']['x']:.6f}, y: {after['center']['y']:.6f} }},")


def report(json_path: Path):
    data, frames = load_sheet(json_path)
    atlas_path = json_path.parent / data["meta"]["image"]
    r = art_ratios(frames)
    print(f"  {fmt_ratios(r)}")
    print(f"  atlas {data['meta']['size']['w']}×{data['meta']['size']['h']}  "
          f"{atlas_path.stat().st_size / 1048576:.2f} MB  {len(data['frames'])} frames  "
          f"anims {list(data.get('animations', {}))}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet", type=Path, help="ruta al .json de TexturePacker")
    ap.add_argument("--size", type=int, default=256, help="lado del frame de salida")
    ap.add_argument("--verify", action="store_true", help="falla si los ratios se mueven")
    ap.add_argument("--report", action="store_true", help="solo medir, no escribir")
    args = ap.parse_args()

    print(f"{args.sheet.name}")
    if args.report:
        report(args.sheet)
    else:
        repack(args.sheet, args.size, args.verify)


if __name__ == "__main__":
    main()
