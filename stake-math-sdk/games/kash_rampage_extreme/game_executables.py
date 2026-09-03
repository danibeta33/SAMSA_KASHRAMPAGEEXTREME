"""Executables for Kash Rampage Extreme — tumble mult y KASH RAMPAGE.

Sin persistent multiplier (el SMASH Meter de KS1 se eliminó) y sin las
mecánicas de wilds de KS1 (apply_kash_smash / force_wild_on_grid).
"""

import random

from game_calculations import GameCalculations
from src.calculations.cluster import Cluster
from src.events.events import update_freespin_event
from game_events import apply_tumble_mult_event, kash_rampage_event


class GameExecutables(GameCalculations):

    # ── tumble multiplier (resets each spin) ───────────────────────────────
    def reset_tumble_mult(self):
        self.tumble_mult_idx = 0

    def current_tumble_mult(self) -> int:
        prog = self.config.tumble_mult_progression
        return prog[min(self.tumble_mult_idx, len(prog) - 1)]

    def advance_tumble_mult(self):
        self.tumble_mult_idx += 1
        apply_tumble_mult_event(self, self.current_tumble_mult())

    # ── KASH RAMPAGE (mecánica de firma) ───────────────────────────────────
    def apply_kash_rampage(self, emit_event: bool = True):
        """Kash batea el tablero: convierte TODAS las celdas convertibles
        (L1-L4/M1-M2; nunca S ni W) a un High (H1-H3 ponderado) o al Premium
        (H4) según premium_chance.

        scope "per_cell": cada celda elige destino i.i.d.
        scope "global_symbol": un único High destino para toda la grilla
        (cada celda igual puede salir Premium con premium_chance).

        Devuelve (conversions, global_symbol) — conversions en coordenadas RAW
        [(reel, row, from, to)] — o (None, None) si no había nada convertible.
        El caller emite el evento DESPUÉS del reveal (contrato N3: el reveal
        serializado ya contiene el board convertido).
        """
        cfg = self.config.rampage
        convertible = cfg["convertible"]
        weights_map = cfg["high_weights"]
        highs = list(weights_map.keys())
        weights = list(weights_map.values())
        premium = cfg["premium_symbol"]
        p_prem = cfg["premium_chance"]

        cells = [
            (c, r)
            for c in range(self.config.num_reels)
            for r in range(self.config.num_rows[c])
            if self.board[c][r].name in convertible
        ]
        if not cells:
            return None, None

        global_symbol = None
        if cfg["scope"] == "global_symbol":
            global_symbol = random.choices(highs, weights=weights, k=1)[0]

        conversions = []
        for c, r in cells:
            from_sym = self.board[c][r].name
            if random.random() < p_prem:
                to_sym = premium
            elif global_symbol is not None:
                to_sym = global_symbol
            else:
                to_sym = random.choices(highs, weights=weights, k=1)[0]
            self.board[c][r] = self.create_symbol(to_sym)
            conversions.append((c, r, from_sym, to_sym))

        self._rebuild_special_syms_cache()
        if emit_event:
            kash_rampage_event(self, conversions, global_symbol)
        return conversions, global_symbol

    def _rebuild_special_syms_cache(self):
        """Re-scan board after symbol conversion so special_syms_on_board is fresh."""
        self.special_syms_on_board = {k: [] for k in self.config.special_symbols}
        for c in range(self.config.num_reels):
            for r in range(self.config.num_rows[c]):
                sym = self.board[c][r]
                for kind, names in self.config.special_symbols.items():
                    if sym.name in names:
                        self.special_syms_on_board[kind].append({"reel": c, "row": r})

    # ── cluster eval entrypoint ────────────────────────────────────────────
    def get_clusters_update_wins(self):
        """Find clusters, score with the tumble multiplier, push wins.

        persistent_mult va SIEMPRE en 1: KRE no tiene multiplicador
        persistente, pero el shape del meta (persistentMult/globalMult) es
        obligatorio para Cluster.record_cluster_wins — por eso el parámetro
        sigue existiendo en evaluate_clusters_tumble.
        """
        clusters = Cluster.get_clusters(self.board, "wild")
        tumble_mult = self.current_tumble_mult()

        return_data = {"totalWin": 0, "wins": []}
        self.board, self.win_data = self.evaluate_clusters_tumble(
            config=self.config,
            board=self.board,
            clusters=clusters,
            tumble_mult=tumble_mult,
            persistent_mult=1,
            return_data=return_data,
        )

        Cluster.record_cluster_wins(self)
        self.win_manager.update_spinwin(self.win_data["totalWin"])
        self.win_manager.tumble_win = self.win_data["totalWin"]

    def update_freespin(self) -> None:
        """Called before each free spin reveal — reset tumble mult."""
        self.fs += 1
        update_freespin_event(self)
        self.win_manager.reset_spin_win()
        self.win_data = {}
        self.reset_tumble_mult()
