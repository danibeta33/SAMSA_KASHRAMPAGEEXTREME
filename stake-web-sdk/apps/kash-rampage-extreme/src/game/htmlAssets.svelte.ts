// Preload de las imágenes HTML del HUD y overlays (cards del buy, botones,
// pill, dock, iconos). NO pasan por el AssetsLoader de Pixi — son <img>/CSS
// background que el browser descargaba recién al primer render: el buy menu
// abría con las cards "apareciendo" tarde (reporte del usuario 17-07).
// Se precargan durante el loading screen y el CLICK TO CONTINUE también las
// espera (LoadingOverlay: ready = pixi loaded && htmlAssets.loaded).
//
// Rutas relativas al documento — mismo esquema que usan los componentes
// (sirve igual en dev y bajo el subpath del CDN del ACP).
const HTML_ASSETS = [
	// buy bonus overlay
	'assets/buy/header.png',
	'assets/buy/card_vault.png',
	'assets/buy/card_smash.png',
	'assets/buy/card_rage.png',
	'assets/buy/close.png',
	// fondos compartidos por buy/autospin (el loading ya los muestra, pero
	// así quedan garantizados en cache aunque el loading cambie)
	'assets/loading/bg_outer.jpg',
	'assets/loading/bg_inner.jpg',
	// bottom HUD
	'assets/ui/icon_menu.png',
	'assets/ui/icon_gear.png',
	'assets/ui/icon_sound.png',
	'assets/ui/bet_pill.png',
	'assets/ui/dock.png',
	'assets/ui/btn_spin.png',
	'assets/ui/btn_stop.png',
	'assets/ui/btn_turbo.png',
	'assets/ui/btn_auto.png',
];

export const htmlAssets = $state({ loaded: false });

// Referencias vivas a las Image precargadas: sin esto el GC puede soltar la
// copia decodificada y el memory-cache del browser pierde fuerza.
const pinned: HTMLImageElement[] = [];

const loadOne = (src: string, attempt = 1): Promise<void> =>
	new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			pinned.push(img);
			resolve();
		};
		img.onerror = () => {
			// un retry y listo — un fallo acá no debe dejar el juego sin arrancar
			if (attempt < 2) resolve(loadOne(src, attempt + 1));
			else resolve();
		};
		img.src = src;
	});

export const preloadHtmlAssets = async () => {
	await Promise.all(HTML_ASSETS.map((src) => loadOne(src)));
	htmlAssets.loaded = true;
};
