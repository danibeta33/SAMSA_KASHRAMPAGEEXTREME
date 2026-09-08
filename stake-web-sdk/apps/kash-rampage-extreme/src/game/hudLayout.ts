// Geometría compartida del HUD HTML + board Pixi.
//
// El bug que motivó esto (reporte del usuario en el ACP): el board escala
// con la ventana pero el HUD se capa a su tamaño de diseño → en ventanas
// más altas que 675px el frame crecía hasta meterse DEBAJO del stack de
// BET/SPIN, y en otras el grid se metía bajo el TopBar. Estos helpers dan
// las zonas reservadas reales para que Game.svelte cape la escala del board
// y nada se solape en NINGÚN viewport.
//
// Única fuente de verdad: BottomBar y Game importan de acá — si cambian
// los tamaños del stack/TopBar, cambiarlos SOLO acá y en stateUiTweak.

import { stateUiTweak } from './stateUiTweak.svelte';

export const isPortraitViewport = (w: number, h: number) => h > w;

// Misma fórmula congelada que usaba BottomBar (diseño: desktop 1200×675,
// portrait de referencia 425 de ancho).
export const uiScaleFor = (w: number, h: number) =>
	isPortraitViewport(w, h)
		? Math.min(1, Math.max(0.7, w / 425))
		: Math.min(1, Math.max(0.32, Math.min(w / 1200, h / 675)));

// Alto de la franja superior reservada al HUD. Desde el 08-09 vale SIEMPRE 0:
// TopBar.svelte —la barra HTML `position: fixed` que ocupaba 24/40/56 px según
// el viewport— se reemplazó por TopHud.svelte, que vive DENTRO del canvas y se
// posiciona con sus propios sliders, así que ya no le roba alto al board.
//
// La función se conserva (en vez de borrarla y limpiar los callers) porque
// `boardTransform` la usa en dos lugares distintos: el cap superior `sMaxTop` y
// el `topSafe` que en portrait todavía tiene que sumar PORTRAIT_ICON_ROW_H. Que
// devuelva 0 mantiene esa estructura intacta y deja un solo punto donde volver
// a reservar espacio arriba si alguna vez hace falta.
// Los parámetros se conservan aunque no se usen: los callers siguen pasando
// (w, h) y quitarlos haría que TS rechace esas llamadas por aridad.
export const topBarHeight = (_w: number, _h: number) => 0;

// Alto visual del stack BET/SPIN/TURBO/AUTO a escala 1 (pill + dock con el
// solape del pillGap). Medido del layout congelado: dock 218×1.16 de ancho
// con aspecto 940/550 + pill asomando arriba.
export const STACK_VISUAL_H = 200;

// Zona reservada a la derecha para el stack en landscape (ancho + offset +
// aire). El stack ancla bottom-right con right = stackRight×uiScale.
export const stackRightReserve = (uiScale: number) =>
	(stateUiTweak.stackW * stateUiTweak.stackScale + stateUiTweak.stackRight) * uiScale + 8;

// Y de canvas donde ARRANCA el stack (su borde superior) — para el cap
// inferior del board en portrait (stack centrado abajo).
export const stackTopY = (h: number, uiScale: number) =>
	h - (STACK_VISUAL_H * stateUiTweak.stackScale + stateUiTweak.stackBottom) * uiScale;

// Fila de iconos superior en portrait (menu/gear/sound bajo el TopBar).
export const PORTRAIT_ICON_ROW_H = 52;

// ── Transform del board con caps anti-solape ────────────────────────────
// Única fuente de verdad del wrapper de Game.svelte. La consumen también
// PersistentMultiplier (clamp/posición del meter) y Background (Kash).
import { SYMBOL_SIZE, BOARD_SIZES } from './constants';
import {
	stateTweak,
	BOARD_BASE_H,
	FRAME_HOLE_OFFSET_X,
	FRAME_HOLE_OFFSET_Y,
} from './stateTweak.svelte';

// Panel oscuro del board en portrait (BoardFrame rama else): PADDING 14.
const PORTRAIT_PANEL_PAD = 14;

export type BoardTransform = {
	s: number; // escala del wrapper (reemplaza boardBaseScale)
	bx: number; // centro X como fracción del ancho
	by: number; // centro Y como fracción del alto
	landscapeDecor: boolean;
	portrait: boolean;
	topSafe: number; // px: TopBar (+ fila de iconos en portrait)
	uiScale: number;
};

export const boardTransform = (csW: number, csH: number, mScale: number): BoardTransform => {
	const landscapeDecor = csW / csH >= 1.2;
	const portrait = csH > csW;
	const uiScale = uiScaleFor(csW, csH);
	const tb = topBarHeight(csW, csH);

	// Layout LIBRE (por bucket, desde el UI LAB): los sliders mandan tal cual,
	// sin caps anti-solape — el usuario ajusta cada resolución a dedo.
	const free = stateTweak.freeScale >= 0.5;

	if (landscapeDecor) {
		// Frame PNG: centro en board center + frameX/Y, tamaño BOARD_SIZES ×
		// frameW/H, con el stretch no uniforme del wrapper.
		const sDesign = stateTweak.boardH / BOARD_BASE_H;
		const bx = stateTweak.boardX + FRAME_HOLE_OFFSET_X;
		const by = stateTweak.boardY + FRAME_HOLE_OFFSET_Y;
		// Media unidad main del frame hacia la derecha/arriba desde el centro.
		const frameHalfRight = BOARD_SIZES.width * (0.018 + 1.1408 / 2); // frameX + frameW/2
		const frameHalfTop = BOARD_SIZES.height * (1.307 / 2 + 0.057); // frameH/2 + |frameY|
		// Cap derecho: borde del frame fuera de la zona del stack BET/SPIN.
		const sMaxRight =
			(csW * (1 - bx) - stackRightReserve(uiScale)) /
			(frameHalfRight * mScale * stateTweak.boardStretchX);
		// Cap superior: frame por debajo del TopBar.
		const sMaxTop =
			(csH * by - tb - 6) / (frameHalfTop * mScale * stateTweak.boardStretchY);
		return {
			s: free ? sDesign : Math.min(sDesign, sMaxRight, sMaxTop),
			bx,
			by,
			landscapeDecor,
			portrait,
			topSafe: tb,
			uiScale,
		};
	}

	// Portrait / almost-square: panel oscuro alrededor del board.
	const halfW = (BOARD_SIZES.width / 2 + PORTRAIT_PANEL_PAD) * mScale;
	const halfH = (BOARD_SIZES.height / 2 + PORTRAIT_PANEL_PAD) * mScale;
	const topSafe = tb + (portrait ? PORTRAIT_ICON_ROW_H * uiScale : 0);
	// Posición tweakeable también acá (Grilla X/Y del UI LAB). El default de
	// portrait (boardY 0.46) vive en PER_BUCKET_SEED del bucket portrait.
	const bx = stateTweak.boardX;
	const by = stateTweak.boardY;
	const sMaxTop = (csH * by - topSafe - 8) / halfH;
	const sMaxBottom = (stackTopY(csH, uiScale) - csH * by - 8) / halfH;
	// Pedido del usuario: en verticales el grid ocupa CASI TODO el ancho —
	// margen lateral mínimo (4px) y sin cap de diseño que lo frene (el techo
	// 2.5 es solo un fusible anti-pixelado en viewports absurdos). En
	// portrait manda sMaxWidth; alto/stack capan solo si no entra.
	const sideMargin = portrait ? 4 : 8;
	const sMaxWidth = (csW / 2 - sideMargin) / halfW;
	return {
		// En libre, portrait escala por boardH directo (mismo dial que landscape).
		s: free ? stateTweak.boardH / BOARD_BASE_H : Math.min(portrait ? 2.5 : 1, sMaxTop, sMaxBottom, sMaxWidth),
		bx,
		by,
		landscapeDecor,
		portrait,
		topSafe,
		uiScale,
	};
};
