import { i18n, type Messages } from '@lingui/core';
import { type Language } from './stateUrl.svelte';

export const stateI18n = $state({
	i18n,
	// lingui muta la instancia en load()/activate() sin reasignar `i18n`,
	// así que la hidratación es invisible para la reactividad. `ready` es
	// la señal reactiva para deriveds que formatean ANTES de init()
	// (p.ej. money() del HUD custom de kash-smash con su fallback).
	ready: false
});

export const stateI18nDerived = {
	init: (lang: Language, messages: Messages) => {
		stateI18n.i18n.load(lang, messages as Messages);
		stateI18n.i18n.activate(lang);
		stateI18n.ready = true;
	},
	translate: (value: string) => stateI18n.i18n._(stateI18n.i18n.t(value)),
};