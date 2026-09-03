# Kash Rampage Extreme — Frontend

Lucky Bastards Studio · secuela de **Kash Smash: The Vault** (live en Stake) ·
Stake Web SDK (Svelte 5 + PixiJS 8).

Slot 6×5 de clusters + tumble con la mecánica **KASH RAMPAGE**: en algunos spins
Kash batea el board y convierte símbolos a símbolos altos antes de evaluar
clusters. Fork de `apps/kash-smash`; la math vive en
`stake-math-sdk/games/kash_rampage_extreme/`.

**Estado, arquitectura, pendientes y decisiones: ver `HANDOFF.md`** (en esta
carpeta). Assets/UI que faltan de arte: `UI_SIN_DISENO_KRE_v2.pdf`.

## Quick start

```bash
# mock RGS con los books de KRE (generar antes con make run GAME=kash_rampage_extreme)
.venv/bin/python .scripts/mock_rgs.py --game kash_rampage_extreme --port 3032

cd stake-web-sdk/apps/kash-rampage-extreme
pnpm dev   # :3002
```

Abrir: `http://localhost:3002/?sessionID=mock&rgs_url=http://127.0.0.1:3032`

Herramientas dev: tecla **A** = AnimLab (incluye TIRADA BATEO para forzar un
rampage) · ruta `/sizes` = tweakers de layout por resolución.
