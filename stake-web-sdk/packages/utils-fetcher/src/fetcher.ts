export const fetcher = (options: {
	fetch?: typeof fetch;
	method: 'POST' | 'GET';
	endpoint: string;
	variables?: object;
	// Timeout/cancelación. Lo usa `rgsFetcher` para que un `rgs_url` que apunta
	// a un host que no responde (no que rechaza: que traga la conexión) no deje
	// el juego colgado en la pantalla de carga para siempre — requisito del
	// feedback Stake 16-09 punto 1: tiene que aparecer el mensaje de error.
	signal?: AbortSignal;
}) => {
	const { method, endpoint, variables, signal } = options;

	return (options.fetch ?? fetch)(endpoint, {
		method,
		headers: {
			'Content-Type': 'application/json',
		},
		...(signal ? { signal } : {}),
		...(method === 'GET' ? {} : { body: JSON.stringify(variables) }),
	});
};
