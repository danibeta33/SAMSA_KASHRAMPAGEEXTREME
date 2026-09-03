"""Cluster evaluation with tumble_mult x persistent_mult scoring."""

from src.executables.executables import Executables
from src.calculations.cluster import Cluster
from src.calculations.board import Board
from src.config.config import Config


class GameCalculations(Executables):
    """Custom cluster eval for the tumble template."""

    def evaluate_clusters_tumble(
        self,
        config: Config,
        board: Board,
        clusters: dict,
        tumble_mult: int,
        persistent_mult: int,
        return_data: dict = None,
    ):
        """
        Score each paying cluster as: sym_pay x tumble_mult x persistent_mult.

        tumble_mult     escalates within a single spin per successful tumble.
        persistent_mult carries across free spins when enabled (else 1).

        Meta includes globalMult/clusterMult aliases — without them, the SDK's
        Cluster.record_cluster_wins crashes with KeyError.
        """
        if return_data is None:
            return_data = {"totalWin": 0, "wins": []}

        exploding_symbols = []
        total_win = 0
        for sym in clusters:
            for cluster in clusters[sym]:
                size = len(cluster)
                if (size, sym) not in config.paytable:
                    continue
                sym_win = config.paytable[(size, sym)]
                symwin_mult = sym_win * tumble_mult * persistent_mult
                total_win += symwin_mult
                json_positions = [{"reel": p[0], "row": p[1]} for p in cluster]
                central_pos = Cluster.get_central_cluster_position(json_positions)
                return_data["wins"].append({
                    "symbol": sym,
                    "clusterSize": size,
                    "win": symwin_mult,
                    "positions": json_positions,
                    "meta": {
                        "tumbleMult": tumble_mult,
                        "persistentMult": persistent_mult,
                        "globalMult": tumble_mult * persistent_mult,
                        "clusterMult": 1,
                        "winWithoutMult": sym_win,
                        "overlay": {"reel": central_pos[0], "row": central_pos[1]},
                    },
                })
                for positions in cluster:
                    board[positions[0]][positions[1]].explode = True
                    cell = {"reel": positions[0], "row": positions[1]}
                    if cell not in exploding_symbols:
                        exploding_symbols.append(cell)

        return_data["totalWin"] += total_win
        return board, return_data
