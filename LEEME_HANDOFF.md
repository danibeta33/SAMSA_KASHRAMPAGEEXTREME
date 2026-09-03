# Kash Rampage Extreme — Handoff

Este zip contiene las dos piezas del juego, con las rutas del monorepo:

```
stake-web-sdk/apps/kash-rampage-extreme/    → frontend (Svelte 5 + PixiJS 8)
stake-math-sdk/games/kash_rampage_extreme/  → math (Stake Engine Math SDK)
```

Descomprimir cada carpeta dentro de tu clone del SDK correspondiente
(https://github.com/StakeEngine — web-sdk y math-sdk oficiales).

**Empezar por `stake-web-sdk/apps/kash-rampage-extreme/HANDOFF.md`** — ahí está
el estado por fase, la arquitectura, los pendientes en orden y cómo correr el
juego en dev. El README de la app tiene el quick start.

Notas:
- `node_modules` no viene: correr `pnpm install` en la raíz del web-sdk.
- La math incluye `library/` con la corrida de producción del 26-08 **pendiente
  de verificación** (primer pendiente del HANDOFF) y sus logs.
- El HANDOFF referencia la knowledge base de approval del studio (`dead-heat/`
  y el playbook) — eso se entrega por separado, pedírselo a Maik.
