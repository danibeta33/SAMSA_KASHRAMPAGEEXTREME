// Asset registry consumed by pixi-svelte AssetsLoader. The key here matches
// `assetKey` on each SYMBOL_INFO_MAP state in constants.ts.
//
// NOTE: paths MUST be static string literals inside `new URL(...)` — Vite's
// URL rewriting can't resolve template interpolation and silently emits
// `undefined`, which then makes PIXI.Assets.load fail without registering
// the asset. Do not refactor into a helper that concatenates the filename.
//
// Files live under `static/assets/sprites/symbols/` and are served at
// `assets/sprites/symbols/…` by SvelteKit. Same convention as apps/cluster.
export default {
	// Background — vault scene: grafiti KASH en la roca + puerta de bóveda
	// dorada. 2000×1126 (16:9). Preloaded para que se vea desde el primer frame.
	bg_vault: {
		type: 'sprite',
		src: new URL('../../assets/sprites/bg/vault_scene.jpg', import.meta.url).href,
		preload: true,
	},
	// Background ANIMADO (drop 07-09) — "Fondo_Rampage", 16 frames SIN recortar
	// de 1728×972 (16:9 exacto), loop limpio: el frame 15 encadena con el 0.
	// Reemplaza al JPG estático en el mismo hueco de Background.svelte;
	// `bg_vault` queda como fallback.
	//
	// SIN preload: el atlas es un webp de ~13MB. Bloquear el loading screen con
	// eso castiga el arranque de todos; hasta que entra, el JPG cubre el hueco.
	anim_fondo: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_fondo.json', import.meta.url).href,
	},
	// Board frame — marco neón gradient (amarillo → rosa) con hueco central
	// negro donde caen los símbolos. 2000×1694 PNG con transparencia. Preloaded.
	board_frame: {
		type: 'sprite',
		src: new URL('../../assets/sprites/bg/board_frame.png', import.meta.url).href,
		preload: true,
	},
	// Kash lateral — personaje con bat spike-covered al hombro, camiseta blanca
	// con logo bunny, jeans DANGER, sneakers rojos. PNG transparente 528×1200.
	kash_side: {
		type: 'sprite',
		src: new URL('../../assets/sprites/bg/kash_side.png', import.meta.url).href,
		preload: true,
	},
	// (win_overlay retirado 26-08 — el resalte de cluster es la carta LUZ;
	// el marco RS-37 quedó descartado por decisión de dirección y el png se borró.)
	// Win celebration lettering (Figma "Pantalla de Juego / Wins"). Trimmed
	// transparent PNGs. small/big también cubren tiers intermedios: mega usa
	// el lettering de big hasta que haya arte MEGA dedicado.
	// (Smash Meter eliminado 26-08 — KRE no lo usa, GDD lo descarta; los
	// archivos meter_*/anim_meter_ray se borraron de static.)
	// Kash idles (clips del equipo → chroma azul, 340px/10fps/WebP ~800KB c/u).
	// Rotación random en landscape (Background.svelte): stand-by en loop +
	// acciones (gafas/rascada/mocos/bate) que se reproducen una vez y vuelven.
	// Sin preload: cargan de fondo, no bloquean el arranque.
	anim_kash_idle_stand1: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_idle_stand1.json', import.meta.url).href },
	anim_kash_idle_glasses1: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_idle_glasses1.json', import.meta.url).href },
	anim_kash_idle_scratch1: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_idle_scratch1.json', import.meta.url).href },
	anim_kash_idle_nose1: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_idle_nose1.json', import.meta.url).href },
	anim_kash_idle_bat1: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_idle_bat1.json', import.meta.url).href },
	anim_kash_idle_bat2: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_idle_bat2.json', import.meta.url).href },
	// Swing GRANDE (Kash_Batea, 1080² · 48f muestreados): wind-up + bateo con
	// desplazamiento del cuerpo. Otro canvas que los idles → se alinea por
	// escala/anchor propios en Background.svelte (frame 0 = pose standby).
	// PRELOAD (26-08): el swing es el beat 1 del KASH RAMPAGE — sin preload, un
	// buy comprado a los segundos de abrir salía sin bateo (swingReady false →
	// resolve inmediato). 1.2MB webp, asumible en la carga inicial.
	anim_kash_swing: { type: 'spriteSheet', src: new URL('../../assets/sprites/anim/anim_kash_swing.json', import.meta.url).href, preload: true },
	// Paneles del equipo (transparentes, kash style): intro de free spins y
	// "FREE SPINS TOTAL WIN". El contador / monto van overlay encima.
	fs_intro_panel: {
		type: 'sprite',
		src: new URL('../../assets/sprites/fs_intro_panel.webp', import.meta.url).href,
		preload: true,
	},
	fs_win_panel: {
		type: 'sprite',
		src: new URL('../../assets/sprites/fs_win_panel.webp', import.meta.url).href,
		preload: true,
	},
	// Logo KASH SMASH (grafiti lima + SMASH blanco, transparente). Usado en la
	// transición (flash central en vez de texto). Preload: se necesita al toque.
	kash_logo: {
		type: 'sprite',
		src: new URL('../../assets/loading/logo.png', import.meta.url).href,
		preload: true,
	},
	// Rayo animado del equipo (Rayo_Smash Meter.mp4 → pipeline chroma):
	// barra con relámpago recorriéndola — va DENTRO de la máscara de progreso
	// del meter, encima del fill estático.
	// Win celebrations ANIMADAS — spritesheets TexturePacker generados del
	// footage con chroma (pipeline chroma_pipeline.py: chromakey + despill →
	// frames RGBA 16fps → grid + JSON). Reemplazan los letterings estáticos.
	anim_win_small: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_win_small.json', import.meta.url).href,
	},
	anim_win_big: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_win_big.json', import.meta.url).href,
	},
	anim_win_mega: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_win_mega.json', import.meta.url).href,
	},
	// MAX re-exportado a mayor resolución el 07-09: 56 frames de 1402×788 en un
	// solo atlas de 8015×6153.
	anim_win_max: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_win_max.json', import.meta.url).href,
	},
	// Iconos especiales ANIMADOS (Export/IconoEspecial_*, 6 frames c/u, disco
	// giratorio + llamas + grafiti). Cubren W (bate WILD), S (barra de oro
	// SCATTER) y L4 (fajo CASH STACK — ver la nota del re-mapeo más abajo).
	//
	// PRELOAD desde el drop 09-09: ese drop borró `w.png` y `s.png`, así que
	// estos clips dejaron de ser un reemplazo del estático para pasar a ser la
	// ÚNICA representación de W y S. Sin preload, un board pintado antes de que
	// terminen de bajar deja la celda vacía — el mismo motivo por el que
	// `anim_sym_premium` ya iba preloaded. Son 0.54 MB entre los dos.
	anim_sym_wild: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_wild.json', import.meta.url).href,
		preload: true,
	},
	anim_sym_scatter: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_scatter.json', import.meta.url).href,
		preload: true,
	},
	// PREMIUM (H4) — drop 08-09: el clip `Special_Billetes` (fajo de billetes,
	// 25 frames de 256²) reemplazó al `Special_Graffiti` bajo el mismo nombre de
	// archivo, y con él se retiró el sprite estático `sym_h4`. Al no haber
	// fallback, este sheet es la ÚNICA representación de H4 y por eso va con
	// PRELOAD: sin él, un board que se pinte antes de que termine la descarga
	// dejaría la celda vacía. Re-empaquetado con `.scripts/repack_spritesheet.py`
	// de 2027² / 4.67 MB a 1280² / 0.79 MB para que preloadearlo no castigue el
	// arranque (el original a 701² pesaba 10.34 MB).
	// Re-empaquetado otra vez el 09-09: el export nuevo del clip traía la MISMA
	// secuencia de 6 frames DOS VECES (`Special_Billetes` y
	// `Special_Billetes_00000`, 12 frames en total). PIXI solo reproduce la
	// primera —`getSpriteSheetFrames` toma `Object.values(animations)[0]`—, así
	// que la mitad del atlas eran píxeles que nadie pedía, en el único sheet de
	// símbolos con `preload`. Sacada la copia y re-empaquetado: 0.83 → 0.15 MB.
	anim_sym_premium: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_premium.json', import.meta.url).href,
		preload: true,
	},
	// ILUMINACIÓN de los 3 especiales (drop 09-09) — el mismo clip de cada uno
	// con el glow de victoria horneado, sobre el mismo canvas 256². Es el
	// equivalente animado de las cartas `sym_*_luz` de los 10 regulares:
	// SymbolSprite las dibuja DETRÁS del clip base mientras el símbolo está en
	// `win`/`postWinStatic`/`explosion`.
	//
	// Sin preload, igual que sus clips base y que las cartas `_luz` estáticas:
	// son 1.21 MB entre los tres y solo hacen falta cuando el símbolo GANA. Si
	// todavía no bajaron, el especial gana con su clip de siempre y sin glow
	// (`specialLuzReady` lo cubre) — el arranque no se castiga por un adorno.
	anim_sym_wild_luz: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_wild_luz.json', import.meta.url).href,
	},
	anim_sym_scatter_luz: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_scatter_luz.json', import.meta.url).href,
	},
	anim_sym_premium_luz: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_premium_luz.json', import.meta.url).href,
	},
	// MARCO de victoria (drop 09-09, `Marco_Icono`) — 21 frames de un marco
	// cómic rojo/amarillo que estalla DETRÁS del símbolo ganador. Va en TODOS
	// los símbolos que anotan, no solo en los especiales.
	//
	// Re-empaquetado con `.scripts/repack_spritesheet.py --size 192`: llegó como
	// 486² por frame en un atlas de 1994², o sea 15.9 MB de textura
	// DESCOMPRIMIDA en VRAM para algo que se dibuja en una celda de ~100 px.
	// A 192² el atlas queda en 960² = 3.7 MB de VRAM y 0.13 MB de descarga.
	// (El `--verify` marca un Δ de 0.6 % en `fill` — el arte ya era casi a
	// sangre y al bajar de escala el antialias llena el último píxel. El centro
	// no se movió y acá se dibuja a sangre igual, así que es inocuo.)
	//
	// PRELOAD: se ve en la PRIMERA victoria de la sesión; sin él la primera
	// ronda ganadora saldría sin marco. 0.13 MB.
	marco: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/marco.json', import.meta.url).href,
		preload: true,
	},
	// Symbols — 12 sprites, set KASH RAMPAGE (Drive ICONS PNG, kit 26-08).
	// Los 10 regulares vienen del canvas 1080×970 del artista (Juanda) con la
	// escala relativa normalizada; pipeline: crop cuadrado centrado 900px →
	// 512×512 (process_icons.py; h4/Dinero: crop 920@550 — bbox 909px).
	// Pedido 26-08: SOLO iconos del kit ICONS PNG en el board. h1 y h4 son
	// STAND-INS del kit (Vial-rampage y Dinero) hasta que lleguen los recolors
	// de Bluff y del grafiti KASH; w/s son los SPECIAL_* rojos del drop 25-08
	// del mismo Drive.
	//
	// ⚠ RE-MAPEADO 09-09 tras el drop de arte (commit "Nuevas mejoras…"), que
	// re-exportó los 8 estáticos que quedan, agregó `h4.png` y BORRÓ `l4.png`,
	// `w.png`, `s.png` y `luz/l4_luz.png`. El registro seguía apuntando a esos 4
	// archivos: los 404 dejaban la celda de L4 VACÍA en el board (el bug que
	// reportó el usuario con captura) y ensuciaban la consola con 3 reintentos
	// por asset.
	//
	// La identidad de cada símbolo la manda la math, no el nombre del archivo
	// (`stake-math-sdk/games/kash_rampage_extreme/game_config.py`):
	//     H1=Bluff · H2=Syl · H3=Rookie · H4=KASH (premium_symbol)
	//     L1=Drill · L2=Keycard · L3=Smoke Grenade · L4=Cash Stack
	// El clip `anim_sym_premium` es `Special_Billetes` (fajo de billetes) = el
	// CASH STACK, o sea **L4**, no H4. Lo confirma el arte del propio drop:
	// `h4_luz.png` es el medallón de cadena iluminado, no el fajo. El nombre del
	// asset ("premium") es un error de rotulado del export, y se conserva para
	// no invalidar las claves del laboratorio.
	sym_l1: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l1.png', import.meta.url).href }, // Drill (palancas cruzadas)
	sym_l2: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l2.png', import.meta.url).href }, // Keycard → manopla
	sym_l3: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l3.png', import.meta.url).href }, // Smoke Grenade → molotov
	// (sym_l4 sin estático desde el drop 09-09: el CASH STACK se dibuja SIEMPRE
	// con `anim_sym_premium`, que va preloaded. La clave `sym_l4` sigue viva como
	// IDENTIDAD en constants.ts y winPop.ts; lo que no existe es su textura, y
	// `STATIC_LESS` en SymbolSprite.svelte impide que alguien la pida.)
	sym_m1: { type: 'sprite', src: new URL('../../assets/sprites/symbols/m1.png', import.meta.url).href }, // Nitro
	sym_m2: { type: 'sprite', src: new URL('../../assets/sprites/symbols/m2.png', import.meta.url).href }, // ACCESS keycard
	sym_h1: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h1.png', import.meta.url).href }, // Bluff — tag "12"
	sym_h2: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h2.png', import.meta.url).href }, // Syl — tag "FT?"
	sym_h3: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h3.png', import.meta.url).href }, // Rookie — tapa "RAT"
	// KASH (premium de la math). Llegó en el drop 09-09 como `h4.png` (arte
	// nuevo: medallón de cadena con la X, NO el fajo — ver `h4_luz.png`), pero
	// nadie lo registró: el archivo estaba en disco y el juego no lo pedía.
	sym_h4: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h4.png', import.meta.url).href }, // KASH — medallón X
	// (sym_w / sym_s sin estático desde el drop 09-09, mismo caso que sym_l4:
	// sus clips `anim_sym_wild` / `anim_sym_scatter` pasaron a PRELOAD y son la
	// única representación.)
	// Iconos ILUMINADOS (Icons_Luz, kit 26-08) — carta full-bleed 1080×970
	// (marco oscuro + glow horneado) → 512×460 conservando aspect. SymbolSprite
	// los muestra en win/postWinStatic en lugar del estático + halo lima.
	// Sin preload: cargan de fondo; hasta entonces cae al halo actual. Cubren
	// los 10 regulares (h1/h4 incluidos desde el swap a stand-ins del kit);
	// w/s siguen con halo.
	sym_l1_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l1_luz.png', import.meta.url).href },
	sym_l2_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l2_luz.png', import.meta.url).href },
	sym_l3_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l3_luz.png', import.meta.url).href },
	// (sym_l4_luz retirado 09-09 con `l4_luz.png`: el CASH STACK ilumina con su
	// clip `anim_sym_premium_luz`, no con una carta estática.)
	sym_m1_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/m1_luz.png', import.meta.url).href },
	sym_m2_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/m2_luz.png', import.meta.url).href },
	sym_h2_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/h2_luz.png', import.meta.url).href },
	sym_h3_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/h3_luz.png', import.meta.url).href },
	sym_h1_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/h1_luz.png', import.meta.url).href },
	sym_h4_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/h4_luz.png', import.meta.url).href },
	// HUD superior (drop 08-09, ref. REFERENCIA_NUEVA_UI.png) — reemplaza la
	// barra negra única de TopBar.svelte. `ui_contenedor1` es el recipiente
	// biselado que se instancia 3 veces (Balance / Last Win / Tumble) y
	// `ui_title` el logo RAMPAGE EXTREME, que va suelto arriba a la izquierda.
	// Ambos con PRELOAD: son livianos (0.03 y 0.91 MB) y forman parte del primer
	// frame jugable, así que no pueden aparecer con pop.
	ui_contenedor1: {
		type: 'sprite',
		src: new URL('../../assets/ui/Contenedor1.png', import.meta.url).href,
		preload: true,
	},
	ui_title: {
		type: 'sprite',
		src: new URL('../../assets/ui/Title.png', import.meta.url).href,
		preload: true,
	},
} as const;
