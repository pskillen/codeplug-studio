import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import ModePill from './ModePill.tsx';

function renderPill(props: ComponentProps<typeof ModePill>) {
  return render(
    <MantineProvider>
      <ModePill {...props} />
    </MantineProvider>,
  );
}

describe('ModePill', () => {
  it('does not show (primary) or asterisk in visible label', () => {
    renderPill({ mode: 'dmr', isMain: true });
    expect(screen.getByText('DMR')).toBeInTheDocument();
    expect(screen.queryByText(/\*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(primary\)/i)).not.toBeInTheDocument();
  });

  it('adds main border class and hidden main-mode hint when isMain', () => {
    const { container } = renderPill({ mode: 'fm', isMain: true });
    expect(container.querySelector('[class*="main"]')).toBeTruthy();
    const srOnly = container.querySelector('span[class*="srOnly"]');
    expect(srOnly?.textContent).toBe(' (main mode)');
  });

  it('omits main styling when isMain is false', () => {
    const { container } = renderPill({ mode: 'fm', isMain: false });
    expect(container.querySelector('[class*="main"]')).toBeFalsy();
    expect(screen.queryByText(' (main mode)')).not.toBeInTheDocument();
  });
});
