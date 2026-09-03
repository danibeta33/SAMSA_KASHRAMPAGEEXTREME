"""
Optimizer setup — Kash Rampage Extreme.

CRITICAL: condition ORDER must be wincap -> (big) -> freegame -> 0 -> basegame
for base mode (lessons-learned de KS1), and wincap -> fences for buy modes.

Per-mode RTPs must sum to bet_mode.rtp (0.965) or verify_optimization_input
fails. Capped at 96.5% to stay under the ACP 96.70% limit.

Targets KRE (GDD preliminar + decisiones 28-07):
  base        Extreme — hit 22%, std >= 27 (gauge ACP: 9.76=LOW, 14.56=MEDIUM,
              27.14=EXTREME, medidos con KS1)
  vault_crack Medium
  smash_mode  High (fences de KS1, que el gauge ya midió como HIGH)
  rage_mode   Extreme

P(KASH RAMPAGE) en base es EMERGENTE: los books rampage (criteria="rampage",
payouts ~4-1630x según harness) se reparten entre la fence "big" (rango
500-4999.9, cross-criteria vía el patch de rangos del binario Rust) y el
catch-all basegame; el optimizer les asigna peso dentro de cada fence. La
frecuencia visible se mide post-optimización (stats/verify) y se itera si el
GDD pide otra. En buys el rampage es un roll por spin dentro del book
(config.rampage["prob_per_spin"]) y el RTP lo fijan estas fences igual.
"""

from optimization_program.optimization_config import (
    ConstructScaling,
    ConstructParameters,
    ConstructFenceBias,
    ConstructConditions,
    verify_optimization_input,
)


class OptimizationSetup:
    def __init__(self, game_config):
        self.game_config = game_config
        wincaps = {bm.get_name(): bm.get_wincap() for bm in game_config.bet_modes}

        # min_m2m=1.0 (iter 4): el catch-all basegame de KRE queda comprimido
        # en 0-20x (big/rampage/freegame se llevan todas las colas) y con
        # min_m2m=4 el constructor no puede armar pigs bajo el target
        # ("neg_pigs=0"). El m2m del MODO lo aportan las fences de cola.
        base_params = ConstructParameters(
            num_show=5000,
            num_per_fence=10000,
            min_m2m=1.0,
            max_m2m=10,
            pmb_rtp=1.0,
            sim_trials=5000,
            test_spins=[50, 100, 200],
            test_weights=[0.3, 0.4, 0.3],
            score_type="rtp",
        ).return_dict()

        buy_params = ConstructParameters(
            num_show=5000,
            num_per_fence=10000,
            min_m2m=1.0,
            max_m2m=8,
            pmb_rtp=1.0,
            sim_trials=5000,
            test_spins=[10, 20, 50],
            test_weights=[0.6, 0.2, 0.2],
            score_type="rtp",
        ).return_dict()

        # rage (iter 10): ventanas de score largas + más trials — con las
        # ventanas cortas el score subestima las colas raras (wincap/big) y
        # el optimizer convergía sistemáticamente ~0.3% abajo (96.16-96.20).
        rage_params = ConstructParameters(
            num_show=5000,
            num_per_fence=10000,
            min_m2m=1.0,
            max_m2m=8,
            pmb_rtp=1.0,
            sim_trials=10000,
            test_spins=[50, 100, 200],
            test_weights=[0.3, 0.4, 0.3],
            score_type="rtp",
        ).return_dict()

        # Fences disjuntas por rango de payout (patrón validado en KS1):
        # av_win implícito = rtp * cost * hr y debe caer dentro del
        # search_range. plb ≈ P(fence "freegame") = 1/1.51515 = 0.66.
        # Escalonado por decisión del usuario 28-07 (supersede al PDF):
        #   vault Medium (big fino y raro) · smash High (= KS1, gauge ya lo
        #   midió HIGH) · rage Extreme (big gordo y frecuente + wincap 1.5x).
        buy_fences = {
            # nombre, (lo, hi) en x-bet, rtp, hr (rondas por hit)
            "vault_crack": [
                ("big", (1500, 4999.9), 0.020, 1200),      # av 2400x, 1/1200
                ("mid", (100, 1999.9), 0.671, 2.95),      # av 198x, 34%
                ("freegame", (0, 99.9), 0.264, 1.51515),   # av 40x, 66%
            ],
            "smash_mode": [
                ("big", (2000, 4999.9), 0.056, 200),       # av 2800x, 1/200
                ("mid", (250, 1999.9), 0.6482, 2.9895),    # av 484x, 33%
                ("freegame", (0, 249.9), 0.2508, 1.51515), # av 95x, 66%
            ],
            "rage_mode": [
                # iter 7: av de big bajado a 2800 (con av 4037 el pool
                # 2000-4999 —mediana ~2500— no alcanzaba el promedio y el
                # optimizer entregaba 96.16 en silencio). P(big) queda 1/95.
                ("big", (2000, 4999.9), 0.059, 95),        # av 2800x, 1/95
                ("mid", (500, 1999.9), 0.644, 3.0166),     # av 971x, 33%
                ("freegame", (0, 499.9), 0.251, 1.51515),  # av 190x, 66%
            ],
        }
        # wincap rtp por buy: vault/smash 0.01, rage 0.015 (cola Extreme).
        # rage wincap 0.011 (iter 8): con 0.015 el pool de books wincap capea el
        # peso entregable y el modo quedaba clavado en 96.16 (déficit constante
        # -0.34% con CUALQUIER cambio en las otras fences).
        buy_wincap_rtp = {"vault_crack": 0.01, "smash_mode": 0.01, "rage_mode": 0.011}

        # Base RTP split (Extreme):
        #   wincap 0.09 + big 0.09 + freegame 0.28 + rampage 0.06 +
        #   basegame 0.445 = 0.965
        #   hit = 1/4.673 + 1/200 + 1/1100 + 1/10000 + wc = 0.2200 ≈ 22%
        # Historia de iteraciones (29-07):
        #   iter 1 — fence "rampage" sin search: el binario la trata como
        #     catch-all posicional y degenera el perfil (RTP 90.6%, hit 1.6%).
        #   iter 2 — books rampage al catch-all basegame: su av 68x contamina
        #     la fence (target av 2.07) y el constructor no converge
        #     ("neg_pigs=0, RTP too high").
        #   iter 3 (actual) — fence "rampage" POR RANGO (20-499.9), después
        #     de freegame: absorbe el grueso de los books rampage (mediana
        #     23x) + colas naturales sin scatter; el catch-all basegame queda
        #     homogéneo (0.1-20x). av fence = 0.06×1100 = 66x ✓ dentro del
        #     rango y ≈ av del harness.
        opt = {}

        if any(bm.get_name() == "base" for bm in game_config.bet_modes):
            opt["base"] = {
                "conditions": {
                    "wincap": ConstructConditions(
                        rtp=0.11, av_win=wincaps["base"], search_conditions=wincaps["base"]
                    ).return_dict(),
                    # Cross-criteria por rango: reclama books grandes (rampage
                    # de cola, colas de freegame, outliers). Pobla el check 40
                    # (bandas 500-4999) junto con los dresses del scaling.
                    "big": ConstructConditions(
                        rtp=0.11, hr=10000, search_conditions=(500, 4999.9)
                    ).return_dict(),
                    "freegame": ConstructConditions(
                        rtp=0.26, hr=200, search_conditions={"symbol": "scatter"}
                    ).return_dict(),
                    # Books rampage (sin scatter) + colas naturales 20-500x.
                    # El evento de firma visible en base ≈ 1/1100 spins.
                    "rampage": ConstructConditions(
                        rtp=0.06, hr=1100, search_conditions=(20, 499.9)
                    ).return_dict(),
                    "0": ConstructConditions(rtp=0, av_win=0, search_conditions=0).return_dict(),
                    "basegame": ConstructConditions(hr=4.676, rtp=0.425).return_dict(),
                },
                "scaling": ConstructScaling(
                    [
                        {"criteria": "basegame", "scale_factor": 1.2, "win_range": (1, 2), "probability": 1.0},
                        {"criteria": "basegame", "scale_factor": 1.5, "win_range": (10, 20), "probability": 1.0},
                        {"criteria": "freegame", "scale_factor": 1.4, "win_range": (300, 499.9), "probability": 1.0},
                        # Check 40: dresses en "big" para que las sub-bandas
                        # 1000-2000 / 2000-3000 / 3000-5000 no queden en cero.
                        {"criteria": "big", "scale_factor": 1.2, "win_range": (1000, 2000), "probability": 1.0},
                        {"criteria": "big", "scale_factor": 1.2, "win_range": (2000, 3000), "probability": 1.0},
                        {"criteria": "big", "scale_factor": 1.3, "win_range": (3000, 5000), "probability": 1.0},
                    ]
                ).return_dict(),
                "parameters": base_params,
                "distribution_bias": ConstructFenceBias(
                    applied_criteria=["basegame"],
                    bias_ranges=[(0.5, 1.5)],
                    bias_weights=[0.4],
                ).return_dict(),
            }

        for bm_name in ("vault_crack", "smash_mode", "rage_mode"):
            if not any(bm.get_name() == bm_name for bm in game_config.bet_modes):
                continue
            conditions = {
                "wincap": ConstructConditions(
                    rtp=buy_wincap_rtp[bm_name],
                    av_win=wincaps[bm_name],
                    search_conditions=wincaps[bm_name],
                ).return_dict(),
            }
            for fname, srange, frtp, fhr in buy_fences[bm_name]:
                conditions[fname] = ConstructConditions(
                    rtp=frtp, hr=fhr, search_conditions=srange
                ).return_dict()
            opt[bm_name] = {
                "conditions": conditions,
                "scaling": ConstructScaling([]).return_dict(),
                "parameters": rage_params if bm_name == "rage_mode" else buy_params,
            }

        self.game_config.opt_params = opt
        verify_optimization_input(self.game_config, self.game_config.opt_params)
