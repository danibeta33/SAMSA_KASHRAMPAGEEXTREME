# Kash Rampage Extreme — Cómo levantarlo en dev desde cero

Este kit complementa `kash_rampage_extreme_avance.zip`. Ese zip trae la app y la
math, pero le faltan dos cosas que viven fuera de esas carpetas y sin las cuales
el juego NO arranca:

1. **`.scripts/mock_rgs.py`** — el servidor RGS local que sirve los books.
2. **Los packages modificados del web-sdk** — el studio tiene ~57 archivos de
   `packages/` cambiados respecto al repo oficial de Stake (decimales, i18n,
   stateUrl, modals, etc.). La app depende de esos cambios. Sobre un clone limpio
   de `StakeEngine/web-sdk` falla al compilar.

---

## 0. Requisitos

| Herramienta | Versión | Cómo verificar |
|---|---|---|
| Node | >= 22.16 | `node -v` |
| pnpm | 10.x (el repo pide 10.5.0) | `pnpm -v` — si no está: `corepack enable` |
| Python | >= 3.10 (funciona con 3.14) | `python3 --version` |
| git | cualquiera | — |

## 1. Estructura de carpetas

Todo asume esta estructura. Los scripts resuelven rutas relativas a ella.

```
<raiz>/                          ← cualquier carpeta, p. ej. ~/samsa-games
├── .scripts/mock_rgs.py         ← de este kit
├── .venv/                       ← lo creás vos (paso 3)
├── stake-web-sdk/               ← clone oficial + overlay de este kit + la app
│   ├── packages/
│   └── apps/kash-rampage-extreme/
└── stake-math-sdk/
    └── games/kash_rampage_extreme/
        └── library/publish_files/   ← books + lookUpTables (vienen en el zip)
```

## 2. Web SDK

```bash
cd <raiz>
git clone https://github.com/StakeEngine/web-sdk.git stake-web-sdk
cd stake-web-sdk
git checkout 1843d60cedb94b390e641b563f32ad64353bec5e   # commit base del studio
```

Aplicar los cambios del studio. **Opción A (recomendada): overlay.** Copiá el
contenido de `web-sdk-overlay/` de este kit encima de `stake-web-sdk/`,
sobrescribiendo. La lista exacta de archivos está en `overlay_files.txt`.

```bash
cp -R <kit>/web-sdk-overlay/. <raiz>/stake-web-sdk/
```

Opción B: `git apply <kit>/web-sdk-studio.patch` (no incluye los archivos de
i18n nuevos, por eso se recomienda el overlay).

Después, descomprimir la app del zip en `stake-web-sdk/apps/kash-rampage-extreme/`
e instalar **desde la raíz del monorepo** (no desde la app):

```bash
cd <raiz>/stake-web-sdk
pnpm install
```

## 3. Mock RGS (Python)

```bash
cd <raiz>
python3 -m venv .venv
.venv/bin/pip install zstandard
```

Es la única dependencia del mock (el resto es stdlib).

Descomprimir la math del zip en `stake-math-sdk/games/kash_rampage_extreme/`.
Los books ya vienen generados en `library/publish_files/`, **no hace falta
correr la math** para jugar.

## 4. Levantar (dos terminales)

**Terminal 1 — mock RGS en :3032**

```bash
cd <raiz>
.venv/bin/python .scripts/mock_rgs.py --game kash_rampage_extreme --port 3032
```

Si la math no está en `stake-math-sdk/games/...`, apuntá directo a la carpeta:
`--library /ruta/a/publish_files`.

**Terminal 2 — frontend en :3002**

```bash
cd <raiz>/stake-web-sdk/apps/kash-rampage-extreme
pnpm dev
```

**Navegador**

```
http://localhost:3002/?sessionID=mock&rgs_url=http://127.0.0.1:3032
```

Los dos query params son obligatorios. Sin `rgs_url` la app intenta pegarle al
RGS real de Stake y se queda en el loader.

## 5. Problemas típicos

- **`pnpm dev` explota con errores de tipos/props en `components-*` o `state-shared`**
  → no se aplicó el overlay del paso 2, o se aplicó sobre otro commit.
- **`ERR_PNPM_...` / paquetes `workspace:*` no encontrados**
  → corriste `pnpm install` dentro de la app. Hacelo en la raíz de `stake-web-sdk`.
- **El mock dice `library not found`**
  → la math no está en `<raiz>/stake-math-sdk/games/kash_rampage_extreme/`. Usá `--library`.
- **`ModuleNotFoundError: zstandard`**
  → `.venv/bin/pip install zstandard`.
- **Puerto ocupado**
  → `lsof -nP -iTCP:3002 -iTCP:3032 -sTCP:LISTEN` y `kill <PID>`.
- **Pantalla en negro / loader infinito**
  → falta `rgs_url` en la URL, o el mock no está corriendo.

## 6. Herramientas dev dentro del juego

- Tecla **A**: AnimLab. Tiene el botón TIRADA BATEO para forzar un rampage.
- Ruta `/sizes`: tweakers de layout por resolución.
- `.scripts/validate_books.py`: valida los books contra el schema del RGS.

El estado del proyecto, la arquitectura y los pendientes están en
`apps/kash-rampage-extreme/HANDOFF.md`.
