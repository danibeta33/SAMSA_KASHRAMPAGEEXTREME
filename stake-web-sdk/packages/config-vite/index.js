// Don't convert this to a ts file, because of this https://github.com/vitejs/vite/issues/5370
import { sveltekit } from '@sveltejs/kit/vite';
import { lingui } from '@lingui/vite-plugin';
import { defineConfig, transformWithEsbuild } from 'vite';

const NODE_ENV = process.env.NODE_ENV;
let dev = NODE_ENV === 'development';

// ────────────────────────────────────────────────────────────────────────────
// CONSOLA LIMPIA EN PRODUCCIÓN — garantía a nivel build
//
// Rechazo N2.2 (consola sucia) y feedback Stake 16-09 punto 1 ("without any
// unnecessary technical details or code"): los `console.*` del juego estaban
// gateados a mano con `import.meta.env.DEV`, uno por uno. Eso depende de que
// nadie se olvide nunca — y además no cubre los `console.*` de las
// dependencias que terminan en el bundle (pixi-svelte loguea keys de assets
// faltantes, pixi.js avisa de fallbacks de WebGPU→WebGL, etc.).
//
// `apply: 'build'` hace que esto corra SOLO en `vite build`, jamás en
// `vite dev`: el desarrollo mantiene toda su instrumentación intacta, y el
// artefacto que sube al ACP sale sin una sola llamada a console ni debugger.
// ────────────────────────────────────────────────────────────────────────────
// Por qué un `renderChunk` y no `esbuild: { drop: [...] }` en la config:
// esa opción solo alcanza a los archivos que Vite pasa por su transform de
// esbuild (`.ts`, `.tsx`, `.jsx`) — NO al `.mjs` de las dependencias. Medido
// sobre el build real: con `drop` en la config, el banner
// `console.log("PixiJS ...")` de pixi.js seguía en `index.html`. Este hook
// corre sobre el chunk YA ensamblado, así que barre todo: código del juego,
// del SDK y de las dependencias.
const stripConsoleOnBuild = {
	name: 'stake-strip-console-on-build',
	apply: 'build',
	enforce: 'post',
	async renderChunk(code) {
		if (!code.includes('console') && !code.includes('debugger')) return null;

		const options = {
			drop: ['console', 'debugger'],
			// Sin downlevel: acá solo se borran llamadas, no se transpila.
			target: 'esnext',
			// Los sourcemaps de prod ya están apagados (ver `build.sourcemap`).
			sourcemap: false,
		};

		// DOS PASADAS, a propósito.
		//
		// `drop: ['console']` de esbuild solo reconoce el patrón `console.x(...)`.
		// pixi.js escribe su banner como `globalThis.console.log(...)` y sobrevivía
		// intacto al build. El `define` lo reescribe a `console.log(...)`, pero
		// dentro de la MISMA pasada el drop se evalúa antes de la sustitución, así
		// que no lo agarra: hace falta volver a pasar.
		const normalized = await transformWithEsbuild(code, 'chunk.js', {
			...options,
			define: { 'globalThis.console': 'console', 'window.console': 'console' },
		});
		const stripped = await transformWithEsbuild(normalized.code, 'chunk.js', options);

		return { code: stripped.code, map: null };
	},
};

export default () =>
	defineConfig({
		plugins: [sveltekit(), lingui(), stripConsoleOnBuild],
		logLevel: 'info',
		build: {
			assetsInlineLimit: Infinity,
			sourcemap: dev ? true : false,
			output: {
				sourcemap: dev ? true : false,
			},
		},
		css: {
			preprocessorOptions: {
				scss: {
					api: 'modern-compiler',
				},
			},
		},
	});
