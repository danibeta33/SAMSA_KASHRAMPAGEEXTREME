"""Custom book events for Kash Rampage Extreme."""

APPLY_TUMBLE_MULT = "applyTumbleMult"
KASH_RAMPAGE = "kashRampage"


def apply_tumble_mult_event(gamestate, value: int):
    gamestate.book.add_event({
        "index": len(gamestate.book.events),
        "type": APPLY_TUMBLE_MULT,
        "tumbleMult": int(value),
    })


def _row_offset(gamestate) -> int:
    # Positions must line up with the padded board of the reveal event,
    # same as fs_trigger/win_info/tumble events (src/events/events.py).
    return 1 if gamestate.config.include_padding else 0


def kash_rampage_event(gamestate, conversions, global_symbol=None):
    """KASH RAMPAGE: Kash batea el tablero y convierte los Low/Mid a High/Premium.

    `conversions` = [(reel, row, from_sym, to_sym)] en coordenadas RAW del
    board (el offset de padding se aplica ACÁ — contrato N3). El evento se
    emite SIEMPRE después del reveal: el board serializado en el reveal ya
    contiene las conversiones; este evento alimenta los 5 beats del cliente:
      Windup/Impact (sin data) → Conversion Wave (recorre `conversions`, que
      salen ordenadas reel→row para una wave izquierda→derecha determinística)
      → Premium Accent (filtra premium=true) → Settle.
    `global_symbol` solo con scope "global_symbol" (toda la grilla al mismo
    símbolo) — callout del cliente.
    """
    off = _row_offset(gamestate)
    ordered = sorted(conversions, key=lambda x: (x[0], x[1]))
    gamestate.book.add_event({
        "index": len(gamestate.book.events),
        "type": KASH_RAMPAGE,
        "conversions": [
            {
                "reel": int(c),
                "row": int(r) + off,
                "from": str(f),
                "to": str(t),
                "premium": t == gamestate.config.rampage["premium_symbol"],
            }
            for (c, r, f, t) in ordered
        ],
        "globalSymbol": global_symbol,
    })
