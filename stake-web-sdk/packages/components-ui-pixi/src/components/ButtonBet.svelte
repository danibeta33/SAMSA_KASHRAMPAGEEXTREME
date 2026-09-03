<script lang="ts">
	import { Container, Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';
	import { OnHotkey } from 'components-shared';
	import { stateBetDerived } from 'state-shared';

	import ButtonBetProvider from './ButtonBetProvider.svelte';
	import { UI_BASE_FONT_SIZE, UI_BASE_SIZE } from '../constants';
	import { i18nDerived } from '../i18n/i18nDerived';

	const props: Partial<Omit<ButtonProps, 'children'>> = $props();
	const disabled = $derived(!stateBetDerived.isBetCostAvailable());
	const sizes = { width: UI_BASE_SIZE * 1.6, height: UI_BASE_SIZE };

	const KASH_LIME = 0xd4ff3a;
	const KASH_DARK = 0x0d0c0a;

	const context = getContextApp();
	const hasCtaSprite = $derived(!!context.stateApp.loadedAssets?.['btnPanelCta']);
</script>

<ButtonBetProvider>
	{#snippet children({ key, onpress })}
		<OnHotkey hotkey="Space" {disabled} {onpress} />
		<Button {...props} {sizes} {onpress} {disabled}>
			{#snippet children({ center })}
				<Container {...center}>
					{#if hasCtaSprite}
						<Sprite key="btnPanelCta" width={sizes.width} height={sizes.height} anchor={0.5} />
					{:else}
						<Rectangle
							anchor={0.5}
							width={sizes.width}
							height={sizes.height}
							borderRadius={sizes.height * 0.5}
							backgroundColor={KASH_LIME}
							borderColor={KASH_DARK}
							borderWidth={2}
						/>
					{/if}
					<Text
						anchor={0.5}
						text={['spin_default', 'spin_disabled'].includes(key)
							? i18nDerived.bet()
							: i18nDerived.stop()}
						style={{
							align: 'center',
							fontFamily: 'Europa',
							fontWeight: '900',
							fontSize: UI_BASE_FONT_SIZE * 1.4,
							letterSpacing: 3,
							fill: KASH_DARK,
							stroke: { color: 0xffffff, width: 1 },
						}}
					/>
				</Container>
			{/snippet}
		</Button>
	{/snippet}
</ButtonBetProvider>
