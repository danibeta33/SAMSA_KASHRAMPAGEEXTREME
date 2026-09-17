// Social casino mode (stake.us) — /docs/reference/social-mode: con
// social=true TODO término de real money debe reemplazarse en la UI, reglas
// y paytable (siempre en inglés — stateUrl.lang() ya fuerza 'en').
//
// Toda la superficie textual del juego es HTML (HUD overlays + modals — los
// <Text> de Pixi solo muestran montos), así que un MutationObserver sobre
// <body> cubre reglas, paytable, i18n y overlays de una sola vez, incluso
// texto montado después. Los assets con texto rasterizado ("BET" del pill,
// "BUY BONUS"/"x BET"/"BUY" del buy menu) se cubren por CSS en sus
// componentes — un replacer de texto no llega a los bitmaps.

import { stateUrlDerived } from 'state-shared';

// Diccionario = tabla oficial "Social Mode Wording" del ACP (checkbox de
// confirmación del submit), más derivaciones obvias (plurales, -ed/-ing) y
// payout/paying (no listados pero mismo espíritu que pay→win).
// Orden: frases multi-palabra primero para que los términos sueltos no las
// rompan ("buy bonus" debe volverse "get bonus" antes de que "buy"→"play";
// "pays out" antes que "pays"). "Stake Engine" queda intacto (lookahead) —
// es el trademark del disclaimer.
const RULES: Array<[RegExp, string]> = [
	[/\bbe awarded to player('?s)? accounts?\b/gi, "appear in player's accounts"],
	[/\bplace your bets\b/gi, 'come and play'],
	// Feedback N3: mapeos pedidos por el reviewer para la ventana de replay.
	// Van antes que payout→win / total bet→total play / cost→amount para que
	// esas reglas no los partan en "Win Multiplier" / "Amount Multiplier".
	[/\bpayout multipliers?\b/gi, 'final multiplier'],
	[/\bcost multipliers?\b/gi, 'feature multiplier'],
	[/\btotal bet costs?\b/gi, 'total play amount'],
	[/\bat the cost of\b/gi, 'for'],
	[/\bcost of\b/gi, 'can be played for'],
	// Feedback N3: "COST" suelto (tabla de modos, buy overlays) es restringido.
	[/\bcosts?\b/gi, 'amount'],
	[/\bwin features?\b/gi, 'play feature'],
	[/\bbuy bonus(?:es)?\b/gi, 'get bonus'],
	[/\bbonus buys?\b/gi, 'bonus'],
	[/\bpay ?tables?\b/gi, 'win table'],
	[/\btotal bets?\b/gi, 'total play'],
	[/\bpays out\b/gi, 'won'],
	[/\bpaid out\b/gi, 'win'],
	[/\bpay out\b/gi, 'win'],
	[/\bpayouts\b/gi, 'wins'],
	[/\bpayout\b/gi, 'win'],
	[/\bpayers?\b/gi, 'winner'],
	[/\bpaying\b/gi, 'winning'],
	[/\bpays\b/gi, 'wins'],
	[/\bpaid\b/gi, 'won'],
	[/\bpay\b/gi, 'win'],
	[/\brebets?\b/gi, 'respin'],
	[/\bbetting\b/gi, 'playing'],
	[/\bbets\b/gi, 'plays'],
	[/\bbet\b/gi, 'play'],
	[/\bwagered\b/gi, 'played'],
	[/\bwagering\b/gi, 'playing'],
	[/\bwagers\b/gi, 'plays'],
	[/\bwager\b/gi, 'play'],
	[/\bcash\b/gi, 'coins'],
	[/\bmoney\b/gi, 'coins'],
	// Feedback N3: "INSUFFICIENT FUNDS ... ADD FUNDS" → COINS.
	[/\bfunds\b/gi, 'coins'],
	[/\bcredits?\b/gi, 'coins'],
	[/\bcurrencies\b/gi, 'tokens'],
	[/\bcurrency\b/gi, 'token'],
	[/\bgambling\b/gi, 'playing'],
	[/\bgambles?\b/gi, 'play'],
	[/\bdeposits?\b/gi, 'get coins'],
	[/\bwithdraw(?:al)?s?\b/gi, 'redeem'],
	[/\bstakes?\b(?!\s+engine)/gi, 'play amount'],
	[/\bbought\b/gi, 'instantly triggered'],
	[/\bpurchased\b/gi, 'played'],
	[/\bpurchases?\b/gi, 'play'],
	[/\bbuys?\b/gi, 'play'],
];

// Conserva el estilo de caja del match: "BET"→"PLAY", "Bet"→"Play",
// "Pay Table"→"Win Table", "bet"→"play".
const matchCase = (src: string, out: string) => {
	if (src === src.toUpperCase()) return out.toUpperCase();
	if (src[0] !== src[0].toUpperCase()) return out;
	const srcWords = src.split(/\s+/);
	const titled = srcWords.length > 1 && srcWords.every((w) => w[0] === w[0].toUpperCase());
	if (titled) return out.replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toUpperCase());
	return out.charAt(0).toUpperCase() + out.slice(1);
};

export const socializeText = (text: string) =>
	RULES.reduce((acc, [re, out]) => acc.replace(re, (m) => matchCase(m, out)), text);

// El MutationObserver de abajo solo ve TEXT NODES del DOM. Quedan afuera dos
// superficies que igual muestran texto al jugador:
//
//   · los <Text> de Pixi (el HUD superior: BET / BALANCE / LAST WIN / TUMBLE)
//     — son draw calls de WebGL, no hay nodo que observar. El "BET GC 1.00"
//     del panel derecho fue rechazo en el feedback 16-09;
//   · los ATRIBUTOS (aria-label, alt, title) — el walker es SHOW_TEXT.
//
// Para esos dos casos se envuelve el string en el origen. Se reusa el mismo
// diccionario a propósito: un segundo listado a mano se desincroniza.
// En real money es identidad, así que envolver strings ya limpios es gratis.
export const socialLabel = (text: string) =>
	stateUrlDerived.social() ? socializeText(text) : text;

export const enableSocialText = () => {
	const fix = (node: globalThis.Text) => {
		const next = socializeText(node.data);
		if (next !== node.data) node.data = next;
	};

	const walk = (root: Node) => {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let node: Node | null;
		while ((node = walker.nextNode())) fix(node as globalThis.Text);
	};

	walk(document.body);

	// Un reemplazo nuestro dispara otra mutación characterData, pero el
	// segundo pase no cambia nada (el output no contiene términos
	// restringidos) — no hay loop.
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === 'characterData') {
				fix(mutation.target as globalThis.Text);
			} else {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.TEXT_NODE) fix(node as globalThis.Text);
					else walk(node);
				});
			}
		}
	});
	observer.observe(document.body, { subtree: true, childList: true, characterData: true });
};
