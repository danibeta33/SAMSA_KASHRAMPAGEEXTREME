import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

// ────────────────────────────────────────────────────────────────────────────
// CONTENCIÓN DE ERRORES DEL RGS — feedback Stake 16-09, punto 1
//
// El reviewer puso `rgs_url=sdasda:85:602` y el juego le mostró el stack trace
// completo del `TypeError: Failed to fetch` dentro del modal de error, con el
// `sessionID` y el `rgs_url` de la sesión adentro (los frames del stack citan
// la URL del documento, y el build inlinea todo el bundle en `index.html`, así
// que la URL del documento ES la del iframe con sus query params).
//
// El parche anterior escondía el `<pre>` detrás de `import.meta.env.DEV`. No
// alcanza como garantía: cualquier build hecho con mode=development vuelve a
// filtrarlo. La regla definitiva es de ORIGEN — de acá NUNCA sale un `Error`
// nativo. Todo fallo de red, de parseo o de timeout se normaliza a un objeto
// PLANO, sin `stack`, sin `cause` y sin la URL. Aunque alguien vuelva a
// imprimir el error en pantalla, no hay nada técnico que imprimir.
//
// El objeto original solo se loguea en DEV (y en prod el build elimina todos
// los `console.*`, ver packages/config-vite/index.js).
// ────────────────────────────────────────────────────────────────────────────

/** Host que no responde: sin esto el juego queda cargando para siempre. */
export const RGS_REQUEST_TIMEOUT_MS = 20_000;

export type RgsRequestFailure = {
	error: 'RGS_REQUEST_FAILED';
	/** Texto exacto que pidió el reviewer. NO se le concatena nada técnico. */
	message: 'Failed to fetch';
};

export const isRgsRequestFailure = (value: unknown): value is RgsRequestFailure =>
	!!value && typeof value === 'object' && (value as RgsRequestFailure).error === 'RGS_REQUEST_FAILED';

const rgsRequestFailure = (context: string, cause: unknown): RgsRequestFailure => {
	// Gateado a DEV: consola limpia en prod es requisito de approval (rechazo
	// N2.2). En el build de prod esta línea directamente no existe.
	if (import.meta.env.DEV) console.error(`[rgs] ${context}`, cause);
	return { error: 'RGS_REQUEST_FAILED', message: 'Failed to fetch' };
};

const buildEndpoint = (rgsUrl: string, path: string) =>
	`${rgsUrl.startsWith('http') ? '' : 'https://'}${rgsUrl}${path}`;

/**
 * Única puerta de salida a la red del RGS. Devuelve el JSON parseado o lanza
 * un `RgsRequestFailure` plano — nunca un `TypeError`/`SyntaxError` del
 * browser, que son los que traen stack.
 */
const request = async <TResponse>(options: {
	method: 'POST' | 'GET';
	rgsUrl: string;
	path: string;
	variables?: object;
}): Promise<TResponse> => {
	const endpoint = buildEndpoint(options.rgsUrl, options.path);

	// `AbortSignal.timeout` no existe en navegadores viejos → fallback manual,
	// porque un throw acá sería justamente el error crudo que queremos evitar.
	const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
	const timeoutId = controller
		? setTimeout(() => controller.abort(), RGS_REQUEST_TIMEOUT_MS)
		: undefined;

	let response: Response;
	try {
		response = await fetcher({
			method: options.method,
			variables: options.variables,
			endpoint,
			...(controller ? { signal: controller.signal } : {}),
		});
	} catch (error) {
		// `rgs_url` inválido, host inexistente, CORS, offline o timeout.
		throw rgsRequestFailure(`${options.method} ${options.path} failed`, error);
	} finally {
		if (timeoutId !== undefined) clearTimeout(timeoutId);
	}

	// Un no-200 se propaga igual al caller (puede traer un body de error del
	// RGS que sí es útil), pero ya sin nada que loguear en prod.
	if (response.status !== 200 && import.meta.env.DEV) console.error('[rgs] non-200', response.status);

	try {
		return (await response.json()) as TResponse;
	} catch (error) {
		// El servidor contestó pero no con JSON: típico de un `rgs_url` que
		// apunta a cualquier otra cosa (una web, un proxy, un 404 en HTML).
		throw rgsRequestFailure(`${options.method} ${options.path} returned a non-JSON body`, error);
	}
};

export const rgsFetcher = {
	post: function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		return request<TResponse>({
			method: 'POST',
			rgsUrl: options.rgsUrl,
			path: options.url as string,
			variables: options.variables,
		});
	},
	get: function get<
		T extends keyof paths,
		TResponse = paths[T]['get']['responses'][200]['content']['application/json'],
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		return request<TResponse>({
			method: 'GET',
			rgsUrl: options.rgsUrl,
			path: options.url as string,
		});
	},
};
