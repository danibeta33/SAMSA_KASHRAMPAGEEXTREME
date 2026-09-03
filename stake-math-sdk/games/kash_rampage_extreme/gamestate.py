"""
Spin orchestration for Kash Rampage Extreme.

Routes per bet mode:
  base         juego base natural; FS via 4+ scatters. KASH RAMPAGE solo en
               books criteria="rampage" (force_rampage en las conditions de la
               Distribution — la probabilidad efectiva la fija el peso de la
               fence en el optimizer, igual que freegame).
  vault_crack  buy mode, 10 spins. Rampage con roll por spin (prob_per_spin).
  smash_mode   buy mode, 10 spins. Ídem, prob más alta.
  rage_mode    buy mode, 10 spins. Ídem, prob más alta.

KASH RAMPAGE (contrato N3, igual que el fix del rechazo de KS1): el board se
muta ANTES de serializar el reveal; el evento kashRampage sale DESPUÉS del
reveal para la animación del cliente. Sin persistent multiplier (KRE no tiene
SMASH Meter) y sin las mecánicas de wilds de KS1.
"""

import random

from game_override import GameStateOverride
from game_events import kash_rampage_event
from src.events.events import reveal_event, fs_trigger_event


class GameState(GameStateOverride):

    # ── ENTRY POINT ────────────────────────────────────────────────────────
    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            mode_name = self.betmode

            if mode_name in self.config.buy_modes:
                self._play_buy_bonus(mode_name)
            else:
                self._play_base_game()
                if self.check_fs_condition() and self.check_freespin_entry():
                    self.run_freespin_from_base()

            self.evaluate_finalwin()
            self.check_repeat()

        self.imprint_wins()

    # ── helpers ────────────────────────────────────────────────────────────
    def _draw_with_rampage(self, do_rampage: bool):
        """draw_board sin emitir + rampage opcional + reveal + evento.

        Orden N3: mutación ANTES del reveal serializado; el evento kashRampage
        (posiciones paddeadas) va después del reveal para los 5 beats del
        cliente.
        """
        self.draw_board(emit_event=False)

        conversions, global_symbol = (None, None)
        if do_rampage:
            conversions, global_symbol = self.apply_kash_rampage(emit_event=False)

        reveal_event(self)
        if conversions:
            kash_rampage_event(self, conversions, global_symbol)

    def _rampage_roll(self, prob: float) -> bool:
        return prob > 0 and random.random() < prob

    # ── BASE GAME ──────────────────────────────────────────────────────────
    def _play_base_game(self):
        self.reset_tumble_mult()
        # En base el rampage NO es un roll natural: lo fuerza la Distribution
        # criteria="rampage" (conditions["force_rampage"]) y su frecuencia
        # real la deciden los pesos de la fence "rampage" en el optimizer.
        force_rampage = self.get_current_distribution_conditions().get(
            "force_rampage", False
        )
        self._draw_with_rampage(force_rampage)

        self.get_clusters_update_wins()
        self.emit_tumble_win_events()

        while self.win_data["totalWin"] > 0 and not self.wincap_triggered:
            self.tumble_game_board()
            self.advance_tumble_mult()
            self.get_clusters_update_wins()
            self.emit_tumble_win_events()

        self.set_end_tumble_event()
        self.win_manager.update_gametype_wins(self.gametype)

    # ── FREE SPINS (natural trigger from base) ─────────────────────────────
    def run_freespin(self):
        self._run_freespin_inner(
            rampage_prob=self.config.rampage["prob_per_spin"].get("base_freegame", 0.0),
            spins_override=None,
        )

    # ── BUY BONUS MODES ────────────────────────────────────────────────────
    def _play_buy_bonus(self, mode_name: str):
        cfg = self.config.buy_modes[mode_name]
        # Stand up bonus state as if entered from base.
        self.triggered_freegame = True
        self.fs = 0
        self.gametype = self.config.freegame_type
        self.win_manager.reset_spin_win()
        self.tot_fs = cfg["spins"]

        fs_trigger_event(self, basegame_trigger=True, freegame_trigger=False)

        self._run_freespin_inner(
            rampage_prob=self.config.rampage["prob_per_spin"].get(mode_name, 0.0),
            spins_override=cfg["spins"],
        )

    # ── FS INNER LOOP ──────────────────────────────────────────────────────
    def _run_freespin_inner(self, rampage_prob: float, spins_override):
        if spins_override is None:
            self.reset_fs_spin()

        while self.fs < self.tot_fs and not self.wincap_triggered:
            # Red de seguridad: cortar si tot_fs se dispara por retriggers
            # encadenados (ver config.max_total_fs). Evita el loop infinito
            # que colgaba las sims con reels scatter-heavy.
            if self.tot_fs > self.config.max_total_fs:
                self.tot_fs = self.config.max_total_fs
                if self.fs >= self.tot_fs:
                    break
            self.update_freespin()
            # Rampage probabilístico por spin (solo el drop inicial del spin;
            # nunca re-dispara en tumbles).
            self._draw_with_rampage(self._rampage_roll(rampage_prob))

            self.get_clusters_update_wins()
            self.emit_tumble_win_events()

            while self.win_data["totalWin"] > 0 and not self.wincap_triggered:
                self.tumble_game_board()
                self.advance_tumble_mult()
                self.get_clusters_update_wins()
                self.emit_tumble_win_events()

            self.set_end_tumble_event()
            self.win_manager.update_gametype_wins(self.gametype)

            if self.check_fs_condition():
                self.update_fs_retrigger_amt()

        self.end_freespin()
