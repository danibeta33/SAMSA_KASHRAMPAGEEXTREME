"""
ESLABÓN DE LA CADENA — recorta `Chain.wav` a un one-shot por símbolo.

POR QUÉ ESTE PASO EXISTE
------------------------
El equipo entregó `Chain.wav`: 3.5 s de cadena traqueteando, con 60 ms de
silencio y una RAMPA de ~200 ms antes de llegar al cuerpo. Eso es un COLCHÓN
—un sonido para tender debajo de toda una secuencia—, no el golpe de un
eslabón.

La cascada de victoria (winFlash.svelte.ts) lo necesita al revés: un disparo
por símbolo, en el frame exacto en que arranca su marco, cada 175-660 ms
según el tamaño del cluster. Con el archivo entero pasaban las dos cosas que
se reportaron el 15-09:

  · `Sound.svelte` reproduce cada SFX con UN `HTMLAudioElement` por nombre, y
    cada disparo hace `currentTime = 0`. O sea que cada símbolo REINICIABA la
    cadena antes de que se oyera: todos caían dentro de la rampa inaudible y
    solo el ÚLTIMO llegaba a sonar completo. Se escuchaba una sola vez, al
    final — exactamente el síntoma reportado. (La polifonía la arregla del
    lado del player; ver SFX_POLYPHONY en sound.ts.)
  · Aun con polifonía, 5 copias de 3.5 s encimadas son un manchón de ruido,
    no una cadena tensándose eslabón por eslabón.

QUÉ RECORTA
-----------
Una ventana del CUERPO del clip, no del arranque: el arranque es la rampa, y
un one-shot necesita su transitorio en t=0 o llega tarde por definición. La
ventana por defecto (0.250 s → 0.700 s) cae justo donde la cadena ya está
densa y pega fuerte, así que el eslabón ataca en el primer milisegundo.

  · fade-in de 4 ms   → el corte es a mitad de onda; sin esto hace CLICK.
  · fade-out de 150 ms → cierra el eslabón en vez de cortarlo seco.
  · normalizado a -1 dBFS de pico. El gain fino va por SFX_GAIN, que es donde
    se mezcla contra el resto.

Sale en WAV y no en mp3/m4a a propósito: `srcFor()` en Sound.svelte sirve
.m4a cuando el browser lo soporta y esperaría el par de archivos, y además un
wav corto se decodifica sin latencia — que es todo el punto de un sonido que
tiene que caer EN el frame. A 0.45 s pesa ~80 KB contra los 600 KB del
original, así que además el build adelgaza.

    entrada : static/assets/audio/Chain.wav       ← master del equipo, se queda
    salida  : static/assets/audio/ChainLink.wav   ← lo que consume el juego

USO
---
    python tools/build_chain_link.py
    python tools/build_chain_link.py --start 0.30 --length 0.35
"""

import argparse
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
AUDIO = os.path.join(APP, "static", "assets", "audio")
SRC = os.path.join(AUDIO, "Chain.wav")
OUT = os.path.join(AUDIO, "ChainLink.wav")


def decode(path, rate):
    """WAV/mp3 → array (n, canales) float32 en -1..1, vía el ffmpeg de imageio."""
    import imageio_ffmpeg

    proc = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", path,
         "-f", "s16le", "-ac", "2", "-ar", str(rate), "-"],
        capture_output=True,
    )
    if proc.returncode != 0:
        sys.exit(proc.stderr.decode("utf-8", "replace"))
    return np.frombuffer(proc.stdout, dtype="<i2").reshape(-1, 2).astype(np.float32) / 32768.0


def ramp(samples, length, rising):
    """Rampa lineal de `length` muestras; devuelve un vector de ganancia."""
    gain = np.ones(samples, dtype=np.float32)
    length = min(length, samples)
    if length <= 0:
        return gain
    edge = np.linspace(0.0, 1.0, length, dtype=np.float32)
    if rising:
        gain[:length] = edge
    else:
        gain[samples - length:] = edge[::-1]
    return gain


def build(args):
    audio = decode(args.src, args.rate)
    total = len(audio) / args.rate
    start = int(args.start * args.rate)
    end = min(len(audio), start + int(args.length * args.rate))
    if start >= len(audio):
        sys.exit(f"--start {args.start}s cae fuera del clip ({total:.3f}s)")

    clip = audio[start:end].copy()
    n = len(clip)
    clip *= ramp(n, int(args.fade_in * args.rate), rising=True)[:, None]
    clip *= ramp(n, int(args.fade_out * args.rate), rising=False)[:, None]

    peak = float(np.abs(clip).max())
    target = 10 ** (args.peak_db / 20.0)
    if peak > 0:
        clip *= target / peak

    pcm = (np.clip(clip, -1.0, 1.0) * 32767).astype("<i2").tobytes()
    import imageio_ffmpeg

    proc = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y",
         "-f", "s16le", "-ac", "2", "-ar", str(args.rate), "-i", "pipe:0",
         args.out],
        input=pcm, capture_output=True,
    )
    if proc.returncode != 0:
        sys.exit(proc.stderr.decode("utf-8", "replace"))

    print(
        f"{args.src}\n  {total:.3f}s · pico original del recorte {peak:.3f}\n"
        f"{args.out}\n  {n / args.rate:.3f}s · {os.path.getsize(args.out) / 1e3:.0f} KB · "
        f"normalizado a {args.peak_db:g} dBFS"
    )


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--start", type=float, default=0.250, help="segundo del master donde empieza el eslabón")
    ap.add_argument("--length", type=float, default=0.450, help="duración del eslabón en segundos")
    ap.add_argument("--fade-in", type=float, default=0.004, help="rampa de entrada (evita el click del corte)")
    ap.add_argument("--fade-out", type=float, default=0.150, help="rampa de salida")
    ap.add_argument("--peak-db", type=float, default=-1.0, help="pico objetivo en dBFS")
    ap.add_argument("--rate", type=int, default=44100)
    ap.add_argument("--src", default=SRC)
    ap.add_argument("--out", default=OUT)
    build(ap.parse_args())


if __name__ == "__main__":
    main()
