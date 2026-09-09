// @ts-ignore
import config from 'config-vite';
import { mergeConfig } from 'vite';

export default mergeConfig(config(), {
	server: {
		watch: {
			// build/ es output, no fuente: en Windows el watcher revienta con EBUSY
			// sobre los .m4a apenas se toca el build y se cae el dev server.
			ignored: ['**/build/**'],
		},
	},
});
