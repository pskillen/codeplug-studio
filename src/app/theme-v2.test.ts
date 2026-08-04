import { describe, expect, it } from 'vitest';
import { COMBOBOX_DEFAULT_PROPS, MODAL_ABOVE_MAP_Z_INDEX } from './theme.ts';
import { DSV2_SCOPE_SELECTOR, DSV2_TOKENS, dsv2CssVariablesResolver, themeV2 } from './theme-v2.ts';

describe('theme-v2 tokens', () => {
  it('exposes the design-system scope selector', () => {
    expect(DSV2_SCOPE_SELECTOR).toBe('.dsv2-scope');
  });

  it('keeps representative color tokens from the design system', () => {
    expect(DSV2_TOKENS.colors.bg).toBe('#0b0f14');
    expect(DSV2_TOKENS.colors.accent).toBe('#4f8cff');
    expect(DSV2_TOKENS.colors.band2m).toBe('#4a87fd');
    expect(DSV2_TOKENS.colors.modeDmr).toBe('#e03131');
  });

  it('keeps typography, spacing, radii, and the single popover shadow', () => {
    expect(DSV2_TOKENS.typography.sizes.body).toBe('13px');
    expect(DSV2_TOKENS.spacing['1']).toBe('4px');
    expect(DSV2_TOKENS.spacing['10']).toBe('32px');
    expect(DSV2_TOKENS.radii.control).toBe('8px');
    expect(DSV2_TOKENS.radii.panel).toBe('10px');
    expect(DSV2_TOKENS.radii.pill).toBe('999px');
    expect(DSV2_TOKENS.radii.sm).toBe('6px');
    expect(DSV2_TOKENS.shadows.popover).toBe('0 8px 24px rgba(0,0,0,.35)');
  });
});

describe('themeV2 merged theme', () => {
  it('is a valid merged theme with v2 radii and brand colors', () => {
    expect(themeV2.primaryColor).toBe('brand');
    expect(themeV2.radius.sm).toBe(DSV2_TOKENS.radii.sm);
    expect(themeV2.radius.md).toBe(DSV2_TOKENS.radii.panel);
    expect(themeV2.radius.control).toBe(DSV2_TOKENS.radii.control);
    expect(themeV2.radius.panel).toBe(DSV2_TOKENS.radii.panel);
    expect(themeV2.radius.pill).toBe(DSV2_TOKENS.radii.pill);
    expect(themeV2.colors.brand[5]).toBe(DSV2_TOKENS.colors.accent);
    expect(themeV2.colors.dark[7]).toBe(DSV2_TOKENS.colors.bg);
  });

  it('preserves v1 combobox and modal z-index plumbing', () => {
    expect(themeV2.components.Select?.defaultProps).toMatchObject({
      comboboxProps: COMBOBOX_DEFAULT_PROPS,
    });
    expect(themeV2.components.Modal?.defaultProps).toMatchObject({
      zIndex: MODAL_ABOVE_MAP_Z_INDEX,
    });
    expect(themeV2.components.Drawer?.defaultProps).toMatchObject({
      zIndex: MODAL_ABOVE_MAP_Z_INDEX,
    });
  });
});

describe('dsv2CssVariablesResolver', () => {
  it('still emits base Mantine vars (compose-vs-replace guard)', () => {
    const resolved = dsv2CssVariablesResolver(themeV2);

    expect(resolved.variables['--mantine-font-family']).toBeTruthy();
    expect(resolved.variables['--mantine-radius-default']).toBeTruthy();
    expect(resolved.variables['--mantine-z-index-modal']).toBeTruthy();
    expect(resolved.dark['--mantine-color-scheme']).toBe('dark');
    expect(resolved.light['--mantine-color-scheme']).toBe('light');
  });

  it('adds --dsv2-* custom vars and semantic body/text overrides', () => {
    const resolved = dsv2CssVariablesResolver(themeV2);

    expect(resolved.variables['--dsv2-accent']).toBe(DSV2_TOKENS.colors.accent);
    expect(resolved.variables['--dsv2-bg']).toBe(DSV2_TOKENS.colors.bg);
    expect(resolved.variables['--dsv2-radius-panel']).toBe(DSV2_TOKENS.radii.panel);
    expect(resolved.dark['--mantine-color-body']).toBe(DSV2_TOKENS.colors.bg);
    expect(resolved.dark['--mantine-color-text']).toBe(DSV2_TOKENS.colors.textPrimary);
  });
});
