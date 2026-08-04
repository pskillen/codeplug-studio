import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { DSV2_SCOPE_SELECTOR, dsv2CssVariablesResolver, themeV2 } from '../../theme-v2.ts';

export interface DesignSystemV2ProviderProps {
  children: ReactNode;
}

/**
 * Nested MantineProvider that scopes design-system v2 tokens to `.dsv2-scope`.
 * Must wrap any v2 component / styleguide demo so `--dsv2-*` vars never leak to `:root`.
 */
export default function DesignSystemV2Provider({ children }: DesignSystemV2ProviderProps) {
  return (
    <MantineProvider
      theme={themeV2}
      cssVariablesResolver={dsv2CssVariablesResolver}
      cssVariablesSelector={DSV2_SCOPE_SELECTOR}
      forceColorScheme="dark"
    >
      <div className="dsv2-scope">{children}</div>
    </MantineProvider>
  );
}
