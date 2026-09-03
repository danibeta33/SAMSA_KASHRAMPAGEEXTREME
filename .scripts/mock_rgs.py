"""Mock Carrot RGS local — Lucky Bastards Studio.

Sirve los endpoints que el frontend espera, usando los books + LUTs reales
generados por el Math SDK. Permite jugar cualquier juego del studio con el
botón BET real sin necesidad de subir al sandbox de Stake.

Uso:
  .venv/bin/python .scripts/mock_rgs.py                  # default: cluster_tumble_base
  .venv/bin/python .scripts/mock_rgs.py --game kash_smash
  .venv/bin/python .scripts/mock_rgs.py --game my_game --port 3031

Endpoints:
  POST /wallet/authenticate  → balance + config + jurisdiction flags
  POST /wallet/balance       → balance refresh
  POST /wallet/play          → samplea sim_id por weight, devuelve book
  POST /wallet/end-round     → settle (acredita win al balance)
  POST /bet/event            → tracking (no-op)
  GET  /bet/replay/...       → replay (no implementado en mock v1)

Then in the browser:
  ?sessionID=mock&rgs_url=http://127.0.0.1:<PORT>
"""
import argparse
import csv
import io
import json
import random
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import zstandard as zstd

REPO_ROOT = Path(__file__).resolve().parent.parent
# IMPORTANT: must match packages/constants-shared/bet.ts:API_AMOUNT_MULTIPLIER = 1_000_000.
# i.e. raw amount 1_000_000 = $1.00. Off-by-100 here makes the BET range render as
# $0.00..$0.50 in the frontend because betLevels get divided by the SDK constant.
API_AMOUNT_MULTIPLIER = 1_000_000
INITIAL_BALANCE_RAW = 100_000 * API_AMOUNT_MULTIPLIER  # $100,000

WALLET = {"balance": INITIAL_BALANCE_RAW, "currency": "USD"}
# --jurisdiction pone en True los flags listados (p.ej. disabledBuyFeature).
JURISDICTION_OVERRIDES: set = set()

# Bet levels servidos por authenticate. Default: escalera 0.10→100 (10 valores).
# --bet-levels N genera una escalera 1-2-5 de N valores (el RGS real manda
# muchos más de 10 — sirve para reproducir el overflow del bet menu).
BET_CONFIG = {"levels": [], "default": 1_000_000}


def build_bet_levels(count: int) -> list[int]:
    levels, mantissas, exp = [], (1, 2, 5), 5  # arranca en 10^5 = $0.10
    while len(levels) < count:
        for m in mantissas:
            levels.append(m * 10 ** exp)
            if len(levels) == count:
                break
        exp += 1
    return levels
CURRENT_ROUND = {"id": None, "payoutMultiplier": 0, "cost_raw": 0, "settled": True}
# Debug panel: when set, the next /wallet/play forces the sim_id of this tier
# instead of sampling. Auto-reset after one use.
FORCED_TIER: str | None = None
MODES: dict = {}
GAME_ID = ""
LIBRARY: Path = Path()


def load_index():
    with open(LIBRARY / "index.json") as f:
        return json.load(f)


def load_lut(filename):
    out = []
    with open(LIBRARY / filename) as f:
        for row in csv.reader(f):
            if len(row) < 3:
                continue
            out.append((int(row[0]), int(row[1]), int(row[2])))
    return out


def load_books_jsonl_zst(filename, max_books=None, extra_match=None, extra_max=150):
    """Stream-decode books línea a línea (NUNCA materializar el archivo
    descomprimido entero: los books de bonus de kash_smash pesan ~150MB
    comprimidos / varios GB en texto y saturan la RAM). Con max_books se
    corta temprano — para el mock de dev no hacen falta los 100k books;
    el LUT se filtra después a los sim_ids realmente cargados.

    extra_match: si se pasa (p.ej. '"kashRampage"'), pasado el corte de
    max_books se sigue streameando y se juntan hasta extra_max books cuya
    LÍNEA contenga el string (match barato pre-parse). Van en un dict aparte
    — NO entran al LUT, así el sampling natural no se sesga; son el pool del
    tier forzado del debug panel (/debug/arm-next)."""
    dctx = zstd.ZstdDecompressor()
    books = {}
    extra = {}
    with open(LIBRARY / filename, "rb") as f:
        reader = io.TextIOWrapper(dctx.stream_reader(f), encoding="utf-8", errors="replace")
        for line in reader:
            line = line.strip()
            if not line:
                continue
            cut = max_books is not None and len(books) >= max_books
            if cut and (not extra_match or len(extra) >= extra_max):
                break
            if cut:
                if extra_match not in line:
                    continue
                try:
                    book = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if book["id"] not in books:
                    extra[book["id"]] = book
                continue
            try:
                book = json.loads(line)
                books[book["id"]] = book
            except json.JSONDecodeError:
                continue
    return books, extra


def bootstrap(game_id: str, max_books: int | None = None, library: Path | None = None):
    global GAME_ID, LIBRARY, MODES
    GAME_ID = game_id
    LIBRARY = library or REPO_ROOT / "stake-math-sdk" / "games" / game_id / "library" / "publish_files"
    if not LIBRARY.exists():
        raise SystemExit(
            f"\n  Library not found: {LIBRARY}\n"
            f"  Run `cd stake-math-sdk/games/{game_id} && python run.py` first.\n"
        )
    print(f"Loading math artifacts for `{game_id}` from {LIBRARY}")
    index = load_index()
    for mode in index["modes"]:
        name = mode["name"]
        print(f"  loading {name}...")
        lut = load_lut(mode["weights"])
        # Pool de books con kashRampage para el tier forzado 'rampage' (KRE:
        # el batazo en base es raro; el pool garantiza demos con variedad).
        # Solo tiene sentido en base (los bonus lo traen garantizado) y en
        # juegos sin ese evento el match nunca pega (costo: stream completo).
        books, rampage_extra = load_books_jsonl_zst(
            mode["events"],
            max_books=max_books,
            extra_match='"kashRampage"' if name == "base" else None,
        )
        if max_books is not None:
            # Solo se puede samplear lo que está en memoria: recortar el LUT
            # a los sim_ids cargados (los pesos relativos se conservan).
            lut = [row for row in lut if row[0] in books]
        cumweights = []
        total = 0
        for sim_id, w, _payout in lut:
            total += w
            cumweights.append(total)
        # Pre-compute sim_id buckets by payout tier for the debug panel.
        # Each entry of `lut` is (sim_id, weight, payout_x100). We sort by payout
        # and pick the top-1 for MAX and representative samples for BIG/MEDIUM.
        sorted_by_payout = sorted(lut, key=lambda row: -row[2])
        forced_sids = {
            "max": sorted_by_payout[0][0] if sorted_by_payout else None,
            "big": sorted_by_payout[len(sorted_by_payout) // 50][0]
                if len(sorted_by_payout) > 50 else (sorted_by_payout[1][0] if len(sorted_by_payout) > 1 else None),
            "medium": sorted_by_payout[len(sorted_by_payout) // 10][0]
                if len(sorted_by_payout) > 10 else (sorted_by_payout[2][0] if len(sorted_by_payout) > 2 else None),
        }
        rampage_sids = [
            sid
            for sid, b in books.items()
            if any(ev.get("type") == "kashRampage" for ev in b.get("events", []))
        ] + list(rampage_extra)
        MODES[name] = {
            "cost": mode["cost"],
            "lut": lut,
            "cumweights": cumweights,
            "total_weight": total,
            "books": books,
            "forced_sids": forced_sids,
            # Books extra fuera del LUT + sim_ids elegibles para tier 'rampage'.
            "rampage_books": rampage_extra,
            "rampage_sids": rampage_sids,
        }
        top_payout = sorted_by_payout[0][2] if sorted_by_payout else 0
        rampage_note = f" · rampage pool {len(rampage_sids)}" if rampage_sids else ""
        print(f"    {len(lut)} entries · {len(books)} books · Σw={total} · max payout {top_payout/100:.2f}× (sim_id={forced_sids['max']}){rampage_note}")


# Events whose `amount` field is a payout-multiplier (×10 granularity) that must
# be scaled to raw player-currency amounts before reaching the frontend.
_AMOUNT_SCALED_EVENT_TYPES = {
    "setWin",
    "setTotalWin",
    "finalWin",
    "updateTumbleWin",
    "freeSpinEnd",
}


def scale_event_amounts(events: list, bet_raw: int) -> list:
    """The Math SDK emits event amounts in the same granularity the Web SDK
    expects (BOOK_AMOUNT_MULTIPLIER = 100, where 100 = 1× of bet). The
    paytable lowest payout (L1 cluster=5) is 0.6×, math emits amount=60.
    No scaling needed — pass through. Kept as a function to make the contract
    explicit and to centralize any future scaling needs.
    """
    return events


def sample_sim_id(mode_name: str) -> int:
    m = MODES[mode_name]
    r = random.randint(1, m["total_weight"])
    lo, hi = 0, len(m["cumweights"]) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if m["cumweights"][mid] < r:
            lo = mid + 1
        else:
            hi = mid
    return m["lut"][lo][0]


class RGSHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path} → {fmt % args}")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = {}

        path = self.path.split("?")[0]
        if path == "/wallet/authenticate":
            return self._handle_authenticate(body)
        if path == "/wallet/balance":
            return self._handle_balance(body)
        if path == "/wallet/play":
            return self._handle_play(body)
        if path == "/wallet/end-round":
            return self._handle_end_round(body)
        if path == "/bet/event":
            return self._json(200, {"status": {"info": "ok"}})
        if path == "/debug/arm-next":
            return self._handle_arm_next(body)
        return self._json(404, {"error": {"message": "not found", "code": "ERR_NOT_FOUND"}})

    def _handle_arm_next(self, body):
        global FORCED_TIER
        tier = (body.get("tier") or "").lower()
        if tier not in ("max", "big", "medium", "rampage", "none", ""):
            return self._json(400, {"error": {"message": f"invalid tier {tier!r}"}})
        FORCED_TIER = tier if tier in ("max", "big", "medium", "rampage") else None
        return self._json(200, {"armed": FORCED_TIER, "status": {"info": "ok"}})

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/bet/replay/"):
            return self._handle_replay(path)
        if path == "/health":
            return self._json(200, {"ok": True, "game": GAME_ID, "modes": list(MODES.keys())})
        return self._json(404, {"error": {"message": "not found"}})

    def _handle_replay(self, path: str):
        # /bet/replay/{game}/{version}/{mode}/{event}
        parts = path.split("/")
        # parts = ["", "bet", "replay", game, version, mode, event]
        if len(parts) < 7:
            return self._json(400, {"error": {"message": "bad replay path"}})
        _, _, _, game, _version, mode_raw, event_str = parts[:7]
        mode = mode_raw.lower()
        if mode not in MODES:
            return self._json(404, {"error": {"message": f"mode {mode_raw!r} not found"}})
        try:
            sim_id = int(event_str)
        except ValueError:
            return self._json(400, {"error": {"message": f"bad event_id {event_str!r}"}})
        book = MODES[mode]["books"].get(sim_id)
        if book is None:
            return self._json(404, {"error": {"message": f"book {sim_id} not found in {mode}"}})

        # Parse bet amount from query (the SDK passes ?amount=... in the same URL).
        # default to $1 if absent.
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(self.path).query)
        try:
            bet_amount = int(qs.get("amount", ["1000000"])[0])
        except ValueError:
            bet_amount = 1_000_000

        events = scale_event_amounts(book.get("events", []), bet_amount)
        payout_mult = book.get("payoutMultiplier", 0)
        # Response shape: { state: [events], round: {...} } — the SDK spreads
        # this into stateBet.betToResume. The play handler returns nested
        # `round.state`; replay returns the same shape for symmetry.
        self._json(200, {
            "status": {"info": "ok"},
            "round": {
                "id": sim_id,
                "payoutMultiplier": payout_mult,
                "costMultiplier": MODES[mode]["cost"],
                "state": events,
            },
            "state": events,
            "amount": bet_amount,
            "game": game,
        })

    def _handle_authenticate(self, body):
        bet_modes = {
            name.upper(): {"cost": m["cost"], "rtp": 0.97, "max_win": 5000.0}
            for name, m in MODES.items()
        }
        if "BASE" not in bet_modes and MODES:
            first = list(MODES.keys())[0]
            bet_modes["BASE"] = bet_modes.pop(first.upper())

        self._json(200, {
            "status": {"info": "ok"},
            "balance": {"amount": WALLET["balance"], "currency": WALLET["currency"]},
            "round": None,
            "config": {
                "gameID": GAME_ID,
                "providerName": "Lucky Bastards Studio",
                # raw amounts (1_000_000 = $1.00). En producción los betLevels
                # los define Stake vía el RGS real (y son MUCHOS más que 10 —
                # feedback N2: el bet menu debe bancarse la lista completa).
                # Configurable con --bet-levels / --default-bet.
                "betLevels": BET_CONFIG["levels"],
                "defaultBetLevel": BET_CONFIG["default"],
                "minBet":  BET_CONFIG["levels"][0],
                "maxBet":  BET_CONFIG["levels"][-1],
                "stepBet": BET_CONFIG["levels"][0],
                "betModes": bet_modes,
                "jurisdiction": {
                    "socialCasino": False,
                    "disabledFullscreen": False,
                    "disabledTurbo": False,
                    "disabledSuperTurbo": False,
                    "disabledAutoplay": False,
                    "disabledSlamstop": False,
                    "disabledSpacebar": False,
                    "disabledBuyFeature": False,
                    "displayNetPosition": False,
                    "displayRTP": False,
                    "displaySessionTimer": False,
                    "minimumRoundDuration": 0,
                    **{flag: True for flag in JURISDICTION_OVERRIDES},
                },
            },
            "resumableBets": [],
        })

    def _handle_balance(self, body):
        self._json(200, {
            "status": {"info": "ok"},
            "balance": {"amount": WALLET["balance"], "currency": WALLET["currency"]},
        })

    def _handle_play(self, body):
        amount = int(body.get("amount", 0))
        mode_raw = (body.get("mode") or "base")
        mode = mode_raw.lower()
        if mode not in MODES:
            return self._json(400, {"error": {"code": "ERR_VAL", "message": f"unknown mode {mode_raw}"}})

        cost_raw = int(amount * MODES[mode]["cost"])
        if WALLET["balance"] < cost_raw:
            return self._json(400, {"error": {"code": "ERR_IPB", "message": "insufficient balance"}})

        WALLET["balance"] -= cost_raw

        global FORCED_TIER
        if FORCED_TIER == "rampage" and MODES[mode].get("rampage_sids"):
            # Random del pool → cada tirada forzada de bateo es distinta.
            sim_id = random.choice(MODES[mode]["rampage_sids"])
            print(f"  FORCED play: tier=rampage mode={mode} sim_id={sim_id} (pool {len(MODES[mode]['rampage_sids'])})")
            FORCED_TIER = None  # one-shot
        elif FORCED_TIER and FORCED_TIER in MODES[mode].get("forced_sids", {}) and MODES[mode]["forced_sids"][FORCED_TIER] is not None:
            sim_id = MODES[mode]["forced_sids"][FORCED_TIER]
            print(f"  FORCED play: tier={FORCED_TIER} mode={mode} sim_id={sim_id}")
            FORCED_TIER = None  # one-shot
        else:
            sim_id = sample_sim_id(mode)
        book = MODES[mode]["books"].get(sim_id) or MODES[mode].get("rampage_books", {}).get(sim_id)
        if book is None:
            return self._json(500, {"error": {"code": "ERR_GEN", "message": f"missing book {sim_id}"}})

        payout_mult = book.get("payoutMultiplier", 0)

        CURRENT_ROUND["id"] = sim_id
        CURRENT_ROUND["payoutMultiplier"] = payout_mult
        CURRENT_ROUND["cost_raw"] = cost_raw
        CURRENT_ROUND["amount_raw"] = amount
        CURRENT_ROUND["mode"] = mode
        CURRENT_ROUND["settled"] = False

        # Math SDK emits `amount` in (multiplier × 10) units (0.1x granularity).
        # The frontend expects raw amounts (1_000_000 = $1). Scale here so the
        # SDK's `bookEventAmountToCurrencyString` renders the right value.
        # Formula: raw_amount = bet × (event_amount / 10) = bet × event_amount / 10
        events = scale_event_amounts(book.get("events", []), amount)

        self._json(200, {
            "status": {"info": "ok"},
            "balance": {"amount": WALLET["balance"], "currency": WALLET["currency"]},
            "round": {
                "id": sim_id,
                "payoutMultiplier": payout_mult,
                "costMultiplier": MODES[mode]["cost"],
                "state": events,
            },
        })

    def _handle_end_round(self, body):
        if CURRENT_ROUND["settled"]:
            return self._json(200, {
                "status": {"info": "already-settled"},
                "balance": {"amount": WALLET["balance"], "currency": WALLET["currency"]},
            })
        # payoutMultiplier is in BOOK_AMOUNT_MULTIPLIER granularity (100 = 1× bet).
        # win_raw = bet × payoutMultiplier / 100
        win_raw = (CURRENT_ROUND["amount_raw"] * CURRENT_ROUND["payoutMultiplier"]) // 100
        WALLET["balance"] += win_raw
        CURRENT_ROUND["settled"] = True
        self._json(200, {
            "status": {"info": "ok"},
            "balance": {"amount": WALLET["balance"], "currency": WALLET["currency"]},
        })


def main():
    parser = argparse.ArgumentParser(description="Mock Carrot RGS for Lucky Bastards Studio games.")
    parser.add_argument("--game", default="cluster_tumble_base", help="Game folder name in stake-math-sdk/games/")
    parser.add_argument(
        "--library",
        default="",
        help="Path directo a un publish_files/ (override del layout stake-math-sdk/games/<game>). "
             "Sirve para paquetes de terceros que no viven en el math SDK del studio.",
    )
    parser.add_argument("--port", type=int, default=3030, help="HTTP port (default 3030)")
    parser.add_argument("--currency", default="USD", help="Currency code servida en balance (USD, EUR, JPY, XGC...)")
    parser.add_argument(
        "--jurisdiction",
        default="",
        help="Flags de jurisdiccion a activar, separados por coma (p.ej. disabledBuyFeature,disabledTurbo)",
    )
    parser.add_argument(
        "--max-books",
        type=int,
        default=4000,
        help="Books cargados por modo (0 = todos; default 4000 — los books completos de kash_smash no caben cómodos en RAM)",
    )
    parser.add_argument("--bet-levels", type=int, default=10, help="Cantidad de bet levels en authenticate (escalera 1-2-5 desde $0.10)")
    parser.add_argument("--default-bet", type=int, default=1_000_000, help="defaultBetLevel raw (1_000_000 = $1.00)")
    args = parser.parse_args()

    BET_CONFIG["levels"] = build_bet_levels(args.bet_levels)
    BET_CONFIG["default"] = args.default_bet
    WALLET["currency"] = args.currency
    if args.jurisdiction:
        JURISDICTION_OVERRIDES.update(f.strip() for f in args.jurisdiction.split(",") if f.strip())
    bootstrap(args.game, max_books=args.max_books or None,
              library=Path(args.library).expanduser() if args.library else None)

    # Bind 0.0.0.0 so the mock is reachable from other machines on the LAN.
    # The frontend running on another PC must use this Mac's LAN IP in rgs_url.
    server = ThreadingHTTPServer(("0.0.0.0", args.port), RGSHandler)
    print(f"\n  Mock Carrot RGS — game=`{GAME_ID}` listening on http://127.0.0.1:{args.port}")
    print(f"  Open the game with: ?sessionID=mock&rgs_url=http://127.0.0.1:{args.port}")
    print(f"  Modes:   {list(MODES.keys())}")
    print(f"  Balance: {WALLET['balance']:,} {WALLET['currency']}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
