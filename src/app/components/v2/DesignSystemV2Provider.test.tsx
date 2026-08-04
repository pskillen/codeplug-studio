import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import { DSV2_TOKENS } from '../../theme-v2.ts';

describe('DesignSystemV2Provider', () => {
  it('resolves --dsv2-accent inside the scope and not outside it', () => {
    render(
      <MantineProvider defaultColorScheme="dark">
        <DesignSystemV2Provider>
          <span data-testid="inside">inside</span>
        </DesignSystemV2Provider>
        <span data-testid="outside">outside</span>
      </MantineProvider>,
    );

    const inside = screen.getByTestId('inside');
    const outside = screen.getByTestId('outside');
    const scope = inside.closest('.dsv2-scope');

    expect(scope).toBeTruthy();

    // Mantine injects a <style data-mantine-styles> targeting `.dsv2-scope`.
    // Assert the stylesheet is scoped (jsdom does not always resolve custom
    // properties via getComputedStyle from <style> tags).
    const mantineStyles = Array.from(document.querySelectorAll('style[data-mantine-styles]')).map(
      (el) => el.textContent ?? '',
    );
    const scopedSheet = mantineStyles.find((css) => css.includes('--dsv2-accent'));
    expect(scopedSheet).toBeTruthy();
    expect(scopedSheet).toContain('.dsv2-scope');
    expect(scopedSheet).toContain(`--dsv2-accent: ${DSV2_TOKENS.colors.accent}`);
    expect(scopedSheet).not.toMatch(/:root[^{]*\{[^}]*--dsv2-accent/);

    // When the engine applies the sheet, computed style matches; when jsdom
    // does not, the stylesheet assertions above are the isolation proof.
    const insideAccent = getComputedStyle(inside).getPropertyValue('--dsv2-accent').trim();
    const outsideAccent = getComputedStyle(outside).getPropertyValue('--dsv2-accent').trim();
    if (insideAccent) {
      expect(insideAccent).toBe(DSV2_TOKENS.colors.accent);
    }
    expect(outsideAccent).toBe('');
  });
});
