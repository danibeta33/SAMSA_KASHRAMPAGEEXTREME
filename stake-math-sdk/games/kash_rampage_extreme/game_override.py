"""State overrides for cluster-tumble template."""

from game_executables import GameExecutables
from src.events.events import fs_trigger_event


class GameStateOverride(GameExecutables):

    def update_freespin_amount(self, scatter_key: str = "scatter") -> None:
        # Clamp defensivo del conteo de scatters: las reels cargadas (WCAP,
        # usadas por wincap/bigwin) pueden sacar más scatters que la key
        # máxima del mapa; sin clamp un thread muere con KeyError y toda la
        # corrida de sims queda colgada esperándolo.
        triggers = self.config.freespin_triggers[self.gametype]
        count = min(self.count_special_symbols(scatter_key), max(triggers.keys()))
        self.tot_fs = triggers[count]
        if self.gametype == self.config.basegame_type:
            basegame_trigger, freegame_trigger = True, False
        else:
            basegame_trigger, freegame_trigger = False, True
        fs_trigger_event(self, basegame_trigger=basegame_trigger, freegame_trigger=freegame_trigger)

    def reset_book(self):
        super().reset_book()
        self.tumble_win = 0
        self.tumble_mult_idx = 0
        # Init special-syms cache empty so events that fire BEFORE the first
        # draw_board() (e.g. buy-mode fs_trigger_event) don't AttributeError.
        self.special_syms_on_board = {k: [] for k in self.config.special_symbols}

    def assign_special_sym_function(self):
        # Forks add sticky-wild / multiplier-symbol handlers here.
        pass

    def check_repeat(self) -> None:
        if self.repeat is False:
            win_criteria = self.get_current_betmode_distributions().get_win_criteria()
            if win_criteria is not None and self.final_win != win_criteria:
                self.repeat = True
            if (
                self.get_current_distribution_conditions()["force_freegame"]
                and not self.triggered_freegame
            ):
                self.repeat = True
            if self.win_manager.running_bet_win == 0 and self.criteria != "0":
                self.repeat = True
            # Fix approval check 40: aceptación por RANGO de payout (win_criteria
            # nativo solo soporta igualdad exacta, como el wincap). Se lee de la
            # condición "force_win_range" de la distribución actual — NO del
            # nombre del criterio, para que estos books queden tagueados
            # "freegame" y los reclame esa fence (evita el solape de fences que
            # rompía el optimizer). Llena la banda 1000–4999x del lookup base.
            win_range = self.get_current_distribution_conditions().get("force_win_range")
            if win_range is not None and not (win_range[0] <= self.final_win < win_range[1] + 1):
                self.repeat = True
