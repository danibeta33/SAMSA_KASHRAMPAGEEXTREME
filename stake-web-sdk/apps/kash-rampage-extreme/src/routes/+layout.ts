// if you want to generate a static html file
// for your page.
// Documentation: https://kit.svelte.dev/docs/page-options#prerender
export const prerender = true;

// if you want to Generate a SPA
// you have to set ssr to false.
// This is not the case (so set as true or comment the line)
// Documentation: https://kit.svelte.dev/docs/page-options#ssr
export const ssr = false;

// How to manage the trailing slashes in the URLs
// the URL for about page witll be /about with 'ignore' (default)
// the URL for about page witll be /about/ with 'always'
// https://kit.svelte.dev/docs/page-options#trailingslash
export const trailingSlash = 'ignore';

// ────────────────────────────────────────────────────────────────────────────
// CONSOLA LIMPIA: promesas rechazadas sin handler — SOLO PROD
//
// El build de producción elimina todos los `console.*` del bundle
// (packages/config-vite/index.js), pero eso no alcanza para los mensajes que
// imprime el PROPIO navegador: una promesa que nadie atrapa deja un
// "Uncaught (in promise) TypeError: Failed to fetch" con su stack en la
// consola, que es lo primero que abre el reviewer del ACP.
//
// Con los arreglos del feedback 16-09 ningún pedido al RGS queda sin atrapar
// (ver packages/rgs-fetcher), así que esto es la última red: un fetch de un
// asset, de una fuente o de un sonido que falle no ensucia la consola. El
// error se sigue manejando donde corresponda — `preventDefault()` solo evita
// que el navegador lo imprima.
//
// En DEV NO se instala: depurar sin ver las promesas rotas es peor.
if (typeof window !== 'undefined' && import.meta.env.PROD) {
	window.addEventListener('unhandledrejection', (event) => {
		event.preventDefault();
	});
}
