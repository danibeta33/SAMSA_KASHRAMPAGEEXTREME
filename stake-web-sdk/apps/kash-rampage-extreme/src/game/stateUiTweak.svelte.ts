// Layout del BottomBar (SPIN/TURBO/AUTO/BET pill/iconos) + board frame —
// valores CONGELADOS, aprobados en el UI Lab (2026-07-07). El lab de sliders
// quedó solo para lo aún no ajustado (Smash Meter, en stateTweak). Para
// re-tweakear esto, restaurar desde git la versión con localStorage + META.

type UiTweak = {
	stackW: number; // ancho del stack derecho (px)
	stackRight: number; // separación del borde derecho (px)
	stackBottom: number; // separación del borde inferior (px)
	stackScale: number; // escala del CONJUNTO pill+dock (origin bottom-right)
	pillW: number; // ancho del BET pill (% del stack)
	pillGap: number; // espacio pill ↔ dock (px)
	spinTop: number; // top del SPIN dentro del dock (%)
	spinW: number; // ancho del SPIN (% del dock)
	rowBottom: number; // bottom de TURBO/AUTO dentro del dock (%)
	rowSide: number; // margen lateral de la fila (%)
	miniW: number; // ancho de cada mini botón (% de la fila)
	iconSize: number; // lado de los iconos izq (px)
	iconGap: number; // gap entre iconos (px)
	iconScale: number; // escala de la fila config + BONUS (por bucket, via stateTweak)
	iconX: number; // separación al borde izquierdo (px, por bucket via stateTweak)
	iconY: number; // separación al borde inferior (px, por bucket via stateTweak)
	// ── Opacidad + capa de los 2 elementos HTML (por bucket, via stateTweak) ──
	// El overlay `.bb` es un `position: fixed` con `z-index: 90`, así que estos
	// dos números ordenan botonera vs íconos ENTRE ELLOS. Contra los elementos
	// de canvas no compiten: el overlay HTML siempre va por encima.
	stackAlpha: number;
	stackZ: number;
	iconAlpha: number;
	iconZ: number;
	// ── Board frame (imagen de la cuadrícula) + símbolos ──
	frameW: number; // ancho del frame (× board width)
	frameH: number; // alto del frame (× board height)
	frameX: number; // offset X del frame (× board width)
	frameY: number; // offset Y del frame (× board height)
	symScale: number; // multiplicador global del tamaño de símbolos
};

// $state: stackScale ahora se ajusta EN VIVO por resolución desde el UI LAB
// (stateTweak.applyBucket lo sincroniza) — sin reactividad el BottomBar no se
// enteraría del cambio hasta el próximo resize.
export const stateUiTweak: UiTweak = $state({
	stackW: 218,
	stackRight: 64,
	stackBottom: 22,
	// Feedback N1 #6: botones de la derecha más pequeños (era 1.16). Además
	// libera stackRightReserve → el board puede crecer (grilla más grande).
	// El valor efectivo por resolución vive en stateTweak.stackScale.
	stackScale: 0.94,
	pillW: 77,
	pillGap: -21,
	spinTop: 7.5,
	spinW: 62.5,
	rowBottom: 10.5,
	rowSide: 4,
	miniW: 48.5,
	iconSize: 61,
	iconGap: 10,
	iconScale: 1,
	iconX: 22,
	iconY: 18,
	stackAlpha: 1,
	stackZ: 2,
	iconAlpha: 1,
	iconZ: 1,
	frameW: 1.1408,
	frameH: 1.307,
	frameX: 0.018,
	frameY: -0.057,
	symScale: 1.01,
});
