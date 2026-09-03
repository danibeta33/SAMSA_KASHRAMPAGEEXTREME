# GUIA DE ONBOARDING GIT Y CONTROL DE VERSIONES - STAKE ENGINE MONOREPO

Esta guia establece el estandar tecnico obligatorio para interactuar con este monorepo. Nuestro ecosistema integra codigo frontend en tiempo real (Svelte 5 + PixiJS 8), librerias matematicas de simulacion probabilistica en Python/Rust, y herramientas de control de calidad (QA / Playwright). 

Debido a que manejamos simulaciones matematicas certificadas con archivos que pueden superar los 600 MB (libros .jsonl.zst y Lookup Tables en CSV), un solo error en el manejo de Git puede corromper el historial del repositorio para todo el equipo. Lee este documento completo antes de ejecutar tu primer comando.

---

## 1. CLONADO INICIAL Y CONFIGURACION DE GIT LFS

ACCION PREVIA OBLIGATORIA: Antes de clonar o interactuar con el repositorio, debes tener instalado Git LFS (Large File Storage) en tu estacion de trabajo.

### Paso 1: Inicializar Git LFS en tu maquina
Ejecuta este comando una unica vez en tu terminal global:
```bash
git lfs install
```
Verifica que la salida confirme: `Git LFS initialized.` Si no lo tienes instalado a nivel de sistema operativo, descargalo desde git-lfs.com o mediante tu gestor de paquetes (`winget install GitHub.GitLFS` en Windows, `brew install git-lfs` en macOS, `sudo apt-get install git-lfs` en Linux).

---

### Paso 2: Clonado del Repositorio

Dependiendo de tu rol en el equipo, selecciona una de las siguientes dos modalidades de clonado:

#### OPCION A: CLONADO RAPIDO / SELECTIVO (RECOMENDADO PARA FRONTEND Y QA)
Si tu trabajo se centra en la interfaz visual, audio, o automatizaciones de QA, NO necesitas descargar decenas de gigabytes correspondientes a simulaciones matematicas de otros juegos. Utiliza la bandera `GIT_LFS_SKIP_SMUDGE=1` para descargar unicamenete los punteros ligeros:

En Linux / macOS / Git Bash:
```bash
GIT_LFS_SKIP_SMUDGE=1 git clone <URL_DEL_REPOSITORIO> samsa-monorepo
cd samsa-monorepo
```

En Windows PowerShell:
```powershell
$env:GIT_LFS_SKIP_SMUDGE="1"
git clone <URL_DEL_REPOSITORIO> samsa-monorepo
cd samsa-monorepo
Remove-Item Env:\GIT_LFS_SKIP_SMUDGE
```

Una vez clonado, descarga selectivamente SOLO los assets del juego en el que vas a trabajar:
```bash
# Ejemplo: Descargar unicamente los assets visuales y de audio de Kash Rampage Extreme
git lfs pull --include="stake-web-sdk/apps/kash-rampage-extreme/static/**"
```

#### OPCION B: CLONADO COMPLETO (DESARROLLADORES DE MATH SDK Y REGULACION)
Si eres parte del equipo matematico o preparas entregables de certificacion RGS y requieres todos los libros y tablas de busqueda de forma inmediata:
```bash
git clone <URL_DEL_REPOSITORIO> samsa-monorepo
cd samsa-monorepo
```

---

### Paso 3: Verificacion de Enlaces LFS
Comprueba que Git reconozca las reglas de `.gitattributes` en tu entorno local antes de tocar codigo:
```bash
git check-attr -a stake-math-sdk/games/kash_rampage_extreme/library/publish_files/books_rage_mode.jsonl.zst
```
La salida DEBE contener obligatoriamente:
```text
filter: lfs
diff: lfs
merge: lfs
```
Si el resultado no muestra `filter: lfs`, DETEN EL TRABAJO y notifica de inmediato al lider tecnico.

---

## 2. FLUJO DEL PRIMER COMMIT Y PUSH

Trabajamos bajo una adaptacion estricta de GitHub Flow. Esta terminantemente prohibido comitear directamente sobre la rama `main`.

### Paso 1: Sincronizar y Crear una Nueva Rama
Siempre parte del estado mas actualizado de `main`:
```bash
git checkout main
git pull origin main
```

Crea tu rama de trabajo siguiendo el patron estandar: `<tipo>/<juego-o-modulo>/<descripcion-corta>`
```bash
# Para funcionalidades visuales:
git checkout -b feat/kash-rampage/bonus-wheel-ui

# Para fixes o ajustes matematicos:
git checkout -b math/kash-smash/adjust-wincap-force

# Para automatizaciones de pruebas:
git checkout -b qa/dead-heat/smoke-allure-reporting

# Para tareas de infraestructura o tooling:
git checkout -b chore/sdk/upgrade-pixi-v8
```

---

### Paso 2: Verificacion Pre-Staging (INSPECCION OBLIGATORIA)
Antes de agregar cualquier archivo, revisa meticulosamente el arbol de trabajo:
```bash
git status
```

REGLA CRITICA: NUNCA ejecutes `git add .` o `git add -A` de forma automatica. Agrega unicamente las rutas puntuales que forman parte de tu tarea:
```bash
git add stake-web-sdk/apps/kash-rampage-extreme/src/routes/
```

Si modificaste o agregaste archivos binarios, multimedia, tablas CSV o libros `.zst`, verifica como los interpreto Git:
```bash
git lfs status
```
Los archivos pesados DEBEN listarse en la seccion `Git LFS objects to be committed:` con el prefijo `LFS:`. Si aparecen como objetos regulares de Git, NO HAGAS COMMIT.

---

### Paso 3: Mensaje de Commit (Estandar Conventional Commits)
Redacta mensajes descriptivos en imperativo, explicando el motivo del cambio:
```bash
git commit -m "feat(kash-rampage): integrate win celebration particle effects"
```

Estructura de prefijos autorizados:
- `feat`: Nuevas caracteristicas funcionales (frontend o backend).
- `fix`: Correccion de errores o bugs.
- `math`: Cambios en logica matematica, configuracion de reels o distribuciones.
- `perf`: Optimizaciones de rendimiento o tiempo de simulacion.
- `refactor`: Cambios de estructura sin alterar la logica de negocio.
- `test`: Inclusion o ajuste de pruebas Playwright o tests unitarios.
- `chore`: Tareas de mantenimiento, dependencias o configuraciones.

---

### Paso 4: Publicacion al Repositorio Remoto (Primer Push)
Para publicar tu nueva rama y vincularla con el remoto por primera vez, utiliza:
```bash
git push -u origin <NOMBRE_DE_TU_RAMA>
```
El parametro `-u` (o `--set-upstream`) configurara el rastreo para que en los commits posteriores de esa rama unicamente necesites ejecutar `git push`.

---

## 3. PREVENCION DE DESASTRES (REGLAS DE ORO)

1. PROHIBICION ESTRICTA: NUNCA EJECUTAR `git push --force` O `git push -f` SOBRE `main` O RAMAS COMPARTIDAS.
   Un push forzado sobrescribe el historial remoto y borra el trabajo de otros desarrolladores. Si requieres actualizar tu rama con los cambios recientes de `main`, realiza un merge o rebase localmente y luego sube tus cambios normalmente.

2. PROHIBICION ESTRICTA: NUNCA SUBIR ARCHIVOS CONFIDENCIALES O AMBIENTALES (.env).
   Credenciales de bases de datos, claves privadas (`.pem`, `.key`), tokens del Admin Control Panel (ACP) y configuraciones con secretos locales NUNCA deben registrarse en Git. Verifica siempre que los cambios pertenezcan a plantillas seguras (`.env.example`).

3. REGLA DE ORO: SEPARAR CORRIDAS INTERMEDIAS DE LOS ARTEFACTOS PUBLICADOS.
   Las carpetas `optimization_files/`, `trial_results/` y los logs generados por ejecuciones de simulacion (`run_*.log`) estan bloqueados en `.gitignore`. NUNCA fuerces la subida de estos directorios (`git add -f`). Unicamente los archivos finales sellados en `publish_files/` (`index.json`, `books_*.jsonl.zst`, `lookUpTable_*.csv`) deben ser commiteados mediante LFS.

4. REGLA DE ORO: NO IGNORAR LAS ADVERTENCIAS DE TAMAÑO DE GITHUB.
   GitHub bloquea cualquier archivo que supere los 100 MB si no es procesado a traves de Git LFS. Si ves una advertencia de archivo pesado o si el comando `git push` se congela transfiriendo cientos de megabytes, CANCELA LA OPERACION CON CTRL+C inmediatamente antes de que el objeto quede registrado en el servidor.

5. REGLA DE ORO: MANTENER LIMPIO EL ENTORNO LOCAL.
   No utilices el arbol de trabajo del repositorio como almacenamiento temporal para builds empaquetados (`frontend_<juego>.zip`) o directorios de prueba de servicio (`/tmp/zipserve/`). Manten siempre limpio tu directorio de trabajo.

---

## 4. TROUBLESHOOTING Y RESOLUCION DE ERRORES COMUNES

### Lista de verificacion antes de cualquier accion destructiva
Antes de ejecutar comandos que eliminen o reescriban cambios (`git reset --hard`, `git clean -fd`, `git checkout .`), comprueba:
1. ¿Tienes cambios sin guardar en archivos que necesitas conservar? Ejecuta `git status`.
2. ¿Deseas preservar tu trabajo temporalmente sin comitear? Usa `git stash save "trabajo en progreso"`.
3. ¿Estas ubicado en la rama correcta? Compruebalo con `git branch`.

---

### Como abortar operaciones conflictivas de forma segura

#### Caso 1: Conflicto durante un Merge
Si ejecutaste un merge y te encuentras con conflictos complejos que no puedes resolver inmediatamente:
```bash
git merge --abort
```
Este comando regresara tu rama al estado exacto previo al intento de fusion, sin perder ningun archivo previo.

#### Caso 2: Conflicto durante un Rebase
Si durante un rebase la secuencia de commits se detiene por conflictos:
```bash
git rebase --abort
```
Esto cancelara por completo el proceso de rebase y restaurara el puntero original de tu rama.

---

### Como deshacer un `git add` accidental sin perder tu codigo
Si ejecutaste `git add .` por error e incluiste archivos que no debian ir al commit:
```bash
# Para retirar un archivo especifico del area de preparacion (staging):
git restore --staged <ruta/al/archivo>

# Para retirar TODOS los archivos del area de preparacion manteniendo tus modificaciones:
git restore --staged .
```

---

### Como corregir un archivo de 400 MB comiteado sin Git LFS (ANTES DE HACER PUSH)
Si realizaste un commit local que incluyo un archivo `.jsonl.zst` o `.csv` pesado y olvidaste que Git LFS estuviera activo, el archivo ahora vive como un objeto regular en tu base de datos de Git. Si intentas hacer push, fallara.

#### Procedimiento de resolucion:
Paso 1: Deshacer el ultimo commit manteniendo tus cambios en los archivos:
```bash
git reset --soft HEAD~1
```

Paso 2: Asegurar que Git LFS este debidamente inicializado y leyendo `.gitattributes`:
```bash
git lfs install
git check-attr -a <ruta/al/archivo-pesado>
```

Paso 3: Volver a agregar el archivo y verificar que ahora si se registre como objeto LFS:
```bash
git add <ruta/al/archivo-pesado>
git lfs status
```
La salida debe confirmar: `Git LFS objects to be committed`.

Paso 4: Realizar el commit normalmente:
```bash
git commit -m "feat(math): add certified books and lookup tables via LFS"
```

---

### Limpieza de ramas locales obsoletas
Para eliminar de tu maquina referencias a ramas remotas que ya han sido fusionadas y eliminadas en GitHub:
```bash
git fetch --prune
```
Para borrar ramas locales que ya no necesitas:
```bash
git branch -d <nombre-rama>
```
Si la rama no se ha fusionado y estas absolutamente seguro de descartarla:
```bash
git branch -D <nombre-rama>
```
