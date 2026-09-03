type Resolve = (value: void | PromiseLike<void>) => void;

const DEFAULT_TIMEOUT_MS = 8000;

export const waitForResolve = (
	callback: (resolve: Resolve) => void,
	options?: { label?: string; timeoutMs?: number },
) =>
	new Promise<void>((resolve) => {
		let settled = false;
		const wrapped: Resolve = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		callback(wrapped);

		const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		const label = options?.label ?? 'anonymous';
		const timer = setTimeout(() => {
			if (!settled) {
				// Solo DEV: la consola de producción debe quedar limpia
				// (requisito de approval) — el force-resolve sigue igual.
				if (import.meta.env.DEV) {
					console.warn(
						`[waitForResolve TIMEOUT] "${label}" did not resolve within ${timeoutMs}ms — forcing resolution to avoid round hang.`,
					);
				}
				wrapped();
			}
			clearTimeout(timer);
		}, timeoutMs);
	});

export const waitForTimeout = (time: number) =>
	new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			clearTimeout(timeout);
			resolve();
		}, time);
	});
