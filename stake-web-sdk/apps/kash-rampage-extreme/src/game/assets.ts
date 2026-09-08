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
	// giratorio + llamas + grafiti). Reemplazan el sprite estático en el board
	// para W (bate WILD), S (barra de oro SCATTER) y H4 (grafiti KASH PREMIUM).
	// Sin preload: cargan de fondo; hasta entonces SymbolSprite usa el estático.
	anim_sym_wild: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_wild.json', import.meta.url).href,
	},
	anim_sym_scatter: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_scatter.json', import.meta.url).href,
	},
	// PREMIUM (H4) — drop 08-09: el clip `Special_Billetes` (fajo de billetes,
	// 25 frames de 256²) reemplazó al `Special_Graffiti` bajo el mismo nombre de
	// archivo, y con él se retiró el sprite estático `sym_h4`. Al no haber
	// fallback, este sheet es la ÚNICA representación de H4 y por eso va con
	// PRELOAD: sin él, un board que se pinte antes de que termine la descarga
	// dejaría la celda vacía. Re-empaquetado con `.scripts/repack_spritesheet.py`
	// de 2027² / 4.67 MB a 1280² / 0.79 MB para que preloadearlo no castigue el
	// arranque (el original a 701² pesaba 10.34 MB).
	anim_sym_premium: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/anim/anim_sym_premium.json', import.meta.url).href,
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
	sym_l1: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l1.png', import.meta.url).href }, // Crowbar
	sym_l2: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l2.png', import.meta.url).href }, // Brass Knuckles
	sym_l3: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l3.png', import.meta.url).href }, // Molotov
	sym_l4: { type: 'sprite', src: new URL('../../assets/sprites/symbols/l4.png', import.meta.url).href }, // Dye-Pack Cash
	sym_m1: { type: 'sprite', src: new URL('../../assets/sprites/symbols/m1.png', import.meta.url).href }, // Nitro
	sym_m2: { type: 'sprite', src: new URL('../../assets/sprites/symbols/m2.png', import.meta.url).href }, // Blueprint
	sym_h1: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h1.png', import.meta.url).href }, // Rampage Vial (stand-in de Bluff)
	sym_h2: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h2.png', import.meta.url).href }, // UZI
	sym_h3: { type: 'sprite', src: new URL('../../assets/sprites/symbols/h3.png', import.meta.url).href }, // Bomb (Dinamita)
	// (sym_h4 eliminado 08-09 junto con symbols/h4.png — el fajo estático era el
	// fallback del grafiti mientras cargaba su clip. Ahora H4 se dibuja SIEMPRE
	// con `anim_sym_premium`, que va preloaded. La clave `sym_h4` sigue viva como
	// IDENTIDAD del símbolo en constants.ts, winPop.ts y LUZ_KEY — lo que
	// desapareció es su textura, y `STATIC_LESS` en SymbolSprite.svelte impide
	// que alguien la pida.)
	sym_w:  { type: 'sprite', src: new URL('../../assets/sprites/symbols/w.png',  import.meta.url).href }, // Bat WILD
	sym_s:  { type: 'sprite', src: new URL('../../assets/sprites/symbols/s.png',  import.meta.url).href }, // Gold Bar SCATTER
	// Iconos ILUMINADOS (Icons_Luz, kit 26-08) — carta full-bleed 1080×970
	// (marco oscuro + glow horneado) → 512×460 conservando aspect. SymbolSprite
	// los muestra en win/postWinStatic en lugar del estático + halo lima.
	// Sin preload: cargan de fondo; hasta entonces cae al halo actual. Cubren
	// los 10 regulares (h1/h4 incluidos desde el swap a stand-ins del kit);
	// w/s siguen con halo.
	sym_l1_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l1_luz.png', import.meta.url).href },
	sym_l2_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l2_luz.png', import.meta.url).href },
	sym_l3_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l3_luz.png', import.meta.url).href },
	sym_l4_luz: { type: 'sprite', src: new URL('../../assets/sprites/symbols/luz/l4_luz.png', import.meta.url).href },
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
