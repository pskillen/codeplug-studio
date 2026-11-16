import { Combobox, MantineProvider, mergeMantineTheme } from '@mantine/core';
import type { ReactNode } from 'react';
import { DSV2_SCOPE_SELECTOR, dsv2CssVariablesResolver, themeV2 } from '../../theme-v2.ts';
import './dsv2-responsive.css';

export interface DesignSystemV2ProviderProps {
  children: ReactNode;
  /**
   * `"dark"` makes this scope a dark page on a light app: it carries `data-mantine-color-scheme="dark"`
   * so plain Mantine components read the dark palette, paints the v2 page colours, and keeps
   * dropdowns inside the scope (a portal to `body` would leave them light). Omitted: unchanged.
   */
  scheme?: 'dark';
}

/** Dropdowns stay in the scope's DOM so the dark palette reaches them. */
const themeV2DarkPage = mergeMantineTheme(themeV2, {
  components: { Combobox: Combobox.extend({ defaultProps: { withinPortal: false } }) },
});

const DARK_PAGE_STYLE = {
  background: 'var(--dsv2-bg)',
  color: 'var(--dsv2-text-primary)',
} as const;

/**
 * Nested MantineProvider that scopes design-system v2 tokens to `.dsv2-scope`.
 * Must wrap any v2 component / styleguide demo so `--dsv2-*` vars never leak to `:root`.
 */
export default function DesignSystemV2Provider({ children, scheme }: DesignSystemV2ProviderProps) {
  const darkPage = scheme === 'dark';
  return (
    <MantineProvider
      theme={darkPage ? themeV2DarkPage : themeV2}
      cssVariablesResolver={dsv2CssVariablesResolver}
      cssVariablesSelector={DSV2_SCOPE_SELECTOR}
      forceColorScheme="dark"
    >
      <div
        className="dsv2-scope"
        data-mantine-color-scheme={darkPage ? 'dark' : undefined}
        style={darkPage ? DARK_PAGE_STYLE : undefined}
      >
        {children}
      </div>
    </MantineProvider>
  );
}
