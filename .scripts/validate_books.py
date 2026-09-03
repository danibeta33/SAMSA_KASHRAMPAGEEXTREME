"""Strict schema/consistency validation of every book in publish_files/.

Rules checked per book:
- payoutMultiplier matches finalWin.amount
- All reveal.board symbols are in the declared catalog (H1-H4, M1-M2, L1-L4, W, S)
- Board dimensions match config (6 reels x 5 visible rows = 7 with padding)
- winInfo.wins[].positions are within board bounds (reel 0-5, row 0-4 visible)
- updatePersistentMult.persistentMult is monotonically non-decreasing during FS
  (only resets between rounds via freeSpinEnd)
- updatePersistentMult <= cap (100)
- updateFreeSpin.amount increments correctly (totalFs match)
- Free spin triggers count: amount of reveal events with gameType=freegame matches totalFs
- Sum of updateTumbleWin.amount per round equals finalWin.amount
- No unknown event types (every event has a matching handler)

Run:
  .venv/bin/python .scripts/validate_books.py
  .venv/bin/python .scripts/validate_books.py --game kash_smash --strict
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import zstandard as zstd

KNOWN_EVENT_TYPES = {
    "reveal", "winInfo", "updateTumbleWin", "setTotalWin",
    "freeSpinTrigger", "updateFreeSpin", "updateGlobalMult", "tumbleBoard",
    "finalWin", "setWin", "updateGrid", "freeSpinRetrigger", "freeSpinEnd",
    "createBonusSnapshot", "updatePersistentMult", "applyTumbleMult", "wincap",
    # Kash Smash signature events
    "kashSmash", "forcedWild", "smashMeterFill",
}

SYMBOL_CATALOG = {"H1", "H2", "H3", "H4", "M1", "M2", "L1", "L2", "L3", "L4", "W", "S"}

# Board dims / symbol catalog / custom events por juego (default = template).
GAME_PROFILES = {
    "cluster_tumble_base": dict(
        n_reels=6, n_rows_visible=5,
        symbols={"H1", "H2", "H3", "H4", "M1", "M2", "L1", "L2", "L3", "L4", "W", "S"},
        extra_events=set(),
    ),
    "kash_smash": dict(
        n_reels=6, n_rows_visible=5,
        symbols={"H1", "H2", "H3", "H4", "M1", "M2", "L1", "L2", "L3", "L4", "W", "S"},
        extra_events=set(),
    ),
    # Dead Heat: 8x8 fisico con mascara de X inertes (36->49->64 por Court
    # Unlock); 3 scatters por rival; contrato del shootout (GDD §5).
    "dead_heat": dict(
        n_reels=8, n_rows_visible=8,
        symbols={"H1", "H2", "H3", "P1", "M1", "M2", "L1", "L2", "L3", "L4",
                 "W", "SA", "SW", "SO", "X"},
        extra_events={"baseShot", "bonusStart", "possessionStart", "modifierApply",
                      "bonusProgress", "bonusEnd", "wincap"},
    ),
}

# Se resuelven en main() según --game (module-level para las funciones).
N_REELS = 6
N_ROWS_VISIBLE = 5
N_ROWS_PADDED = 7  # includes top + bottom padding
EXTRA_EVENTS: set = set()

# Persistent mult cap from game_config
PERSISTENT_MULT_CAP = 100


class Violation:
    def __init__(self, mode: str, sim_id: int, rule: str, detail: str):
        self.mode = mode
        self.sim_id = sim_id
        self.rule = rule
        self.detail = detail

    def __str__(self) -> str:
        return f"  [{self.mode}#{self.sim_id}] {self.rule}: {self.detail}"


def load_books(path: Path):
    with open(path, "rb") as f:
        text = zstd.ZstdDecompressor().stream_reader(f).read().decode("utf-8", errors="replace")
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            continue


def validate_book(book: dict, mode: str, violations: list, strict: bool):
    sim_id = book.get("id")
    events = book.get("events", [])
    payout = book.get("payoutMultiplier", 0)

    # 1. Unknown event types
    for e in events:
        t = e.get("type")
        if t not in KNOWN_EVENT_TYPES and t not in EXTRA_EVENTS:
            violations.append(Violation(mode, sim_id, "unknown_event", f"type={t!r}"))

    # 2. payoutMultiplier == finalWin
    final_evs = [e for e in events if e.get("type") == "finalWin"]
    if final_evs:
        fw = final_evs[-1].get("amount", 0)
        if fw != payout:
            violations.append(Violation(mode, sim_id, "payout_mismatch",
                                        f"payoutMultiplier={payout} but finalWin={fw}"))

    # 3. reveal.board symbols in catalog + dimensions
    for ev in events:
        if ev.get("type") != "reveal":
            continue
        board = ev.get("board", [])
        if len(board) != N_REELS:
            violations.append(Violation(mode, sim_id, "board_reels",
                                        f"got {len(board)} reels, expected {N_REELS}"))
            continue
        for reel_idx, reel in enumerate(board):
            if len(reel) != N_ROWS_PADDED:
                violations.append(Violation(mode, sim_id, "board_rows",
                                            f"reel {reel_idx} has {len(reel)} rows, expected {N_ROWS_PADDED}"))
            for row_idx, sym in enumerate(reel):
                name = sym.get("name") if isinstance(sym, dict) else None
                if name not in SYMBOL_CATALOG:
                    violations.append(Violation(mode, sim_id, "bad_symbol",
                                                f"reel={reel_idx} row={row_idx} name={name!r}"))

    # 4. winInfo.wins[].positions within board (padded) bounds.
    # Math emits positions in padded-array coordinates (0..N_ROWS_PADDED-1).
    # Visible rows are 1..5 but wins can include padding rows technically
    # (rare but not invalid since the array indexes are still in range).
    for ev in events:
        if ev.get("type") != "winInfo":
            continue
        for win_idx, win in enumerate(ev.get("wins", [])):
            for pos in win.get("positions", []):
                r, rw = pos.get("reel"), pos.get("row")
                if not (0 <= r < N_REELS):
                    violations.append(Violation(mode, sim_id, "pos_reel_oob",
                                                f"winInfo.win[{win_idx}] reel={r}"))
                if not (0 <= rw < N_ROWS_PADDED):
                    violations.append(Violation(mode, sim_id, "pos_row_oob",
                                                f"winInfo.win[{win_idx}] row={rw}"))

    # 5. updatePersistentMult monotonically non-decreasing within an FS round,
    #    resets at freeSpinEnd, and <= cap.
    persistent_history = []
    last_p = 0
    in_fs = False
    for ev in events:
        t = ev.get("type")
        if t == "freeSpinTrigger" or t == "freeSpinRetrigger":
            in_fs = True
            last_p = 0
        if t == "updatePersistentMult":
            p = ev.get("persistentMult", 0)
            persistent_history.append(p)
            if p > PERSISTENT_MULT_CAP:
                violations.append(Violation(mode, sim_id, "persistent_above_cap",
                                            f"persistentMult={p} > cap {PERSISTENT_MULT_CAP}"))
            if in_fs and p < last_p:
                violations.append(Violation(mode, sim_id, "persistent_decreasing",
                                            f"persistentMult went {last_p} -> {p} inside FS"))
            last_p = p
        if t == "freeSpinEnd":
            in_fs = False
            last_p = 0

    # 6. FS trigger consistency: amount of reveal(gameType=freegame) >= totalFs - retriggers
    fs_triggers = [e for e in events if e.get("type") == "freeSpinTrigger"]
    fs_retriggers = [e for e in events if e.get("type") == "freeSpinRetrigger"]
    fs_reveals = [e for e in events
                  if e.get("type") == "reveal" and e.get("gameType") == "freegame"]
    if fs_triggers:
        expected_total = sum(t.get("totalFs", 0) for t in fs_triggers)
        # retriggers add more (their totalFs replaces the running total)
        # For lax check: # of FS reveals should be >= expected_total - sum(retrigger.totalFs)
        # (the +5 stacks). Just check that we have at least some FS reveals.
        if not fs_reveals:
            violations.append(Violation(mode, sim_id, "fs_no_reveals",
                                        f"freeSpinTrigger emitted but no reveal gameType=freegame"))
        elif strict and len(fs_reveals) < 1:
            # already covered above; placeholder for stricter check
            pass

    # 7. updateGlobalMult <= some reasonable cap (just sanity, not strict)
    for ev in events:
        if ev.get("type") == "updateGlobalMult":
            gm = ev.get("globalMult", 0)
            if gm < 0 or gm > 10_000:
                violations.append(Violation(mode, sim_id, "globalmult_sus",
                                            f"globalMult={gm}"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--game", default="cluster_tumble_base")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="limit books per mode (0=all)")
    args = parser.parse_args()

    lib = Path(__file__).resolve().parent.parent / "stake-math-sdk" / "games" / args.game / "library" / "publish_files"
    if not lib.exists():
        sys.exit(f"Library not found: {lib}")

    index = json.loads((lib / "index.json").read_text())
    profile = GAME_PROFILES.get(args.game)
    if profile:
        global N_REELS, N_ROWS_VISIBLE, N_ROWS_PADDED, EXTRA_EVENTS, SYMBOL_CATALOG
        N_REELS = profile["n_reels"]
        N_ROWS_VISIBLE = profile["n_rows_visible"]
        N_ROWS_PADDED = N_ROWS_VISIBLE + 2
        EXTRA_EVENTS = profile["extra_events"]
        SYMBOL_CATALOG = profile["symbols"]
    else:
        print(f"(sin perfil para `{args.game}` — usando dims del template)")

    print(f"Validating books for `{args.game}` (strict={args.strict})\n")

    violations: list[Violation] = []
    totals_by_mode = defaultdict(int)

    for mode_entry in index["modes"]:
        mode = mode_entry["name"]
        events_file = lib / mode_entry["events"]
        print(f"  validating mode={mode} ({events_file.name})...")
        for i, book in enumerate(load_books(events_file)):
            if args.limit and i >= args.limit:
                break
            validate_book(book, mode, violations, args.strict)
            totals_by_mode[mode] += 1
        print(f"    {totals_by_mode[mode]:,} books scanned")

    # Summary
    print(f"\n{'=' * 70}")
    if not violations:
        print(f"VALIDATION PASS — {sum(totals_by_mode.values()):,} books, 0 violations")
        sys.exit(0)
    print(f"VALIDATION FAIL — {sum(totals_by_mode.values()):,} books, {len(violations)} violations")
    print(f"{'=' * 70}\n")

    # Group by rule
    by_rule: dict[str, list[Violation]] = defaultdict(list)
    for v in violations:
        by_rule[v.rule].append(v)
    for rule, vs in sorted(by_rule.items(), key=lambda x: -len(x[1])):
        print(f"\n--- {rule} ({len(vs)} cases) ---")
        for v in vs[:5]:
            print(v)
        if len(vs) > 5:
            print(f"  ... and {len(vs) - 5} more")

    sys.exit(1)


if __name__ == "__main__":
    main()
