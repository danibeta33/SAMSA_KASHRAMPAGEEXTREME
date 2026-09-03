"""Harness de calibración de KASH RAMPAGE (Fase 1 KRE).

Mide el payout de spins base CON rampage forzado, para ambos scopes
(per_cell vs global_symbol), y de books de buy con el roll por spin actual.
Los números alimentan dos decisiones:
  1. GDD: scope per_cell vs global_symbol (espectacularidad vs volatilidad).
  2. Fences: rtp/hr de la fence "rampage" en base — P(rampage) sostenible es
     rtp_presupuestado / av_win, NO un valor elegido a mano (con av ~100x+,
     1/50 daría RTP >2.0: imposible).

Evita numpy sobre arrays grandes (bug de elision en Py3.14) — todo con
listas + statistics.

Uso: env/bin/python games/kash_rampage_extreme/rampage_harness.py [n_sims]
"""

import os
import sys
from statistics import mean, median, quantiles

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME = os.path.join(ROOT, "games", "kash_rampage_extreme")
os.chdir(GAME)
sys.path.insert(0, ROOT)
sys.path.insert(0, GAME)

from gamestate import GameState  # noqa: E402
from game_config import GameConfig  # noqa: E402


def run_base_rampage(n, scope):
    config = GameConfig()
    config.rampage["scope"] = scope
    gs = GameState(config)
    gs.betmode = "base"
    gs.num_sims = n
    payouts = []
    n_conv_prem = 0
    n_conversions = 0
    for sim in range(n):
        gs.criteria = "rampage"
        gs.run_spin(sim)
        final = 0
        for ev in gs.book.events:
            if ev["type"] in ("finalWin",):
                final = ev["amount"] / 100.0
            if ev["type"] == "kashRampage":
                n_conversions += len(ev["conversions"])
                n_conv_prem += sum(1 for c in ev["conversions"] if c["premium"])
        payouts.append(final)
    return payouts, n_conversions, n_conv_prem


def run_buy(n, mode):
    config = GameConfig()
    gs = GameState(config)
    gs.betmode = mode
    gs.num_sims = n
    payouts = []
    rampage_books = 0
    for sim in range(n):
        gs.criteria = "freegame"
        gs.run_spin(sim)
        final = 0
        had = False
        for ev in gs.book.events:
            if ev["type"] == "finalWin":
                final = ev["amount"] / 100.0
            if ev["type"] == "kashRampage":
                had = True
        payouts.append(final)
        rampage_books += had
    return payouts, rampage_books


def describe(tag, payouts, cost=1.0):
    xb = [p / cost for p in payouts]
    q = quantiles(xb, n=20)
    print(
        f"{tag}: n={len(xb)}  av={mean(xb):.1f}x  med={median(xb):.1f}x  "
        f"p95={q[18]:.1f}x  max={max(xb):.1f}x  "
        f"P(<1x costo)={sum(1 for v in xb if v < 1)/len(xb):.3f}  "
        f"P(>=wincap 5000x)={sum(1 for v in xb if v >= 5000)/len(xb):.4f}"
    )
    return mean(xb)


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000

    print("== BASE con rampage forzado ==")
    for scope in ("per_cell", "global_symbol"):
        payouts, ncv, nprem = run_base_rampage(n, scope)
        av = describe(f"base/{scope}", payouts)
        print(
            f"   conversiones/spin={ncv/max(1,len(payouts)):.1f}  "
            f"premium rate={nprem/max(1,ncv):.3f}"
        )
        for budget in (0.04, 0.06, 0.08):
            print(
                f"   → con rtp_fence={budget}: P(rampage) sostenible = "
                f"1/{av/budget:.0f} spins (hr={av/budget:.0f})"
            )

    print("\n== BUYS con roll actual (prob_per_spin del config) ==")
    cfg = GameConfig()
    for mode in ("vault_crack", "smash_mode", "rage_mode"):
        payouts, rb = run_buy(max(200, n // 4), mode)
        cost = cfg.buy_modes[mode]["cost"]
        describe(f"{mode} (cost {cost:g}x)", payouts, cost)
        print(f"   books con >=1 rampage: {rb}/{len(payouts)} = {rb/len(payouts):.2%}")
