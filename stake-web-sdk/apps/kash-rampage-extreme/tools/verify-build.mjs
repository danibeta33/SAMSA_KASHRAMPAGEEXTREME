#!/usr/bin/env node
/**
 * VERIFICADOR DEL BUILD DE PRODUCCIÓN — barrera anti-rechazo.
 *
 * Nace del feedback Stake 16-09, punto 1: el reviewer puso
 * `rgs_url=sdasda:85:602` y el juego le mostró el stack trace del
 * `TypeError: Failed to fetch`, con el `sessionID` y el `rgs_url` adentro.
 * También del rechazo N2.2, por consola sucia.
 *
 * Los dos son la misma clase de problema: código de diagnóstico que sobrevive
 * al build. Los arreglos de fondo están en el código (ver rgs-fetcher,
 * Authenticate.svelte, ModalError.svelte y el plugin de config-vite), pero un
 * arreglo en el código se puede revertir sin que nadie lo note. Esto lo NOTA:
 * corre sobre el artefacto que se sube al ACP y falla con exit 1.
 *
 *   node tools/verify-build.mjs [dir]     (default: ./build)
 *   pnpm verify                            (script de package.json)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.argv[2] || 'build';

/** Archivos que contienen código ejecutable del juego. */
const CODE_EXT = new Set(['.html', '.js', '.mjs', '.css']);

const walk = (dir) => {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (CODE_EXT.has(extname(name).toLowerCase())) out.push(full);
	}
	return out;
};

/**
 * Cada check devuelve una lista de problemas. Se corren todos antes de salir
 * para reportar de una sola pasada.
 */
const CHECKS = [
	{
		name: 'consola limpia',
		why: 'motivo de rechazo N2.2. El plugin stake-strip-console-on-build (packages/config-vite) debe borrar todo console.* en `vite build`.',
		// `console` a secas aparece en strings de terceros; se busca la LLAMADA.
		pattern: /console\s*\.\s*(log|debug|info|warn|error|trace|dir|table|group|time)\s*\(/g,
	},
	{
		name: 'sin debugger',
		why: 'un `debugger` congela el juego con las devtools abiertas — que es como lo mira el reviewer.',
		pattern: /(^|[^\w.])debugger\s*[;\n]/g,
	},
	{
		name: 'sin sourcemaps',
		why: 'expone el código fuente completo (y los comentarios internos) en las devtools.',
		pattern: /\/\/# sourceMappingURL=/g,
	},
];

/** Tiene que ESTAR: el mensaje que pidió el reviewer, literal. */
const REQUIRED = [
	{
		name: "mensaje 'Failed to fetch'",
		why: 'feedback 16-09 punto 1: con un rgs_url inválido el juego debe mostrar ese mensaje.',
		pattern: /Failed to fetch/,
	},
];

let files;
try {
	files = walk(root);
} catch {
	console.error(`✗ no se encontró el build en "${root}". Corré \`pnpm build\` primero.`);
	process.exit(1);
}

if (files.length === 0) {
	console.error(`✗ "${root}" no tiene archivos de código. ¿Build incompleto?`);
	process.exit(1);
}

const problems = [];

for (const check of CHECKS) {
	const hits = [];
	for (const file of files) {
		const text = readFileSync(file, 'utf8');
		const matches = text.match(check.pattern);
		if (matches) hits.push(`${file} (${matches.length}×, p.ej. ${JSON.stringify(matches[0].trim())})`);
	}
	if (hits.length) problems.push({ check, hits });
}

for (const req of REQUIRED) {
	const found = files.some((file) => req.pattern.test(readFileSync(file, 'utf8')));
	if (!found) problems.push({ check: req, hits: ['no aparece en ningún archivo del build'] });
}

if (problems.length === 0) {
	console.log(`✓ build verificado (${files.length} archivos de código en "${root}")`);
	process.exit(0);
}

console.error(`\n✗ BUILD RECHAZABLE — ${problems.length} problema(s):\n`);
for (const { check, hits } of problems) {
	console.error(`  ${check.name}`);
	console.error(`    por qué: ${check.why}`);
	for (const hit of hits.slice(0, 5)) console.error(`    → ${hit}`);
	if (hits.length > 5) console.error(`    → (+${hits.length - 5} más)`);
	console.error('');
}
process.exit(1);
