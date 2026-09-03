<script lang="ts">
	import { Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';
	import { stateModal, stateBet, stateBetDerived } from 'state-shared';

	import { UI_BASE_FONT_SIZE, UI_BASE_SIZE } from '../constants';
	import { getContext } from '../context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const props: Partial<Omit<ButtonProps, 'children'>> = $props();
	const { stateXstateDerived, eventEmitter } = getContext();
	const sizes = { width: UI_BASE_SIZE * 1.6, height: UI_BASE_SIZE };
	const disabled = $derived(!stateXstateDerived.isIdle());
	const active = $derived(stateBetDerived.activeBetMode()?.type === 'activate');

	const KASH_PINK = 0xec4899;
	const KASH_DARK = 0x0d0c0a;

	const openModal = () => (stateModal.modal = { name: 'buyBonus' });
	const disableActiveBetMode = () => (stateBet.activeBetModeKey = 'BASE');
	const onpress = () => {
		eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (active) disableActiveBetMode();
		else openModal();
	};

	const context = getContextApp();
	const hasPanelSprite = $derived(!!context.stateApp.loadedAssets?.['btnPanelPink']);
	const hasIconSprite = $derived(!!context.stateApp.loadedAssets?.['iconBonus']);
</script>

<Button {...props} {sizes} {disabled} {onpress}>
	{#snippet children({ center })}
		{#if hasPanelSprite}
			<Sprite
				key="btnPanelPink"
				x={center.x}
				y={center.y}
				anchor={0.5}
				width={sizes.width}
				height={sizes.height}
			/>
		{:else}
			<Rectangle
				anchor={0.5}
				x={center.x}
				y={center.y}
				width={sizes.width}
				height={sizes.height}
				borderRadius={sizes.height * 0.5}
				backgroundColor={KASH_PINK}
				borderColor={KASH_DARK}
				borderWidth={2}
			/>
		{/if}

		{#if hasIconSprite}
			<Sprite
				key="iconBonus"
				x={center.x - sizes.width * 0.22}
				y={center.y}
				anchor={0.5}
				width={sizes.height * 0.5}
				height={sizes.height * 0.5}
			/>
		{/if}

		<Text
			x={hasIconSprite ? center.x + sizes.width * 0.12 : center.x}
			y={center.y}
			anchor={0.5}
			text={active ? i18nDerived.disable() : i18nDerived.bonus()}
			style={{
				align: 'center',
				fontFamily: 'Europa',
				fontWeight: '900',
				fontSize: UI_BASE_FONT_SIZE * 0.85,
				letterSpacing: 1.5,
				fill: 0xffffff,
				stroke: { color: KASH_DARK, width: 3 },
			}}
		/>
	{/snippet}
</Button>
