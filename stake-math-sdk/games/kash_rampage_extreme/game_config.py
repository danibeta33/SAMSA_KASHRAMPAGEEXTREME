"""
KASH RAMPAGE EXTREME — Stake Engine Math SDK / game_config.py

Lucky Bastards Studio — secuela de Kash Smash: The Vault (LIVE 28-07-2026).
Fork de games/kash_smash. GDD preliminar: PDF "Listado General de Cambios
Kash Rampage Extreme vs. Kash Smash 1" + decisiones del 28-07.

Mechanics summary (target KRE — la mecánica KS1 se remueve en Fase 1):
  - 6x5 grid, cluster pays (min 5 connected, BFS)
  - Tumble multiplier (resets per spin) 1x -> 500x
  - SIN persistent multiplier (el SMASH Meter de KS1 se elimina)
  - 4 BetModes: base, vault_crack (100x), smash_mode (250x), rage_mode (500x)
    (IDs internos heredados de KS1 a propósito — solo cambian los títulos display)
  - KASH RAMPAGE (firma): probabilístico en base + los 3 buys; convierte TODOS
    los L1-L4/M1-M2 de la grilla a High (85%: H1-H3 ponderado) o Premium (15%: H4)
  - Volatilidad target: base Extreme (22% hit) · buys Medium/High/Extreme escalonados
  - Target RTP: 96.5% across all modes (ACP cap is 96.70%)
  - Wincap 5000x
"""

import os

from src.config.config import Config
from src.config.distributions import Distribution
from src.config.betmode import BetMode


class GameConfig(Config):
    """Singleton Kash Rampage Extreme config."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        super().__init__()

        # ── Identity ───────────────────────────────────────────────────────
        self.game_id = "kash_rampage_extreme"
        self.provider_number = 0
        self.working_name = "Kash Rampage Extreme"
        self.provider_name = "Lucky Bastards Studio"
        self.rtp = 0.965
        self.construct_paths()

        # ── Board geometry ─────────────────────────────────────────────────
        self.num_reels = 6
        self.num_rows = [5] * self.num_reels
        self.wincap = 5000.0
        self.win_type = "cluster"
        # Tope duro de free spins totales por ronda (red de seguridad). Sin
        # esto, cualquier reel con tasa de retrigger alta hace crecer tot_fs
        # más rápido que fs y el loop de free spins no termina (colgaba la
        # simulación). 200 es holgado: inalcanzable en juego real (20 base +
        # retriggers de a 5), pero corta cualquier runaway del optimizer.
        self.max_total_fs = 200

        # ── Symbols ────────────────────────────────────────────────────────
        # H1=Bluff, H2=Syl, H3=Rookie, H4=KASH (premium)
        # M1=Vials, M2=Dossier
        # L1=Drill, L2=Keycard, L3=Smoke Grenade, L4=Cash Stack
        # W=Bat (wild), S=Gold Bar (scatter)
        # Names map at frontend layer; math only cares about identifiers.
        self.include_padding = True
        self.special_symbols = {"wild": ["W"], "scatter": ["S"], "multiplier": []}

        # Paytable from GDD section 4.3, rounded to 0.10x increments.
        paygroup = self._build_paytable_10c({
            # LOW
            "L1": {5: 0.6, 7: 0.8, 9: 2.2, 11: 5.5, 14: 14.0, 30: 55.0},
            "L2": {5: 0.8, 7: 1.1, 9: 2.8, 11: 6.9, 14: 18.0, 30: 68.0},
            "L3": {5: 1.1, 7: 1.5, 9: 3.6, 11: 9.5, 14: 23.0, 30: 95.0},
            "L4": {5: 1.4, 7: 1.9, 9: 4.7, 11: 12.0, 14: 30.0, 30: 120.0},
            # MEDIUM
            "M1": {5: 2.5, 7: 3.6, 9: 9.5, 11: 27.0, 14: 68.0, 30: 295.0},
            "M2": {5: 3.3, 7: 4.8, 9: 13.5, 11: 40.0, 14: 102.0, 30: 470.0},
            # HIGH
            "H1": {5: 4.8, 7: 7.4, 9: 23.5, 11: 74.0, 14: 200.0, 30: 940.0},
            "H2": {5: 6.8, 7: 10.8, 9: 38.0, 11: 122.0, 14: 340.0, 30: 1620.0},
            "H3": {5: 8.2, 7: 13.5, 9: 43.5, 11: 142.0, 14: 405.0, 30: 1880.0},
            "H4": {5: 13.5, 7: 24.5, 9: 95.0, 11: 340.0, 14: 1020.0, 30: 4900.0},
        })
        self.paytable = self.convert_range_table(paygroup)

        # ── Free spins ─────────────────────────────────────────────────────
        # 4+S triggers FS; per GDD section 5.3: 4=10, 5=15, 6+=20 (template
        # original mapping kept here — drift inside Stake Engine acceptable).
        # Retrigger: 3+S inside FS → +5 spins.
        # Cubrir hasta las 30 celdas del board: las reels cargadas de scatter
        # (WCAP, usadas por los sims forzados wincap/bigwin) pueden sacar 9+
        # scatters y el lookup por conteo exacto tiraba KeyError. 6+ = 20
        # spins / retrigger siempre +5, igual que dicen las rules.
        self.freespin_triggers = {
            self.basegame_type: {4: 10, 5: 15, **{n: 20 for n in range(6, 31)}},
            self.freegame_type: {n: 5 for n in range(3, 31)},
        }
        self.anticipation_triggers = {
            self.basegame_type: min(self.freespin_triggers[self.basegame_type].keys()) - 1,
            self.freegame_type: min(self.freespin_triggers[self.freegame_type].keys()) - 1,
        }

        # ── Tumble multiplier ─────────────────────────────────────────────
        # Progression heredada de KS1; el cap 500x cubre las cascadas
        # profundas. KRE NO tiene persistent multiplier (el SMASH Meter de
        # KS1 se eliminó — decisión GDD 28-07).
        self.tumble_mult_progression = [1, 2, 4, 8, 12, 20, 50, 100, 200, 500]
        self.maximum_board_mult = 1

        # ── KASH RAMPAGE (mecánica de firma) ──────────────────────────────
        # Convierte TODAS las celdas convertibles (L/M) a High o Premium.
        # - En BASE se fuerza vía Distribution criteria="rampage"
        #   (conditions["force_rampage"]) y la frecuencia real la fija el
        #   peso de la fence en el optimizer (como freegame). prob_per_spin
        #   NO aplica al spin base.
        # - En BUYS (y FS natural, key "base_freegame") es un roll i.i.d.
        #   por free spin, solo en el drop inicial (nunca en tumbles).
        # ⚠️ PARÁMETROS GDD PRELIMINARES — prob_per_spin escalona los buys;
        # el harness de F1.2 (rampage_harness.py) mide av_win por scope para
        # calibrarlos contra los targets de volatilidad.
        self.rampage = {
            "scope": "per_cell",  # "per_cell" | "global_symbol" (GDD abierto)
            "premium_symbol": "H4",
            "premium_chance": 0.15,
            "high_weights": {"H1": 0.45, "H2": 0.30, "H3": 0.25},
            "convertible": {"L1", "L2", "L3", "L4", "M1", "M2"},
            # Calibración harness 28-07 (per_cell): un rampage paga av ~68x
            # (med 23x, p95 213x). Sin persistent mult, el rampage ES el motor
            # del bonus → probs por spin altas y escalonadas por precio.
            # Rampages esperados por bonus (10 spins): vault ~1.25 · smash 2 ·
            # rage ~3.3.
            "prob_per_spin": {
                "base_freegame": 1 / 10,
                "vault_crack": 1 / 8,
                "smash_mode": 1 / 5,
                # 26-08 (corrida producción): con 1/2.5 rage clavaba 96.20% —
                # las fences entregaban ~99.7% del av implícito incluso con
                # 250k sims (estructural, no de pool). 1/2.3 enriquece las
                # bandas altas ~9% para que el optimizer alcance 96.50.
                # Rules del frontend actualizadas (≈1 de cada 2.3).
                "rage_mode": 1 / 2.3,
            },
        }

        # ── Buy bonus mode parameters ─────────────────────────────────────
        self.buy_modes = {
            "vault_crack": {"cost": 100.0, "spins": 10},
            "smash_mode": {"cost": 250.0, "spins": 10},
            "rage_mode": {"cost": 500.0, "spins": 10},
        }

        # ── Reels ──────────────────────────────────────────────────────────
        reels = {"BR0": "BR0.csv", "FR0": "FR0.csv", "WCAP": "WCAP.csv"}
        self.reels = {}
        for r, f in reels.items():
            self.reels[r] = self.read_reels_csv(os.path.join(self.reels_path, f))

        mode_maxwins = {
            "base": self.wincap,
            "vault_crack": self.wincap,
            "smash_mode": self.wincap,
            "rage_mode": self.wincap,
        }

        # ── BetModes ───────────────────────────────────────────────────────
        self.bet_modes = [
            # ─── BASE ───
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=mode_maxwins["base"],
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=mode_maxwins["base"],
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1, "WCAP": 5},
                            },
                            "scatter_triggers": {4: 1, 5: 2, 6: 1},
                            "force_wincap": True,
                            "force_freegame": True,
                        },
                    ),
                    # NOTA KRE: acá KS1 tenía una SEGUNDA Distribution con
                    # criteria="freegame" (fix del check 40, force_win_range
                    # 1000-4999x). Con el criteria duplicado, el SDK matchea la
                    # primera por nombre y una re-sim rompe la math en silencio
                    # (dead-heat/04-technical-gotchas.md y rejection log N3.7).
                    # ELIMINADA en el fork: la math de KRE se simula de cero.
                    # Si el check 40 del ACP muestra la banda 1000-4999x vacía,
                    # reintroducirla con criteria PROPIO ("freegame_forced") y
                    # su condition correspondiente en game_optimization.py.
                    #
                    # KASH RAMPAGE en base: books forzados, criteria PROPIO
                    # (¡nunca duplicar el nombre de otra Distribution! —
                    # iter 2 del 29-07 lo etiquetó "basegame" y el SDK matcheó
                    # esta Distribution para TODOS los books basegame → 100%
                    # con rampage, exactamente la trampa N3.7). La fence
                    # "rampage" del optimizer los reclama por RANGO
                    # (20-499.9); los de payout ≥500 van a "big" y los <20 al
                    # catch-all basegame (pocos y moderados).
                    Distribution(
                        criteria="rampage",
                        quota=0.03,
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1},
                            },
                            "scatter_triggers": {4: 5, 5: 2, 6: 1},
                            "force_wincap": False,
                            "force_freegame": False,
                            "force_rampage": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame",
                        quota=0.1,
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1},
                            },
                            "scatter_triggers": {4: 5, 5: 2, 6: 1},
                            "force_wincap": False,
                            "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="0",
                        quota=0.4,
                        win_criteria=0.0,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}},
                            "force_wincap": False,
                            "force_freegame": False,
                        },
                    ),
                    Distribution(
                        criteria="basegame",
                        quota=0.498,
                        conditions={
                            "reel_weights": {self.basegame_type: {"BR0": 1}},
                            "force_wincap": False,
                            "force_freegame": False,
                        },
                    ),
                ],
            ),

            # ─── VAULT CRACK (100x) ───
            BetMode(
                name="vault_crack",
                cost=self.buy_modes["vault_crack"]["cost"],
                rtp=self.rtp,
                max_win=mode_maxwins["vault_crack"],
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=mode_maxwins["vault_crack"],
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1, "WCAP": 8},
                            },
                            "scatter_triggers": {4: 1, 5: 2, 6: 1},
                            "force_wincap": True,
                            "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame",
                        quota=0.999,
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1},
                            },
                            "scatter_triggers": {4: 5, 5: 2, 6: 1},
                            "force_wincap": False,
                            "force_freegame": True,
                        },
                    ),
                ],
            ),

            # ─── SMASH MODE (250x) ───
            BetMode(
                name="smash_mode",
                cost=self.buy_modes["smash_mode"]["cost"],
                rtp=self.rtp,
                max_win=mode_maxwins["smash_mode"],
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=mode_maxwins["smash_mode"],
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1, "WCAP": 10},
                            },
                            "scatter_triggers": {4: 1, 5: 2, 6: 1},
                            "force_wincap": True,
                            "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame",
                        quota=0.999,
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1},
                            },
                            "scatter_triggers": {4: 5, 5: 2, 6: 1},
                            "force_wincap": False,
                            "force_freegame": True,
                        },
                    ),
                ],
            ),

            # ─── RAGE MODE (500x) ───
            BetMode(
                name="rage_mode",
                cost=self.buy_modes["rage_mode"]["cost"],
                rtp=self.rtp,
                max_win=mode_maxwins["rage_mode"],
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=[
                    Distribution(
                        criteria="wincap",
                        quota=0.001,
                        win_criteria=mode_maxwins["rage_mode"],
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1, "WCAP": 12},
                            },
                            "scatter_triggers": {4: 1, 5: 2, 6: 1},
                            "force_wincap": True,
                            "force_freegame": True,
                        },
                    ),
                    Distribution(
                        criteria="freegame",
                        quota=0.999,
                        conditions={
                            "reel_weights": {
                                self.basegame_type: {"BR0": 1},
                                self.freegame_type: {"FR0": 1},
                            },
                            "scatter_triggers": {4: 5, 5: 2, 6: 1},
                            "force_wincap": False,
                            "force_freegame": True,
                        },
                    ),
                ],
            ),
        ]

    # ── helpers ────────────────────────────────────────────────────────────
    @staticmethod
    def _build_paytable_10c(per_sym: dict) -> dict:
        """
        Convert {sym: {max_cluster_in_tier: payout}} into the
        ((min,max), sym) -> payout shape Config.convert_range_table expects.

        Forces every payout to a 0.10x increment (RGS requires cents
        divisible by 10). Tier boundaries are derived from sorted sizes,
        starting at 5.
        """
        out = {}
        for sym, tiers in per_sym.items():
            sizes = sorted(tiers.keys())
            prev = 5
            for top in sizes:
                pay = round(tiers[top] * 10) / 10.0
                out[((prev, top), sym)] = pay
                prev = top + 1
        return out
