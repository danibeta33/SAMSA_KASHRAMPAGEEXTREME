<script lang="ts">
	import { Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';

	import type { ButtonIcon } from '../types';
	import type { Snippet } from 'svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { UI_BASE_FONT_SIZE } from '../constants';

	type Props = Omit<ButtonProps, 'children'> & {
		icon: ButtonIcon;
		sizes: { width: number; height: number };
		active?: boolean;
		children?: Snippet;
		variant?: 'dark' | 'light';
	};

	const {
		icon,
		active,
		variant = 'dark',
		children: childrenFromParent,
		...buttonProps
	}: Props = $props();

	const KASH_LIME = 0xd4ff3a;
	const KASH_DARK = 0x0d0c0a;

	const iconSpriteKey = $derived(
		(
			{
				menu: 'iconMenu',
				settings: 'iconSettings',
				soundOn: 'iconSoundOn',
				soundOff: 'iconSoundOn',
				decrease: 'iconMinus',
				increase: 'iconPlus',
				turbo: 'iconTurbo',
				autoSpin: 'iconAutospin',
			} as Record<string, string>
		)[icon as string],
	);

	const isHorizontal = $derived(buttonProps.sizes.width > buttonProps.sizes.height * 1.4);
	const panelKey = $derived(
		isHorizontal ? (variant === 'light' ? 'btnPanelCta' : 'btnPanelDark') : 'btnRoundDark',
	);

	// Detect missing assets at runtime so the template renders without sprites;
	// Kash Smash (sprites loaded) keeps the original look.
	const context = getContextApp();
	const hasPanelSprite = $derived(!!context.stateApp.loadedAssets?.[panelKey]);
	const hasIconSprite = $derived(
		iconSpriteKey ? !!context.stateApp.loadedAssets?.[iconSpriteKey] : false,
	);
</script>

<Button {...buttonProps}>
	{#snippet children({ center })}
		{#if hasPanelSprite}
			<Sprite
				key={panelKey}
				x={center.x}
				y={center.y}
				anchor={0.5}
				width={buttonProps.sizes.width}
				height={buttonProps.sizes.height}
			/>
		{:else}
			<Rectangle
				anchor={0.5}
				x={center.x}
				y={center.y}
				width={buttonProps.sizes.width}
				height={buttonProps.sizes.height}
				borderRadius={isHorizontal
					? buttonProps.sizes.height * 0.5
					: buttonProps.sizes.height * 0.35}
				backgroundColor={active ? KASH_LIME : variant === 'light' ? KASH_LIME : KASH_DARK}
				backgroundAlpha={active ? 1 : variant === 'light' ? 1 : 0.85}
				borderColor={active ? KASH_DARK : variant === 'light' ? KASH_DARK : KASH_LIME}
				borderWidth={active ? 3 : 2}
			/>
			{#if active}
				<!-- Tiny ON dot indicator (top-right corner) so active state reads at a glance. -->
				<Rectangle
					anchor={0.5}
					x={center.x + buttonProps.sizes.width * 0.35}
					y={center.y - buttonProps.sizes.height * 0.35}
					width={buttonProps.sizes.width * 0.12}
					height={buttonProps.sizes.width * 0.12}
					borderRadius={buttonProps.sizes.width * 0.06}
					backgroundColor={0xec4899}
					borderColor={KASH_DARK}
					borderWidth={2}
				/>
			{/if}
		{/if}

		{#if hasIconSprite && iconSpriteKey}
			<Sprite
				key={iconSpriteKey}
				x={center.x}
				y={center.y}
				anchor={0.5}
				width={Math.min(buttonProps.sizes.width, buttonProps.sizes.height) * 0.42}
				height={Math.min(buttonProps.sizes.width, buttonProps.sizes.height) * 0.42}
			/>
		{:else}
			{@const text = i18nDerived[icon]()}
			{@const isShortGlyph = text.length <= 2}
			{@const isMultiWord = text.includes(' ')}
			<Text
				{...center}
				anchor={0.5}
				{text}
				style={{
					align: 'center',
					wordWrap: true,
					wordWrapWidth: buttonProps.sizes.width * 0.9,
					fontFamily: 'Europa',
					fontWeight: '900',
					fontSize:
						UI_BASE_FONT_SIZE *
						(isHorizontal
							? 1.05
							: isShortGlyph
								? 1.4
								: isMultiWord
									? 0.6
									: 0.85),
					letterSpacing: isShortGlyph ? 0 : 1,
					fill: active ? KASH_DARK : variant === 'light' ? KASH_DARK : KASH_LIME,
					stroke: active
						? undefined
						: variant === 'light'
							? undefined
							: { color: KASH_DARK, width: 2 },
				}}
			/>
		{/if}

		{@render childrenFromParent?.()}
	{/snippet}
</Button>
