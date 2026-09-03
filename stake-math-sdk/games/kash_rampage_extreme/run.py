"""Kash Rampage Extreme — entry point. 4 bet modes, 96.5% RTP target (ACP cap 96.70%)."""

from gamestate import GameState
from game_config import GameConfig
from game_optimization import OptimizationSetup
from optimization_program.run_script import OptimizationExecution
from utils.game_analytics.run_analysis import create_stat_sheet
from utils.rgs_verification import execute_all_tests
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs

if __name__ == "__main__":

    num_threads = 10
    rust_threads = 20
    batching_size = 1000
    compression = True
    profiling = False

    # KRE (fork de kash_smash, Fase 0): math nueva desde cero — los 4 modos se
    # simulan y optimizan acá (no hay books heredados; library/ no se copió).
    # El criteria "freegame" duplicado del check-40 de KS1 fue ELIMINADO en el
    # fork (ver nota en game_config.py) — base es re-simulable sin la trampa
    # de N3.7. Lecciones de tamaño de KS1: books a 250k sims ≈ 400 MB por
    # archivo (seguro para el uploader del ACP); 1M sims ≈ 1.6 GB POR ARCHIVO
    # y el uploader los trunca con ERR_MISSING_FILE.
    # Fase 1 (iteración de retune): base 100k (la Distribution "rampage"
    # quota 0.03 + freegame pueblan la fence "big" 500-4999x), buys 50k.
    # Producción (pre-submit): base 100k / buys 250k (~400 MB por book file,
    # seguro para el uploader del ACP; 1M sims ≈ 1.6 GB POR ARCHIVO y el
    # uploader los trunca con ERR_MISSING_FILE).
    # PRODUCCIÓN pre-submit (corrida 26-08): base 100k + buys 250k (~400 MB
    # por book file, seguro para el uploader del ACP). Nota rage: venía en
    # 96.20% por límite del pool de 100k sims (las P por fence están
    # clavadas); el pool de 250k debería cerrar el gap a 96.50 — si persiste,
    # subir prob_per_spin de rage para enriquecer las bandas altas.
    # Backup pre-corrida: library_backup_pre_prod_2608/.
    # Iteración rage 26-08: la corrida completa clavó base/vault/smash en
    # 96.50 pero rage quedó 96.1993 → prob_per_spin 1/2.5 → 1/2.3 y re-sim
    # SOLO rage (los books/LUTs de los otros 3 modos quedan de la corrida).
    num_sim_args = {
        "rage_mode": int(2.5e5),
    }

    run_conditions = {
        "run_sims": True,
        "run_optimization": True,
        "run_analysis": True,
        "run_format_checks": True,
    }
    target_modes = ["rage_mode"]  # iteración 26-08 — restaurar los 4 tras cerrar rage

    config = GameConfig()
    print("=" * 70)
    print(f"  {config.working_name}  ({config.game_id})")
    print(f"  Target RTP: {config.rtp * 100:.2f}%  |  Wincap: {config.wincap}x")
    print(f"  Modes: {', '.join(bm.get_name() for bm in config.bet_modes)}")
    print("=" * 70)

    gamestate = GameState(config)
    if run_conditions["run_optimization"] or run_conditions["run_analysis"]:
        optimization_setup_class = OptimizationSetup(config)

    if run_conditions["run_sims"]:
        create_books(
            gamestate,
            config,
            num_sim_args,
            batching_size,
            num_threads,
            compression,
            profiling,
        )

    generate_configs(gamestate)

    if run_conditions["run_optimization"]:
        OptimizationExecution().run_all_modes(config, target_modes, rust_threads)
        generate_configs(gamestate)

    if run_conditions["run_analysis"]:
        custom_keys = [{"symbol": "scatter"}]
        create_stat_sheet(gamestate, custom_keys=custom_keys)

    if run_conditions["run_format_checks"]:
        execute_all_tests(config)
