"""Kash Rampage Extreme — verificación estadística sobre las lookup tables finales.

Muestrea N rondas por modo (default 10M, pedido del Feedback N1) desde
library/publish_files/lookUpTable_<modo>_0.csv y reporta RTP, std,
prob_less_bet, hit-rate por banda y max win, junto con los valores exactos
ponderados de la tabla completa. Solo análisis: no toca books ni configs.

IMPORTANTE: este script evita deliberadamente la aritmética con operadores
de numpy sobre arrays grandes (a * b, a - c). El env del SDK corre numpy
2.2.5 sobre Python 3.14, donde la "temporary elision" de numpy pisa buffers
de arrays vivos dentro de funciones (refcount de locals cambió en 3.14) y
produce resultados corruptos silenciosos con arrays >256KB. Todo el cálculo
se hace con math.fsum sobre listas; numpy solo se usa para el muestreo
multinomial (C-side, no afectado).

Uso:  env/bin/python verify_10m.py [--sims 10000000] [--seed 7]
"""

import argparse
import csv
from math import fsum, inf, sqrt
from pathlib import Path

import numpy as np

PUBLISH = Path(__file__).parent / "library" / "publish_files"

# Costo en x-bet por modo (espejo de game_config.py — buy_modes 100/250/500x).
MODES = {
    "base": 1.0,
    "vault_crack": 100.0,
    "smash_mode": 250.0,
    "rage_mode": 500.0,
}

RTP_TARGET = 0.965
RTP_TOL = 0.0005  # ±0.05%
WINCAP_X = 5000.0

# Bandas de payout (en x-bet) para el reporte. La banda 1000–4999x de base
# es la del approval check 40 — debe quedar poblada.
BANDS = [
    (0, 1), (1, 2), (2, 5), (5, 10), (10, 20), (20, 50), (50, 100),
    (100, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 3000),
    (3000, 5000), (5000, inf),
]


def load_table(mode):
    path = PUBLISH / f"lookUpTable_{mode}_0.csv"
    weights, payouts = [], []
    with open(path) as f:
        for row in csv.reader(f):
            weights.append(int(row[1]))
            payouts.append(int(row[2]) / 100.0)
    return weights, payouts


def weighted_stats(probs, payouts, cost):
    rtp = fsum(p * x for p, x in zip(probs, payouts)) / cost
    mean = rtp * cost
    var = fsum(p * (x - mean) ** 2 for p, x in zip(probs, payouts))
    plb = fsum(p for p, x in zip(probs, payouts) if x < cost)
    return rtp, sqrt(var), plb


def sampled_stats(counts, payouts, cost, n):
    rtp = fsum(c * x for c, x in zip(counts, payouts)) / n / cost
    mean = rtp * cost
    var = fsum(c * (x - mean) ** 2 for c, x in zip(counts, payouts)) / n
    plb = fsum(c for c, x in zip(counts, payouts) if x < cost) / n
    max_hit = max((x for c, x in zip(counts, payouts) if c > 0), default=0.0)
    return rtp, sqrt(var), plb, max_hit


def band_mass(pairs, lo, hi):
    return fsum(v for v, x in pairs if lo <= x < hi)


def band_label(lo, hi):
    return f"[{lo:g}, {hi:g})" if hi != inf else f">= {lo:g}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sims", type=int, default=10_000_000)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    failures = []

    for mode, cost in MODES.items():
        weights, payouts = load_table(mode)
        total_w = sum(weights)
        probs = [w / total_w for w in weights]

        rtp_e, std_e, plb_e = weighted_stats(probs, payouts, cost)

        # 10M rondas como conteos multinomiales por fila — estadísticamente
        # idéntico a muestrear 10M ids y mucho más liviano.
        counts = rng.multinomial(args.sims, probs).tolist()
        rtp_s, std_s, plb_s, max_s = sampled_stats(counts, payouts, cost, args.sims)

        print("=" * 72)
        print(f"{mode}  (costo {cost:g}x, {args.sims:,} rondas muestreadas)")
        print(f"  RTP     exacto {rtp_e * 100:8.4f}%   muestral {rtp_s * 100:8.4f}%")
        print(f"  std     exacto {std_e:10.3f}   muestral {std_s:10.3f}")
        print(f"  P(win < costo)  exacto {plb_e:.4f}   muestral {plb_s:.4f}")
        print(f"  max win muestral {max_s:g}x   (wincap {WINCAP_X:g}x)")
        print("  Bandas (x-bet): muestral | exacto (peso)")
        prob_pairs = list(zip(probs, payouts))
        count_pairs = list(zip(counts, payouts))
        for lo, hi in BANDS:
            pe = band_mass(prob_pairs, lo, hi)
            ps = band_mass(count_pairs, lo, hi) / args.sims
            if pe == 0 and ps == 0:
                continue
            hr = f"1/{1 / ps:,.0f}" if ps > 0 else "—"
            print(f"    {band_label(lo, hi):>14}: {ps * 100:9.5f}%  ({hr:>12})  | {pe * 100:9.5f}%")

        if abs(rtp_e - RTP_TARGET) > RTP_TOL:
            failures.append(f"{mode}: RTP exacto {rtp_e * 100:.4f}% fuera de {RTP_TARGET * 100}% ±{RTP_TOL * 100}%")
        if mode == "base":
            for lo, hi in [(1000, 2000), (2000, 3000), (3000, 5000)]:
                if band_mass(prob_pairs, lo, hi) <= 0:
                    failures.append(f"base: banda {lo}-{hi}x sin peso (check 40)")
        if not any(w > 0 and x >= WINCAP_X for w, x in zip(weights, payouts)):
            failures.append(f"{mode}: wincap {WINCAP_X}x inalcanzable")

    print("=" * 72)
    if failures:
        print("FALLAS:")
        for f in failures:
            print(f"  ✗ {f}")
        raise SystemExit(1)
    print("✓ Todos los checks pasan (RTP, check 40, wincap alcanzable).")


if __name__ == "__main__":
    main()
