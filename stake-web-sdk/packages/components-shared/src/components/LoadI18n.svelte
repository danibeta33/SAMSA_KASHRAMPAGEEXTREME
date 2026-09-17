<script lang="ts">
	// https://lingui.dev/installation#vite
	// https://lingui.dev/tutorials/javascript
	// https://lingui.dev/ref/vite-plugin

	import { stateI18nDerived } from 'state-shared';

	import { onMount, type Snippet } from 'svelte';

	import { stateUrlDerived, type Language } from 'state-shared';
	import type { MessagesMap } from 'utils-shared/i18n';

	type Props = {
		debug?: boolean;
		children: Snippet;
		messagesMap: MessagesMap;
	};

	const props: Props = $props();

	let loaded = $state(false);

	const loadMessages = (lang: Language) => {
		const messages = props.messagesMap[lang];
		if (props.debug) console.log({ messages });
		return messages;
	};

	onMount(() => {
		try {
			const messages = loadMessages(stateUrlDerived.lang());
			stateI18nDerived.init(stateUrlDerived.lang(), messages);
		} catch (error) {
			// Gateados a DEV: consola de prod en CERO es requisito de approval.
			// Un `?lang=` desconocido cae acá y el juego sigue andando en
			// inglés — o sea que esto puede dispararse en una sesión sana, que
			// es justo el caso donde el log es peor.
			if (import.meta.env.DEV)
				console.error("Loading fallback locale 'en' because of error", error);
			try {
				const messages = loadMessages('en');
				stateI18nDerived.init('en', messages);
			} catch (error) {
				if (import.meta.env.DEV)
					console.error("Loading fallback locale 'en' without any messages because of error", error);
				stateI18nDerived.init('en', {});
			}
		}
		loaded = true;
	});
</script>

{#if loaded}
	{@render props.children()}
{/if}
