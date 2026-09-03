import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		const response = await fetcher({
			method: 'POST',
			variables: options.variables,
			endpoint: `${options.rgsUrl.startsWith('http') ? '' : 'https://'}${options.rgsUrl}${options.url}`,
		});

		// Gateado a DEV: un RGS error en prod no debe ensuciar la consola
		// (rechazo N2.2 fue por consola sucia); el error igual se propaga al
		// caller, que decide si muestra modal.
		if (response.status !== 200 && import.meta.env.DEV) console.error('error', response);
		const data = await response.json();
		return data as TResponse;
	},
	get: async function get<
		T extends keyof paths,
		TResponse = paths[T]['get']['responses'][200]['content']['application/json'],
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		const response = await fetcher({
			method: 'GET',
			endpoint: `${options.rgsUrl.startsWith('http') ? '' : 'https://'}${options.rgsUrl}${options.url}`,
		});

		// Gateado a DEV: un RGS error en prod no debe ensuciar la consola
		// (rechazo N2.2 fue por consola sucia); el error igual se propaga al
		// caller, que decide si muestra modal.
		if (response.status !== 200 && import.meta.env.DEV) console.error('error', response);
		const data = await response.json();
		return data as TResponse;
	},
};
