// Compilador de mensajes para Lingui en PRODUCCIÓN.
//
// Lingui solo instala su compilador de mensajes cuando NODE_ENV !== production
// (@lingui/core: `if (process.env.NODE_ENV !== 'production') setMessagesCompiler`).
// En el build de prod, al traducir un mensaje de catálogo "crudo" (string),
// emite `console.warn("Uncompiled message detected!")` — se veía al disparar
// las notificaciones de límite del autoplay (consola sucia = rechazo del ACP).
//
// El catálogo de este juego es 100% texto plano (sin plurales/select ICU),
// así que un compilador mínimo alcanza: devuelve el mismo formato de tokens
// que produce @lingui/message-utils para texto simple + interpolación `{var}`.
// NO soporta ICU complejo a propósito — no lo usamos y evita falsos positivos.

// Espejo del tipo CompiledMessage de @lingui/message-utils (dep transitiva,
// no importable de forma estable desde la app): array de tokens, cada token
// es texto literal o [nombreDeVariable].
type Token = string | [string];

export const compileMessagePlain = (message: string): Token[] => {
	if (!message.includes('{')) return [message];
	const tokens: Token[] = [];
	const re = /\{(\w+)\}/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(message)) !== null) {
		if (m.index > last) tokens.push(message.slice(last, m.index));
		tokens.push([m[1]]);
		last = m.index + m[0].length;
	}
	if (last < message.length) tokens.push(message.slice(last));
	return tokens;
};
